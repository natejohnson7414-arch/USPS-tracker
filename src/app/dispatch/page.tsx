
'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/main-layout';
import { useFirestore } from '@/firebase';
import { getAllActivitiesWithDetails, getTechnicians, getIncompleteWorkOrders, updateWorkOrderStatus } from '@/lib/data';
import type { Activity, Technician, WorkOrder } from '@/lib/types';
import { startOfWeek, addDays, format, isSameDay, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
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
import { addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';


function TechnicianItem({ tech, techColorMap }: { tech: Technician, techColorMap: Map<string, string> }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: tech.id,
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
        id: wo.id,
    });
    
    return (
        <div 
            ref={setNodeRef} 
            className={cn(
                "p-3 border rounded-lg bg-card transition-colors",
                isOver ? "bg-accent border-accent-foreground" : "hover:bg-muted/50"
            )}
        >
            <p className="font-semibold">{wo.jobName}</p>
            <p className="text-sm text-muted-foreground">#{wo.id}</p>
            <p className="text-sm text-muted-foreground mt-1 truncate">{wo.description}</p>
        </div>
    )
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
            setDescription(`Schedule ${technician?.name} for job: ${workOrder?.jobName}`);
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

export default function DispatchBoardPage() {
    const db = useFirestore();
    const { toast } = useToast();
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
        if (!db) return;
        setIsLoading(true);
        Promise.all([
            getAllActivitiesWithDetails(db),
            getTechnicians(db),
            getIncompleteWorkOrders(db)
        ]).then(([fetchedActivities, fetchedTechnicians, fetchedWorkOrders]) => {
            setActivities(fetchedActivities);
            setTechnicians(fetchedTechnicians);
            setWorkOrders(fetchedWorkOrders);
            setIsLoading(false);
        }).catch(err => {
            console.error("Failed to fetch dispatch data:", err);
            setIsLoading(false);
        });
    }, [db]);

    const techColorMap = useMemo(() => {
        const map = new Map<string, string>();
        technicians.forEach((tech, index) => {
            map.set(tech.id, techColors[index % techColors.length]);
        });
        return map;
    }, [technicians]);
    
    const weekStartsOn = 1; // Monday
    const weekStart = startOfWeek(currentDate, { weekStartsOn });
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
    
    const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
    const prevWeek = () => setCurrentDate(subDays(currentDate, 7));
    const goToToday = () => setCurrentDate(new Date());

    const activitiesByDay = useMemo(() => {
        const grouped = new Map<string, Activity[]>();
        activities.forEach(activity => {
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
    }

    function handleDragEnd(event: any) {
        const { over, active } = event;
        setActiveId(null);

        if (over) {
            const technician = technicians.find(t => t.id === active.id);
            const workOrder = filteredWorkOrders.find(wo => wo.id === over.id);

            if (technician && workOrder) {
                setSelectedTechnician(technician);
                setSelectedWorkOrder(workOrder);
                setIsScheduleModalOpen(true);
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

            // Optimistically update the UI
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
            
            // Refetch incomplete orders in case one was moved to 'In Progress'
            const incompleteOrders = await getIncompleteWorkOrders(db);
            setWorkOrders(incompleteOrders);


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
                            <Button variant="outline" size="icon" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
                            <Button variant="outline" onClick={goToToday}>Today</Button>
                            <Button variant="outline" size="icon" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
                             <div className="hidden sm:block ml-4 font-semibold text-lg">
                                {format(weekStart, 'MMMM yyyy')}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto pb-4">
                        <div className="flex rounded-lg border">
                            {weekDays.map((day, index) => {
                                const dayKey = format(day, 'yyyy-MM-dd');
                                const dayActivities = activitiesByDay.get(dayKey) || [];
                                return (
                                    <div key={dayKey} className={cn(
                                        "flex flex-col w-[14.28%] min-w-[170px] flex-shrink-0", 
                                        index < weekDays.length - 1 && "border-r border-border"
                                    )}>
                                        <div className="p-2 border-b text-center font-semibold bg-muted/25">
                                            <p className="text-sm">{format(day, 'EEE')}</p>
                                            <p className="text-2xl">{format(day, 'd')}</p>
                                        </div>
                                        <div className="p-2 space-y-2 flex-grow min-h-[200px] overflow-hidden">
                                            {dayActivities.map(activity => (
                                                <TooltipProvider key={activity.id}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className={cn('p-1.5 text-xs text-white rounded cursor-pointer shadow truncate', techColorMap.get(activity.technicianId) || 'bg-gray-400')}>
                                                                {activity.technician?.name || 'Unassigned'}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            <p className="font-bold">{activity.parentWorkOrder?.workSite?.name || 'No Work Site'}</p>
                                                            <p className="text-sm text-muted-foreground">{activity.parentWorkOrder?.jobName}</p>
                                                            <p className="mt-2">{activity.description}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    
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
                </div>
                 <DragOverlay>
                    {activeId ? (
                        <div className="flex items-center gap-3 p-2 rounded-md border cursor-grabbing bg-card shadow-lg">
                             <div className={cn("h-4 w-4 rounded-full", techColorMap.get(activeId))}></div>
                            <span className="text-sm font-medium">{technicians.find(t => t.id === activeId)?.name}</span>
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


    