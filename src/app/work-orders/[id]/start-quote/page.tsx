
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { getWorkOrderById } from '@/lib/data';
import { uploadImageResumable } from '@/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, Quote } from '@/lib/types';
import { Loader2, ArrowLeft, Upload, Video, Image as ImageIcon, Trash2 } from 'lucide-react';
import { collection, doc } from 'firebase/firestore';
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

export default function StartQuotePage() {
    const { id: workOrderId } = useParams();
    const router = useRouter();
    const db = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [description, setDescription] = useState('');
    const [modelNumber, setModelNumber] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [numPeople, setNumPeople] = useState('1');
    const [personHours, setPersonHours] = useState<string[]>(['']);
    const [materialsNeeded, setMaterialsNeeded] = useState('');
    const [photos, setPhotos] = useState<File[]>([]);
    const [videos, setVideos] = useState<File[]>([]);
    
    const mediaInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!db || typeof workOrderId !== 'string') return;
        
        setIsLoading(true);
        getWorkOrderById(db, workOrderId)
            .then(wo => {
                if (wo) {
                    setWorkOrder(wo);
                } else {
                    toast({ title: 'Work Order not found', variant: 'destructive' });
                    router.push('/');
                }
            })
            .catch(err => {
                console.error('Error fetching work order:', err);
                toast({ title: 'Error fetching work order', variant: 'destructive' });
            })
            .finally(() => setIsLoading(false));
    }, [db, workOrderId, router, toast]);

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
            setPhotos(prev => [...prev, ...imageFiles]);
            setVideos(prev => [...prev, ...videoFiles]);
        }
        e.target.value = ''; 
    };

    const removeMedia = (index: number, type: 'photo' | 'video') => {
        if (type === 'photo') {
            setPhotos(prev => prev.filter((_, i) => i !== index));
        } else {
            setVideos(prev => prev.filter((_, i) => i !== index));
        }
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

        setIsSubmitting(true);
        if (typeof window !== 'undefined') window.__UPLOAD_IN_PROGRESS__ = true;
        
        const progressToast = toast({ title: 'Initializing...', description: 'Starting quote submission.', duration: Infinity });

        try {
            progressToast.update({ id: progressToast.id, title: 'Generating Quote #', description: 'Reserving your quote number.' });
            
            const result = await generateQuoteNumber();
            if (result.error || !result.quoteNumber) throw new Error(result.error || 'Quote number generation failed.');
            
            const quoteNumber = result.quoteNumber;

            // 1. Create the Quote document Metadata FIRST to ensure it exists
            progressToast.update({ id: progressToast.id, title: 'Saving Quote', description: 'Creating the job record...' });

            const laborDetail = personHours.map((h, i) => `P${i + 1}: ${h || '0'}h`).join(', ');
            const formattedLabor = `${numPeople} ${parseInt(numPeople) === 1 ? 'person' : 'people'}: ${laborDetail}`;

            const initialQuote: Omit<Quote, 'id'> = {
                quoteNumber: quoteNumber,
                status: 'Draft',
                workOrderId: workOrder.id,
                clientId: workOrder.clientId,
                workSiteId: workOrder.workSiteId,
                jobName: workOrder.jobName,
                description,
                modelNumber,
                serialNumber,
                estimatedLabor: formattedLabor,
                materialsNeeded,
                photos: [], 
                videos: [],
                createdDate: new Date().toISOString(),
                createdBy_technicianId: user.uid,
                lineItems: [],
                subtotal: 0,
                tax: 0,
                total: 0,
            };

            // Use the awaited reference to update later
            const quoteRef = await addDocumentNonBlocking(collection(db, 'quotes'), initialQuote);

            // 2. Sequential Media Uploads
            const photoUrls: string[] = [];
            const videoUrls: string[] = [];
            const allFiles = [...photos.map(f => ({ file: f, type: 'photo' })), ...videos.map(f => ({ file: f, type: 'video' }))];
            
            for (let i = 0; i < allFiles.length; i++) {
                const item = allFiles[i];
                const folder = item.type === 'photo' ? 'photos' : 'videos';
                const path = `quotes/${quoteNumber}/${folder}/${Date.now()}-${item.file.name}`;
                
                progressToast.update({ 
                    id: progressToast.id, 
                    title: `Media ${i + 1}/${allFiles.length}`, 
                    description: `Uploading ${item.file.name}...` 
                });

                const { downloadURL } = await uploadImageResumable(item.file, path, {
                    onProgress: (p) => {
                        progressToast.update({ id: progressToast.id, description: `Uploading... ${p.pct}%` });
                    }
                });

                if (item.type === 'photo') photoUrls.push(downloadURL);
                else videoUrls.push(downloadURL);
            }

            // 3. Final Updates
            progressToast.update({ id: progressToast.id, title: 'Finalizing...', description: 'Attaching media to quote.' });

            if (photoUrls.length > 0 || videoUrls.length > 0) {
                await updateDocumentNonBlocking(quoteRef, {
                    photos: photoUrls,
                    videos: videoUrls
                });
            }

            // Move Work Order to On Hold
            await updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), { status: 'On Hold' });

            progressToast.dismiss();
            toast({ title: 'Quote Created', description: `Quote ${quoteNumber} submitted successfully.` });
            
            notifyAdminsOfNewQuote({
                quoteId: quoteNumber,
                workOrderId: workOrder.id,
                jobName: workOrder.jobName,
                technicianName: user.displayName || user.email || 'Technician'
            }).catch(e => console.warn('Admin notification deferred:', e.message));

            router.push(`/work-orders/${workOrder.id}`);

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

    return (
        <MainLayout>
            <div className="container mx-auto py-8">
                <Button asChild variant="outline" className="mb-6" disabled={isSubmitting}>
                    <Link href={`/work-orders/${workOrderId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Work Order
                    </Link>
                </Button>
                
                <form onSubmit={handleSubmit}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Start New Quote</CardTitle>
                            <CardDescription>
                                For Work Order #{workOrder.id} - {workOrder.jobName}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="space-y-2">
                                <Label htmlFor="quote-description">Description of Work to be Quoted<span className="text-destructive"> *</span></Label>
                                <Textarea 
                                    id="quote-description" 
                                    rows={5}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={workOrder.description || "Describe the necessary work..."}
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Photos & Videos</Label>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" onClick={() => mediaInputRef.current?.click()} disabled={isSubmitting}>
                                            <ImageIcon className="mr-2 h-4 w-4" /> Add Media
                                        </Button>
                                    </div>
                                    <input type="file" ref={mediaInputRef} multiple accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
                                </div>
                                {photos.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                        {photos.map((file, index) => (
                                            <div key={index} className="relative group aspect-square">
                                                <Image src={URL.createObjectURL(file)} alt={file.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover rounded-lg border" />
                                                <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeMedia(index, 'photo')} disabled={isSubmitting}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {videos.length > 0 && (
                                     <div className="space-y-2">
                                        {videos.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                                                <div className="flex items-center gap-2">
                                                    <Video className="h-5 w-5 text-muted-foreground" />
                                                    <p className="text-sm truncate max-w-[200px]">{file.name}</p>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeMedia(index, 'video')} disabled={isSubmitting}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="quote-people">How many people?</Label>
                                        <Select value={numPeople} onValueChange={setNumPeople} disabled={isSubmitting}>
                                            <SelectTrigger id="quote-people">
                                                <SelectValue placeholder="Select number of people" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">1 Person</SelectItem>
                                                <SelectItem value="2">2 People</SelectItem>
                                                <SelectItem value="3">3 People</SelectItem>
                                                <SelectItem value="4">4 People</SelectItem>
                                                <SelectItem value="5">5 People</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                                    {personHours.map((hours, index) => (
                                        <div key={index} className="space-y-2">
                                            <Label htmlFor={`person-${index}-hours`} className="text-xs">Person {index + 1} Hours</Label>
                                            <Input 
                                                id={`person-${index}-hours`}
                                                type="number"
                                                step="0.5"
                                                value={hours}
                                                onChange={(e) => handlePersonHourChange(index, e.target.value)}
                                                placeholder="e.g. 4"
                                                disabled={isSubmitting}
                                                className="h-8"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="quote-materials">Description of Materials Needed</Label>
                                <Textarea 
                                    id="quote-materials" 
                                    rows={4}
                                    value={materialsNeeded}
                                    onChange={(e) => setMaterialsNeeded(e.target.value)}
                                    placeholder="List all parts and materials required..."
                                    disabled={isSubmitting}
                                />
                            </div>

                             <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isSubmitting ? 'Submitting Quote...' : 'Submit Quote Request'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </div>
        </MainLayout>
    );
}
