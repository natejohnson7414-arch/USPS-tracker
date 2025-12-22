
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
import type { Technician, WorkOrder } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { format } from 'date-fns';

interface CreateWorkOrderDialogProps {
  technicians: Technician[];
  onWorkOrderAdded: (newOrder: WorkOrder) => void;
}

export function CreateWorkOrderDialog({ technicians, onWorkOrderAdded }: CreateWorkOrderDialogProps) {
  const db = useFirestore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkOrder['priority'] | undefined>();
  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority(undefined);
    setAssignedTechnicianId(undefined);
    setDueDate(undefined);
  };
  
  const handleSubmit = async () => {
    if (!db || !title || !description || !priority || !dueDate) {
      toast({
        title: 'Missing Information',
        description: 'Please fill out all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const year = format(new Date(), 'yy');
      const counterRef = doc(db, 'counters', `work_orders_${year}`);

      const newWorkOrder = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextNumber = 1;
        if (counterDoc.exists()) {
          nextNumber = counterDoc.data().lastNumber + 1;
        }

        const newWorkOrderId = `WO-${year}-${String(nextNumber).padStart(4, '0')}`;
        const workOrderRef = doc(db, 'work_orders', newWorkOrderId);

        const newWorkOrderData = {
          id: newWorkOrderId,
          title,
          description,
          priority,
          status: 'Open' as const,
          assignedTechnicianId: assignedTechnicianId || null,
          createdAt: new Date().toISOString(),
          dueDate: dueDate.toISOString(),
        };

        transaction.set(counterRef, { lastNumber: nextNumber }, { merge: true });
        transaction.set(workOrderRef, newWorkOrderData);
        
        return {
            ...newWorkOrderData,
            notes: [],
            assignedTechnicianId: assignedTechnicianId,
        } as WorkOrder;
      });

      if (newWorkOrder) {
        onWorkOrderAdded(newWorkOrder);
        toast({
            title: 'Work Order Created',
            description: `Successfully created work order ${newWorkOrder.id}.`,
        });
        resetForm();
        setOpen(false);
      }

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
                value="Will be auto-generated" 
                disabled
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} disabled={isSubmitting}/>
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
