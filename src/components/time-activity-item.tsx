
'use client';

import { format } from 'date-fns';
import type { TimeEntry } from '@/lib/types';
import { Button } from './ui/button';
import { Trash2, FileText, FileX } from 'lucide-react';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface TimeActivityItemProps {
  timeEntry: TimeEntry & { technicianName?: string };
  onTimeEntryDelete?: (timeEntryId: string) => void;
  isAdmin?: boolean;
}

export function TimeActivityItem({ timeEntry, onTimeEntryDelete, isAdmin = false }: TimeActivityItemProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const isExcluded = timeEntry.excludeFromReport || false;

  const handleToggleReportInclusion = async (excluded: boolean) => {
    if (!db) return;
    try {
      const entryRef = doc(db, 'time_entries', timeEntry.id);
      await updateDocumentNonBlocking(entryRef, { excludeFromReport: excluded });
      toast({ title: excluded ? 'Time detail hidden from report' : 'Time detail included in report' });
    } catch (e) {}
  };

  return (
    <div className="flex items-start justify-between gap-4 border-l-4 border-sky-500 pl-4 py-1">
        <div className="flex-1">
            <div className="flex items-center gap-3">
                <p className="font-medium text-sm">{timeEntry.technicianName || 'Technician'}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(timeEntry.date), 'MMM d, yyyy')}</p>
                {isAdmin && (
                  <Badge variant={isExcluded ? "outline" : "secondary"} className="h-5 text-[10px] uppercase font-bold px-1.5 gap-1">
                    {isExcluded ? <FileX className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {isExcluded ? "Excluded" : "In Report"}
                  </Badge>
                )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Logged <span className="font-semibold text-foreground">{timeEntry.hours.toFixed(2)} hours</span> of {timeEntry.timeType} time.
            </p>
            {timeEntry.notes && <p className="text-sm mt-2 bg-sky-50/50 border border-sky-100 p-2 rounded-md italic">{timeEntry.notes}</p>}
        </div>
        
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex items-center gap-2 mr-2">
              <Switch 
                id={`report-toggle-time-${timeEntry.id}`}
                checked={!isExcluded}
                onCheckedChange={(checked) => handleToggleReportInclusion(!checked)}
                className="scale-75"
              />
            </div>
          )}
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
}
