
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
import { Textarea } from './ui/textarea';
import type { TimeEntry } from '@/lib/types';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useTechnician } from '@/hooks/use-technician';

const hourOptions = Array.from({ length: 25 }, (_, i) => i);
const minuteOptions = [0, 15, 30, 45];

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
  const [selectedHours, setSelectedHours] = useState(0);
  const [selectedMinutes, setSelectedMinutes] = useState(0);
  const [timeType, setTimeType] = useState<'Regular' | 'Overtime' | 'Double Time'>('Regular');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setDate(new Date());
    setSelectedHours(0);
    setSelectedMinutes(0);
    setTimeType('Regular');
    setDescription('');
  };

  const handleSave = async () => {
    if (!db || !user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to add time.', variant: 'destructive' });
      return;
    }
    
    const totalHours = selectedHours + selectedMinutes / 60;

    if (!date || totalHours <= 0 || !timeType || !description) {
      toast({ title: 'Missing Fields', description: 'Please fill out all fields, including the description.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const timeEntryData: Omit<TimeEntry, 'id' | 'workOrder'> = {
        technicianId: user.uid,
        workOrderId: workOrderId,
        date: date.toISOString(),
        hours: totalHours,
        timeType: timeType,
        notes: description,
      };
      
      const docRef = await addDocumentNonBlocking(collection(db, 'time_entries'), timeEntryData);
      
      onTimeAdded({ 
          id: docRef.id, 
          ...timeEntryData,
          technicianName: user.displayName || user.email || 'Unknown User',
      });
      toast({ title: 'Time Entry Added', description: `Successfully logged ${totalHours.toFixed(2)} hours.` });
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
          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <Label htmlFor="hours">Hours</Label>
                  <Select value={selectedHours.toString()} onValueChange={(val) => setSelectedHours(parseInt(val, 10))}>
                      <SelectTrigger>
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          {hourOptions.map(hour => (
                              <SelectItem key={hour} value={hour.toString()}>{hour} hr</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="minutes">Minutes</Label>
                  <Select value={selectedMinutes.toString()} onValueChange={(val) => setSelectedMinutes(parseInt(val, 10))}>
                      <SelectTrigger>
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          {minuteOptions.map(min => (
                              <SelectItem key={min} value={min.toString()}>{min} min</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
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
           <div className="grid gap-2">
            <Label htmlFor="description">Description of Work</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work you performed..."
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
