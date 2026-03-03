
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
import { getPmTemplates } from '@/lib/data';
import type { Asset, PmTemplate, AssetPmSchedule } from '@/lib/types';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarClock, Clock, Wrench, Repeat } from 'lucide-react';

interface PmScheduleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  assets?: Asset[];
  assetId?: string;
  schedule?: AssetPmSchedule | null;
  onScheduleAdded: () => void;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const frequencies = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semiannual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' },
];

export function AddPmScheduleDialog({
  isOpen,
  onOpenChange,
  assets = [],
  assetId,
  schedule,
  onScheduleAdded,
}: PmScheduleDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<PmTemplate[]>([]);
  
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [pmFrequency, setPmFrequency] = useState<string>('monthly');
  const [pmLaborHours, setPmLaborHours] = useState<string>('0');

  const isEdit = !!schedule;
  const isBuiltIn = schedule?.templateId === 'built-in';

  useEffect(() => {
    if (isOpen && db) {
      getPmTemplates(db).then(setTemplates);
      
      if (schedule) {
        setSelectedAssetId(schedule.assetId);
        setSelectedTemplateId(schedule.templateId);
        setSelectedMonth((new Date(schedule.nextDueDate).getMonth() + 1).toString());
        setPmFrequency(schedule.frequencyType || 'monthly');
        setPmLaborHours(schedule.estimatedLaborHours?.toString() || '0');
      } else if (assetId) {
        setSelectedAssetId(assetId);
        setSelectedTemplateId('');
        setSelectedMonth((new Date().getMonth() + 1).toString());
        setPmFrequency('monthly');
        setPmLaborHours('0');
      }
    }
  }, [isOpen, db, schedule, assetId]);

  const handleSubmit = async () => {
    if (!db) return;
    
    if (!isBuiltIn && !isEdit && !selectedTemplateId && !assetId) {
      if (!selectedAssetId) {
        toast({ title: 'Missing Asset', description: 'Please select an asset.', variant: 'destructive' });
        return;
      }
    }

    setIsLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const dueDate = new Date(currentYear, parseInt(selectedMonth) - 1, 1);
      
      if (isBuiltIn) {
        // Built-in schedules are managed directly on the Asset document
        const assetRef = doc(db, 'assets', schedule!.assetId);
        await updateDocumentNonBlocking(assetRef, {
          pmFrequency,
          pmMonth: parseInt(selectedMonth),
          pmLaborHours: parseFloat(pmLaborHours) || 0
        });
      } else if (isEdit) {
        // Edit standalone schedule
        const scheduleRef = doc(db, 'asset_pm_schedules', schedule!.id);
        await updateDocumentNonBlocking(scheduleRef, {
          templateId: selectedTemplateId,
          nextDueDate: dueDate.toISOString(),
        });
      } else {
        // Create new standalone schedule
        const scheduleData: Omit<AssetPmSchedule, 'id'> = {
          assetId: selectedAssetId,
          templateId: selectedTemplateId,
          nextDueDate: dueDate.toISOString(),
          autoGenerateWorkOrder: false,
          status: 'active',
        };

        await addDocumentNonBlocking(collection(db, 'asset_pm_schedules'), scheduleData);
      }
      
      toast({ title: isEdit ? 'Schedule Updated' : 'PM Planned' });
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
            {isEdit ? 'Edit PM Cycle' : 'Plan PM Cycle'}
          </DialogTitle>
          <DialogDescription>
            {isBuiltIn 
              ? "Modify the recurring maintenance parameters for this piece of equipment."
              : "Assign an indefinite preventative maintenance cycle."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!assetId && !isEdit && (
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
          )}

          {isBuiltIn ? (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Repeat className="h-3 w-3" /> Frequency</Label>
                <Select value={pmFrequency} onValueChange={setPmFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencies.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Wrench className="h-3 w-3" /> Est. Labor Hours</Label>
                <Input 
                  type="number" 
                  step="0.5" 
                  value={pmLaborHours} 
                  onChange={(e) => setPmLaborHours(e.target.value)} 
                />
              </div>
            </>
          ) : (
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
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Clock className="h-3 w-3" /> Month of Service</Label>
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
            <p className="text-[10px] text-muted-foreground">The schedule will repeat indefinitely based on this anchor month.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Save Changes' : 'Start Cycle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
