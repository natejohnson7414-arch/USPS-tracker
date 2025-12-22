
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { Technician, WorkOrder } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';

interface WorkOrderEditDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  workOrder: WorkOrder;
  technicians: Technician[];
  onWorkOrderUpdated: (updatedData: Partial<WorkOrder>) => void;
}

export function WorkOrderEditDialog({ isOpen, setIsOpen, workOrder, technicians, onWorkOrderUpdated }: WorkOrderEditDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkOrder['priority']>('Medium');
  const [status, setStatus] = useState<WorkOrder['status']>('Open');
  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string | undefined>('');
  const [dueDate, setDueDate] = useState<Date | undefined>();

  useEffect(() => {
    if (workOrder && isOpen) {
      setTitle(workOrder.title);
      setDescription(workOrder.description);
      setPriority(workOrder.priority);
      setStatus(workOrder.status);
      setAssignedTechnicianId(workOrder.assignedTechnicianId);
      setDueDate(workOrder.dueDate ? new Date(workOrder.dueDate) : undefined);
    }
  }, [workOrder, isOpen]);

  const handleSubmit = async () => {
    if (!db) return;
    if (!title || !description || !priority || !dueDate) {
      toast({
        title: 'Missing Information',
        description: 'Please fill out all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const workOrderRef = doc(db, 'work_orders', workOrder.id);
    
    const updatedData = {
      title,
      description,
      priority,
      status,
      assignedTechnicianId: assignedTechnicianId || null,
      dueDate: dueDate.toISOString(),
    };

    setDocumentNonBlocking(workOrderRef, updatedData, { merge: true });

    onWorkOrderUpdated(updatedData);

    toast({
        title: 'Work Order Updated',
        description: `Successfully updated work order ${workOrder.id}.`,
    });

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Work Order</DialogTitle>
          <DialogDescription>Update the details for work order {workOrder.id}.</DialogDescription>
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
            <Select value={priority} onValueChange={value => setPriority(value as WorkOrder['priority'])}>
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
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={value => setStatus(value as WorkOrder['status'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <div className="sm:col-span-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <DatePicker date={dueDate} setDate={setDueDate} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="technician">Assign To</Label>
            <Select value={assignedTechnicianId} onValueChange={setAssignedTechnicianId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a technician" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="unassigned">Unassigned</SelectItem>
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
          <Button onClick={() => setIsOpen(false)} variant="outline">Cancel</Button>
          <Button onClick={handleSubmit}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
