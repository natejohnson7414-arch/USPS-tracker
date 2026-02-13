
'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client, TrainingRecord, TimeEntry, Activity, HvacStartupReport, FileAttachment, Acknowledgement } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from './status-badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Camera, FileText, X, Video, Library, Loader2, Map, Thermometer, ClipboardCheck, Clock, Link as LinkIcon, Trash2, CalendarClock, PlusCircle, FileCog, Upload, File, Image as ImageIcon, ReceiptText } from 'lucide-react';
import { NoteActivityItem } from './note-activity-item';
import { TimeActivityItem } from './time-activity-item';
import { useFirestore, useUser } from '@/firebase';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { getTechnicianById } from '@/lib/data';
import { AddTimeDialog } from './add-time-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from './ui/date-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const AddActivityForm = ({ technicians, onAddActivity, isLoading }: { 
    technicians: Technician[], 
    onAddActivity: (activity: any) => void, 
    isLoading: boolean
}) => {
    const [description, setDescription] = useState('');
    const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | undefined>();
    const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description || !selectedTechnicianId || !scheduledDate || isLoading) return;

        onAddActivity({
            description,
            technicianId: selectedTechnicianId,
            scheduled_date: scheduledDate.toISOString(),
            status: 'scheduled'
        });
        setDescription('');
        setSelectedTechnicianId(undefined);
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
                 <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId} required>
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

const ActivityItem = ({ activity, onUpdateStatus, technicians, onDeleteClick }: { 
    activity: Activity, 
    onUpdateStatus: (id: string, status: Activity['status']) => void, 
    technicians: Technician[],
    onDeleteClick: () => void,
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
                 <Select value={activity.status} onValueChange={(status: Activity['status']) => onUpdateStatus(activity.id, status)}>
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDeleteClick}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete Activity</span>
                </Button>
            </div>
        </div>
    );
}

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
  onTempUpdate: () => void;
  tempOnArrival: string;
  setTempOnArrival: (value: string) => void;
  tempOnLeaving: string;
  setTempOnLeaving: (value: string) => void;
  contactInfo: string;
  setContactInfo: (value: string) => void;
  onAddActivity: (activity: Omit<Activity, 'id' | 'createdDate' | 'workOrderId'>) => void;
  isAddingActivity: boolean;
  onUpdateActivityStatus: (activityId: string, status: Activity['status']) => void;
  onDeleteActivity: (activityId: string) => void;
  technicians: Technician[];
  onFilesUploaded: (files: File[]) => void;
  onFileDeleted: (file: FileAttachment) => void;
  isUploadingFiles: boolean;
  onSignatureDelete: (ack: Acknowledgement) => void;
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
}: WorkOrderAdminDetailsProps) {
  const { user } = useUser();

  const [photoSheetTarget, setPhotoSheetTarget] = useState<'before' | 'after' | 'receipts' | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [timeEntryToDelete, setTimeEntryToDelete] = useState<string | null>(null);
  const [trainingRecordToDelete, setTrainingRecordToDelete] = useState<string | null>(null);
  const [hvacReportToDelete, setHvacReportToDelete] = useState<string | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ackToDelete, setAckToDelete] = useState<Acknowledgement | null>(null);
  const [acknowledgementDate, setAcknowledgementDate] = useState<Date | undefined>(new Date());

  const combinedActivity = [
    ...workOrder.notes.map(note => ({ ...note, type: 'note', date: note.createdAt || workOrder.createdDate })),
    ...timeEntries.map(entry => ({ ...entry, type: 'time', date: entry.date }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  useEffect(() => {
    setIsClient(true);
  }, []);

  const takePhotoInputRef = useRef<HTMLInputElement>(null);
  const chooseFromLibraryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && photoSheetTarget) {
      const fileArray = Array.from(files);
      if (photoSheetTarget === 'before') {
        onBeforePhotosAdded(fileArray);
      } else if (photoSheetTarget === 'after') {
        onAfterPhotosAdded(fileArray);
      } else if (photoSheetTarget === 'receipts') {
        onReceiptsAndPackingSlipsAdded(fileArray);
      }
      setPhotoSheetTarget(null);
    }
    event.target.value = '';
  };
  
  const confirmDeleteNote = () => { if (noteToDelete) { onNoteDelete(noteToDelete); setNoteToDelete(null); } };
  const confirmDeleteTimeEntry = () => { if (timeEntryToDelete) { onTimeEntryDelete(timeEntryToDelete); setTimeEntryToDelete(null); } };
  const confirmDeleteTrainingRecord = () => { if (trainingRecordToDelete) { onTrainingRecordDelete(trainingRecordToDelete); setTrainingRecordToDelete(null); } };
  const confirmDeleteHvacReport = () => { if (hvacReportToDelete) { onHvacReportDelete(hvacReportToDelete); setHvacReportToDelete(null); } };
  const confirmDeleteActivity = () => { if (activityToDelete) { onDeleteActivity(activityToDelete.id); setActivityToDelete(null); } };
  const confirmDeleteSignature = () => { if (ackToDelete) { onSignatureDelete(ackToDelete); setAckToDelete(null); } };

  const getLinkUrl = (url: string | undefined) => {
    if (!url) return '#';
    if (url.startsWith('http')) { return url; }
    if (/\d/.test(url)) {
        const sanitizedPhone = url.replace(/;/g, 'w').replace(/[^0-9+,w#*]/g, '');
        return `tel:${sanitizedPhone}`;
    }
    return url;
  }

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
        onFilesUploaded(Array.from(files));
    }
    event.target.value = ''; // Reset input
  };
  
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="h-5 w-5 flex-shrink-0 text-blue-500" />;
    if (fileType.startsWith('video/')) return <Video className="h-5 w-5 flex-shrink-0 text-purple-500" />;
    if (fileType === 'application/pdf') return <FileText className="h-5 w-5 flex-shrink-0 text-red-500" />;
    return <File className="h-5 w-5 flex-shrink-0 text-gray-500" />;
  }

  return (
    <>
      <Tabs defaultValue="overview">
        <TabsList variant="folder">
          <TabsTrigger value="overview" variant="folder">Overview</TabsTrigger>
          <TabsTrigger value="media" variant="folder">Media</TabsTrigger>
          <TabsTrigger value="activity" variant="folder">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="space-y-8">
            <Card className="rounded-t-none">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Details</CardTitle>
                  <div className="flex items-center gap-2">
                    {workOrder.sourcePdfUrl && (
                        <Button asChild variant="secondary">
                            <Link href={workOrder.sourcePdfUrl} target="_blank" rel="noopener noreferrer">
                                <FileText className="mr-2 h-4 w-4" />
                                View Source PDF
                            </Link>
                        </Button>
                    )}
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
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{workOrder.createdDate ? format(new Date(workOrder.createdDate), 'MMM d, yyyy') : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                      <span className="text-muted-foreground">Bill To</span>
                      <div className="text-right">
                          <p className="font-medium">{workOrder.client?.name || workOrder.billTo || 'N/A'}</p>
                          {workOrder.client?.address && <p className="text-xs text-muted-foreground">{workOrder.client.address}</p>}
                      </div>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">PO #</span>
                      <span className="font-medium">{workOrder.poNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                      <span className="text-muted-foreground">Contact</span>
                      <span className="font-medium text-right whitespace-pre-wrap">{workOrder.contactInfo || 'N/A'}</span>
                  </div>
                  <Separator/>
                  <div className="flex justify-between items-start">
                      <span className="text-muted-foreground">Job Site</span>
                      <div className="text-right">
                          <p className="font-medium">{workOrder.workSite?.name || 'N/A'}</p>
                          {workOrder.workSite?.address && <p className="text-xs text-muted-foreground">{workOrder.workSite.address}</p>}
                      </div>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Assigned To</span>
                      {assignedTechnician ? (
                          <div className="flex items-center gap-2 font-medium">
                              <span>{assignedTechnician.name}</span>
                          </div>
                          ) : (
                          <span className="font-medium">Unassigned</span>
                      )}
                  </div>
                   <Separator/>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Schedule Date</span>
                        <span className="font-medium">{workOrder.serviceScheduleDate ? format(new Date(workOrder.serviceScheduleDate), 'MMM d, yyyy') : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Quoted Amount</span>
                        <span className="font-medium">{workOrder.quotedAmount ? `$${workOrder.quotedAmount.toFixed(2)}` : 'N/A'}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Time &amp; Material</span>
                        <span className="font-medium">{workOrder.timeAndMaterial ? 'Yes' : 'No'}</span>
                    </div>
                     <Separator/>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Customer PO#</span>
                        <span className="font-medium">{workOrder.customerPO || 'N/A'}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Estimator</span>
                        <span className="font-medium">{workOrder.estimator || 'N/A'}</span>
                    </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Signatures</CardTitle></CardHeader>
              <CardContent>
                  <div className="space-y-4">
                    {(workOrder.acknowledgements || []).length > 0 ? (
                        <div className="space-y-3">
                            {workOrder.acknowledgements?.map((ack, index) => (
                                <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                                    <div>
                                        <p className="font-medium">{ack.name}</p>
                                        <p className="text-xs text-muted-foreground">{format(new Date(ack.date), 'PP p')}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="bg-muted p-1 rounded-md">
                                        <Image src={ack.signatureUrl} alt={`${ack.name}'s signature`} width={120} height={40} style={{ objectFit: 'contain' }} />
                                      </div>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setAckToDelete(ack)}>
                                        <Trash2 className="h-4 w-4"/>
                                      </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-center text-muted-foreground py-4">No signatures have been captured for this work order yet.</p>
                    )}
                  </div>
              </CardContent>
            </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Acknowledgment Documents</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                      <DatePicker date={acknowledgementDate} setDate={setAcknowledgementDate} />
                      <Button asChild>
                          <Link href={`/work-orders/${workOrder.id}/acknowledgment?date=${acknowledgementDate?.toISOString()}`} target="_blank">
                              Generate Document
                          </Link>
                      </Button>
                  </CardContent>
              </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" />Training Records</CardTitle>
                  <Button asChild variant="outline" size="sm"><Link href={`/training-attendance?workOrderId=${workOrder.id}`}><PlusCircle className="mr-2 h-4 w-4" />Add Training</Link></Button>
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
                        <Button asChild variant="outline" size="sm"><Link href={`/training-attendance/${record.id}`}>View</Link></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setTrainingRecordToDelete(record.id)}><Trash2 className="h-4 w-4" /></Button>
                      </li>))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground text-center py-4">No training records for this work order.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><FileCog className="h-5 w-5" />HVAC Start-up Reports</CardTitle>
                  <Button asChild variant="outline" size="sm"><Link href={`/hvac-startup-report?workOrderId=${workOrder.id}`}><PlusCircle className="mr-2 h-4 w-4" />Add Report</Link></Button>
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
                        <Button asChild variant="outline" size="sm"><Link href={`/hvac-startup-report/${report.id}`}>View</Link></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setHvacReportToDelete(report.id)}><Trash2 className="h-4 w-4" /></Button>
                      </li>))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground text-center py-4">No HVAC start-up reports for this work order.</p>}
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
                              {isSavingPhotos && photoSheetTarget === 'before' && (
                                <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center rounded-lg min-h-[100px]">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                              )}
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">{(workOrder.beforePhotoUrls || []).map((url) => (<div key={url} className="relative group aspect-square rounded-lg overflow-hidden border"><Image src={url} alt={`Before photo`} fill style={{ objectFit: 'cover' }} /><div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => onBeforePhotoDelete(url)}><X className="h-4 w-4" /></Button></div></div>))}</div>
                          </div>
                          <Button variant="outline" onClick={() => setPhotoSheetTarget('before')} disabled={isSavingPhotos}><Camera className="mr-2 h-4 w-4" /> Add Before Photos</Button>
                      </div>
                      <Separator />
                      <div>
                          <h3 className="font-medium mb-2">After Photos</h3>
                          <div className="relative">
                            {isSavingPhotos && photoSheetTarget === 'after' && (
                                <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center rounded-lg min-h-[100px]">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">{(workOrder.afterPhotoUrls || []).map((url) => (<div key={url} className="relative group aspect-square rounded-lg overflow-hidden border"><Image src={url} alt={`After photo`} fill style={{ objectFit: 'cover' }} /><div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => onAfterPhotoDelete(url)}><X className="h-4 w-4" /></Button></div></div>))}</div>
                          </div>
                          <Button variant="outline" onClick={() => setPhotoSheetTarget('after')} disabled={isSavingPhotos}><Camera className="mr-2 h-4 w-4" /> Add After Photos</Button>
                      </div>
                  </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText /> Receipts &amp; Packing Slips</CardTitle></CardHeader>
                <CardContent>
                    <div className="relative">
                        {isSavingPhotos && photoSheetTarget === 'receipts' && (
                            <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center rounded-lg min-h-[100px]">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                            {(workOrder.receiptsAndPackingSlips || []).map((url) => (
                                <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border">
                                    <Image src={url} alt={`Receipt or packing slip`} fill style={{ objectFit: 'cover' }} />
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => onReceiptsAndPackingSlipsPhotoDelete(url)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                  <Button variant="outline" onClick={() => setPhotoSheetTarget('receipts')} disabled={isSavingPhotos}>
                      <Camera className="mr-2 h-4 w-4" /> Add Photos
                  </Button>
                </CardContent>
              </Card>
               <Card>
                  <CardHeader>
                      <CardTitle>Files</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelection}
                          className="hidden"
                          multiple
                      />
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploadingFiles}>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Files
                      </Button>
                      <div className="relative">
                          {isUploadingFiles && (
                            <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center rounded-lg min-h-[100px]">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )}
                          <div className="space-y-2">
                              {(workOrder.uploadedFiles || []).length > 0 ? (
                                  workOrder.uploadedFiles?.map(file => (
                                      <div key={file.url} className="flex items-center justify-between p-2 border rounded-md gap-2">
                                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 flex-1 truncate">
                                              {getFileIcon(file.type)}
                                              <div className="truncate">
                                                  <p className="text-sm font-medium truncate">{file.name}</p>
                                                  <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p>
                                              </div>
                                          </a>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onFileDeleted(file)}>
                                              <Trash2 className="h-4 w-4" />
                                          </Button>
                                      </div>
                                  ))
                              ) : (
                                  <p className="text-sm text-muted-foreground text-center py-4">No files uploaded.</p>
                              )}
                          </div>
                      </div>
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
                        {activities.length > 0 ? activities.map(activity => <ActivityItem key={activity.id} activity={activity} technicians={technicians} onUpdateStatus={onUpdateActivityStatus} onDeleteClick={() => setActivityToDelete(activity)} />) : <p className="text-center text-sm text-muted-foreground py-4">No scheduled activities.</p>}
                    </div>
                    <Separator />
                    <AddActivityForm technicians={technicians} onAddActivity={onAddActivity} isLoading={isAddingActivity} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Notes &amp; Time Postings</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-6">
                        {isClient ? combinedActivity.map(activity => activity.type === 'note' ? <NoteActivityItem key={`note-${activity.id}`} note={activity} onPhotoDelete={onNotePhotoDelete} onNoteDelete={setNoteToDelete} showPhotos={false} /> : <TimeActivityItem key={`time-${activity.id}`} timeEntry={activity} onTimeEntryDelete={setTimeEntryToDelete} />) : <p className="text-center text-sm text-muted-foreground py-4">Loading activity...</p>}
                        {isClient && combinedActivity.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No notes or activity yet.</p>}
                    </div>
                </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this note.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteNote}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!timeEntryToDelete} onOpenChange={(open) => !open && setTimeEntryToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this time entry.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteTimeEntry}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!trainingRecordToDelete} onOpenChange={(open) => !open && setTrainingRecordToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this training record.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteTrainingRecord}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!hvacReportToDelete} onOpenChange={(open) => !open && setHvacReportToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this HVAC Start-up Report.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteHvacReport}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!activityToDelete} onOpenChange={(open) => !open && setActivityToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this scheduled activity.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteActivity}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!ackToDelete} onOpenChange={(open) => !open && setAckToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this signature.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteSignature}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>


      <Sheet open={!!photoSheetTarget} onOpenChange={(isOpen) => !isOpen && setPhotoSheetTarget(null)}>
        <SheetContent side="bottom">
          <SheetHeader><SheetTitle>Add {photoSheetTarget === 'receipts' ? 'Receipt/Slip' : photoSheetTarget} photos</SheetTitle></SheetHeader>
          <div className="grid gap-4 py-4">
            <Button type="button" variant="outline" className="justify-start" onClick={() => takePhotoInputRef.current?.click()}><Camera className="mr-4 h-5 w-5" />Take Photo</Button>
            <Button type="button" variant="outline" className="justify-start" onClick={() => chooseFromLibraryInputRef.current?.click()}><Library className="mr-4 h-5 w-5" />Choose from Library</Button>
          </div>
        </SheetContent>
      </Sheet>
      <input type="file" ref={takePhotoInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" multiple />
      <input type="file" ref={chooseFromLibraryInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
    </>
  );
}
