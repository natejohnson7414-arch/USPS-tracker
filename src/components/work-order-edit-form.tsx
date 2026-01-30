
'use client';

import { useState, useEffect } from 'react';
import type { WorkOrder, Technician, WorkSite, Client } from '@/lib/types';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
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
import { Loader2, Save, Ban } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

interface WorkOrderEditFormProps {
    workOrder: WorkOrder;
    technicians: Technician[];
    workSites: WorkSite[];
    clients: Client[];
    onFormSaved: () => void;
    onCancel: () => void;
}

export function WorkOrderEditForm({ workOrder, technicians, workSites, clients, onFormSaved, onCancel }: WorkOrderEditFormProps) {
    const db = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Form state for all editable fields
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<WorkOrder['status']>('Open');
    const [assignedTechnicianId, setAssignedTechnicianId] = useState<string | undefined>();
    const [workSiteId, setWorkSiteId] = useState<string | undefined>();
    const [clientId, setClientId] = useState<string | undefined>();
    const [createdDate, setCreatedDate] = useState<Date | undefined>();
    const [poNumber, setPoNumber] = useState('');
    const [contactInfo, setContactInfo] = useState('');
    const [serviceScheduleDate, setServiceScheduleDate] = useState<Date | undefined>();
    const [quotedAmount, setQuotedAmount] = useState('');
    const [timeAndMaterial, setTimeAndMaterial] = useState(false);
    const [permit, setPermit] = useState(false);
    const [permitCost, setPermitCost] = useState('');
    const [permitFiled, setPermitFiled] = useState<Date | undefined>();
    const [coi, setCoi] = useState(false);
    const [coiRequested, setCoiRequested] = useState<Date | undefined>();
    const [certifiedPayroll, setCertifiedPayroll] = useState(false);
    const [certifiedPayrollRequested, setCertifiedPayrollRequested] = useState<Date | undefined>();
    const [intercoPO, setIntercoPO] = useState('');
    const [customerPO, setCustomerPO] = useState('');
    const [estimator, setEstimator] = useState('');
    
    const [checkInType, setCheckInType] = useState<'none' | 'emcor' | 'weblink' | 'manual'>('none');
    const [emcorWorkOrder, setEmcorWorkOrder] = useState('');
    const [webLinkUrl, setWebLinkUrl] = useState('');
    const [manualPhone, setManualPhone] = useState('');
    const [manualWorkOrder, setManualWorkOrder] = useState('');

    useEffect(() => {
        if (workOrder) {
            setDescription(workOrder.description ?? '');
            setStatus(workOrder.status ?? 'Open');

            // This is the definitive fix: ensure falsy values (null, '', undefined) become undefined
            // so the Select component shows its placeholder.
            setAssignedTechnicianId(workOrder.assignedTechnicianId ? workOrder.assignedTechnicianId : undefined);
            setWorkSiteId(workOrder.workSiteId ? workOrder.workSiteId : undefined);
            setClientId(workOrder.clientId ? workOrder.clientId : undefined);
            
            setCreatedDate(workOrder.createdDate ? new Date(workOrder.createdDate) : undefined);
            setPoNumber(workOrder.poNumber ?? '');
            setContactInfo(workOrder.contactInfo ?? '');
            setServiceScheduleDate(workOrder.serviceScheduleDate ? new Date(workOrder.serviceScheduleDate) : undefined);
            setQuotedAmount(workOrder.quotedAmount?.toString() ?? '');
            setTimeAndMaterial(workOrder.timeAndMaterial ?? false);
            setPermit(workOrder.permit ?? false);
            setPermitCost(workOrder.permitCost?.toString() ?? '');
            setPermitFiled(workOrder.permitFiled ? new Date(workOrder.permitFiled) : undefined);
            setCoi(workOrder.coi ?? false);
            setCoiRequested(workOrder.coiRequested ? new Date(workOrder.coiRequested) : undefined);
            setCertifiedPayroll(workOrder.certifiedPayroll ?? false);
            setCertifiedPayrollRequested(workOrder.certifiedPayrollRequested ? new Date(workOrder.certifiedPayrollRequested) : undefined);
            setIntercoPO(workOrder.intercoPO ?? '');
            setCustomerPO(workOrder.customerPO ?? '');
            setEstimator(workOrder.estimator ?? '');

            const url = workOrder.checkInOutURL;
            setManualWorkOrder(workOrder.checkInWorkOrderNumber ?? '');
            
            if (url?.startsWith('tel:1-866-684-0431')) {
                setCheckInType('emcor');
                // Correctly parse the EMCOR work order number from the end of the string
                const parts = url.split(',');
                setEmcorWorkOrder(parts[parts.length - 1] ?? '');
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db) {
            toast({ title: "Database error", variant: "destructive" });
            return;
        }

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
            default:
                break;
        }

        const workOrderRef = doc(db, 'work_orders', workOrder.id);
        const selectedWorkSite = workSites.find(ws => ws.id === workSiteId);
        const selectedClient = clients.find(c => c.id === clientId);

        const cleanedData: Partial<WorkOrder> = {
            jobName: selectedWorkSite?.name,
            description,
            status,
            assignedTechnicianId,
            workSiteId,
            clientId,
            billTo: selectedClient?.name,
            createdDate: createdDate?.toISOString(),
            poNumber,
            contactInfo,
            serviceScheduleDate: serviceScheduleDate?.toISOString(),
            quotedAmount: quotedAmount ? parseFloat(quotedAmount) : undefined,
            timeAndMaterial,
            permit,
            permitCost: permitCost ? parseFloat(permitCost) : undefined,
            permitFiled: permitFiled?.toISOString(),
            coi,
            coiRequested: coiRequested?.toISOString(),
            certifiedPayroll,
            certifiedPayrollRequested: certifiedPayrollRequested?.toISOString(),
            intercoPO,
            customerPO,
            estimator,
            checkInOutURL: finalCheckInOutURL,
            checkInWorkOrderNumber: finalCheckInWorkOrderNumber,
        };

        Object.keys(cleanedData).forEach(key => {
            const k = key as keyof typeof cleanedData;
            if ((cleanedData as any)[k] === undefined) {
              (cleanedData as any)[k] = null;
            }
        });

        try {
            await updateDocumentNonBlocking(workOrderRef, cleanedData);
            toast({ title: "Work Order Saved", description: "Changes have been saved successfully." });
            onFormSaved();
        } catch (error) {
            console.error("Error saving work order", error);
            if (error instanceof Error && !error.message.includes('permission-error')) {
                toast({ title: "Save Failed", description: "Could not save changes.", variant: "destructive" });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const isCompleteDisabled = status !== 'Review' && workOrder.status !== 'Completed';


    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Editing Work Order #{workOrder.id}</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="space-y-2">
                                <Label htmlFor="edit-description">Job Description</Label>
                                <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4}/>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={status} onValueChange={(v: WorkOrder['status']) => setStatus(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Open">Open</SelectItem>
                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                        <SelectItem value="On Hold">On Hold</SelectItem>
                                        <SelectItem value="Review">Review</SelectItem>
                                        <SelectItem value="Completed" disabled={isCompleteDisabled}>Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                                {isCompleteDisabled && (
                                    <p className="text-xs text-muted-foreground">A job must be in 'Review' status before it can be completed.</p>
                                )}
                            </div>
                             <div className="space-y-2">
                                <Label>Date</Label>
                                <DatePicker date={createdDate} setDate={setCreatedDate} />
                            </div>
                             <div className="space-y-2">
                                <Label>Bill To</Label>
                                <Select value={clientId} onValueChange={setClientId}>
                                    <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label>PO #</Label>
                                <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} />
                            </div>
                            <div className="space-y-3 rounded-md border p-4">
                                <Label>Check-in/Out</Label>
                                <RadioGroup value={checkInType} onValueChange={(v) => setCheckInType(v as any)}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="none" id="edit-checkin-none" />
                                        <Label htmlFor="edit-checkin-none">None</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="emcor" id="edit-checkin-emcor" />
                                        <Label htmlFor="edit-checkin-emcor">EMCOR Call-In/Out</Label>
                                    </div>
                                    {checkInType === 'emcor' && (
                                        <div className="pl-6 pt-2">
                                            <Label htmlFor="edit-emcor-wo">EMCOR Work Order #</Label>
                                            <Input id="edit-emcor-wo" value={emcorWorkOrder} onChange={(e) => setEmcorWorkOrder(e.target.value)} />
                                        </div>
                                    )}
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="weblink" id="edit-checkin-weblink" />
                                        <Label htmlFor="edit-checkin-weblink">Web Link</Label>
                                    </div>
                                    {checkInType === 'weblink' && (
                                        <div className="pl-6 pt-2">
                                            <Label htmlFor="edit-weblink-url">URL</Label>
                                            <Input id="edit-weblink-url" value={webLinkUrl} onChange={(e) => setWebLinkUrl(e.target.value)} placeholder="https://example.com" />
                                        </div>
                                    )}
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="manual" id="edit-checkin-manual" />
                                        <Label htmlFor="edit-checkin-manual">Manual Phone Check-in</Label>
                                    </div>
                                    {checkInType === 'manual' && (
                                        <div className="space-y-2 pl-6 pt-2">
                                            <div>
                                                <Label htmlFor="edit-manual-phone">Phone Number</Label>
                                                <Input id="edit-manual-phone" type="tel" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} />
                                            </div>
                                            <div>
                                                <Label htmlFor="edit-manual-wo">Work Order #</Label>
                                                <Input id="edit-manual-wo" value={manualWorkOrder} onChange={(e) => setManualWorkOrder(e.target.value)} />
                                            </div>
                                        </div>
                                    )}
                                </RadioGroup>
                            </div>
                            <div className="space-y-2">
                                <Label>Contact Info</Label>
                                <Textarea value={contactInfo} onChange={e => setContactInfo(e.target.value)} />
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <Label>Job Site</Label>
                                <Select value={workSiteId} onValueChange={setWorkSiteId}>
                                    <SelectTrigger><SelectValue placeholder="Select work site..." /></SelectTrigger>
                                    <SelectContent>{workSites.map(ws => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label>Assigned To</Label>
                                <Select value={assignedTechnicianId} onValueChange={setAssignedTechnicianId}>
                                    <SelectTrigger><SelectValue placeholder="Select technician..." /></SelectTrigger>
                                    <SelectContent>{technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <Separator />
                             <div className="space-y-2">
                                <Label>Service Schedule Date</Label>
                                <DatePicker date={serviceScheduleDate} setDate={setServiceScheduleDate} />
                            </div>
                             <div className="space-y-2">
                                <Label>Quoted Amount</Label>
                                <Input type="text" value={quotedAmount} onChange={e => setQuotedAmount(e.target.value)} />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="timeAndMaterial" checked={timeAndMaterial} onCheckedChange={(c) => setTimeAndMaterial(!!c)} />
                                <Label htmlFor="timeAndMaterial">Time & Material</Label>
                            </div>
                             <Separator />
                             <div className="flex items-center space-x-2">
                                <Checkbox id="permit" checked={permit} onCheckedChange={(c) => setPermit(!!c)} />
                                <Label htmlFor="permit">Permit</Label>
                            </div>
                             <div className="space-y-2">
                                <Label>Permit Cost</Label>
                                <Input type="text" value={permitCost} onChange={e => setPermitCost(e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label>Permit Filed</Label>
                                <DatePicker date={permitFiled} setDate={setPermitFiled} />
                            </div>
                             <Separator />
                             <div className="flex items-center space-x-2">
                                <Checkbox id="coi" checked={coi} onCheckedChange={(c) => setCoi(!!c)} />
                                <Label htmlFor="coi">COI</Label>
                            </div>
                            <div className="space-y-2">
                                <Label>COI Requested</Label>
                                <DatePicker date={coiRequested} setDate={setCoiRequested} />
                            </div>
                            <Separator />
                             <div className="flex items-center space-x-2">
                                <Checkbox id="certifiedPayroll" checked={certifiedPayroll} onCheckedChange={(c) => setCertifiedPayroll(!!c)} />
                                <Label htmlFor="certifiedPayroll">Certified Payroll</Label>
                            </div>
                            <div className="space-y-2">
                                <Label>Certified Payroll Requested</Label>
                                <DatePicker date={certifiedPayrollRequested} setDate={setCertifiedPayrollRequested} />
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <Label>Interco PO#</Label>
                                <Input value={intercoPO} onChange={e => setIntercoPO(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Customer PO#</Label>
                                <Input value={customerPO} onChange={e => setCustomerPO(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Estimator/Requested By</Label>
                                <Input value={estimator} onChange={e => setEstimator(e.target.value)} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
             <div className="fixed bottom-0 left-0 w-full bg-background border-t shadow-lg">
                <div className="container mx-auto py-3 px-4 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                      <Ban className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Changes
                    </Button>
                </div>
             </div>
        </form>
    );
}

    
    

    