
'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/main-layout';
import { useFirestore } from '@/firebase';
import { getAllActivitiesWithDetails, getTechnicians, getIncompleteWorkOrders } from '@/lib/data';
import type { Activity, Technician, WorkOrder } from '@/lib/types';
import { startOfWeek, addDays, format, isSameDay, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const techColors = [
    'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 
    'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-rose-500',
    'bg-cyan-500', 'bg-lime-500'
];

export default function DispatchBoardPage() {
    const db = useFirestore();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');

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
                                        <div key={tech.id} className="flex items-center gap-3 p-2 rounded-md border cursor-grab">
                                            <div className={cn("h-4 w-4 rounded-full", techColorMap.get(tech.id))}></div>
                                            <span className="text-sm font-medium">{tech.name}</span>
                                        </div>
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
                                        <div key={wo.id} className="p-3 border rounded-lg bg-card hover:bg-muted/50">
                                            <p className="font-semibold">{wo.jobName}</p>
                                            <p className="text-sm text-muted-foreground">#{wo.id}</p>
                                            <p className="text-sm text-muted-foreground mt-1 truncate">{wo.description}</p>
                                        </div>
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
        </MainLayout>
    );
}
