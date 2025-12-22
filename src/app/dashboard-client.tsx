'use client';

import React, { useState, useMemo } from 'react';
import type { WorkOrder, Technician, WorkSite } from '@/lib/types';
import { WorkOrderTable } from '@/components/work-order-table';
import { WorkOrderTableToolbar } from '@/components/work-order-table-toolbar';

interface DashboardClientProps {
  initialWorkOrders: WorkOrder[];
  technicians: Technician[];
  workSites: WorkSite[];
}

export function DashboardClient({ initialWorkOrders, technicians, workSites }: DashboardClientProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(order => {
      const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
      const matchesSearch =
        order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [workOrders, searchTerm, statusFilter]);

  const handleAddWorkOrder = (newOrder: WorkOrder) => {
    setWorkOrders(prev => [newOrder, ...prev]);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Work Order Dashboard</h1>
        <WorkOrderTableToolbar
          onSearchChange={setSearchTerm}
          onStatusChange={setStatusFilter}
          currentFilter={statusFilter}
          technicians={technicians}
          workSites={workSites}
          onWorkOrderAdded={handleAddWorkOrder}
        />
        <WorkOrderTable workOrders={filteredWorkOrders} technicians={technicians} />
      </div>
    </div>
  );
}
