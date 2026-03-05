'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { History, CalendarClock, Settings, Wrench, ShieldCheck, Clock, FileText, Loader2, AlertCircle, Box, Tag, PlusCircle, Repeat, ArrowLeft, Camera } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { getAssetById, getAssetPmSchedules, getAssetServiceHistory, calculateAssetMetrics } from '@/lib/data';
import type { Asset, AssetPmSchedule, AssetServiceHistory } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { AddPmScheduleDialog } from '@/components/add-pm-schedule-dialog';

export default function AssetDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [schedules, setSchedules] = useState<AssetPmSchedule[]>([]);
  const [history, setHistory] = useState<AssetServiceHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<AssetPmSchedule | null>(null);

  const fetchAssetData = useCallback(async () => {
    if (db && id && id !== 'new') {
      const [a, s, h] = await Promise.all([
        getAssetById(db, id as string),
        getAssetPmSchedules(db, id as string),
        getAssetServiceHistory(db, id as string)
      ]);
      setAsset(a || null);
      setSchedules(s);
      setHistory(h);
    }
  }, [db, id]);

  useEffect(() => {
    if (db && id && id !== 'new') {
      fetchAssetData().finally(() => setIsLoading(false));
    } else if (id === 'new') {
        setIsLoading(false);
    }
  }, [db, id, fetchAssetData]);

  const handleEditSchedule = (s: AssetPmSchedule) => {
    setSelectedSchedule(s);
    setIsScheduleDialogOpen(true);
  };

  const handleAddSchedule = () => {
    setSelectedSchedule(null);
    setIsScheduleDialogOpen(true);
  };

  const handleScheduleSaved = () => {
    fetchAssetData();
  };

  if (isLoading) return <MainLayout><div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></MainLayout>;
  if (!asset) return <MainLayout><div className="container py-12 text-center"><AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" /><h1 className="text-2xl font-bold">Asset Not Found</h1></div></MainLayout>;

  const metrics = calculateAssetMetrics(history);

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Button variant="ghost" className="mb-4 -ml-4" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{asset.name}</h1>
                <Badge variant={asset.status === 'active' ? 'default' : 'outline'}>{asset.status}</Badge>
                <Badge variant={asset.criticality === 'high' ? 'destructive' : 'secondary'}>{asset.criticality} Criticality</Badge>
              </div>
              <p className="text-muted-foreground font-mono">Tag: {asset.assetTag} | S/N: {asset.serialNumber}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href={`/assets/${id}/edit`}>
                  <Settings className="mr-2 h-4 w-4" /> Edit Asset
                </Link>
              </Button>
              <Button><Wrench className="mr-2 h-4 w-4" /> Record Service</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider">Specifications</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div><p className="text-muted-foreground">Manufacturer</p><p className="font-medium">{asset.manufacturer || 'N/A'}</p></div>
                <div><p className="text-muted-foreground">Model</p><p className="font-medium">{asset.model || 'N/A'}</p></div>
                <div><p className="text-muted-foreground">Site Location</p><p className="font-medium">{asset.siteName || 'N/A'}</p></div>
                <Separator />
                {Object.entries(asset.customFields || {}).map(([k, v]) => (
                  <div key={k}><p className="text-muted-foreground capitalize">{k}</p><p className="font-medium">{v}</p></div>
                ))}
                <Separator />
                <div><p className="text-muted-foreground">Install Date</p><p className="font-medium">{asset.installDate ? format(new Date(asset.installDate), 'PPP') : 'N/A'}</p></div>
                <div>
                  <p className="text-muted-foreground">Warranty Until</p>
                  <p className={(asset.warrantyExpiration && new Date(asset.warrantyExpiration) < new Date()) ? "text-destructive font-medium" : "font-medium"}>
                    {asset.warrantyExpiration ? format(new Date(asset.warrantyExpiration), 'PPP') : 'N/A'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><Box className="h-4 w-4" />Recurring Parts</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {asset.materials && asset.materials.length > 0 ? (
                  asset.materials.map((m, i) => (
                    <div key={i} className="flex flex-col border-b pb-2 last:border-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-xs">{m.name}</span>
                        <Badge variant="secondary" className="scale-75 origin-right">{m.quantity} {m.uom}</Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase">{m.category}</span>
                    </div>
                  ))
                ) : <p className="text-xs text-muted-foreground italic">No materials listed.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider">Performance</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MTBF</span>
                  <span className="font-bold">{metrics.mtbf.toFixed(1)} Days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MTTR</span>
                  <span className="font-bold">{metrics.mttr.toFixed(1)} Hours</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Tabs defaultValue="photos">
              <TabsList className="mb-4">
                <TabsTrigger value="photos"><Camera className="mr-2 h-4 w-4" /> Photos</TabsTrigger>
                <TabsTrigger value="history"><History className="mr-2 h-4 w-4" /> Service History</TabsTrigger>
                <TabsTrigger value="pm"><CalendarClock className="mr-2 h-4 w-4" /> PM Schedules</TabsTrigger>
                <TabsTrigger value="docs"><FileText className="mr-2 h-4 w-4" /> Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="photos">
                <Card>
                  <CardHeader><CardTitle>Asset Photos</CardTitle></CardHeader>
                  <CardContent>
                    {asset.photoUrls && asset.photoUrls.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {asset.photoUrls.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-lg overflow-hidden border hover:opacity-90 transition-opacity">
                            <Image 
                              src={url} 
                              alt={`Asset photo ${idx + 1}`} 
                              fill 
                              sizes="(max-width: 768px) 50vw, 25vw"
                              className="object-cover" 
                            />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Camera className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No photos available for this asset.</p>
                        <Button variant="link" asChild className="mt-2">
                          <Link href={`/assets/${id}/edit`}>Add Photos</Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardContent className="pt-6">
                    {history.length > 0 ? (
                      <div className="space-y-8">
                        {history.map((record, idx) => (
                          <div key={record.id} className="relative pl-8 pb-8 border-l last:pb-0">
                            <div className="absolute left-[-5px] top-0 h-2 w-2 rounded-full bg-primary" />
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-bold">{format(new Date(record.completedDate), 'PPP')}</p>
                              <Badge variant="secondary">WO #{record.workOrderId}</Badge>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
                            {record.followUpRequired && (
                              <Badge variant="destructive" className="mt-2">Follow-up Required</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">No service history recorded for this asset.</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pm">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>PM Schedules</CardTitle>
                      <Button size="sm" variant="outline" onClick={handleAddSchedule}><PlusCircle className="mr-2 h-4 w-4" /> New Schedule</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {schedules.length > 0 ? (
                      <div className="space-y-4">
                        {schedules.map(schedule => (
                          <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-1">
                              <p className="font-bold">{schedule.templateName}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1 font-semibold text-foreground"><Clock className="h-3 w-3" /> Due: {format(new Date(schedule.nextDueDate), 'MMMM')}</span>
                                <span className="flex items-center gap-1"><Repeat className="h-3 w-3" /> Frequency: {schedule.frequencyType}</span>
                                <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> Labor: {schedule.estimatedLaborHours} hrs</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={schedule.status === 'active' ? 'default' : 'secondary'}>{schedule.status}</Badge>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditSchedule(schedule)}>
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">No active preventative maintenance schedules.</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <AddPmScheduleDialog 
        isOpen={isScheduleDialogOpen}
        onOpenChange={setIsScheduleDialogOpen}
        assetId={id as string}
        schedule={selectedSchedule}
        onScheduleAdded={handleScheduleSaved}
      />
    </MainLayout>
  );
}
