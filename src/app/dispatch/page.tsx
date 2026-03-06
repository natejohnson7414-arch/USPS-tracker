
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import { getAllActivitiesWithDetails, getTechnicians, updateWorkOrderStatus, getWorkSites, getClients } from '@/lib/data';
import type { Activity, Technician, WorkOrder, WorkSite, Client } from '@/lib/types';
import { startOfWeek, addDays, format, isSameDay, subDays, addWeeks, subWeeks, isToday, getMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Search, Coffee, X, Pin } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useTechnician as useRole } from '@/hooks/use-technician';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

const NON_PRODUCTIVE_WO_ID = '24-0001';

function TechnicianItem({ tech, techColorMap, isMultiSelect, isSelected, onToggleSelect }: { tech: Technician, techColorMap: Map<string, string>, isMultiSelect: boolean, isSelected: boolean, onToggleSelect: (id: string) => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `technician-${tech.id}`,
         data: {
            type: 'technician',
            technician: tech,
        },
        disabled: isMultiSelect
    });
    const style = {
        transform: isMultiSelect ? undefined : CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div 
            ref={isMultiSelect ? undefined : setNodeRef}
            style={style}
            {...(isMultiSelect ? {} : listeners)}
            {...(isMultiSelect ? {} : attributes)}
            onClick={isMultiSelect ? () => onToggleSelect(tech.id) : undefined}
            className={cn("flex items-center gap-3 p-2 rounded-md border touch-none", 
                isMultiSelect ? "cursor-pointer hover:bg-muted" : "cursor-grab bg-card",
                isSelected && isMultiSelect && "ring-2 ring-primary bg-accent text-accent-foreground"
            )}
        >
            {isMultiSelect && <Checkbox checked={isSelected} readOnly className="mr-2" />}
            <div className={cn("h-4 w-4 rounded-full", techColorMap.get(tech.id))}></div>
            <span className="text-sm font-medium">{tech.name}</span>
        </div>
    );
}

function DraggableTechnicianGroup({ selectedTechnicians }: { selectedTechnicians: Technician[] }) {
    const { attributes, listeners, setNodeRef } = useDraggable({
        id: 'technician-group',
        data: {
            type: 'technician-group',
            technicians: selectedTechnicians,
        }
    });

    if (selectedTechnicians.length === 0) return null;
    
    return (
         <div ref={setNodeRef} {...listeners} {...attributes} className="flex items-center justify-center gap-3 p-2 my-2 rounded-md border-2 border-primary cursor-grab bg-primary/10 touch-none">
            <span className="text-sm font-medium text-primary">Drag {selectedTechnicians.length} Technicians</span>
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
    
    const activityContent = (
        <div className={cn(
            'p-1.5 text-xs text-white rounded cursor-grab shadow flex items-center', 
            isNonProductive 
                ? 'bg-slate-500' // A neutral color
                : techColorMap.get(activity.technicianId) || 'bg-gray-400'
        )}>
             {isNonProductive && <Coffee className="h-3 w-3 mr-1.5 shrink-0" />}
            <span className="truncate">{activity.technician?.name || 'Unassigned'}</span>
        </div>
    );

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="w-full touch-none">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                       {isNonProductive ? (
                           activityContent
                       ) : (
                           <Link href={`/work-orders/${activity.workOrderId}`} className="block">
                                {activityContent}
                           </Link>
                       )}
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                        <p className="font-bold">{activity.parentWorkOrder?.jobName}</p>
                        <p className="text-sm text-muted-foreground">#{activity.workOrderId}</p>
                        <p className="text-sm text-muted-foreground mt-1">{activity.parentWorkOrder?.workSite?.name || 'No Work Site'}</p>
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
    technicians, 
    workOrder,
    onSubmit,
    isSubmitting
}: { 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void,
    technicians: Technician[] | null,
    workOrder: WorkOrder | null,
    onSubmit: (data: { description: string, scheduledDates: Date[] }) => void,
    isSubmitting: boolean,
}) {
    const [description, setDescription] = useState('');
    const [scheduledDates, setScheduledDates] = useState<Date[]>([]);
    
    useEffect(() => {
        if(isOpen && technicians && technicians.length > 0) {
             const techNames = technicians.map(t => t.name).join(', ');
             if (workOrder?.id === NON_PRODUCTIVE_WO_ID) {
                setDescription('');
             } else {
                setDescription(`Schedule ${techNames} for job: ${workOrder?.jobName}`);
             }
            setScheduledDates([new Date()]);
        }
    }, [isOpen, technicians, workOrder]);

    const handleSubmit = () => {
        if (description && scheduledDates && scheduledDates.length > 0) {
            onSubmit({ description, scheduledDates });
        }
    };

    const removeDate = (dateToRemove: Date) => {
        setScheduledDates(prev => prev.filter(d => !isSameDay(d, dateToRemove)));
    };

    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Schedule Multiple Activities</DialogTitle>
                    <DialogDescription>
                        Assign <span className="font-bold text-foreground">{technicians?.map(t => t.name).join(', ')}</span> to work order <span className="font-bold text-foreground">#{workOrder?.id}</span>.
                        Select as many days as needed on the calendar.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="activity-description">Description</Label>
                            <Textarea 
                                id="activity-description" 
                                value={description} 
                                onChange={e => setDescription(e.target.value)}
                                placeholder="What needs to be done?"
                                className="min-h-[100px]"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="flex justify-between items-center">
                                <span>Selected Dates</span>
                                <Badge variant="outline" className="text-[10px]">{scheduledDates.length} selected</Badge>
                            </Label>
                            <ScrollArea className="h-[180px] border rounded-md p-2 bg-muted/5">
                                <div className="flex flex-wrap gap-2">
                                    {scheduledDates.length > 0 ? (
                                        scheduledDates.sort((a, b) => a.getTime() - b.getTime()).map((date, i) => (
                                            <Badge key={i} variant="secondary" className="flex items-center gap-1.5 px-2 py-1 pr-1">
                                                {format(date, 'MMM d, yyyy')}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-4 w-4 hover:bg-destructive hover:text-white rounded-full" 
                                                    onClick={(e) => { e.stopPropagation(); removeDate(date); }}
                                                >
                                                    <X className="h-2 w-2" />
                                                </Button>
                                            </Badge>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full w-full py-8 text-muted-foreground italic text-sm">
                                            <p>No dates selected.</p>
                                            <p className="text-[10px]">Click days on the calendar to add them.</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-muted/20">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Pick Schedule Dates</Label>
                        <Calendar
                            mode="multiple"
                            selected={scheduledDates}
                            onSelect={(dates) => setScheduledDates(dates || [])}
                            className="rounded-md border bg-white shadow-sm"
                        />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || scheduledDates.length === 0 || !description}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Schedule {scheduledDates.length} Service Day{scheduledDates.length !== 1 ? 's' : ''}
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

function CalendarDay({ day, dayActivities, techColorMap, view, index, totalDays, monthParity }: { day: Date, dayActivities: Activity[], techColorMap: Map<string, string>, view: 'day' | 'week' | 'two-week' | 'month', index: number, totalDays: number, monthParity?: 'even' | 'odd' }) {
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
            isMonthView && monthParity === 'odd' && 'bg-muted/40'
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
    const { user } = useUser();
    const { toast } = useToast();
    const { role, technician, isLoading: isRoleLoading } = useRole();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [workSites, setWorkSites] = useState<WorkSite[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isCoreDataLoading, setIsCoreDataLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    const [techniciansToSchedule, setTechniciansToSchedule] = useState<Technician[]>([]);
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<any>(null);

    const [isMultiSelect, setIsMultiSelect] = useState(false);
    const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);
    const [isSettingDefault, setIsSettingDefault] = useState(false);

    const [view, setView] = useState<'week' | 'day' | 'two-week' | 'month' | null>(null);

    useEffect(() => {
        if (!isRoleLoading && view === null) {
            // Priority 1: User's saved preference
            if (technician?.defaultDispatchView) {
                setView(technician.defaultDispatchView);
            } 
            // Priority 2: Role-based fallback
            else if (role?.name === 'Technician') {
                setView('month');
            } else {
                setView('week');
            }
        }
    }, [isRoleLoading, role, technician, view]);


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

    const incompleteWorkOrdersQuery = useMemoFirebase(() => {
        if (!db || !user || role?.name === 'Technician') return null;
        return query(collection(db, 'work_orders'), where("status", "!=", "Completed"));
    }, [db, user, role]);

    const { data: fetchedWorkOrders, isLoading: areWorkOrdersLoading } = useCollection<WorkOrder>(incompleteWorkOrdersQuery);

    const workOrders = useMemo(() => {
        if (!fetchedWorkOrders) return [];
        return [...fetchedWorkOrders].sort((a, b) => {
            if (a.id === NON_PRODUCTIVE_WO_ID) return -1;
            if (b.id === NON_PRODUCTIVE_WO_ID) return 1;
            return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
        });
    }, [fetchedWorkOrders]);

    useEffect(() => {
        if (!db || !user || isRoleLoading) return;
        
        async function fetchCoreData() {
            setIsCoreDataLoading(true);
            try {
                const activitiesPromise = getAllActivitiesWithDetails(db);
                const techniciansPromise = getTechnicians(db);
                const workSitesPromise = getWorkSites(db);
                const clientsPromise = getClients(db);
                
                const [fetchedActivities, fetchedTechnicians, fetchedWorkSites, fetchedClients] = await Promise.all([activitiesPromise, techniciansPromise, workSitesPromise, clientsPromise]);
                setActivities(fetchedActivities);
                setTechnicians(fetchedTechnicians);
                setWorkSites(fetchedWorkSites);
                setClients(fetchedClients);
            } catch (err) {
                 console.error("Failed to fetch dispatch data:", err);
            } finally {
                setIsCoreDataLoading(false);
            }
        }

        fetchCoreData();
    }, [db, user, isRoleLoading]);

    const techColorMap = useMemo(() => {
        const map = new Map<string, string>();
        technicians.forEach((tech, index) => {
            map.set(tech.id, techColors[index % techColors.length]);
        });
        return map;
    }, [technicians]);
    
    const calendarDays = useMemo(() => {
        if (!view) return [];
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
                 start = startOfWeek(currentDate, { weekStartsOn });
                return Array.from({ length: 35 }, (_, i) => addDays(start, i)); // 5 weeks
            default:
                start = startOfWeek(currentDate, { weekStartsOn });
                return Array.from({ length: 7 }, (_, i) => addDays(start, i));
        }
    }, [currentDate, view]);
    
    const handlePrev = () => {
        if (!view) return;
        switch (view) {
            case 'day':
                setCurrentDate(subDays(currentDate, 1));
                break;
            case 'week':
            case 'month':
                 setCurrentDate(subWeeks(currentDate, 1));
                break;
            case 'two-week':
                setCurrentDate(subWeeks(currentDate, 2));
                break;
        }
    }
    const handleNext = () => {
        if (!view) return;
        switch (view) {
            case 'day':
                setCurrentDate(addDays(currentDate, 1));
                break;
            case 'week':
            case 'month':
                setCurrentDate(addWeeks(currentDate, 1));
                break;
            case 'two-week':
                setCurrentDate(addWeeks(currentDate, 2));
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

        if (!over) return;

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
                setTechniciansToSchedule([technician]);
                setSelectedWorkOrder(workOrder);
                setIsScheduleModalOpen(true);
            }
        } else if (active.data.current?.type === 'technician-group' && over.data.current?.type === 'workorder') {
            const technicians = active.data.current.technicians as Technician[];
            const workOrder = over.data.current.workOrder as WorkOrder;

            if (technicians.length > 0 && workOrder) {
                setTechniciansToSchedule(technicians);
                setSelectedWorkOrder(workOrder);
                setIsScheduleModalOpen(true);
            }
        }
    }

    async function handleScheduleActivity(data: { description: string, scheduledDates: Date[] }) {
        if (!db || !techniciansToSchedule || techniciansToSchedule.length === 0 || !selectedWorkOrder) return;

        setIsSubmitting(true);

        try {
            const createActivityPromises: Promise<any>[] = [];
            
            data.scheduledDates.forEach(date => {
                techniciansToSchedule.forEach(tech => {
                    const activityData = {
                        description: data.description,
                        scheduled_date: date.toISOString(),
                        technicianId: tech.id,
                        workOrderId: selectedWorkOrder.id,
                        createdDate: new Date().toISOString(),
                        status: 'scheduled' as const,
                    };
                    const activitiesColRef = collection(db, 'work_orders', selectedWorkOrder.id, 'activities');
                    createActivityPromises.push(addDocumentNonBlocking(activitiesColRef, activityData).then(docRef => ({
                        ...activityData,
                        id: docRef.id,
                        technician: tech,
                         parentWorkOrder: {
                            id: selectedWorkOrder.id,
                            jobName: selectedWorkOrder.jobName,
                            workSite: workOrders.find(wo => wo.id === selectedWorkOrder.id)?.workSite
                        }
                    })));
                });
            });
            
            const newActivities = await Promise.all(createActivityPromises);

            setActivities(prev => [...prev, ...newActivities]);

            await updateWorkOrderStatus(db, selectedWorkOrder.id);
            
            toast({ title: `${newActivities.length} Activities Scheduled Successfully` });

        } catch (error) {
            if (error instanceof Error && !error.message.includes('permission-error')) {
                console.error("Error scheduling activity:", error);
                toast({ title: 'Error', description: 'Failed to schedule activity', variant: 'destructive' });
            }
        } finally {
            setIsSubmitting(false);
            setIsScheduleModalOpen(false);
            setSelectedTechIds([]);
        }
    }

    const headerDateDisplay = useMemo(() => {
        if (!view) return '';
        const weekStartsOn = 1; // Monday
        if (view === 'day') {
            return format(currentDate, 'MMMM d, yyyy');
        }
        
        let start, end;
        start = startOfWeek(currentDate, { weekStartsOn });
        end = addDays(start, calendarDays.length - 1);
        
        if (start.getMonth() === end.getMonth()) {
            return `${format(start, 'MMMM d')} - ${format(end, 'd, yyyy')}`;
        }
        if (start.getFullYear() === end.getFullYear()) {
            return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
        }
        return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;

    }, [currentDate, view, calendarDays]);

    const handleMultiSelectToggle = (checked: boolean) => {
        setIsMultiSelect(checked);
        setSelectedTechIds([]); // Reset selection when toggling
    };

    const handleToggleTechSelection = (techId: string) => {
        setSelectedTechIds(prev =>
            prev.includes(techId)
                ? prev.filter(id => id !== techId)
                : [...prev, techId]
        );
    };

    const handleSetDefaultView = async () => {
        if (!db || !technician || !view) return;
        setIsSettingDefault(true);
        try {
            const techRef = doc(db, 'technicians', technician.id);
            await updateDocumentNonBlocking(techRef, { defaultDispatchView: view });
        } catch (error) {
            console.error("Error setting default view:", error);
            toast({ title: 'Error', description: 'Failed to save view preference.', variant: 'destructive' });
        } finally {
            setIsSettingDefault(false);
        }
    };

    const isCurrentViewDefault = technician?.defaultDispatchView === view;

    const isLoading = isCoreDataLoading || isRoleLoading || areWorkOrdersLoading || view === null;

    if (isLoading) {
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
                             <Select value={view!} onValueChange={(v) => setView(v as any)}>
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
                            <Button 
                                variant={isCurrentViewDefault ? "secondary" : "outline"} 
                                size="sm" 
                                onClick={handleSetDefaultView}
                                disabled={isSettingDefault || isCurrentViewDefault}
                                className="hidden sm:flex"
                            >
                                {isSettingDefault ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Pin className={cn("h-3 w-3 mr-2", isCurrentViewDefault && "fill-current")} />}
                                {isCurrentViewDefault ? 'Default View' : 'Set Default'}
                            </Button>
                            <div className="flex items-center gap-1">
                                <Button variant="outline" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
                                <Button variant="outline" onClick={goToToday}>Today</Button>
                                <Button variant="outline" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
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
                                                view={view!}
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
                                                view={view!}
                                                index={index + 7}
                                                totalDays={14}
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
                                    const monthParity = getMonth(day) % 2 === 0 ? 'even' : 'odd';

                                    return (
                                        <CalendarDay
                                            key={dayKey}
                                            day={day}
                                            dayActivities={dayActivities}
                                            techColorMap={techColorMap}
                                            view={view!}
                                            index={index}
                                            totalDays={calendarDays.length}
                                            monthParity={monthParity}
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
                                        <div className="flex items-center justify-between">
                                            <CardTitle>Technician Key</CardTitle>
                                            <div className="flex items-center space-x-2">
                                                <Label htmlFor="multi-select-toggle">Multi-select</Label>
                                                <Switch
                                                    id="multi-select-toggle"
                                                    checked={isMultiSelect}
                                                    onCheckedChange={handleMultiSelectToggle}
                                                />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col gap-3">
                                            {isMultiSelect && (
                                                <DraggableTechnicianGroup
                                                    selectedTechnicians={technicians.filter(t => selectedTechIds.includes(t.id))}
                                                />
                                            )}
                                            {technicians.map(tech => (
                                                <TechnicianItem 
                                                    key={tech.id} 
                                                    tech={tech} 
                                                    techColorMap={techColorMap} 
                                                    isMultiSelect={isMultiSelect}
                                                    isSelected={selectedTechIds.includes(tech.id)}
                                                    onToggleSelect={handleToggleTechSelection}
                                                />
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
                    ) : activeId && activeDragItem?.type === 'technician-group' ? (
                         <div className="flex items-center justify-center gap-3 p-2 rounded-md border cursor-grabbing bg-primary text-primary-foreground shadow-lg">
                            <span className="text-sm font-medium">{activeDragItem.technicians.length} technicians</span>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
            <ScheduleActivityDialog
                isOpen={isScheduleModalOpen}
                onOpenChange={setIsScheduleModalOpen}
                technicians={techniciansToSchedule}
                workOrder={selectedWorkOrder}
                onSubmit={handleScheduleActivity}
                isSubmitting={isSubmitting}
            />
        </MainLayout>
    );
}
