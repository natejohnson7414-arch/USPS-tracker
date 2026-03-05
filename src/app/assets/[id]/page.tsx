'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { History, CalendarClock, Settings, Wrench, Clock, Loader2, AlertCircle, Box, PlusCircle, Repeat, ArrowLeft, Camera, Library, Maximize2, Download, Trash2, X } from 'lucide-react';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { getAssetById, getAssetPmSchedules, getAssetServiceHistory, calculateAssetMetrics } from '@/lib/data';
import type { Asset, AssetPmSchedule, AssetServiceHistory } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { AddPmScheduleDialog } from '@/components/add-pm-schedule-dialog';
import { uploadImageResumable, deleteImage } from '@/firebase/storage';
import { doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AssetDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [asset, setAsset] = useState<Asset | null>(null);
  const [schedules, setSchedules] = useState<AssetPmSchedule[]>([]);
  const [history, setHistory] = useState<AssetServiceHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<AssetPmSchedule | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);

  const takePhotoInputRef = useRef<HTMLInputElement>(null);
  const chooseFromLibraryInputRef = useRef<HTMLInputElement>(null);

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

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !db || !asset) return;

    setIsUploadingPhotos(true);
    setPhotoSheetOpen(false);
    const toastId = toast({ title: `Uploading ${files.length} photo(s)...`, duration: Infinity });

    try {
      const uploadedUrls: string[] = [];
      let i = 0;
      for (const file of Array.from(files)) {
        i++;
        const path = `assets/${asset.assetTag}/${Date.now()}-${file.name}`;
        const { downloadURL } = await uploadImageResumable(file, path, {
          onProgress: (p) => {
            toastId.update({ id: toastId.id, description: `File ${i}/${files.length}: ${p.pct}%` });
          }
        });
        uploadedUrls.push(downloadURL);
      }

      const assetRef = doc(db, 'assets', asset.id);
      await updateDocumentNonBlocking(assetRef, {
        photoUrls: arrayUnion(...uploadedUrls)
      });

      setAsset(prev => prev ? ({ ...prev, photoUrls: [...(prev.photoUrls || []), ...uploadedUrls] } as Asset) : null);
      toastId.dismiss();
      toast({ title: "Photos Added" });
    } catch (error) {
      toastId.dismiss();
      toast({ variant: 'destructive', title: 'Upload Failed' });
    } finally {
      setIsUploadingPhotos(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!viewingPhoto || !db || !asset) return;
    const urlToDelete = viewingPhoto;
    setViewingPhoto(null);

    try {
      const assetRef = doc(db, 'assets', asset.id);
      await updateDocumentNonBlocking(assetRef, {
        photoUrls: arrayRemove(urlToDelete)
      });
      await deleteImage(urlToDelete);
      setAsset(prev => prev ? ({ ...prev, photoUrls: (prev.photoUrls || []).filter(u => u !== urlToDelete) } as Asset) : null);
      toast({ title: "Photo Deleted" });
    } catch (error) {
      toast({ title: "Delete Failed", variant: 'destructive' });
    }
  };

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
      {(isUploadingPhotos) && (
        <div className="fixed inset-0 bg-background/80 z-50 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-lg font-medium">Uploading Photos...</p>
        </div>
      )}

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
                  <Settings className="mr-2 h-4 w-4" /> Edit Specs
                </Link>
              </Button>
              <Button onClick={() => setPhotoSheetOpen(true)}><Camera className="mr-2 h-4 w-4" /> Add Photo</Button>
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
              </TabsList>

              <TabsContent value="photos">
                <Card>
                  <CardHeader><CardTitle>Asset Documentation</CardTitle></CardHeader>
                  <CardContent>
                    {asset.photoUrls && asset.photoUrls.length > 0 ? (
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                        {asset.photoUrls.map((url, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer" onClick={() => setViewingPhoto(url)}>
                            <Image 
                              src={url} 
                              alt={`Asset photo ${idx + 1}`} 
                              fill 
                              sizes="(max-width: 768px) 25vw, 12vw"
                              className="object-cover" 
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Maximize2 className="text-white h-5 w-5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Camera className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No photos available for this asset.</p>
                        <Button variant="link" onClick={() => setPhotoSheetOpen(true)} className="mt-2">
                          Add Photo Now
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

      <Sheet open={photoSheetOpen} onOpenChange={setPhotoSheetOpen}>
        <SheetContent side="bottom">
          <SheetHeader><SheetTitle>Add Asset Photos</SheetTitle></SheetHeader>
          <div className="grid gap-4 py-6">
            <Button variant="outline" className="justify-start h-14" onClick={() => takePhotoInputRef.current?.click()}>
              <Camera className="mr-4 h-6 w-6" /> Take Photo
            </Button>
            <Button variant="outline" className="justify-start h-14" onClick={() => chooseFromLibraryInputRef.current?.click()}>
              <Library className="mr-4 h-6 w-6" /> Choose from Library
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <input type="file" ref={takePhotoInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" capture="environment" multiple />
      <input type="file" ref={chooseFromLibraryInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" multiple />

      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-0 flex flex-col items-stretch h-[90vh]">
          <DialogHeader className="p-4 bg-background/10 backdrop-blur-sm border-b border-white/10 absolute top-0 w-full z-10">
            <DialogTitle className="text-white text-sm font-bold uppercase tracking-widest">Asset Documentation Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 relative flex items-center justify-center p-4">
            {viewingPhoto && <Image src={viewingPhoto} alt="Asset photo preview" fill className="object-contain" priority />}
          </div>
          <div className="p-4 bg-background flex justify-between items-center border-t">
            <Button variant="outline" size="sm" onClick={() => setViewingPhoto(null)}>Close</Button>
            <div className="flex items-center gap-2">
              {viewingPhoto && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/image-proxy?url=${encodeURIComponent(viewingPhoto)}`} download>
                    <Download className="h-4 w-4 mr-2" /> Download
                  </a>
                </Button>
              )}
              {viewingPhoto && (
                <Button variant="destructive" size="sm" onClick={handleDeletePhoto}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Documentation
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
