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
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { getPmTemplates } from '@/lib/data';
import type { Asset, PmTemplate, AssetPmSchedule } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarClock } from 'lucide-react';

interface AddPmScheduleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  assets: Asset[];
  onScheduleAdded: () => void;
}

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
  const [nextDueDate, setNextDueDate] = useState<Date | undefined>(new Date());
  const [autoGenerate, setAutoGenerate] = useState(true);

  useEffect(() => {
    if (isOpen && db) {
      getPmTemplates(db).then(setTemplates);
    }
  }, [isOpen, db]);

  const handleSubmit = async () => {
    if (!db) return;
    if (!selectedAssetId || !selectedTemplateId || !nextDueDate) {
      toast({ title: 'Missing Information', description: 'Please select an asset, template, and due date.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const scheduleData: Omit<AssetPmSchedule, 'id'> = {
        assetId: selectedAssetId,
        templateId: selectedTemplateId,
        nextDueDate: nextDueDate.toISOString(),
        autoGenerateWorkOrder: autoGenerate,
        status: 'active',
      };

      await addDocumentNonBlocking(collection(db, 'asset_pm_schedules'), scheduleData);
      
      toast({ title: 'Schedule Added', description: 'The PM task has been successfully scheduled.' });
      onScheduleAdded();
      onOpenChange(false);
      
      // Reset form
      setSelectedAssetId('');
      setSelectedTemplateId('');
      setNextDueDate(new Date());
      setAutoGenerate(true);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Could not create schedule.', variant: 'destructive' });
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
            Schedule PM Task
          </DialogTitle>
          <DialogDescription>
            Assign a preventative maintenance template to an asset at this site.
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

          <div className="space-y-2">
            <Label>Next Service Due Date</Label>
            <DatePicker date={nextDueDate} setDate={setNextDueDate} />
          </div>

          <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
            <div className="space-y-0.5">
              <Label htmlFor="auto-gen">Auto-Generate Work Order</Label>
              <p className="text-xs text-muted-foreground">
                Creates a new job automatically on the due date.
              </p>
            </div>
            <Switch
              id="auto-gen"
              checked={autoGenerate}
              onCheckedChange={setAutoGenerate}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
