
'use client';
import React, { useEffect, useState, useRef } from 'react';
import { getTechnicians, seedDatabase, getWorkSites, getClients } from '@/lib/data';
import { DashboardClient } from './dashboard-client';
import { MainLayout } from '@/components/main-layout';
import type { WorkOrder, Technician, WorkSite, Client } from '@/lib/types';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';

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
    const fetchData = async () => {
      // Only fetch if we have a user
      if (!db || !user) return;
      setIsLoading(true);
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
      } finally {
        setIsLoading(false);
      }
    };
    
    // Seed the database if necessary, then fetch data
    const seedAndFetch = async () => {
       if (
        db &&
        user &&
        user.email === 'admin@crawford-company.com' &&
        !hasSeeded.current
      ) {
        hasSeeded.current = true; // Prevent re-seeding
        console.log("Checking if seeding is needed...");
        await seedDatabase(db);
      }
      await fetchData();
    }

    if(db && user) {
        seedAndFetch();
    }
    // This effect should only depend on the data it needs to decide *whether* to seed,
    // not the data that changes *as a result* of other operations.
  }, [db, user]);


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
