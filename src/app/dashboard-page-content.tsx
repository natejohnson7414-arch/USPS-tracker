
'use client';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { DashboardClient } from './dashboard-client';
import { MainLayout } from '@/components/main-layout';
import type { WorkOrder, Technician, WorkSite, Client, Role, PmWorkOrder, Activity } from '@/lib/types';
import { useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, collectionGroup, documentId } from 'firebase/firestore';
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

  // 1. Primary Query: Work orders where user is the lead (assignedTechnicianId)
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

  const { data: leadWorkOrders, isLoading: isLeadWorkOrdersLoading } = useCollection<WorkOrder>(workOrdersQuery);

  // 2. Activities Query: Find work orders where technician has a scheduled activity (even if not lead)
  const activitiesQuery = useMemoFirebase(() => {
    if (!db || isAuthLoading || !user || assignedToFilter === 'All') return null;
    return query(collectionGroup(db, 'activities'), where('technicianId', '==', assignedToFilter));
  }, [db, assignedToFilter, isAuthLoading, user]);

  const { data: techActivities, isLoading: isTechActivitiesLoading } = useCollection<Activity>(activitiesQuery);

  // 3. Extraction: Get unique Work Order IDs from activities
  const activityLinkedIds = useMemo(() => {
    if (!techActivities) return [];
    return Array.from(new Set(techActivities.map(a => a.workOrderId)));
  }, [techActivities]);

  // 4. Linked Work Orders Query: Fetch those specific jobs
  const activityLinkedWorkOrdersQuery = useMemoFirebase(() => {
    if (!db || activityLinkedIds.length === 0) return null;
    
    const filters: any[] = [where(documentId(), 'in', activityLinkedIds.slice(0, 30))];
    
    if (statusFilter === 'All' && currentUserRole?.name === 'Technician') {
      filters.push(where('status', 'in', ['Open', 'In Progress', 'On Hold']));
    } else if (statusFilter !== 'All') {
      filters.push(where('status', '==', statusFilter));
    }

    return query(collection(db, 'work_orders'), ...filters);
  }, [db, activityLinkedIds, statusFilter, currentUserRole]);

  const { data: activityWorkOrders, isLoading: isActivityWorkOrdersLoading } = useCollection<WorkOrder>(activityLinkedWorkOrdersQuery);

  // 5. De-duplicated Combination: Merge lead and activity jobs
  const combinedWorkOrders = useMemo(() => {
    const combined = [...(leadWorkOrders || []), ...(activityWorkOrders || [])];
    const seen = new Set();
    return combined.filter(wo => {
      if (seen.has(wo.id)) return false;
      seen.add(wo.id);
      return true;
    });
  }, [leadWorkOrders, activityWorkOrders]);
  
  // 6. PM Work Orders Query
  const pmWorkOrdersQuery = useMemoFirebase(() => {
      if (!db || isAuthLoading || !user || !currentUserRole) return null;
      
      const pmCollection = collection(db, 'pm_work_orders');
      const filters: any[] = [];

      if (assignedToFilter !== 'All') {
        filters.push(where('assignedTechnicianId', '==', assignedToFilter));
      }

      if (statusFilter === 'All' && currentUserRole.name === 'Technician') {
        filters.push(where('status', 'in', ['Scheduled', 'In Progress', 'Submitted For Review']));
      } else if (statusFilter !== 'All') {
        let pmStatus = statusFilter;
        if (statusFilter === 'Open') pmStatus = 'Scheduled';
        if (statusFilter === 'Review') pmStatus = 'Submitted For Review';
        filters.push(where('status', '==', pmStatus));
      }
      
      if (filters.length > 0) {
        return query(pmCollection, ...filters);
      }
      return query(pmCollection);
  }, [db, statusFilter, assignedToFilter, user, isAuthLoading, currentUserRole]);

  const { data: pmWorkOrders, isLoading: isPmLoading } = useCollection<PmWorkOrder>(pmWorkOrdersQuery);

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

  const isDataLoading = isAuthLoading || isLeadWorkOrdersLoading || isActivityWorkOrdersLoading || isTechActivitiesLoading || isRoleLoading || isTechniciansLoading || isWorkSitesLoading || isClientsLoading || isPmLoading;

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
