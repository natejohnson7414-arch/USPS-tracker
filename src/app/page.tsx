
'use client';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { getTechnicians, seedDatabase } from '@/lib/data';
import { DashboardClient } from './dashboard-client';
import { MainLayout } from '@/components/main-layout';
import type { WorkOrder, Technician } from '@/lib/types';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';

export default function DashboardPage() {
  const db = useFirestore();
  const { user } = useUser();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isTechniciansLoading, setIsTechniciansLoading] = useState(true);
  const hasSeeded = useRef(false);

  // Memoize the query to prevent re-creating it on every render
  const workOrdersQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'work_orders'));
  }, [db]);

  const { data: workOrders, isLoading: isWorkOrdersLoading } = useCollection<WorkOrder>(workOrdersQuery);

  useEffect(() => {
    const fetchTechniciansAndSeed = async () => {
      if (!db || !user) return;

      setIsTechniciansLoading(true);
      
      // Check if seeding is needed
      if (user.email === 'admin@crawford-company.com' && !isWorkOrdersLoading && workOrders?.length === 0 && !hasSeeded.current) {
        hasSeeded.current = true; // Prevents re-seeding
        console.log("Seeding database...");
        await seedDatabase(db);
      }
      
      // Fetch technicians after potentially seeding
      const fetchedTechnicians = await getTechnicians(db);
      setTechnicians(fetchedTechnicians);
      setIsTechniciansLoading(false);
    };
    
    fetchTechniciansAndSeed();
  }, [db, user, workOrders, isWorkOrdersLoading]);

  const isLoading = isWorkOrdersLoading || isTechniciansLoading;

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
