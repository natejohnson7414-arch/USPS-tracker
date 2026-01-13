
'use client';

import React, { useEffect, useState, useMemo, FormEvent } from 'react';
import { getTechnicians, getWorkOrderById, getWorkSites, getClients, getTrainingRecordsByWorkOrderId, getTimeEntriesByWorkOrder } from '@/lib/data';
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
import { useTechnician } from '@/hooks/use-technician';

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { role: currentUserRole } = useTechnician();


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
  
  // Form State
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<WorkOrder['status']>('Open');
  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string | undefined>(undefined);
  const [workSiteId, setWorkSiteId] = useState<string | undefined>(undefined);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [createdDate, setCreatedDate] = useState<Date | undefined>();
  const [poNumber, setPoNumber] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [serviceScheduleDate, setServiceScheduleDate] = useState<Date | undefined>();
  const [quotedAmount, setQuotedAmount] = useState('');
  const [timeAndMaterial, setTimeAndMaterial] = useState<boolean>(false);
  const [permit, setPermit] = useState<boolean>(false);
  const [permitCost, setPermitCost] = useState('');
  const [permitFiled, setPermitFiled] = useState<Date | undefined>();
  const [coi, setCoi] = useState<boolean>(false);
  const [coiRequested, setCoiRequested] = useState<Date | undefined>();
  const [certifiedPayroll, setCertifiedPayroll] = useState<boolean>(false);
  const [certifiedPayrollRequested, setCertifiedPayrollRequested] = useState<Date | undefined>();
  const [intercoPO, setIntercoPO] = useState('');
  const [customerPO, setCustomerPO] = useState('');
  const [estimator, setEstimator] = useState('');
  const [checkInOutURL, setCheckInOutURL] = useState('');
  const [tempOnArrival, setTempOnArrival] = useState('');
  const [tempOnLeaving, setTempOnLeaving] = useState('');
  
  const workOrderDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'work_orders', id);
  }, [db, id]);

  const initializeEditState = (wo: WorkOrder) => {
    setDescription(wo.description || '');
    setStatus(wo.status || 'Open');
    setAssignedTechnicianId(wo.assignedTechnicianId);
    setWorkSiteId(wo.workSiteId);
    setClientId(wo.clientId);
    setCreatedDate(wo.createdDate ? new Date(wo.createdDate) : undefined);
    setPoNumber(wo.poNumber || '');
    setContactInfo(wo.contactInfo || '');
    setServiceScheduleDate(wo.serviceScheduleDate ? new Date(wo.serviceScheduleDate) : undefined);
    setQuotedAmount(wo.quotedAmount?.toString() || '');
    setTimeAndMaterial(wo.timeAndMaterial || false);
    setPermit(wo.permit || false);
    setPermitCost(wo.permitCost?.toString() || '');
    setPermitFiled(wo.permitFiled ? new Date(wo.permitFiled) : undefined);
    setCoi(wo.coi || false);
    setCoiRequested(wo.coiRequested ? new Date(wo.coiRequested) : undefined);
    setCertifiedPayroll(wo.certifiedPayroll || false);
    setCertifiedPayrollRequested(wo.certifiedPayrollRequested ? new Date(wo.certifiedPayrollRequested) : undefined);
    setIntercoPO(wo.intercoPO || '');
    setCustomerPO(wo.customerPO || '');
    setEstimator(wo.estimator || '');
    setCheckInOutURL(wo.checkInOutURL || '');
    setTempOnArrival(wo.tempOnArrival || '');
    setTempOnLeaving(wo.tempOnLeaving || '');
  };

  useEffect(() => {
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
            initializeEditState(fetchedWorkOrder);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!workOrderDocRef || !workOrder) return;
    
    const selectedWorkSite = workSites.find(ws => ws.id === workSiteId);
    const selectedClient = clients.find(c => c.id === clientId);

    const cleanedData: Partial<WorkOrder> = {
        jobName: selectedWorkSite?.name,
        description,
        status,
        assignedTechnicianId,
        workSiteId,
        clientId,
        billTo: selectedClient?.name,
        createdDate: createdDate?.toISOString(),
        poNumber,
        contactInfo,
        serviceScheduleDate: serviceScheduleDate?.toISOString(),
        quotedAmount: quotedAmount ? parseFloat(quotedAmount) : undefined,
        timeAndMaterial,
        permit,
        permitCost: permitCost ? parseFloat(permitCost) : undefined,
        permitFiled: permitFiled?.toISOString(),
        coi,
        coiRequested: coiRequested?.toISOString(),
        certifiedPayroll,
        certifiedPayrollRequested: certifiedPayrollRequested?.toISOString(),
        intercoPO,
        customerPO,
        estimator,
        checkInOutURL,
        tempOnArrival,
        tempOnLeaving,
    };

    Object.keys(cleanedData).forEach(key => {
        const k = key as keyof typeof cleanedData;
        if ((cleanedData as any)[k] === undefined) {
          (cleanedData as any)[k] = null;
        }
    });

    try {
        await updateDocumentNonBlocking(workOrderDocRef, cleanedData);

        // Optimistically update the local state
        setWorkOrder(prev => {
            if (!prev) return null;
            return { ...prev, ...cleanedData, workSite: selectedWorkSite, client: selectedClient } as WorkOrder;
        });
        
        toast({ title: "Work Order Saved", description: "Changes have been saved successfully." });
        setIsEditing(false);

    } catch (error) {
        console.error("Error saving work order", error);
    }
  };

  const handleCancelEdit = () => {
    if (workOrder) {
      initializeEditState(workOrder);
    }
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
            <WorkOrderDetails
                key={workOrder.id}
                workOrder={workOrder}
                technicians={technicians}
                workSites={workSites}
                clients={clients}
                trainingRecords={trainingRecords}
                timeEntries={timeEntries}
                isEditing={isEditing}
                isTechnician={isTechnician}
                onNoteAdded={handleNoteAdded}
                onTimeAdded={handleTimeAdded}
                onNotePhotoDelete={handleNotePhotoDelete}
                onNoteDelete={handleNoteDelete}
                onTimeEntryDelete={handleTimeEntryDelete}
                isAddingNote={isAddingNote}
                onDirectionsClick={handleDirectionsClick}
                onSignatureSave={() => setIsSignatureDialogOpen(true)}
                onTempUpdate={handleTempUpdate}
                onWorkOrderUpdate={handleSubmit}
                onCancelEdit={handleCancelEdit}
                // Editable fields state and setters
                description={description}
                setDescription={setDescription}
                status={status}
                setStatus={setStatus}
                assignedTechnicianId={assignedTechnicianId}
                setAssignedTechnicianId={setAssignedTechnicianId}
                workSiteId={workSiteId}
                setWorkSiteId={setWorkSiteId}
                clientId={clientId}
                setClientId={setClientId}
                createdDate={createdDate}
                setCreatedDate={setCreatedDate}
                poNumber={poNumber}
                setPoNumber={setPoNumber}
                contactInfo={contactInfo}
                setContactInfo={setContactInfo}
                serviceScheduleDate={serviceScheduleDate}
                setServiceScheduleDate={setServiceScheduleDate}
                quotedAmount={quotedAmount}
                setQuotedAmount={setQuotedAmount}
                timeAndMaterial={timeAndMaterial}
                setTimeAndMaterial={setTimeAndMaterial}
                permit={permit}
                setPermit={setPermit}
                permitCost={permitCost}
                setPermitCost={setPermitCost}
                permitFiled={permitFiled}
                setPermitFiled={setPermitFiled}
                coi={coi}
                setCoi={setCoi}
                coiRequested={coiRequested}
                setCoiRequested={setCoiRequested}
                certifiedPayroll={certifiedPayroll}
                setCertifiedPayroll={setCertifiedPayroll}
                certifiedPayrollRequested={certifiedPayrollRequested}
                setCertifiedPayrollRequested={setCertifiedPayrollRequested}
                intercoPO={intercoPO}
                setIntercoPO={setIntercoPO}
                customerPO={customerPO}
                setCustomerPO={setCustomerPO}
                estimator={estimator}
                setEstimator={setEstimator}
                checkInOutURL={checkInOutURL}
                setCheckInOutURL={setCheckInOutURL}
                tempOnArrival={tempOnArrival}
                setTempOnArrival={setTempOnArrival}
                tempOnLeaving={tempOnLeaving}
                setTempOnLeaving={setTempOnLeaving}
            />
        </div>
      </div>
      {isEditing && (
         <div className="fixed bottom-0 left-0 w-full bg-background border-t shadow-lg">
            <div className="container mx-auto py-3 px-4 flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancelEdit}>
                  <Ban className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button form="work-order-form" type="submit">
                  <Save className="mr-2 h-4 w-4" /> Save Changes
                </Button>
            </div>
         </div>
      )}
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
