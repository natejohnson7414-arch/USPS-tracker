
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
import { PlusCircle } from 'lucide-react';
import type { Technician, WorkOrder } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';

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
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!title || !description || !priority || !dueDate) {
      toast({
        title: 'Missing Information',
        description: 'Please fill out all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const newId = `WO-${Date.now()}`;
    
    const newWorkOrderData = {
      id: newId,
      title,
      description,
      priority,
      status: 'Open',
      assignedTechnicianId: assignedTechnicianId || null,
      createdAt: new Date().toISOString(),
      dueDate: dueDate.toISOString(),
    };

    const workOrderRef = doc(collection(db, 'work_orders'), newId);
    setDocumentNonBlocking(workOrderRef, newWorkOrderData, { merge: false });
    
    const optimisticWorkOrder: WorkOrder = {
        ...newWorkOrderData,
        notes: [],
        assignedTechnicianId: assignedTechnicianId,
    }

    onWorkOrderAdded(optimisticWorkOrder);
    toast({
        title: 'Work Order Created',
        description: `Successfully created work order ${newWorkOrderData.id}.`,
    });

    // Reset form and close dialog
    setTitle('');
    setDescription('');
    setPriority(undefined);
    setAssignedTechnicianId(undefined);
    setDueDate(undefined);
    setOpen(false);
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
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select onValueChange={value => setPriority(value as WorkOrder['priority'])}>
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
            <Select onValueChange={setAssignedTechnicianId}>
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
          <Button onClick={() => setOpen(false)} variant="outline">Cancel</Button>
          <Button onClick={handleSubmit}>Create Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
