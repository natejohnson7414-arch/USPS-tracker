

'use client';

import React, { useEffect, useState, useMemo, FormEvent } from 'react';
import { getTechnicians, getWorkOrderById, getWorkSites, getClients } from '@/lib/data';
import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ban, Pencil, Save, Printer } from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client } from '@/lib/types';
import { doc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, deleteImage } from '@/firebase/storage';
import { MapProviderSelection } from '@/components/map-provider-selection';
import { addDoc } from 'firebase/firestore';

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataChecked, setIsDataChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  
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
        const [fetchedTechnicians, fetchedWorkOrder, fetchedWorkSites, fetchedClients] = await Promise.all([
          getTechnicians(db),
          getWorkOrderById(db, id),
          getWorkSites(db),
          getClients(db),
        ]);

        setTechnicians(fetchedTechnicians);
        setWorkSites(fetchedWorkSites);
        setClients(fetchedClients);
        
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
            photoUrls: photoUrls,
        };

        const docRef = await addDoc(notesColRef, newNoteData);

        const optimisticNote: WorkOrderNote = {
            id: docRef.id,
            text: newNote.text,
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
  
  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!workOrderDocRef) return;
    
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
      if(!workOrderDocRef) return;
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
                <Button variant="outline" asChild>
                    <Link href={`/work-orders/${id}/report`} target="_blank" className="flex items-center gap-2">
                        <Printer className="h-4 w-4" />
                        Report
                    </Link>
                </Button>
                {!isEditing && workOrder.status !== 'Completed' && (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
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
            isEditing={isEditing}
            onNoteAdded={handleNoteAdded}
            onNotePhotoDelete={handleNotePhotoDelete}
            onNoteDelete={handleNoteDelete}
            isAddingNote={isAddingNote}
            onDirectionsClick={(address) => setSelectedAddress(address)}
            onSignatureSave={handleSignatureSave}
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
    </MainLayout>
  );
}
