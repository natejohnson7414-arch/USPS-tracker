
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getTechnicians, getWorkOrderById } from '@/lib/data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import type { WorkOrder, Technician } from '@/lib/types';

interface WorkOrderDetailClientProps {
  id: string;
}

export function WorkOrderDetailClient({ id }: WorkOrderDetailClientProps) {
  const db = useFirestore();
  const { user } = useUser();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !user) return;
      setIsLoading(true);
      try {
        const [fetchedTechnicians, fetchedWorkOrder] = await Promise.all([
          getTechnicians(db),
          getWorkOrderById(db, id),
        ]);
        
        setTechnicians(fetchedTechnicians);

        if (fetchedWorkOrder) {
          setWorkOrder(fetchedWorkOrder);
        } else {
          notFound();
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
        notFound();
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [db, id, user]);


  if (isLoading || !workOrder) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <p>Loading work order details...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Button variant="outline" asChild>
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <WorkOrderDetails initialWorkOrder={workOrder} technicians={technicians} />
      </div>
    </MainLayout>
  );
}

    