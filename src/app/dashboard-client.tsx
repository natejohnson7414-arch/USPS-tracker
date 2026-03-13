
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { WorkOrder, Technician, WorkSite, Client, Role, PmWorkOrder } from '@/lib/types';
import { WorkOrderTable } from '@/components/work-order-table';
import { WorkOrderTableToolbar } from '@/components/work-order-table-toolbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building, Package, ChevronRight, CalendarClock, AlertCircle, User, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface DashboardClientProps {
  initialWorkOrders: WorkOrder[];
  pmWorkOrders: PmWorkOrder[];
  technicians: Technician[];
  initialWorkSites: WorkSite[];
  initialClients: Client[];
  currentUserRole: Role | null;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  assignedToFilter: string;
  onAssignedToChange: (technicianId: string) => void;
}

export function DashboardClient({ 
    initialWorkOrders, 
    pmWorkOrders,
    technicians, 
    initialWorkSites, 
    initialClients, 
    currentUserRole,
    statusFilter,
    onStatusChange,
    assignedToFilter,
    onAssignedToChange
}: DashboardClientProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setWorkOrders(initialWorkOrders);
  }, [initialWorkOrders]);

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(order => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch =
        order.jobName?.toLowerCase().includes(lowerSearchTerm) ||
        order.id?.toLowerCase().includes(lowerSearchTerm) ||
        order.description?.toLowerCase().includes(lowerSearchTerm);
      return matchesSearch;
    });
  }, [workOrders, searchTerm]);

  const filteredPmWorkOrders = useMemo(() => {
    return pmWorkOrders.filter(order => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch =
        order.workSiteName?.toLowerCase().includes(lowerSearchTerm) ||
        order.id?.toLowerCase().includes(lowerSearchTerm) ||
        order.description?.toLowerCase().includes(lowerSearchTerm);
      return matchesSearch;
    });
  }, [pmWorkOrders, searchTerm]);

  const getTechnician = (id?: string) => technicians.find(t => t.id === id);

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-8">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Work Order Dashboard</h1>
        </div>

        <WorkOrderTableToolbar
            onSearchChange={setSearchTerm}
            onStatusChange={onStatusChange}
            currentStatusFilter={statusFilter}
            onAssignedToChange={onAssignedToChange}
            currentAssignedToFilter={assignedToFilter}
            technicians={technicians}
            currentUserRole={currentUserRole}
        />

        {filteredPmWorkOrders.length > 0 && (
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                    <CalendarClock className="h-5 w-5" />
                    <h2 className="text-xl font-bold uppercase tracking-wide">Master Preventative Maintenance</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPmWorkOrders.map(wo => {
                        const technician = getTechnician(wo.assignedTechnicianId);
                        return (
                            <Card key={wo.id} className="border-l-4 border-l-primary hover:bg-muted/30 transition-colors shadow-sm">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start mb-1">
                                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{wo.status}</Badge>
                                        <span className="text-[10px] font-black text-muted-foreground uppercase">{wo.scheduledMonth}/{wo.scheduledYear}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <CardTitle className="text-base line-clamp-1 hover:underline">
                                            <Link href={`/pm-work-orders/${wo.id}`}>
                                                {wo.workSiteName}
                                            </Link>
                                        </CardTitle>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Job # {wo.id}</p>
                                </CardHeader>
                                <CardContent className="space-y-3 pb-4">
                                    <p className="text-sm text-muted-foreground line-clamp-2">{wo.description}</p>
                                    <Separator />
                                    <div className="flex items-center justify-between text-sm">
                                        <p className="text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Assigned</p>
                                        {technician ? (
                                            <div className="flex items-center gap-2 font-medium">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={technician.avatarUrl} alt={technician.name} />
                                                    <AvatarFallback>{technician.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span>{technician.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground font-medium">Unassigned</span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <p className="text-muted-foreground flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Scope</p>
                                        <p className="font-medium">{wo.assetTasks.length} Units</p>
                                    </div>
                                    <Button asChild className="w-full mt-2" size="sm">
                                        <Link href={`/pm-work-orders/${wo.id}`}>
                                            Execute Site Checklist
                                            <ChevronRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </section>
        )}

        <section className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <h2 className="text-xl font-bold uppercase tracking-wide">Service & Repair Jobs</h2>
            </div>
            <WorkOrderTable workOrders={filteredWorkOrders} technicians={technicians} workSites={initialWorkSites} />
        </section>
      </div>
    </div>
  );
}
