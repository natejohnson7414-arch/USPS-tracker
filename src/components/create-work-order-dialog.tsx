
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

interface CreateWorkOrderDialogProps {
  technicians: Technician[];
  workSites: WorkSite[];
  onWorkOrderAdded: (newOrder: WorkOrder) => void;
}

export function CreateWorkOrderDialog({ technicians, workSites, onWorkOrderAdded }: CreateWorkOrderDialogProps) {
  const db = useFirestore();
  const [open, setOpen] = useState(false);
  const [workOrderId, setWorkOrderId] = useState('');
  const [workSiteId, setWorkSiteId] = useState<string | undefined>();
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkOrder['priority'] | undefined>();
  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setWorkOrderId('');
    setWorkSiteId(undefined);
    setDescription('');
    setPriority(undefined);
    setAssignedTechnicianId(undefined);
    setDueDate(undefined);
  };
  
  const handleSubmit = async () => {
    const selectedWorkSite = workSites.find(ws => ws.id === workSiteId);
    
    if (!db || !workOrderId || !description || !priority || !dueDate || !selectedWorkSite) {
      toast({
        title: 'Missing Information',
        description: 'Please fill out all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const workOrderRef = doc(db, 'work_orders', workOrderId);

      const newWorkOrderData = {
        id: workOrderId,
        title: selectedWorkSite.name,
        description,
        priority,
        status: 'Open' as const,
        assignedTechnicianId: assignedTechnicianId || undefined,
        workSiteId: selectedWorkSite.id,
        createdAt: new Date().toISOString(),
        dueDate: dueDate.toISOString(),
      };
      
      setDocumentNonBlocking(workOrderRef, newWorkOrderData, { merge: false });

      const newWorkOrder: WorkOrder = {
          ...newWorkOrderData,
          notes: [],
          assignedTechnicianId: assignedTechnicianId,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Work Order</DialogTitle>
          <DialogDescription>Fill in the details below to create a new work order.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 sm:grid-cols-2 sm:gap-6">
           <div className="sm:col-span-2">
            <Label htmlFor="workOrderId">Work Order ID</Label>
            <Input 
                id="workOrderId" 
                value={workOrderId} 
                onChange={e => setWorkOrderId(e.target.value)}
                placeholder="e.g., WO-24-0001"
                disabled={isSubmitting}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="workSite">Work Site Location</Label>
             <Select onValueChange={setWorkSiteId} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="Select a work site" />
              </SelectTrigger>
              <SelectContent>
                {workSites.map(site => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} disabled={isSubmitting}/>
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select onValueChange={value => setPriority(value as WorkOrder['priority'])} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <DatePicker date={dueDate} setDate={setDueDate} />
          </div>
          <div className="sm:col-span-2">
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
