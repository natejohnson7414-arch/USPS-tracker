'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import type { PmTask, PhotoMetadata } from '@/lib/types';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Camera, Image as ImageIcon, Loader2, Trash2, X, Maximize2, Ban } from 'lucide-react';
import { Input } from './ui/input';
import { useToast } from '@/hooks/use-toast';
import { uploadPhotoWithThumbnail, deletePhotoMetadata } from '@/firebase/storage';
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
    if (task.isNA) return;
    
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

  const handleToggleNA = (checked: boolean) => {
    onUpdate({ 
      ...task, 
      isNA: checked, 
      completed: checked ? false : task.completed,
      notes: checked ? '' : task.notes 
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || task.isNA) return;

    setIsUploading(true);
    const toastId = toast({ title: `Uploading ${files.length} photo(s)...`, duration: Infinity });

    try {
      let i = 0;
      const currentTaskPhotos = [...task.photoUrls];
      
      for (const file of Array.from(files)) {
        i++;
        // Sanitize asset tag for path safety
        const safeTag = assetTag.replace(/[^a-zA-Z0-9-]/g, '_');
        const basePath = `pm-work-orders/${safeTag}`;
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        toastId.update({ 
          id: toastId.id, 
          title: `Photo ${i}/${files.length}`,
          description: `Uploading to unit ${assetTag}...` 
        });

        const result = await uploadPhotoWithThumbnail(file, basePath, fileName);
        
        // Add to the local list and notify parent progressively
        currentTaskPhotos.push(result);
        onUpdate({
          ...task,
          photoUrls: [...currentTaskPhotos]
        });
      }

      toastId.dismiss();
      toast({ title: "Photos Added Successfully" });
    } catch (error: any) {
      console.error("PM task photo upload failed:", error);
      toastId.dismiss();
      
      let errorDescription = "Transfer interrupted. Check your signal and try again.";
      if (error.code === 'storage/unauthorized') {
        errorDescription = "Access Denied. Please ensure you are logged in and try again.";
      } else if (error.message) {
        errorDescription = error.message;
      }

      toast({ 
        variant: 'destructive', 
        title: 'Upload Failed', 
        description: errorDescription 
      });
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
      "p-3 border rounded-lg space-y-3 transition-colors",
      task.completed ? "bg-green-50/30 border-green-200" : task.isNA ? "bg-muted/30 border-muted opacity-60" : "bg-card"
    )}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-3 mt-1">
            <div className="flex flex-col items-center gap-1">
                <Checkbox 
                    id={`task-${assetTag}-${index}`} 
                    checked={task.completed} 
                    onCheckedChange={handleToggle}
                    disabled={isCompletedWorkOrder || task.isNA}
                    className="h-10 w-10"
                />
                <span className="text-[8px] font-black uppercase text-muted-foreground">Done</span>
            </div>
            <div className="flex flex-col items-center gap-1">
                <Checkbox 
                    id={`task-na-${assetTag}-${index}`} 
                    checked={task.isNA} 
                    onCheckedChange={handleToggleNA}
                    disabled={isCompletedWorkOrder}
                    className="border-muted-foreground h-10 w-10"
                />
                <span className="text-[8px] font-black uppercase text-muted-foreground">N/A</span>
            </div>
        </div>
        
        <div className="flex-1 space-y-1 pt-1">
          <Label 
            htmlFor={`task-${assetTag}-${index}`}
            className={cn(
              "text-sm sm:text-base font-bold leading-tight cursor-pointer",
              task.completed && "text-green-800",
              task.isNA && "text-muted-foreground line-through"
            )}
          >
            {task.text}
          </Label>
          <Input 
            placeholder={task.isNA ? "Not applicable" : "Technical notes..."}
            value={task.notes}
            onChange={(e) => onUpdate({ ...task, notes: e.target.value })}
            className="h-8 text-sm mt-2"
            disabled={isCompletedWorkOrder || task.isNA}
          />
        </div>
      </div>

      {!task.isNA && (
        <div className="flex flex-wrap gap-2 pt-1">
            {task.photoUrls.map((photo, i) => (
            <div key={getPhotoUrl(photo)} className="relative group h-14 w-14 rounded border overflow-hidden">
                <Image 
                src={getThumbUrl(photo)} 
                alt="Task documentation" 
                fill 
                sizes="56px"
                className="object-cover cursor-pointer" 
                onClick={() => setViewingPhoto(getPhotoUrl(photo))}
                />
                {!isCompletedWorkOrder && (
                <Button 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-0 right-0 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removePhoto(photo)}
                >
                    <X className="h-2 w-2" />
                </Button>
                )}
            </div>
            ))}
            {!isCompletedWorkOrder && (
            <Button 
                variant="outline" 
                size="icon" 
                className="h-14 w-14 border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
            >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 text-muted-foreground" />}
            </Button>
            )}
        </div>
      )}
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
