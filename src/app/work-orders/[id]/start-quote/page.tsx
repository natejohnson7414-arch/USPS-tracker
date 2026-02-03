
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
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { getWorkOrderById } from '@/lib/data';
import { uploadImage } from '@/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, Quote } from '@/lib/types';
import { Loader2, ArrowLeft, Upload, Video, Image as ImageIcon, Trash2 } from 'lucide-react';
import { collection } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

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
    const [estimatedLabor, setEstimatedLabor] = useState('');
    const [materialsNeeded, setMaterialsNeeded] = useState('');
    const [photos, setPhotos] = useState<File[]>([]);
    const [videos, setVideos] = useState<File[]>([]);
    
    const photoInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

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
                console.error(err);
                toast({ title: 'Error fetching work order', variant: 'destructive' });
            })
            .finally(() => setIsLoading(false));
    }, [db, workOrderId, router, toast]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            if (type === 'photo') {
                setPhotos(prev => [...prev, ...files]);
            } else {
                setVideos(prev => [...prev, ...files]);
            }
        }
        e.target.value = ''; // Reset input
    };

    const removeMedia = (index: number, type: 'photo' | 'video') => {
        if (type === 'photo') {
            setPhotos(prev => prev.filter((_, i) => i !== index));
        } else {
            setVideos(prev => prev.filter((_, i) => i !== index));
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !user || !workOrder) return;
        
        if (!description) {
            toast({ title: 'Description is required', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        
        try {
            const quoteId = `QT-${Date.now()}`;
            
            const uploadPromises = [
                ...photos.map(file => uploadImage(file, `quotes/${quoteId}/photos/${file.name}`)),
                ...videos.map(file => uploadImage(file, `quotes/${quoteId}/videos/${file.name}`))
            ];
            
            const uploadedUrls = await Promise.all(uploadPromises);
            const photoUrls = uploadedUrls.slice(0, photos.length);
            const videoUrls = uploadedUrls.slice(photos.length);

            const newQuote: Omit<Quote, 'id'> = {
                quoteNumber: quoteId,
                status: 'Draft',
                workOrderId: workOrder.id,
                clientId: workOrder.clientId,
                workSiteId: workOrder.workSiteId,
                jobName: workOrder.jobName,
                description,
                estimatedLabor,
                materialsNeeded,
                photos: photoUrls,
                videos: videoUrls,
                createdDate: new Date().toISOString(),
                createdBy_technicianId: user.uid,
                lineItems: [],
                subtotal: 0,
                tax: 0,
                total: 0,
            };

            await addDocumentNonBlocking(collection(db, 'quotes'), newQuote);

            toast({ title: 'Quote Started', description: 'Your quote has been submitted for review.' });
            router.push(`/work-orders/${workOrder.id}`);

        } catch (error) {
            console.error("Error starting quote:", error);
            if (error instanceof Error && !error.message.includes('permission-error')) {
              toast({ title: 'Failed to start quote', variant: 'destructive' });
            }
        } finally {
            setIsSubmitting(false);
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
                <Button asChild variant="outline" className="mb-6">
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
                                <Label htmlFor="quote-description">Description of Work to be Quoted</Label>
                                <Textarea 
                                    id="quote-description" 
                                    rows={5}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={workOrder.description || "Describe the necessary work, materials, and any other important details..."}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="quote-labor">Estimated Labor (include second person if needed)</Label>
                                <Textarea 
                                    id="quote-labor" 
                                    rows={3}
                                    value={estimatedLabor}
                                    onChange={(e) => setEstimatedLabor(e.target.value)}
                                    placeholder="e.g., 2 hours for one person, 1 hour for second person for assistance."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="quote-materials">Description of Materials Needed</Label>
                                <Textarea 
                                    id="quote-materials" 
                                    rows={4}
                                    value={materialsNeeded}
                                    onChange={(e) => setMaterialsNeeded(e.target.value)}
                                    placeholder="List all parts and materials required for the job..."
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Photos</Label>
                                    <Button type="button" variant="outline" onClick={() => photoInputRef.current?.click()}>
                                        <Upload className="mr-2 h-4 w-4" /> Upload Photos
                                    </Button>
                                    <input type="file" ref={photoInputRef} multiple accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'photo')} />
                                </div>
                                {photos.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                        {photos.map((file, index) => (
                                            <div key={index} className="relative group aspect-square">
                                                <Image src={URL.createObjectURL(file)} alt={file.name} fill className="object-cover rounded-lg border" />
                                                <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeMedia(index, 'photo')}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Videos</Label>
                                    <Button type="button" variant="outline" onClick={() => videoInputRef.current?.click()}>
                                        <Video className="mr-2 h-4 w-4" /> Upload Videos
                                    </Button>
                                    <input type="file" ref={videoInputRef} multiple accept="video/*" className="hidden" onChange={(e) => handleFileChange(e, 'video')} />
                                </div>
                                {videos.length > 0 && (
                                     <div className="space-y-2">
                                        {videos.map((file, index) => (
                                            <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                                                <Video className="h-5 w-5 text-muted-foreground" />
                                                <p className="text-sm flex-1 truncate">{file.name}</p>
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => removeMedia(index, 'video')}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                             <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Submit Quote Request
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </div>
        </MainLayout>
    );
}
