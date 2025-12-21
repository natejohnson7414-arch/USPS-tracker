
'use client';
import React, { useEffect, useState, useRef } from 'react';
import { getWorkOrders, getTechnicians, seedDatabase } from '@/lib/data';
import { DashboardClient } from './dashboard-client';
import { MainLayout } from '@/components/main-layout';
import type { WorkOrder, Technician } from '@/lib/types';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';

export default function DashboardPage() {
  const db = useFirestore();
  const { user } = useUser();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const hasSeeded = useRef(false);
  
  const workOrdersQuery = query(collection(db, 'work_orders'));
  const { data: workOrders, isLoading } = useCollection<WorkOrder>(workOrdersQuery);

  useEffect(() => {
    const fetchTechniciansAndSeed = async () => {
      if (user?.email === 'admin@crawford-company.com' && !isLoading && workOrders?.length === 0 && !hasSeeded.current) {
        hasSeeded.current = true; // Prevents re-seeding on re-renders
        await seedDatabase(db);
        // After seeding, refetch technicians to display them correctly
        const fetchedTechnicians = await getTechnicians(db);
        setTechnicians(fetchedTechnicians);
      } else {
         const fetchedTechnicians = await getTechnicians(db);
         setTechnicians(fetchedTechnicians);
      }
    };
    if (db && user) {
        fetchTechniciansAndSeed();
    }
  }, [db, user, isLoading, workOrders]);

  if (isLoading) {
    return (
        <MainLayout>
            <div className="flex items-center justify-center h-full">
                <p>Loading work orders...</p>
            </div>
        </MainLayout>
    )
  }

  return (
    <MainLayout>
      <DashboardClient initialWorkOrders={workOrders || []} technicians={technicians} />
    </MainLayout>
  );
}
