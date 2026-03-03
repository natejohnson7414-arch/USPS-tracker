
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
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { getPmTemplates } from '@/lib/data';
import type { Asset, PmTemplate, AssetPmSchedule } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarClock } from 'lucide-react';
import { startOfMonth } from 'date-fns';

interface AddPmScheduleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  assets: Asset[];
  onScheduleAdded: () => void;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function AddPmScheduleDialog({
  isOpen,
  onOpenChange,
  assets,
  onScheduleAdded,
}: AddPmScheduleDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<PmTemplate[]>([]);
  
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    if (isOpen && db) {
      getPmTemplates(db).then(setTemplates);
    }
  }, [isOpen, db]);

  const handleSubmit = async () => {
    if (!db) return;
    if (!selectedAssetId || !selectedTemplateId) {
      toast({ title: 'Missing Information', description: 'Please select an asset and template.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      // Create a date object for the 1st of the selected month
      const dueDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
      
      const scheduleData: Omit<AssetPmSchedule, 'id'> = {
        assetId: selectedAssetId,
        templateId: selectedTemplateId,
        nextDueDate: dueDate.toISOString(),
        autoGenerateWorkOrder: false,
        status: 'active',
      };

      await addDocumentNonBlocking(collection(db, 'asset_pm_schedules'), scheduleData);
      
      toast({ title: 'PM Planned', description: 'The maintenance task has been added to the calendar.' });
      onScheduleAdded();
      onOpenChange(false);
      
      // Reset form
      setSelectedAssetId('');
      setSelectedTemplateId('');
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Could not create schedule.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() + i).toString());

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Plan PM Task
          </DialogTitle>
          <DialogDescription>
            Schedule a month for preventative maintenance at this site.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="asset">Select Asset</Label>
            <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
              <SelectTrigger id="asset">
                <SelectValue placeholder="Which equipment?" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.assetTag} - {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">PM Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Standard procedure" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} ({template.frequencyType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due Month</Label>
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
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add to Calendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
