
'use client';
import React, { useEffect, useState, useRef } from 'react';
import { DashboardClient } from './dashboard-client';
import { MainLayout } from '@/components/main-layout';
import type { WorkOrder, Technician, WorkSite, Client, Role, PmWorkOrder } from '@/lib/types';
import { useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useTechnician as useRoleData } from '@/hooks/use-technician';

type RawTechnician = Omit<Technician, 'name'> & { firstName: string; lastName: string };

export default function DashboardPageContent() {
  const db = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const { role: currentUserRole, isLoading: isRoleLoading } = useRoleData();

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [statusFilter, setStatusFilter] = useState('All');
  const [assignedToFilter, setAssignedToFilter] = useState('All');
  const defaultFilterSet = useRef(false);

  useEffect(() => {
    if (user && currentUserRole && !defaultFilterSet.current) {
        if (currentUserRole.name === 'Technician') {
            setAssignedToFilter(user.uid);
        }
        defaultFilterSet.current = true;
    }
  }, [user, currentUserRole]);

  const workOrdersQuery = useMemoFirebase(() => {
    if (!db || isAuthLoading || !user || !currentUserRole) return null;

    const workOrdersCollection = collection(db, 'work_orders');
    const filters: any[] = [];

    if (assignedToFilter !== 'All') {
      filters.push(where('assignedTechnicianId', '==', assignedToFilter));
    }

    if (statusFilter === 'All' && currentUserRole.name === 'Technician') {
      filters.push(where('status', 'in', ['Open', 'In Progress', 'On Hold']));
    } else if (statusFilter !== 'All') {
      filters.push(where('status', '==', statusFilter));
    }
    
    if (filters.length > 0) {
      return query(workOrdersCollection, ...filters);
    }
    
    return query(workOrdersCollection);

  }, [db, statusFilter, assignedToFilter, user, isAuthLoading, currentUserRole]);

  const { data: workOrders, isLoading: isWorkOrdersLoading } = useCollection<WorkOrder>(workOrdersQuery);
  
  const pmWorkOrdersQuery = useMemoFirebase(() => {
      if (!db || isAuthLoading || !user || !currentUserRole) return null;
      
      const pmCollection = collection(db, 'pm_work_orders');
      const filters: any[] = [];

      // Assignment Filter
      if (assignedToFilter !== 'All') {
        filters.push(where('assignedTechnicianId', '==', assignedToFilter));
      }

      // Status Filter Mapping
      if (statusFilter === 'All' && currentUserRole.name === 'Technician') {
        filters.push(where('status', 'in', ['Scheduled', 'In Progress', 'Submitted For Review']));
      } else if (statusFilter !== 'All') {
        let pmStatus = statusFilter;
        if (statusFilter === 'Open') pmStatus = 'Scheduled';
        if (statusFilter === 'Review') pmStatus = 'Submitted For Review';
        // 'On Hold' doesn't exist for PMs, so this will correctly return empty if selected
        filters.push(where('status', '==', pmStatus));
      }
      
      if (filters.length > 0) {
        return query(pmCollection, ...filters);
      }
      return query(pmCollection);
  }, [db, statusFilter, assignedToFilter, user, isAuthLoading, currentUserRole]);

  const { data: pmWorkOrders, isLoading: isPmLoading } = useCollection<PmWorkOrder>(pmWorkOrdersQuery);

  const { data: fetchedTechnicians, isLoading: isTechniciansLoading } = useCollection<RawTechnician>(useMemoFirebase(() => {
      if (!db || isAuthLoading || !user) return null;
      return collection(db, 'technicians');
  }, [db, isAuthLoading, user]));
  
  const { data: fetchedWorkSites, isLoading: isWorkSitesLoading } = useCollection<WorkSite>(useMemoFirebase(() => {
      if (!db || isAuthLoading || !user) return null;
      return collection(db, 'work_sites');
  }, [db, isAuthLoading, user]));

  const { data: fetchedClients, isLoading: isClientsLoading } = useCollection<Client>(useMemoFirebase(() => {
      if (!db || isAuthLoading || !user) return null;
      return collection(db, 'clients');
  }, [db, isAuthLoading, user]));


  useEffect(() => {
      if (fetchedTechnicians) {
          const formattedTechnicians: Technician[] = fetchedTechnicians.map(t => ({
              ...t,
              name: `${t.firstName} ${t.lastName}`.trim()
          }));
          setTechnicians(formattedTechnicians);
      }
  }, [fetchedTechnicians]);

  useEffect(() => {
    if (fetchedWorkSites) setWorkSites(fetchedWorkSites);
  }, [fetchedWorkSites]);

  useEffect(() => {
    if (fetchedClients) setClients(fetchedClients);
  }, [fetchedClients]);

  const isDataLoading = isAuthLoading || isWorkOrdersLoading || isRoleLoading || isTechniciansLoading || isWorkSitesLoading || isClientsLoading || isPmLoading;

  if (isDataLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <p>Loading work orders...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <DashboardClient 
        initialWorkOrders={workOrders || []} 
        pmWorkOrders={pmWorkOrders || []}
        technicians={technicians} 
        initialWorkSites={workSites}
        initialClients={clients}
        currentUserRole={currentUserRole}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        assignedToFilter={assignedToFilter}
        onAssignedToChange={setAssignedToFilter}
      />
    </MainLayout>
  );
}
