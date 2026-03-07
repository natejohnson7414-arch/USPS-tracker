
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { getPmTaskTemplates, savePmSchedule } from '@/lib/data';
import type { Asset, PmTaskTemplate, PmSchedule } from '@/lib/types';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarClock, Clock, Wrench, Repeat } from 'lucide-react';

interface PmScheduleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  onScheduleAdded: () => void;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function AddPmScheduleDialog({
  isOpen,
  onOpenChange,
  asset,
  onScheduleAdded,
}: PmScheduleDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<PmTaskTemplate[]>([]);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

  useEffect(() => {
    if (isOpen && db) {
      getPmTaskTemplates(db).then(setTemplates);
    }
  }, [isOpen, db]);

  const handleSubmit = async () => {
    if (!db || !selectedTemplateId) {
      toast({ title: 'Missing Info', description: 'Please select a template.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const template = templates.find(t => t.id === selectedTemplateId);
      
      const scheduleData: Omit<PmSchedule, 'id'> = {
        templateId: selectedTemplateId,
        templateName: template!.name,
        season: template!.season,
        dueMonth: parseInt(selectedMonth),
        recurrence: 'yearly',
        active: true,
      };

      await savePmSchedule(db, asset.id, scheduleData);
      
      toast({ title: 'PM Schedule Added' });
      onScheduleAdded();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Could not save schedule.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Add PM Schedule
          </DialogTitle>
          <DialogDescription>
            Assign a seasonal maintenance cycle to {asset.name} ({asset.assetTag}).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template">PM Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Select seasonal template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} ({template.season})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Clock className="h-3 w-3" /> Scheduled Month</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, i) => (
                  <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
