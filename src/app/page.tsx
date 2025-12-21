
'use client';
import React, { useEffect, useState } from 'react';
import { getWorkOrders, getTechnicians } from '@/lib/data';
import { DashboardClient } from './dashboard-client';
import { MainLayout } from '@/components/main-layout';
import type { WorkOrder, Technician } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';

export default function DashboardPage() {
  const db = useFirestore();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  const workOrdersQuery = query(collection(db, 'work_orders'));
  const { data: workOrders, isLoading } = useCollection<WorkOrder>(workOrdersQuery);

  useEffect(() => {
    const fetchTechnicians = async () => {
      const fetchedTechnicians = await getTechnicians(db);
      setTechnicians(fetchedTechnicians);
    };
    fetchTechnicians();
  }, [db]);

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
