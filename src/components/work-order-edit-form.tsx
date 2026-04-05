'use client';

import { useState, useEffect, useMemo } from 'react';
import type { WorkOrder, Technician, WorkSite, Client } from '@/lib/types';
import { useFirestore, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { getDoc, getDocs, collection, doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, Ban, Search } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { cn } from '@/lib/utils';

interface WorkOrderEditFormProps {
    workOrder: WorkOrder;
    technicians: Technician[];
    workSites: WorkSite[];
    clients: Client[];
    onFormSaved: (newId?: string) => void;
    onCancel: () => void;
}

export function WorkOrderEditForm({ workOrder, technicians, workSites, clients, onFormSaved, onCancel }: WorkOrderEditFormProps) {
    const db = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const [jobId, setJobId] = useState(workOrder.id);
    const [description, setDescription] = useState(workOrder.description ?? '');
    const [status, setStatus] = useState<WorkOrder['status']>(workOrder.status ?? 'Open');
    const [assignedTechnicianId, setAssignedTechnicianId] = useState<string | undefined>(workOrder.assignedTechnicianId || undefined);
    const [workSiteId, setWorkSiteId] = useState<string | undefined>(workOrder.workSiteId || undefined);
    const [clientId, setClientId] = useState<string | undefined>(workOrder.clientId || undefined);
    const [createdDate, setCreatedDate] = useState<Date | undefined>(workOrder.createdDate ? new Date(workOrder.createdDate) : undefined);
    const [poNumber, setPoNumber] = useState(workOrder.poNumber ?? '');
    const [contactInfo, setContactInfo] = useState(workOrder.contactInfo ?? '');
    const [serviceScheduleDate, setServiceScheduleDate] = useState<Date | undefined>(workOrder.serviceScheduleDate ? new Date(workOrder.serviceScheduleDate) : undefined);
    const [quotedAmount, setQuotedAmount] = useState(workOrder.quotedAmount?.toString() ?? '');
    const [timeAndMaterial, setTimeAndMaterial] = useState(workOrder.timeAndMaterial ?? false);
    const [permit, setPermit] = useState(workOrder.permit ?? false);
    const [permitCost, setPermitCost] = useState(workOrder.permitCost?.toString() ?? '');
    const [permitFiled, setPermitFiled] = useState<Date | undefined>(workOrder.permitFiled ? new Date(workOrder.permitFiled) : undefined);
    const [coi, setCoi] = useState(workOrder.coi ?? false);
    const [coiRequested, setCoiRequested] = useState<Date | undefined>(workOrder.coiRequested ? new Date(workOrder.coiRequested) : undefined);
    const [certifiedPayroll, setCertifiedPayroll] = useState(workOrder.certifiedPayroll ?? false);
    const [certifiedPayrollRequested, setCertifiedPayrollRequested] = useState<Date | undefined>(workOrder.certifiedPayrollRequested ? new Date(workOrder.certifiedPayrollRequested) : undefined);
    const [intercoPO, setIntercoPO] = useState(workOrder.intercoPO ?? '');
    const [customerPO, setCustomerPO] = useState(workOrder.customerPO ?? '');
    const [estimator, setEstimator] = useState(workOrder.estimator ?? '');
    
    const [checkInType, setCheckInType] = useState<'none' | 'emcor' | 'weblink' | 'manual'>('none');
    const [emcorWorkOrder, setEmcorWorkOrder] = useState('');
    const [webLinkUrl, setWebLinkUrl] = useState('');
    const [manualPhone, setManualPhone] = useState('');
    const [manualWorkOrder, setManualWorkOrder] = useState('');

    const [siteSearchTerm, setSiteSearchTerm] = useState('');

    useEffect(() => {
        if (workOrder) {
            const url = workOrder.checkInOutURL;
            setManualWorkOrder(workOrder.checkInWorkOrderNumber ?? '');
            
            if (url?.startsWith('tel:1-866-684-0431')) {
                setCheckInType('emcor');
                const parts = url.split(',');
                setEmcorWorkOrder(parts[parts.length - 1]?.replace('#', '') ?? '');
            } else if (url?.startsWith('http')) {
                setCheckInType('weblink');
                setWebLinkUrl(url);
            } else if (url?.startsWith('tel:')) {
                setCheckInType('manual');
                setManualPhone(url.replace('tel:', ''));
            } else {
                setCheckInType('none');
            }
        }
    }, [workOrder]);

    const filteredAndSortedSites = useMemo(() => {
        return [...workSites]
          .filter(site =>
            (site.name?.toLowerCase().includes(siteSearchTerm.toLowerCase()) || '') ||
            (site.address?.toLowerCase().includes(siteSearchTerm.toLowerCase()) || '')
          )
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [workSites, siteSearchTerm]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db) return;

        setIsLoading(true);

        let finalCheckInOutURL: string | undefined | null = null;
        let finalCheckInWorkOrderNumber: string | undefined | null = null;

        switch (checkInType) {
            case 'emcor':
                if (emcorWorkOrder) {
                    finalCheckInOutURL = 'tel:1-866-684-0431,,,,,1,,,1,500047#,' + emcorWorkOrder;
                }
                break;
            case 'weblink':
                finalCheckInOutURL = webLinkUrl;
                break;
            case 'manual':
                if (manualPhone) {
                    finalCheckInOutURL = `tel:${manualPhone}`;
                }
                finalCheckInWorkOrderNumber = manualWorkOrder;
                break;
        }

        const selectedWorkSite = workSites.find(ws => ws.id === workSiteId);
        const selectedClient = clients.find(c => c.id === clientId);

        const currentInvolved = new Set(workOrder.involvedTechnicianIds || []);
        if (assignedTechnicianId) currentInvolved.add(assignedTechnicianId);

        const cleanedData: any = {
            jobName: selectedWorkSite?.name,
            description,
            status,
            assignedTechnicianId,
            involvedTechnicianIds: Array.from(currentInvolved),
            workSiteId,
            clientId,
            billTo: selectedClient?.name,
            createdDate: createdDate?.toISOString(),
            poNumber,
            contactInfo,
            serviceScheduleDate: serviceScheduleDate?.toISOString(),
            quotedAmount: quotedAmount ? parseFloat(quotedAmount) : null,
            timeAndMaterial,
            permit,
            permitCost: permitCost ? parseFloat(permitCost) : null,
            permitFiled: permitFiled?.toISOString() || null,
            coi,
            coiRequested: coiRequested?.toISOString() || null,
            certifiedPayroll,
            certifiedPayrollRequested: certifiedPayrollRequested?.toISOString() || null,
            intercoPO,
            customerPO,
            estimator,
            checkInOutURL: finalCheckInOutURL,
            checkInWorkOrderNumber: finalCheckInWorkOrderNumber,
        };

        if (jobId !== workOrder.id) {
            const newDocRef = doc(db, 'work_orders', jobId);
            const oldDocRef = doc(db, 'work_orders', workOrder.id);
            try {
                const newDocSnap = await getDoc(newDocRef);
                if (newDocSnap.exists()) {
                    toast({ title: "Duplicate Job Number", variant: "destructive" });
                    setIsLoading(false);
                    return;
                }
                const batch = writeBatch(db);
                const updatesColRef = collection(oldDocRef, 'updates');
                const updatesSnap = await getDocs(updatesColRef);
                updatesSnap.docs.forEach(d => batch.set(doc(newDocRef, 'updates', d.id), d.data()));
                const activitiesColRef = collection(oldDocRef, 'activities');
                const activitiesSnap = await getDocs(activitiesColRef);
                activitiesSnap.docs.forEach(d => batch.set(doc(newDocRef, 'activities', d.id), d.data()));
                batch.set(newDocRef, { ...workOrder, ...cleanedData, id: jobId });
                batch.delete(oldDocRef);
                await batch.commit();
                onFormSaved(jobId);
            } catch (error) { setIsLoading(false); }
        } else {
            try {
                await updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), cleanedData);
                onFormSaved();
            } catch (error) { setIsLoading(false); }
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader><CardTitle>Editing Work Order</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-job-id">Job #</Label>
                                <Input id="edit-job-id" value={jobId} onChange={(e) => setJobId(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-description">Job Description</Label>
                                <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4}/>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-8">
                     <Card>
                        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Open">Open</SelectItem>
                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                        <SelectItem value="On Hold">On Hold</SelectItem>
                                        <SelectItem value="Review">Review</SelectItem>
                                        <SelectItem value="Completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2"><Label>Date</Label><DatePicker date={createdDate} setDate={setCreatedDate} /></div>
                             <div className="space-y-2">
                                <Label>Bill To</Label>
                                <Select value={clientId} onValueChange={setClientId}>
                                    <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2"><Label>PO #</Label><Input value={poNumber} onChange={e => setPoNumber(e.target.value)} /></div>
                            <div className="space-y-3 rounded-md border p-4">
                                <Label>Check-in/Out</Label>
                                <RadioGroup value={checkInType} onValueChange={(v) => setCheckInType(v as any)}>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="edit-checkin-none" /><Label htmlFor="edit-checkin-none">None</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="emcor" id="edit-checkin-emcor" /><Label htmlFor="edit-checkin-emcor">EMCOR Call-In/Out</Label></div>
                                    {checkInType === 'emcor' && <div className="pl-6 pt-2"><Label>EMCOR WO #</Label><Input value={emcorWorkOrder} onChange={(e) => setEmcorWorkOrder(e.target.value)} /></div>}
                                </RadioGroup>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <Label>Job Site</Label>
                                <div className="space-y-2">
                                    <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search sites..." value={siteSearchTerm} onChange={(e) => setSiteSearchTerm(e.target.value)} className="pl-8 h-9 text-sm"/></div>
                                    <Select value={workSiteId} onValueChange={setWorkSiteId}>
                                        <SelectTrigger><SelectValue placeholder="Select work site..." /></SelectTrigger>
                                        <SelectContent>{filteredAndSortedSites.map(ws => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label>Assigned To</Label>
                                <Select value={assignedTechnicianId} onValueChange={setAssignedTechnicianId}>
                                    <SelectTrigger><SelectValue placeholder="Select technician..." /></SelectTrigger>
                                    <SelectContent>{technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
             <div className="fixed bottom-0 left-0 w-full bg-background border-t shadow-lg">
                <div className="container mx-auto py-3 px-4 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}><Ban className="mr-2 h-4 w-4" /> Cancel</Button>
                    <Button type="submit" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes</Button>
                </div>
             </div>
        </form>
    );
}
