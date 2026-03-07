
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
import type { Asset, PmTaskTemplate, PmSchedule, AssetPmSchedule } from '@/lib/types';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarClock, Clock, Wrench, Repeat } from 'lucide-react';

interface PmScheduleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset | null;
  assets?: Asset[];
  schedule?: AssetPmSchedule | null;
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
  assets = [],
  schedule,
  onScheduleAdded,
}: PmScheduleDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<PmTaskTemplate[]>([]);
  
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

  useEffect(() => {
    if (isOpen && db) {
      getPmTaskTemplates(db).then(setTemplates);
      
      if (schedule) {
        setSelectedAssetId(schedule.assetId);
        setSelectedTemplateId(schedule.templateId);
        // Find month index if nextDueDate exists
        if (schedule.nextDueDate) {
            const date = new Date(schedule.nextDueDate);
            setSelectedMonth((date.getMonth() + 1).toString());
        }
      } else if (asset) {
        setSelectedAssetId(asset.id);
      }
    }
  }, [isOpen, db, asset, schedule]);

  const handleSubmit = async () => {
    if (!db || !selectedTemplateId || !selectedAssetId) {
      toast({ title: 'Missing Info', description: 'Please select an asset and template.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const template = templates.find(t => t.id === selectedTemplateId);
      const targetAssetId = selectedAssetId;
      
      const currentYear = new Date().getFullYear();
      const nextDueDate = new Date(currentYear, parseInt(selectedMonth) - 1, 1).toISOString();

      const scheduleData: Omit<PmSchedule, 'id'> = {
        templateId: selectedTemplateId,
        templateName: template!.name,
        season: template!.season,
        dueMonth: parseInt(selectedMonth),
        recurrence: 'yearly',
        active: true,
      };

      if (schedule && !schedule.id.startsWith('asset-pm')) {
          const scheduleRef = doc(db, 'assets', schedule.assetId, 'pmSchedules', schedule.id);
          await updateDocumentNonBlocking(scheduleRef, {
              ...scheduleData,
              nextDueDate
          });
          toast({ title: 'PM Schedule Updated' });
      } else {
          await savePmSchedule(db, targetAssetId, scheduleData);
          toast({ title: 'PM Schedule Added' });
      }
      
      onScheduleAdded();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Could not save schedule.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const activeAsset = asset || assets.find(a => a.id === selectedAssetId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            {schedule ? 'Edit PM Schedule' : 'Add PM Schedule'}
          </DialogTitle>
          <DialogDescription>
            {activeAsset 
              ? `Assign a seasonal maintenance cycle to ${activeAsset.name} (${activeAsset.assetTag}).`
              : "Plan a recurring preventative maintenance cycle for equipment."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!asset && assets.length > 0 && (
            <div className="space-y-2">
                <Label htmlFor="asset-select">Select Equipment</Label>
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId} disabled={!!schedule}>
                    <SelectTrigger id="asset-select">
                        <SelectValue placeholder="Choose asset..." />
                    </SelectTrigger>
                    <SelectContent>
                        {assets.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                                {a.name} ({a.assetTag})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          )}

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
          <Button onClick={handleSubmit} disabled={isLoading || !selectedAssetId}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {schedule ? 'Update Schedule' : 'Save Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
