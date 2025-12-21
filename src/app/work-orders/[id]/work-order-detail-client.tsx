
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getTechnicians } from '@/lib/data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import type { WorkOrder, Technician, WorkOrderNote } from '@/lib/types';
import { doc, collection, query } from 'firebase/firestore';

interface WorkOrderDetailClientProps {
  id: string;
}

export function WorkOrderDetailClient({ id }: WorkOrderDetailClientProps) {
  const db = useFirestore();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const workOrderRef = useMemo(() => {
    if (!db) return null;
    return doc(db, 'work_orders', id);
  }, [db, id]);

  const notesQuery = useMemo(() => {
    if (!workOrderRef) return null;
    return query(collection(workOrderRef, 'updates'));
  }, [workOrderRef]);

  const { data: workOrderData, isLoading: isWorkOrderLoading } = useDoc<Omit<WorkOrder, 'notes'>>(workOrderRef);
  const { data: notesData, isLoading: areNotesLoading } = useCollection<WorkOrderNote>(notesQuery);

  const workOrder = useMemo(() => {
    if (!workOrderData) return null;
    return {
      ...workOrderData,
      notes: notesData ? notesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : []
    };
  }, [workOrderData, notesData]);


  useEffect(() => {
    const fetchData = async () => {
      if (!db) return;
      setIsLoading(true);
      const fetchedTechnicians = await getTechnicians(db);
      setTechnicians(fetchedTechnicians);
      setIsLoading(false);
    };
    fetchData();
  }, [db]);

  useEffect(() => {
    if(!isWorkOrderLoading && !workOrderData) {
        notFound();
    }
  }, [isWorkOrderLoading, workOrderData]);

  const isPageLoading = isLoading || isWorkOrderLoading || areNotesLoading;

  if (isPageLoading || !workOrder) {
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
