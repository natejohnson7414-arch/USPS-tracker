
'use client';

import { useState, useEffect } from 'react';
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
import type { Quote, QuoteLineItem } from '@/lib/types';
import { Loader2, ArrowLeft, Trash2, PlusCircle, Video } from 'lucide-react';
import { doc } from 'firebase/firestore';

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

    // Editable fields
    const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
    const [status, setStatus] = useState<Quote['status']>('Draft');
    const [tax, setTax] = useState<number>(0);
    const [adminNotes, setAdminNotes] = useState<string>('');
    const [subtotal, setSubtotal] = useState(0);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        if (!db || typeof id !== 'string' || isRoleLoading) return;

        setIsLoading(true);
        getQuoteById(db, id)
            .then(q => {
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
            })
            .finally(() => setIsLoading(false));

    }, [db, id, role, isRoleLoading, router, toast]);

    useEffect(() => {
        const newSubtotal = lineItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
        setSubtotal(newSubtotal);
        setTotal(newSubtotal + (newSubtotal * (tax / 100)));
    }, [lineItems, tax]);

    const handleAddLineItem = () => {
        setLineItems([...lineItems, { id: `new-${Date.now()}`, description: '', quantity: 1, unitPrice: 0 }]);
    };

    const handleRemoveLineItem = (index: number) => {
        setLineItems(lineItems.filter((_, i) => i !== index));
    };
    
    const handleLineItemChange = (index: number, field: keyof QuoteLineItem, value: string | number) => {
        const updatedItems = [...lineItems];
        if (field === 'description') {
            updatedItems[index].description = value as string;
        } else {
             updatedItems[index][field as 'quantity' | 'unitPrice'] = Number(value) || 0;
        }
        setLineItems(updatedItems);
    };

    const handleSave = async () => {
        if (!db || !quote) return;
        setIsSaving(true);
        
        const quoteRef = doc(db, 'quotes', quote.id);
        const updatedData: Partial<Quote> = {
            lineItems,
            status,
            tax,
            adminNotes,
            subtotal,
            total,
        };

        try {
            await updateDocumentNonBlocking(quoteRef, updatedData);
            toast({ title: 'Quote Saved', description: 'Your changes have been saved.' });
            setQuote(prev => prev ? ({ ...prev, ...updatedData } as Quote) : null);
        } catch (error) {
            if (error instanceof Error && !error.message.includes('permission-error')) {
                toast({ title: 'Save Failed', variant: 'destructive' });
            }
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || isRoleLoading) {
        return <MainLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div></MainLayout>;
    }
    
    if (!quote) return null;

    const isAdmin = role?.name === 'Administrator';

    return (
        <MainLayout>
            <div className="container mx-auto py-8">
                <div className="mb-6 flex justify-between items-center gap-4">
                    <Button variant="outline" asChild>
                      <Link href="/quotes" className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Quotes
                      </Link>
                    </Button>
                     {isAdmin && (
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                            Save Quote
                        </Button>
                     )}
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <Card>
                             <CardHeader>
                                <CardTitle>Quote Details - {quote.quoteNumber}</CardTitle>
                                <CardDescription>Job: {quote.jobName}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                 <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="w-[100px]">Qty</TableHead>
                                            <TableHead className="w-[150px]">Unit Price</TableHead>
                                            <TableHead className="w-[150px] text-right">Total</TableHead>
                                            {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lineItems.map((item, index) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    {isAdmin ? (
                                                        <Input value={item.description} onChange={(e) => handleLineItemChange(index, 'description', e.target.value)} />
                                                    ) : (
                                                        <span>{item.description}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {isAdmin ? (
                                                        <Input type="number" value={item.quantity} onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)} />
                                                    ) : (
                                                        <span>{item.quantity}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {isAdmin ? (
                                                        <Input type="number" value={item.unitPrice} onChange={(e) => handleLineItemChange(index, 'unitPrice', e.target.value)} />
                                                    ) : (
                                                        <span>{currencyFormatter.format(item.unitPrice)}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">{currencyFormatter.format(item.quantity * item.unitPrice)}</TableCell>
                                                {isAdmin && (
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveLineItem(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {isAdmin && (
                                    <Button variant="outline" size="sm" className="mt-4" onClick={handleAddLineItem}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Line Item
                                    </Button>
                                )}
                                <Separator className="my-6" />
                                <div className="w-full sm:w-1/2 ml-auto space-y-3">
                                    <div className="flex justify-between items-center">
                                        <p className="font-medium">Subtotal</p>
                                        <p className="font-mono">{currencyFormatter.format(subtotal)}</p>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor="tax-percent">Tax (%)</Label>
                                        {isAdmin ? (
                                            <Input id="tax-percent" type="number" value={tax} onChange={(e) => setTax(Number(e.target.value))} className="w-24 h-8" />
                                        ) : (
                                            <span className="font-mono">{tax}%</span>
                                        )}
                                    </div>
                                     <div className="flex justify-between items-center font-bold text-lg">
                                        <p>Total</p>
                                        <p className="font-mono">{currencyFormatter.format(total)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader><CardTitle>Technician's Submission</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-medium text-sm text-muted-foreground">Description of Work to be Quoted</h3>
                                        <p className="text-sm whitespace-pre-wrap">{quote.description}</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="font-medium text-sm text-muted-foreground">Model Number</h3>
                                            <p className="text-sm">{quote.modelNumber}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-sm text-muted-foreground">Serial Number</h3>
                                            <p className="text-sm">{quote.serialNumber}</p>
                                        </div>
                                    </div>

                                    {quote.estimatedLabor && (
                                    <div>
                                        <h3 className="font-medium text-sm text-muted-foreground">Estimated Labor</h3>
                                        <p className="text-sm whitespace-pre-wrap">{quote.estimatedLabor}</p>
                                    </div>
                                    )}

                                    {quote.materialsNeeded && (
                                    <div>
                                        <h3 className="font-medium text-sm text-muted-foreground">Materials Needed</h3>
                                        <p className="text-sm whitespace-pre-wrap">{quote.materialsNeeded}</p>
                                    </div>
                                    )}
                                </div>
                                
                                <Separator className="my-6" />

                                <div className="space-y-4">
                                    {quote.photos.length > 0 && (
                                        <div>
                                            <h3 className="font-medium mb-2">Photos</h3>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                {quote.photos.map((url, i) => <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="aspect-video relative"><Image src={url} alt={`Photo ${i+1}`} fill className="object-cover rounded-lg border" sizes="(max-width: 768px) 50vw, 33vw" /></a>)}
                                            </div>
                                        </div>
                                    )}
                                     {quote.videos.length > 0 && (
                                        <div>
                                            <h3 className="font-medium mb-2">Videos</h3>
                                            <div className="space-y-2">
                                                {quote.videos.map((url, i) => <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline"><Video className="h-4 w-4" /> Video {i+1}</a>)}
                                            </div>
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
                                     {isAdmin ? (
                                        <Select value={status} onValueChange={(v: Quote['status']) => setStatus(v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Draft">Draft</SelectItem>
                                                <SelectItem value="Sent">Sent</SelectItem>
                                                <SelectItem value="Accepted">Accepted</SelectItem>
                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                                <SelectItem value="Archived">Archived</SelectItem>
                                            </SelectContent>
                                        </Select>
                                     ) : (
                                        <Badge variant="outline" className="text-sm">{status}</Badge>
                                     )}
                                </div>
                                <div className="space-y-2">
                                    <Label>Admin Notes</Label>
                                    {isAdmin ? (
                                        <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={4} placeholder="Internal notes..."/>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">Administrative eyes only.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle>Context</CardTitle></CardHeader>
                            <CardContent className="text-sm space-y-3">
                                 <p><strong className="text-muted-foreground">Work Order:</strong> <Link href={`/work-orders/${quote.workOrderId}`} className="text-primary hover:underline">{quote.workOrderId}</Link></p>
                                <p><strong className="text-muted-foreground">Client:</strong> {quote.client?.name || 'N/A'}</p>
                                <p><strong className="text-muted-foreground">Work Site:</strong> {quote.workSite?.name || 'N/A'}</p>
                                <p><strong className="text-muted-foreground">Initiated By:</strong> {quote.createdBy_technician?.name || 'N/A'}</p>
                                <p><strong className="text-muted-foreground">Date Initiated:</strong> {format(new Date(quote.createdDate), 'PPP')}</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
