

'use client';

import Image from 'next/image';
import { format } from 'date-fns';
import type { WorkOrderNote } from '@/lib/types';
import { Button } from './ui/button';
import { X, Trash2 } from 'lucide-react';

interface NoteActivityItemProps {
  note: WorkOrderNote;
  onPhotoDelete: (noteId: string, photoUrl: string) => void;
  onNoteDelete: (noteId: string) => void;
}

export function NoteActivityItem({ note, onPhotoDelete, onNoteDelete }: NoteActivityItemProps) {
  const isValidDate = note.createdAt && !isNaN(new Date(note.createdAt).getTime());

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-4">
          <p className="text-sm">{note.text}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isValidDate ? format(new Date(note.createdAt), 'MMM d, yyyy') : 'Note'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onNoteDelete(note.id)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete Note</span>
        </Button>
      </div>
      {note.photoUrls && note.photoUrls.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {note.photoUrls.map((url, index) => (
            <div key={index} className="relative group aspect-video rounded-lg overflow-hidden border">
              <Image src={url} alt={`Work photo ${index + 1}`} fill style={{ objectFit: 'cover' }} />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => onPhotoDelete(note.id, url)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Delete Photo</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

    