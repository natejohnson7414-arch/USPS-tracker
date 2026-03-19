
'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getTechnicians, getWorkOrderById, getWorkSites, getClients, getTrainingRecordsByWorkOrderId, getTimeEntriesByWorkOrder, getTechnicianById, deleteTrainingRecord, updateWorkOrderStatus, addWorkHistoryItem, getQuotesByWorkOrderId, getHvacStartupReportsByWorkOrderId, deleteHvacStartupReport, getActivitiesByWorkOrderId } from '@/lib/data';
import { notFound, useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { WorkOrderDetails } from '@/components/work-order-details';
import { WorkOrderAdminDetails } from '@/components/work-order-admin-details';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ban, Pencil, Save, Printer, Download, Receipt, CheckCircle2, Loader2 } from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client, TrainingRecord, TimeEntry, Activity, ActivityHistoryItem, Quote, HvacStartupReport, FileAttachment, Acknowledgement, PhotoMetadata } from '@/lib/types';
import { doc, collection, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { uploadImageResumable, deleteImage, uploadPhotoWithThumbnail, deletePhotoMetadata } from '@/firebase/storage';
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

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [isLinkingAsset, setIsLinkingAsset] = useState<string | null>(null);
  
  const [tempOnArrival, setTempOnArrival] = useState('');
  const [tempOnLeaving, setTempOnLeaving] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');

  const activeUploadsRef = useRef<Set<string>>(new Set());

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
    const toastId = toast({ title: `Preparing ${files.length} photo(s)...`, duration: Infinity });

    try {
      const uploadedResults: PhotoMetadata[] = [];
      let i = 0;

      for (const file of files) {
        i++;
        const basePath = `work-orders/${workOrder.id}/${type}`;
        const fileName = `${Date.now()}-${file.name}`;
        
        toastId.update({ 
          id: toastId.id, 
          title: `Photo ${i}/${files.length}`, 
          description: `Generating and uploading thumbnail...` 
        });

        const result = await uploadPhotoWithThumbnail(file, basePath, fileName, {
          onProgress: (p) => {
            toastId.update({ 
              id: toastId.id, 
              description: `Uploading original... ${p.pct}%` 
            });
          }
        });
        
        uploadedResults.push(result);
      }

      let fieldToUpdate: 'beforePhotoUrls' | 'afterPhotoUrls' | 'receiptsAndPackingSlips';
      if (type === 'before') fieldToUpdate = 'beforePhotoUrls';
      else if (type === 'after') fieldToUpdate = 'afterPhotoUrls';
      else fieldToUpdate = 'receiptsAndPackingSlips';

      const currentPhotos = workOrder[fieldToUpdate] || [];
      const newPhotos = [...currentPhotos, ...uploadedResults];

      await updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), {
        [fieldToUpdate]: newPhotos,
      });

      setWorkOrder(prev => prev ? { ...prev, [fieldToUpdate]: newPhotos } : null);
      
      toastId.dismiss();
      toast({ title: "Photos Saved", description: `${files.length} photo(s) added successfully.` });

    } catch (error: any) {
      toastId.dismiss();
      toast({ 
        variant: "destructive", 
        title: "Upload Interrupted", 
        description: "Please check your signal and try again." 
      });
    } finally {
      setIsSavingPhotos(false);
    }
  };

  const handlePhotoDeleted = async (type: 'before' | 'after' | 'receipts', photoToDelete: string | PhotoMetadata) => {
    if (!db || !workOrder) return;

    let fieldToUpdate: 'beforePhotoUrls' | 'afterPhotoUrls' | 'receiptsAndPackingSlips';
    if (type === 'before') fieldToUpdate = 'beforePhotoUrls';
    else if (type === 'after') fieldToUpdate = 'afterPhotoUrls';
    else fieldToUpdate = 'receiptsAndPackingSlips';

    const targetUrl = typeof photoToDelete === 'string' ? photoToDelete : photoToDelete.url;
    const currentPhotos = workOrder[fieldToUpdate] || [];
    
    const newPhotos = currentPhotos.filter(p => {
      const url = typeof p === 'string' ? p : p.url;
      return url !== targetUrl;
    });

    setWorkOrder(prev => prev ? { ...prev, [fieldToUpdate]: newPhotos } : null);

    try {
        await updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), { [fieldToUpdate]: newPhotos });
        await deletePhotoMetadata(photoToDelete);
        toast({ title: "Photo Deleted" });
    } catch(error) {
        fetchData();
    }
  };

  const handleFilesUploaded = async (files: File[]) => {
    if (!db || !workOrder || files.length === 0) return;
    
    setIsUploadingFiles(true);
    const toastId = toast({ title: `Uploading ${files.length} file(s)...`, duration: Infinity });

    try {
      const uploadedFiles: FileAttachment[] = [];
      let i = 0;
      for (const file of files) {
        i++;
        const path = `work-orders/${workOrder.id}/files/${Date.now()}-${file.name}`;
        
        const { downloadURL } = await uploadImageResumable(file, path, {
          onProgress: (p) => {
            toastId.update({ id: toastId.id, description: `File ${i}/${files.length}: ${p.pct}%` });
          }
        });

        uploadedFiles.push({
          name: file.name,
          url: downloadURL,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
      }

      const currentFiles = workOrder.uploadedFiles || [];
      const newFiles = [...currentFiles, ...uploadedFiles];

      await updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), {
        uploadedFiles: newFiles,
      });

      setWorkOrder(prev => prev ? { ...prev, uploadedFiles: newFiles } : null);
      
      toastId.dismiss();
      toast({ title: "Files Uploaded" });

    } catch (error: any) {
      toastId.dismiss();
      toast({ variant: "destructive", title: "Upload Failed", description: "The transfer was interrupted." });
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
        await updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), { uploadedFiles: newFiles });
        await deleteImage(fileToDelete.url); 
        toast({ title: "File Deleted" });
    } catch(error) {
        fetchData();
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
        const { downloadURL } = await uploadImageResumable(signatureBlob, signaturePath);
        const signatureDate = new Date().toISOString();
        
        await updateDocumentNonBlocking(workOrderDocRef, {
            customerSignatureUrl: downloadURL,
            signatureDate: signatureDate,
            contactInfo: contactInfo
        });
        
        setWorkOrder(prev => prev ? ({ ...prev, customerSignatureUrl: downloadURL, signatureDate: signatureDate, contactInfo: contactInfo }) : null);

        toast({ title: "Signature Saved" });
        setIsSignatureDialogOpen(false);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Check your connection.' });
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
            await updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), { 
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
            await updateDocumentNonBlocking(doc(db, 'work_orders', workOrder.id), { 
                acknowledgements: updatedAcks 
            });
            await deleteImage(ack.signatureUrl);
            toast({ title: "Legacy Signature Deleted" });
        } catch(error) {
            fetchData(); 
        }
    }
  };
  
   const handleNotePhotoDelete = async (noteId: string, photoToDelete: string | PhotoMetadata) => {
    if (!db || !workOrder) return;
    
    const noteRef = doc(db, 'work_orders', workOrder.id, 'updates', noteId);
    const targetUrl = typeof photoToDelete === 'string' ? photoToDelete : photoToDelete.url;

    const updatedNotes = workOrder.notes.map(note => {
      if (note.id === noteId) {
        return { 
          ...note, 
          photoUrls: (note.photoUrls || []).filter(p => (typeof p === 'string' ? p : p.url) !== targetUrl) 
        };
      }
      return note;
    });
    
    setWorkOrder(prev => prev ? { ...prev, notes: updatedNotes } : null);

    try {
        await deletePhotoMetadata(photoToDelete); 
        const updatedNote = updatedNotes.find(n => n.id === noteId);
        if(updatedNote) {
            await updateDocumentNonBlocking(noteRef, { photoUrls: updatedNote.photoUrls || [] }); 
        }
        toast({ title: 'Photo Deleted' });
    } catch (error) {
        fetchData();
    }
  };

  const handleNoteDelete = (noteId: string) => {
    if (!db || !workOrder) return;

    const noteToDelete = workOrder.notes.find(note => note.id === noteId);
    if (!noteToDelete) return;

    setWorkOrder(prev => prev ? ({ ...prev, notes: prev.notes.filter(n => n.id !== noteId) }) : null);

    const noteRef = doc(db, 'work_orders', workOrder.id, 'updates', noteId);
    
    deleteDocumentNonBlocking(noteRef)
        .then(() => {
            const photoDeletePromises = (noteToDelete.photoUrls || []).map(p => deletePhotoMetadata(p));
            return Promise.all(photoDeletePromises);
        })
        .then(() => {
            toast({ title: 'Note Deleted' });
        })
        .catch(error => {
            fetchData();
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

  const handleLinkAsset = async (assetId: string) => {
    if (!db || !workOrder || isLinkingAsset) return;
    setIsLinkingAsset(assetId);
    try {
        const woRef = doc(db, 'work_orders', workOrder.id);
        await updateDocumentNonBlocking(woRef, { assetIds: arrayUnion(assetId) });
        
        // Optimistic update
        setWorkOrder(prev => {
            if (!prev) return null;
            const assetIds = prev.assetIds || [];
            if (!assetIds.includes(assetId)) {
                return { ...prev, assetIds: [...assetIds, assetId] };
            }
            return prev;
        });
        
        toast({ title: 'Asset Linked to Job' });
    } catch (e) {
        fetchData();
    } finally {
        setIsLinkingAsset(null);
    }
  };

  const handleUnlinkAsset = async (assetId: string) => {
    if (!db || !workOrder || isLinkingAsset) return;
    setIsLinkingAsset(assetId);
    try {
        const woRef = doc(db, 'work_orders', workOrder.id);
        await updateDocumentNonBlocking(woRef, { arrayRemove: arrayRemove(assetId) });
        
        // Optimistic update
        setWorkOrder(prev => {
            if (!prev) return null;
            const assetIds = prev.assetIds || [];
            return { ...prev, assetIds: assetIds.filter(id => id !== assetId) };
        });
        
        toast({ title: 'Asset Unlinked' });
    } catch (e) {
        fetchData();
    } finally {
        setIsLinkingAsset(null);
    }
  };

  const handleDownloadMedia = async () => {
    if (!workOrder) return;
    setIsDownloading(true);

    try {
        // Robust module resolution for different bundling environments
        const JSZipModule = await import('jszip');
        const JSZip = (JSZipModule as any).default || JSZipModule;
        
        const FileSaverModule = await import('file-saver');
        const saveAs = (FileSaverModule as any).saveAs || (FileSaverModule as any).default || FileSaverModule;

        if (typeof saveAs !== 'function') {
            throw new Error("Save function not found in file-saver module.");
        }

        const zip = new JSZip();
        // Create root folder named Work-Order-ID-media as requested
        const rootFolderName = `Work-Order-${workOrder.id}-media`;
        const rootFolder = zip.folder(rootFolderName);
        const beforeFolder = rootFolder?.folder("before");
        const afterFolder = rootFolder?.folder("after");
        const documentsFolder = rootFolder?.folder("documents");

        const getUrl = (p: string | PhotoMetadata) => typeof p === 'string' ? p : p.url;

        // Flatten all media documentation targets into either 'before' or 'after'
        const mediaItems: { url: string; subfolder: 'before' | 'after' }[] = [
            ...(workOrder.beforePhotoUrls || []).map(p => ({ url: getUrl(p), subfolder: 'before' as const })),
            ...(workOrder.afterPhotoUrls || []).map(p => ({ url: getUrl(p), subfolder: 'after' as const })),
            ...(workOrder.receiptsAndPackingSlips || []).map(p => ({ url: getUrl(p), subfolder: 'after' as const })),
            ...(workOrder.notes?.flatMap(note => (note.photoUrls || []).map(p => ({ url: getUrl(p), subfolder: 'after' as const }))) || []),
            ...(quotes?.flatMap(quote => (quote.photos || []).map(p => ({ url: getUrl(p), subfolder: 'after' as const }))) || []),
            ...(quotes?.flatMap(quote => (quote.videos || []).map(url => ({ url, subfolder: 'after' as const }))) || [])
        ];

        const documentFiles = workOrder.uploadedFiles || [];

        if (mediaItems.length === 0 && documentFiles.length === 0) {
            toast({ title: "No media found to download." });
            setIsDownloading(false);
            return;
        }

        const toastId = toast({ title: "Preparing Media ZIP", description: "Calculating sizes...", duration: Infinity });

        // Process Media Items (Photos/Videos)
        for (let i = 0; i < mediaItems.length; i++) {
            const item = mediaItems[i];
            if (!item.url) continue;

            toastId.update({ id: toastId.id, description: `Bundling media ${i + 1}/${mediaItems.length}...` });
            
            try {
                let extractedName = `media-${i}`;
                try {
                    if (item.url.startsWith('data:')) {
                        extractedName = `data-uri-${i}.jpg`;
                    } else {
                        const urlParts = new URL(item.url);
                        extractedName = decodeURIComponent(urlParts.pathname.split('/').pop() || `media-${i}`);
                    }
                } catch (urlErr) {
                    console.warn("Malformed media URL skipped:", item.url);
                }

                // Ensure unique filename using sequence index
                const fileName = `${i + 1}-${extractedName}`;

                const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(item.url)}`);
                if (!response.ok) throw new Error(`Proxy failed: ${response.status}`);
                
                const blob = await response.blob();
                
                // Route to appropriate subfolder inside rootFolder
                if (item.subfolder === 'before') {
                    beforeFolder?.file(fileName, blob);
                } else {
                    afterFolder?.file(fileName, blob);
                }
            } catch (e) {
                console.warn("Failed to fetch media item:", item.url, e);
            }
        }

        // Process Documents
        for (let i = 0; i < documentFiles.length; i++) {
            const file = documentFiles[i];
            toastId.update({ id: toastId.id, description: `Bundling document ${i + 1}/${documentFiles.length}...` });
            
            try {
                const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(file.url)}`);
                if (!response.ok) throw new Error(`Proxy failed: ${response.status}`);
                
                const blob = await response.blob();
                documentsFolder?.file(file.name, blob);
            } catch (e) {
                console.warn("Failed to fetch document:", file.url, e);
            }
        }

        toastId.update({ id: toastId.id, description: "Compressing documentation..." });
        const content = await zip.generateAsync({ 
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
        });
        
        // Filename matches root folder name
        saveAs(content, `${rootFolderName}.zip`);
        
        toastId.dismiss();
        toast({ title: "Download Started", description: "Your documentation zip is downloading." });
    } catch (error) {
        console.error("ZIP Generation Error:", error);
        toast({ 
            title: "Bundling Failed", 
            description: "An error occurred while creating the archive. Please try again.", 
            variant: "destructive" 
        });
    } finally {
        setIsDownloading(false);
    }
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
      await updateDocumentNonBlocking(workOrderRef, {
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
      await updateDocumentNonBlocking(workOrderRef, {
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

  const isTechnicianRole = currentUserRole?.name === 'Technician';
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
                {!isTechnicianRole && (
                    <Button variant="outline" onClick={handleDownloadMedia} disabled={isDownloading}>
                        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Download Media ZIP
                    </Button>
                )}
                {!isTechnicianRole && (
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
                {!isCompleted && !isEditing && !isTechnicianRole && workOrder.id !== '24-0001' && (
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
            ) : isTechnicianRole ? (
                <WorkOrderDetails
                    workOrder={workOrder} isTechnician={isTechnicianRole} isAdmin={isAdmin} trainingRecords={trainingRecords} onTrainingRecordDelete={handleTrainingRecordDelete} hvacReports={hvacReports} onHvacReportDelete={handleHvacReportDelete} timeEntries={timeEntries} activities={activities} quotes={quotes} onTimeEntriesSaved={handleTimeEntriesSaved} onNotePhotoDelete={handleNotePhotoDelete} onNoteDelete={handleNoteDelete} onBeforePhotosAdded={(files) => handlePhotosAdded('before', files)} onAfterPhotosAdded={(files) => handlePhotosAdded('after', files)} onReceiptsAndPackingSlipsAdded={(files) => handlePhotosAdded('receipts', files)} onBeforePhotoDelete={(url) => handlePhotoDeleted('before', url)} onAfterPhotoDelete={(url) => handlePhotoDeleted('after', url)} onReceiptsAndPackingSlipsPhotoDelete={(url) => handlePhotoDeleted('receipts', url)} onTimeEntryDelete={handleTimeEntryDelete} isSavingPhotos={isSavingPhotos} onDirectionsClick={() => workOrder.workSite && handleDirectionsClick(workOrder.workSite)} onSignatureSave={() => setIsSignatureDialogOpen(true)} onTempUpdate={handleTempUpdate} tempOnArrival={tempOnArrival} setTempOnArrival={setTempOnArrival} tempOnLeaving={tempOnLeaving} setTempOnLeaving={setTempOnLeaving} contactInfo={contactInfo} setContactInfo={setContactInfo} onContactInfoUpdate={handleContactInfoUpdate} onAddActivity={handleAddActivity} isAddingActivity={isAddingActivity} onUpdateActivityStatus={handleUpdateActivityStatus} onDeleteActivity={handleDeleteActivity} technicians={technicians} onMarkForReview={handleMarkForReview} isSubmittingReview={isSubmittingReview} onSignatureDelete={handleSignatureDelete} activeTab={activeTab} setActiveTab={setActiveTab} onReplyToAttention={handleReplyToAttention} onLinkAsset={handleLinkAsset} onUnlinkAsset={handleUnlinkAsset} isLinkingAsset={isLinkingAsset}
                />
            ) : (
                 <WorkOrderAdminDetails
                    workOrder={workOrder} assignedTechnician={assignedTechnician} isTechnician={isTechnicianRole} isAdmin={isAdmin} trainingRecords={trainingRecords} onTrainingRecordDelete={handleTrainingRecordDelete} hvacReports={hvacReports} onHvacReportDelete={handleHvacReportDelete} timeEntries={timeEntries} activities={activities} quotes={quotes} onNotePhotoDelete={handleNotePhotoDelete} onNoteDelete={handleNoteDelete} onBeforePhotosAdded={(files) => handlePhotosAdded('before', files)} onAfterPhotosAdded={(files) => handlePhotosAdded('after', files)} onReceiptsAndPackingSlipsAdded={(files) => handlePhotosAdded('receipts', files)} onBeforePhotoDelete={(url) => handlePhotoDeleted('before', url)} onAfterPhotoDelete={(url) => handlePhotoDeleted('after', url)} onReceiptsAndPackingSlipsPhotoDelete={(url) => handlePhotoDeleted('receipts', url)} onTimeEntryDelete={handleTimeEntryDelete} isSavingPhotos={isSavingPhotos} onDirectionsClick={() => workOrder.workSite && handleDirectionsClick(workOrder.workSite)} onSignatureSave={() => setIsSignatureDialogOpen(true)} onTempUpdate={handleTempUpdate} tempOnArrival={tempOnArrival} setTempOnArrival={setTempOnArrival} tempOnLeaving={tempOnLeaving} setTempOnLeaving={setTempOnLeaving} contactInfo={contactInfo} setContactInfo={setContactInfo} onAddActivity={handleAddActivity} isAddingActivity={isAddingActivity} onUpdateActivityStatus={handleUpdateActivityStatus} onDeleteActivity={handleDeleteActivity} technicians={technicians} onFilesUploaded={handleFilesUploaded} onFileDeleted={handleFileDeleted} isUploadingFiles={isUploadingFiles} onSignatureDelete={handleSignatureDelete} activeTab={activeTab} setActiveTab={setActiveTab} onClearAttentionStatus={handleClearReplyStatus} onLinkAsset={handleLinkAsset} onUnlinkAsset={handleUnlinkAsset} isLinkingAsset={isLinkingAsset}
                />
            )}
        </div>
      </div>

       <MapProviderSelection address={selectedAddress} isOpen={!!selectedAddress} onOpenChange={() => setSelectedAddress(null)} />
        <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
            <DialogContent className="fixed inset-0 z-[100] flex flex-col w-screen h-[100dvh] max-w-none translate-x-0 translate-y-0 border-none bg-background p-0 left-0 top-0 [&>button]:h-14 [&>button]:w-14 [&>button>svg]:!h-10 [&>button>svg]:!w-10 [&>button]:opacity-100 [&>button]:bg-muted/50 [&>button]:rounded-full [&>button]:top-4 [&>button]:right-4">
                <DialogHeader className="sr-only">
                    <DialogTitle>Capture Signature</DialogTitle>
                    <DialogDescription>Use your finger or stylus to provide a signature for this work order.</DialogDescription>
                </DialogHeader>
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
