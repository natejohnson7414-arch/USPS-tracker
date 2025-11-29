'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { getTechnicianById } from '@/lib/data';
import type { WorkOrderNote } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

interface NoteActivityItemProps {
  note: WorkOrderNote;
}

export function NoteActivityItem({ note }: NoteActivityItemProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const author = getTechnicianById(note.authorId);

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
          <p className="font-semibold">{author?.name}</p>
          <p className="text-xs text-muted-foreground">
            {isClient ? formatDistanceToNow(new Date(note.createdAt), { addSuffix: true }) : '...'}
          </p>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{note.text}</p>
        {note.photoUrls && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {note.photoUrls.map((url, index) => (
              <div key={index} className="relative aspect-video rounded-lg overflow-hidden border">
                <Image src={url} alt={`Work photo ${index + 1}`} fill style={{ objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
