
'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import type { PmTask, PhotoMetadata } from '@/lib/types';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Camera, Image as ImageIcon, Loader2, Trash2, X, Maximize2 } from 'lucide-react';
import { Input } from './ui/input';
import { useToast } from '@/hooks/use-toast';
import { uploadImageResumable, deleteImage, uploadPhotoWithThumbnail, deletePhotoMetadata } from '@/firebase/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { cn } from '@/lib/utils';

interface PmTaskItemProps {
  task: PmTask;
  index: number;
  onUpdate: (updatedTask: PmTask) => void;
  assetTag: string;
  isCompletedWorkOrder: boolean;
}

export function PmTaskItem({ task, index, onUpdate, assetTag, isCompletedWorkOrder }: PmTaskItemProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const handleToggle = (checked: boolean) => {
    if (checked && task.photoUrls.length === 0) {
      toast({
        title: "Photo Reminder",
        description: `Please take photos for: ${task.text}`,
        action: (
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Add Photo
          </Button>
        )
      });
    }
    onUpdate({ ...task, completed: checked });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const uploadedResults: PhotoMetadata[] = [];

    try {
      for (const file of Array.from(files)) {
        const basePath = `pm-work-orders/${assetTag}`;
        const fileName = `${Date.now()}-${file.name}`;
        const result = await uploadPhotoWithThumbnail(file, basePath, fileName);
        uploadedResults.push(result);
      }

      onUpdate({
        ...task,
        photoUrls: [...task.photoUrls, ...uploadedResults]
      });
      toast({ title: "Photos Added" });
    } catch (error) {
      toast({ title: "Upload Failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const removePhoto = async (photo: string | PhotoMetadata) => {
    const targetUrl = typeof photo === 'string' ? photo : photo.url;
    onUpdate({
      ...task,
      photoUrls: task.photoUrls.filter(p => (typeof p === 'string' ? p : p.url) !== targetUrl)
    });
    try {
      await deletePhotoMetadata(photo);
    } catch (e) {}
  };

  const getPhotoUrl = (p: string | PhotoMetadata) => typeof p === 'string' ? p : p.url;
  const getThumbUrl = (p: string | PhotoMetadata) => typeof p === 'string' ? p : p.thumbnailUrl || p.url;

  return (
    <div className={cn(
      "p-4 border rounded-lg space-y-4 transition-colors",
      task.completed ? "bg-green-50/30 border-green-200" : "bg-card"
    )}>
      <div className="flex items-start gap-3">
        <Checkbox 
          id={`task-${assetTag}-${index}`} 
          checked={task.completed} 
          onCheckedChange={handleToggle}
          disabled={isCompletedWorkOrder}
          className="mt-1"
        />
        <div className="flex-1 space-y-1">
          <Label 
            htmlFor={`task-${assetTag}-${index}`}
            className={cn(
              "text-sm font-bold leading-tight cursor-pointer",
              task.completed && "text-green-800"
            )}
          >
            {task.text}
          </Label>
          <Input 
            placeholder="Technical notes..."
            value={task.notes}
            onChange={(e) => onUpdate({ ...task, notes: e.target.value })}
            className="h-8 text-xs mt-2"
            disabled={isCompletedWorkOrder}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {task.photoUrls.map((photo, i) => (
          <div key={getPhotoUrl(photo)} className="relative group h-16 w-16 rounded border overflow-hidden">
            <Image 
              src={getThumbUrl(photo)} 
              alt="Task documentation" 
              fill 
              sizes="64px"
              className="object-cover cursor-pointer" 
              onClick={() => setViewingPhoto(getPhotoUrl(photo))}
            />
            {!isCompletedWorkOrder && (
              <Button 
                variant="destructive" 
                size="icon" 
                className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removePhoto(photo)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
        {!isCompletedWorkOrder && (
          <Button 
            variant="outline" 
            size="icon" 
            className="h-16 w-16 border-dashed"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
          </Button>
        )}
      </div>
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handlePhotoUpload} />

      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
          <DialogHeader className="sr-only">
            <DialogTitle>Photo Preview</DialogTitle>
            <DialogDescription>Full resolution view of task documentation</DialogDescription>
          </DialogHeader>
          <div className="relative h-[80vh] w-full">
            {viewingPhoto && <Image src={viewingPhoto} alt="Task photo" fill className="object-contain" priority />}
          </div>
          <div className="p-4 bg-background flex justify-end gap-2">
            <Button variant="outline" onClick={() => setViewingPhoto(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
