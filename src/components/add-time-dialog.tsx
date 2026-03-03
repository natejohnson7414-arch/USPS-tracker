
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
import type { TimeEntry, Activity } from '@/lib/types';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';

const hourOptions = Array.from({ length: 25 }, (_, i) => i);
const minuteOptions = [0, 15, 30, 45];

type TimeEntryRow = {
  id: number;
  hours: number;
  minutes: number;
  timeType: 'Regular' | 'Overtime' | 'Double Time';
  description: string;
};

interface AddTimeDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  workOrderId: string;
  activity: Activity | null;
  onTimeEntriesSaved: () => void;
}

export function AddTimeDialog({ isOpen, setIsOpen, workOrderId, activity, onTimeEntriesSaved }: AddTimeDialogProps) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setDate(activity ? new Date(activity.scheduled_date) : new Date());
        setEntries([{ id: Date.now(), hours: 0, minutes: 0, timeType: 'Regular', description: '' }]);
    }
  }, [isOpen, activity]);

  const addEntryRow = () => {
    setEntries(prev => [...prev, { id: Date.now(), hours: 0, minutes: 0, timeType: 'Regular', description: '' }]);
  };

  const removeEntryRow = (id: number) => {
    setEntries(prev => prev.filter(entry => entry.id !== id));
  };
  
  const updateEntryRow = (id: number, field: keyof TimeEntryRow, value: string | number) => {
    setEntries(prev => prev.map(entry => entry.id === id ? { ...entry, [field]: value } : entry));
  };


  const handleSave = async () => {
    if (!db || !user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to add time.', variant: 'destructive' });
      return;
    }
    
    if (!date) {
        toast({ title: 'Missing Date', description: 'Please select a date.', variant: 'destructive' });
        return;
    }
    
    const validEntries = entries.filter(e => (e.hours + e.minutes / 60) > 0 && e.description);
    if(validEntries.length === 0) {
        toast({ title: 'No Valid Entries', description: 'Please fill out at least one time entry with a time and description.', variant: 'destructive' });
        return;
    }
    if (validEntries.length < entries.length) {
         toast({ title: 'Incomplete Entries', description: 'Some entries are missing a time or description and will not be saved.', variant: 'destructive' });
    }

    setIsSubmitting(true);
    
    try {
        const timeEntryPromises = validEntries.map(entry => {
            const totalHours = entry.hours + entry.minutes / 60;
            const timeEntryData: Omit<TimeEntry, 'id' | 'workOrder'> = {
                technicianId: user.uid,
                workOrderId: workOrderId,
                date: date.toISOString(),
                hours: totalHours,
                timeType: entry.timeType,
                notes: entry.description,
            };
            return addDocumentNonBlocking(collection(db, 'time_entries'), timeEntryData);
        });

        await Promise.all(timeEntryPromises);

        onTimeEntriesSaved();
        toast({ title: `${validEntries.length} time entries saved.` });
        setIsOpen(false);

    } catch (error) {
       // Handled by contextual error emitter in non-blocking utilities
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Time Posting(s)</DialogTitle>
          <DialogDescription>
            Log your hours for work order #{workOrderId}. 
            {activity && ` Activity Date: ${format(new Date(activity.scheduled_date), 'PPP')}`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="date">Date for all entries</Label>
            <DatePicker date={date} setDate={setDate} disabled={!!activity} />
          </div>
          <ScrollArea className="max-h-[40vh] pr-4">
              <div className="space-y-4">
                  {entries.map((entry, index) => (
                    <div key={entry.id} className="p-4 border rounded-lg space-y-3 relative">
                      {entries.length > 1 && (
                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeEntryRow(entry.id)}>
                            <Trash2 className="h-4 w-4"/>
                        </Button>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor={`hours-${entry.id}`}>Hours</Label>
                              <Select value={String(entry.hours)} onValueChange={(val) => updateEntryRow(entry.id, 'hours', Number(val))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>{hourOptions.map(h => <SelectItem key={h} value={String(h)}>{h} hr</SelectItem>)}</SelectContent>
                              </Select>
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor={`minutes-${entry.id}`}>Minutes</Label>
                              <Select value={String(entry.minutes)} onValueChange={(val) => updateEntryRow(entry.id, 'minutes', Number(val))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>{minuteOptions.map(m => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}</SelectContent>
                              </Select>
                          </div>
                           <div className="space-y-2">
                                <Label htmlFor={`timeType-${entry.id}`}>Time Type</Label>
                                <Select value={entry.timeType} onValueChange={v => updateEntryRow(entry.id, 'timeType', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Regular">Regular</SelectItem>
                                        <SelectItem value="Overtime">Overtime</SelectItem>
                                        <SelectItem value="Double Time">Double Time</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                      </div>
                       <div className="grid gap-2">
                        <Label htmlFor={`description-${entry.id}`}>Description of Work <span className="text-destructive">*</span></Label>
                        <Textarea
                            id={`description-${entry.id}`}
                            value={entry.description}
                            onChange={(e) => updateEntryRow(entry.id, 'description', e.target.value)}
                            placeholder="Describe the work you performed..."
                            required
                        />
                      </div>
                    </div>
                  ))}
              </div>
          </ScrollArea>
           <Button variant="outline" onClick={addEntryRow}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Another Entry
            </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Entries
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
