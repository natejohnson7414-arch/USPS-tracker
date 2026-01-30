
'use client';

import React, { useEffect, useState, useMemo, FormEvent } from 'react';
import { getTechnicians, getWorkOrderById, getWorkSites, getClients, getTrainingRecordsByWorkOrderId, getTimeEntriesByWorkOrder, getTechnicianById, deleteTrainingRecord, updateWorkOrderStatus, addWorkHistoryItem } from '@/lib/data';
import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ban, Pencil, Save, Printer, Download } from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client, TrainingRecord, TimeEntry, Activity, ActivityHistoryItem } from '@/lib/types';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SignaturePad } from '@/components/signature-pad';
import { useTechnician as useRoleData } from '@/hooks/use-technician';
import { WorkOrderEditForm } from '@/components/work-order-edit-form';
import { ReportPreviewDialog } from '@/components/report-preview-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isSavingPhotos, setIsSavingPhotos] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  
  const [tempOnArrival, setTempOnArrival] = useState('');
  const [tempOnLeaving, setTempOnLeaving] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  
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
            setActivities(fetchedWorkOrder.activities || []);
            setTempOnArrival(fetchedWorkOrder.tempOnArrival || '');
            setTempOnLeaving(fetchedWorkOrder.tempOnLeaving || '');
            setContactInfo(fetchedWorkOrder.contactInfo || '');
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

  const handleNoteAdded = async (newNote: Omit<WorkOrderNote, 'id' | 'photoUrls'>) => {
    if (!db || !user || !workOrderDocRef || !workOrder) return;
    const notesColRef = collection(workOrderDocRef, 'updates');
    setIsAddingNote(true);

    try {
        const newNoteData = {
            workOrderId: workOrder.id,
            notes: newNote.text,
            createdAt: newNote.createdAt,
        };

        const docRef = await addDocumentNonBlocking(notesColRef, newNoteData);
        
        const technician = await getTechnicianById(db, user.uid);
        const historyItem: Omit<ActivityHistoryItem, 'id' | 'timestamp'> = {
            type: 'note',
            text: `Note added: "${newNote.text.substring(0, 50)}${newNote.text.length > 50 ? '...' : ''}"`,
            authorId: user.uid,
            authorName: technician?.name || user.email!,
        };
        await addWorkHistoryItem(db, workOrder.id, historyItem);

        const optimisticNote: WorkOrderNote = {
            id: docRef.id,
            text: newNote.text,
            createdAt: newNote.createdAt,
        };
        
        setWorkOrder(prev => {
            if (!prev) return null;
            const updatedNotes = [optimisticNote, ...(prev.notes || [])];
            return { ...prev, notes: updatedNotes };
        });
        toast({ title: "Note Added", description: "Your note has been added." });
        fetchData();

    } catch (error) {
        console.error("Error adding note:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not add your note. Please try again." });
    } finally {
        setIsAddingNote(false);
    }
  };

  const handlePhotosAdded = async (type: 'before' | 'after', files: File[]) => {
    if (!db || !workOrder || files.length === 0) return;
    
    setIsSavingPhotos(true);
    const toastId = toast({ title: `Uploading ${files.length} ${type} photo(s)...` });

    try {
      const uploadPromises = files.map(file => 
        uploadImage(file, `work-orders/${workOrder.id}/${type}/${Date.now()}-${file.name}`)
      );
      const uploadedUrls = await Promise.all(uploadPromises);

      const fieldToUpdate = type === 'before' ? 'beforePhotoUrls' : 'afterPhotoUrls';
      const currentUrls = workOrder[fieldToUpdate] || [];
      const newUrls = [...currentUrls, ...uploadedUrls];

      await updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), {
        [fieldToUpdate]: newUrls,
      });

      setWorkOrder(prev => prev ? { ...prev, [fieldToUpdate]: newUrls } : null);
      
      toastId.dismiss();
      toast({ title: "Photos Uploaded", description: `${files.length} photo(s) have been added.` });

    } catch (error) {
      console.error(`Error adding ${type} photos:`, error);
      toastId.dismiss();
      toast({ variant: "destructive", title: "Upload Failed", description: "Could not upload photos." });
    } finally {
      setIsSavingPhotos(false);
    }
  };

  const handlePhotoDeleted = async (type: 'before' | 'after', urlToDelete: string) => {
    if (!db || !workOrder) return;

    const fieldToUpdate = type === 'before' ? 'beforePhotoUrls' : 'afterPhotoUrls';
    const currentUrls = workOrder[fieldToUpdate] || [];
    const newUrls = currentUrls.filter(url => url !== urlToDelete);

    setWorkOrder(prev => prev ? { ...prev, [fieldToUpdate]: newUrls } : null);

    try {
        await updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), { [fieldToUpdate]: newUrls });
        await deleteImage(urlToDelete);
        toast({ title: "Photo Deleted" });
    } catch(error) {
        console.error(`Error deleting ${type} photo:`, error);
        toast({ variant: "destructive", title: "Delete Failed", description: "Could not delete photo." });
        setWorkOrder(prev => prev ? { ...prev, [fieldToUpdate]: currentUrls } : null); // Revert
    }
  };


  const handleTimeAdded = async (newTimeEntry: TimeEntry) => {
    setTimeEntries(prev => [newTimeEntry, ...prev]);
    if (!db || !user || !workOrder) return;

    const technician = await getTechnicianById(db, user.uid);
    const historyItem: Omit<ActivityHistoryItem, 'id' | 'timestamp'> = {
        type: 'time_log',
        text: `Logged ${newTimeEntry.hours.toFixed(2)} hours.`,
        authorId: user.uid,
        authorName: technician?.name || user.email!,
    };
    await addWorkHistoryItem(db, workOrder.id, historyItem);
    fetchData();
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
  
  const handleContactInfoUpdate = async () => {
    if (!workOrderDocRef) return;
    
    try {
      await updateDocumentNonBlocking(workOrderDocRef, { contactInfo });
      toast({ title: "Customer Name Updated", description: "The customer's name has been saved." });
      setWorkOrder(prev => prev ? ({ ...prev, contactInfo }) : null);
    } catch (error) {
      console.error("Failed to update contact info", error);
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
            signatureDate: sigDate,
            contactInfo: contactInfo // Also save the name
        });
        
        setWorkOrder(prev => prev ? ({ ...prev, customerSignatureUrl: signatureUrl, signatureDate: sigDate, contactInfo }) : null);

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
  
  const handleTrainingRecordDelete = (recordId: string) => {
    if (!db) return;
    // Optimistic UI update
    setTrainingRecords(prev => prev.filter(r => r.id !== recordId));
    
    deleteTrainingRecord(db, recordId)
        .then(() => {
            toast({ title: 'Training Record Deleted' });
        })
        .catch(error => {
            console.error("Error deleting training record:", error);
            toast({ title: "Deletion Failed", variant: 'destructive' });
            fetchData(); // Re-fetch to revert optimistic update
        });
  }

  const handleAddActivity = async (newActivityData: Omit<Activity, 'id' | 'createdDate' | 'workOrderId'>) => {
    if (!db || !user || !workOrder) return;
    
    const activityData = {
        ...newActivityData,
        workOrderId: workOrder.id,
        createdDate: new Date().toISOString(),
    };
    
    const activitiesColRef = collection(db, 'work_orders', workOrder.id, 'activities');
    try {
        const docRef = await addDocumentNonBlocking(activitiesColRef, activityData);
        toast({ title: 'Activity Scheduled' });
        await updateWorkOrderStatus(db, workOrder.id);
        fetchData();
    } catch(error) {
        if (error instanceof Error && !error.message.includes('Missing or insufficient permissions')) {
            console.error("Error scheduling activity:", error);
            toast({ title: 'Error', description: 'Failed to schedule activity', variant: 'destructive' });
        }
    }
  };

  const handleUpdateActivityStatus = async (activityId: string, status: Activity['status']) => {
      if (!db || !workOrder) return;
      const activityRef = doc(db, 'work_orders', workOrder.id, 'activities', activityId);
      try {
          await updateDocumentNonBlocking(activityRef, { status });
          toast({ title: 'Activity Status Updated' });
          await updateWorkOrderStatus(db, workOrder.id);
          fetchData();
      } catch(error) {
        if (error instanceof Error && !error.message.includes('Missing or insufficient permissions')) {
          console.error("Error updating activity status:", error);
          toast({ title: 'Error', description: 'Failed to update activity status', variant: 'destructive' });
        }
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <Printer className="mr-2 h-4 w-4" />
                          Report
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/work-orders/${id}/report?action=print`)}>
                          <Printer className="mr-2 h-4 w-4" />
                          Print
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/work-orders/${id}/report?action=download`)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)}>
                          Preview
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                    onTrainingRecordDelete={handleTrainingRecordDelete}
                    timeEntries={timeEntries}
                    activities={activities}
                    onNoteAdded={handleNoteAdded}
                    onTimeAdded={handleTimeAdded}
                    onNotePhotoDelete={handleNotePhotoDelete}
                    onNoteDelete={handleNoteDelete}
                    onBeforePhotosAdded={(files) => handlePhotosAdded('before', files)}
                    onAfterPhotosAdded={(files) => handlePhotosAdded('after', files)}
                    onBeforePhotoDelete={(url) => handlePhotoDeleted('before', url)}
                    onAfterPhotoDelete={(url) => handlePhotoDeleted('after', url)}
                    onTimeEntryDelete={handleTimeEntryDelete}
                    isAddingNote={isAddingNote}
                    isSavingPhotos={isSavingPhotos}
                    onDirectionsClick={handleDirectionsClick}
                    onSignatureSave={() => setIsSignatureDialogOpen(true)}
                    onTempUpdate={handleTempUpdate}
                    tempOnArrival={tempOnArrival}
                    setTempOnArrival={setTempOnArrival}
                    tempOnLeaving={tempOnLeaving}
                    setTempOnLeaving={setTempOnLeaving}
                    contactInfo={contactInfo}
                    setContactInfo={setContactInfo}
                    onContactInfoUpdate={handleContactInfoUpdate}
                    onAddActivity={handleAddActivity}
                    onUpdateActivityStatus={handleUpdateActivityStatus}
                    technicians={technicians}
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
        <ReportPreviewDialog
            isOpen={isReportDialogOpen}
            onOpenChange={setIsReportDialogOpen}
            workOrderId={workOrder.id}
        />
    </MainLayout>
  );
}
