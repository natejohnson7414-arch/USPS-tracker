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

interface CreateWorkOrderDialogProps {
  technicians: Technician[];
  onWorkOrderAdded: (newOrder: WorkOrder) => void;
}

export function CreateWorkOrderDialog({ technicians, onWorkOrderAdded }: CreateWorkOrderDialogProps) {
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

    const newWorkOrder: WorkOrder = {
      id: `WO-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`,
      title,
      description,
      priority,
      status: 'Open',
      assignedTechnicianId,
      createdAt: new Date().toISOString(),
      dueDate: dueDate.toISOString(),
      notes: [],
    };
    
    onWorkOrderAdded(newWorkOrder);
    toast({
        title: 'Work Order Created',
        description: `Successfully created work order ${newWorkOrder.id}.`,
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Work Order</DialogTitle>
          <DialogDescription>Fill in the details below to create a new work order.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right pt-2">
              Description
            </Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="priority" className="text-right">
              Priority
            </Label>
            <Select onValueChange={value => setPriority(value as WorkOrder['priority'])}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="technician" className="text-right">
              Assign To
            </Label>
            <Select onValueChange={setAssignedTechnicianId}>
              <SelectTrigger className="col-span-3">
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="dueDate" className="text-right">
              Due Date
            </Label>
            <DatePicker date={dueDate} setDate={setDueDate} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>Create Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
