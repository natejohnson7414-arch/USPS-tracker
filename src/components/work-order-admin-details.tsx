'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import type { WorkOrder, Technician, TimeEntry, Activity, HvacStartupReport, FileAttachment, Acknowledgement, Asset, Quote, WorkSite, PhotoMetadata } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from './status-badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Camera, FileText, X, Video, Library, Loader2, Map, ClipboardCheck, CheckCircle2, Link as LinkIcon, Trash2, CalendarClock, PlusCircle, FileCog, Upload, File, Image as ImageIcon, ReceiptText, Download, AlertCircle, Save, Package, ChevronRight, Filter, Receipt, Sparkles, Maximize2 } from 'lucide-react';
import { NoteActivityItem } from './note-activity-item';
import { TimeActivityItem } from './time-activity-item';
import { useFirestore, useUser, updateDocumentNonBlocking } from '@/firebase';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { getAssetsBySiteId } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from './ui/date-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { notifyTechnicianOfAttention } from '@/ai/flows/notify-technician-flow';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Separator } from '@/components/ui/separator';

const ActivityItem = React.memo(({ activity, technicians, onDeleteClick, isCompleted }: { 
    activity: Activity, 
    technicians: Technician[],
    onDeleteClick: () => void,
    isCompleted: boolean
}) => {
    const assignedTechnician = activity.technician || technicians.find(t => t.id === activity.technicianId);
    
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-4">
            <div className="flex-1 space-y-1">
                <p className="font-medium">{activity.description}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                     {assignedTechnician && (
                        <div className="flex items-center gap-2">
                             <Avatar className="h-6 w-6">
                                <AvatarImage src={assignedTechnician.avatarUrl} alt={assignedTechnician.name} />
                                <AvatarFallback>{assignedTechnician.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                           <span>{assignedTechnician.name}</span>
                        </div>
                    )}
                    <span>{format(new Date(activity.scheduled_date), 'MMM d, yyyy')}</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {!isCompleted && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDeleteClick}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete Activity</span>
                  </Button>
                )}
            </div>
        </div>
    );
});
ActivityItem.displayName = 'ActivityItem';

interface WorkOrderAdminDetailsProps {
  workOrder: WorkOrder;
  assignedTechnician?: Technician;
  isTechnician: boolean;
  isAdmin: boolean;
  trainingRecords: TrainingRecord[];
  onTrainingRecordDelete: (recordId: string) => void;
  hvacReports: HvacStartupReport[];
  onHvacReportDelete: (reportId: string) => void;
  timeEntries: TimeEntry[];
  activities: Activity[];
  quotes: Quote[];
  onNotePhotoDelete: (noteId: string, photo: string | PhotoMetadata) => void;
  onNoteDelete: (noteId: string) => void;
  onBeforePhotosAdded: (files: File[]) => void;
  onAfterPhotosAdded: (files: File[]) => void;
  onReceiptsAndPackingSlipsAdded: (files: File[]) => void;
  onBeforePhotoDelete: (photo: string | PhotoMetadata) => void;
  onAfterPhotoDelete: (photo: string | PhotoMetadata) => void;
  onReceiptsAndPackingSlipsPhotoDelete: (photo: string | PhotoMetadata) => void;
  onTimeEntryDelete: (timeEntryId: string) => void;
  isSavingPhotos: boolean;
  onDirectionsClick: (workSite: WorkSite) => void;
  onSignatureSave: () => void;
  onTempUpdate: () => void;
  tempOnArrival: string;
  setTempOnArrival: (value: string) => void;
  tempOnLeaving: string;
  setTempOnLeaving: (value: string) => void;
  contactInfo: string;
  setContactInfo: (value: string) => void;
  onContactInfoUpdate: () => void;
  onAddActivity: (activity: Omit<Activity, 'id' | 'createdDate' | 'workOrderId'>) => void;
  isAddingActivity: boolean;
  onUpdateActivityStatus: (activityId: string, status: Activity['status']) => void;
  onDeleteActivity: (activityId: string) => void;
  technicians: Technician[];
  onFilesUploaded: (files: File[]) => void;
  onFileDeleted: (file: FileAttachment) => void;
  isUploadingFiles: boolean;
  onSignatureDelete: (ack?: Acknowledgement) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onClearAttentionStatus?: () => void;
  onLinkAsset: (assetId: string) => void;
  onUnlinkAsset: (assetId: string) => void;
  isLinkingAsset: string | null;
}

export function WorkOrderAdminDetails({
  workOrder,
  assignedTechnician,
  isTechnician,
  isAdmin,
  trainingRecords,
  onTrainingRecordDelete,
  hvacReports,
  onHvacReportDelete,
  timeEntries,
  activities,
  quotes,
  onNotePhotoDelete,
  onNoteDelete,
  onBeforePhotosAdded,
  onAfterPhotosAdded,
  onReceiptsAndPackingSlipsAdded,
  onBeforePhotoDelete,
  onAfterPhotoDelete,
  onReceiptsAndPackingSlipsPhotoDelete,
  onTimeEntryDelete,
  isSavingPhotos,
  onDirectionsClick,
  onTempUpdate,
  tempOnArrival, setTempOnArrival,
  tempOnLeaving, setTempOnLeaving,
  contactInfo, setContactInfo,
  onAddActivity,
  isAddingActivity,
  onUpdateActivityStatus,
  onDeleteActivity,
  technicians,
  onFilesUploaded,
  onFileDeleted,
  isUploadingFiles,
  onSignatureDelete,
  activeTab,
  setActiveTab,
  onClearAttentionStatus,
  onLinkAsset,
  onUnlinkAsset,
  isLinkingAsset,
}: WorkOrderAdminDetailsProps) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [photoSheetTarget, setPhotoSheetTarget] = useState<'before' | 'after' | 'receipts' | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [timeEntryToDelete, setTimeEntryToDelete] = useState<string | null>(null);
  const [trainingRecordToDelete, setTrainingRecordToDelete] = useState<string | null>(null);
  const [hvacReportToDelete, setHvacReportToDelete] = useState<string | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDeletingSignature, setIsDeletingSignature] = useState(false);
  const [ackToDelete, setAckToDelete] = useState<Acknowledgement | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string, type: 'before' | 'after' | 'receipts' } | null>(null);

  const [siteAssets, setSiteAssets] = useState<Asset[]>([]);

  const [internalNotes, setInternalNotes] = useState(workOrder.internalNotes || '');
  const [needsAttention, setNeedsAttention] = useState(workOrder.needsAttention || false);
  const [attentionMessage, setAttentionMessage] = useState(workOrder.attentionMessage || '');
  const [customSummary, setCustomSummary] = useState(workOrder.customWorkPerformedSummary || '');
  const [isSavingAdminNotes, setIsSavingAdminNotes] = useState(false);

  const isCompleted = workOrder.status === 'Completed';

  const combinedActivity = useMemo(() => {
    return [
      ...workOrder.notes.map(note => ({ ...note, type: 'note' as const, date: note.createdAt || workOrder.createdDate })),
      ...timeEntries.map(entry => ({ ...entry, type: 'time' as const, date: entry.date }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [workOrder.notes, timeEntries, workOrder.createdDate]);

  useEffect(() => {
    setIsClient(true);
    if (db && workOrder.workSiteId) {
        getAssetsBySiteId(db, workOrder.workSiteId).then(assets => {
            const sortedAssets = [...assets].sort((a, b) => a.name.localeCompare(b.name));
            setSiteAssets(sortedAssets);
        });
    }
  }, [db, workOrder.workSiteId]);

  const takePhotoInputRef = useRef<HTMLInputElement>(null);
  const chooseFromLibraryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && photoSheetTarget) {
      const fileArray = Array.from(files);
      if (photoSheetTarget === 'before') onBeforePhotosAdded(fileArray);
      else if (photoSheetTarget === 'after') onAfterPhotosAdded(fileArray);
      else if (photoSheetTarget === 'receipts') onReceiptsAndPackingSlipsAdded(fileArray);
      setPhotoSheetTarget(null);
    }
    event.target.value = '';
  };
  
  const confirmDeleteNote = () => { if (noteToDelete) { onNoteDelete(noteToDelete); setNoteToDelete(null); } };
  const confirmDeleteTimeEntry = () => { if (timeEntryToDelete) { onTimeEntryDelete(timeEntryToDelete); setTimeEntryToDelete(null); } };
  const confirmDeleteTrainingRecord = () => { if (trainingRecordToDelete) { onTrainingRecordDelete(trainingRecordToDelete); setTrainingRecordToDelete(null); } };
  const confirmDeleteHvacReport = () => { if (hvacReportToDelete) { onHvacReportDelete(hvacReportToDelete); setHvacReportToDelete(null); } };
  const confirmDeleteActivity = () => { if (activityToDelete) { onDeleteActivity(activityToDelete.id); setActivityToDelete(null); } };

  const getLinkUrl = (url: string | undefined) => {
    if (!url) return '#';
    if (url.startsWith('http')) return url;
    if (/\d/.test(url)) {
        const sanitizedPhone = url.replace(/;/g, 'w').replace(/[^0-9+,w#*]/g, '');
        return `tel:${sanitizedPhone}`;
    }
    return url;
  }

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) onFilesUploaded(Array.from(files));
    event.target.value = '';
  };
  
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="h-5 w-5 flex-shrink-0 text-blue-500" />;
    if (fileType.startsWith('video/')) return <Video className="h-5 w-5 flex-shrink-0 text-purple-500" />;
    if (fileType === 'application/pdf') return <FileText className="h-5 w-5 flex-shrink-0 text-red-500" />;
    return <File className="h-5 w-5 flex-shrink-0 text-gray-500" />;
  }

  const handleSaveAdminNotes = async () => {
    if (!db || !user) return;
    setIsSavingAdminNotes(true);
    try {
        const woRef = doc(db, 'work_orders', workOrder.id);
        const updateData: Partial<WorkOrder> = {
            internalNotes,
            needsAttention,
            attentionMessage: needsAttention ? attentionMessage : '',
            customWorkPerformedSummary: customSummary,
            ...(needsAttention && { technicianReplied: false })
        };
        if (needsAttention && workOrder.status !== 'Completed') updateData.status = 'In Progress';
        await updateDocumentNonBlocking(woRef, updateData);
        toast({ title: 'Admin Notes Saved' });
        if (needsAttention && !workOrder.needsAttention && assignedTechnician) {
            notifyTechnicianOfAttention({
                workOrderId: workOrder.id,
                jobName: workOrder.jobName,
                technicianName: assignedTechnician.name,
                technicianEmail: assignedTechnician.email || '',
                message: attentionMessage
            });
        }
    } catch (error) { toast({ title: "Failed to save admin notes", variant: 'destructive' }); } finally { setIsSavingAdminNotes(false); }
  };

  const handleToggleNoteReportInclusion = async (noteId: string, excluded: boolean) => {
    if (!db) return;
    try {
      const noteRef = doc(db, 'work_orders', workOrder.id, 'updates', noteId);
      await updateDocumentNonBlocking(noteRef, { excludeFromReport: excluded });
    } catch (e) {}
  };

  const handleToggleActivityReportInclusion = async (activityId: string, excluded: boolean) => {
    if (!db) return;
    try {
      const actRef = doc(db, 'work_orders', workOrder.id, 'activities', activityId);
      await updateDocumentNonBlocking(actRef, { excludeFromReport: excluded });
    } catch (e) {}
  };

  const handleToggleTimeReportInclusion = async (timeEntryId: string, excluded: boolean) => {
    if (!db) return;
    try {
      const entryRef = doc(db, 'time_entries', timeEntryId);
      await updateDocumentNonBlocking(entryRef, { excludeFromReport: excluded });
    } catch (e) {}
  };

  const handleClearReplyStatus = async () => { if (onClearAttentionStatus) onClearAttentionStatus(); };

  const handleDeletePhotoInViewer = () => {
    if (!viewingPhoto) return;
    const targetUrl = viewingPhoto.url;
    
    const findPhoto = (list: (string | PhotoMetadata)[] | undefined) => 
      list?.find(p => (typeof p === 'string' ? p : p.url) === targetUrl);

    const photoObj = findPhoto(workOrder.beforePhotoUrls) || 
                     findPhoto(workOrder.afterPhotoUrls) || 
                     findPhoto(workOrder.receiptsAndPackingSlips);

    if (photoObj) {
      if (viewingPhoto.type === 'before') onBeforePhotoDelete(photoObj);
      else if (viewingPhoto.type === 'after') onAfterPhotoDelete(photoObj);
      else onReceiptsAndPackingSlipsPhotoDelete(photoObj);
    }
    
    setViewingPhoto(null);
  };

  const getPhotoUrl = (p: string | PhotoMetadata) => typeof p === 'string' ? p : p.url;
  const getThumbUrl = (p: string | PhotoMetadata) => typeof p === 'string' ? p : p.thumbnailUrl || p.url;
  const getProxiedUrl = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`;

  const linkedAssetIds = new Set(workOrder.assetIds || []);

  return (
    <>
      {(isSavingPhotos || isUploadingFiles) && (
        <div className="fixed inset-0 bg-background/80 z-50 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="mt-4 text-lg font-medium">Uploading Media...</p>
        </div>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="folder">
          <TabsTrigger value="overview" variant="folder">Overview</TabsTrigger>
          <TabsTrigger value="assets" variant="folder">Assets</TabsTrigger>
          <TabsTrigger value="media" variant="folder">Media</TabsTrigger>
          <TabsTrigger value="activity" variant="folder">Activity</TabsTrigger>
          {quotes && quotes.length > 0 && <TabsTrigger value="quotes" variant="folder">Quotes ({quotes.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="space-y-8">
            {workOrder.needsAttention && (
                <div className="bg-destructive/10 border-2 border-destructive p-4 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
                    <div><p className="font-bold text-destructive">OFFICE ALERT: NEEDS ATTENTION</p><p className="text-sm">{workOrder.attentionMessage}</p></div>
                </div>
            )}
            {!workOrder.needsAttention && workOrder.technicianReplied && (
                <div className="bg-green-50 border-2 border-green-600 p-4 rounded-lg flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" /><div><p className="font-bold text-green-700">TECHNICIAN REPLIED</p><p className="text-sm">The technician has addressed your attention request.</p></div></div>
                    <Button variant="outline" size="sm" onClick={handleClearReplyStatus}>Clear Notification</Button>
                </div>
            )}
            <Card className="rounded-t-none">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div className="flex flex-col items-start gap-2"><StatusBadge status={workOrder.status} /></div>
                  <div className="flex items-center gap-2">
                    {workOrder.sourcePdfUrl && <Button asChild variant="secondary"><Link href={workOrder.sourcePdfUrl} target="_blank" rel="noopener noreferrer"><FileText className="mr-2 h-4 w-4" />View Source PDF</Link></Button>}
                    {workOrder.checkInOutURL && (
                      <div className="flex flex-col items-center">
                        <Button asChild variant="outline" size="icon"><a href={getLinkUrl(workOrder.checkInOutURL)} target="_blank" rel="noopener noreferrer"><LinkIcon className="h-4 w-4" /><span className="sr-only">Check-in</span></a></Button>
                        {workOrder.checkInWorkOrderNumber && <p className="text-xs text-muted-foreground mt-1 max-w-[60px] truncate" title={workOrder.checkInWorkOrderNumber}>WO: {workOrder.checkInWorkOrderNumber}</p>}
                      </div>
                    )}
                    {workOrder.workSite && <Button variant="outline" size="icon" onClick={() => onDirectionsClick(workOrder.workSite!)}><Map className="h-4 w-4" /><span className="sr-only">Get Directions</span></Button>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{workOrder.createdDate ? format(new Date(workOrder.createdDate), 'MMM d, yyyy') : 'N/A'}</span></div>
                  <div className="flex justify-between items-start"><span className="text-muted-foreground">Bill To</span><div className="text-right"><p className="font-medium">{workOrder.client?.name || workOrder.billTo || 'N/A'}</p>{workOrder.client?.address && <p className="text-xs text-muted-foreground">{workOrder.client.address}</p>}</div></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">PO #</span><span className="font-medium">{workOrder.poNumber || 'N/A'}</span></div>
                  <div className="flex justify-between items-start"><span className="text-muted-foreground">Contact</span><span className="font-medium text-right whitespace-pre-wrap">{workOrder.contactInfo || 'N/A'}</span></div>
                  <Separator/><div className="flex justify-between items-start"><span className="text-muted-foreground">Job Site</span><div className="text-right"><p className="font-medium">{workOrder.workSite?.name || 'N/A'}</p>{workOrder.workSite?.address && <p className="text-xs text-muted-foreground">{workOrder.workSite.address}</p>}</div></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Assigned To</span>{assignedTechnician ? <div className="flex items-center gap-2 font-medium"><span>{assignedTechnician.name}</span></div> : <span className="font-medium">Unassigned</span>}</div>
                   <Separator/><div className="flex justify-between"><span className="text-muted-foreground">Schedule Date</span><span className="font-medium">{workOrder.serviceScheduleDate ? format(new Date(workOrder.serviceScheduleDate), 'MMM d, yyyy') : 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Quoted Amount</span><span className="font-medium">{workOrder.quotedAmount ? `$${workOrder.quotedAmount.toFixed(2)}` : 'N/A'}</span></div>
                     <div className="flex justify-between"><span className="text-muted-foreground">Time &amp; Material</span><span className="font-medium">{workOrder.timeAndMaterial ? 'Yes' : 'No'}</span></div>
                     <Separator/><div className="flex justify-between"><span className="text-muted-foreground">Customer PO#</span><span className="font-medium">{workOrder.customerPO || 'N/A'}</span></div>
                     <div className="flex justify-between"><span className="text-muted-foreground">Estimator</span><span className="font-medium">{workOrder.estimator || 'N/A'}</span></div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="h-5 w-5" />Final Documentation Control</CardTitle>
                  <CardDescription>Enter the official technical summary for the final PDF report.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2"><Label htmlFor="report-override" className="font-bold">Official Work Performed Description</Label><Textarea id="report-override" placeholder="Manually enter the final technical summary for the customer report here..." value={customSummary} onChange={(e) => setCustomSummary(e.target.value)} rows={6} className="bg-background"/></div>
                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-md bg-background"><div className="space-y-0.5"><Label htmlFor="needs-attention">Flag: Needs Attention</Label><p className="text-xs text-muted-foreground">Highlights this job for the technician (Red Highlight).</p></div><Switch id="needs-attention" checked={needsAttention} onCheckedChange={setNeedsAttention}/></div>
                    {needsAttention && <div className="space-y-2"><Label htmlFor="attention-msg">Attention Instructions</Label><Textarea id="attention-msg" placeholder="Explain why this needs attention..." value={attentionMessage} onChange={(e) => setAttentionMessage(e.target.value)} className="bg-background"/></div>}
                    <div className="space-y-2"><Label htmlFor="internal-notes">Internal Office Notes</Label><Textarea id="internal-notes" placeholder="Add private notes for the office (not visible to customers)..." value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={4} className="bg-background"/></div>
                    <Button onClick={handleSaveAdminNotes} disabled={isSavingAdminNotes} className="w-full">{isSavingAdminNotes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Office Updates</Button>
                </CardContent>
            </Card>
            
            <Card>
              <CardHeader><CardTitle>Work Order Sign-off</CardTitle></CardHeader>
              <CardContent>
                  <div className="space-y-4">
                    {workOrder.customerSignatureUrl && (
                        <div className="flex items-center justify-between p-3 border rounded-md">
                            <div><p className="font-medium">{workOrder.contactInfo || 'Signed'}</p><p className="text-xs text-muted-foreground">{workOrder.signatureDate ? format(new Date(workOrder.signatureDate), 'PP p') : ''}</p></div>
                            <div className="flex items-center gap-2">
                              <div className="bg-muted p-1 rounded-md"><Image src={workOrder.customerSignatureUrl} alt="Signature" width={120} height={40} sizes="120px" className="object-contain" /></div>
                              {!isCompleted && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { setAckToDelete(null); setIsDeletingSignature(true); }}><Trash2 className="h-4 w-4"/></Button>}
                            </div>
                        </div>
                    )}
                    {workOrder.acknowledgements && workOrder.acknowledgements.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-muted-foreground">Previous Signatures</p>
                            {workOrder.acknowledgements.map((ack, index) => (
                                <div key={index} className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                                    <div><p className="font-medium">{ack.name}</p><p className="text-xs text-muted-foreground">{ack.date ? format(new Date(ack.date), 'PP p') : ''}</p></div>
                                    <div className="flex items-center gap-2">
                                      <div className="bg-white p-1 rounded-md border"><Image src={ack.signatureUrl} alt={`Signature ${index}`} width={100} height={35} sizes="100px" className="object-contain" /></div>
                                      {!isCompleted && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { setAckToDelete(ack); setIsDeletingSignature(true); }}><Trash2 className="h-4 w-4"/></Button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!workOrder.customerSignatureUrl && (!workOrder.acknowledgements || workOrder.acknowledgements.length === 0) && <p className="text-sm text-center text-muted-foreground py-4">No signatures captured.</p>}
                  </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="mt-0">
          <div className="space-y-8">
            <Card className="rounded-t-none">
              <CardHeader>
                <div className="flex justify-between items-center"><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Site Equipment Registry</CardTitle>{!isCompleted && <Button variant="outline" size="sm" asChild><Link href={`/assets/new?siteId=${workOrder.workSiteId}&workOrderId=${workOrder.id}`}><PlusCircle className="mr-2 h-4 w-4" /> Register New Asset</Link></Button>}</div>
                <CardDescription>Select equipment from the site registry to assign it to this job.</CardDescription>
              </CardHeader>
              <CardContent>
                {linkedAssetIds.size > 0 || siteAssets.length > 0 ? (
                  <div className="space-y-3">
                    {siteAssets.map(asset => {
                      const isLinked = linkedAssetIds.has(asset.id);
                      const isLoad = isLinkingAsset === asset.id;
                      return (
                        <div key={asset.id} className={`flex items-center justify-between p-3 border rounded-lg transition-all ${isLinked ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10' : 'hover:bg-muted/30'}`}>
                          <Link href={`/assets/${asset.id}`} className="flex-1 group/asset">
                            <div className="flex items-center gap-2">
                              <p className="font-bold group-hover/asset:underline">{asset.name}</p>
                              <Badge variant="outline" className="font-mono text-[10px]">{asset.assetTag}</Badge>
                              {isLinked && <Badge className="h-5 text-[10px] bg-primary text-primary-foreground">Linked to Job</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{asset.manufacturer} {asset.model} • {asset.status}</p>
                          </Link>
                          <div className="flex items-center gap-2">
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                              <Link href={`/assets/${asset.id}`}><ChevronRight className="h-4 w-4" /></Link>
                            </Button>
                            {!isCompleted && (
                              <div className="flex items-center gap-2">
                                {isLinked ? (
                                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => onUnlinkAsset(asset.id)} disabled={!!isLinkingAsset}>
                                    {isLoad ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" /> Unlink</>}
                                  </Button>
                                ) : (
                                  <Button variant="outline" size="sm" className="gap-2" onClick={() => onLinkAsset(asset.id)} disabled={!!isLinkingAsset}>
                                    {isLoad ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LinkIcon className="h-4 w-4" /> Link Asset</>}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-sm text-center text-muted-foreground py-8">No equipment registered at this site yet.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="media" className="mt-0">
          <div className="space-y-8">
              <Card className="rounded-t-none">
                  <CardHeader><CardTitle>Job Photos</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                      <div>
                          <h3 className="font-medium mb-2">Before Photos</h3>
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 mb-4">
                            {(workOrder.beforePhotoUrls || []).map((photo) => (
                              <div key={getPhotoUrl(photo)} className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer" onClick={() => setViewingPhoto({ url: getPhotoUrl(photo), type: 'before' })}>
                                <Image src={getThumbUrl(photo)} alt={`Before photo`} fill sizes="(max-width: 768px) 25vw, 12vw" className="object-cover" />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="text-white h-5 w-5" /></div>
                              </div>
                            ))}
                          </div>
                          {!isCompleted && <Button variant="outline" onClick={() => setPhotoSheetTarget('before')} disabled={isSavingPhotos}><Camera className="mr-2 h-4 w-4" /> Add Before Photos</Button>}
                      </div>
                      <Separator />
                      <div>
                          <h3 className="font-medium mb-2">After Photos</h3>
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 mb-4">
                            {(workOrder.afterPhotoUrls || []).map((photo) => (
                              <div key={getPhotoUrl(photo)} className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer" onClick={() => setViewingPhoto({ url: getPhotoUrl(photo), type: 'after' })}>
                                <Image src={getThumbUrl(photo)} alt={`After photo`} fill sizes="(max-width: 768px) 25vw, 12vw" className="object-cover" />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="text-white h-5 w-5" /></div>
                              </div>
                            ))}
                          </div>
                          {!isCompleted && <Button variant="outline" onClick={() => setPhotoSheetTarget('after')} disabled={isSavingPhotos}><Camera className="mr-2 h-4 w-4" /> Add After Photos</Button>}
                      </div>
                  </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText /> Receipts &amp; Packing Slips</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 mb-4">
                    {(workOrder.receiptsAndPackingSlips || []).map((photo) => (
                      <div key={getPhotoUrl(photo)} className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer" onClick={() => setViewingPhoto({ url: getPhotoUrl(photo), type: 'receipts' })}>
                        <Image src={getThumbUrl(photo)} alt={`Receipt or packing slip`} fill sizes="(max-width: 768px) 25vw, 12vw" className="object-cover" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="text-white h-5 w-5" /></div>
                      </div>
                    ))}
                  </div>
                  {!isCompleted && <Button variant="outline" onClick={() => setPhotoSheetTarget('receipts')} disabled={isSavingPhotos}><Camera className="mr-2 h-4 w-4" /> Add Photos</Button>}
                </CardContent>
              </Card>
               <Card><CardHeader><CardTitle>Files</CardTitle></CardHeader><CardContent className="space-y-4">{!isCompleted && <><input type="file" ref={fileInputRef} onChange={handleFileSelection} className="hidden" multiple /><Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploadingFiles}><Upload className="mr-2 h-4 w-4" />Upload Files</Button></>}<div className="relative"><div className="space-y-2">{(workOrder.uploadedFiles || []).length > 0 ? (workOrder.uploadedFiles?.map(file => (<div key={file.url} className="flex items-center justify-between p-2 border rounded-md gap-2"><a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 flex-1 truncate">{getFileIcon(file.type)}<div className="truncate"><p className="text-sm font-medium truncate">{file.name}</p><p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p></div></a>{!isCompleted && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onFileDeleted(file)}><Trash2 className="h-4 w-4" /></Button>}</div>))) : <p className="text-sm text-muted-foreground text-center py-4">No files uploaded.</p>}</div></div></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-0">
          <div className="space-y-8">
            <Card className="rounded-t-none">
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Scheduled Activities</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {activities.length > 0 ? activities.map(activity => (
                    <ActivityItem key={activity.id} activity={activity} technicians={technicians} onDeleteClick={() => setActivityToDelete(activity)} isCompleted={isCompleted} />
                  )) : <p className="text-center text-sm text-muted-foreground py-4">No scheduled activities.</p>}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Field Notes & Time Feed</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-6">
                  {isClient ? combinedActivity.map(activity => (activity as any).type === 'note' ? (
                    <NoteActivityItem key={`note-${activity.id}`} note={activity as any} onPhotoDelete={isCompleted ? undefined : onNotePhotoDelete} onNoteDelete={isCompleted ? undefined : onNoteDelete} showPhotos={false} isAdmin={true} />
                  ) : <TimeActivityItem key={`time-${activity.id}`} timeEntry={activity as any} onTimeEntryDelete={isCompleted ? undefined : onTimeEntryDelete} isAdmin={true} />) : <p className="text-center text-sm text-muted-foreground py-4">Loading activity...</p>}
                  {isClient && combinedActivity.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No notes or activity yet.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="border-sky-200 bg-sky-50/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-sky-900"><Filter className="h-5 w-5" />PDF Report Documentation Selection</CardTitle>
                <CardDescription>Select which field updates will be used by the AI to generate the technical summary.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] border rounded-md bg-white">
                  <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Scheduled Activities</p>
                      {activities.map(activity => (
                        <div key={activity.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 border border-muted transition-all">
                          <Checkbox id={`report-act-${activity.id}`} checked={!activity.excludeFromReport} onCheckedChange={(checked) => handleToggleActivityReportInclusion(activity.id, !checked)} />
                          <Label htmlFor={`report-act-${activity.id}`} className="text-sm font-medium cursor-pointer leading-tight flex-1">{activity.description}<span className="block text-[10px] text-muted-foreground mt-0.5">{format(new Date(activity.scheduled_date), 'MMM d')} • {activity.status}</span></Label>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Technician Notes</p>
                      {workOrder.notes.map(note => (
                        <div key={note.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 border border-muted transition-all">
                          <Checkbox id={`report-note-${note.id}`} checked={!note.excludeFromReport} onCheckedChange={(checked) => handleToggleNoteReportInclusion(note.id, !checked)} />
                          <Label htmlFor={`report-note-${note.id}`} className="text-sm font-medium cursor-pointer leading-tight flex-1">{note.text}<span className="block text-[10px] text-muted-foreground mt-0.5">{format(new Date(note.createdAt), 'MMM d')}</span></Label>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Time Posting Descriptions</p>
                      {timeEntries.filter(te => te.notes).map(entry => (
                        <div key={entry.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 border border-muted transition-all">
                          <Checkbox id={`report-time-${entry.id}`} checked={!entry.excludeFromReport} onCheckedChange={(checked) => handleToggleTimeReportInclusion(entry.id, !checked)} />
                          <Label htmlFor={`report-time-${entry.id}`} className="text-sm font-medium cursor-pointer leading-tight flex-1">{entry.notes}<span className="block text-[10px] text-muted-foreground mt-0.5">{format(new Date(entry.date), 'MMM d')} • {entry.hours}h</span></Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {quotes && quotes.length > 0 && (
          <TabsContent value="quotes" className="mt-0">
            <Card className="rounded-t-none">
              <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Associated Quotes</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {quotes.map(quote => (
                    <Link key={quote.id} href={`/quotes/${quote.id}`}>
                      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div><p className="font-bold">{quote.quoteNumber}</p><p className="text-xs text-muted-foreground">{format(new Date(quote.createdDate), 'MMM d, yyyy')}</p></div>
                        <div className="flex items-center gap-3"><Badge variant="outline">{quote.status}</Badge><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-0 flex flex-col items-stretch h-[90vh]">
          <DialogHeader className="p-4 bg-background/10 backdrop-blur-sm border-b border-white/10 absolute top-0 w-full z-10">
            <DialogTitle className="text-white text-sm font-bold uppercase tracking-widest">{viewingPhoto?.type === 'before' ? 'Before Work' : viewingPhoto?.type === 'after' ? 'After Work' : 'Receipt / Packing Slip'}</DialogTitle>
            <DialogDescription className="sr-only">High resolution preview of work order documentation</DialogDescription>
          </DialogHeader>
          <div className="flex-1 relative flex items-center justify-center p-4">
            {viewingPhoto && (
              <Image 
                src={getProxiedUrl(viewingPhoto.url)} 
                alt="High resolution documentation" 
                fill 
                className="object-contain" 
                priority 
                unoptimized={true}
              />
            )}
          </div>
          <div className="p-4 bg-background flex justify-between items-center border-t">
            <Button variant="outline" size="sm" onClick={() => setViewingPhoto(null)}>Close</Button>
            <div className="flex items-center gap-2">
                {viewingPhoto && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={getProxiedUrl(viewingPhoto.url)} download>
                      <Download className="h-4 w-4 mr-2" /> Download
                    </a>
                  </Button>
                )}
                {!isCompleted && viewingPhoto && (
                  <Button variant="destructive" size="sm" onClick={handleDeletePhotoInViewer}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Documentation
                  </Button>
                )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this note.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteNote}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!timeEntryToDelete} onOpenChange={(open) => !open && setTimeEntryToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this time entry.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteTimeEntry}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!trainingRecordToDelete} onOpenChange={(open) => !open && setTrainingRecordToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this training record.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteTrainingRecord}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!hvacReportToDelete} onOpenChange={(open) => !open && setHvacReportToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this HVAC Start-up Report.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteHvacReport}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!activityToDelete} onOpenChange={(open) => !open && setActivityToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this scheduled activity.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteActivity}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={isDeletingSignature} onOpenChange={setIsDeletingSignature}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Signature?</AlertDialogTitle><AlertDialogDescription>{ackToDelete ? `This will permanently remove the signature from "${ackToDelete.name}".` : "This will permanently remove the signature from this work order."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { onSignatureDelete(ackToDelete || undefined); setIsDeletingSignature(false); }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <Sheet open={!!photoSheetTarget} onOpenChange={(isOpen) => !isOpen && setPhotoSheetTarget(null)}><SheetContent side="bottom"><SheetHeader><SheetTitle>Add {photoSheetTarget === 'receipts' ? 'Receipt/Slip' : photoSheetTarget} photos</SheetTitle></SheetHeader><div className="grid gap-4 py-4"><Button type="button" variant="outline" className="justify-start" onClick={() => takePhotoInputRef.current?.click()}><Camera className="mr-4 h-5 w-5" />Take Photo</Button><Button type="button" variant="outline" className="justify-start" onClick={() => chooseFromLibraryInputRef.current?.click()}><Library className="mr-4 h-5 w-5" />Choose from Library</Button></div></SheetContent></Sheet>
      <input type="file" ref={takePhotoInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" multiple /><input type="file" ref={chooseFromLibraryInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
    </>
  );
}