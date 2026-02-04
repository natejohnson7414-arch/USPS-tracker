

'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client, TrainingRecord, TimeEntry, Activity, HvacStartupReport } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from './status-badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Camera, FileText, X, Video, Library, Loader2, Map, Thermometer, ClipboardCheck, Clock, Link as LinkIcon, Trash2, CalendarClock, PlusCircle, FileCog } from 'lucide-react';
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
  onNoteAdded: (note: Omit<WorkOrderNote, 'id' | 'photoUrls'>) => void;
  onTimeAdded: (timeEntry: TimeEntry) => void;
  onNotePhotoDelete: (noteId: string, photoUrl: string) => void;
  onNoteDelete: (noteId: string) => void;
  onBeforePhotosAdded: (files: File[]) => void;
  onAfterPhotosAdded: (files: File[]) => void;
  onBeforePhotoDelete: (photoUrl: string) => void;
  onAfterPhotoDelete: (photoUrl: string) => void;
  onTimeEntryDelete: (timeEntryId: string) => void;
  isAddingNote: boolean;
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
}

export function WorkOrderAdminDetails({
  workOrder,
  assignedTechnician,
  isAdmin,
  trainingRecords,
  onTrainingRecordDelete,
  hvacReports,
  onHvacReportDelete,
  timeEntries,
  activities,
  onNoteAdded,
  onNotePhotoDelete,
  onNoteDelete,
  onBeforePhotosAdded,
  onAfterPhotosAdded,
  onBeforePhotoDelete,
  onAfterPhotoDelete,
  onTimeEntryDelete,
  isAddingNote,
  isSavingPhotos,
  onDirectionsClick,
  onSignatureSave,
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
}: WorkOrderAdminDetailsProps) {
  const { user } = useUser();

  const [newNote, setNewNote] = useState('');
  const [photoSheetTarget, setPhotoSheetTarget] = useState<'before' | 'after' | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [timeEntryToDelete, setTimeEntryToDelete] = useState<string | null>(null);
  const [trainingRecordToDelete, setTrainingRecordToDelete] = useState<string | null>(null);
  const [hvacReportToDelete, setHvacReportToDelete] = useState<string | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);

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
      }
      setPhotoSheetTarget(null);
    }
    event.target.value = '';
  };
  
  const handleAddNote = () => {
    if (!user || !newNote) return;
    onNoteAdded({ text: newNote, createdAt: new Date().toISOString() });
    setNewNote('');
  };

  const confirmDeleteNote = () => { if (noteToDelete) { onNoteDelete(noteToDelete); setNoteToDelete(null); } };
  const confirmDeleteTimeEntry = () => { if (timeEntryToDelete) { onTimeEntryDelete(timeEntryToDelete); setTimeEntryToDelete(null); } };
  const confirmDeleteTrainingRecord = () => { if (trainingRecordToDelete) { onTrainingRecordDelete(trainingRecordToDelete); setTrainingRecordToDelete(null); } };
  const confirmDeleteHvacReport = () => { if (hvacReportToDelete) { onHvacReportDelete(hvacReportToDelete); setHvacReportToDelete(null); } };
  const confirmDeleteActivity = () => { if (activityToDelete) { onDeleteActivity(activityToDelete.id); setActivityToDelete(null); } };

  const getLinkUrl = (url: string | undefined) => {
    if (!url) return '#';
    if (url.startsWith('http')) { return url; }
    if (/\d/.test(url)) {
        const sanitizedPhone = url.replace(/;/g, 'w').replace(/[^0-9+,w#*]/g, '');
        return `tel:${sanitizedPhone}`;
    }
    return url;
  }

  const allActivityPhotos = workOrder.notes.flatMap(note => note.photoUrls || []).filter(Boolean);

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">{workOrder.jobName}</CardTitle>
              <CardDescription>Job # {workOrder.id}</CardDescription>
            </div>
            <StatusBadge status={workOrder.status} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mt-1">{workOrder.description}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Details</CardTitle>
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
                      <span className="text-muted-foreground">Time & Material</span>
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
            <CardHeader><CardTitle>Customer Sign-off</CardTitle></CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="customer-name">Customer Name</Label>
                        <Input id="customer-name" placeholder="Enter printed name" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} onBlur={onContactInfoUpdate} />
                    </div>
                    {workOrder.customerSignatureUrl ? (
                        <>
                            <div className="border bg-muted rounded-md p-4 flex justify-center"><Image src={workOrder.customerSignatureUrl} alt="Customer Signature" width={300} height={150} style={{ objectFit: 'contain' }} /></div>
                            <p className="text-sm text-muted-foreground text-center">Signed on {workOrder.signatureDate ? format(new Date(workOrder.signatureDate), 'MMM d, yyyy') : 'N/A'}</p>
                        </>
                    ) : (
                        <div className="border-2 border-dashed rounded-md p-4">{workOrder.status !== 'Completed' && <Button type="button" onClick={onSignatureSave} className="w-full">Capture Signature</Button>}</div>
                    )}
                </div>
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
                      <Button asChild variant="outline" size="sm"><Link href={`/training-attendance/${record.id}`} target="_blank">View</Link></Button>
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
                      <Button asChild variant="outline" size="sm"><Link href={`/hvac-startup-report/${report.id}`} target="_blank">View</Link></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setHvacReportToDelete(report.id)}><Trash2 className="h-4 w-4" /></Button>
                    </li>))}
                </ul>
              ) : <p className="text-sm text-muted-foreground text-center py-4">No HVAC start-up reports for this work order.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="space-y-8">
            <Card>
                <CardHeader><CardTitle>Job Photos</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="font-medium mb-2">Before Photos</h3>
                        {isSavingPhotos && photoSheetTarget === 'before' && <Loader2 className="h-5 w-5 animate-spin mb-2" />}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">{(workOrder.beforePhotoUrls || []).map((url) => (<div key={url} className="relative group aspect-square rounded-lg overflow-hidden border"><Image src={url} alt={`Before photo`} fill style={{ objectFit: 'cover' }} /><div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => onBeforePhotoDelete(url)}><X className="h-4 w-4" /></Button></div></div>))}</div>
                        <Button variant="outline" onClick={() => setPhotoSheetTarget('before')} disabled={isSavingPhotos}><Camera className="mr-2 h-4 w-4" /> Add Before Photos</Button>
                    </div>
                    <Separator />
                    <div>
                        <h3 className="font-medium mb-2">After Photos</h3>
                        {isSavingPhotos && photoSheetTarget === 'after' && <Loader2 className="h-5 w-5 animate-spin mb-2" />}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">{(workOrder.afterPhotoUrls || []).map((url) => (<div key={url} className="relative group aspect-square rounded-lg overflow-hidden border"><Image src={url} alt={`After photo`} fill style={{ objectFit: 'cover' }} /><div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => onAfterPhotoDelete(url)}><X className="h-4 w-4" /></Button></div></div>))}</div>
                        <Button variant="outline" onClick={() => setPhotoSheetTarget('after')} disabled={isSavingPhotos}><Camera className="mr-2 h-4 w-4" /> Add After Photos</Button>
                    </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader><CardTitle>Activity Photos</CardTitle></CardHeader>
                <CardContent>
                    {allActivityPhotos.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {allActivityPhotos.map((url, index) => (
                                <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="relative group aspect-square rounded-lg overflow-hidden border">
                                    <Image src={url} alt={`Activity photo ${index + 1}`} fill style={{ objectFit: 'cover' }} />
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No photos found in notes.</p>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-8">
            <Card>
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
                <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Notes & Time Postings</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <Textarea placeholder="Add a new note or update..." value={newNote} onChange={e => setNewNote(e.target.value)} disabled={isAddingNote} />
                        <div className="flex justify-end gap-2"><Button type="button" onClick={handleAddNote} disabled={isAddingNote || !newNote}>{isAddingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Note</Button></div>
                    </div>
                    <Separator />
                    <div className="space-y-6">
                        {isClient ? combinedActivity.map(activity => activity.type === 'note' ? <NoteActivityItem key={`note-${activity.id}`} note={activity} onPhotoDelete={onNotePhotoDelete} onNoteDelete={setNoteToDelete} showPhotos={false} /> : <TimeActivityItem key={`time-${activity.id}`} timeEntry={activity} onTimeEntryDelete={setTimeEntryToDelete} />) : <p className="text-center text-sm text-muted-foreground py-4">Loading activity...</p>}
                        {isClient && combinedActivity.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No notes or activity yet.</p>}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      
      <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this note.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteNote}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!timeEntryToDelete} onOpenChange={(open) => !open && setTimeEntryToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this time entry.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteTimeEntry}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!trainingRecordToDelete} onOpenChange={(open) => !open && setTrainingRecordToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this training record.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteTrainingRecord}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!hvacReportToDelete} onOpenChange={(open) => !open && setHvacReportToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this HVAC Start-up Report.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteHvacReport}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!activityToDelete} onOpenChange={(open) => !open && setActivityToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this scheduled activity.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteActivity}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <Sheet open={!!photoSheetTarget} onOpenChange={(isOpen) => !isOpen && setPhotoSheetTarget(null)}>
        <SheetContent side="bottom">
          <SheetHeader><SheetTitle>Add {photoSheetTarget} photos</SheetTitle></SheetHeader>
          <div className="grid gap-4 py-4">
            <Button type="button" variant="outline" className="justify-start" onClick={() => takePhotoInputRef.current?.click()}><Video className="mr-4 h-5 w-5" />Take Photo(s)</Button>
            <Button type="button" variant="outline" className="justify-start" onClick={() => chooseFromLibraryInputRef.current?.click()}><Library className="mr-4 h-5 w-5" />Choose from Library</Button>
          </div>
        </SheetContent>
      </Sheet>
      <input type="file" ref={takePhotoInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" multiple />
      <input type="file" ref={chooseFromLibraryInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
    </>
  );
}
