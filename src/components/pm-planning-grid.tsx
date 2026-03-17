'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, CheckCircle2, Circle, CalendarClock, Loader2, Wrench, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Asset, PmTaskTemplate, PmSchedule } from '@/lib/types';
import Link from 'next/link';

interface PmPlanningGridProps {
  assets: Asset[];
  templates: PmTaskTemplate[];
  assetSchedules: Record<string, PmSchedule[]>;
  onUpdateSchedule: (assetId: string, templateId: string, monthStr: string) => Promise<void>;
  isLoading?: boolean;
  title?: string;
  description?: string;
  showLinks?: boolean;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const seasonOrder = ['spring', 'summer', 'fall', 'winter'] as const;

export function PmPlanningGrid({
  assets,
  templates,
  assetSchedules,
  onUpdateSchedule,
  isLoading,
  title = "Site PM Planning & Seasonal Tracking",
  description = "Schedule preventative maintenance cycles for every unit on site.",
  showLinks = true
}: PmPlanningGridProps) {
  
  const sortedTemplates = [...templates].sort((a, b) => {
    return seasonOrder.indexOf(a.season) - seasonOrder.indexOf(b.season);
  });

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-primary">
              <CalendarClock className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        </div>
      </CardHeader>
      <CardContent>
        {assets.length > 0 ? (
          <div className="space-y-6">
            {assets.map(asset => {
              const schedules = assetSchedules[asset.id] || [];
              const isFullyPlanned = schedules.length >= sortedTemplates.length && sortedTemplates.length > 0;

              return (
                <div key={asset.id} className="bg-background rounded-lg border p-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold">{asset.name}</p>
                        <p className="text-[10px] font-mono uppercase text-muted-foreground">TAG: {asset.assetTag}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest">
                      <span className="text-muted-foreground">Schedule Status:</span>
                      {isFullyPlanned ? (
                        <span className="text-green-600 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" /> Fully Planned
                        </span>
                      ) : (
                        <span className="text-orange-600 flex items-center gap-1.5">
                          <Circle className="h-4 w-4" /> Incomplete
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sortedTemplates.map(template => {
                      const existingSchedule = schedules.find(s => s.templateId === template.id);
                      const isScheduled = !!existingSchedule;

                      return (
                        <div key={template.id} className="space-y-2">
                          <Label className={cn(
                            "text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5",
                            isScheduled ? "text-primary" : "text-muted-foreground"
                          )}>
                            {isScheduled ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                            {template.name} ({template.season})
                          </Label>
                          <Select 
                            value={existingSchedule?.dueMonth.toString() || 'none'} 
                            onValueChange={(val) => onUpdateSchedule(asset.id, template.id, val)}
                          >
                            <SelectTrigger className={cn(
                              "h-9 text-xs transition-all font-medium",
                              isScheduled && template.season === 'spring' && "border-emerald-200 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100",
                              isScheduled && template.season === 'summer' && "border-orange-200 bg-orange-50 text-orange-900 ring-1 ring-orange-100",
                              isScheduled && template.season === 'fall' && "border-amber-200 bg-amber-50 text-amber-900 ring-1 ring-amber-100",
                              isScheduled && template.season === 'winter' && "border-sky-200 bg-sky-50 text-sky-900 ring-1 ring-sky-100",
                            )}>
                              <SelectValue placeholder="Not Scheduled" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs text-destructive">Not Scheduled</SelectItem>
                              <Separator className="my-1" />
                              {months.map((m, i) => (
                                <SelectItem key={m} value={(i + 1).toString()} className="text-xs font-medium">
                                  Due in {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                  
                  {showLinks && (
                    <div className="mt-4 pt-4 border-t flex justify-end">
                      <Button asChild variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-muted-foreground hover:text-primary">
                        <Link href={`/assets/${asset.id}`}>
                          View History & Specs <ChevronRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed rounded-lg bg-background/50">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">No equipment registered for this location.</p>
            <p className="text-xs text-muted-foreground mt-1">Please register assets in the Equipment Registry first.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
