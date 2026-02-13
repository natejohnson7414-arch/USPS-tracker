'use client';
import React, { useEffect, useState, useRef } from 'react';
import { getTechnicians, seedDatabase, getWorkSites, getClients, getRoles, getTechnicianById } from '@/lib/data';
import { DashboardClient } from './dashboard-client';
import { MainLayout } from '@/components/main-layout';
import type { WorkOrder, Technician, WorkSite, Client, Role } from '@/lib/types';
import { useFirestore, useUser, useMemoFirebase, setDocumentNonBlocking, useCollection } from '@/firebase';
import { collection, query, doc, where } from 'firebase/firestore';
import { useTechnician } from '@/hooks/use-technician';

export default function DashboardPage() {
  const db = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const { role: currentUserRole, isLoading: isRoleLoading } = useTechnician();

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [assignedToFilter, setAssignedToFilter] = useState('All');
  const hasSeeded = useRef(false);
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
  // CRITICAL: We must wait for the user to be authenticated before creating the query.
  const workOrdersQuery = useMemoFirebase(() => {
    if (!db || isAuthLoading || !user) return null;

    let q = query(collection(db, 'work_orders'));

    const filters = [];
    if (statusFilter !== 'All') {
        filters.push(where('status', '==', statusFilter));
    }
    if (assignedToFilter !== 'All') {
        filters.push(where('assignedTechnicianId', '==', assignedToFilter));
    }
    
    if (filters.length > 0) {
        q = query(collection(db, 'work_orders'), ...filters);
    }
    
    return q;
  }, [db, statusFilter, assignedToFilter, user, isAuthLoading]);

  const { data: workOrders, isLoading: isWorkOrdersLoading } = useCollection<WorkOrder>(workOrdersQuery);

  useEffect(() => {
    const initializeApp = async () => {
      // If we don't have what we need, or if we've already seeded, we can exit.
      // We also check isAuthLoading to ensure we don't prematurely stop loading.
      if (!db || !user || hasSeeded.current) {
        if (!isAuthLoading) {
            setIsLoading(false);
        }
        return;
      }
      
      setIsLoading(true);
      hasSeeded.current = true; // Prevents this from running multiple times

      try {
        // Step 1: Ensure admin user exists if logged in as admin
        if (user.email === 'admin@crawford-company.com') {
          const adminProfile = await getTechnicianById(db, user.uid);
          if (!adminProfile) {
            console.log("Admin profile not found, creating one...");
            const roles = await getRoles(db);
            const adminRole = roles.find(r => r.name === 'Administrator');
            if (adminRole) {
              const adminData = {
                id: user.uid,
                firstName: 'Admin',
                lastName: 'User',
                email: user.email,
                roleId: adminRole.id,
                disabled: false,
              };
              await setDocumentNonBlocking(doc(db, 'technicians', user.uid), adminData);
            }
          }
        }
        
        // Step 2: Seed database if necessary
        await seedDatabase(db);
        
        // Step 3: Fetch all necessary data for the dashboard
        const [fetchedTechnicians, fetchedWorkSites, fetchedClients] = await Promise.all([
          getTechnicians(db),
          getWorkSites(db),
          getClients(db),
        ]);
        setTechnicians(fetchedTechnicians);
        setWorkSites(fetchedWorkSites);
        setClients(fetchedClients);

      } catch (error) {
        console.error("Error during app initialization:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();

  }, [db, user, isAuthLoading]);


  const isDataLoading = isAuthLoading || isLoading || isWorkOrdersLoading || isRoleLoading;

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
