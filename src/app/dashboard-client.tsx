
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { WorkOrder, Technician, WorkSite, Client } from '@/lib/types';
import { WorkOrderTable } from '@/components/work-order-table';
import { WorkOrderTableToolbar } from '@/components/work-order-table-toolbar';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { getTechnicians, getWorkSites as fetchWorkSites, getClients as fetchClients } from '@/lib/data';

interface DashboardClientProps {
  initialWorkOrders: WorkOrder[];
  technicians: Technician[];
  initialWorkSites: WorkSite[];
  initialClients: Client[];
}

export function DashboardClient({ initialWorkOrders, technicians, initialWorkSites, initialClients }: DashboardClientProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders);
  const [workSites, setWorkSites] = useState<WorkSite[]>(initialWorkSites);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(order => {
      const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch =
        order.jobName?.toLowerCase().includes(lowerSearchTerm) ||
        order.id?.toLowerCase().includes(lowerSearchTerm) ||
        order.description?.toLowerCase().includes(lowerSearchTerm);
      return matchesStatus && matchesSearch;
    });
  }, [workOrders, searchTerm, statusFilter]);

  const handleAddWorkOrder = (newOrder: WorkOrder) => {
    setWorkOrders(prev => [newOrder, ...prev].sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()));
  };
  
  const handleAddWorkSite = (newSite: WorkSite) => {
    setWorkSites(prev => [newSite, ...prev]);
  }

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
          clients={clients}
          onWorkOrderAdded={handleAddWorkOrder}
          onWorkSiteAdded={handleAddWorkSite}
        />
        <WorkOrderTable workOrders={filteredWorkOrders} technicians={technicians} workSites={workSites} />
      </div>
    </div>
  );
}
