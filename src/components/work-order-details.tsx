
'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { getTechnicianById } from '@/lib/data';
import type { WorkOrder, Technician, WorkOrderNote } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from './status-badge';
import { PriorityIcon } from './priority-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Camera, User, Calendar, Info, FileText, X, Video, Library } from 'lucide-react';
import { NoteActivityItem } from './note-activity-item';
import { useFirestore, useUser, setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';

interface WorkOrderDetailsProps {
  initialWorkOrder: WorkOrder;
  technicians: Technician[];
}

export function WorkOrderDetails({ initialWorkOrder, technicians }: WorkOrderDetailsProps) {
  const db = useFirestore();
  const { user } = useUser();
  const [workOrder, setWorkOrder] = useState<WorkOrder>(initialWorkOrder);
  const [assignedTechnician, setAssignedTechnician] = useState<Technician | undefined>();
  const [newNote, setNewNote] = useState('');
  const [newNotePhoto, setNewNotePhoto] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const fetchTechnician = async () => {
        if (workOrder.assignedTechnicianId) {
            const tech = await getTechnicianById(db, workOrder.assignedTechnicianId);
            setAssignedTechnician(tech);
        }
    }
    fetchTechnician();
  }, [db, workOrder.assignedTechnicianId]);

  const takePhotoInputRef = useRef<HTMLInputElement>(null);
  const chooseFromLibraryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        setNewNotePhoto(e.target?.result as string);
        setIsSheetOpen(false); // Close sheet after selection
      };
      reader.readAsDataURL(file);
    }
     // Reset the input value to allow selecting the same file again
    event.target.value = '';
  };

  const handleAddNote = async () => {
    if (!user || (newNote.trim() === '' && !newNotePhoto)) return;

    const newNoteData = {
        workOrderId: workOrder.id,
        technicianId: user.uid,
        updateDate: new Date().toISOString(),
        notes: newNote,
        photoUrls: newNotePhoto ? [newNotePhoto] : [],
    };

    const notesColRef = collection(db, 'work_orders', workOrder.id, 'updates');
    await addDocumentNonBlocking(notesColRef, newNoteData);
    
    // Optimistically update UI
    const optimisticNote: WorkOrderNote = {
        id: `note-${Date.now()}`,
        authorId: user.uid,
        text: newNote,
        createdAt: new Date().toISOString(),
        photoUrls: newNotePhoto ? [newNotePhoto] : [],
    }

    setWorkOrder(prev => ({
      ...prev,
      notes: [optimisticNote, ...prev.notes],
    }));
    setNewNote('');
    setNewNotePhoto(null);
  };

  const handleStatusChange = (status: WorkOrder['status']) => {
    const workOrderRef = doc(db, 'work_orders', workOrder.id);
    setDocumentNonBlocking(workOrderRef, { status }, { merge: true });
    setWorkOrder(prev => ({ ...prev, status }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl font-bold">{workOrder.title}</CardTitle>
                <CardDescription>Work Order ID: {workOrder.id}</CardDescription>
              </div>
              <StatusBadge status={workOrder.status} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{workOrder.description}</p>
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
              />
              {newNotePhoto && (
                <div className="relative w-40 h-40 border rounded-md">
                  <Image src={newNotePhoto} alt="Note preview" fill style={{ objectFit: 'cover' }} className="rounded-md" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={() => setNewNotePhoto(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex justify-between items-center">
                 <div>
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                      <SheetTrigger asChild>
                        <Button variant="outline">
                          <Camera className="mr-2 h-4 w-4" />
                          Attach Photo
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="bottom">
                        <SheetHeader>
                          <SheetTitle>Add a photo</SheetTitle>
                        </SheetHeader>
                        <div className="grid gap-4 py-4">
                          <Button variant="outline" className="justify-start" onClick={() => takePhotoInputRef.current?.click()}>
                            <Video className="mr-4 h-5 w-5" />
                            Take Photo
                          </Button>
                          <Button variant="outline" className="justify-start" onClick={() => chooseFromLibraryInputRef.current?.click()}>
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
                    />
                     <input
                      type="file"
                      ref={chooseFromLibraryInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*"
                    />
                 </div>
                <Button onClick={handleAddNote} disabled={!user}>Add Note</Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-6">
              {isClient ? workOrder.notes.map(note => (
                <NoteActivityItem key={note.id} note={note} technicians={technicians} />
              )) : <p className="text-center text-sm text-muted-foreground py-4">Loading notes...</p>}
              {isClient && workOrder.notes.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No notes or activity yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Priority</span>
              <PriorityIcon priority={workOrder.priority} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Select value={workOrder.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="Update status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Assigned To
              </span>
              {assignedTechnician ? (
                <div className="flex items-center gap-2 font-medium">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={assignedTechnician.avatarUrl} />
                    <AvatarFallback>{assignedTechnician.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span>{assignedTechnician.name}</span>
                </div>
              ) : (
                <span className="font-medium">Unassigned</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created
              </span>
                {isClient ? (
                  <span className="font-medium">{format(new Date(workOrder.createdAt), 'MMM d, yyyy')}</span>
                ) : (
                  <span className="font-medium">Loading...</span>
                )}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Due Date
              </span>
              {isClient ? (
                <span className="font-medium">{format(new Date(workOrder.dueDate), 'MMM d, yyyy')}</span>
              ) : (
                <span className="font-medium">Loading...</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
