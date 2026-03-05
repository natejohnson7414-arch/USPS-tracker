
'use client';

import React, { useState, useRef, useEffect, FormEvent, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format, isSameDay } from 'date-fns';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client, TrainingRecord, TimeEntry, Activity, HvacStartupReport, Acknowledgement, Asset } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from './status-badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Camera, FileText, X, Video, Library, Loader2, Map, Thermometer, ClipboardCheck, Clock, Link as LinkIcon, Trash2, CalendarClock, PlusCircle, FileCog, ReceiptText, Download, AlertCircle, CheckCircle2, Package, ChevronRight } from 'lucide-react';
import { NoteActivityItem } from './note-activity-item';
import { TimeActivityItem } from './time-activity-item';
import { useFirestore, useUser, updateDocumentNonBlocking } from '@/firebase';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { getTechnicianById, getAssetsBySiteId, getAssetsByIds } from '@/lib/data';
import { AddTimeDialog } from './add-time-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from './ui/date-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { WorkOrderReviewDialog } from './work-order-review-dialog';

const AddActivityForm = ({ technicians, onAddActivity, isLoading, isTechnician, currentUserId }: { 
    technicians: Technician[], 
    onAddActivity: (activity: any) => void, 
    isLoading: boolean,
    isTechnician: boolean,
    currentUserId?: string 
}) => {
    const [description, setDescription] = useState('');
    const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | undefined>(isTechnician ? currentUserId : undefined);
    const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
    
    const displayTechnicianId = isTechnician ? currentUserId : selectedTechnicianId;

    useEffect(() => {
        if (isTechnician && currentUserId) {
            setSelectedTechnicianId(currentUserId);
        }
    }, [isTechnician, currentUserId]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const submissionTechnicianId = isTechnician ? currentUserId : selectedTechnicianId;
        if (!description || !submissionTechnicianId || !scheduledDate || isLoading) return;
        onAddActivity({
            description,
            technicianId: submissionTechnicianId,
            scheduled_date: scheduledDate.toISOString(),
            status: 'scheduled'
        });
        setDescription('');
        if (!isTechnician) setSelectedTechnicianId(undefined);
        setScheduledDate(new Date());
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea 
                placeholder="Describe the new activity..." 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <Select value={displayTechnicianId} onValueChange={setSelectedTechnicianId} required disabled={isTechnician}>
                    <SelectTrigger><SelectValue placeholder="Assign a technician" /></SelectTrigger>
                    <SelectContent>
                        {technicians.map(tech => (
                            <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <DatePicker date={scheduledDate} setDate={setScheduledDate} />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Activity
            </Button>
        </form>
    );
};

const ActivityItem = React.memo(({ activity, onUpdateStatus, isTechnician, technicians, currentUserId, onAddTimeClick, isAdmin, onDeleteClick, isCompleted }: { 
    activity: Activity, 
    onUpdateStatus: (id: string, status: Activity['status']) => void, 
    isTechnician: boolean, 
    isAdmin: boolean,
    technicians: Technician[],
    currentUserId?: string,
    onAddTimeClick: () => void,
    onDeleteClick: () => void,
    isCompleted: boolean
}) => {
    const assignedTechnician = activity.technician || technicians.find(t => t.id === activity.technicianId);
    const isCurrentUserAssigned = activity.technicianId === currentUserId;

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
                {isCurrentUserAssigned && !isCompleted && (
                     <Button variant="outline" size="sm" onClick={onAddTimeClick}>
                        <Clock className="mr-2 h-4 w-4" />
                        Time Posting
                    </Button>
                )}
                 <Select value={activity.status} onValueChange={(status: Activity['status']) => onUpdateStatus(activity.id, status)} disabled={isCompleted || (!isAdmin && isTechnician && !isCurrentUserAssigned)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
                 {isAdmin && !isCompleted && (
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

interface WorkOrderDetailsProps {
  workOrder: WorkOrder;
  isTechnician: boolean;
  isAdmin: boolean;
  trainingRecords: TrainingRecord[];
  onTrainingRecordDelete: (recordId: string) => void;
  hvacReports: HvacStartupReport[];
  onHvacReportDelete: (reportId: string) => void;
  timeEntries: TimeEntry[];
  activities: Activity[];
  onTimeEntriesSaved: () => void;
  onNotePhotoDelete: (noteId: string, photoUrl: string) => void;
  onNoteDelete: (noteId: string) => void;
  onBeforePhotosAdded: (files: File[]) => void;
  onAfterPhotosAdded: (files: File[]) => void;
  onReceiptsAndPackingSlipsAdded: (files: File[]) => void;
  onBeforePhotoDelete: (photoUrl: string) => void;
  onAfterPhotoDelete: (photoUrl: string) => void;
  onReceiptsAndPackingSlipsPhotoDelete: (photoUrl: string) => void;
  onTimeEntryDelete: (timeEntryId: string) => void;
  isSavingPhotos: boolean;
  onDirectionsClick: (workSite: WorkSite) => void;
  onSignatureSave: () => void;
  onSignatureDelete: (ack?: Acknowledgement) => void;
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
  onMarkForReview: () => void;
  isSubmittingReview: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onReplyToAttention?: () => void;
}

export function WorkOrderDetails({
  workOrder,
  isTechnician,
  isAdmin,
  trainingRecords,
  onTrainingRecordDelete,
  hvacReports,
  onHvacReportDelete,
  timeEntries,
  activities,
  onTimeEntriesSaved,
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
  onSignatureSave,
  onSignatureDelete,
  onTempUpdate,
  tempOnArrival, setTempOnArrival,
  tempOnLeaving, setTempOnLeaving,
  contactInfo, setContactInfo,
  onContactInfoUpdate,
  onAddActivity,
  isAddingActivity,
  onUpdateActivityStatus,
  onDeleteActivity,
  technicians,
  onMarkForReview,
  isSubmittingReview,
  activeTab,
  setActiveTab,
  onReplyToAttention,
}: WorkOrderDetailsProps) {
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
  const [isAddTimeOpen, setIsAddTimeOpen] = useState(false);
  const [activityForTimePosting, setActivityForTimePosting] = useState<Activity | null>(null);
  const [ackToDelete, setAckToDelete] = useState<Acknowledgement | null>(null);
  const [isDeletingSignature, setIsDeletingSignature] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Asset State
  const [siteAssets, setSiteAssets] = useState<Asset[]>([]);
  const [isLinking, setIsLinking] = useState<string | null>(null);

  const isCompleted = workOrder.status === 'Completed';

  const filteredActivities = isTechnician
    ? activities.filter(activity => isSameDay(new Date(activity.scheduled_date), new Date()))
    : activities;

  const combinedActivity = useMemo(() => [
    ...workOrder.notes.map(note => ({ ...note, type: 'note', date: note.createdAt || workOrder.createdDate })),
    ...timeEntries.map(entry => ({ ...entry, type: 'time', date: entry.date }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [workOrder.notes, timeEntries, workOrder.createdDate]);

  useEffect(() => {
    setIsClient(true);
    if (db && workOrder.workSiteId) {
        getAssetsBySiteId(db, workOrder.workSiteId).then(setSiteAssets);
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

  const handleAddTimeClick = (activity: Activity) => {
    setActivityForTimePosting(activity);
    setIsAddTimeOpen(true);
  };

  const handleReplyToAttention = async () => {
    if (onReplyToAttention) {
        setIsReplying(true);
        try { await onReplyToAttention(); } finally { setIsReplying(false); }
    }
  };

  const handleLinkAsset = async (assetId: string) => {
    if (!db || isLinking) return;
    setIsLinking(assetId);
    try {
        const woRef = doc(db, 'work_orders', workOrder.id);
        await updateDocumentNonBlocking(woRef, {
            assetIds: arrayUnion(assetId)
        });
        toast({ title: 'Asset Linked to Job' });
    } catch (e) {
        // Handled globally
    } finally {
        setIsLinking(null);
    }
  };

  const handleUnlinkAsset = async (assetId: string) => {
    if (!db || isLinking) return;
    setIsLinking(assetId);
    try {
        const woRef = doc(db, 'work_orders', workOrder.id);
        await updateDocumentNonBlocking(woRef, {
            assetIds: arrayRemove(assetId)
        });
        toast({ title: 'Asset Unlinked' });
    } catch (e) {
        // Handled globally
    } finally {
        setIsLinking(null);
    }
  };
  
  const isCurrentUserAssigned = workOrder.assignedTechnicianId === user?.uid;
  const canCompleteWorkOrder = isTechnician && isCurrentUserAssigned && (workOrder.status === 'In Progress' || workOrder.status === 'Open');

  const linkedAssetIds = new Set(workOrder.assetIds || []);

  return (
    <>
      {isSavingPhotos && (
        <div className="fixed inset-0 bg-background/80 z-50 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-lg font-medium">Uploading Photos...</p>
        </div>
      )}

      {workOrder.needsAttention && (
          <Card className="mb-6 border-destructive bg-destructive/5">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
                    <div>
                        <p className="font-bold text-destructive">OFFICE ALERT: NEEDS ATTENTION</p>
                        <p className="text-sm font-medium">{workOrder.attentionMessage}</p>
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" className="shrink-0" onClick={handleReplyToAttention} disabled={isReplying}>
                    {isReplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Acknowledge &amp; Reply
                  </Button>
              </CardContent>
          </Card>
      )}

      {!workOrder.needsAttention && workOrder.technicianReplied && (
          <Card className="mb-6 border-green-600 bg-green-50">
              <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                  <div>
                      <p className="font-bold text-green-700">Replied to Office</p>
                      <p className="text-sm">You have acknowledged the office instruction.</p>
                  </div>
              </CardContent>
          </Card>
      )}

      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex flex-col items-start gap-2">
              <StatusBadge status={workOrder.status} />
            </div>
            <div className="flex flex-col items-end gap-2 ml-auto">
              {canCompleteWorkOrder && (
                <Button onClick={() => setIsReviewOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isSubmittingReview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit for Review
                </Button>
              )}
            </div>
          </div>
           {isTechnician && workOrder.workSite && (
              <div className="flex justify-between items-center pt-4">
                  <div><p className="text-sm text-muted-foreground">{workOrder.workSite.address}</p></div>
                   <div className="flex items-center gap-2">
                      {workOrder.checkInOutURL && (
                          <div className="flex flex-col items-center">
                              <Button asChild variant="outline" size="icon">
                                  <a href={getLinkUrl(workOrder.checkInOutURL)} target="_blank" rel="noopener noreferrer">
                                      <LinkIcon className="h-4 w-4" />
                                      <span className="sr-only">Check-in</span>
                                  </a>
                              </Button>
                              {workOrder.checkInWorkOrderNumber && (
                                  <p className="text-xs text-muted-foreground mt-1 max-w-[60px] truncate" title={workOrder.checkInWorkOrderNumber}>
                                      WO: {workOrder.checkInWorkOrderNumber}
                                  </p>
                              )}
                          </div>
                      )}
                      {workOrder.workSite && (
                        <Button variant="outline" size="icon" onClick={() => onDirectionsClick(workOrder.workSite!)}>
                            <Map className="h-4 w-4" />
                            <span className="sr-only">Get Directions</span>
                        </Button>
                      )}
                     </div>
              </div>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mt-1">{workOrder.description}</p>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
                <div className="space-y-2">
                    <Label htmlFor="temp-arrival">Temp on Arrival</Label>
                    <Input id="temp-arrival" value={tempOnArrival} onChange={e => setTempOnArrival(e.target.value)} onBlur={onTempUpdate} disabled={isCompleted} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="temp-leaving">Temp on Leaving</Label>
                    <Input id="temp-leaving" value={tempOnLeaving} onChange={e => setTempOnLeaving(e.target.value)} onBlur={onTempUpdate} disabled={isCompleted} />
                </div>
            </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="folder">
          <TabsTrigger value="overview" variant="folder">Overview</TabsTrigger>
          <TabsTrigger value="assets" variant="folder">Assets</TabsTrigger>
          <TabsTrigger value="media" variant="folder">Media</TabsTrigger>
          <TabsTrigger value="activity" variant="folder">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="space-y-8">
            <Card className="rounded-t-none">
                <CardHeader><CardTitle>Work Order Sign-off</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {workOrder.customerSignatureUrl && (
                      <div className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <p className="font-medium">{workOrder.contactInfo || 'Signed'}</p>
                          <p className="text-xs text-muted-foreground">{workOrder.signatureDate ? format(new Date(workOrder.signatureDate), 'PP p') : ''}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="bg-muted p-1 rounded-md">
                            <Image 
                              src={workOrder.customerSignatureUrl} 
                              alt="Signature" 
                              width={120} 
                              height={40} 
                              sizes="120px"
                              className="object-contain"
                            />
                          </div>
                          {!isCompleted && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { setAckToDelete(undefined); setIsDeletingSignature(true); }}>
                              <Trash2 className="h-4 w-4"/>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {workOrder.acknowledgements && workOrder.acknowledgements.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-muted-foreground">Previous Signatures</p>
                            {workOrder.acknowledgements.map((ack, index) => (
                                <div key={index} className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                                    <div>
                                        <p className="font-medium">{ack.name}</p>
                                        <p className="text-xs text-muted-foreground">{ack.date ? format(new Date(ack.date), 'PP p') : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="bg-white p-1 rounded-md border">
                                            <Image 
                                              src={ack.signatureUrl} 
                                              alt={`Signature ${index}`} 
                                              width={100} 
                                              height={35} 
                                              sizes="100px"
                                              className="object-contain"
                                            />
                                        </div>
                                        {!isCompleted && (
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { setAckToDelete(ack); setIsDeletingSignature(true); }}>
                                              <Trash2 className="h-4 w-4"/>
                                          </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!workOrder.customerSignatureUrl && (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="customer-name">Signer's Name</Label>
                          <Input id="customer-name" placeholder="Enter printed name" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} onBlur={onContactInfoUpdate} disabled={isCompleted} />
                        </div>
                        {!isCompleted && (
                          <Button type="button" onClick={onSignatureSave} className="w-full">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Signature
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" />Training Records</CardTitle>
                    {!isCompleted && (
                      <Button asChild variant="outline" size="sm"><Link href={`/training-attendance?workOrderId=${workOrder.id}`}><PlusCircle className="mr-2 h-4 w-4" />Add Training</Link></Button>
                    )}
                </div>
              </CardHeader>
              <CardContent>
                {trainingRecords.length > 0 ? (
                  <ul className="space-y-2">
                    {trainingRecords.map(record => (
                      <li key={record.id} className="flex items-center justify-between p-2 rounded-md border gap-2">
                          <div className='flex-1'>
                              <p className="font-medium">{record.trainingCourse}</p>
                              <p className="text-sm text-muted-foreground">{record.date ? format(new Date(record.date), 'MMM d, yyyy') : 'No date'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button asChild variant="outline" size="sm" className="hidden sm:flex"><Link href={`/training-attendance/${record.id}?action=download`}><Download className="h-4 w-4" /></Link></Button>
                            <Button asChild variant="outline" size="sm"><Link href={`/training-attendance/${record.id}`}>View</Link></Button>
                            {!isCompleted && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setTrainingRecordToDelete(record.id)}><Trash2 className="h-4 w-4" /></Button>}
                          </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground text-center py-4">No training records for this work order.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><FileCog className="h-5 w-5" />HVAC Start-up Reports</CardTitle>
                    {!isCompleted && (
                      <Button asChild variant="outline" size="sm"><Link href={`/hvac-startup-report?workOrderId=${workOrder.id}`}><PlusCircle className="mr-2 h-4 w-4" />Add Report</Link></Button>
                    )}
                </div>
              </CardHeader>
              <CardContent>
                {hvacReports.length > 0 ? (
                  <ul className="space-y-2">
                    {hvacReports.map(report => (
                      <li key={report.id} className="flex items-center justify-between p-2 rounded-md border gap-2">
                          <div className='flex-1'>
                              <p className="font-medium">{report.equipmentType || `Report from ${format(new Date(report.date), 'PPP')}`}</p>
                              <p className="text-sm text-muted-foreground">{report.technician || 'N/A'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button asChild variant="outline" size="sm" className="hidden sm:flex"><Link href={`/hvac-startup-report/${report.id}?action=download`}><Download className="h-4 w-4" /></Link></Button>
                            <Button asChild variant="outline" size="sm"><Link href={`/hvac-startup-report/${report.id}`}>View</Link></Button>
                            {!isCompleted && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setHvacReportToDelete(report.id)}><Trash2 className="h-4 w-4" /></Button>}
                          </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground text-center py-4">No HVAC reports for this work order.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="mt-0">
          <div className="space-y-8">
            <Card className="rounded-t-none">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Site Equipment Registry</CardTitle>
                  {!isCompleted && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/assets/new?siteId=${workOrder.workSiteId}`}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Register New Asset
                      </Link>
                    </Button>
                  )}
                </div>
                <CardDescription>Select the specific equipment being serviced on this job.</CardDescription>
              </CardHeader>
              <CardContent>
                {siteAssets.length > 0 ? (
                  <div className="space-y-3">
                    {siteAssets.map(asset => {
                      const isLinked = linkedAssetIds.has(asset.id);
                      const isLoading = isLinking === asset.id;

                      return (
                        <div key={asset.id} className={`flex items-center justify-between p-3 border rounded-lg transition-all ${isLinked ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10' : 'hover:bg-muted/30'}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold">{asset.name}</p>
                              <Badge variant="outline" className="font-mono text-[10px]">{asset.assetTag}</Badge>
                              {isLinked && <Badge className="h-5 text-[10px] bg-primary text-primary-foreground">Linked to Job</Badge>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span>{asset.manufacturer} {asset.model}</span>
                              <span>•</span>
                              <span className="capitalize">{asset.status}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="View History">
                              <Link href={`/assets/${asset.id}`}><ChevronRight className="h-4 w-4" /></Link>
                            </Button>
                            {!isCompleted && (
                              <div className="flex items-center gap-2">
                                {isLinked ? (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-destructive hover:bg-destructive/10"
                                    onClick={() => handleUnlinkAsset(asset.id)}
                                    disabled={!!isLinking}
                                  >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" /> Unlink</>}
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="gap-2"
                                    onClick={() => handleLinkAsset(asset.id)}
                                    disabled={!!isLinking}
                                  >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LinkIcon className="h-4 w-4" /> Link Asset</>}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-sm text-muted-foreground">No equipment registered at this site yet.</p>
                    {!isCompleted && (
                      <Button asChild variant="link" className="mt-2">
                        <Link href={`/assets/new?siteId=${workOrder.workSiteId}`}>Add the first asset</Link>
                      </Button>
                    )}
                  </div>
                )}
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
                        <div className="relative">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                                {(workOrder.beforePhotoUrls || []).map((url) => (
                                    <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border">
                                        <Image 
                                          src={url} 
                                          alt={`Before photo`} 
                                          fill 
                                          sizes="(max-width: 768px) 50vw, 25vw"
                                          className="object-cover" 
                                        />
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!isCompleted && <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => onBeforePhotoDelete(url)}><X className="h-4 w-4" /></Button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {!isCompleted && <Button variant="outline" onClick={() => setPhotoSheetTarget('before')} disabled={isSavingPhotos}><Camera className="mr-2 h-4 w-4" /> Add Before Photos</Button>}
                    </div>
                    <Separator />
                    <div>
                        <h3 className="font-medium mb-2">After Photos</h3>
                        <div className="relative">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                                {(workOrder.afterPhotoUrls || []).map((url) => (
                                    <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border">
                                        <Image 
                                          src={url} 
                                          alt={`After photo`} 
                                          fill 
                                          sizes="(max-width: 768px) 50vw, 25vw"
                                          className="object-cover" 
                                        />
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!isCompleted && <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => onAfterPhotoDelete(url)}><X className="h-4 w-4" /></Button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {!isCompleted && <Button variant="outline" onClick={() => setPhotoSheetTarget('after')} disabled={isSavingPhotos}><Camera className="mr-2 h-4 w-4" /> Add After Photos</Button>}
                    </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText /> Receipts &amp; Packing Slips</CardTitle></CardHeader>
                <CardContent>
                    <div className="relative">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                            {(workOrder.receiptsAndPackingSlips || []).map((url) => (
                                <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border">
                                    <Image 
                                      src={url} 
                                      alt={`Receipt or packing slip`} 
                                      fill 
                                      sizes="(max-width: 768px) 50vw, 25vw"
                                      className="object-cover" 
                                    />
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!isCompleted && <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => onReceiptsAndPackingSlipsPhotoDelete(url)}><X className="h-4 w-4" /></Button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                  {!isCompleted && <Button variant="outline" onClick={() => setPhotoSheetTarget('receipts')} disabled={isSavingPhotos}><Camera className="mr-2 h-4 w-4" /> Add Photos</Button>}
                </CardContent>
              </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="activity" className="mt-0">
          <div className="space-y-8">
            <Card className="rounded-t-none">
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Scheduled Activities</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {filteredActivities.length > 0 ? filteredActivities.map(activity => <ActivityItem key={activity.id} activity={activity} technicians={technicians} onUpdateStatus={onUpdateActivityStatus} isTechnician={isTechnician} currentUserId={user?.uid} onAddTimeClick={() => handleAddTimeClick(activity)} isAdmin={isAdmin} onDeleteClick={() => setActivityToDelete(activity)} isCompleted={isCompleted} />) : <p className="text-center text-sm text-muted-foreground py-4">{isTechnician ? "No activities scheduled for today." : "No scheduled activities."}</p>}
                </div>
                {(isAdmin || (isTechnician && !isCompleted && workOrder.status !== 'Review')) && (
                  <><Separator /><AddActivityForm technicians={technicians} onAddActivity={onAddActivity} isLoading={isAddingActivity} isTechnician={isTechnician} currentUserId={user?.uid} /></>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Notes &amp; Activity</CardTitle></div></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-6">
                  {isClient ? combinedActivity.map(activity => (activity as any).type === 'note' ? (
                    <NoteActivityItem 
                      key={`note-${activity.id}`} 
                      note={activity as any} 
                      onPhotoDelete={isCompleted ? undefined : onNotePhotoDelete} 
                      onNoteDelete={isCompleted ? undefined : setNoteToDelete} 
                    />
                  ) : (
                    <TimeActivityItem 
                      key={`time-${activity.id}`} 
                      timeEntry={activity as any} 
                      onTimeEntryDelete={isCompleted ? undefined : setTimeEntryToDelete} 
                    />
                  )) : <p className="text-center text-sm text-muted-foreground py-4">Loading activity...</p>}
                  {isClient && combinedActivity.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No notes or activity yet.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <WorkOrderReviewDialog
        isOpen={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        workOrder={workOrder}
        timeEntries={timeEntries}
        onNavigate={setActiveTab}
        onSubmit={() => {
          setIsReviewOpen(false);
          onMarkForReview();
        }}
        isSubmitting={isSubmittingReview}
      />

      <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this note.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteNote}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!timeEntryToDelete} onOpenChange={(open) => !open && setTimeEntryToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this time entry.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteTimeEntry}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!trainingRecordToDelete} onOpenChange={(open) => !open && setTrainingRecordToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this training record.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteTrainingRecord}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!hvacReportToDelete} onOpenChange={(open) => !open && setHvacReportToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this HVAC Start-up Report.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteHvacReport}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!activityToDelete} onOpenChange={(open) => !open && setActivityToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this scheduled activity.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteActivity}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={isDeletingSignature} onOpenChange={setIsDeletingSignature}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Signature?</AlertDialogTitle><AlertDialogDescription>{ackToDelete ? `This will permanently remove the signature from "${ackToDelete.name}".` : "This will permanently remove the signature from this work order."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { onSignatureDelete(ackToDelete || undefined); setIsDeletingSignature(false); }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <AddTimeDialog isOpen={isAddTimeOpen} setIsOpen={(isOpen) => { if (!isOpen) setActivityForTimePosting(null); setIsAddTimeOpen(isOpen); }} workOrderId={workOrder.id} activity={activityForTimePosting} onTimeEntriesSaved={onTimeEntriesSaved} />
      <Sheet open={!!photoSheetTarget} onOpenChange={(isOpen) => !isOpen && setPhotoSheetTarget(null)}><SheetContent side="bottom"><SheetHeader><SheetTitle>Add {photoSheetTarget === 'receipts' ? 'Receipt/Slip' : photoSheetTarget} photos</SheetTitle></SheetHeader><div className="grid gap-4 py-4"><Button type="button" variant="outline" className="justify-start" onClick={() => takePhotoInputRef.current?.click()}><Camera className="mr-4 h-5 w-5" />Take Photo</Button><Button type="button" variant="outline" className="justify-start" onClick={() => chooseFromLibraryInputRef.current?.click()}><Library className="mr-4 h-5 w-5" />Choose from Library</Button></div></SheetContent></Sheet>
      <input type="file" ref={takePhotoInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" multiple /><input type="file" ref={chooseFromLibraryInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
    </>
  );
}
