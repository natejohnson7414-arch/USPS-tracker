

'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client, TrainingRecord, TimeEntry, Activity } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from './status-badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Camera, FileText, X, Video, Library, Loader2, Map, Thermometer, ClipboardCheck, Clock, Link as LinkIcon, Trash2, CalendarClock } from 'lucide-react';
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


const AddActivityForm = ({ technicians, onAddActivity, isLoading, isTechnician, currentUserId }: { 
    technicians: Technician[], 
    onAddActivity: (activity: any) => void, 
    isLoading: boolean,
    isTechnician: boolean,
    currentUserId?: string 
}) => {
    const [description, setDescription] = useState('');
    // For admins, this is the controlled state. For techs, it's just for display.
    const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | undefined>(isTechnician ? currentUserId : undefined);
    const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
    
    // The technician ID to display. For techs, it's their own ID. For admins, it's what they selected.
    const displayTechnicianId = isTechnician ? currentUserId : selectedTechnicianId;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // The final technicianId for submission
        const submissionTechnicianId = isTechnician ? currentUserId : selectedTechnicianId;

        if (!description || !submissionTechnicianId || !scheduledDate) {
            // Basic validation
            return;
        }
        onAddActivity({
            description,
            technicianId: submissionTechnicianId,
            scheduled_date: scheduledDate.toISOString(),
            status: 'scheduled'
        });
        // Reset form
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

const ActivityItem = ({ activity, onUpdateStatus, isTechnician, technicians, currentUserId, onAddTimeClick, isAdmin, onDeleteClick }: { 
    activity: Activity, 
    onUpdateStatus: (id: string, status: Activity['status']) => void, 
    isTechnician: boolean, 
    isAdmin: boolean,
    technicians: Technician[],
    currentUserId?: string,
    onAddTimeClick: () => void,
    onDeleteClick: () => void,
}) => {
    const assignedTechnician = activity.technician || technicians.find(t => t.id === activity.technicianId);
    
    // Check if the logged-in user is assigned to this activity
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
                {isCurrentUserAssigned && (
                     <Button variant="outline" size="sm" onClick={onAddTimeClick}>
                        <Clock className="mr-2 h-4 w-4" />
                        Time Posting
                    </Button>
                )}
                 <Select value={activity.status} onValueChange={(status: Activity['status']) => onUpdateStatus(activity.id, status)} disabled={!isAdmin && isTechnician && !isCurrentUserAssigned}>
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
                 {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDeleteClick}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete Activity</span>
                    </Button>
                )}
            </div>
        </div>
    );
}



interface WorkOrderDetailsProps {
  workOrder: WorkOrder;
  isTechnician: boolean;
  isAdmin: boolean;
  trainingRecords: TrainingRecord[];
  onTrainingRecordDelete: (recordId: string) => void;
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
  onMarkForReview: () => void;
  isSubmittingReview: boolean;
}

export function WorkOrderDetails({
  workOrder,
  isTechnician,
  isAdmin,
  trainingRecords,
  onTrainingRecordDelete,
  timeEntries,
  activities,
  onNoteAdded,
  onTimeAdded,
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
  onMarkForReview,
  isSubmittingReview,
}: WorkOrderDetailsProps) {
  const db = useFirestore();
  const { user } = useUser();

  const [assignedTechnician, setAssignedTechnician] = useState<Technician | undefined>();
  
  const [newNote, setNewNote] = useState('');
  const [photoSheetTarget, setPhotoSheetTarget] = useState<'before' | 'after' | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [timeEntryToDelete, setTimeEntryToDelete] = useState<string | null>(null);
  const [trainingRecordToDelete, setTrainingRecordToDelete] = useState<string | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [isAddTimeOpen, setIsAddTimeOpen] = useState(false);
  const [activityForTimePosting, setActivityForTimePosting] = useState<Activity | null>(null);

  // Combine and sort notes and time entries
  const combinedActivity = [
    ...workOrder.notes.map(note => ({ ...note, type: 'note', date: note.createdAt || workOrder.createdDate })),
    ...timeEntries.map(entry => ({ ...entry, type: 'time', date: entry.date }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


  useEffect(() => {
    setIsClient(true);
    const fetchTechnician = async () => {
        if (workOrder.assignedTechnicianId) {
            const tech = await getTechnicianById(db, workOrder.assignedTechnicianId);
            setAssignedTechnician(tech);
        } else {
            setAssignedTechnician(undefined);
        }
    }
    fetchTechnician();
  }, [db, workOrder.assignedTechnicianId]);
  

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

    onNoteAdded({
      text: newNote,
      createdAt: new Date().toISOString(),
    });
    
    setNewNote('');
  };

  const confirmDeleteNote = () => {
    if (noteToDelete) {
        onNoteDelete(noteToDelete);
        setNoteToDelete(null);
    }
  };

  const confirmDeleteTimeEntry = () => {
      if (timeEntryToDelete) {
          onTimeEntryDelete(timeEntryToDelete);
          setTimeEntryToDelete(null);
      }
  };
    
  const confirmDeleteTrainingRecord = () => {
      if (trainingRecordToDelete) {
          onTrainingRecordDelete(trainingRecordToDelete);
          setTrainingRecordToDelete(null);
      }
  };
    
  const confirmDeleteActivity = () => {
    if (activityToDelete) {
        onDeleteActivity(activityToDelete.id);
        setActivityToDelete(null);
    }
  };

  const getLinkUrl = (url: string | undefined) => {
    if (!url) return '#';
    if (url.startsWith('http')) {
        return url;
    }
    // If it has digits, assume it's a phone number.
    if (/\d/.test(url)) {
        // Convert ';' to 'w' for waiting, then strip invalid characters.
        const sanitizedPhone = url.replace(/;/g, 'w').replace(/[^0-9+,w#*]/g, '');
        return `tel:${sanitizedPhone}`;
    }
    return url;
  }

  const handleAddTimeClick = (activity: Activity) => {
    setActivityForTimePosting(activity);
    setIsAddTimeOpen(true);
  };
  
  const canCompleteWorkOrder = isTechnician && (workOrder.status === 'In Progress' || workOrder.status === 'Open');

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                     {workOrder.jobName}
                  </CardTitle>
                  <CardDescription>
                      Job # {workOrder.id}
                  </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={workOrder.status} />
                {canCompleteWorkOrder && (
                  <Button onClick={onMarkForReview} variant="secondary" disabled={isSubmittingReview}>
                    {isSubmittingReview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit for Review
                  </Button>
                )}
              </div>
            </div>
             {isTechnician && workOrder.workSite && (
                <div className="flex justify-between items-center pt-4">
                    <div>
                        <p className="font-medium">{workOrder.workSite?.name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">{workOrder.workSite.address}</p>
                    </div>
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
                      <Input 
                          id="temp-arrival" 
                          value={tempOnArrival} 
                          onChange={e => setTempOnArrival(e.target.value)}
                          onBlur={onTempUpdate}
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="temp-leaving">Temp on Leaving</Label>
                      <Input 
                          id="temp-leaving" 
                          value={tempOnLeaving} 
                          onChange={e => setTempOnLeaving(e.target.value)}
                          onBlur={onTempUpdate}
                      />
                  </div>
              </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" /> Scheduled Activities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {activities.length > 0 ? (
                  activities.map(activity => (
                    <ActivityItem 
                      key={activity.id} 
                      activity={activity} 
                      technicians={technicians}
                      onUpdateStatus={onUpdateActivityStatus}
                      isTechnician={isTechnician} 
                      currentUserId={user?.uid}
                      onAddTimeClick={() => handleAddTimeClick(activity)}
                      isAdmin={isAdmin}
                      onDeleteClick={() => setActivityToDelete(activity)}
                    />
                  ))
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-4">No scheduled activities.</p>
                )}
              </div>
              {(isAdmin || (isTechnician && workOrder.status !== 'Completed' && workOrder.status !== 'Review')) && (
                <>
                    <Separator />
                    <AddActivityForm 
                        technicians={technicians} 
                        onAddActivity={onAddActivity}
                        isLoading={isAddingActivity}
                        isTechnician={isTechnician}
                        currentUserId={user?.uid}
                    />
                </>
              )}
            </CardContent>
          </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Job Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="font-medium mb-2">Before Photos</h3>
                    {isSavingPhotos && photoSheetTarget === 'before' && <Loader2 className="h-5 w-5 animate-spin mb-2" />}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                        {(workOrder.beforePhotoUrls || []).map((url) => (
                            <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border">
                                <Image src={url} alt={`Before photo`} fill style={{ objectFit: 'cover' }} />
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => onBeforePhotoDelete(url)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" onClick={() => setPhotoSheetTarget('before')} disabled={isSavingPhotos}>
                        <Camera className="mr-2 h-4 w-4" /> Add Before Photos
                    </Button>
                </div>
                <Separator />
                <div>
                    <h3 className="font-medium mb-2">After Photos</h3>
                    {isSavingPhotos && photoSheetTarget === 'after' && <Loader2 className="h-5 w-5 animate-spin mb-2" />}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                        {(workOrder.afterPhotoUrls || []).map((url) => (
                            <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border">
                                <Image src={url} alt={`After photo`} fill style={{ objectFit: 'cover' }} />
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => onAfterPhotoDelete(url)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" onClick={() => setPhotoSheetTarget('after')} disabled={isSavingPhotos}>
                        <Camera className="mr-2 h-4 w-4" /> Add After Photos
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Notes & Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Textarea
                placeholder="Add a new note or update..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                disabled={isAddingNote}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" onClick={handleAddNote} disabled={isAddingNote || !newNote}>
                    {isAddingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Note
                </Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-6">
              {isClient ? combinedActivity.map(activity => {
                  if (activity.type === 'note') {
                      return <NoteActivityItem key={`note-${activity.id}`} note={activity} onPhotoDelete={onNotePhotoDelete} onNoteDelete={setNoteToDelete} />
                  } else {
                      return <TimeActivityItem key={`time-${activity.id}`} timeEntry={activity} onTimeEntryDelete={setTimeEntryToDelete} />
                  }
              }) : <p className="text-center text-sm text-muted-foreground py-4">Loading activity...</p>}
              {isClient && combinedActivity.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No notes or activity yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        {!isTechnician && (
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
        )}

        <Card>
            <CardHeader>
            <CardTitle>Customer Sign-off</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="customer-name">Customer Name</Label>
                        <Input
                            id="customer-name"
                            placeholder="Enter printed name"
                            value={contactInfo}
                            onChange={(e) => setContactInfo(e.target.value)}
                            onBlur={onContactInfoUpdate}
                        />
                    </div>
                    {workOrder.customerSignatureUrl ? (
                        <>
                            <div className="border bg-muted rounded-md p-4 flex justify-center">
                                <Image src={workOrder.customerSignatureUrl} alt="Customer Signature" width={300} height={150} style={{ objectFit: 'contain' }} />
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                                Signed on {workOrder.signatureDate ? format(new Date(workOrder.signatureDate), 'MMM d, yyyy') : 'N/A'}
                            </p>
                        </>
                    ) : (
                        <div className="border-2 border-dashed rounded-md p-4">
                            {workOrder.status !== 'Completed' && (
                                <Button type="button" onClick={onSignatureSave} className="w-full">
                                    Capture Signature
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
      
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Training Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trainingRecords.length > 0 ? (
              <ul className="space-y-2">
                {trainingRecords.map(record => (
                  <li key={record.id} className="flex items-center justify-between p-2 rounded-md border gap-2">
                      <div className='flex-1'>
                          <p className="font-medium">{record.trainingCourse}</p>
                          <p className="text-sm text-muted-foreground">
                              {record.date ? format(new Date(record.date), 'MMM d, yyyy') : 'No date'}
                          </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                          <Link href={`/training-attendance/${record.id}`} target="_blank">View</Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setTrainingRecordToDelete(record.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No training records attached to this work order.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>

    <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNote}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    <AlertDialog open={!!timeEntryToDelete} onOpenChange={(open) => !open && setTimeEntryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this time entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTimeEntry}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={!!trainingRecordToDelete} onOpenChange={(open) => !open && setTrainingRecordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this training record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTrainingRecord}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={!!activityToDelete} onOpenChange={(open) => !open && setActivityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this scheduled activity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteActivity}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <AddTimeDialog 
        isOpen={isAddTimeOpen}
        setIsOpen={(isOpen) => {
            if (!isOpen) {
                setActivityForTimePosting(null);
            }
            setIsAddTimeOpen(isOpen);
        }}
        workOrderId={workOrder.id}
        activity={activityForTimePosting}
        onTimeAdded={onTimeAdded}
      />
      <Sheet open={!!photoSheetTarget} onOpenChange={(isOpen) => !isOpen && setPhotoSheetTarget(null)}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Add {photoSheetTarget} photos</SheetTitle>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <Button type="button" variant="outline" className="justify-start" onClick={() => takePhotoInputRef.current?.click()}>
                <Video className="mr-4 h-5 w-5" />
                Take Photo(s)
              </Button>
              <Button type="button" variant="outline" className="justify-start" onClick={() => chooseFromLibraryInputRef.current?.click()}>
                <Library className="mr-4 h-5 w-5" />
                Choose from Library
              </Button>
            </div>
          </SheetContent>
      </Sheet>
      <input
          type="file"
          ref={takePhotoInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
          capture="environment"
          multiple
      />
      <input
          type="file"
          ref={chooseFromLibraryInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
          multiple
      />
    </>
  );
}
