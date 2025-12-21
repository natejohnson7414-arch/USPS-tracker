
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
import { useFirestore, useUser, setDocumentNonBlocking, getDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { format } from 'date-fns';

interface CreateWorkOrderDialogProps {
  technicians: Technician[];
  onWorkOrderAdded: (newOrder: WorkOrder) => void;
}

export function CreateWorkOrderDialog({ technicians, onWorkOrderAdded }: CreateWorkOrderDialogProps) {
  const db = useFirestore();
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<WorkOrder['priority'] | undefined>();
  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [workOrderId, setWorkOrderId] = useState('');
  const [isLoadingId, setIsLoadingId] = useState(false);
  const { toast } = useToast();

  const isAdmin = user?.email === 'admin@crawford-company.com';

  const getNextWorkOrderId = async () => {
    if (!db) return '';
    const year = format(new Date(), 'yy');
    const counterRef = doc(db, 'counters', `work_orders_${year}`);

    try {
      const newNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextNumber = 1;
        if (counterDoc.exists()) {
          nextNumber = counterDoc.data().lastNumber + 1;
        }
        transaction.set(counterRef, { lastNumber: nextNumber }, { merge: true });
        return nextNumber;
      });
      return `WO-${year}-${String(newNumber).padStart(4, '0')}`;
    } catch (error) {
      console.error("Error getting next work order ID: ", error);
      toast({
        title: 'Error',
        description: 'Could not generate a new Work Order ID. Please try again.',
        variant: 'destructive',
      });
      return '';
    }
  };

  useEffect(() => {
    if (open && !workOrderId) {
      setIsLoadingId(true);
      getNextWorkOrderId().then(id => {
        setWorkOrderId(id);
        setIsLoadingId(false);
      });
    } else if (!open) {
      // Reset when dialog is closed
      setWorkOrderId('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title || !description || !priority || !dueDate || !workOrderId) {
      toast({
        title: 'Missing Information',
        description: 'Please fill out all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const workOrderRef = doc(db, 'work_orders', workOrderId);

    // Check for duplicates if admin edits the ID
    if (isAdmin) {
        const docSnap = await getDocumentNonBlocking(workOrderRef);
        if (docSnap.exists()) {
            toast({
                title: 'Duplicate ID',
                description: `Work Order ID ${workOrderId} already exists. Please use a different ID.`,
                variant: 'destructive',
            });
            return;
        }
    }


    const newWorkOrderData = {
      id: workOrderId,
      title,
      description,
      priority,
      status: 'Open',
      assignedTechnicianId: assignedTechnicianId || null,
      createdAt: new Date().toISOString(),
      dueDate: dueDate.toISOString(),
    };

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
    setWorkOrderId('');
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
            <Label htmlFor="workOrderId">Work Order ID</Label>
            <Input 
                id="workOrderId" 
                value={isLoadingId ? 'Generating...' : workOrderId} 
                onChange={e => setWorkOrderId(e.target.value)} 
                disabled={!isAdmin || isLoadingId}
            />
          </div>
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

    