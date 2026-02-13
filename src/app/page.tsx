'use client';
import React, { useEffect, useState, useRef } from 'react';
import { getTechnicians, getWorkSites, getClients } from '@/lib/data';
import { DashboardClient } from './dashboard-client';
import { MainLayout } from '@/components/main-layout';
import type { WorkOrder, Technician, WorkSite, Client, Role } from '@/lib/types';
import { useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useTechnician as useRoleData } from '@/hooks/use-technician';

// Define a type for the raw technician data from Firestore
type RawTechnician = Omit<Technician, 'name'> & { firstName: string; lastName: string };

export default function DashboardPage() {
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
    // Set default filter for technician once user and role are loaded
    if (user && currentUserRole && !defaultFilterSet.current) {
        if (currentUserRole.name === 'Technician') {
            setAssignedToFilter(user.uid);
        }
        defaultFilterSet.current = true;
    }
  }, [user, currentUserRole]);

  // Memoize the query to prevent re-creating it on every render
  const workOrdersQuery = useMemoFirebase(() => {
    if (!db || isAuthLoading || !user || !currentUserRole) return null;

    const workOrdersCollection = collection(db, 'work_orders');
    const filters: any[] = [];

    // Filter by technician assignment. For technicians, this defaults to their own ID.
    if (assignedToFilter !== 'All') {
      filters.push(where('assignedTechnicianId', '==', assignedToFilter));
    }

    // Filter by status.
    if (statusFilter === 'All' && currentUserRole.name === 'Technician') {
      // For technicians, a filter of "All" means all active work orders.
      filters.push(where('status', 'in', ['Open', 'In Progress', 'On Hold']));
    } else if (statusFilter !== 'All') {
      // For all users when a specific status is selected.
      filters.push(where('status', '==', statusFilter));
    }
    
    // Construct the query
    if (filters.length > 0) {
      return query(workOrdersCollection, ...filters);
    }
    
    // For Admins/other roles with "All" selected for status and technician, return all work orders.
    return query(workOrdersCollection);

  }, [db, statusFilter, assignedToFilter, user, isAuthLoading, currentUserRole]);

  const { data: workOrders, isLoading: isWorkOrdersLoading } = useCollection<WorkOrder>(workOrdersQuery);
  const { data: fetchedTechnicians, isLoading: isTechniciansLoading } = useCollection<RawTechnician>(useMemoFirebase(() => db ? collection(db, 'technicians') : null, [db]));
  const { data: fetchedWorkSites, isLoading: isWorkSitesLoading } = useCollection<WorkSite>(useMemoFirebase(() => db ? collection(db, 'work_sites') : null, [db]));
  const { data: fetchedClients, isLoading: isClientsLoading } = useCollection<Client>(useMemoFirebase(() => db ? collection(db, 'clients') : null, [db]));

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

  const isDataLoading = isAuthLoading || isWorkOrdersLoading || isRoleLoading || isTechniciansLoading || isWorkSitesLoading || isClientsLoading;

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
