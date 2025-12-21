
'use client';
import React, { useEffect, useState, useRef } from 'react';
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
  
  const workOrdersQuery = query(collection(db, 'work_orders'));
  const { data: workOrders, isLoading: isWorkOrdersLoading } = useCollection<WorkOrder>(workOrdersQuery);

  useEffect(() => {
    const fetchTechniciansAndSeed = async () => {
        setIsTechniciansLoading(true);
        if (user?.email === 'admin@crawford-company.com' && !isWorkOrdersLoading && workOrders?.length === 0 && !hasSeeded.current) {
            hasSeeded.current = true; // Prevents re-seeding on re-renders
            console.log("Seeding database...");
            await seedDatabase(db);
            const fetchedTechnicians = await getTechnicians(db);
            setTechnicians(fetchedTechnicians);
        } else {
            const fetchedTechnicians = await getTechnicians(db);
            setTechnicians(fetchedTechnicians);
        }
        setIsTechniciansLoading(false);
    };
    if (db && user) {
        fetchTechniciansAndSeed();
    }
  }, [db, user, isWorkOrdersLoading, workOrders]);

  const isLoading = isWorkOrdersLoading || isTechniciansLoading;

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
