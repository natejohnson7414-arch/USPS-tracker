'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from './ui/date-picker';
import { useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Ban } from 'lucide-react';
import type { MaintenanceContract, WorkSite, Asset, PmTaskTemplate, PmSchedule } from '@/lib/types';
import { getAssetsBySiteId, getPmTaskTemplates, getPmSchedulesForAsset, savePmSchedule } from '@/lib/data';
import { PmPlanningGrid } from './pm-planning-grid';

interface ContractFormProps {
  contract?: MaintenanceContract | null;
  workSites: WorkSite[];
  onCancel: () => void;
  onSaved: () => void;
}

export function ContractForm({ contract, workSites, onCancel, onSaved }: ContractFormProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [siteAssets, setSiteAssets] = useState<Asset[]>([]);
  const [pmTemplates, setPmTemplates] = useState<PmTaskTemplate[]>([]);
  const [assetSchedules, setAssetSchedules] = useState<Record<string, PmSchedule[]>>({});
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);

  const [formData, setFormData] = useState<Partial<MaintenanceContract>>({
    siteId: contract?.siteId || '',
    contractNumber: contract?.contractNumber || '',
    startDate: contract?.startDate || new Date().toISOString(),
    endDate: contract?.endDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
    status: contract?.status || 'active',
    notes: contract?.notes || '',
  });

  useEffect(() => {
    if (contract) {
      setFormData({ ...contract });
    }
  }, [contract]);

  useEffect(() => {
    if (db) {
      getPmTaskTemplates(db).then(setPmTemplates);
    }
  }, [db]);

  const loadSitePlanningData = useCallback(async (siteId: string) => {
    if (!db || !siteId) return;
    setIsLoadingSchedules(true);
    try {
      const assets = await getAssetsBySiteId(db, siteId);
      setSiteAssets(assets);
      
      const schedulesMap: Record<string, PmSchedule[]> = {};
      for (const asset of assets) {
        const schedules = await getPmSchedulesForAsset(db, asset.id);
        schedulesMap[asset.id] = schedules;
      }
      setAssetSchedules(schedulesMap);
    } catch (error) {
      console.error("Failed to load site assets:", error);
    } finally {
      setIsLoadingSchedules(false);
    }
  }, [db]);

  useEffect(() => {
    if (formData.siteId) {
      loadSitePlanningData(formData.siteId);
    } else {
      setSiteAssets([]);
      setAssetSchedules({});
    }
  }, [formData.siteId, loadSitePlanningData]);

  const handleUpdateSchedule = async (assetId: string, templateId: string, monthStr: string) => {
    if (!db) return;
    
    const assetSchedulesList = assetSchedules[assetId] || [];
    const existingSchedule = assetSchedulesList.find(s => s.templateId === templateId);

    if (monthStr === 'none') {
      if (existingSchedule) {
        try {
          await deleteDoc(doc(db, 'assets', assetId, 'pmSchedules', existingSchedule.id));
          toast({ title: 'PM Cycle Removed' });
          loadSitePlanningData(formData.siteId!);
        } catch (e) {
          toast({ title: 'Failed to remove cycle', variant: 'destructive' });
        }
      }
      return;
    }

    const month = parseInt(monthStr);
    const template = pmTemplates.find(t => t.id === templateId);
    if (!template) return;

    const scheduleData: Omit<PmSchedule, 'id'> = {
      templateId,
      templateName: template.name,
      season: template.season,
      dueMonth: month,
      recurrence: 'yearly',
      active: true,
    };

    try {
      if (existingSchedule) {
        const scheduleRef = doc(db, 'assets', assetId, 'pmSchedules', existingSchedule.id);
        await updateDocumentNonBlocking(scheduleRef, scheduleData);
        toast({ title: 'PM Cycle Rescheduled' });
      } else {
        await savePmSchedule(db, assetId, scheduleData);
        toast({ title: 'PM Cycle Scheduled' });
      }
      loadSitePlanningData(formData.siteId!);
    } catch (e) {
      toast({ title: 'Failed to save cycle', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    if (!formData.siteId || !formData.contractNumber || !formData.startDate || !formData.endDate) {
      toast({ title: 'Missing required fields', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const data = {
        ...formData,
        updatedAt: new Date().toISOString(),
      };

      if (contract?.id) {
        await updateDocumentNonBlocking(doc(db, 'contracts', contract.id), data);
        toast({ title: 'Contract Updated' });
      } else {
        const newData = {
          ...data,
          createdAt: new Date().toISOString(),
        };
        await addDocumentNonBlocking(collection(db, 'contracts'), newData);
        toast({ title: 'Contract Created' });
      }

      onSaved();
    } catch (error) {
      console.error('Error saving contract:', error);
      toast({ title: 'Error saving contract', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{contract ? 'Edit Contract' : 'New Maintenance Agreement'}</CardTitle>
          <CardDescription>Define the term and scope of the customer's maintenance contract.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site">Select Work Site *</Label>
              <Select value={formData.siteId || ''} onValueChange={(val) => setFormData({ ...formData, siteId: val })}>
                <SelectTrigger id="site">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {workSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractNumber">Contract / PO Number *</Label>
              <Input
                id="contractNumber"
                value={formData.contractNumber || ''}
                onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                placeholder="e.g. MC-2024-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Agreement Status</Label>
              <Select value={formData.status || 'active'} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <DatePicker 
                  date={formData.startDate ? new Date(formData.startDate) : undefined} 
                  setDate={(d) => setFormData({ ...formData, startDate: d?.toISOString() })} 
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <DatePicker 
                  date={formData.endDate ? new Date(formData.endDate) : undefined} 
                  setDate={(d) => setFormData({ ...formData, endDate: d?.toISOString() })} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                placeholder="Scope details, exclusions, or billing terms..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {formData.siteId && (
        <PmPlanningGrid 
          assets={siteAssets}
          templates={pmTemplates}
          assetSchedules={assetSchedules}
          onUpdateSchedule={handleUpdateSchedule}
          isLoading={isLoadingSchedules}
        />
      )}

      <div className="flex justify-end gap-2 border-t pt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          <Ban className="mr-2 h-4 w-4" /> Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {contract ? 'Update Contract' : 'Save Agreement'}
        </Button>
      </div>
    </form>
  );
}
