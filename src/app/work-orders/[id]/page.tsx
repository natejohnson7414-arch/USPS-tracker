
'use client';

import React, { useEffect, useState } from 'react';
import { getWorkOrderById, getTechnicians } from '@/lib/data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useFirestore } from '@/firebase';
import type { WorkOrder, Technician } from '@/lib/types';

export default function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const db = useFirestore();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!db) return;
      setIsLoading(true);
      const [fetchedWorkOrder, fetchedTechnicians] = await Promise.all([
        getWorkOrderById(db, params.id),
        getTechnicians(db),
      ]);
      
      if (!fetchedWorkOrder) {
        notFound();
        return;
      }

      setWorkOrder(fetchedWorkOrder);
      setTechnicians(fetchedTechnicians);
      setIsLoading(false);
    };
    fetchData();
  }, [db, params.id]);

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
