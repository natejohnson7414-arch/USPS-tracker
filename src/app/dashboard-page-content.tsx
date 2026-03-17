
'use client';
import React, { useEffect, useState, useRef, useMemo } from 'react';
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

  /**
   * ARCHITECTURAL FIX: 
   * Instead of a COLLECTION_GROUP index which is complex to manage in prototype,
   * we use a single query on 'involvedTechnicianIds' array which tracks both lead and helper techs.
   * We then perform status filtering on the client-side to avoid COMPOSITE index requirements.
   */
  const workOrdersQuery = useMemoFirebase(() => {
    if (!db || isAuthLoading || !user || !currentUserRole) return null;

    const workOrdersCollection = collection(db, 'work_orders');
    
    // If filtering for a specific tech (like lead or helper), use the unified 'involved' array.
    if (assignedToFilter !== 'All') {
      return query(workOrdersCollection, where('involvedTechnicianIds', 'array-contains', assignedToFilter));
    }
    
    // Otherwise return everything (Admins)
    return query(workOrdersCollection);

  }, [db, assignedToFilter, user, isAuthLoading, currentUserRole]);

  const { data: allFetchedWorkOrders, isLoading: isWorkOrdersLoading } = useCollection<WorkOrder>(workOrdersQuery);

  // Client-side filtering for status to ensure Zero-Config (no composite indexes needed)
  const combinedWorkOrders = useMemo(() => {
    if (!allFetchedWorkOrders) return [];
    
    return allFetchedWorkOrders.filter(wo => {
      // Admin filter
      if (statusFilter === 'All' && currentUserRole?.name !== 'Technician') return true;
      
      // Tech default view filter (hide completed)
      if (statusFilter === 'All' && currentUserRole?.name === 'Technician') {
        return ['Open', 'In Progress', 'On Hold', 'Review'].includes(wo.status);
      }
      
      // Specific status filter
      if (statusFilter !== 'All') {
        return wo.status === statusFilter;
      }
      
      return true;
    });
  }, [allFetchedWorkOrders, statusFilter, currentUserRole]);
  
  // PM Work Orders Query
  const pmWorkOrdersQuery = useMemoFirebase(() => {
      if (!db || isAuthLoading || !user || !currentUserRole) return null;
      
      const pmCollection = collection(db, 'pm_work_orders');
      
      // For PMs, we still check lead technician or fetch all
      if (assignedToFilter !== 'All') {
        return query(pmCollection, where('assignedTechnicianId', '==', assignedToFilter));
      }
      return query(pmCollection);
  }, [db, assignedToFilter, user, isAuthLoading, currentUserRole]);

  const { data: rawPmWorkOrders, isLoading: isPmLoading } = useCollection<PmWorkOrder>(pmWorkOrdersQuery);

  // Client-side status filter for PMs
  const pmWorkOrders = useMemo(() => {
    if (!rawPmWorkOrders) return [];
    return rawPmWorkOrders.filter(wo => {
      if (statusFilter === 'All' && currentUserRole?.name === 'Technician') {
        return ['Scheduled', 'In Progress', 'Submitted For Review'].includes(wo.status);
      }
      if (statusFilter !== 'All') {
        let pmStatus = statusFilter;
        if (statusFilter === 'Open') pmStatus = 'Scheduled';
        if (statusFilter === 'Review') pmStatus = 'Submitted For Review';
        return wo.status === pmStatus;
      }
      return true;
    });
  }, [rawPmWorkOrders, statusFilter, currentUserRole]);

  // Core Data Fetching (Techs, Sites, Clients)
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
        initialWorkOrders={combinedWorkOrders} 
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
