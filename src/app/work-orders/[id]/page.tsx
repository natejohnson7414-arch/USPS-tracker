

'use client';

import React, { useEffect, useState, useMemo, FormEvent } from 'react';
import { getTechnicians, getWorkOrderById, getWorkSites, getClients, getTrainingRecordsByWorkOrderId, getTimeEntriesByWorkOrder } from '@/lib/data';
import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ban, Pencil, Save, Printer } from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client, TrainingRecord, TimeEntry } from '@/lib/types';
import { doc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, deleteImage } from '@/firebase/storage';
import { MapProviderSelection } from '@/components/map-provider-selection';
import { addDoc } from 'firebase/firestore';
import { SignaturePad } from '@/components/signature-pad';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  const [isDataChecked, setIsDataChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  
  // Editable fields state - initialized when workOrder is loaded
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<WorkOrder['status']>('Open');
  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string | undefined>(undefined);
  const [workSiteId, setWorkSiteId] = useState<string | undefined>(undefined);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  
  const [createdDate, setCreatedDate] = useState<Date | undefined>();
  const [billTo, setBillTo] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>('');
  const [contactInfo, setContactInfo] = useState<string>('');
  const [serviceScheduleDate, setServiceScheduleDate] = useState<Date | undefined>();
  const [quotedAmount, setQuotedAmount] = useState<number | undefined>();
  const [timeAndMaterial, setTimeAndMaterial] = useState<boolean>(false);
  const [permit, setPermit] = useState<boolean>(false);
  const [permitCost, setPermitCost] = useState<number | undefined>();
  const [permitFiled, setPermitFiled] = useState<Date | undefined>();
  const [coi, setCoi] = useState<boolean>(false);
  const [coiRequested, setCoiRequested] = useState<Date | undefined>();
  const [certifiedPayroll, setCertifiedPayroll] = useState<boolean>(false);
  const [certifiedPayrollRequested, setCertifiedPayrollRequested] = useState<Date | undefined>();
  const [intercoPO, setIntercoPO] = useState<string>('');
  const [customerPO, setCustomerPO] = useState<string>('');
  const [estimator, setEstimator] = useState<string>('');
  
  // New temperature and signature fields
  const [tempOnArrival, setTempOnArrival] = useState('');
  const [tempOnLeaving, setTempOnLeaving] = useState('');
  const [customerSignatureUrl, setCustomerSignatureUrl] = useState<string | undefined>('');
  const [signatureDate, setSignatureDate] = useState<string | undefined>('');


  const workOrderDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'work_orders', id);
  }, [db, id]);

  const notesColRef = useMemoFirebase(() => {
    if (!workOrderDocRef) return null;
    return collection(workOrderDocRef, 'updates');
  }, [workOrderDocRef]);

  const initializeEditState = (wo: WorkOrder) => {
    setDescription(wo.description);
    setStatus(wo.status);
    setAssignedTechnicianId(wo.assignedTechnicianId);
    setWorkSiteId(wo.workSiteId);
    setClientId(wo.clientId);
    setCreatedDate(wo.createdDate ? new Date(wo.createdDate) : undefined);
    setBillTo(wo.billTo || '');
    setPoNumber(wo.poNumber || '');
    setContactInfo(wo.contactInfo || '');
    setServiceScheduleDate(wo.serviceScheduleDate ? new Date(wo.serviceScheduleDate) : undefined);
    setQuotedAmount(wo.quotedAmount);
    setTimeAndMaterial(wo.timeAndMaterial || false);
    setPermit(wo.permit || false);
    setPermitCost(wo.permitCost);
    setPermitFiled(wo.permitFiled ? new Date(wo.permitFiled) : undefined);
    setCoi(wo.coi || false);
    setCoiRequested(wo.coiRequested ? new Date(wo.coiRequested) : undefined);
    setCertifiedPayroll(wo.certifiedPayroll || false);
    setCertifiedPayrollRequested(wo.certifiedPayrollRequested ? new Date(wo.certifiedPayrollRequested) : undefined);
    setIntercoPO(wo.intercoPO || '');
    setCustomerPO(wo.customerPO || '');
    setEstimator(wo.estimator || '');

    // Initialize new fields
    setTempOnArrival(wo.tempOnArrival || '');
    setTempOnLeaving(wo.tempOnLeaving || '');
    setCustomerSignatureUrl(wo.customerSignatureUrl);
    setSignatureDate(wo.signatureDate);
  }

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
    initializeEditState(workOrder);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    resetEditState();
  };
  
  const handleDirectionsClick = (workSite: WorkSite) => {
    if (!workSite.address) return;
    const fullAddress = [workSite.address, workSite.city, workSite.state].filter(Boolean).join(', ');
    setSelectedAddress(fullAddress);
  };

  const handleNoteAdded = async (newNote: Omit<WorkOrderNote, 'id'> & { photoFiles: File[] }) => {
    if (!db || !user || !notesColRef || !workOrder) return;
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

        const docRef = await addDoc(notesColRef, newNoteData);

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
  
  const handleTempUpdate = () => {
    if (!workOrderDocRef) return;
  
    // Only update if the values have actually changed from the source data
    if (tempOnArrival !== workOrder?.tempOnArrival || tempOnLeaving !== workOrder?.tempOnLeaving) {
      const tempData = {
        tempOnArrival,
        tempOnLeaving,
      };
  
      updateDocumentNonBlocking(workOrderDocRef, tempData).then(() => {
        toast({ title: "Temperatures Updated", description: "The arrival and leaving temperatures have been saved." });
        // Optimistically update the main workOrder object as well
        setWorkOrder(prev => prev ? ({ ...prev, ...tempData }) : null);
      }).catch(error => {
        // Error is handled by the global handler, but you could add a toast here if you want
        console.error("Failed to update temperatures", error);
      });
    }
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!workOrderDocRef || !workOrder) return;
    
    const selectedClient = clients.find(c => c.id === clientId);
    const selectedWorkSite = workSites.find(ws => ws.id === workSiteId);

    const updatedData: Partial<WorkOrder> = {
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
        quotedAmount,
        timeAndMaterial,
        permit,
        permitCost,
        permitFiled: permitFiled?.toISOString(),
        coi,
        coiRequested: coiRequested?.toISOString(),
        certifiedPayroll,
        certifiedPayrollRequested: certifiedPayrollRequested?.toISOString(),
        intercoPO,
        customerPO,
        estimator,
        tempOnArrival,
        tempOnLeaving,
        customerSignatureUrl,
        signatureDate
    };

    // Firestore does not allow `undefined` values. We clean them here.
    Object.keys(updatedData).forEach(key => {
        const k = key as keyof typeof updatedData;
        if ((updatedData as any)[k] === undefined) {
          (updatedData as any)[k] = null;
        }
    });

    updateDocumentNonBlocking(workOrderDocRef, updatedData);

    
    // Optimistically update the local state
    setWorkOrder(prev => {
        if (!prev) return null;
        return { ...prev, ...updatedData, workSite: selectedWorkSite, client: selectedClient } as WorkOrder;
    });
    
    toast({ title: "Work Order Saved", description: "Changes have been saved successfully." });
    setIsEditing(false);
  };

  const handleSignatureSave = async (signatureDataUrl: string) => {
      if(!workOrderDocRef || !workOrder) return;
      const signaturePath = `signatures/${workOrder.id}/${Date.now()}.png`;
      
      try {
        const signatureUrl = await uploadImage(
            await (await fetch(signatureDataUrl)).blob(), 
            signaturePath
        );

        const sigDate = new Date().toISOString();
        
        // Update state locally
        setCustomerSignatureUrl(signatureUrl);
        setSignatureDate(sigDate);

        // Update firestore
        await updateDocumentNonBlocking(workOrderDocRef, {
            customerSignatureUrl: signatureUrl,
            signatureDate: sigDate
        });
        
        // Also update local workOrder object
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



  if (isLoading || !isDataChecked) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <p>Loading work order details...</p>
        </div>
      </MainLayout>
    );
  }

  if (!workOrder) {
      notFound();
  }

  const canEdit = currentUserRole?.name === 'Administrator' || (workOrder.status !== 'Completed' && !!workOrder.assignedTechnicianId && workOrder.assignedTechnicianId === user?.uid);
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
                {isTechnician ? (
                    <Button variant="outline" disabled>
                        <Printer className="mr-2 h-4 w-4" />
                        Report
                    </Button>
                ) : (
                    <Button variant="outline" asChild>
                        <Link href={`/work-orders/${id}/report`} target="_blank">
                            <Printer className="mr-2 h-4 w-4" />
                            Report
                        </Link>
                    </Button>
                )}

                {!isEditing && (
                  <Button variant="outline" onClick={() => setIsEditing(true)} disabled={!canEdit}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                )}
            </div>
        </div>
        <div className="pb-24">
            <WorkOrderDetails
            initialWorkOrder={workOrder}
            technicians={technicians}
            workSites={workSites}
            clients={clients}
            trainingRecords={trainingRecords}
            timeEntries={timeEntries}
            isEditing={isEditing}
            onNoteAdded={handleNoteAdded}
            onTimeAdded={handleTimeAdded}
            onNotePhotoDelete={handleNotePhotoDelete}
            onNoteDelete={handleNoteDelete}
            onTimeEntryDelete={handleTimeEntryDelete}
            isAddingNote={isAddingNote}
            onDirectionsClick={handleDirectionsClick}
            onSignatureSave={() => setIsSignatureDialogOpen(true)}
            onTempUpdate={handleTempUpdate}
            editableFields={{
                description, setDescription,
                status, setStatus,
                assignedTechnicianId, setAssignedTechnicianId,
                workSiteId, setWorkSiteId,
                clientId, setClientId,
                createdDate, setCreatedDate,
                billTo, setBillTo,
                poNumber, setPoNumber,
                contactInfo, setContactInfo,
                serviceScheduleDate, setServiceScheduleDate,
                quotedAmount: quotedAmount || 0, setQuotedAmount,
                timeAndMaterial, setTimeAndMaterial,
                permit, setPermit,
                permitCost: permitCost || 0, setPermitCost,
                permitFiled, setPermitFiled,
                coi, setCoi,
                coiRequested, setCoiRequested,
                certifiedPayroll, setCertifiedPayroll,
                certifiedPayrollRequested, setCertifiedPayrollRequested,
                intercoPO, setIntercoPO,
                customerPO, setCustomerPO,
                estimator, setEstimator,
                tempOnArrival, setTempOnArrival,
                tempOnLeaving, setTempOnLeaving,
                customerSignatureUrl, setCustomerSignatureUrl,
                signatureDate, setSignatureDate,
            }}
            onWorkOrderUpdate={handleSave}
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
