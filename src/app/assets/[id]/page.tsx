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
import { History, CalendarClock, Settings, Loader2, AlertCircle, Box, ArrowLeft, Camera, Library, Maximize2, Download, Trash2 } from 'lucide-react';
import { useFirestore, updateDocumentNonBlocking, useUser } from '@/firebase';
import { getAssetById, getAssetServiceHistory, calculateAssetMetrics, getPmSchedulesForAsset, getPmTaskTemplates, savePmSchedule } from '@/lib/data';
import type { Asset, AssetServiceHistory, PmSchedule, PhotoMetadata, PmTaskTemplate } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { uploadPhotoWithThumbnail, deletePhotoMetadata } from '@/firebase/storage';
import { doc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PmPlanningGrid } from '@/components/pm-planning-grid';

export default function AssetDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [asset, setAsset] = useState<Asset | null>(null);
  const [pmTemplates, setPmTemplates] = useState<PmTaskTemplate[]>([]);
  const [schedules, setSchedules] = useState<PmSchedule[]>([]);
  const [history, setHistory] = useState<AssetServiceHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  
  const [viewingPhoto, setViewingPhoto] = useState<PhotoMetadata | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);

  const takePhotoInputRef = useRef<HTMLInputElement>(null);
  const chooseFromLibraryInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (db && user && id && id !== 'new') {
      try {
        const [a, s, h, t] = await Promise.all([
          getAssetById(db, id as string),
          getPmSchedulesForAsset(db, id as string),
          getAssetServiceHistory(db, id as string),
          getPmTaskTemplates(db)
        ]);
        setAsset(a || null);
        setSchedules(s);
        setHistory(h);
        setPmTemplates(t);
      } catch (e) {
        console.error("Failed to fetch asset data:", e);
      }
    }
  }, [db, user, id]);

  useEffect(() => {
    if (db && user && id && id !== 'new') {
      fetchData().finally(() => setIsLoading(false));
    } else if (id === 'new') {
        setIsLoading(false);
    }
  }, [db, user, id, fetchData]);

  const handleUpdateSchedule = async (assetId: string, templateId: string, monthStr: string) => {
    if (!db) return;
    
    const existingSchedule = schedules.find(s => s.templateId === templateId);

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

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !db || !asset) return;

    setIsUploadingPhotos(true);
    setPhotoSheetOpen(false);
    
    const toastId = toast({ title: `Uploading ${files.length} photo(s)...`, duration: Infinity });

    try {
      let i = 0;
      for (const file of Array.from(files)) {
        i++;
        const basePath = `assets/${asset.assetTag || asset.id}`;
        const fileName = `${Date.now()}-${file.name}`;
        
        toastId.update({ 
          id: toastId.id, 
          title: `Photo ${i}/${files.length}`,
          description: `Transferring ${file.name}...` 
        });

        const result = await uploadPhotoWithThumbnail(file, basePath, fileName);
        
        const assetRef = doc(db, 'assets', asset.id);
        await updateDocumentNonBlocking(assetRef, {
          photoUrls: arrayUnion(result)
        });

        setAsset(prev => prev ? ({ 
          ...prev, 
          photoUrls: [...(prev.photoUrls || []), result] 
        } as Asset) : null);
      }

      toastId.dismiss();
      toast({ title: "Photos Added Successfully" });
    } catch (error: any) {
      console.error("Asset photo upload failed:", error);
      toastId.dismiss();
      toast({ variant: 'destructive', title: 'Upload Failed' });
    } finally {
      setIsUploadingPhotos(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!viewingPhoto || !db || !asset) return;
    const photoToDelete = viewingPhoto;
    setViewingPhoto(null);

    try {
      const assetRef = doc(db, 'assets', asset.id);
      await updateDocumentNonBlocking(assetRef, {
        photoUrls: arrayRemove(photoToDelete)
      });
      await deletePhotoMetadata(photoToDelete);
      
      const targetUrl = photoToDelete.url;
      setAsset(prev => prev ? ({ 
        ...prev, 
        photoUrls: (prev.photoUrls || []).filter(p => (typeof p === 'string' ? p : p.url) !== targetUrl) 
      } as Asset) : null);
      
      toast({ title: "Photo Deleted" });
    } catch (error) {
      toast({ title: "Delete Failed", variant: 'destructive' });
    }
  };

  if (isLoading) return <MainLayout><div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></MainLayout>;
  if (!asset) return <MainLayout><div className="container py-12 text-center"><AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" /><h1 className="text-2xl font-bold">Equipment Not Found</h1></div></MainLayout>;

  const metrics = calculateAssetMetrics(history);

  const getPhotoUrl = (p: string | PhotoMetadata) => typeof p === 'string' ? p : p.url;
  const getThumbUrl = (p: string | PhotoMetadata) => typeof p === 'string' ? p : p.thumbnailUrl || p.url;

  return (
    <MainLayout>
      {(isUploadingPhotos) && (
        <div className="fixed inset-0 bg-background/80 z-50 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-lg font-medium">Processing Photos...</p>
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
                <div><p className="text-muted-foreground">Warranty Until</p><p className={(asset.warrantyExpiration && new Date(asset.warrantyExpiration) < new Date()) ? "text-destructive font-medium" : "font-medium"}>{asset.warrantyExpiration ? format(new Date(asset.warrantyExpiration), 'PPP') : 'N/A'}</p></div>
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
                <div className="flex justify-between"><span className="text-muted-foreground">MTBF</span><span className="font-bold">{metrics.mtbf.toFixed(1)} Days</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">MTTR</span><span className="font-bold">{metrics.mttr.toFixed(1)} Hours</span></div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Tabs defaultValue="pm">
              <TabsList className="mb-4">
                <TabsTrigger value="pm"><CalendarClock className="mr-2 h-4 w-4" /> PM Grid</TabsTrigger>
                <TabsTrigger value="photos"><Camera className="mr-2 h-4 w-4" /> Photos</TabsTrigger>
                <TabsTrigger value="history"><History className="mr-2 h-4 w-4" /> Service History</TabsTrigger>
              </TabsList>

              <TabsContent value="pm">
                <PmPlanningGrid 
                  assets={[asset]}
                  templates={pmTemplates}
                  assetSchedules={{ [asset.id]: schedules }}
                  onUpdateSchedule={handleUpdateSchedule}
                  isLoading={isLoadingSchedules}
                  showLinks={false}
                />
              </TabsContent>

              <TabsContent value="photos">
                <Card>
                  <CardHeader><CardTitle>Equipment Documentation</CardTitle></CardHeader>
                  <CardContent>
                    {asset.photoUrls && asset.photoUrls.length > 0 ? (
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                        {asset.photoUrls.map((photo, idx) => (
                          <div key={getPhotoUrl(photo)} className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer" onClick={() => setViewingPhoto(typeof photo === 'string' ? { url: photo } : photo)}>
                            <Image src={getThumbUrl(photo)} alt={`Equipment photo ${idx + 1}`} fill sizes="(max-width: 768px) 25vw, 12vw" className="object-cover" />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="text-white h-5 w-5" /></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Camera className="h-12 w-12 mx-auto mb-4 opacity-20" /><p>No photos available for this unit.</p>
                        <Button variant="link" onClick={() => setPhotoSheetOpen(true)} className="mt-2">Add Photo Now</Button>
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
                        {history.map((record) => (
                          <div key={record.id} className="relative pl-8 pb-8 border-l last:pb-0">
                            <div className="absolute left-[-5px] top-0 h-2 w-2 rounded-full bg-primary" />
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-bold">{format(new Date(record.completedDate), 'PPP')}</p>
                              <Badge variant="secondary">WO #{record.workOrderId}</Badge>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
                            {record.followUpRequired && <Badge variant="destructive" className="mt-2">Follow-up Required</Badge>}
                          </div>
                        ))}
                      </div>
                    ) : <div className="text-center py-12 text-muted-foreground">No service history recorded for this unit.</div>}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <input type="file" ref={takePhotoInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" multiple />
      <input type="file" ref={chooseFromLibraryInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" multiple />

      <Sheet open={photoSheetOpen} onOpenChange={setPhotoSheetOpen}>
        <SheetContent side="bottom">
          <SheetHeader><SheetTitle>Add Equipment Photos</SheetTitle></SheetHeader>
          <div className="grid gap-4 py-6">
            <Button variant="outline" className="justify-start h-14" onClick={() => takePhotoInputRef.current?.click()}><Camera className="mr-4 h-6 w-6" /> Take Photo</Button>
            <Button variant="outline" className="justify-start h-14" onClick={() => chooseFromLibraryInputRef.current?.click()}><Library className="mr-4 h-6 w-6" /> Choose from Library</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-0 flex flex-col items-stretch h-[90vh]">
          <DialogHeader className="p-4 bg-background/10 backdrop-blur-sm border-b border-white/10 absolute top-0 w-full z-10">
            <DialogTitle className="text-white text-sm font-bold uppercase tracking-widest">Equipment Documentation Preview</DialogTitle>
            <DialogDescription className="sr-only">High resolution preview of equipment documentation</DialogDescription>
          </DialogHeader>
          <div className="flex-1 relative flex items-center justify-center p-4">{viewingPhoto && <Image src={viewingPhoto.url} alt="Equipment photo preview" fill className="object-contain" priority />}</div>
          <div className="p-4 bg-background flex justify-between items-center border-t">
            <Button variant="outline" size="sm" onClick={() => setViewingPhoto(null)}>Close</Button>
            <div className="flex items-center gap-2">
              {viewingPhoto && <Button variant="outline" size="sm" asChild><a href={`/api/image-proxy?url=${encodeURIComponent(viewingPhoto.url)}`} download><Download className="h-4 w-4 mr-2" /> Download</a></Button>}
              {viewingPhoto && <Button variant="destructive" size="sm" onClick={handleDeletePhoto}><Trash2 className="h-4 w-4 mr-2" /> Delete Documentation</Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
