
'use client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from './ui/date-picker';
import type { TimeEntry } from '@/lib/types';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface AddTimeDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  workOrderId: string;
  onTimeAdded: (newTimeEntry: TimeEntry) => void;
}

export function AddTimeDialog({ isOpen, setIsOpen, workOrderId, onTimeAdded }: AddTimeDialogProps) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [hours, setHours] = useState<number | ''>('');
  const [timeType, setTimeType] = useState<'Regular' | 'Overtime' | 'Double Time'>('Regular');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setDate(new Date());
    setHours('');
    setTimeType('Regular');
  };

  const handleSave = async () => {
    if (!db || !user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to add time.', variant: 'destructive' });
      return;
    }
    if (!date || !hours || !timeType) {
      toast({ title: 'Missing Fields', description: 'Please fill out all fields.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const timeEntryData: Omit<TimeEntry, 'id' | 'workOrder'> = {
        technicianId: user.uid,
        workOrderId: workOrderId,
        date: date.toISOString(),
        hours: Number(hours),
        timeType: timeType,
      };
      
      const docRef = await addDocumentNonBlocking(collection(db, 'time_entries'), timeEntryData);
      
      onTimeAdded({ id: docRef.id, ...timeEntryData });
      toast({ title: 'Time Entry Added', description: `Successfully logged ${hours} hours.` });
      resetForm();
      setIsOpen(false);

    } catch (error) {
       if (error instanceof Error && !error.message.includes('permission-error')) {
            console.error("Error adding time entry:", error);
            toast({ title: 'Save Failed', description: 'Could not add time entry.', variant: 'destructive' });
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Time to Work Order</DialogTitle>
          <DialogDescription>
            Log your hours for work order #{workOrderId}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <DatePicker date={date} setDate={setDate} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hours">Hours</Label>
            <Input id="hours" type="number" value={hours} onChange={e => setHours(e.target.value === '' ? '' : parseFloat(e.target.value))} step="0.25" min="0" placeholder="e.g., 2.5" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="timeType">Time Type</Label>
            <Select value={timeType} onValueChange={value => setTimeType(value as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Regular">Regular</SelectItem>
                <SelectItem value="Overtime">Overtime</SelectItem>
                <SelectItem value="Double Time">Double Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
