

'use client';

import { format } from 'date-fns';
import type { TimeEntry } from '@/lib/types';
import { Button } from './ui/button';
import { Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';

interface TimeActivityItemProps {
  timeEntry: TimeEntry & { technicianName?: string };
  onTimeEntryDelete: (timeEntryId: string) => void;
}

export function TimeActivityItem({ timeEntry, onTimeEntryDelete }: TimeActivityItemProps) {

  return (
    <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
            <div className="flex items-center gap-2">
                <p className="font-medium">{timeEntry.technicianName || 'Unknown User'}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(timeEntry.date), 'MMM d, yyyy')}</p>
            </div>
            <p className="text-sm text-muted-foreground">Logged <span className="font-semibold">{timeEntry.hours.toFixed(2)} hours</span> of {timeEntry.timeType} time.</p>
            {timeEntry.notes && <p className="text-sm mt-1 bg-muted p-2 rounded-md">{timeEntry.notes}</p>}
        </div>
        
        <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onTimeEntryDelete(timeEntry.id)}
        >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete Time Entry</span>
        </Button>
    </div>
  );
}

    
