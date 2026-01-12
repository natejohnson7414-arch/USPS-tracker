
'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useFirestore, useUser, addDocumentNonBlocking, deleteDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { TimeEntry, WorkOrder } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { getTimeEntriesByTechnician } from '@/lib/data';

const hourOptions = Array.from({ length: 25 }, (_, i) => i);
const minuteOptions = [0, 15, 30, 45];

export default function TimesheetPage() {
    const db = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [selectedHours, setSelectedHours] = useState(0);
    const [selectedMinutes, setSelectedMinutes] = useState(0);
    const [timeType, setTimeType] = useState<'Regular' | 'Overtime' | 'Double Time'>('Regular');
    const [workOrderId, setWorkOrderId] = useState<string | null>('non-productive');
    const [notes, setNotes] = useState('');

    const workOrdersQuery = useMemoFirebase(() => db ? query(collection(db, 'work_orders'), where("status", "!=", "Completed")) : null, [db]);
    const { data: workOrders } = useCollection<WorkOrder>(workOrdersQuery);

    const fetchTimeEntries = async () => {
        if (!db || !user) return;
        setIsLoading(true);
        const entries = await getTimeEntriesByTechnician(db, user.uid);
        setTimeEntries(entries);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchTimeEntries();
    }, [db, user]);

    const resetForm = () => {
        setDate(new Date());
        setSelectedHours(0);
        setSelectedMinutes(0);
        setTimeType('Regular');
        setWorkOrderId('non-productive');
        setNotes('');
    };

    const handleSaveTime = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !user) {
            toast({ title: 'Authentication Error', description: 'You must be logged in.', variant: 'destructive' });
            return;
        }

        const totalHours = selectedHours + selectedMinutes / 60;

        if (!date || totalHours <= 0 || !timeType || (workOrderId === null) ) {
            toast({ title: 'Missing Fields', description: 'Please fill out all fields and ensure time is greater than 0.', variant: 'destructive' });
            return;
        }
        if (workOrderId === 'non-productive' && !notes) {
            toast({ title: 'Missing Notes', description: 'Notes are required for non-productive time.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);

        try {
            const timeEntryData: Omit<TimeEntry, 'id' | 'workOrder'> = {
                technicianId: user.uid,
                workOrderId: workOrderId === 'non-productive' ? null : workOrderId,
                date: date.toISOString(),
                hours: totalHours,
                timeType: timeType,
                notes: workOrderId === 'non-productive' ? notes : undefined,
            };

            await addDocumentNonBlocking(collection(db, 'time_entries'), timeEntryData);
            
            toast({ title: 'Time Entry Saved' });
            resetForm();
            fetchTimeEntries(); // Refresh the list

        } catch (error) {
             if (error instanceof Error && !error.message.includes('permission-error')) {
                console.error("Error saving time entry:", error);
                toast({ title: 'Save Failed', description: 'Could not save the time entry.', variant: 'destructive' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteEntry = async (entryId: string) => {
        if (!db) return;
        
        // Optimistic update
        setTimeEntries(prev => prev.filter(entry => entry.id !== entryId));

        const entryRef = doc(db, 'time_entries', entryId);
        try {
            await deleteDocumentNonBlocking(entryRef);
            toast({ title: 'Entry Deleted' });
        } catch (error) {
            toast({ title: 'Delete Failed', variant: 'destructive' });
            fetchTimeEntries(); // Re-fetch to revert optimistic update
        }
    };
    
    const groupedEntries = useMemo(() => {
        return timeEntries.reduce((acc, entry) => {
            const entryDate = format(parseISO(entry.date), 'yyyy-MM-dd');
            if (!acc[entryDate]) {
                acc[entryDate] = [];
            }
            acc[entryDate].push(entry);
            return acc;
        }, {} as Record<string, TimeEntry[]>);
    }, [timeEntries]);


    return (
        <MainLayout>
            <div className="container mx-auto py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>My Timesheet</CardTitle>
                                <CardDescription>A log of your productive and non-productive hours.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="text-center p-8">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                                        <p className="mt-2 text-muted-foreground">Loading time entries...</p>
                                    </div>
                                ) : Object.keys(groupedEntries).length > 0 ? (
                                    <div className="space-y-6">
                                        {Object.entries(groupedEntries).map(([date, entries]) => (
                                            <div key={date}>
                                                <h3 className="text-lg font-semibold mb-2">{format(parseISO(date), 'EEEE, MMM d, yyyy')}</h3>
                                                <div className="border rounded-md">
                                                    {entries.map((entry, index) => (
                                                        <div key={entry.id} className={`flex items-center justify-between p-3 ${index < entries.length - 1 ? 'border-b' : ''}`}>
                                                            <div>
                                                                <p className="font-medium">
                                                                    {entry.workOrderId ? (
                                                                        <span>{entry.workOrder?.jobName || `Job #${entry.workOrderId}`}</span>
                                                                    ) : (
                                                                        <span className="text-gray-500">Non-Productive</span>
                                                                    )}
                                                                </p>
                                                                {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className="text-right">
                                                                    <p className="font-bold">{entry.hours.toFixed(2)} hrs</p>
                                                                    <p className="text-xs text-muted-foreground">{entry.timeType}</p>
                                                                </div>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteEntry(entry.id)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center p-8 text-muted-foreground">
                                        <p>No time entries found.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div>
                        <form onSubmit={handleSaveTime}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Add New Time Entry</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="workOrder">Job / Task</Label>
                                        <Select value={workOrderId || 'non-productive'} onValueChange={setWorkOrderId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a job or non-productive" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="non-productive">Non-Productive</SelectItem>
                                                <Separator />
                                                {workOrders?.map(wo => (
                                                    <SelectItem key={wo.id} value={wo.id}>{wo.id} - {wo.jobName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                     <div className="space-y-2">
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
                                    <div className="space-y-2">
                                        <Label htmlFor="timeType">Time Type</Label>
                                         <Select value={timeType} onValueChange={(v) => setTimeType(v as any)}>
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
                                    {workOrderId === 'non-productive' && (
                                         <div className="space-y-2">
                                            <Label htmlFor="notes">Notes (Required)</Label>
                                            <Input id="notes" value={notes} onChange={e => setNotes(e.target.value)} required />
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter>
                                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Entry
                                    </Button>
                                </CardFooter>
                            </Card>
                        </form>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
