'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import type { WorkOrderNote, PhotoMetadata } from '@/lib/types';
import { Button } from './ui/button';
import { Trash2, FileText, FileX, Maximize2, Download } from 'lucide-react';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface NoteActivityItemProps {
  note: WorkOrderNote;
  onPhotoDelete?: (noteId: string, photo: string | PhotoMetadata) => void;
  onNoteDelete?: (noteId: string) => void;
  showPhotos?: boolean;
  isAdmin?: boolean;
}

export const NoteActivityItem = React.memo(({ 
  note, 
  onPhotoDelete, 
  onNoteDelete, 
  showPhotos = true,
  isAdmin = false
}: NoteActivityItemProps) => {
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const isValidDate = note.createdAt && !isNaN(new Date(note.createdAt).getTime());
  const isExcluded = note.excludeFromReport || false;

  const getPhotoUrl = (p: string | PhotoMetadata) => typeof p === 'string' ? p : p.url;
  const getThumbUrl = (p: string | PhotoMetadata) => typeof p === 'string' ? p : p.thumbnailUrl || p.url;
  
  // Use image proxy for high-res previews to resolve CORS/loading issues
  const getProxiedUrl = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`;

  return (
    <div className="space-y-3 relative border-b pb-4 last:border-0 last:pb-0">
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
                {isExcluded ? "Excluded" : "Included"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onNoteDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onNoteDelete(note.id)}>
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete Note</span>
            </Button>
          )}
        </div>
      </div>
      {showPhotos && note.photoUrls && note.photoUrls.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {note.photoUrls.map((photo, index) => (
            <div key={getPhotoUrl(photo)} className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer" onClick={() => setViewingPhoto(getPhotoUrl(photo))}>
              <Image src={getThumbUrl(photo)} alt={`Work photo ${index + 1}`} fill sizes="(max-width: 768px) 25vw, 12vw" className="object-cover" />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="text-white h-5 w-5" /></div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-0 flex flex-col items-stretch h-[90vh]">
          <DialogHeader className="p-4 bg-background/10 backdrop-blur-sm border-b border-white/10 absolute top-0 w-full z-10"><DialogTitle className="text-white text-sm font-bold uppercase tracking-widest">Field Note Image Preview</DialogTitle></DialogHeader>
          <div className="flex-1 relative flex items-center justify-center p-4">
            {viewingPhoto && (
              <Image 
                src={getProxiedUrl(viewingPhoto)} 
                alt="Field documentation preview" 
                fill 
                className="object-contain" 
                priority 
                unoptimized={true}
              />
            )}
          </div>
          <div className="p-4 bg-background flex justify-between items-center border-t">
            <Button variant="outline" size="sm" onClick={() => setViewingPhoto(null)}>Close</Button>
            <div className="flex items-center gap-2">
                {viewingPhoto && <Button variant="outline" size="sm" asChild><a href={getProxiedUrl(viewingPhoto)} download><Download className="h-4 w-4 mr-2" /> Download</a></Button>}
                {onPhotoDelete && viewingPhoto && (
                  <Button variant="destructive" size="sm" onClick={() => { 
                    const p = note.photoUrls?.find(p => (typeof p === 'string' ? p : p.url) === viewingPhoto);
                    if (p) onPhotoDelete(note.id, p); 
                    setViewingPhoto(null); 
                  }}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Documentation
                  </Button>
                )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

NoteActivityItem.displayName = 'NoteActivityItem';