'use client';

import React from 'react';
import { format } from 'date-fns';
import type { TimeEntry } from '@/lib/types';
import { Button } from './ui/button';
import { Trash2, FileText, FileX } from 'lucide-react';
import { Badge } from './ui/badge';

interface TimeActivityItemProps {
  timeEntry: TimeEntry & { technicianName?: string };
  onTimeEntryDelete?: (timeEntryId: string) => void;
  isAdmin?: boolean;
}

/**
 * Memoized Time Activity Item to prevent unnecessary re-renders.
 */
export const TimeActivityItem = React.memo(({ timeEntry, onTimeEntryDelete, isAdmin = false }: TimeActivityItemProps) => {
  const isExcluded = timeEntry.excludeFromReport || false;

  return (
    <div className="flex items-start justify-between gap-4 border-l-4 border-sky-500 pl-4 py-1">
        <div className="flex-1">
            <div className="flex items-center gap-3">
                <p className="font-medium text-sm">{timeEntry.technicianName || 'Technician'}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(timeEntry.date), 'MMM d, yyyy')}</p>
                {isAdmin && (
                  <Badge variant={isExcluded ? "outline" : "secondary"} className="h-5 text-[10px] uppercase font-bold px-1.5 gap-1">
                    {isExcluded ? <FileX className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {isExcluded ? "Excluded from Report" : "Included in Report"}
                  </Badge>
                )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Logged <span className="font-semibold text-foreground">{timeEntry.hours.toFixed(2)} hours</span> of {timeEntry.timeType} time.
            </p>
            {timeEntry.notes && <p className="text-sm mt-2 bg-sky-50/50 border border-sky-100 p-2 rounded-md italic">{timeEntry.notes}</p>}
        </div>
        
        <div className="flex items-center gap-2">
          {onTimeEntryDelete && (
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => onTimeEntryDelete(timeEntry.id)}
            >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete Time Entry</span>
            </Button>
          )}
        </div>
    </div>
  );
});

TimeActivityItem.displayName = 'TimeActivityItem';
