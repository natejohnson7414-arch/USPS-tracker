
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { useTechnician } from '@/hooks/use-technician';
import { getQuoteById } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { uploadImageResumable, deleteImage } from '@/firebase/storage';
import type { Quote, QuoteLineItem, Acknowledgement } from '@/lib/types';
import { Loader2, ArrowLeft, Trash2, PlusCircle, Video, FileText, Camera, Library, ImageIcon, X, Maximize2, Download } from 'lucide-react';
import { doc, arrayUnion } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function QuoteDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const db = useFirestore();
    const { toast } = useToast();
    const { role, isLoading: isRoleLoading } = useTechnician();

    const [quote, setQuote] = useState<Quote | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

    const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
    const [status, setStatus] = useState<Quote['status']>('Draft');
    const [tax, setTax] = useState<number>(0);
    const [adminNotes, setAdminNotes] = useState<string>('');
    const [subtotal, setSubtotal] = useState(0);
    const [total, setTotal] = useState(0);

    const mediaInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!db || typeof id !== 'string' || isRoleLoading) return;
        setIsLoading(true);
        getQuoteById(db, id).then(q => {
            if (q) {
                setQuote(q);
                setLineItems(q.lineItems || []);
                setStatus(q.status);
                setTax(q.tax || 0);
                setAdminNotes(q.adminNotes || '');
            } else {
                toast({ title: 'Quote not found', variant: 'destructive' });
                router.push('/quotes');
            }
        }).finally(() => setIsLoading(false));
    }, [db, id, role, isRoleLoading, router, toast]);

    useEffect(() => {
        const newSubtotal = lineItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
        setSubtotal(newSubtotal);
        setTotal(newSubtotal + (newSubtotal * (tax / 100)));
    }, [lineItems, tax]);

    const handleAddLineItem = () => setLineItems([...lineItems, { id: `line-${Date.now()}`, description: '', quantity: 1, unitPrice: 0 }]);
    const handleRemoveLineItem = (index: number) => setLineItems(lineItems.filter((_, i) => i !== index));
    const handleLineItemChange = (index: number, field: keyof QuoteLineItem, value: string | number) => {
        const updatedItems = [...lineItems];
        if (field === 'description') updatedItems[index].description = value as string;
        else updatedItems[index][field as 'quantity' | 'unitPrice'] = Number(value) || 0;
        setLineItems(updatedItems);
    };

    const handleSave = async () => {
        if (!db || !quote) return;
        setIsSaving(true);
        const quoteRef = doc(db, 'quotes', quote.id);
        const updatedData: Partial<Quote> = { lineItems, status, tax, adminNotes, subtotal, total };
        try {
            await updateDocumentNonBlocking(quoteRef, updatedData);
            toast({ title: 'Quote Saved' });
            setQuote(prev => prev ? ({ ...prev, ...updatedData } as Quote) : null);
        } catch (error) { toast({ title: 'Save Failed', variant: 'destructive' }); } finally { setIsSaving(false); }
    };

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !db || !quote) return;
        setIsUploadingMedia(true);
        const toastId = toast({ title: `Uploading ${files.length} file(s)...`, duration: Infinity });
        try {
            const uploadedPhotoUrls: string[] = [];
            const uploadedVideoUrls: string[] = [];
            let i = 0;
            for (const file of Array.from(files)) {
                i++;
                const isVideo = file.type.startsWith('video/');
                const folder = isVideo ? 'videos' : 'photos';
                const path = `quotes/${quote.quoteNumber}/${folder}/${Date.now()}-${file.name}`;
                toastId.update({ id: toastId.id, description: `File ${i}/${files.length}: Uploading...` });
                const { downloadURL } = await uploadImageResumable(file, path, {
                    onProgress: (p) => toastId.update({ id: toastId.id, description: `File ${i}/${files.length}: ${p.pct}%` })
                });
                if (isVideo) uploadedVideoUrls.push(downloadURL);
                else uploadedPhotoUrls.push(downloadURL);
            }
            const quoteRef = doc(db, 'quotes', quote.id);
            const updateData: any = {};
            if (uploadedPhotoUrls.length > 0) updateData.photos = arrayUnion(...uploadedPhotoUrls);
            if (uploadedVideoUrls.length > 0) updateData.videos = arrayUnion(...uploadedVideoUrls);
            await updateDocumentNonBlocking(quoteRef, updateData);
            setQuote(prev => prev ? ({ ...prev, photos: [...(prev.photos || []), ...uploadedPhotoUrls], videos: [...(prev.videos || []), ...uploadedVideoUrls] }) : null);
            toastId.dismiss();
            toast({ title: "Media Added" });
        } catch (error: any) { toastId.dismiss(); toast({ variant: "destructive", title: "Upload Failed" }); } finally {
            setIsUploadingMedia(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleMediaDelete = async (url: string, type: 'photo' | 'video') => {
        if (!db || !quote) return;
        const field = type === 'photo' ? 'photos' : 'videos';
        const updatedList = (quote[field] || []).filter(u => u !== url);
        try {
            const quoteRef = doc(db, 'quotes', quote.id);
            await updateDocumentNonBlocking(quoteRef, { [field]: updatedList });
            await deleteImage(url);
            setQuote(prev => prev ? ({ ...prev, [field]: updatedList } as Quote) : null);
            toast({ title: "Media Deleted" });
        } catch (error) { toast({ title: "Delete Failed", variant: 'destructive' }); }
    };

    if (isLoading || isRoleLoading) return <MainLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div></MainLayout>;
    if (!quote) return null;

    const isAdmin = role?.name === 'Administrator';
    const isCompleted = quote.status === 'Accepted' || quote.status === 'Archived';

    return (
        <MainLayout>
            <div className="container mx-auto py-8">
                <div className="mb-6 flex justify-between items-center gap-4">
                    <Button variant="outline" asChild><Link href="/quotes" className="flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Back to Quotes</Link></Button>
                     {isAdmin && <Button onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}Save Quote</Button>}
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <Card>
                             <CardHeader><CardTitle>Quote Details - {quote.quoteNumber}</CardTitle><CardDescription>Job: {quote.jobName}</CardDescription></CardHeader>
                            <CardContent>
                                 <Table>
                                    <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="w-[100px]">Qty</TableHead><TableHead className="w-[150px]">Unit Price</TableHead><TableHead className="w-[150px] text-right">Total</TableHead>{isAdmin && <TableHead className="w-[50px]"></TableHead>}</TableRow></TableHeader>
                                    <TableBody>
                                        {lineItems.map((item, index) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{isAdmin ? <Input value={item.description} onChange={(e) => handleLineItemChange(index, 'description', e.target.value)} /> : <span>{item.description}</span>}</TableCell>
                                                <TableCell>{isAdmin ? <Input type="number" value={item.quantity} onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)} /> : <span>{item.quantity}</span>}</TableCell>
                                                <TableCell>{isAdmin ? <Input type="number" value={item.unitPrice} onChange={(e) => handleLineItemChange(index, 'unitPrice', e.target.value)} /> : <span>{currencyFormatter.format(item.unitPrice)}</span>}</TableCell>
                                                <TableCell className="text-right font-mono">{currencyFormatter.format(item.quantity * item.unitPrice)}</TableCell>
                                                {isAdmin && <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveLineItem(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {isAdmin && <Button variant="outline" size="sm" className="mt-4" onClick={handleAddLineItem}><PlusCircle className="mr-2 h-4 w-4" /> Add Line Item</Button>}
                                <Separator className="my-6" /><div className="w-full sm:w-1/2 ml-auto space-y-3"><div className="flex justify-between items-center"><p className="font-medium">Subtotal</p><p className="font-mono">{currencyFormatter.format(subtotal)}</p></div><div className="flex justify-between items-center"><Label htmlFor="tax-percent">Tax (%)</Label>{isAdmin ? <Input id="tax-percent" type="number" value={tax} onChange={(e) => setTax(Number(e.target.value))} className="w-24 h-8" /> : <span className="font-mono">{tax}%</span>}</div><div className="flex justify-between items-center font-bold text-lg"><p>Total</p><p className="font-mono">{currencyFormatter.format(total)}</p></div></div>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader><CardTitle>Technician's Submission</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div><h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider text-[10px]">Description of Work</h3><p className="text-sm whitespace-pre-wrap mt-1">{quote.description}</p></div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider text-[10px]">Model Number</h3><p className="text-sm font-medium mt-1">{quote.modelNumber}</p></div><div><h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider text-[10px]">Serial Number</h3><p className="text-sm font-medium mt-1">{quote.serialNumber}</p></div></div>
                                    {quote.estimatedLabor && <div><h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider text-[10px]">Estimated Labor</h3><p className="text-sm mt-1 whitespace-pre-wrap">{quote.estimatedLabor}</p></div>}
                                    {quote.materialsNeeded && <div><h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider text-[10px]">Materials Needed</h3><p className="text-sm mt-1 whitespace-pre-wrap">{quote.materialsNeeded}</p></div>}
                                </div>
                                <Separator className="my-6" />
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between"><h3 className="font-bold flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Quote Media</h3>{!isCompleted && <div><input type="file" ref={mediaInputRef} multiple accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} /><Button size="sm" variant="outline" onClick={() => mediaInputRef.current?.click()} disabled={isUploadingMedia}>{isUploadingMedia ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}Add Photos/Video</Button></div>}</div>
                                    {quote.photos && quote.photos.length > 0 && (
                                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                                            {quote.photos.map((url, i) => (
                                                <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer" onClick={() => setViewingPhoto(url)}>
                                                    <Image src={url} alt={`Quote photo ${i+1}`} fill className="object-cover" sizes="(max-width: 768px) 25vw, 12vw" />
                                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="text-white h-5 w-5" /></div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {quote.videos && quote.videos.length > 0 && (
                                        <div className="space-y-2">
                                            {quote.videos.map((url, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm font-medium text-primary hover:underline"><Video className="h-4 w-4" />Video Submission {i+1}</a>
                                                    {!isCompleted && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleMediaDelete(url, 'video')}><Trash2 className="h-4 w-4" /></Button>}
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
                            <CardHeader><CardTitle>Quote Management</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                     {isAdmin ? <Select value={status} onValueChange={(v: Quote['status']) => setStatus(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Sent">Sent</SelectItem><SelectItem value="Accepted">Accepted</SelectItem><SelectItem value="Rejected">Rejected</SelectItem><SelectItem value="Archived">Archived</SelectItem></SelectContent></Select> : <Badge variant="outline" className="text-sm w-full py-2 justify-center">{status}</Badge>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Admin Notes</Label>
                                    {isAdmin ? <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={4} placeholder="Internal office notes..."/> : <p className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-md">Administrative eyes only.</p>}
                                </div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle>Context</CardTitle></CardHeader>
                            <CardContent className="text-sm space-y-3">
                                 <div className="flex justify-between border-b pb-2"><strong className="text-muted-foreground">Work Order</strong><Link href={`/work-orders/${quote.workOrderId}`} className="text-primary hover:underline font-medium">#{quote.workOrderId}</Link></div>
                                 <div className="flex justify-between border-b pb-2"><strong className="text-muted-foreground">Client</strong><span className="text-right">{quote.client?.name || 'N/A'}</span></div>
                                 <div className="flex justify-between border-b pb-2"><strong className="text-muted-foreground">Work Site</strong><span className="text-right">{quote.workSite?.name || 'N/A'}</span></div>
                                 <div className="flex justify-between border-b pb-2"><strong className="text-muted-foreground">Initiated By</strong><span className="text-right">{quote.createdBy_technician?.name || 'N/A'}</span></div>
                                 <div className="flex justify-between"><strong className="text-muted-foreground">Date</strong><span>{format(new Date(quote.createdDate), 'MMM d, yyyy')}</span></div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-0 flex flex-col items-stretch h-[90vh]">
                    <DialogHeader className="p-4 bg-background/10 backdrop-blur-sm border-b border-white/10 absolute top-0 w-full z-10"><DialogTitle className="text-white text-sm font-bold uppercase tracking-widest">Quote Documentation Preview</DialogTitle></DialogHeader>
                    <div className="flex-1 relative flex items-center justify-center p-4">{viewingPhoto && <Image src={viewingPhoto} alt="Quote photo preview" fill className="object-contain" priority />}</div>
                    <div className="p-4 bg-background flex justify-between items-center border-t">
                        <Button variant="outline" size="sm" onClick={() => setViewingPhoto(null)}>Close</Button>
                        <div className="flex items-center gap-2">
                            {viewingPhoto && <Button variant="outline" size="sm" asChild><a href={`/api/image-proxy?url=${encodeURIComponent(viewingPhoto)}`} download><Download className="h-4 w-4 mr-2" /> Download</a></Button>}
                            {!isCompleted && viewingPhoto && <Button variant="destructive" size="sm" onClick={() => { handleMediaDelete(viewingPhoto, 'photo'); setViewingPhoto(null); }}><Trash2 className="h-4 w-4 mr-2" /> Delete Documentation</Button>}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
