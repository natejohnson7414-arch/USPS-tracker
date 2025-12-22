
'use client';

import { useState } from 'react';
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
import { Loader2, PlusCircle } from 'lucide-react';
import type { Technician, WorkOrder, WorkSite } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Checkbox } from './ui/checkbox';

interface CreateWorkOrderDialogProps {
  technicians: Technician[];
  workSites: WorkSite[];
  onWorkOrderAdded: (newOrder: WorkOrder) => void;
}

export function CreateWorkOrderDialog({ technicians, workSites, onWorkOrderAdded }: CreateWorkOrderDialogProps) {
  const db = useFirestore();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Form state based on the new template
  const [jobId, setJobId] = useState('');
  const [createdDate, setCreatedDate] = useState<Date | undefined>(new Date());
  const [billTo, setBillTo] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [jobName, setJobName] = useState('');
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
    setBillTo('');
    setPoNumber('');
    setContactInfo('');
    setJobName('');
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
  };
  
  const handleSubmit = async () => {
    const selectedWorkSite = workSites.find(ws => ws.id === workSiteId);
    
    if (!db || !jobId || !jobName || !description) {
      toast({
        title: 'Missing Information',
        description: 'Job #, Job Name, and Description are required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const workOrderRef = doc(db, 'work_orders', jobId);

      const newWorkOrderData: Omit<WorkOrder, 'notes' | 'workSite'> = {
        id: jobId,
        createdDate: (createdDate || new Date()).toISOString(),
        billTo,
        poNumber,
        contactInfo,
        jobName,
        workSiteId,
        description,
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
        status: 'Open' as const,
        assignedTechnicianId: assignedTechnicianId || undefined,
      };
      
      setDocumentNonBlocking(workOrderRef, newWorkOrderData, { merge: false });

      const newWorkOrder: WorkOrder = {
          ...newWorkOrderData,
          notes: [],
          workSite: selectedWorkSite,
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Work Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Small Job Form</DialogTitle>
          <DialogDescription>Fill in the details below to create a new work order.</DialogDescription>
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
                <Input id="billTo" value={billTo} onChange={e => setBillTo(e.target.value)} />
            </div>
             <div className="grid gap-2">
                <Label htmlFor="jobName">Job Name</Label>
                <Input id="jobName" value={jobName} onChange={e => setJobName(e.target.value)} required />
            </div>
             <div className="grid gap-2">
                <Label htmlFor="workSite">Job Site</Label>
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
                    <Input id="permitCost" type="number" value={permitCost} onChange={e => setPermitCost(Number(e.target.value))} />
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
                <Input id="quotedAmount" type="number" value={quotedAmount} onChange={e => setQuotedAmount(Number(e.target.value))} />
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Creating...' : 'Create Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    