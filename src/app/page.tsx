
'use client';
import React, { useEffect, useState, useRef } from 'react';
import { getTechnicians, seedDatabase, getWorkSites, getClients, getRoles, getTechnicianById } from '@/lib/data';
import { DashboardClient } from './dashboard-client';
import { MainLayout } from '@/components/main-layout';
import type { WorkOrder, Technician, WorkSite, Client, Role } from '@/lib/types';
import { useFirestore, useUser, useMemoFirebase, setDocumentNonBlocking, useCollection } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';

export default function DashboardPage() {
  const db = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasSeeded = useRef(false);

  // Memoize the query to prevent re-creating it on every render
  // Only create the query if we have a user.
  const workOrdersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'work_orders'));
  }, [db, user]);

  const { data: workOrders, isLoading: isWorkOrdersLoading } = useCollection<WorkOrder>(workOrdersQuery);

  useEffect(() => {
    const fetchCoreData = async () => {
      if (!db) return;
       try {
        const [fetchedTechnicians, fetchedWorkSites, fetchedClients] = await Promise.all([
          getTechnicians(db),
          getWorkSites(db),
          getClients(db),
        ]);
        setTechnicians(fetchedTechnicians);
        setWorkSites(fetchedWorkSites);
        setClients(fetchedClients);
      } catch (error) {
        console.error("Failed to fetch initial dashboard data:", error);
      }
    };
    
    const initializeApp = async () => {
      if (!db || !user || hasSeeded.current) return;
      
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
        await fetchCoreData();

      } catch (error) {
        console.error("Error during app initialization:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if(db && user) {
        initializeApp();
    } else if (!isAuthLoading) {
        // If auth is done and there's no user, we're not loading data.
        setIsLoading(false);
    }
  }, [db, user, isAuthLoading]);


  const isDataLoading = isAuthLoading || isLoading || isWorkOrdersLoading;

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
      />
    </MainLayout>
  );
}
