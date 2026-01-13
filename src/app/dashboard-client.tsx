
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { WorkOrder, Technician, WorkSite, Client, Role } from '@/lib/types';
import { WorkOrderTable } from '@/components/work-order-table';
import { WorkOrderTableToolbar } from '@/components/work-order-table-toolbar';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { getTechnicians, getWorkSites as fetchWorkSites, getClients as fetchClients } from '@/lib/data';
import { useTechnician } from '@/hooks/use-technician';

interface DashboardClientProps {
  initialWorkOrders: WorkOrder[];
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
  const [workSites, setWorkSites] = useState<WorkSite[]>(initialWorkSites);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [searchTerm, setSearchTerm] = useState('');


  useEffect(() => {
    setWorkOrders(initialWorkOrders);
  }, [initialWorkOrders]);


  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(order => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      // Status and Assigned To filters are now handled by the Firestore query in page.tsx
      // We only need to apply the client-side search term filter
      const matchesSearch =
        order.jobName?.toLowerCase().includes(lowerSearchTerm) ||
        order.id?.toLowerCase().includes(lowerSearchTerm) ||
        order.description?.toLowerCase().includes(lowerSearchTerm);
      return matchesSearch;
    });
  }, [workOrders, searchTerm]);

  const handleAddWorkSite = (newSite: WorkSite) => {
    setWorkSites(prev => [newSite, ...prev]);
  }

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Work Order Dashboard</h1>
        <WorkOrderTableToolbar
          onSearchChange={setSearchTerm}
          onStatusChange={onStatusChange}
          currentStatusFilter={statusFilter}
          onAssignedToChange={onAssignedToChange}
          currentAssignedToFilter={assignedToFilter}
          technicians={technicians}
          workSites={workSites}
          clients={clients}
          onWorkSiteAdded={handleAddWorkSite}
          currentUserRole={currentUserRole}
        />
        <WorkOrderTable workOrders={filteredWorkOrders} technicians={technicians} workSites={workSites} />
      </div>
    </div>
  );
}
