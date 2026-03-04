
'use client';

import Image from 'next/image';
import { format } from 'date-fns';
import type { WorkOrderNote } from '@/lib/types';
import { Button } from './ui/button';
import { X, Trash2, FileText, FileX } from 'lucide-react';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Badge } from './ui/badge';

interface NoteActivityItemProps {
  note: WorkOrderNote;
  onPhotoDelete?: (noteId: string, photoUrl: string) => void;
  onNoteDelete?: (noteId: string) => void;
  onToggleReportInclusion?: (noteId: string, excluded: boolean) => void;
  showPhotos?: boolean;
  isAdmin?: boolean;
}

export function NoteActivityItem({ 
  note, 
  onPhotoDelete, 
  onNoteDelete, 
  onToggleReportInclusion,
  showPhotos = true,
  isAdmin = false
}: NoteActivityItemProps) {
  const isValidDate = note.createdAt && !isNaN(new Date(note.createdAt).getTime());
  const isExcluded = note.excludeFromReport || false;

  return (
    <div className="space-y-3 relative">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 pr-4">
          <p className="text-sm">{note.text}</p>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-muted-foreground">
              {isValidDate ? format(new Date(note.createdAt), 'MMM d, yyyy') : 'Note'}
            </p>
            {isAdmin && (
              <Badge variant={isExcluded ? "outline" : "secondary"} className="h-5 text-[10px] uppercase font-bold px-1.5 gap-1">
                {isExcluded ? <FileX className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                {isExcluded ? "Excluded from Report" : "Included in Report"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && onToggleReportInclusion && (
            <div className="flex items-center gap-2 mr-2">
              <Label htmlFor={`report-toggle-${note.id}`} className="sr-only">Include in PDF</Label>
              <Switch 
                id={`report-toggle-${note.id}`}
                checked={!isExcluded}
                onCheckedChange={(checked) => onToggleReportInclusion(note.id, !checked)}
                className="scale-75"
              />
            </div>
          )}
          {onNoteDelete && (
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
      </div>
      {showPhotos && note.photoUrls && note.photoUrls.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {note.photoUrls.map((url, index) => (
            <div key={index} className="relative group aspect-video rounded-lg overflow-hidden border">
              <Image src={url} alt={`Work photo ${index + 1}`} fill style={{ objectFit: 'cover' }} />
              {onPhotoDelete && (
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
  );
}
