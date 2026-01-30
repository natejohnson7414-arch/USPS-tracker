'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { useFirestore } from '@/firebase';
import { getAllActivitiesWithDetails, getTechnicians, getIncompleteWorkOrders, updateWorkOrderStatus } from '@/lib/data';
import type { Activity, Technician, WorkOrder } from '@/lib/types';
import { startOfWeek, addDays, format, isSameDay, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Search, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DndContext, PointerSensor, MouseSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useTechnician as useRole } from '@/hooks/use-technician';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const NON_PRODUCTIVE_WO_ID = 'WO-24-0001';

function TechnicianItem({ tech, techColorMap }: { tech: Technician, techColorMap: Map<string, string> }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `technician-${tech.id}`,
         data: {
            type: 'technician',
            technician: tech,
        }
    });
    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="flex items-center gap-3 p-2 rounded-md border cursor-grab bg-card touch-none">
            <div className={cn("h-4 w-4 rounded-full", techColorMap.get(tech.id))}></div>
            <span className="text-sm font-medium">{tech.name}</span>
        </div>
    );
}

function WorkOrderItem({ wo }: { wo: WorkOrder }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `workorder-${wo.id}`,
        data: {
            type: 'workorder',
            workOrder: wo,
        }
    });

    const isNonProductive = wo.id === NON_PRODUCTIVE_WO_ID;
    
    const content = (
        <div 
            ref={setNodeRef} 
            className={cn(
                "p-3 border rounded-lg bg-card transition-colors",
                isOver ? "bg-accent border-accent-foreground" : "hover:bg-muted/50",
                isNonProductive && "bg-muted border-dashed"
            )}
        >
            <p className="font-semibold">{wo.jobName}</p>
            <p className="text-sm text-muted-foreground">#{wo.id}</p>
            <p className="text-sm text-muted-foreground mt-1 truncate">{wo.description}</p>
        </div>
    );
    
    if (isNonProductive) {
        return content;
    }
    
    return (
        <Link href={`/work-orders/${wo.id}`} className="block">
            {content}
        </Link>
    )
}

function DraggableActivityItem({ activity, techColorMap }: { activity: Activity, techColorMap: Map<string, string> }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `activity-${activity.id}`,
        data: {
            type: 'activity',
            activity: activity,
        },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };
    
    const isNonProductive = activity.workOrderId === NON_PRODUCTIVE_WO_ID;
    
    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="w-full touch-none">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className={cn(
                            'p-1.5 text-xs text-white rounded cursor-grab shadow flex items-center', 
                            isNonProductive 
                                ? 'bg-slate-500' // A neutral color
                                : techColorMap.get(activity.technicianId) || 'bg-gray-400'
                        )}>
                             {isNonProductive && <Coffee className="h-3 w-3 mr-1.5 shrink-0" />}
                            <span className="truncate">{activity.technician?.name || 'Unassigned'}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                        <p className="font-bold">{activity.parentWorkOrder?.jobName}</p>
                        <p className="text-sm text-muted-foreground">{activity.parentWorkOrder?.workSite?.name || 'No Work Site'}</p>
                        <p className="mt-2">{activity.description}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}

function ScheduleActivityDialog({ 
    isOpen, 
    onOpenChange, 
    technician, 
    workOrder,
    onSubmit,
    isSubmitting
}: { 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void,
    technician: Technician | null,
    workOrder: WorkOrder | null,
    onSubmit: (data: { description: string, scheduledDate: Date }) => void,
    isSubmitting: boolean,
}) {
    const [description, setDescription] = useState('');
    const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
    
    useEffect(() => {
        if(isOpen) {
             if (workOrder?.id === NON_PRODUCTIVE_WO_ID) {
                setDescription('');
             } else {
                setDescription(`Schedule ${technician?.name} for job: ${workOrder?.jobName}`);
             }
            setScheduledDate(new Date());
        }
    }, [isOpen, technician, workOrder]);

    const handleSubmit = () => {
        if (description && scheduledDate) {
            onSubmit({ description, scheduledDate });
        }
    };

    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Schedule New Activity</DialogTitle>
                    <DialogDescription>
                        Assign <span className="font-semibold">{technician?.name}</span> to work order <span className="font-semibold">#{workOrder?.id}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="activity-description">Description</Label>
                        <Textarea id="activity-description" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="activity-date">Scheduled Date</Label>
                        <DatePicker date={scheduledDate} setDate={setScheduledDate} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Schedule
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const techColors = [
    'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 
    'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-rose-500',
    'bg-cyan-500', 'bg-lime-500'
];

function CalendarDay({ day, dayActivities, techColorMap, view, index, totalDays, isCurrentMonth }: { day: Date, dayActivities: Activity[], techColorMap: Map<string, string>, view: 'day' | 'week' | 'two-week' | 'month', index: number, totalDays: number, isCurrentMonth?: boolean }) {
    const dayKey = format(day, 'yyyy-MM-dd');
    const { setNodeRef, isOver } = useDroppable({
        id: dayKey,
        data: { type: 'day', date: day }
    });

    const isMonthView = view === 'month';

    return (
        <div className={cn(
            "flex flex-col flex-shrink-0",
            !isMonthView ? "w-[14.28%] min-w-[170px]" : "w-[14.28%]",
            (view === 'week' || view === 'two-week') && index < totalDays - 1 && "border-r",
            isMonthView && "border-b",
            isMonthView && (index + 1) % 7 !== 0 && "border-r",
            isMonthView && !isCurrentMonth && "bg-muted/40",
        )}>
            {!isMonthView && (
                 <div className="p-2 border-b text-center font-semibold bg-muted/25">
                    <p className="text-sm">{format(day, 'EEE')}</p>
                    <p className={cn("text-2xl", isToday(day) && "text-primary font-bold")}>{format(day, 'd')}</p>
                </div>
            )}
            {isMonthView && (
                 <div className="p-1 text-right">
                    <p className={cn(
                        "text-sm font-medium inline-block h-6 w-6 flex items-center justify-center",
                        isToday(day) && "bg-primary text-primary-foreground rounded-full",
                        !isCurrentMonth && !isToday(day) && "text-muted-foreground"
                    )}>
                        {format(day, 'd')}
                    </p>
                </div>
            )}
            <div ref={setNodeRef} className={cn("p-2 space-y-2 flex-grow min-h-[120px] overflow-hidden", isOver && "bg-accent")}>
                {dayActivities.map(activity => (
                    <DraggableActivityItem key={activity.id} activity={activity} techColorMap={techColorMap} />
                ))}
            </div>
        </div>
    );
}


export default function DispatchBoardPage() {
    const db = useFirestore();
    const { toast } = useToast();
    const { role, isLoading: isRoleLoading } = useRole();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<any>(null);

    const [view, setView] = useState<'week' | 'day' | 'two-week' | 'month'>('week');

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10, // Require mouse to move 10px before initiating drag
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250, // Require a 250ms press delay
                tolerance: 5, // Allow 5px of movement during the delay
            },
        }),
        useSensor(PointerSensor)
    );

    useEffect(() => {
        if (!db || isRoleLoading) return;
        
        async function fetchData() {
            setIsLoading(true);
            try {
                const activitiesPromise = getAllActivitiesWithDetails(db);
                const techniciansPromise = getTechnicians(db);
                
                if (role?.name !== 'Technician') {
                    const workOrdersPromise = getIncompleteWorkOrders(db);
                    const [fetchedActivities, fetchedTechnicians, fetchedWorkOrders] = await Promise.all([activitiesPromise, techniciansPromise, workOrdersPromise]);
                    setActivities(fetchedActivities);
                    setTechnicians(fetchedTechnicians);
                    
                    const sortedWorkOrders = fetchedWorkOrders.sort((a, b) => {
                        if (a.id === NON_PRODUCTIVE_WO_ID) return -1;
                        if (b.id === NON_PRODUCTIVE_WO_ID) return 1;
                        return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
                    });

                    setWorkOrders(sortedWorkOrders);
                } else {
                    const [fetchedActivities, fetchedTechnicians] = await Promise.all([activitiesPromise, techniciansPromise]);
                    setActivities(fetchedActivities);
                    setTechnicians(fetchedTechnicians);
                    setWorkOrders([]);
                }
            } catch (err) {
                 console.error("Failed to fetch dispatch data:", err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [db, role, isRoleLoading]);

    const techColorMap = useMemo(() => {
        const map = new Map<string, string>();
        technicians.forEach((tech, index) => {
            map.set(tech.id, techColors[index % techColors.length]);
        });
        return map;
    }, [technicians]);
    
    const calendarDays = useMemo(() => {
        const weekStartsOn = 1; // Monday
        let start;
        switch (view) {
            case 'day':
                return [currentDate];
            case 'week':
                start = startOfWeek(currentDate, { weekStartsOn });
                return Array.from({ length: 7 }, (_, i) => addDays(start, i));
            case 'two-week':
                start = startOfWeek(currentDate, { weekStartsOn });
                return Array.from({ length: 14 }, (_, i) => addDays(start, i));
            case 'month':
                const monthStart = startOfMonth(currentDate);
                const calendarStart = startOfWeek(monthStart, { weekStartsOn });
                const monthEnd = endOfMonth(currentDate);
                const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });
                return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
            default:
                start = startOfWeek(currentDate, { weekStartsOn });
                return Array.from({ length: 7 }, (_, i) => addDays(start, i));
        }
    }, [currentDate, view]);
    
    const handlePrev = () => {
        switch (view) {
            case 'day':
                setCurrentDate(subDays(currentDate, 1));
                break;
            case 'week':
                setCurrentDate(subWeeks(currentDate, 1));
                break;
            case 'two-week':
                setCurrentDate(subWeeks(currentDate, 2));
                break;
            case 'month':
                setCurrentDate(subMonths(currentDate, 1));
                break;
        }
    }
    const handleNext = () => {
        switch (view) {
            case 'day':
                setCurrentDate(addDays(currentDate, 1));
                break;
            case 'week':
                setCurrentDate(addWeeks(currentDate, 1));
                break;
            case 'two-week':
                setCurrentDate(addWeeks(currentDate, 2));
                break;
            case 'month':
                setCurrentDate(addMonths(currentDate, 1));
                break;
        }
    }
    const goToToday = () => setCurrentDate(new Date());

    const activitiesByDay = useMemo(() => {
        const grouped = new Map<string, Activity[]>();
        activities.forEach(activity => {
            if (activity.status === 'cancelled') {
                return; // Skip cancelled activities
            }
            const dateStr = format(new Date(activity.scheduled_date), 'yyyy-MM-dd');
            if (!grouped.has(dateStr)) {
                grouped.set(dateStr, []);
            }
            grouped.get(dateStr)?.push(activity);
        });
        return grouped;
    }, [activities]);

    const filteredWorkOrders = useMemo(() => {
        if (!workOrders) return [];
        return workOrders.filter(wo =>
            wo.jobName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            wo.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            wo.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [workOrders, searchTerm]);
    
    function handleDragStart(event: any) {
        setActiveId(event.active.id);
        setActiveDragItem(event.active.data.current ?? null);
    }
    
     async function handleActivityDateChange(activity: Activity, newDate: Date) {
        if (!db) return;

        // Preserve the time part of the original scheduled_date.
        const originalDate = new Date(activity.scheduled_date);
        const timePart = format(originalDate, 'HH:mm:ss.SSS');
        const newDateStr = format(newDate, 'yyyy-MM-dd');
        const newDateTime = new Date(`${newDateStr}T${timePart}`);

        const activityRef = doc(db, 'work_orders', activity.workOrderId, 'activities', activity.id);
        
        const originalActivities = activities;
        const updatedActivities = activities.map(a => 
            a.id === activity.id ? { ...a, scheduled_date: newDateTime.toISOString() } : a
        );
        setActivities(updatedActivities);

        try {
            await updateDocumentNonBlocking(activityRef, { scheduled_date: newDateTime.toISOString() });
            toast({ title: 'Activity Rescheduled', description: `Moved to ${format(newDateTime, 'MMM d, yyyy')}.` });
        } catch (error) {
            console.error("Error rescheduling activity:", error);
            toast({ title: 'Error', description: 'Failed to reschedule activity.', variant: 'destructive' });
            setActivities(originalActivities);
        }
    }


    function handleDragEnd(event: any) {
        const { over, active } = event;
        setActiveId(null);
        setActiveDragItem(null);

        if (over) {
            if (active.data.current?.type === 'activity' && over.data.current?.type === 'day') {
                const activity = active.data.current.activity as Activity;
                const newDate = over.data.current.date as Date;
                if (!isSameDay(new Date(activity.scheduled_date), newDate)) {
                    handleActivityDateChange(activity, newDate);
                }
            } else if (active.data.current?.type === 'technician' && over.data.current?.type === 'workorder') {
                const technician = active.data.current.technician as Technician;
                const workOrder = over.data.current.workOrder as WorkOrder;

                if (technician && workOrder) {
                    setSelectedTechnician(technician);
                    setSelectedWorkOrder(workOrder);
                    setIsScheduleModalOpen(true);
                }
            }
        }
    }

    async function handleScheduleActivity(data: { description: string, scheduledDate: Date }) {
        if (!db || !selectedTechnician || !selectedWorkOrder) return;

        setIsSubmitting(true);

        try {
            const activityData = {
                description: data.description,
                scheduled_date: data.scheduledDate.toISOString(),
                technicianId: selectedTechnician.id,
                workOrderId: selectedWorkOrder.id,
                createdDate: new Date().toISOString(),
                status: 'scheduled' as const,
            };

            const activitiesColRef = collection(db, 'work_orders', selectedWorkOrder.id, 'activities');
            const newDoc = await addDocumentNonBlocking(activitiesColRef, activityData);

            const newActivity: Activity = {
                ...activityData,
                id: newDoc.id,
                technician: selectedTechnician,
                parentWorkOrder: {
                    id: selectedWorkOrder.id,
                    jobName: selectedWorkOrder.jobName,
                    workSite: workOrders.find(wo => wo.id === selectedWorkOrder.id)?.workSite
                }
            };
            setActivities(prev => [...prev, newActivity]);

            await updateWorkOrderStatus(db, selectedWorkOrder.id);
            
            toast({ title: 'Activity Scheduled Successfully' });
            
            const incompleteOrders = await getIncompleteWorkOrders(db);
            const sortedOrders = incompleteOrders.sort((a, b) => {
                if (a.id === NON_PRODUCTIVE_WO_ID) return -1;
                if (b.id === NON_PRODUCTIVE_WO_ID) return 1;
                return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
            });
            setWorkOrders(sortedOrders);

        } catch (error) {
            if (error instanceof Error && !error.message.includes('permission-error')) {
                console.error("Error scheduling activity:", error);
                toast({ title: 'Error', description: 'Failed to schedule activity', variant: 'destructive' });
            }
        } finally {
            setIsSubmitting(false);
            setIsScheduleModalOpen(false);
        }
    }

    const headerDateDisplay = useMemo(() => {
        const weekStartsOn = 1; // Monday
        if (view === 'day') {
            return format(currentDate, 'MMMM d, yyyy');
        }
        if (view === 'month') {
            return format(currentDate, 'MMMM yyyy');
        }
        
        let start, end;
        if (view === 'week') {
            start = startOfWeek(currentDate, { weekStartsOn });
            end = addDays(start, 6);
        } else { // two-week
            start = startOfWeek(currentDate, { weekStartsOn });
            end = addDays(start, 13);
        }
        
        if (start.getMonth() === end.getMonth()) {
            return `${format(start, 'MMMM d')} - ${format(end, 'd, yyyy')}`;
        }
        if (start.getFullYear() === end.getFullYear()) {
            return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
        }
        return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;

    }, [currentDate, view]);

    if (isLoading || isRoleLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="ml-4">Loading Dispatch Board...</p>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="container mx-auto py-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                        <h1 className="text-3xl font-bold tracking-tight">Dispatch Board</h1>
                        <div className="flex items-center gap-2">
                             <Select value={view} onValueChange={(v) => setView(v as any)}>
                                <SelectTrigger className="w-[130px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">Day</SelectItem>
                                    <SelectItem value="week">Week</SelectItem>
                                    <SelectItem value="two-week">Two Week</SelectItem>
                                    <SelectItem value="month">Month</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
                            <Button variant="outline" onClick={goToToday}>Today</Button>
                            <Button variant="outline" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
                             <div className="hidden sm:block ml-4 font-semibold text-lg">
                                {headerDateDisplay}
                            </div>
                        </div>
                    </div>
                    {view === 'month' && (
                        <div className="flex rounded-t-lg border-l border-r border-t bg-muted/25">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="w-[14.28%] p-2 text-center font-semibold text-sm text-muted-foreground">{day}</div>
                            ))}
                        </div>
                    )}
                    
                    {view === 'two-week' ? (
                        <div className="space-y-2 pb-4">
                            <div className="overflow-x-auto">
                                <div className="flex rounded-lg border">
                                    {calendarDays.slice(0, 7).map((day, index) => {
                                        const dayKey = format(day, 'yyyy-MM-dd');
                                        const dayActivities = activitiesByDay.get(dayKey) || [];
                                        return (
                                            <CalendarDay
                                                key={dayKey}
                                                day={day}
                                                dayActivities={dayActivities}
                                                techColorMap={techColorMap}
                                                view={view}
                                                index={index}
                                                totalDays={7}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <div className="flex rounded-lg border">
                                    {calendarDays.slice(7, 14).map((day, index) => {
                                        const dayKey = format(day, 'yyyy-MM-dd');
                                        const dayActivities = activitiesByDay.get(dayKey) || [];
                                        return (
                                            <CalendarDay
                                                key={dayKey}
                                                day={day}
                                                dayActivities={dayActivities}
                                                techColorMap={techColorMap}
                                                view={view}
                                                index={index}
                                                totalDays={7}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={cn(view !== 'month' ? "overflow-x-auto" : "", "pb-4")}>
                            <div className={cn(
                                "flex rounded-lg border", 
                                view === 'month' && "flex-wrap rounded-t-none border-t-0"
                            )}>
                                {calendarDays.map((day, index) => {
                                    const dayKey = format(day, 'yyyy-MM-dd');
                                    const dayActivities = activitiesByDay.get(dayKey) || [];
                                    const isCurrentMonth = view === 'month' ? day.getMonth() === currentDate.getMonth() : undefined;

                                    return (
                                        <CalendarDay
                                            key={dayKey}
                                            day={day}
                                            dayActivities={dayActivities}
                                            techColorMap={techColorMap}
                                            view={view}
                                            index={index}
                                            totalDays={calendarDays.length}
                                            isCurrentMonth={isCurrentMonth}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    {role?.name !== 'Technician' && (
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Technician Key</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col gap-3">
                                            {technicians.map(tech => (
                                                <TechnicianItem key={tech.id} tech={tech} techColorMap={techColorMap} />
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            <div>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Incomplete Work Orders</CardTitle>
                                        <div className="relative mt-4">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by ID, name, or description..."
                                                className="pl-8 w-full"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <ScrollArea className="h-[450px]">
                                            <div className="space-y-3">
                                            {filteredWorkOrders.length > 0 ? filteredWorkOrders.map(wo => (
                                                <WorkOrderItem key={wo.id} wo={wo} />
                                            )) : (
                                                <div className="text-center py-10 text-muted-foreground">
                                                    <p>No matching work orders found.</p>
                                                </div>
                                            )}
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
                 <DragOverlay>
                    {activeId && activeDragItem?.type === 'activity' ? (
                        <div className={cn('p-1.5 text-xs text-white rounded cursor-grabbing shadow-lg truncate', techColorMap.get(activeDragItem.activity.technicianId) || 'bg-gray-400')}>
                            {activeDragItem.activity.technician?.name || 'Unassigned'}
                        </div>
                    ) : activeId && activeDragItem?.type === 'technician' ? (
                        <div className="flex items-center gap-3 p-2 rounded-md border cursor-grabbing bg-card shadow-lg">
                             <div className={cn("h-4 w-4 rounded-full", techColorMap.get(activeDragItem.technician.id))}></div>
                            <span className="text-sm font-medium">{activeDragItem.technician.name}</span>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
            <ScheduleActivityDialog
                isOpen={isScheduleModalOpen}
                onOpenChange={setIsScheduleModalOpen}
                technician={selectedTechnician}
                workOrder={selectedWorkOrder}
                onSubmit={handleScheduleActivity}
                isSubmitting={isSubmitting}
            />
        </MainLayout>
    );
}
