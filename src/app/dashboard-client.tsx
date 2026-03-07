
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { WorkOrder, Technician, WorkSite, Client, Role, PmWorkOrder } from '@/lib/types';
import { WorkOrderTable } from '@/components/work-order-table';
import { WorkOrderTableToolbar } from '@/components/work-order-table-toolbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building, Package, ChevronRight, CalendarClock, AlertCircle } from 'lucide-react';
import Link from 'next/link';

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

  const activePmWorkOrders = pmWorkOrders.filter(wo => wo.status !== 'Completed');

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-8">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">Work Order Dashboard</h1>
        </div>

        {activePmWorkOrders.length > 0 && (
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                    <CalendarClock className="h-5 w-5" />
                    <h2 className="text-xl font-bold uppercase tracking-wide">Master Preventative Maintenance</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activePmWorkOrders.map(wo => (
                        <Card key={wo.id} className="border-l-4 border-l-primary hover:bg-muted/30 transition-colors shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start mb-1">
                                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{wo.status}</Badge>
                                    <span className="text-[10px] font-black text-muted-foreground uppercase">{wo.scheduledMonth}/{wo.scheduledYear}</span>
                                </div>
                                <CardTitle className="text-base line-clamp-1">{wo.workSiteName}</CardTitle>
                                <CardDescription className="text-xs flex items-center gap-1">
                                    <Package className="h-3 w-3" />
                                    {wo.assetTasks.length} Equipment Units in Scope
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button asChild className="w-full" size="sm">
                                    <Link href={`/pm-work-orders/${wo.id}`}>
                                        Execute Site Checklist
                                        <ChevronRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>
        )}

        <section className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <h2 className="text-xl font-bold uppercase tracking-wide">Service & Repair Jobs</h2>
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
            <WorkOrderTable workOrders={filteredWorkOrders} technicians={technicians} workSites={initialWorkSites} />
        </section>
      </div>
    </div>
  );
}
