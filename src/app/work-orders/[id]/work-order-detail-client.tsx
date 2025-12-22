'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getTechnicians, getWorkOrderById } from '@/lib/data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ban, Pencil, Save } from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import type { WorkOrder, Technician, WorkOrderNote } from '@/lib/types';
import { doc, collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface WorkOrderDetailClientProps {
  id: string;
}

export function WorkOrderDetailClient({ id }: WorkOrderDetailClientProps) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataChecked, setIsDataChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const workOrderDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'work_orders', id);
  }, [db, id]);

  const notesColRef = useMemoFirebase(() => {
    if (!workOrderDocRef) return null;
    return collection(workOrderDocRef, 'updates');
  }, [workOrderDocRef]);


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
        setWorkOrder(fetchedWorkOrder || null);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        setWorkOrder(null);
      } finally {
        setIsLoading(false);
        setIsDataChecked(true);
      }
    };
    fetchData();
  }, [db, id, user]);
  
  useEffect(() => {
    if (!isLoading && isDataChecked && !workOrder) {
      notFound();
    }
  }, [isLoading, isDataChecked, workOrder]);

  const handleNoteAdded = (newNote: WorkOrderNote) => {
    if (!db || !user) return;

    const newNoteData = {
        workOrderId: workOrder?.id,
        technicianId: user.uid,
        updateDate: newNote.createdAt,
        notes: newNote.text,
        photoUrls: newNote.photoUrls || [],
    };
    
    if (notesColRef) {
        addDoc(notesColRef, newNoteData); // Non-blocking
    }
    
    // Optimistically update UI
    setWorkOrder(prev => {
        if (!prev) return null;
        return {
            ...prev,
            notes: [newNote, ...prev.notes],
        };
    });
  };

  const handleWorkOrderUpdate = (updatedData: Partial<WorkOrder>) => {
    if (!workOrderDocRef) return;
    
    // Non-blocking update to Firestore
    updateDocumentNonBlocking(workOrderDocRef, updatedData);

    // Optimistically update the local state
    setWorkOrder(prev => {
        if (!prev) return null;
        return { ...prev, ...updatedData };
    });
    
    toast({ title: "Work Order Saved", description: "Changes have been saved successfully." });
    setIsEditing(false);
  };
  
   const handleNotePhotoDelete = (noteId: string, photoUrl: string) => {
    if (!db || !workOrder) return;

    // Optimistically update UI
    const updatedNotes = workOrder.notes.map(note => {
      if (note.id === noteId) {
        return { ...note, photoUrls: note.photoUrls?.filter(url => url !== photoUrl) };
      }
      return note;
    });
    setWorkOrder(prev => prev ? ({ ...prev, notes: updatedNotes }) : null);

    // Update Firestore
    const noteRef = doc(db, 'work_orders', workOrder.id, 'updates', noteId);
    const updatedNote = updatedNotes.find(n => n.id === noteId);
    if(updatedNote) {
      updateDocumentNonBlocking(noteRef, { photoUrls: updatedNote.photoUrls || [] });
    }
  };


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
        <div className="mb-6 flex justify-between items-center">
            <Button variant="outline" asChild>
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
             <div className="flex gap-2">
              {isEditing ? (
                  <>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      <Ban className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    <Button form="work-order-form">
                      <Save className="mr-2 h-4 w-4" /> Save
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                )}
            </div>
        </div>
        <WorkOrderDetails
          initialWorkOrder={workOrder}
          technicians={technicians}
          isEditing={isEditing}
          onWorkOrderUpdate={handleWorkOrderUpdate}
          onNoteAdded={handleNoteAdded}
          onNotePhotoDelete={handleNotePhotoDelete}
        />
      </div>
    </MainLayout>
  );
}
