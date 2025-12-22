
'use client';

import React, { useEffect, useState, useMemo, FormEvent } from 'react';
import { getTechnicians, getWorkOrderById, getWorkSites } from '@/lib/data';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ban, Pencil, Save } from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite } from '@/lib/types';
import { doc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/firebase/storage';

export default function WorkOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataChecked, setIsDataChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  
  // Editable fields state - initialized when workOrder is loaded
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<WorkOrder['priority']>('Low');
  const [editStatus, setEditStatus] = useState<WorkOrder['status']>('Open');
  const [editAssignedTechnicianId, setEditAssignedTechnicianId] = useState<string | undefined>(undefined);
  const [editWorkSiteId, setEditWorkSiteId] = useState<string | undefined>(undefined);
  const [editDueDate, setEditDueDate] = useState<Date | undefined>(undefined);
  const [editCustomerOrderId, setEditCustomerOrderId] = useState<string | undefined>(undefined);


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
        const [fetchedTechnicians, fetchedWorkOrder, fetchedWorkSites] = await Promise.all([
          getTechnicians(db),
          getWorkOrderById(db, id),
          getWorkSites(db),
        ]);

        setTechnicians(fetchedTechnicians);
        setWorkSites(fetchedWorkSites);
        
        if (fetchedWorkOrder) {
            setWorkOrder(fetchedWorkOrder);
            // Initialize edit state here
            setEditTitle(fetchedWorkOrder.title);
            setEditDescription(fetchedWorkOrder.description);
            setEditPriority(fetchedWorkOrder.priority);
            setEditStatus(fetchedWorkOrder.status);
            setEditAssignedTechnicianId(fetchedWorkOrder.assignedTechnicianId);
            setEditWorkSiteId(fetchedWorkOrder.workSiteId);
            setEditDueDate(new Date(fetchedWorkOrder.dueDate));
            setEditCustomerOrderId(fetchedWorkOrder.customerOrderId);
        } else {
            setWorkOrder(null);
        }

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
  
  const resetEditState = () => {
    if (!workOrder) return;
    setEditTitle(workOrder.title);
    setEditDescription(workOrder.description);
    setEditPriority(workOrder.priority);
    setEditStatus(workOrder.status);
    setEditAssignedTechnicianId(workOrder.assignedTechnicianId);
    setEditWorkSiteId(workOrder.workSiteId);
    setEditDueDate(new Date(workOrder.dueDate));
    setEditCustomerOrderId(workOrder.customerOrderId);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    resetEditState();
  };

  const handleNoteAdded = async (newNote: Omit<WorkOrderNote, 'id' | 'authorId'> & { photoFiles: File[] }) => {
    if (!db || !user || !notesColRef || !workOrder) return;
    setIsAddingNote(true);

    try {
        const photoUrls = await Promise.all(
            newNote.photoFiles.map(file => uploadImage(file, `work-orders/${id}/${file.name}`))
        );

        const newNoteData = {
            workOrderId: workOrder.id,
            technicianId: user.uid,
            updateDate: newNote.createdAt,
            notes: newNote.text,
            photoUrls: photoUrls,
        };

        const newDocRef = await addDocumentNonBlocking(notesColRef, newNoteData);

        const optimisticNote: WorkOrderNote = {
            id: newDocRef.id,
            authorId: user.uid,
            text: newNote.text,
            createdAt: newNote.createdAt,
            photoUrls: photoUrls,
        };
        
        // Optimistically update UI
        setWorkOrder(prev => {
            if (!prev) return null;
            return {
                ...prev,
                notes: [optimisticNote, ...prev.notes],
            };
        });
        toast({ title: "Note Added", description: "Your note and photos have been added." });

    } catch (error) {
        console.error("Error adding note:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not add your note. Please try again." });
    } finally {
        setIsAddingNote(false);
    }
  };
  
  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!workOrderDocRef || !editDueDate) return;
    
    const updatedData: Partial<WorkOrder> = {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
        status: editStatus,
        assignedTechnicianId: editAssignedTechnicianId,
        workSiteId: editWorkSiteId,
        dueDate: editDueDate.toISOString(),
        customerOrderId: editCustomerOrderId
    };

    updateDocumentNonBlocking(workOrderDocRef, updatedData);

    const updatedWorkSite = workSites.find(ws => ws.id === editWorkSiteId);

    // Optimistically update the local state
    setWorkOrder(prev => {
        if (!prev) return null;
        return { ...prev, ...updatedData, workSite: updatedWorkSite } as WorkOrder;
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
      // Note: This doesn't delete the photo from Storage. A more complete solution would.
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
                    <Button variant="outline" onClick={handleCancelEdit}>
                      <Ban className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    <Button form="work-order-form" type="submit">
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
          workSites={workSites}
          isEditing={isEditing}
          onNoteAdded={handleNoteAdded}
          onNotePhotoDelete={handleNotePhotoDelete}
          isAddingNote={isAddingNote}
          editableFields={{
            title: editTitle,
            setTitle: setEditTitle,
            description: editDescription,
            setDescription: setEditDescription,
            priority: editPriority,
            setPriority: setEditPriority,
            status: editStatus,
            setStatus: setEditStatus,
            assignedTechnicianId: editAssignedTechnicianId,
            setAssignedTechnicianId: setEditAssignedTechnicianId,
            workSiteId: editWorkSiteId,
            setWorkSiteId: setEditWorkSiteId,
            dueDate: editDueDate,
            setDueDate: setEditDueDate,
            customerOrderId: editCustomerOrderId,
            setCustomerOrderId: setEditCustomerOrderId,
          }}
          onWorkOrderUpdate={handleSave}
        />
      </div>
    </MainLayout>
  );
}

    