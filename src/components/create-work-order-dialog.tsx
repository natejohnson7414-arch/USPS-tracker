
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from './ui/date-picker';
import { Loader2, PlusCircle, FileUp, Building } from 'lucide-react';
import type { Technician, WorkOrder, WorkSite, Client } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Checkbox } from './ui/checkbox';
import { extractWorkOrderInfo } from '@/ai/flows/extract-work-order-flow';
import { Card, CardContent, CardHeader } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface CreateWorkOrderDialogProps {
  technicians: Technician[];
  workSites: WorkSite[];
  clients: Client[];
  onWorkOrderAdded: (newOrder: WorkOrder) => void;
}

export function CreateWorkOrderDialog({ technicians, workSites, clients, onWorkOrderAdded }: CreateWorkOrderDialogProps) {
  const db = useFirestore();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for the "create new site" prompt
  const [showCreateSitePrompt, setShowCreateSitePrompt] = useState(false);
  const [extractedAddress, setExtractedAddress] = useState<string | null>(null);
  const [extractedJobName, setExtractedJobName] = useState<string | null>(null);


  // Form state based on the new template
  const [jobId, setJobId] = useState('');
  const [createdDate, setCreatedDate] = useState<Date | undefined>(new Date());
  const [clientId, setClientId] = useState<string | undefined>();
  const [poNumber, setPoNumber] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [workSiteId, setWorkSiteId] = useState<string | undefined>();
  const [description, setDescription] = useState('');
  const [serviceScheduleDate, setServiceScheduleDate] = useState<Date | undefined>();
  const [quotedAmount, setQuotedAmount] = useState<number | undefined>();
  const [timeAndMaterial, setTimeAndMaterial] = useState(false);
  const [permit, setPermit] = useState(false);
  const [permitCost, setPermitCost] = useState<number | undefined>();
  const [permitFiled, setPermitFiled] = useState<Date | undefined>();
  const [coi, setCoi] = useState(false);
  const [coiRequested, setCoiRequested] = useState<Date | undefined>();
  const [certifiedPayroll, setCertifiedPayroll] = useState(false);
  const [certifiedPayrollRequested, setCertifiedPayrollRequested] = useState<Date | undefined>();
  const [intercoPO, setIntercoPO] = useState('');
  const [customerPO, setCustomerPO] = useState('');
  const [estimator, setEstimator] = useState('');
  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string | undefined>();
  

  const resetForm = () => {
    setJobId('');
    setCreatedDate(new Date());
    setClientId(undefined);
    setPoNumber('');
    setContactInfo('');
    setWorkSiteId(undefined);
    setDescription('');
    setServiceScheduleDate(undefined);
    setQuotedAmount(undefined);
    setTimeAndMaterial(false);
    setPermit(false);
    setPermitCost(undefined);
    setPermitFiled(undefined);
    setCoi(false);
    setCoiRequested(undefined);
    setCertifiedPayroll(false);
    setCertifiedPayrollRequested(undefined);
    setIntercoPO('');
    setCustomerPO('');
    setEstimator('');
    setAssignedTechnicianId(undefined);
    setShowCreateSitePrompt(false);
    setExtractedAddress(null);
    setExtractedJobName(null);
  };
  
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    resetForm();
    setIsExtracting(true);
    toast({ title: 'Extracting Data...', description: 'Please wait while the AI analyzes the PDF.' });

    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const dataUri = reader.result as string;
            const extractedData = await extractWorkOrderInfo({ pdfDataUri: dataUri });

            // Find matching client
            const matchedClient = clients.find(c => c.name.toLowerCase().includes(extractedData.billTo?.toLowerCase() || ''));
            if (matchedClient) setClientId(matchedClient.id);

            // Check for matching work site by address
            const matchedWorkSite = workSites.find(ws => 
                ws.address.toLowerCase() === extractedData.jobSiteAddress?.toLowerCase() ||
                ws.name.toLowerCase() === extractedData.jobName?.toLowerCase()
            );

            if (matchedWorkSite) {
                setWorkSiteId(matchedWorkSite.id);
            } else if (extractedData.jobSiteAddress) {
                // If no match is found but an address was extracted, show the prompt
                setShowCreateSitePrompt(true);
                setExtractedAddress(extractedData.jobSiteAddress);
                setExtractedJobName(extractedData.jobName || null);
            }

            // Update form state with other data
            if (extractedData.id) setJobId(extractedData.id);
            if (extractedData.createdDate) setCreatedDate(new Date(extractedData.createdDate));
            if (extractedData.poNumber) setPoNumber(extractedData.poNumber);
            if (extractedData.contactInfo) setContactInfo(extractedData.contactInfo);
            if (extractedData.description) setDescription(extractedData.description);
            if (extractedData.serviceScheduleDate) setServiceScheduleDate(new Date(extractedData.serviceScheduleDate));
            if (extractedData.quotedAmount) setQuotedAmount(extractedData.quotedAmount);
            if (extractedData.timeAndMaterial) setTimeAndMaterial(extractedData.timeAndMaterial);
            if (extractedData.permit) setPermit(extractedData.permit);
            if (extractedData.permitCost) setPermitCost(extractedData.permitCost);
            if (extractedData.permitFiled) setPermitFiled(new Date(extractedData.permitFiled));
            if (extractedData.coi) setCoi(extractedData.coi);
            if (extractedData.coiRequested) setCoiRequested(new Date(extractedData.coiRequested));
            if (extractedData.certifiedPayroll) setCertifiedPayroll(extractedData.certifiedPayroll);
            if (extractedData.certifiedPayrollRequested) setCertifiedPayrollRequested(new Date(extractedData.certifiedPayrollRequested));
            if (extractedData.intercoPO) setIntercoPO(extractedData.intercoPO);
            if (extractedData.customerPO) setCustomerPO(extractedData.customerPO);
            if (extractedData.estimator) setEstimator(extractedData.estimator);
            
            toast({ title: 'Extraction Complete', description: 'Form has been auto-populated. Please review.' });
        };

        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            toast({ title: 'File Read Error', description: 'Could not read the uploaded file.', variant: 'destructive' });
        }

    } catch (error) {
        console.error('Error extracting work order info:', error);
        toast({ title: 'Extraction Failed', description: 'The AI could not extract data from the PDF.', variant: 'destructive' });
    } finally {
        setIsExtracting(false);
        // Reset file input so the same file can be uploaded again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  const handleCreateNewSite = async () => {
    if (!db || !extractedAddress) return;
    setIsSubmitting(true);
    try {
        const workSitesRef = collection(db, 'work_sites');
        const newSiteData: Omit<WorkSite, 'id'> = {
            name: extractedJobName || extractedAddress, // Use Job Name if available, otherwise address
            address: extractedAddress,
            city: '', state: '', zip: '', // These can be added later
        };

        const docRef = await addDocumentNonBlocking(workSitesRef, newSiteData);
        
        // This is a simplification. In a real app, you'd want to refetch work sites
        // or add the new one to the local state to update the dropdown.
        // For now, we'll just set the ID.
        setWorkSiteId(docRef.id);
        setShowCreateSitePrompt(false);
        toast({ title: "Work Site Created", description: "New work site has been created and selected." });

    } catch(error) {
        console.error("Error creating new work site:", error);
        toast({ title: "Error", description: "Failed to create new work site.", variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleSelectExistingSite = (siteId: string) => {
    setWorkSiteId(siteId);
    setShowCreateSitePrompt(false);
  };


  const handleSubmit = async () => {
    const selectedWorkSite = workSites.find(ws => ws.id === workSiteId);
    const selectedClient = clients.find(c => c.id === clientId);
    
    if (!db || !jobId || !selectedWorkSite || !description) {
      toast({
        title: 'Missing Information',
        description: 'Job #, Job Site, and Description are required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const workOrderRef = doc(db, 'work_orders', jobId);

      const newWorkOrderData = {
        id: jobId,
        createdDate: (createdDate || new Date()).toISOString(),
        billTo: selectedClient?.name || null,
        clientId: clientId || null,
        poNumber,
        contactInfo,
        jobName: selectedWorkSite.name,
        workSiteId: workSiteId || null,
        description,
        serviceScheduleDate: serviceScheduleDate?.toISOString() || null,
        quotedAmount: quotedAmount || null,
        timeAndMaterial,
        permit,
        permitCost: permitCost || null,
        permitFiled: permitFiled?.toISOString() || null,
        coi,
        coiRequested: coiRequested?.toISOString() || null,
        certifiedPayroll,
        certifiedPayrollRequested: certifiedPayrollRequested?.toISOString() || null,
        intercoPO,
        customerPO,
        estimator,
        status: 'Open' as const,
        assignedTechnicianId: assignedTechnicianId || null,
      };

      // Firestore does not allow `undefined` values. We clean them here.
      Object.keys(newWorkOrderData).forEach(key => {
        const k = key as keyof typeof newWorkOrderData;
        if (newWorkOrderData[k] === undefined) {
          (newWorkOrderData as any)[k] = null;
        }
      });
      
      setDocumentNonBlocking(workOrderRef, newWorkOrderData, { merge: false });

      const newWorkOrder: WorkOrder = {
          ...(newWorkOrderData as any),
          notes: [],
          workSite: selectedWorkSite,
          client: selectedClient
      };

      onWorkOrderAdded(newWorkOrder);
      toast({
          title: 'Work Order Created',
          description: `Successfully created work order ${newWorkOrder.id}.`,
      });
      resetForm();
      setOpen(false);

    } catch (error) {
      console.error("Error creating work order:", error);
      toast({
        title: 'Error',
        description: 'Could not create work order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            resetForm();
        }
    }}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Work Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Small Job Form</DialogTitle>
           <div className="flex justify-between items-center">
            <DialogDescription>Fill in the details below to create a new work order.</DialogDescription>
             <div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePdfUpload}
                    className="hidden"
                    accept="application/pdf"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isExtracting || isSubmitting}>
                    {isExtracting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FileUp className="mr-2 h-4 w-4" />
                    )}
                    Upload & Autofill from PDF
                </Button>
            </div>
           </div>
        </DialogHeader>
        <div className="grid gap-4 py-4 md:grid-cols-2 md:gap-6 max-h-[70vh] overflow-y-auto pr-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="date">Date</Label>
                    <DatePicker date={createdDate} setDate={setCreatedDate} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="jobId">Job #</Label>
                    <Input id="jobId" value={jobId} onChange={e => setJobId(e.target.value)} required/>
                </div>
            </div>
             <div className="grid gap-2">
                <Label htmlFor="billTo">Bill To</Label>
                <Select onValueChange={setClientId} value={clientId} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>

            {showCreateSitePrompt ? (
                <Alert>
                    <Building className="h-4 w-4" />
                    <AlertTitle>New Work Site Detected</AlertTitle>
                    <AlertDescription>
                        The address <span className="font-semibold">"{extractedAddress}"</span> was not found. Would you like to create a new work site or assign to an existing one?
                    </AlertDescription>
                    <div className="mt-4 space-y-4">
                        <Button className="w-full" onClick={handleCreateNewSite} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                             Create New Work Site
                        </Button>
                        <div className="grid gap-2">
                            <Label>Or Select Existing Site</Label>
                            <Select onValueChange={handleSelectExistingSite} disabled={isSubmitting}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an existing site..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {workSites.map(site => (
                                    <SelectItem key={site.id} value={site.id}>
                                        {site.name} - {site.address}
                                    </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </Alert>
            ) : (
                <div className="grid gap-2">
                    <Label htmlFor="workSite">Job Site / Name</Label>
                    <Select onValueChange={setWorkSiteId} value={workSiteId} disabled={isSubmitting}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a work site" />
                    </SelectTrigger>
                    <SelectContent>
                        {workSites.map(site => (
                        <SelectItem key={site.id} value={site.id}>
                            {site.name} - {site.address}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>
            )}

            <div className="grid gap-2">
                <Label htmlFor="description">Job Description</Label>
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required/>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="serviceScheduleDate">Service Schedule Date</Label>
                <DatePicker date={serviceScheduleDate} setDate={setServiceScheduleDate} />
            </div>
            <div className="flex items-center space-x-2">
                <Checkbox id="timeAndMaterial" checked={timeAndMaterial} onCheckedChange={(checked) => setTimeAndMaterial(Boolean(checked))} />
                <label htmlFor="timeAndMaterial" className="text-sm font-medium leading-none">Time & Material</label>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                    <Checkbox id="permit" checked={permit} onCheckedChange={(checked) => setPermit(Boolean(checked))} />
                    <label htmlFor="permit" className="text-sm font-medium leading-none">Permit</label>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="permitCost">Permit Cost</Label>
                    <Input id="permitCost" type="number" value={permitCost ?? ''} onChange={e => setPermitCost(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="permitFiled">Permit Filed</Label>
                <DatePicker date={permitFiled} setDate={setPermitFiled} />
            </div>
             <div className="flex items-center space-x-2">
                <Checkbox id="coi" checked={coi} onCheckedChange={(checked) => setCoi(Boolean(checked))} />
                <label htmlFor="coi" className="text-sm font-medium leading-none">COI</label>
            </div>
             <div className="grid gap-2">
                <Label htmlFor="coiRequested">COI Requested</Label>
                <DatePicker date={coiRequested} setDate={setCoiRequested} />
            </div>
             <div className="flex items-center space-x-2">
                <Checkbox id="certifiedPayroll" checked={certifiedPayroll} onCheckedChange={(checked) => setCertifiedPayroll(Boolean(checked))} />
                <label htmlFor="certifiedPayroll" className="text-sm font-medium leading-none">Certified Payroll</label>
            </div>
             <div className="grid gap-2">
                <Label htmlFor="certifiedPayrollRequested">Certified Payroll Requested</Label>
                <DatePicker date={certifiedPayrollRequested} setDate={setCertifiedPayrollRequested} />
            </div>
          </div>
          {/* Right Column */}
          <div className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="poNumber">PO #</Label>
                <Input id="poNumber" value={poNumber} onChange={e => setPoNumber(e.target.value)} />
            </div>
             <div className="grid gap-2">
                <Label htmlFor="contactInfo">Contact Info</Label>
                <Textarea id="contactInfo" value={contactInfo} onChange={e => setContactInfo(e.target.value)} />
            </div>
            <div className="h-20"></div> {/* Spacer */}
             <div className="grid gap-2">
                <Label htmlFor="quotedAmount">Quoted Amount</Label>
                <Input id="quotedAmount" type="number" value={quotedAmount ?? ''} onChange={e => setQuotedAmount(e.target.value ? Number(e.target.value) : undefined)} />
            </div>
             <div className="grid gap-2">
                <Label htmlFor="technician">Assign To</Label>
                <Select onValueChange={setAssignedTechnicianId} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map(tech => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
             <div className="grid gap-2">
                <Label htmlFor="intercoPO">Interco PO#</Label>
                <Input id="intercoPO" value={intercoPO} onChange={e => setIntercoPO(e.target.value)} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="customerPO">Customer PO#</Label>
                <Input id="customerPO" value={customerPO} onChange={e => setCustomerPO(e.target.value)} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="estimator">Estimator/Requested By</Label>
                <Input id="estimator" value={estimator} onChange={e => setEstimator(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline" disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || showCreateSitePrompt}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Creating...' : 'Create Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
