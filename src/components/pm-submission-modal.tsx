
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertCircle, FileCheck, Loader2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import type { PmTask } from '@/lib/types';

interface PmSubmissionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: PmTask[];
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function PmSubmissionModal({ isOpen, onOpenChange, tasks, onConfirm, isSubmitting }: PmSubmissionModalProps) {
  const [agreed, setAgreed] = useState(false);
  
  const tasksWithoutPhotos = tasks.filter(t => t.completed && t.photoUrls.length === 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Submit PM Work Order for Review
          </DialogTitle>
          <DialogDescription>
            Please verify the following USPS mandatory requirements before submitting.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {tasksWithoutPhotos.length > 0 && (
              <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-orange-800 font-bold mb-2">
                  <AlertCircle className="h-4 w-4" />
                  Documentation Gaps
                </div>
                <p className="text-sm text-orange-700 mb-2 italic">The following tasks are marked done but have 0 photos:</p>
                <ul className="list-disc pl-5 text-xs text-orange-800 space-y-1">
                  {tasksWithoutPhotos.map((t, i) => <li key={i}>{t.text}</li>)}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">USPS Standards Verification</h3>
              <ul className="grid gap-3 text-sm">
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Call in/out performed.</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Model/Serial recorded; filter/belt sizes and quantities noted.</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Asset list updated if incorrect.</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Before/after photos of filters (dated) and belts.</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Filters disposed of off-site.</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Condenser coil photos included (if cooling season).</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Signed acknowledgment letter with temperatures obtained from a Supervisor.</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span className="font-semibold text-destructive">No use of USPS ladders, belts, or filters.</span>
                </li>
              </ul>
            </div>

            <div className="flex items-start space-x-3 p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
              <Checkbox id="final-agree" checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-1" />
              <Label htmlFor="final-agree" className="text-sm font-bold leading-normal cursor-pointer">
                I have reviewed and followed all site-specific requirements and verify that this documentation is accurate.
              </Label>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Go Back
          </Button>
          <Button onClick={onConfirm} disabled={!agreed || isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
