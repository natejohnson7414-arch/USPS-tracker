
'use client';

import React, { useEffect, useState, useMemo, FormEvent } from 'react';
import { getTechnicians, getWorkOrderById, getWorkSites, getClients, getTrainingRecordsByWorkOrderId, getTimeEntriesByWorkOrder, getTechnicianById } from '@/lib/data';
import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ban, Pencil, Save, Printer } from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client, TrainingRecord, TimeEntry } from '@/lib/types';
import { doc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, deleteImage } from '@/firebase/storage';
import { MapProviderSelection } from '@/components/map-provider-selection';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SignaturePad } from '@/components/signature-pad';
import { useTechnician as useRoleData } from '@/hooks/use-technician';
import { WorkOrderEditForm } from '@/components/work-order-edit-form';

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { role: currentUserRole } = useRoleData();


  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  
  const [tempOnArrival, setTempOnArrival] = useState('');
  const [tempOnLeaving, setTempOnLeaving] = useState('');
  
  const workOrderDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'work_orders', id);
  }, [db, id]);

  const fetchData = async () => {
      if (!db || !user) return;
      setIsLoading(true);
      try {
        const [
            fetchedTechnicians, 
            fetchedWorkOrder, 
            fetchedWorkSites, 
            fetchedClients,
            fetchedTrainingRecords,
            fetchedTimeEntries
        ] = await Promise.all([
          getTechnicians(db),
          getWorkOrderById(db, id),
          getWorkSites(db),
          getClients(db),
          getTrainingRecordsByWorkOrderId(db, id),
          getTimeEntriesByWorkOrder(db, id)
        ]);

        setTechnicians(fetchedTechnicians);
        setWorkSites(fetchedWorkSites);
        setClients(fetchedClients);
        setTrainingRecords(fetchedTrainingRecords);
        setTimeEntries(fetchedTimeEntries);
        
        if (fetchedWorkOrder) {
            setWorkOrder(fetchedWorkOrder);
            setTempOnArrival(fetchedWorkOrder.tempOnArrival || '');
            setTempOnLeaving(fetchedWorkOrder.tempOnLeaving || '');
        } else {
            setWorkOrder(null);
            notFound();
        }

      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        setWorkOrder(null);
        notFound();
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchData();
  }, [db, id, user]);

  const handleDirectionsClick = (workSite: WorkSite) => {
    if (!workSite.address) return;
    const fullAddress = [workSite.address, workSite.city, workSite.state].filter(Boolean).join(', ');
    setSelectedAddress(fullAddress);
  };

  const handleNoteAdded = async (newNote: Omit<WorkOrderNote, 'id'> & { photoFiles: File[] }) => {
    if (!db || !user || !workOrderDocRef || !workOrder) return;
    const notesColRef = collection(workOrderDocRef, 'updates');
    setIsAddingNote(true);

    try {
        const photoUrls = await Promise.all(
            newNote.photoFiles.map(file => uploadImage(file, `work-orders/${id}/${Date.now()}-${file.name}`))
        );

        const newNoteData = {
            workOrderId: workOrder.id,
            notes: newNote.text,
            createdAt: newNote.createdAt,
            photoUrls: photoUrls,
        };

        const docRef = await addDocumentNonBlocking(notesColRef, newNoteData);

        const optimisticNote: WorkOrderNote = {
            id: docRef.id,
            text: newNote.text,
            createdAt: newNote.createdAt,
            photoUrls: photoUrls,
        };
        
        // Optimistically update UI
        setWorkOrder(prev => {
            if (!prev) return null;
            const updatedNotes = [optimisticNote, ...(prev.notes || [])];
            return {
                ...prev,
                notes: updatedNotes,
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

  const handleTimeAdded = (newTimeEntry: TimeEntry) => {
    setTimeEntries(prev => [newTimeEntry, ...prev]);
  };
  
  const handleTempUpdate = async () => {
    if (!workOrderDocRef) return;
  
    try {
      await updateDocumentNonBlocking(workOrderDocRef, { tempOnArrival, tempOnLeaving });
      toast({ title: "Temperatures Updated", description: "The arrival and leaving temperatures have been saved." });
      setWorkOrder(prev => prev ? ({ ...prev, tempOnArrival, tempOnLeaving }) : null);
    } catch (error) {
      console.error("Failed to update temperatures", error);
    }
  };

  const handleFormSaved = () => {
      fetchData(); // Refetch all data to get the latest state
      setIsEditing(false);
  }

  const handleSignatureSave = async (signatureDataUrl: string) => {
      if(!workOrderDocRef || !workOrder) return;
      const signaturePath = `signatures/${workOrder.id}/${Date.now()}.png`;
      
      try {
        const signatureUrl = await uploadImage(
            await (await fetch(signatureDataUrl)).blob(), 
            signaturePath
        );

        const sigDate = new Date().toISOString();
        
        await updateDocumentNonBlocking(workOrderDocRef, {
            customerSignatureUrl: signatureUrl,
            signatureDate: sigDate
        });
        
        setWorkOrder(prev => prev ? ({ ...prev, customerSignatureUrl: signatureUrl, signatureDate: sigDate }) : null);

        toast({ title: "Signature Saved", description: "The customer signature has been saved." });
        setIsSignatureDialogOpen(false);
      } catch (error) {
        console.error("Error saving signature:", error);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the signature.' });
      }
  };
  
   const handleNotePhotoDelete = async (noteId: string, photoUrl: string) => {
    if (!db || !workOrder) return;
    
    const noteRef = doc(db, 'work_orders', workOrder.id, 'updates', noteId);
    
    // Optimistically update UI
    const originalNotes = workOrder.notes;
    const updatedNotes = workOrder.notes.map(note => {
      if (note.id === noteId) {
        return { ...note, photoUrls: note.photoUrls?.filter(url => url !== photoUrl) };
      }
      return note;
    });
    setWorkOrder(prev => prev ? ({ ...prev, notes: updatedNotes }) : null);

    try {
        await deleteImage(photoUrl); // Delete from Storage
        const updatedNote = updatedNotes.find(n => n.id === noteId);
        if(updatedNote) {
            await updateDocumentNonBlocking(noteRef, { photoUrls: updatedNote.photoUrls || [] }); // Update Firestore
        }
        toast({ title: 'Photo Deleted', description: 'The photo has been removed.' });
    } catch (error) {
        console.error("Error deleting photo:", error);
        toast({ variant: 'destructive', title: 'Deletion Failed', description: 'Could not delete the photo.' });
        // Revert UI if error occurs
        setWorkOrder(prev => prev ? ({...prev, notes: originalNotes}) : null);
    }
  };

  const handleNoteDelete = (noteId: string) => {
    if (!db || !workOrder) return;

    const noteToDelete = workOrder.notes.find(note => note.id === noteId);
    if (!noteToDelete) return;

    // Optimistically remove from UI
    const originalNotes = workOrder.notes;
    setWorkOrder(prev => prev ? ({ ...prev, notes: prev.notes.filter(n => n.id !== noteId) }) : null);

    const noteRef = doc(db, 'work_orders', workOrder.id, 'updates', noteId);
    
    // Delete Firestore document
    deleteDocumentNonBlocking(noteRef)
        .then(() => {
            // After successful Firestore deletion, delete associated photos from Storage
            const photoDeletePromises = (noteToDelete.photoUrls || []).map(url => deleteImage(url));
            return Promise.all(photoDeletePromises);
        })
        .then(() => {
            toast({ title: 'Note Deleted', description: 'The note and its photos have been removed.' });
        })
        .catch(error => {
            console.error("Error deleting note:", error);
            toast({ variant: 'destructive', title: 'Deletion Failed', description: 'Could not delete the note.' });
             // Revert UI if error occurs
            setWorkOrder(prev => prev ? ({...prev, notes: originalNotes}) : null);
        });
  };

  const handleTimeEntryDelete = (timeEntryId: string) => {
    if (!db) return;

    // Optimistically remove from UI
    const originalTimeEntries = timeEntries;
    setTimeEntries(prev => prev.filter(t => t.id !== timeEntryId));

    const timeEntryRef = doc(db, 'time_entries', timeEntryId);
    deleteDocumentNonBlocking(timeEntryRef)
      .then(() => {
        toast({ title: 'Time Entry Deleted' });
      })
      .catch(error => {
        console.error("Error deleting time entry:", error);
        toast({ variant: 'destructive', title: 'Deletion Failed' });
        // Revert on error
        setTimeEntries(originalTimeEntries);
      });
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

  const isTechnician = currentUserRole?.name === 'Technician';

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="mb-6 flex justify-between items-center gap-4">
            <Button variant="outline" asChild>
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
             <div className="flex items-center gap-2">
                {!isTechnician && (
                    <Button variant="outline" asChild>
                        <Link href={`/work-orders/${id}/report`} target="_blank">
                            <Printer className="mr-2 h-4 w-4" />
                            Report
                        </Link>
                    </Button>
                )}

                {!isEditing && !isTechnician && (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                )}
            </div>
        </div>
        <div className="pb-24">
            {isEditing ? (
                 <WorkOrderEditForm 
                    workOrder={workOrder}
                    technicians={technicians}
                    workSites={workSites}
                    clients={clients}
                    onFormSaved={handleFormSaved}
                    onCancel={() => setIsEditing(false)}
                 />
            ) : (
                <WorkOrderDetails
                    workOrder={workOrder}
                    isTechnician={isTechnician}
                    trainingRecords={trainingRecords}
                    timeEntries={timeEntries}
                    onNoteAdded={handleNoteAdded}
                    onTimeAdded={handleTimeAdded}
                    onNotePhotoDelete={handleNotePhotoDelete}
                    onNoteDelete={handleNoteDelete}
                    onTimeEntryDelete={handleTimeEntryDelete}
                    isAddingNote={isAddingNote}
                    onDirectionsClick={handleDirectionsClick}
                    onSignatureSave={() => setIsSignatureDialogOpen(true)}
                    onTempUpdate={handleTempUpdate}
                    tempOnArrival={tempOnArrival}
                    setTempOnArrival={setTempOnArrival}
                    tempOnLeaving={tempOnLeaving}
                    setTempOnLeaving={setTempOnLeaving}
                />
            )}
        </div>
      </div>

       <MapProviderSelection 
            address={selectedAddress} 
            isOpen={!!selectedAddress} 
            onOpenChange={() => setSelectedAddress(null)} 
        />
        <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Customer Signature</DialogTitle>
                    <DialogDescription>Please sign in the box below.</DialogDescription>
                </DialogHeader>
                <SignaturePad 
                    onSave={handleSignatureSave}
                    onClear={() => {}}
                />
            </DialogContent>
        </Dialog>
    </MainLayout>
  );
}

    