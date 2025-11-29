'use client';

import { useState } from 'react';
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
import { Camera, Paperclip, User, Calendar, Info, FileText } from 'lucide-react';
import { NoteActivityItem } from './note-activity-item';

interface WorkOrderDetailsProps {
  initialWorkOrder: WorkOrder;
  technicians: Technician[];
}

export function WorkOrderDetails({ initialWorkOrder, technicians }: WorkOrderDetailsProps) {
  const [workOrder, setWorkOrder] = useState<WorkOrder>(initialWorkOrder);
  const [newNote, setNewNote] = useState('');
  
  const assignedTechnician = getTechnicianById(workOrder.assignedTechnicianId || '');

  const handleAddNote = () => {
    if (newNote.trim() === '') return;

    const note: WorkOrderNote = {
      id: `note-${Date.now()}`,
      authorId: 'tech-1', // In a real app, this would be the current user's ID
      text: newNote,
      createdAt: new Date().toISOString(),
    };

    setWorkOrder(prev => ({
      ...prev,
      notes: [note, ...prev.notes],
    }));
    setNewNote('');
  };

  const handleStatusChange = (status: WorkOrder['status']) => {
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
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Notes & Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Textarea
                placeholder="Add a new note or update..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline"><Camera className="mr-2 h-4 w-4" />Attach Photo</Button>
                <Button onClick={handleAddNote}>Add Note</Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-6">
                {workOrder.notes.map(note => (
                  <NoteActivityItem key={note.id} note={note} />
                ))}
                 {workOrder.notes.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">No notes or activity yet.</p>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5" />Details</CardTitle>
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
              <span className="text-muted-foreground flex items-center gap-2"><User className="h-4 w-4" />Assigned To</span>
              {assignedTechnician ? (
                 <div className="flex items-center gap-2 font-medium">
                    <Avatar className="h-6 w-6">
                        <AvatarImage src={assignedTechnician.avatarUrl} />
                        <AvatarFallback>{assignedTechnician.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>{assignedTechnician.name}</span>
                </div>
              ) : <span className="font-medium">Unassigned</span>}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />Created</span>
              <span className="font-medium">{format(new Date(workOrder.createdAt), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />Due Date</span>
              <span className="font-medium">{format(new Date(workOrder.dueDate), 'MMM d, yyyy')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
