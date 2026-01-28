
'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/main-layout';
import { useFirestore } from '@/firebase';
import { getAllActivitiesWithDetails, getTechnicians } from '@/lib/data';
import type { Activity, Technician } from '@/lib/types';
import { startOfWeek, addDays, format, isSameDay, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const techColors = [
    'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 
    'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-rose-500',
    'bg-cyan-500', 'bg-lime-500'
];

export default function DispatchBoardPage() {
    const db = useFirestore();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        if (!db) return;
        setIsLoading(true);
        Promise.all([
            getAllActivitiesWithDetails(db),
            getTechnicians(db)
        ]).then(([fetchedActivities, fetchedTechnicians]) => {
            setActivities(fetchedActivities);
            setTechnicians(fetchedTechnicians);
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px bg-border border-t border-l rounded-t-lg overflow-hidden">
                    {weekDays.map(day => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const dayActivities = activitiesByDay.get(dayKey) || [];
                        return (
                            <div key={dayKey} className="bg-card min-h-[200px]">
                                <div className="p-2 border-b text-center font-semibold">
                                    <p className="text-sm">{format(day, 'EEE')}</p>
                                    <p className="text-2xl">{format(day, 'd')}</p>
                                </div>
                                <div className="p-2 space-y-2">
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
                 <div className="border-l border-r border-b rounded-b-lg p-4 bg-card">
                    <h3 className="font-semibold mb-2">Technician Key</h3>
                    <div className="flex flex-wrap gap-4">
                        {technicians.map(tech => (
                             <div key={tech.id} className="flex items-center gap-2">
                                <div className={cn("h-4 w-4 rounded-full", techColorMap.get(tech.id))}></div>
                                <span className="text-sm">{tech.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
