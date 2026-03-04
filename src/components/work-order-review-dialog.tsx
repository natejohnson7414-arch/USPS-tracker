
'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  ChevronRight, 
  Loader2,
  Camera,
  Package,
  Clock,
  Thermometer,
  PenTool
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkOrder, TimeEntry } from '@/lib/types';

interface ReviewItemProps {
  label: string;
  isComplete: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}

function ReviewItem({ label, isComplete, icon, onClick }: ReviewItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-4 border rounded-lg transition-all text-left",
        isComplete ? "bg-green-50/50 border-green-200" : "bg-orange-50/50 border-orange-200 hover:bg-orange-100/50"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-full",
          isComplete ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
        )}>
          {icon}
        </div>
        <div>
          <p className="font-semibold text-sm">{label}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isComplete ? (
              <Badge variant="outline" className="bg-white text-green-700 border-green-200 gap-1 h-5 text-[10px] uppercase font-bold">
                <CheckCircle2 className="h-3 w-3" /> Complete
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-white text-orange-700 border-orange-200 gap-1 h-5 text-[10px] uppercase font-bold">
                <Circle className="h-3 w-3" /> Incomplete
              </Badge>
            )}
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

interface WorkOrderReviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder;
  timeEntries: TimeEntry[];
  onNavigate: (tab: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function WorkOrderReviewDialog({
  isOpen,
  onOpenChange,
  workOrder,
  timeEntries,
  onNavigate,
  onSubmit,
  isSubmitting
}: WorkOrderReviewDialogProps) {
  
  const validation = {
    assets: (workOrder.assetIds?.length ?? 0) > 0,
    beforePhotos: (workOrder.beforePhotoUrls?.length ?? 0) > 0,
    afterPhotos: (workOrder.afterPhotoUrls?.length ?? 0) > 0,
    signature: !!workOrder.customerSignatureUrl || (workOrder.acknowledgements?.length ?? 0) > 0,
    temps: !!workOrder.tempOnArrival && !!workOrder.tempOnLeaving,
    time: timeEntries.length > 0,
  };

  const isFullyComplete = Object.values(validation).every(v => v);

  const handleItemClick = (tab: string) => {
    onNavigate(tab);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Final Job Review
          </DialogTitle>
          <DialogDescription>
            Verify your documentation before submitting the work order to the office for review.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
          <div className="space-y-3 py-4">
            <ReviewItem 
              label="Linked Equipment / Assets"
              isComplete={validation.assets}
              icon={<Package className="h-4 w-4" />}
              onClick={() => handleItemClick('assets')}
            />
            <ReviewItem 
              label="Before Work Photos"
              isComplete={validation.beforePhotos}
              icon={<Camera className="h-4 w-4" />}
              onClick={() => handleItemClick('media')}
            />
            <ReviewItem 
              label="After Work Photos"
              isComplete={validation.afterPhotos}
              icon={<Camera className="h-4 w-4" />}
              onClick={() => handleItemClick('media')}
            />
            <ReviewItem 
              label="Customer Signature"
              isComplete={validation.signature}
              icon={<PenTool className="h-4 w-4" />}
              onClick={() => handleItemClick('overview')}
            />
            <ReviewItem 
              label="Arrival & Leaving Temps"
              isComplete={validation.temps}
              icon={<Thermometer className="h-4 w-4" />}
              onClick={() => handleItemClick('overview')}
            />
            <ReviewItem 
              label="Labor / Time Postings"
              isComplete={validation.time}
              icon={<Clock className="h-4 w-4" />}
              onClick={() => handleItemClick('activity')}
            />
          </div>
        </ScrollArea>

        {!isFullyComplete && (
          <div className="bg-orange-50 border border-orange-200 rounded-md p-3 flex gap-2 items-start">
            <AlertCircle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-800">
              Some documentation is missing. It is recommended to complete all items, but you can still submit if necessary.
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Continue Working
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
            ) : (
              isFullyComplete ? "Submit for Review" : "Submit Anyway"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
