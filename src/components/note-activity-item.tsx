
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import type { WorkOrderNote, Technician } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from './ui/button';
import { User, X, Trash2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { getTechnicianById } from '@/lib/data';


interface NoteActivityItemProps {
  note: WorkOrderNote;
  technicians: Technician[];
  isEditing: boolean;
  onPhotoDelete: (noteId: string, photoUrl: string) => void;
  onNoteDelete: (noteId: string) => void;
}

export function NoteActivityItem({ note, technicians, isEditing, onPhotoDelete, onNoteDelete }: NoteActivityItemProps) {
  const db = useFirestore();
  const [isClient, setIsClient] = useState(false);
  const [author, setAuthor] = useState<Technician | undefined>();
  const [isLoadingAuthor, setIsLoadingAuthor] = useState(true);

  useEffect(() => {
    setIsClient(true);
    const findAuthor = async () => {
      setIsLoadingAuthor(true);
      let foundAuthor = technicians.find(t => t.id === note.authorId);
      if (!foundAuthor && db && note.authorId) {
        // If author not in the passed list (e.g., a newly added user or self), fetch them directly
        foundAuthor = await getTechnicianById(db, note.authorId);
      }
      setAuthor(foundAuthor);
      setIsLoadingAuthor(false);
    };

    findAuthor();
  }, [note.authorId, technicians, db]);

  return (
    <div className="flex gap-4">
      <Avatar>
        <AvatarImage src={author?.avatarUrl} />
        <AvatarFallback>
          <User />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <p className="font-semibold">{isLoadingAuthor ? "Loading..." : (author?.name || 'Unknown User')}</p>
                {isEditing && (
                     <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onNoteDelete(note.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete Note</span>
                    </Button>
                )}
            </div>
          <p className="text-xs text-muted-foreground">
            {isClient ? formatDistanceToNow(new Date(note.createdAt), { addSuffix: true }) : '...'}
          </p>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{note.text}</p>
        {note.photoUrls && note.photoUrls.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {note.photoUrls.map((url, index) => (
              <div key={index} className="relative group aspect-video rounded-lg overflow-hidden border">
                <Image src={url} alt={`Work photo ${index + 1}`} fill style={{ objectFit: 'cover' }} />
                {isEditing && (
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
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
