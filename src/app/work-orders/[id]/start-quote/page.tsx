'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { getWorkOrderById, getPmWorkOrderById } from '@/lib/data';
import { uploadImageResumable } from '@/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, Quote, PmWorkOrder, PhotoMetadata } from '@/lib/types';
import { Loader2, ArrowLeft, Upload, Video, Image as ImageIcon, Trash2, AlertCircle, Sparkles, CheckCircle2, X } from 'lucide-react';
import { collection, doc, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { notifyAdminsOfNewQuote } from '@/ai/flows/notify-admins-flow';
import { generateQuoteNumber } from '@/ai/flows/generate-quote-number-flow';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function StartQuotePage() {
    const { id: workOrderId } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const db = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    const assetId = searchParams.get('assetId');
    const [workOrder, setWorkOrder] = useState<WorkOrder | PmWorkOrder | null>(null);
    const [isPm, setIsPm] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [description, setDescription] = useState('');
    const [modelNumber, setModelNumber] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [numPeople, setNumPeople] = useState('1');
    const [personHours, setPersonHours] = useState<string[]>(['']);
    const [materialsNeeded, setMaterialsNeeded] = useState('');
    
    // Media states
    const [importedPhotos, setImportedPhotos] = useState<(string | PhotoMetadata)[]>([]);
    const [newPhotos, setNewPhotos] = useState<File[]>([]);
    const [newVideos, setNewVideos] = useState<File[]>([]);
    
    const mediaInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!db || typeof workOrderId !== 'string') return;
        
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                // Try standard work order first
                let job = await getWorkOrderById(db, workOrderId);
                let pmMode = false;

                if (!job) {
                    job = (await getPmWorkOrderById(db, workOrderId)) as any;
                    pmMode = !!job;
                }

                if (job) {
                    setWorkOrder(job);
                    setIsPm(pmMode);

                    // Autofill logic for assets within PMs
                    if (pmMode && assetId) {
                        const pmJob = job as unknown as PmWorkOrder;
                        const assetGroup = pmJob.assetTasks.find(g => g.assetId === assetId);
                        
                        if (assetGroup) {
                            // 1. Autofill Specs
                            const assetRef = doc(db, 'assets', assetId);
                            const assetSnap = await getDoc(assetRef);
                            if (assetSnap.exists()) {
                                const assetData = assetSnap.data();
                                setModelNumber(assetData.model || '');
                                setSerialNumber(assetData.serialNumber || '');
                            }

                            // 2. Aggregate Documentation from PM Checklist
                            const aggregatedNotes = assetGroup.tasks
                                .filter(t => t.notes)
                                .map(t => `${t.text}: ${t.notes}`)
                                .join('\n');
                            
                            setDescription(aggregatedNotes);

                            const aggregatedPhotos = assetGroup.tasks.flatMap(t => t.photoUrls || []);
                            setImportedPhotos(aggregatedPhotos);
                            
                            if (aggregatedNotes || aggregatedPhotos.length > 0) {
                                toast({ 
                                    title: "Field Data Imported", 
                                    description: `Automatically pulled ${aggregatedPhotos.length} photo(s) and task notes for this unit.` 
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching job details:', err);
                toast({ title: 'Error fetching job details', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, [db, workOrderId, assetId, toast]);

    useEffect(() => {
        const count = parseInt(numPeople);
        setPersonHours(prev => {
            const newHours = [...prev];
            if (newHours.length < count) {
                while (newHours.length < count) newHours.push('');
            } else {
                return newHours.slice(0, count);
            }
            return newHours;
        });
    }, [numPeople]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const imageFiles: File[] = [];
            const videoFiles: File[] = [];
            Array.from(e.target.files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    imageFiles.push(file);
                } else if (file.type.startsWith('video/')) {
                    videoFiles.push(file);
                }
            });
            setNewPhotos(prev => [...prev, ...imageFiles]);
            setNewVideos(prev => [...prev, ...videoFiles]);
        }
        e.target.value = ''; 
    };

    const removeNewMedia = (index: number, type: 'photo' | 'video') => {
        if (type === 'photo') {
            setNewPhotos(prev => prev.filter((_, i) => i !== index));
        } else {
            setNewVideos(prev => prev.filter((_, i) => i !== index));
        }
    };

    const removeImportedPhoto = (index: number) => {
        setImportedPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handlePersonHourChange = (index: number, value: string) => {
        const newHours = [...personHours];
        newHours[index] = value;
        setPersonHours(newHours);
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !user || !workOrder) return;
        
        if (!description || !modelNumber || !serialNumber) {
            toast({ title: 'Missing required fields', description: 'Description, Model, and Serial Number are required', variant: 'destructive' });
            return;
        }

        // Mandatory photos if specifically for an asset (repair quote)
        if (assetId && (newPhotos.length + importedPhotos.length) === 0) {
            toast({ 
                title: 'Photos Required', 
                description: 'You must provide at least one photo documenting the issue for this equipment grade.', 
                variant: 'destructive' 
            });
            return;
        }

        setIsSubmitting(true);
        if (typeof window !== 'undefined') window.__UPLOAD_IN_PROGRESS__ = true;
        
        const progressToast = toast({ title: 'Initializing...', description: 'Starting quote submission.', duration: Infinity });

        try {
            progressToast.update({ id: progressToast.id, title: 'Generating Quote #', description: 'Reserving your quote number.' });
            
            const result = await generateQuoteNumber();
            if (result.error || !result.quoteNumber) throw new Error(result.error || 'Quote number generation failed.');
            
            const quoteNumber = result.quoteNumber;

            progressToast.update({ id: progressToast.id, title: 'Saving Quote', description: 'Creating the job record...' });

            const laborDetail = personHours.map((h, i) => `P${i + 1}: ${h || '0'}h`).join(', ');
            const formattedLabor = `${numPeople} ${parseInt(numPeople) === 1 ? 'person' : 'people'}: ${laborDetail}`;

            const initialQuote: Omit<Quote, 'id'> = {
                quoteNumber: quoteNumber,
                status: 'Draft',
                workOrderId: workOrder.id,
                assetId: assetId || undefined,
                clientId: (workOrder as any).clientId || null,
                workSiteId: workOrder.workSiteId,
                jobName: (workOrder as any).jobName || (workOrder as any).workSiteName,
                description,
                modelNumber,
                serialNumber,
                estimatedLabor: formattedLabor,
                materialsNeeded,
                photos: importedPhotos, // Include the approved imported photos immediately
                videos: [],
                createdDate: new Date().toISOString(),
                createdBy_technicianId: user.uid,
                lineItems: [],
                subtotal: 0,
                tax: 0,
                total: 0,
            };

            const quoteRef = await addDocumentNonBlocking(collection(db, 'quotes'), initialQuote);

            const uploadedPhotoUrls: string[] = [];
            const uploadedVideoUrls: string[] = [];
            const allNewFiles = [...newPhotos.map(f => ({ file: f, type: 'photo' })), ...newVideos.map(f => ({ file: f, type: 'video' }))];
            
            for (let i = 0; i < allNewFiles.length; i++) {
                const item = allNewFiles[i];
                const folder = item.type === 'photo' ? 'photos' : 'videos';
                const path = `quotes/${quoteNumber}/${folder}/${Date.now()}-${item.file.name}`;
                
                progressToast.update({ 
                    id: progressToast.id, 
                    title: `Media ${i + 1}/${allNewFiles.length}`, 
                    description: `Uploading new ${item.file.name}...` 
                });

                const { downloadURL } = await uploadImageResumable(item.file, path, {
                    onProgress: (p) => {
                        progressToast.update({ id: progressToast.id, description: `Uploading... ${p.pct}%` });
                    }
                });

                if (item.type === 'photo') uploadedPhotoUrls.push(downloadURL);
                else uploadedVideoUrls.push(downloadURL);
            }

            if (uploadedPhotoUrls.length > 0 || uploadedVideoUrls.length > 0) {
                await updateDocumentNonBlocking(quoteRef, {
                    photos: [...importedPhotos, ...uploadedPhotoUrls],
                    videos: uploadedVideoUrls
                });
            }

            // Update parent job status
            if (!isPm) {
                await updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), { status: 'On Hold' });
            } else {
                // If PM, update the specific asset tasks group with the quote ID
                const pmWo = workOrder as PmWorkOrder;
                const updatedTasks = pmWo.assetTasks.map(group => {
                    if (group.assetId === assetId) {
                        return { ...group, quoteId: quoteRef.id, quoteNumber: quoteNumber };
                    }
                    return group;
                });
                await updateDocumentNonBlocking(doc(db, 'pm_work_orders', pmWo.id), { assetTasks: updatedTasks });
            }

            progressToast.dismiss();
            toast({ title: 'Quote Created', description: `Quote ${quoteNumber} submitted successfully.` });
            
            notifyAdminsOfNewQuote({
                quoteId: quoteNumber,
                workOrderId: workOrder.id,
                jobName: (workOrder as any).jobName || (workOrder as any).workSiteName,
                technicianName: user.displayName || user.email || 'Technician'
            }).catch(e => console.warn('Admin notification deferred:', e.message));

            router.push(isPm ? `/pm-work-orders/${workOrder.id}` : `/work-orders/${workOrder.id}`);

        } catch (error: any) {
            progressToast.dismiss();
            toast({ 
                title: 'Submission Error', 
                description: error.message || 'An unexpected error occurred. Please try again.', 
                variant: 'destructive' 
            });
            setIsSubmitting(false);
        } finally {
            if (typeof window !== 'undefined') window.__UPLOAD_IN_PROGRESS__ = false;
        }
    };
    
    if (isLoading) {
        return (
            <MainLayout>
                <div className="container mx-auto py-8">
                    <Skeleton className="h-8 w-48 mb-4" />
                    <Card>
                        <CardHeader><Skeleton className="h-6 w-64" /></CardHeader>
                        <CardContent className="space-y-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </CardContent>
                    </Card>
                </div>
            </MainLayout>
        );
    }
    
    if (!workOrder) return null;

    const getThumbUrl = (p: string | PhotoMetadata) => typeof p === 'string' ? p : p.thumbnailUrl || p.url;

    return (
        <MainLayout>
            <div className="container mx-auto py-8">
                <Button asChild variant="outline" className="mb-6" disabled={isSubmitting}>
                    <Link href={isPm ? `/pm-work-orders/${workOrderId}` : `/work-orders/${workOrderId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Job
                    </Link>
                </Button>
                
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Repair Quote Request</CardTitle>
                                            <CardDescription>
                                                For {isPm ? 'PM' : 'Work Order'} #{workOrder.id} - {(workOrder as any).jobName || (workOrder as any).workSiteName}
                                            </CardDescription>
                                        </div>
                                        {assetId && <Badge variant="destructive" className="h-6 uppercase font-black text-[10px]">Mandatory Repair Documentation</Badge>}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {assetId && (
                                        <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-lg flex items-start gap-3">
                                            <Sparkles className="h-5 w-5 text-primary shrink-0" />
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-primary">FIELD DATA IMPORTED</p>
                                                <p className="text-xs">We've pre-filled the description and photos using your PM checklist findings. <span className="font-bold underline">Please review and approve below.</span></p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="quote-description" className="text-base font-bold">Proposed Description of Work<span className="text-destructive"> *</span></Label>
                                        <Textarea 
                                            id="quote-description" 
                                            rows={8}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Describe the necessary work, findings, and resolution..."
                                            required
                                            disabled={isSubmitting}
                                            className="font-medium"
                                        />
                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pt-1">Review carefully: This text is pre-filled from your checklist notes.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                                        <div className="space-y-2">
                                            <Label htmlFor="quote-model">Model Number<span className="text-destructive"> *</span></Label>
                                            <Input 
                                                id="quote-model"
                                                value={modelNumber}
                                                onChange={(e) => setModelNumber(e.target.value)}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="quote-serial">Serial Number<span className="text-destructive"> *</span></Label>
                                            <Input 
                                                id="quote-serial"
                                                value={serialNumber}
                                                onChange={(e) => setSerialNumber(e.target.value)}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="space-y-2">
                                            <Label className="text-base font-bold">Imported Photo Documentation</Label>
                                            <p className="text-xs text-muted-foreground mb-4">The following photos were captured during the inspection. Remove any that are not relevant to this repair.</p>
                                            
                                            {importedPhotos.length > 0 ? (
                                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                                    {importedPhotos.map((photo, index) => (
                                                        <div key={index} className="relative group aspect-square">
                                                            <Image 
                                                                src={getThumbUrl(photo)} 
                                                                alt="Imported task photo" 
                                                                fill 
                                                                sizes="120px" 
                                                                className="object-cover rounded-lg border bg-muted" 
                                                            />
                                                            <Button 
                                                                type="button" 
                                                                variant="destructive" 
                                                                size="icon" 
                                                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg" 
                                                                onClick={() => removeImportedPhoto(index)} 
                                                                disabled={isSubmitting}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                            <div className="absolute inset-x-0 bottom-0 bg-black/40 p-1">
                                                                <p className="text-[8px] text-white text-center font-bold uppercase">Imported</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-8 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                                                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                                    <p className="text-xs italic">No photos were found in the checklist for this unit.</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2 pt-4">
                                            <Label className="text-sm font-bold flex items-center gap-2">
                                                <ImageIcon className="h-4 w-4" /> Add Supplemental Photos/Video
                                            </Label>
                                            <div className="flex gap-2">
                                                <Button type="button" variant="outline" size="sm" onClick={() => mediaInputRef.current?.click()} disabled={isSubmitting}>
                                                    <Upload className="mr-2 h-4 w-4" /> Choose Additional Files
                                                </Button>
                                            </div>
                                            <input type="file" ref={mediaInputRef} multiple accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
                                        </div>

                                        {newPhotos.length > 0 && (
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                                {newPhotos.map((file, index) => (
                                                    <div key={index} className="relative group aspect-square">
                                                        <Image src={URL.createObjectURL(file)} alt={file.name} fill sizes="120px" className="object-cover rounded-lg border ring-2 ring-primary/20" />
                                                        <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => removeNewMedia(index, 'photo')} disabled={isSubmitting}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                        <div className="absolute inset-x-0 bottom-0 bg-primary/80 p-1">
                                                            <p className="text-[8px] text-white text-center font-bold uppercase">New</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {newVideos.length > 0 && (
                                             <div className="space-y-2">
                                                {newVideos.map((file, index) => (
                                                    <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-purple-50/30">
                                                        <div className="flex items-center gap-2">
                                                            <Video className="h-5 w-5 text-purple-500" />
                                                            <p className="text-sm truncate max-w-[200px]">{file.name}</p>
                                                        </div>
                                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeNewMedia(index, 'video')} disabled={isSubmitting}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-8">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Labor & Materials</CardTitle>
                                    <CardDescription>Estimate the resources required for this repair.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                                        <div className="space-y-2">
                                            <Label htmlFor="quote-people">Manpower Required</Label>
                                            <Select value={numPeople} onValueChange={setNumPeople} disabled={isSubmitting}>
                                                <SelectTrigger id="quote-people" className="bg-background">
                                                    <SelectValue placeholder="Number of people" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[1, 2, 3, 4, 5].map(n => (
                                                        <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'Person' : 'People'}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {personHours.map((hours, index) => (
                                                <div key={index} className="space-y-1">
                                                    <Label htmlFor={`person-${index}-hours`} className="text-[10px] uppercase font-bold text-muted-foreground">P{index + 1} Hours</Label>
                                                    <Input 
                                                        id={`person-${index}-hours`}
                                                        type="number"
                                                        step="0.5"
                                                        value={hours}
                                                        onChange={(e) => handlePersonHourChange(index, e.target.value)}
                                                        placeholder="0.0"
                                                        disabled={isSubmitting}
                                                        className="h-9 bg-background"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="quote-materials">Parts & Materials Needed</Label>
                                        <Textarea 
                                            id="quote-materials" 
                                            rows={6}
                                            value={materialsNeeded}
                                            onChange={(e) => setMaterialsNeeded(e.target.value)}
                                            placeholder="List all required parts, filters, belts, etc..."
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <div className="pt-4">
                                        <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-base font-bold shadow-xl">
                                            {isSubmitting ? (
                                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting Request...</>
                                            ) : (
                                                <><CheckCircle2 className="mr-2 h-5 w-5" /> Approve & Submit Quote</>
                                            )}
                                        </Button>
                                        <p className="text-[10px] text-center text-muted-foreground mt-4 uppercase font-black tracking-widest">Office notification will be sent immediately upon submission.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </form>
            </div>
        </MainLayout>
    );
}
