

'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import type { WorkOrder, Technician, WorkOrderNote, WorkSite, Client, TrainingRecord, TimeEntry } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from './status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DatePicker } from './ui/date-picker';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Camera, User, Calendar, Info, FileText, X, Video, Library, Loader2, MapPin, Hash, DollarSign, Building, Map, Thermometer, ClipboardCheck, Clock, Link as LinkIcon } from 'lucide-react';
import { NoteActivityItem } from './note-activity-item';
import { TimeActivityItem } from './time-activity-item';
import { useFirestore, useUser } from '@/firebase';
import { Label } from '@/components/ui/label';
import { Checkbox } from './ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { getTechnicianById } from '@/lib/data';
import { AddTimeDialog } from './add-time-dialog';

interface EditableFields {
  description: string;
  setDescription: (value: string) => void;
  status: WorkOrder['status'];
  setStatus: (value: WorkOrder['status']) => void;
  assignedTechnicianId?: string;
  setAssignedTechnicianId: (value?: string) => void;
  workSiteId?: string;
  setWorkSiteId: (value?: string) => void;
  clientId?: string;
  setClientId: (value?: string) => void;
  createdDate?: Date;
  setCreatedDate: (value?: Date) => void;
  billTo?: string;
  setBillTo: (value: string) => void;
  poNumber?: string;
  setPoNumber: (value: string) => void;
  contactInfo?: string;
  setContactInfo: (value: string) => void;
  serviceScheduleDate?: Date;
  setServiceScheduleDate: (value?: Date) => void;
  quotedAmount?: number;
  setQuotedAmount: (value: number | undefined) => void;
  timeAndMaterial: boolean;
  setTimeAndMaterial: (value: boolean) => void;
  permit: boolean;
  setPermit: (value: boolean) => void;
  permitCost?: number;
  setPermitCost: (value: number | undefined) => void;
  permitFiled?: Date;
  setPermitFiled: (value?: Date) => void;
  coi: boolean;
  setCoi: (value: boolean) => void;
  coiRequested?: Date;
  setCoiRequested: (value?: Date) => void;
  certifiedPayroll: boolean;
  setCertifiedPayroll: (value: boolean) => void;
  certifiedPayrollRequested?: Date;
  setCertifiedPayrollRequested: (value?: Date) => void;
  intercoPO?: string;
  setIntercoPO: (value: string) => void;
  customerPO?: string;
  setCustomerPO: (value: string) => void;
  estimator?: string;
  setEstimator: (value: string) => void;
  checkInOutURL?: string;
  setCheckInOutURL: (value: string) => void;
  tempOnArrival?: string;
  setTempOnArrival: (value: string) => void;
  tempOnLeaving?: string;
  setTempOnLeaving: (value: string) => void;
  customerSignatureUrl?: string;
  setCustomerSignatureUrl: (value?: string) => void;
  signatureDate?: string;
  setSignatureDate: (value?: string) => void;
}

interface WorkOrderDetailsProps {
  initialWorkOrder: WorkOrder;
  technicians: Technician[];
  workSites: WorkSite[];
  clients: Client[];
  trainingRecords: TrainingRecord[];
  timeEntries: TimeEntry[];
  isEditing: boolean;
  isTechnician: boolean;
  editableFields: EditableFields;
  onWorkOrderUpdate: (e: FormEvent) => void;
  onNoteAdded: (note: Omit<WorkOrderNote, 'id'> & { photoFiles: File[] }) => void;
  onTimeAdded: (timeEntry: TimeEntry) => void;
  onNotePhotoDelete: (noteId: string, photoUrl: string) => void;
  onNoteDelete: (noteId: string) => void;
  onTimeEntryDelete: (timeEntryId: string) => void;
  isAddingNote: boolean;
  onDirectionsClick: (workSite: WorkSite) => void;
  onSignatureSave: () => void;
  onTempUpdate: () => void;
}

export function WorkOrderDetails({
  initialWorkOrder,
  technicians,
  workSites,
  clients,
  trainingRecords,
  timeEntries,
  isEditing,
  isTechnician,
  editableFields,
  onWorkOrderUpdate,
  onNoteAdded,
  onTimeAdded,
  onNotePhotoDelete,
  onNoteDelete,
  onTimeEntryDelete,
  isAddingNote,
  onDirectionsClick,
  onSignatureSave,
  onTempUpdate
}: WorkOrderDetailsProps) {
  const db = useFirestore();
  const { user } = useUser();

  const [workOrder, setWorkOrder] = useState<WorkOrder>(initialWorkOrder);
  const [assignedTechnician, setAssignedTechnician] = useState<Technician | undefined>();
  
  const [newNote, setNewNote] = useState('');
  const [newNotePhotos, setNewNotePhotos] = useState<{ url: string, file: File }[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [timeEntryToDelete, setTimeEntryToDelete] = useState<string | null>(null);
  const [isAddTimeOpen, setIsAddTimeOpen] = useState(false);

  // Combine and sort notes and time entries
  const combinedActivity = [
    ...workOrder.notes.map(note => ({ ...note, type: 'note', date: note.createdAt || workOrder.createdDate })),
    ...timeEntries.map(entry => ({ ...entry, type: 'time', date: entry.date }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


  const { 
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
    quotedAmount, setQuotedAmount,
    timeAndMaterial, setTimeAndMaterial,
    permit, setPermit,
    permitCost, setPermitCost,
    permitFiled, setPermitFiled,
    coi, setCoi,
    coiRequested, setCoiRequested,
    certifiedPayroll, setCertifiedPayroll,
    certifiedPayrollRequested, setCertifiedPayrollRequested,
    intercoPO, setIntercoPO,
    customerPO, setCustomerPO,
    estimator, setEstimator,
    checkInOutURL, setCheckInOutURL,
    tempOnArrival, setTempOnArrival,
    tempOnLeaving, setTempOnLeaving,
  } = editableFields;

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
  
  useEffect(() => {
    setWorkOrder(initialWorkOrder);
  },[initialWorkOrder])

  const takePhotoInputRef = useRef<HTMLInputElement>(null);
  const chooseFromLibraryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files).map(file => ({
        url: URL.createObjectURL(file),
        file
      }));
      setNewNotePhotos(prev => [...prev, ...newFiles]);
      setIsSheetOpen(false);
    }
    event.target.value = '';
  };
  
  const handleRemoveNewPhoto = (photoUrlToRemove: string) => {
    setNewNotePhotos(prev => prev.filter(photo => photo.url !== photoUrlToRemove));
  };

  const handleAddNote = () => {
    if (!user) return;

    onNoteAdded({
      text: newNote,
      createdAt: new Date().toISOString(),
      photoFiles: newNotePhotos.map(p => p.file),
      photoUrls: [], // This will be populated after upload
    });
    
    setNewNote('');
    setNewNotePhotos([]);
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
    
  const getLinkUrl = (url: string) => {
    if (url.startsWith('http')) {
        return url;
    }
    // Basic check for a phone number
    if (/^\+?[0-9\s-()]+$/.test(url)) {
        return `tel:${url.replace(/\s/g, '')}`;
    }
    return url;
  }

  const DetailItem = ({ label, value, icon, isDate, isLink, children }: { label: string, value?: string | number | null, icon?: React.ReactNode, isDate?: boolean, isLink?: boolean, children?: React.ReactNode }) => {
    if (!children && (value === null || value === undefined || value === '')) return null;

    let displayValue: React.ReactNode;

    if(children) {
        displayValue = <div className="sm:text-right">{children}</div>;
    } else if (isLink && typeof value === 'string') {
        displayValue = <a href={getLinkUrl(value)} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline sm:text-right">{value}</a>
    } else {
        displayValue = <span className="font-medium sm:text-right">{isDate && value ? format(new Date(value), 'MM-dd-yy') : value}</span>
    }
    
    return (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4">
            <span className="text-muted-foreground flex items-center gap-2">{icon}{label}</span>
            {displayValue}
        </div>
    )
  }

  return (
    <>
    <form id="work-order-form" onSubmit={onWorkOrderUpdate}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className={`${isTechnician ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-8`}>
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
                {isEditing ? 
                    <Select value={status} onValueChange={(val) => setStatus(val as WorkOrder['status'])}>
                        <SelectTrigger className="w-[180px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Open">Open</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="On Hold">On Hold</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                    </Select>
                 : <StatusBadge status={workOrder.status} />}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                  <div className="space-y-2">
                      <Label htmlFor="edit-description">Job Description</Label>
                      <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4}/>
                  </div>
              ) : (
                <p className="text-muted-foreground mt-1">{workOrder.description}</p>
              )}
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
                {newNotePhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {newNotePhotos.map((photo, index) => (
                        <div key={index} className="relative w-full aspect-square border rounded-md">
                            <Image src={photo.url} alt={`Note preview ${index + 1}`} fill style={{ objectFit: 'cover' }} className="rounded-md" />
                            <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={() => handleRemoveNewPhoto(photo.url)}
                            disabled={isAddingNote}
                            >
                            <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetTrigger asChild>
                          <Button type="button" variant="outline" disabled={isAddingNote}>
                            <Camera className="mr-2 h-4 w-4" />
                            Attach Photo
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom">
                          <SheetHeader>
                            <SheetTitle>Add a photo</SheetTitle>
                          </SheetHeader>
                          <div className="grid gap-4 py-4">
                            <Button type="button" variant="outline" className="justify-start" onClick={() => takePhotoInputRef.current?.click()}>
                              <Video className="mr-4 h-5 w-5" />
                              Take Photo
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
                  <div className="flex-1 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsAddTimeOpen(true)} disabled={isAddingNote}>
                        <Clock className="mr-2 h-4 w-4" />
                        Add Time
                    </Button>
                    <Button type="button" onClick={handleAddNote} disabled={isAddingNote || (!newNote && newNotePhotos.length === 0)}>
                        {isAddingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isAddingNote ? "Adding..." : "Add Note"}
                    </Button>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-6">
                {isClient ? combinedActivity.map(activity => {
                    if (activity.type === 'note') {
                        return <NoteActivityItem key={`note-${activity.id}`} note={activity} isEditing={isEditing} onPhotoDelete={onNotePhotoDelete} onNoteDelete={setNoteToDelete} />
                    } else {
                        return <TimeActivityItem key={`time-${activity.id}`} timeEntry={activity} isEditing={isEditing} onTimeEntryDelete={setTimeEntryToDelete} />
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
                        <CardTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5" />
                            Details
                        </CardTitle>
                        {workOrder.workSite && !isEditing && (
                            <Button variant="outline" size="icon" onClick={() => onDirectionsClick(workOrder.workSite!)}>
                                <Map className="h-4 w-4" />
                                <span className="sr-only">Get Directions</span>
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <DetailItem label="Date" value={workOrder.createdDate} isDate/>
                    <DetailItem label="Bill To">
                        {isEditing ? (
                        <Select value={clientId} onValueChange={setClientId}>
                                <SelectTrigger className="w-full sm:w-[180px] h-8">
                                    <SelectValue placeholder="Select a client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map(client => (
                                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                        <div className="sm:text-right">
                            <p className="font-medium">{workOrder.client?.name || workOrder.billTo || 'N/A'}</p>
                            {workOrder.client?.address && <p className="text-muted-foreground">{workOrder.client.address}</p>}
                        </div>
                        )}
                    </DetailItem>
                    <DetailItem label="PO #">
                        {isEditing ? <Input className="h-8 sm:text-right" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} /> : <span className="font-medium">{workOrder.poNumber || 'N/A'}</span>}
                    </DetailItem>
                    <DetailItem label="Check-in/Out Link">
                        {isEditing ? <Input className="h-8 sm:text-right" value={checkInOutURL} onChange={(e) => setCheckInOutURL(e.target.value)} /> : (workOrder.checkInOutURL ? <a href={getLinkUrl(workOrder.checkInOutURL)} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline sm:text-right">{workOrder.checkInOutURL}</a> : <span className="font-medium">N/A</span>) }
                    </DetailItem>
                    <DetailItem label="Contact Info">
                        {isEditing ? <Textarea className="sm:text-right" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} /> : <span className="font-medium whitespace-pre-wrap sm:text-right">{workOrder.contactInfo || 'N/A'}</span>}
                    </DetailItem>
                    <Separator/>
                    <DetailItem label="Job Site">
                        {isEditing ? (
                            <Select value={workSiteId} onValueChange={setWorkSiteId}>
                                <SelectTrigger className="w-full sm:w-[180px] h-8">
                                    <SelectValue placeholder="Select a work site" />
                                </SelectTrigger>
                                <SelectContent>
                                    {workSites.map(site => (
                                        <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                        <div className="sm:text-right">
                            <p className="font-medium">{workOrder.workSite?.name || 'N/A'}</p>
                            {workOrder.workSite?.address && <p className="text-muted-foreground">{workOrder.workSite.address}</p>}
                        </div>
                        )}
                    </DetailItem>
                    <DetailItem label="Assigned To">
                        {isEditing ? (
                        <Select value={assignedTechnicianId || 'unassigned'} onValueChange={(val) => setAssignedTechnicianId(val === 'unassigned' ? undefined : val)}>
                            <SelectTrigger className="w-full sm:w-[180px] h-8">
                                <SelectValue placeholder="Select technician" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {technicians.map(tech => (
                                    <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        ) : (
                            assignedTechnician ? (
                            <div className="flex items-center justify-start sm:justify-end gap-2 font-medium">
                                <span>{assignedTechnician.name}</span>
                            </div>
                            ) : (
                            <span className="font-medium">Unassigned</span>
                            )
                        )}
                    </DetailItem>
                    <Separator/>
                    <DetailItem label="Service Schedule Date">
                        {isEditing ? <DatePicker className="w-full" date={serviceScheduleDate} setDate={setServiceScheduleDate} /> : <span className="font-medium">{workOrder.serviceScheduleDate ? format(new Date(workOrder.serviceScheduleDate), 'MMM d, yyyy') : 'N/A'}</span>}
                    </DetailItem>
                    <DetailItem label="Quoted Amount">
                        {isEditing ? <Input className="h-8 sm:text-right" type="number" value={quotedAmount ?? ''} onChange={(e) => setQuotedAmount(e.target.value ? Number(e.target.value) : undefined)} /> : <span className="font-medium">{workOrder.quotedAmount ? `$${workOrder.quotedAmount}` : 'N/A'}</span>}
                    </DetailItem>
                    <DetailItem label="Time & Material">
                        {isEditing ? <Checkbox checked={timeAndMaterial} onCheckedChange={(c) => setTimeAndMaterial(Boolean(c))} /> : <span className="font-medium">{workOrder.timeAndMaterial ? 'Yes' : 'No'}</span>}
                    </DetailItem>
                    <Separator />
                    <DetailItem label="Permit">
                        {isEditing ? <Checkbox checked={permit} onCheckedChange={(c) => setPermit(Boolean(c))} /> : <span className="font-medium">{workOrder.permit ? 'Yes' : 'No'}</span>}
                    </DetailItem>
                    <DetailItem label="Permit Cost">
                        {isEditing ? <Input className="h-8 sm:text-right" type="number" value={permitCost ?? ''} onChange={(e) => setPermitCost(e.target.value ? Number(e.target.value) : undefined)} /> : <span className="font-medium">{workOrder.permitCost ? `$${workOrder.permitCost}` : 'N/A'}</span>}
                    </DetailItem>
                    <DetailItem label="Permit Filed">
                        {isEditing ? <DatePicker className="w-full" date={permitFiled} setDate={setPermitFiled} /> : <span className="font-medium">{workOrder.permitFiled ? format(new Date(workOrder.permitFiled), 'MMM d, yyyy') : 'N/A'}</span>}
                    </DetailItem>
                    <Separator />
                    <DetailItem label="COI">
                        {isEditing ? <Checkbox checked={coi} onCheckedChange={(c) => setCoi(Boolean(c))} /> : <span className="font-medium">{workOrder.coi ? 'Yes' : 'No'}</span>}
                    </DetailItem>
                    <DetailItem label="COI Requested">
                        {isEditing ? <DatePicker className="w-full" date={coiRequested} setDate={setCoiRequested} /> : <span className="font-medium">{workOrder.coiRequested ? format(new Date(workOrder.coiRequested), 'MMM d, yyyy') : 'N/A'}</span>}
                    </DetailItem>
                    <Separator />
                    <DetailItem label="Certified Payroll">
                        {isEditing ? <Checkbox checked={certifiedPayroll} onCheckedChange={(c) => setCertifiedPayroll(Boolean(c))} /> : <span className="font-medium">{workOrder.certifiedPayroll ? 'Yes' : 'No'}</span>}
                    </DetailItem>
                    <DetailItem label="Certified Payroll Requested">
                        {isEditing ? <DatePicker className="w-full" date={certifiedPayrollRequested} setDate={setCertifiedPayrollRequested} /> : <span className="font-medium">{workOrder.certifiedPayrollRequested ? format(new Date(workOrder.certifiedPayrollRequested), 'MMM d, yyyy') : 'N/A'}</span>}
                    </DetailItem>
                    <Separator />
                    <DetailItem label="Interco PO#">
                        {isEditing ? <Input className="h-8 sm:text-right" value={intercoPO} onChange={(e) => setIntercoPO(e.target.value)} /> : <span className="font-medium">{workOrder.intercoPO || 'N/A'}</span>}
                    </DetailItem>
                    <DetailItem label="Customer PO#">
                        {isEditing ? <Input className="h-8 sm:text-right" value={customerPO} onChange={(e) => setCustomerPO(e.target.value)} /> : <span className="font-medium">{workOrder.customerPO || 'N/A'}</span>}
                    </DetailItem>
                    <DetailItem label="Estimator/Requested By">
                        {isEditing ? <Input className="h-8 sm:text-right" value={estimator} onChange={(e) => setEstimator(e.target.value)} /> : <span className="font-medium">{workOrder.estimator || 'N/A'}</span>}
                    </DetailItem>
                </CardContent>
            </Card>
            )}

            {!isTechnician && (
                <Card>
                    <CardHeader>
                    <CardTitle>Customer Sign-off</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {workOrder.customerSignatureUrl ? (
                            <div className="space-y-4">
                                <div className="border bg-muted rounded-md p-4 flex justify-center">
                                    <Image src={workOrder.customerSignatureUrl} alt="Customer Signature" width={300} height={150} style={{ objectFit: 'contain' }} />
                                </div>
                                <p className="text-sm text-muted-foreground text-center">
                                    Signed on {workOrder.signatureDate ? format(new Date(workOrder.signatureDate), 'MMM d, yyyy') : 'N/A'}
                                </p>
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground space-y-4 p-4 border-2 border-dashed rounded-md">
                                <p>No signature has been captured yet.</p>
                                {!isEditing && workOrder.status !== 'Completed' && (
                                    <Button type="button" onClick={onSignatureSave}>
                                        Capture Signature
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
          
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
                    <li key={record.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div>
                            <p className="font-medium">{record.trainingCourse}</p>
                            <p className="text-sm text-muted-foreground">
                                {record.date ? format(new Date(record.date), 'MMM d, yyyy') : 'No date'}
                            </p>
                        </div>
                        <Button asChild variant="outline" size="sm">
                            {/* This link will need a dedicated page for viewing a training record */}
                            <Link href={`/training-attendance/${record.id}`} target="_blank">View</Link>
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
    </form>

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

      <AddTimeDialog 
        isOpen={isAddTimeOpen}
        setIsOpen={setIsAddTimeOpen}
        workOrderId={workOrder.id}
        onTimeAdded={onTimeAdded}
      />
    </>
  );
}

    

    




    