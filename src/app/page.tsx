
'use client';
import React, { useEffect, useState, useRef } from 'react';
import { getTechnicians, seedDatabase } from '@/lib/data';
import { DashboardClient } from './dashboard-client';
import { MainLayout } from '@/components/main-layout';
import type { WorkOrder, Technician } from '@/lib/types';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';

export default function DashboardPage() {
  const db = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isTechniciansLoading, setIsTechniciansLoading] = useState(true);
  const hasSeeded = useRef(false);

  // Memoize the query to prevent re-creating it on every render
  // Only create the query if we have a user.
  const workOrdersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'work_orders'));
  }, [db, user]);

  const { data: workOrders, isLoading: isWorkOrdersLoading } = useCollection<WorkOrder>(workOrdersQuery);

  useEffect(() => {
    const fetchTechnicians = async () => {
      // Only fetch if we have a user
      if (!db || !user) return;
      setIsTechniciansLoading(true);
      const fetchedTechnicians = await getTechnicians(db);
      setTechnicians(fetchedTechnicians);
      setIsTechniciansLoading(false);
    };
    
    fetchTechnicians();
  }, [db, user]);

  useEffect(() => {
    const seed = async () => {
      // Ensure all conditions are met before seeding
      if (
        db &&
        user &&
        user.email === 'admin@crawford-company.com' &&
        !isWorkOrdersLoading &&
        workOrders?.length === 0 &&
        !hasSeeded.current
      ) {
        hasSeeded.current = true; // Prevent re-seeding
        console.log("Seeding database...");
        await seedDatabase(db);
      }
    };

    seed();
    // This effect should only depend on the data it needs to decide *whether* to seed,
    // not the data that changes *as a result* of other operations.
  }, [db, user, workOrders, isWorkOrdersLoading]);


  const isLoading = isAuthLoading || isWorkOrdersLoading || isTechniciansLoading;

  if (isLoading) {
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
      <DashboardClient initialWorkOrders={workOrders || []} technicians={technicians} />
    </MainLayout>
  );
}
