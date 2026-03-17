'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ArrowLeft, 
  MapPin, 
  Package, 
  CalendarClock, 
  Info, 
  Pencil, 
  Loader2, 
  AlertCircle,
  PlusCircle,
  ChevronRight
} from 'lucide-react';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { getWorkSiteById, getAssetsBySiteId, getPmTaskTemplates, getPmSchedulesForAsset, savePmSchedule } from '@/lib/data';
import type { WorkSite, Asset, PmTaskTemplate, PmSchedule } from '@/lib/types';
import { WorkSiteForm } from '@/components/work-site-form';
import { PmPlanningGrid } from '@/components/pm-planning-grid';
import { doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function WorkSiteDetailsPage() {
  const { id } = useParams();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [site, setSite] = useState<WorkSite | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pmTemplates, setPmTemplates] = useState<PmTaskTemplate[]>([]);
  const [assetSchedules, setAssetSchedules] = useState<Record<string, PmSchedule[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);

  const fetchData = useCallback(async () => {
    if (!db || !id) return;
    setIsLoading(true);
    try {
      const [s, a, t] = await Promise.all([
        getWorkSiteById(db, id as string),
        getAssetsBySiteId(db, id as string),
        getPmTaskTemplates(db)
      ]);
      
      setSite(s || null);
      setAssets(a);
      setPmTemplates(t);

      const schedulesMap: Record<string, PmSchedule[]> = {};
      for (const asset of a) {
        const schedules = await getPmSchedulesForAsset(db, asset.id);
        schedulesMap[asset.id] = schedules;
      }
      setAssetSchedules(schedulesMap);
    } catch (error) {
      console.error("Error fetching site data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [db, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateSchedule = async (assetId: string, templateId: string, monthStr: string) => {
    if (!db) return;
    
    const assetSchedulesList = assetSchedules[assetId] || [];
    const existingSchedule = assetSchedulesList.find(s => s.templateId === templateId);

    if (monthStr === 'none') {
      if (existingSchedule) {
        try {
          await deleteDoc(doc(db, 'assets', assetId, 'pmSchedules', existingSchedule.id));
          toast({ title: 'PM Cycle Removed' });
          fetchData();
        } catch (e) {
          toast({ title: 'Failed to remove cycle', variant: 'destructive' });
        }
      }
      return;
    }

    const month = parseInt(monthStr);
    const template = pmTemplates.find(t => t.id === templateId);
    if (!template) return;

    const scheduleData: Omit<PmSchedule, 'id'> = {
      templateId,
      templateName: template.name,
      season: template.season,
      dueMonth: month,
      recurrence: 'yearly',
      active: true,
    };

    try {
      if (existingSchedule) {
        const scheduleRef = doc(db, 'assets', assetId, 'pmSchedules', existingSchedule.id);
        await updateDocumentNonBlocking(scheduleRef, scheduleData);
        toast({ title: 'PM Cycle Rescheduled' });
      } else {
        await savePmSchedule(db, assetId, scheduleData);
        toast({ title: 'PM Cycle Scheduled' });
      }
      fetchData();
    } catch (e) {
      toast({ title: 'Failed to save cycle', variant: 'destructive' });
    }
  };

  const handleFormSaved = () => {
    setIsEditing(false);
    fetchData();
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!site) {
    return (
      <MainLayout>
        <div className="container py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold">Work Site Not Found</h1>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/work-sites">Back to Work Sites</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
          <div>
            <Button asChild variant="ghost" className="mb-4 -ml-4">
              <Link href="/work-sites">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Work Sites
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{site.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <MapPin className="h-4 w-4" />
              <span>{site.address}, {site.city}, {site.state} {site.zip}</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="assets" className="space-y-6">
          <TabsList variant="folder">
            <TabsTrigger value="assets" variant="folder">
              <Package className="mr-2 h-4 w-4" />
              Equipment Registry ({assets.length})
            </TabsTrigger>
            <TabsTrigger value="pm" variant="folder">
              <CalendarClock className="mr-2 h-4 w-4" />
              Standardized PM Grid
            </TabsTrigger>
            <TabsTrigger value="info" variant="folder">
              <Info className="mr-2 h-4 w-4" />
              Overview & Contact
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="mt-0">
            <Card className="rounded-t-none">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>On-Site Equipment</CardTitle>
                    <CardDescription>Managed assets at this location.</CardDescription>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/assets/new?siteId=${site.id}`}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Asset
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tag</TableHead>
                      <TableHead>Asset Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criticality</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.length > 0 ? (
                      assets.map(asset => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-mono font-bold">{asset.assetTag}</TableCell>
                          <TableCell>
                            <div className="font-medium">{asset.name}</div>
                            <div className="text-xs text-muted-foreground">{asset.manufacturer} {asset.model}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={asset.status === 'active' ? 'default' : 'outline'}>{asset.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={asset.criticality === 'high' ? 'destructive' : 'secondary'}>{asset.criticality}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/assets/${asset.id}`}>
                                Details
                                <ChevronRight className="ml-1 h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          No assets registered for this site.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pm" className="mt-0">
            <PmPlanningGrid 
              assets={assets}
              templates={pmTemplates}
              assetSchedules={assetSchedules}
              onUpdateSchedule={handleUpdateSchedule}
              isLoading={isLoadingSchedules}
            />
          </TabsContent>

          <TabsContent value="info" className="mt-0">
            {isEditing ? (
              <div className="pb-24">
                <WorkSiteForm 
                  site={site} 
                  onFormSaved={handleFormSaved} 
                  onCancel={() => setIsEditing(false)} 
                />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <Button onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Site Info
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card className="rounded-t-none">
                    <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground">Contact Name</Label>
                        <p className="font-medium">{site.contact?.name || 'Not provided'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Phone Number</Label>
                        <p className="font-medium">{site.contact?.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Email Address</Label>
                        <p className="font-medium">{site.contact?.email || 'Not provided'}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-t-none">
                    <CardHeader><CardTitle>Site Notes</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap min-h-[100px]">
                        {site.notes || 'No specific notes for this site.'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
