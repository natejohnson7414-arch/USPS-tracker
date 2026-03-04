
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { getTechnicians, getWorkOrderById, getWorkSites, getClients, getTrainingRecordsByWorkOrderId, getTimeEntriesByWorkOrder, getTechnicianById, deleteTrainingRecord, updateWorkOrderStatus, addWorkHistoryItem, getQuotesByWorkOrderId, getHvacStartupReportsByWorkOrderId, deleteHvacStartupReport, getActivitiesByWorkOrderId } from '@/lib/data';
import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { WorkOrderAdminDetails } from '@/components/work-order-admin-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ban, Pencil, Save, Printer, Download, Receipt, CheckCircle2 } from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client, TrainingRecord, TimeEntry, Activity, ActivityHistoryItem, Quote, HvacStartupReport, FileAttachment, Acknowledgement } from '@/lib/types';
import { doc, collection, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, deleteImage } from '@/firebase/storage';
import { MapProviderSelection } from '@/components/map-provider-selection';
import {
  Dialog,
  DialogContent,
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
import { Loader2 } from 'lucide-react';

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
  const [assignedTechnician, setAssignedTechnician] = useState<Technician | undefined>();
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [hvacReports, setHvacReports] = useState<HvacStartupReport[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingPhotos, setIsSavingPhotos] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  const [tempOnArrival, setTempOnArrival] = useState('');
  const [tempOnLeaving, setTempOnLeaving] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  
  const [activeTab, setActiveTab] = useState('overview');

  const workOrderDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'work_orders', id);
  }, [db, id]);

  const fetchData = useCallback(async () => {
      if (!db || !user) return;
      
      try {
        const [
            fetchedTechnicians, 
            fetchedWorkOrder, 
            fetchedWorkSites, 
            fetchedClients,
            fetchedTrainingRecords,
            fetchedHvacReports,
            fetchedTimeEntries,
            fetchedQuotes,
            fetchedActivities,
        ] = await Promise.all([
          getTechnicians(db),
          getWorkOrderById(db, id),
          getWorkSites(db),
          getClients(db),
          getTrainingRecordsByWorkOrderId(db, id),
          getHvacStartupReportsByWorkOrderId(db, id),
          getTimeEntriesByWorkOrder(db, id),
          getQuotesByWorkOrderId(db, id),
          getActivitiesByWorkOrderId(db, id),
        ]);

        setTechnicians(fetchedTechnicians);
        setWorkSites(fetchedWorkSites);
        setClients(fetchedClients);
        setTrainingRecords(fetchedTrainingRecords);
        setHvacReports(fetchedHvacReports);
        setQuotes(fetchedQuotes);
        setActivities(fetchedActivities);
        
        const formattedTimeEntries = fetchedTimeEntries.map(entry => {
            const tech = fetchedTechnicians.find(t => t.id === entry.technicianId);
            return {
                ...entry,
                technicianName: tech?.name || entry.technicianName || 'Unknown User'
            };
        });
        setTimeEntries(formattedTimeEntries);
        
        if (fetchedWorkOrder) {
            setWorkOrder(fetchedWorkOrder);
            if (fetchedWorkOrder.assignedTechnicianId) {
                const tech = fetchedTechnicians.find(t => t.id === fetchedWorkOrder.assignedTechnicianId);
                setAssignedTechnician(tech);
            } else {
                setAssignedTechnician(undefined);
            }
            setTempOnArrival(fetchedWorkOrder.tempOnArrival || '');
            setTempOnLeaving(fetchedWorkOrder.tempOnLeaving || '');
            setContactInfo(fetchedWorkOrder.contactInfo || '');
        } else {
            setWorkOrder(null);
            notFound();
        }

      } catch (error) {
        console.error("Error in WorkOrder details fetchData:", error);
      } finally {
        setIsLoading(false);
      }
    }, [db, id, user]);

  useEffect(() => {
    if (db && user) {
        setIsLoading(true);
        fetchData();
    }
  }, [db, id, user, fetchData]);

  const handleDirectionsClick = (workSite: WorkSite) => {
    if (!workSite.address) return;
    const fullAddress = [workSite.address, workSite.city, workSite.state].filter(Boolean).join(', ');
    setSelectedAddress(fullAddress);
  };

  const handlePhotosAdded = async (type: 'before' | 'after' | 'receipts', files: File[]) => {
    if (!db || !workOrder || files.length === 0) return;
    
    setIsSavingPhotos(true);
    const toastId = toast({ title: `Uploading ${files.length} photo(s)...` });
    const isDebug = process.env.NEXT_PUBLIC_DEBUG_UPLOADS === '1';

    try {
      // FIX: Serialize uploads slightly to avoid browser concurrent request limits
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const url = await uploadImage(file, `work-orders/${workOrder.id}/${type}/${Date.now()}-${file.name}`);
        uploadedUrls.push(url);
      }

      let fieldToUpdate: 'beforePhotoUrls' | 'afterPhotoUrls' | 'receiptsAndPackingSlips';
      if (type === 'before') fieldToUpdate = 'beforePhotoUrls';
      else if (type === 'after') fieldToUpdate = 'afterPhotoUrls';
      else fieldToUpdate = 'receiptsAndPackingSlips';

      const currentUrls = workOrder[fieldToUpdate] || [];
      const newUrls = [...currentUrls, ...uploadedUrls];

      if (isDebug) console.log(`[Storage] Updating Firestore ${fieldToUpdate} with ${newUrls.length} items`);

      updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), {
        [fieldToUpdate]: newUrls,
      });

      setWorkOrder(prev => prev ? { ...prev, [fieldToUpdate]: newUrls } : null);
      
      toastId.dismiss();
      toast({ title: "Photos Uploaded", description: `${files.length} photo(s) have been added.` });

    } catch (error: any) {
      if (isDebug) console.error("[Storage] Photo Add Handler Failed:", error);
      toastId.dismiss();
      toast({ variant: "destructive", title: "Upload Failed", description: error.message || "Could not upload photos." });
    } finally {
      setIsSavingPhotos(false);
    }
  };

  const handlePhotoDeleted = async (type: 'before' | 'after' | 'receipts', urlToDelete: string) => {
    if (!db || !workOrder) return;

    let fieldToUpdate: 'beforePhotoUrls' | 'afterPhotoUrls' | 'receiptsAndPackingSlips';
    if (type === 'before') fieldToUpdate = 'beforePhotoUrls';
    else if (type === 'after') fieldToUpdate = 'afterPhotoUrls';
    else fieldToUpdate = 'receiptsAndPackingSlips';

    const currentUrls = workOrder[fieldToUpdate] || [];
    const newUrls = currentUrls.filter(url => url !== urlToDelete);

    setWorkOrder(prev => prev ? { ...prev, [fieldToUpdate]: newUrls } : null);

    try {
        updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), { [fieldToUpdate]: newUrls });
        await deleteImage(urlToDelete);
        toast({ title: "Photo Deleted" });
    } catch(error) {
        setWorkOrder(prev => prev ? { ...prev, [fieldToUpdate]: currentUrls } : null);
    }
  };

  const handleFilesUploaded = async (files: File[]) => {
    if (!db || !workOrder || files.length === 0) return;
    
    setIsUploadingFiles(true);
    const toastId = toast({ title: `Uploading ${files.length} file(s)...` });

    try {
      const uploadedFiles: FileAttachment[] = [];
      for (const file of files) {
        const path = `work-orders/${workOrder.id}/files/${Date.now()}-${file.name}`;
        const url = await uploadImage(file, path);
        uploadedFiles.push({
          name: file.name,
          url,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
      }

      const currentFiles = workOrder.uploadedFiles || [];
      const newFiles = [...currentFiles, ...uploadedFiles];

      updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), {
        uploadedFiles: newFiles,
      });

      setWorkOrder(prev => prev ? { ...prev, uploadedFiles: newFiles } : null);
      
      toastId.dismiss();
      toast({ title: "Files Uploaded", description: `${files.length} file(s) have been added.` });

    } catch (error: any) {
      toastId.dismiss();
      toast({ variant: "destructive", title: "Upload Failed", description: error.message || "Could not upload files." });
    } finally {
      setIsUploadingFiles(false);
    }
  };

  const handleFileDeleted = async (fileToDelete: FileAttachment) => {
    if (!db || !workOrder) return;

    const currentFiles = workOrder.uploadedFiles || [];
    const newFiles = currentFiles.filter(file => file.url !== fileToDelete.url);

    setWorkOrder(prev => prev ? { ...prev, uploadedFiles: newFiles } : null);

    try {
        updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), { uploadedFiles: newFiles });
        await deleteImage(fileToDelete.url); 
        toast({ title: "File Deleted" });
    } catch(error) {
        setWorkOrder(prev => prev ? { ...prev, uploadedFiles: currentFiles } : null);
    }
  };

    const handleTimeEntriesSaved = async () => {
        if (!db || !user || !workOrder) return;
        try {
            const technician = await getTechnicianById(db, user.uid);
            const historyItem: Omit<ActivityHistoryItem, 'id' | 'timestamp'> = {
                type: 'time_log',
                text: 'Posted new time entries.',
                authorId: user.uid,
                authorName: technician?.name || user.email!,
            };
            addWorkHistoryItem(db, workOrder.id, historyItem);
            fetchData();
            setActiveTab('activity');
        } catch (e) {
        }
    };
  
  const handleTempUpdate = () => {
    if (!workOrderDocRef) return;
    updateDocumentNonBlocking(workOrderDocRef, { tempOnArrival, tempOnLeaving });
    setWorkOrder(prev => prev ? ({ ...prev, tempOnArrival, tempOnLeaving }) : null);
  };
  
  const handleContactInfoUpdate = () => {
    if (!workOrderDocRef) return;
    updateDocumentNonBlocking(workOrderDocRef, { contactInfo });
    setWorkOrder(prev => prev ? ({...prev, contactInfo }) : null);
  };
  
  const handleFormSaved = (newId?: string) => {
      if (newId && newId !== id) {
          router.push(`/work-orders/${newId}`);
      } else {
          fetchData(); 
      }
      setIsEditing(false);
  }

  const handleSignatureSave = async (signatureDataUrl: string) => {
      if(!workOrderDocRef || !workOrder) return;
      if (!contactInfo) {
        toast({ title: 'Missing Name', description: "Please enter the signer's name.", variant: 'destructive' });
        return;
      }
      
      setIsSavingPhotos(true);
      const signaturePath = `signatures/${workOrder.id}/${Date.now()}.png`;
      
      try {
        const signatureBlob = await (await fetch(signatureDataUrl)).blob();
        const signatureUrl = await uploadImage(signatureBlob, signaturePath);
        const signatureDate = new Date().toISOString();
        
        updateDocumentNonBlocking(workOrderDocRef, {
            customerSignatureUrl: signatureUrl,
            signatureDate: signatureDate,
            contactInfo: contactInfo
        });
        
        setWorkOrder(prev => prev ? ({ ...prev, customerSignatureUrl: signatureUrl, signatureDate: signatureDate, contactInfo: contactInfo }) : null);

        toast({ title: "Signature Saved", description: "The signature has been saved." });
        setIsSignatureDialogOpen(false);
      } catch (error) {
        if (!(error instanceof Error && error.name === 'FirebaseError')) {
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not upload the signature.' });
        }
      } finally {
        setIsSavingPhotos(false);
      }
  };

  const handleSignatureDelete = async (ack?: Acknowledgement) => {
    if (!db || !workOrder) return;

    if (!ack) {
        const oldUrl = workOrder.customerSignatureUrl;
        setWorkOrder(prev => prev ? ({ ...prev, customerSignatureUrl: undefined, signatureDate: undefined }) : null);
        try {
            updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), { 
                customerSignatureUrl: null, 
                signatureDate: null 
            });
            if (oldUrl) await deleteImage(oldUrl);
            toast({ title: "Signature Deleted" });
        } catch(error) {
            fetchData(); 
        }
    } else {
        const updatedAcks = (workOrder.acknowledgements || []).filter(a => a.signatureUrl !== ack.signatureUrl);
        setWorkOrder(prev => prev ? ({ ...prev, acknowledgements: updatedAcks }) : null);
        try {
            updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), { 
                acknowledgements: updatedAcks 
            });
            await deleteImage(ack.signatureUrl);
            toast({ title: "Legacy Signature Deleted" });
        } catch(error) {
            fetchData(); 
        }
    }
  };
  
   const handleNotePhotoDelete = async (noteId: string, photoUrl: string) => {
    if (!db || !workOrder) return;
    
    const noteRef = doc(db, 'work_orders', workOrder.id, 'updates', noteId);
    
    const originalNotes = workOrder.notes;
    const updatedNotes = workOrder.notes.map(note => {
      if (note.id === noteId) {
        return { ...note, photoUrls: note.photoUrls?.filter(url => url !== photoUrl) };
      }
      return note;
    });
    setWorkOrder(prev => prev ? { ...prev, notes: updatedNotes } : null);

    try {
        await deleteImage(photoUrl); 
        const updatedNote = updatedNotes.find(n => n.id === noteId);
        if(updatedNote) {
            updateDocumentNonBlocking(noteRef, { photoUrls: updatedNote.photoUrls || [] }); 
        }
        toast({ title: 'Photo Deleted' });
    } catch (error) {
        setWorkOrder(prev => prev ? ({...prev, notes: originalNotes}) : null);
    }
  };

  const handleNoteDelete = (noteId: string) => {
    if (!db || !workOrder) return;

    const noteToDelete = workOrder.notes.find(note => note.id === noteId);
    if (!noteToDelete) return;

    const originalNotes = workOrder.notes;
    setWorkOrder(prev => prev ? ({ ...prev, notes: prev.notes.filter(n => n.id !== noteId) }) : null);

    const noteRef = doc(db, 'work_orders', workOrder.id, 'updates', noteId);
    
    deleteDocumentNonBlocking(noteRef)
        .then(() => {
            const photoDeletePromises = (noteToDelete.photoUrls || []).map(url => deleteImage(url));
            return Promise.all(photoDeletePromises);
        })
        .then(() => {
            toast({ title: 'Note Deleted' });
        })
        .catch(error => {
            setWorkOrder(prev => prev ? ({...prev, notes: originalNotes}) : null);
        });
  };

  const handleTimeEntryDelete = (timeEntryId: string) => {
    if (!db) return;

    const originalTimeEntries = timeEntries;
    setTimeEntries(prev => prev.filter(t => t.id !== timeEntryId));

    const timeEntryRef = doc(db, 'time_entries', timeEntryId);
    deleteDocumentNonBlocking(timeEntryRef)
      .then(() => {
        toast({ title: 'Time Entry Deleted' });
      })
      .catch(error => {
        setTimeEntries(originalTimeEntries);
      });
  };
  
  const handleTrainingRecordDelete = (recordId: string) => {
    if (!db) return;
    setTrainingRecords(prev => prev.filter(r => r.id !== recordId));
    deleteTrainingRecord(db, recordId).then(() => toast({ title: 'Training Record Deleted' }));
  }

  const handleHvacReportDelete = (reportId: string) => {
    if (!db) return;
    setHvacReports(prev => prev.filter(r => r.id !== reportId));
    deleteHvacStartupReport(db, reportId).then(() => toast({ title: 'HVAC Start-Up Report Deleted' }));
  }

  const handleAddActivity = (newActivityData: Omit<Activity, 'id' | 'createdDate' | 'workOrderId'>) => {
    if (!db || !user || !workOrder) return;
    
    setIsAddingActivity(true);
    const activityData = {
        ...newActivityData,
        workOrderId: workOrder.id,
        createdDate: new Date().toISOString(),
    };
    
    const activitiesColRef = collection(db, 'work_orders', workOrder.id, 'activities');
    addDocumentNonBlocking(activitiesColRef, activityData)
        .then(() => {
            toast({ title: 'Activity Scheduled' });
            updateWorkOrderStatus(db, workOrder.id);
            fetchData();
            setActiveTab('activity');
        })
        .finally(() => setIsAddingActivity(false));
  };

  const handleUpdateActivityStatus = (activityId: string, status: Activity['status']) => {
      if (!db || !workOrder) return;
      const activityRef = doc(db, 'work_orders', workOrder.id, 'activities', activityId);
      updateDocumentNonBlocking(activityRef, { status });
      toast({ title: 'Activity Status Updated' });
      updateWorkOrderStatus(db, workOrder.id);
      fetchData();
  };

  const handleDeleteActivity = (activityId: string) => {
    if (!db || !workOrder) return;
    const activityRef = doc(db, 'work_orders', workOrder.id, 'activities', activityId);
    deleteDocumentNonBlocking(activityRef);
    toast({ title: 'Activity Deleted' });
    updateWorkOrderStatus(db, workOrder.id);
    fetchData();
  };

  const handleDownloadMedia = async () => {
    if (!workOrder) return;
    setIsDownloading(true);

    const allUrls = [
        ...(workOrder.beforePhotoUrls || []),
        ...(workOrder.afterPhotoUrls || []),
        ...(workOrder.notes?.flatMap(note => note.photoUrls || []) || []),
        ...(quotes.flatMap(quote => quote.photos || [])),
        ...(quotes.flatMap(quote => quote.videos || []))
    ];

    if (allUrls.length === 0) {
        toast({ title: "No media to download." });
        setIsDownloading(false);
        return;
    }

    for (const [index, url] of allUrls.entries()) {
        try {
            const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
            if (!response.ok) continue;
            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            const urlParts = new URL(url);
            const pathParts = urlParts.pathname.split('/');
            a.download = decodeURIComponent(pathParts[pathParts.length - 1]);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(objectUrl);
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
        }
    }
    setIsDownloading(false);
};

  const handleMarkForReview = async () => {
    if (!db || !workOrder || !user) return;
    setIsSubmittingReview(true);

    try {
      const technician = await getTechnicianById(db, user.uid);
      const historyItem = {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'status_change' as const,
          text: `Status changed to Review`,
          authorId: user.uid,
          authorName: technician?.name || user.email!,
      };

      const workOrderRef = doc(db, 'work_orders', workOrder.id);
      updateDocumentNonBlocking(workOrderRef, {
        status: 'Review',
        work_history: arrayUnion(historyItem)
      });
      
      toast({ title: "Work Order Submitted for Review" });
      fetchData(); 
    } catch (error) {
    } finally {
        setIsSubmittingReview(false);
    }
  };

  const handleCompleteWorkOrder = async () => {
    if (!db || !workOrder || !user) return;
    setIsCompleting(true);

    try {
      const technician = await getTechnicianById(db, user.uid);
      const historyItem = {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'status_change' as const,
          text: `Status changed to Completed`,
          authorId: user.uid,
          authorName: technician?.name || user.email!,
      };

      const workOrderRef = doc(db, 'work_orders', workOrder.id);
      updateDocumentNonBlocking(workOrderRef, {
        status: 'Completed',
        work_history: arrayUnion(historyItem)
      });
      
      toast({ title: "Work Order Completed" });
      fetchData(); 
    } catch (error) {
    } finally {
        setIsCompleting(false);
    }
  };

  const handleReplyToAttention = () => {
    if (!db || !workOrder) return;
    const woRef = doc(db, 'work_orders', workOrder.id);
    updateDocumentNonBlocking(woRef, {
        needsAttention: false,
        technicianReplied: true,
        status: 'Review' 
    });
    toast({ title: 'Attention Acknowledged' });
    fetchData();
  };

  const handleClearReplyStatus = () => {
    if (!db || !workOrder) return;
    const woRef = doc(db, 'work_orders', workOrder.id);
    updateDocumentNonBlocking(woRef, { technicianReplied: false });
    toast({ title: 'Status Cleared' });
    fetchData();
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Loading work order details...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!workOrder) {
    notFound();
  }

  const isTechnician = currentUserRole?.name === 'Technician';
  const isAdmin = currentUserRole?.name === 'Administrator';
  const isCompleted = workOrder.status === 'Completed';

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
                {workOrder.status === 'Review' && isAdmin && (
                    <Button onClick={handleCompleteWorkOrder} disabled={isCompleting} className="bg-green-600 hover:bg-green-700 text-white">
                        {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Complete WO
                    </Button>
                )}
                {!isTechnician && (
                    <Button variant="outline" onClick={handleDownloadMedia} disabled={isDownloading}>
                        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Download Media
                    </Button>
                )}
                {!isTechnician && (
                    <Button variant="outline" onClick={() => setIsReportDialogOpen(true)}>
                        <Printer className="mr-2 h-4 w-4" />
                        Report
                    </Button>
                )}
                {!isCompleted && (
                    <Button asChild variant="outline">
                        <Link href={`/work-orders/${workOrder.id}/start-quote`}>
                            <Receipt className="mr-2 h-4 w-4" /> Start Quote
                        </Link>
                    </Button>
                )}
                {!isCompleted && !isEditing && !isTechnician && workOrder.id !== '24-0001' && (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                )}
            </div>
        </div>

        {!isEditing && (
          <div className="mb-6 px-1">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{workOrder.workSite?.name || workOrder.jobName}</h1>
              <p className="text-lg text-muted-foreground font-medium">Job # {workOrder.id}</p>
          </div>
        )}

        <div className="pb-24">
            {isEditing ? (
                 <WorkOrderEditForm workOrder={workOrder} technicians={technicians} workSites={workSites} clients={clients} onFormSaved={handleFormSaved} onCancel={() => setIsEditing(false)} />
            ) : isTechnician ? (
                <WorkOrderDetails
                    workOrder={workOrder} isTechnician={isTechnician} isAdmin={isAdmin} trainingRecords={trainingRecords} onTrainingRecordDelete={handleTrainingRecordDelete} hvacReports={hvacReports} onHvacReportDelete={handleHvacReportDelete} timeEntries={timeEntries} activities={activities} onTimeEntriesSaved={handleTimeEntriesSaved} onNotePhotoDelete={handleNotePhotoDelete} onNoteDelete={handleNoteDelete} onBeforePhotosAdded={(files) => handlePhotosAdded('before', files)} onAfterPhotosAdded={(files) => handlePhotosAdded('after', files)} onReceiptsAndPackingSlipsAdded={(files) => handlePhotosAdded('receipts', files)} onBeforePhotoDelete={(url) => handlePhotoDeleted('before', url)} onAfterPhotoDelete={(url) => handlePhotoDeleted('after', url)} onReceiptsAndPackingSlipsPhotoDelete={(url) => handlePhotoDeleted('receipts', url)} onTimeEntryDelete={handleTimeEntryDelete} isSavingPhotos={isSavingPhotos} onDirectionsClick={() => workOrder.workSite && handleDirectionsClick(workOrder.workSite)} onSignatureSave={() => setIsSignatureDialogOpen(true)} onTempUpdate={handleTempUpdate} tempOnArrival={tempOnArrival} setTempOnArrival={setTempOnArrival} tempOnLeaving={tempOnLeaving} setTempOnLeaving={setTempOnLeaving} contactInfo={contactInfo} setContactInfo={setContactInfo} onContactInfoUpdate={handleContactInfoUpdate} onAddActivity={handleAddActivity} isAddingActivity={isAddingActivity} onUpdateActivityStatus={handleUpdateActivityStatus} onDeleteActivity={handleDeleteActivity} technicians={technicians} onMarkForReview={handleMarkForReview} isSubmittingReview={isSubmittingReview} onSignatureDelete={handleSignatureDelete} activeTab={activeTab} setActiveTab={setActiveTab} onReplyToAttention={handleReplyToAttention}
                />
            ) : (
                 <WorkOrderAdminDetails
                    workOrder={workOrder} assignedTechnician={assignedTechnician} isTechnician={isTechnician} isAdmin={isAdmin} trainingRecords={trainingRecords} onTrainingRecordDelete={handleTrainingRecordDelete} hvacReports={hvacReports} onHvacReportDelete={handleHvacReportDelete} timeEntries={timeEntries} activities={activities} onNotePhotoDelete={handleNotePhotoDelete} onNoteDelete={handleNoteDelete} onBeforePhotosAdded={(files) => handlePhotosAdded('before', files)} onAfterPhotosAdded={(files) => handlePhotosAdded('after', files)} onReceiptsAndPackingSlipsAdded={(files) => handlePhotosAdded('receipts', files)} onBeforePhotoDelete={(url) => handlePhotoDeleted('before', url)} onAfterPhotoDelete={(url) => handlePhotoDeleted('after', url)} onReceiptsAndPackingSlipsPhotoDelete={(url) => handlePhotoDeleted('receipts', url)} onTimeEntryDelete={handleTimeEntryDelete} isSavingPhotos={isSavingPhotos} onDirectionsClick={() => workOrder.workSite && handleDirectionsClick(workOrder.workSite)} onSignatureSave={() => setIsSignatureDialogOpen(true)} onTempUpdate={handleTempUpdate} tempOnArrival={tempOnArrival} setTempOnArrival={setTempOnArrival} tempOnLeaving={tempOnLeaving} setTempOnLeaving={setTempOnLeaving} contactInfo={contactInfo} setContactInfo={setContactInfo} onAddActivity={handleAddActivity} isAddingActivity={isAddingActivity} onUpdateActivityStatus={handleUpdateActivityStatus} onDeleteActivity={handleDeleteActivity} technicians={technicians} onFilesUploaded={handleFilesUploaded} onFileDeleted={handleFileDeleted} isUploadingFiles={isUploadingFiles} onSignatureDelete={handleSignatureDelete} activeTab={activeTab} setActiveTab={setActiveTab} onClearAttentionStatus={handleClearReplyStatus}
                />
            )}
        </div>
      </div>

       <MapProviderSelection address={selectedAddress} isOpen={!!selectedAddress} onOpenChange={() => setSelectedAddress(null)} />
        <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
            <DialogContent className="fixed inset-0 h-[100dvh] w-screen max-w-none p-0 flex flex-col border-0 rounded-none shadow-none z-[100]">
                <SignaturePad 
                    onSave={handleSignatureSave}
                    onClear={() => {}}
                    className="flex-1"
                />
            </DialogContent>
        </Dialog>
        <ReportPreviewDialog isOpen={isReportDialogOpen} onOpenChange={setIsReportDialogOpen} workOrderId={workOrder.id} />
    </MainLayout>
  );
}
