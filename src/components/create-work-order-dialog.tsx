
'use client';

import { useState, useRef, useEffect } from 'react';
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
import { Textarea } from './ui/textarea';
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
import { ScrollArea } from './ui/scroll-area';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { cn } from '@/lib/utils';

interface CreateWorkOrderDialogProps {
  technicians: Technician[];
  workSites: WorkSite[];
  clients: Client[];
  onWorkSiteAdded: (newSite: WorkSite) => void;
}

export function CreateWorkOrderDialog({ technicians, workSites, clients, onWorkSiteAdded }: CreateWorkOrderDialogProps) {
  const db = useFirestore();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showCreateSitePrompt, setShowCreateSitePrompt] = useState(false);
  const [extractedAddress, setExtractedAddress] = useState<string | null>(null);
  const [extractedCity, setExtractedCity] = useState<string | null>(null);
  const [extractedState, setExtractedState] = useState<string | null>(null);
  const [newSiteName, setNewSiteName] = useState<string>('');

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
  
  const [checkInType, setCheckInType] = useState<'none' | 'emcor' | 'weblink' | 'manual'>('none');
  const [emcorWorkOrder, setEmcorWorkOrder] = useState('');
  const [webLinkUrl, setWebLinkUrl] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualWorkOrder, setManualWorkOrder] = useState('');

  const [errors, setErrors] = useState<{ jobId?: boolean, workSiteId?: boolean, description?: boolean }>({});

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
    setExtractedCity(null);
    setExtractedState(null);
    setNewSiteName('');
    
    setCheckInType('none');
    setEmcorWorkOrder('');
    setWebLinkUrl('');
    setManualPhone('');
    setManualWorkOrder('');
    setErrors({});
  };
  
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    resetForm();
    setIsExtracting(true);
    
    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const dataUri = reader.result as string;
            
            try {
              const extractedData = await extractWorkOrderInfo({ pdfDataUri: dataUri });

              const matchedClient = clients.find(c => c.name.toLowerCase().includes(extractedData.billTo?.toLowerCase() || ''));
              if (matchedClient) setClientId(matchedClient.id);

              const matchedWorkSite = workSites.find(ws => 
                  (ws.address && extractedData.jobSiteAddress && ws.address.toLowerCase() === extractedData.jobSiteAddress.toLowerCase()) ||
                  (ws.name && extractedData.jobName && ws.name.toLowerCase() === extractedData.jobName.toLowerCase())
              );

              if (matchedWorkSite) {
                  setWorkSiteId(matchedWorkSite.id);
              } else if (extractedData.jobSiteAddress || extractedData.jobName) {
                  setShowCreateSitePrompt(true);
                  setExtractedAddress(extractedData.jobSiteAddress || null);
                  setExtractedCity(extractedData.jobSiteCity || null);
                  setExtractedState(extractedData.jobSiteState || null);
                  setNewSiteName(extractedData.jobName || extractedData.jobSiteAddress || '');
              }

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
              
              if (extractedData.checkInOutURL) {
                if (extractedData.checkInOutURL.startsWith('tel:')) {
                  setCheckInType('manual');
                  setManualPhone(extractedData.checkInOutURL.replace('tel:', ''));
                } else if (extractedData.checkInOutURL.startsWith('http')) {
                  setCheckInType('weblink');
                  setWebLinkUrl(extractedData.checkInOutURL);
                }
              }
              
              toast({ title: 'Extraction Complete', description: 'Form has been auto-populated. Please review.' });
            } catch (error) {
              console.error('Error extracting work order info:', error);
              toast({ title: 'Extraction Failed', description: 'The AI could not extract data from the PDF.', variant: 'destructive' });
            } finally {
              setIsExtracting(false);
            }
        };

        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            toast({ title: 'File Read Error', description: 'Could not read the uploaded file.', variant: 'destructive' });
            setIsExtracting(false);
        }
    } catch (error) {
        setIsExtracting(false);
    } finally {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  const handleCreateNewSite = async () => {
    if (!db || !newSiteName) {
        toast({title: "Missing Name", description: "Please provide a name for the new work site.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    try {
        const workSitesRef = collection(db, 'work_sites');
        const newSiteData: Omit<WorkSite, 'id'> = {
            name: newSiteName,
            address: extractedAddress || '',
            city: extractedCity || '', 
            state: extractedState || '', 
            zip: '',
        };

        const docRef = await addDocumentNonBlocking(workSitesRef, newSiteData);
        
        const newSite: WorkSite = {
            id: docRef.id,
            ...newSiteData
        }

        onWorkSiteAdded(newSite);
        setWorkSiteId(newSite.id);
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
    setErrors({});
    
    const validationErrors: { jobId?: boolean, workSiteId?: boolean, description?: boolean } = {};
    if (!jobId) validationErrors.jobId = true;
    if (!workSiteId) validationErrors.workSiteId = true;
    if (!description) validationErrors.description = true;

    if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        toast({
            title: 'Missing Information',
            description: 'Job #, Job Site, and Description are required.',
            variant: 'destructive',
        });
        return;
    }

    if (!db) {
        toast({
            title: 'Database Error',
            description: 'Not connected to the database.',
            variant: 'destructive',
        });
        return;
    }

    setIsSubmitting(true);
    
    const selectedWorkSite = workSites.find(ws => ws.id === workSiteId);
    const selectedClient = clients.find(c => c.id === clientId);

    let finalCheckInOutURL: string | undefined = undefined;
    let finalCheckInWorkOrderNumber: string | undefined = undefined;

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

    try {
      const workOrderRef = doc(db, 'work_orders', jobId);

      const newWorkOrderData = {
        id: jobId,
        createdDate: (createdDate || new Date()).toISOString(),
        jobName: selectedWorkSite!.name,
        description,
        status: 'Open' as const,
        assignedTechnicianId,
        workSiteId,
        clientId,
        billTo: selectedClient?.name,
        poNumber,
        contactInfo,
        serviceScheduleDate: serviceScheduleDate?.toISOString(),
        quotedAmount,
        timeAndMaterial,
        permit,
        permitCost,
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

      Object.keys(newWorkOrderData).forEach(key => {
        const k = key as keyof typeof newWorkOrderData;
        if ((newWorkOrderData as any)[k] === undefined) {
          (newWorkOrderData as any)[k] = null;
        }
      });
      
      await setDocumentNonBlocking(workOrderRef, newWorkOrderData, { merge: false });

      toast({
          title: 'Work Order Created',
          description: `Successfully created work order ${jobId}.`,
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
      <DialogContent className="max-w-4xl bg-blue-50">
        {isExtracting && (
            <div className="absolute inset-0 bg-slate-100/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-lg">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-lg font-medium text-primary">Scanning PDF...</p>
              <p className="text-muted-foreground">Please wait while the AI extracts the data.</p>
            </div>
        )}
        <DialogHeader>
          <DialogTitle>Small Job Form</DialogTitle>
           <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <DialogDescription>Fill in the details below to create a new work order.</DialogDescription>
             <div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePdfUpload}
                    className="hidden"
                    accept="application/pdf"
                />
                <Button variant="destructive" onClick={() => fileInputRef.current?.click()} disabled={isExtracting || isSubmitting} className="w-full sm:w-auto">
                    <FileUp className="mr-2 h-4 w-4" />
                    Upload &amp; Autofill from PDF
                </Button>
            </div>
           </div>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] -mr-6">
        <div className="grid gap-4 py-4 md:grid-cols-2 md:gap-6 pr-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="date">Date</Label>
                    <DatePicker date={createdDate} setDate={setCreatedDate} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="jobId">Job #</Label>
                    <Input id="jobId" value={jobId} onChange={e => setJobId(e.target.value)} required className={cn(errors.jobId && "border-destructive")} />
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
                       The address <span className="font-semibold">"{extractedAddress}"</span> was not found. Please name the new site or assign an existing one.
                    </AlertDescription>
                    <div className="mt-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-site-name">New Site Name</Label>
                            <Input 
                                id="new-site-name" 
                                value={newSiteName} 
                                onChange={(e) => setNewSiteName(e.target.value)}
                                placeholder="Enter a name for the new site"
                            />
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-site-city">City</Label>
                                <Input 
                                    id="new-site-city" 
                                    value={extractedCity || ''} 
                                    onChange={(e) => setExtractedCity(e.target.value)}
                                />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="new-site-state">State</Label>
                                <Input 
                                    id="new-site-state" 
                                    value={extractedState || ''} 
                                    onChange={(e) => setExtractedState(e.target.value)}
                                />
                            </div>
                        </div>
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
                    <SelectTrigger className={cn(errors.workSiteId && "border-destructive")}>
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
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required className={cn(errors.description && "border-destructive")} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="serviceScheduleDate">Service Schedule Date</Label>
                <DatePicker date={serviceScheduleDate} setDate={setServiceScheduleDate} />
            </div>
            <div className="flex items-center space-x-2">
                <Checkbox id="timeAndMaterial" checked={timeAndMaterial} onCheckedChange={(checked) => setTimeAndMaterial(Boolean(checked))} />
                <label htmlFor="timeAndMaterial" className="text-sm font-medium leading-none">Time &amp; Material</label>
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
            <div className="space-y-3 rounded-md border p-4">
              <Label>Check-in/Out</Label>
              <RadioGroup value={checkInType} onValueChange={(v) => setCheckInType(v as any)}>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="checkin-none" />
                    <Label htmlFor="checkin-none">None</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="emcor" id="checkin-emcor" />
                    <Label htmlFor="checkin-emcor">EMCOR Call-In/Out</Label>
                </div>
                {checkInType === 'emcor' && (
                    <div className="pl-6 pt-2">
                        <Label htmlFor="emcor-wo">EMCOR Work Order #</Label>
                        <Input id="emcor-wo" value={emcorWorkOrder} onChange={(e) => setEmcorWorkOrder(e.target.value)} />
                    </div>
                )}
                 <div className="flex items-center space-x-2">
                    <RadioGroupItem value="weblink" id="checkin-weblink" />
                    <Label htmlFor="checkin-weblink">Web Link</Label>
                </div>
                {checkInType === 'weblink' && (
                    <div className="pl-6 pt-2">
                        <Label htmlFor="weblink-url">URL</Label>
                        <Input id="weblink-url" value={webLinkUrl} onChange={(e) => setWebLinkUrl(e.target.value)} placeholder="https://example.com" />
                    </div>
                )}
                 <div className="flex items-center space-x-2">
                    <RadioGroupItem value="manual" id="checkin-manual" />
                    <Label htmlFor="checkin-manual">Manual Phone Check-in</Label>
                </div>
                 {checkInType === 'manual' && (
                    <div className="space-y-2 pl-6 pt-2">
                        <div>
                            <Label htmlFor="manual-phone">Phone Number</Label>
                            <Input id="manual-phone" type="tel" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="manual-wo">Work Order #</Label>
                            <Input id="manual-wo" value={manualWorkOrder} onChange={(e) => setManualWorkOrder(e.target.value)} />
                        </div>
                    </div>
                )}
              </RadioGroup>
            </div>
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
        </ScrollArea>
        <DialogFooter className="pr-6">
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
