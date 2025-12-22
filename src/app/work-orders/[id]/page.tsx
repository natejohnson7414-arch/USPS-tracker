
'use client';

import React, { useEffect, useState, useMemo, FormEvent } from 'react';
import { getTechnicians, getWorkOrderById, getWorkSites, getClients } from '@/lib/data';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ban, Pencil, Save } from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client } from '@/lib/types';
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
  const [clients, setClients] = useState<Client[]>([]);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataChecked, setIsDataChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  
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
    if (!workOrderDocRef) return;
    
    const selectedClient = clients.find(c => c.id === clientId);
    const selectedWorkSite = workSites.find(ws => ws.id === workSiteId);

    const updatedData = {
        jobName: selectedWorkSite?.name,
        description,
        status,
        assignedTechnicianId,
        workSiteId,
        clientId,
        billTo: selectedClient?.name || null,
        createdDate: createdDate?.toISOString() || null,
        poNumber,
        contactInfo,
        serviceScheduleDate: serviceScheduleDate?.toISOString() || null,
        quotedAmount,
        timeAndMaterial,
        permit,
        permitCost,
        permitFiled: permitFiled?.toISOString() || null,
        coi,
        coiRequested: coiRequested?.toISOString() || null,
        certifiedPayroll,
        certifiedPayrollRequested: certifiedPayrollRequested?.toISOString() || null,
        intercoPO,
        customerPO,
        estimator
    };

    // Firestore does not allow `undefined` values. We clean them here.
    Object.keys(updatedData).forEach(key => {
        const k = key as keyof typeof updatedData;
        if (updatedData[k] === undefined) {
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
          clients={clients}
          isEditing={isEditing}
          onNoteAdded={handleNoteAdded}
          onNotePhotoDelete={handleNotePhotoDelete}
          isAddingNote={isAddingNote}
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
            estimator, setEstimator
          }}
          onWorkOrderUpdate={handleSave}
        />
      </div>
    </MainLayout>
  );
}

    