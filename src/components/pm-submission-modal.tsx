
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
import { AlertCircle, FileCheck, Loader2, Package, CheckCircle2, Receipt } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { PmAssetTaskGroup } from '@/lib/types';

interface PmSubmissionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  assetTasks: PmAssetTaskGroup[];
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function PmSubmissionModal({ isOpen, onOpenChange, assetTasks, onConfirm, isSubmitting }: PmSubmissionModalProps) {
  const [agreed, setAgreed] = useState(false);
  
  // 1. Requirement: At least one photo per unit
  const unitsWithoutPhotos = assetTasks.filter(group => 
    !group.tasks.some(t => t.photoUrls && t.photoUrls.length > 0)
  );

  // 2. Requirement: Every unit must have a condition grade
  const unitsWithoutCondition = assetTasks.filter(group => !group.condition);

  // 3. Requirement: Every "Fair" or "Poor" unit must have a quote linked
  const unitsWithoutQuotes = assetTasks.filter(group => 
    (group.condition === 'Fair' || group.condition === 'Poor') && !group.quoteId
  );

  const hasErrors = unitsWithoutPhotos.length > 0 || unitsWithoutCondition.length > 0 || unitsWithoutQuotes.length > 0;
  const canSubmit = agreed && !hasErrors;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Submit Consolidated PM for Review
          </DialogTitle>
          <DialogDescription>
            Please verify the following USPS mandatory requirements before submitting.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {hasErrors ? (
              <div className="bg-destructive/10 border-2 border-destructive p-4 rounded-lg space-y-4">
                <div className="flex items-center gap-2 text-destructive font-bold">
                  <AlertCircle className="h-4 w-4" />
                  Documentation Requirements Not Met
                </div>
                
                {unitsWithoutCondition.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-black text-destructive/70">Missing Condition Grades</p>
                    {unitsWithoutCondition.map((group, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/50 p-2 rounded border border-destructive/20">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-destructive">
                          <Package className="h-3 w-3" /> {group.assetTag}
                        </div>
                        <Badge variant="destructive" className="h-5 text-[8px] uppercase">Condition Missing</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {unitsWithoutQuotes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-black text-destructive/70">Missing Repair Quotes</p>
                    {unitsWithoutQuotes.map((group, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/50 p-2 rounded border border-destructive/20">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-destructive">
                          <Package className="h-3 w-3" /> {group.assetTag} ({group.condition})
                        </div>
                        <div className="flex items-center gap-1">
                          <Receipt className="h-3 w-3 text-destructive" />
                          <span className="text-[8px] font-bold uppercase text-destructive">Quote Req.</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {unitsWithoutPhotos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-black text-destructive/70">Missing Documentation Photos</p>
                    {unitsWithoutPhotos.map((group, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/50 p-2 rounded border border-destructive/20">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-destructive">
                          <Package className="h-3 w-3" /> {group.assetTag}
                        </div>
                        <Badge variant="destructive" className="h-5 text-[8px] uppercase">No Photos</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-bold mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Documentation Verified
                </div>
                <p className="text-xs text-green-700 italic">
                  All units graded, documented with photos, and quotes initiated where required.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">USPS Standards Verification</h3>
              <ul className="grid gap-3 text-sm">
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Call in/out performed for site.</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Model/Serial recorded; filter/belt sizes and quantities noted for all units.</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span className="font-bold">Fair/Poor graded units have a linked repair quote with photo documentation.</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Before/after photos of filters (dated) and belts included for every asset.</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Filters disposed of off-site.</span>
                </li>
                <li className="flex items-start gap-2 bg-muted/30 p-2 rounded">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                  <span className="font-semibold text-destructive">No use of USPS ladders, belts, or filters.</span>
                </li>
              </ul>
            </div>

            <div className="flex items-start space-x-3 p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
              <Checkbox id="final-agree" checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-1" />
              <Label htmlFor="final-agree" className="text-sm font-bold leading-normal cursor-pointer text-primary">
                I have reviewed and followed all site-specific requirements for all {assetTasks.length} units and verify that this consolidated documentation is accurate.
              </Label>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Go Back
          </Button>
          <Button onClick={onConfirm} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
