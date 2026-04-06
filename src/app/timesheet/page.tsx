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
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, ChevronLeft, ChevronRight, Hash } from 'lucide-react';
import { useFirestore, useUser, addDocumentNonBlocking, deleteDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase/provider';
import { collection, query, where, doc } from 'firebase/firestore';
import type { TimeEntry, WorkOrder } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval, addDays, subDays } from 'date-fns';
import { getTimeEntriesByTechnician } from '@/lib/data';

const hourOptions = Array.from({ length: 25 }, (_, i) => i);
const minuteOptions = [0, 15, 30, 45];

export default function TimesheetPage() {
    const db = useFirestore();
    const { user, isUserLoading } = useUser();
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
    
    const [currentDate, setCurrentDate] = useState(new Date());

    const workOrdersQuery = useMemoFirebase(() => {
        if (!db || !user || isUserLoading) return null;
        return query(collection(db, 'work_orders'), where("status", "!=", "Completed"));
    }, [db, user, isUserLoading]);
    const { data: workOrders } = useCollection<WorkOrder>(workOrdersQuery);

    const fetchTimeEntries = async () => {
        if (!db || !user) return;
        setIsLoading(true);
        const entries = await getTimeEntriesByTechnician(db, user.uid);
        setTimeEntries(entries);
        setIsLoading(false);
    };

    useEffect(() => {
        if (db && user) {
            fetchTimeEntries();
        }
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
            fetchTimeEntries(); 

        } catch (error) {
             if (error instanceof Error && !error.message.startsWith('Missing or insufficient permissions:')) {
                console.error("Error saving time entry:", error);
                toast({ title: 'Save Failed', description: 'Could not save the time entry.', variant: 'destructive' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteEntry = async (entryId: string) => {
        if (!db) return;
        
        setTimeEntries(prev => prev.filter(entry => entry.id !== entryId));

        const entryRef = doc(db, 'time_entries', entryId);
        try {
            await deleteDocumentNonBlocking(entryRef);
            toast({ title: 'Entry Deleted' });
        } catch (error) {
            toast({ title: 'Delete Failed', variant: 'destructive' });
            fetchTimeEntries(); 
        }
    };

    const weekStartsOn = 1; // Monday
    const weekStart = startOfWeek(currentDate, { weekStartsOn });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn });

    const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
    const prevWeek = () => setCurrentDate(subDays(currentDate, 7));
    const goToCurrentWeek = () => setCurrentDate(new Date());

    const weeklyEntries = useMemo(() => {
        return timeEntries.filter(entry => {
            const entryDate = parseISO(entry.date);
            return isWithinInterval(entryDate, { start: weekStart, end: weekEnd });
        });
    }, [timeEntries, weekStart, weekEnd]);

    const weeklyTotalHours = useMemo(() => {
        return weeklyEntries.reduce((total, entry) => total + entry.hours, 0);
    }, [weeklyEntries]);
    
    const groupedEntries = useMemo(() => {
        return weeklyEntries.reduce((acc, entry) => {
            const entryDate = format(parseISO(entry.date), 'yyyy-MM-dd');
            if (!acc[entryDate]) {
                acc[entryDate] = [];
            }
            acc[entryDate].push(entry);
            return acc;
        }, {} as Record<string, TimeEntry[]>);
    }, [weeklyEntries]);


    return (
        <MainLayout>
            <div className="container mx-auto py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <CardTitle>My Timesheet</CardTitle>
                                        <CardDescription>A log of your productive and non-productive hours.</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="icon" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
                                        <Button variant="outline" onClick={goToCurrentWeek}>This Week</Button>
                                        <Button variant="outline" size="icon" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <p className="font-semibold text-lg">
                                        {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                                    </p>
                                    <p className="font-bold text-xl">
                                        Total: {weeklyTotalHours.toFixed(2)} hrs
                                    </p>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="text-center p-8">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                                        <p className="mt-2 text-muted-foreground">Loading time entries...</p>
                                    </div>
                                ) : Object.keys(groupedEntries).length > 0 ? (
                                    <div className="space-y-6">
                                        {Object.keys(groupedEntries).sort().reverse().map(date => (
                                            <div key={date}>
                                                <h3 className="text-lg font-semibold mb-2">{format(parseISO(date), 'EEEE, MMM d, yyyy')}</h3>
                                                <div className="border rounded-md">
                                                    {groupedEntries[date].map((entry, index) => (
                                                        <div key={entry.id} className={`flex items-center justify-between p-3 ${index < groupedEntries[date].length - 1 ? 'border-b' : ''}`}>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium flex items-center flex-wrap gap-2">
                                                                    {entry.workOrderId ? (
                                                                        <>
                                                                            <Badge variant="outline" className="font-mono text-[10px] uppercase font-bold shrink-0">
                                                                                <Hash className="h-2.5 w-2.5 mr-0.5" />
                                                                                {entry.workOrderId}
                                                                            </Badge>
                                                                            <span className="truncate">{entry.workOrder?.jobName || 'Work Order'}</span>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-muted-foreground italic">Non-Productive</span>
                                                                    )}
                                                                </div>
                                                                {entry.notes && <p className="text-sm text-muted-foreground mt-1 truncate">{entry.notes}</p>}
                                                            </div>
                                                            <div className="flex items-center gap-4 shrink-0 ml-4">
                                                                <div className="text-right">
                                                                    <p className="font-bold">{entry.hours.toFixed(2)} hrs</p>
                                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{entry.timeType}</p>
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
                                        <p>No time entries found for this week.</p>
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