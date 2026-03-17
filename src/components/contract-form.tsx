
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
import { Loader2, Save, Ban, CalendarClock, Package, Clock, Info, CheckCircle2, Circle } from 'lucide-react';
import type { MaintenanceContract, WorkSite, Asset, PmTaskTemplate, PmSchedule } from '@/lib/types';
import { getAssetsBySiteId, getPmTaskTemplates, getPmSchedulesForAsset, savePmSchedule } from '@/lib/data';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';

interface ContractFormProps {
  contract?: MaintenanceContract | null;
  workSites: WorkSite[];
  onCancel: () => void;
  onSaved: () => void;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const seasonOrder = ['spring', 'summer', 'fall', 'winter'] as const;

export function ContractForm({ contract, workSites, onCancel, onSaved }: ContractFormProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [siteAssets, setSiteAssets] = useState<Asset[]>([]);
  const [pmTemplates, setPmTemplates] = useState<PmTaskTemplate[]>([]);
  const [assetSchedules, setAssetSchedules] = useState<Record<string, PmSchedule[]>>({});
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);

  const [formData, setFormData] = useState<Partial<MaintenanceContract>>({
    siteId: '',
    contractNumber: '',
    startDate: new Date().toISOString(),
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
    status: 'active',
    notes: '',
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

    // Case: Remove schedule
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
        // Update
        const scheduleRef = doc(db, 'assets', assetId, 'pmSchedules', existingSchedule.id);
        await updateDocumentNonBlocking(scheduleRef, scheduleData);
        toast({ title: 'PM Cycle Rescheduled' });
      } else {
        // Create
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

  const sortedTemplates = useMemo(() => {
    return [...pmTemplates].sort((a, b) => {
      return seasonOrder.indexOf(a.season) - seasonOrder.indexOf(b.season);
    });
  }, [pmTemplates]);

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
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CalendarClock className="h-5 w-5" />
                  Site PM Planning & Seasonal Tasking
                </CardTitle>
                <CardDescription>Schedule preventative maintenance cycles for every unit on site.</CardDescription>
              </div>
              {isLoadingSchedules && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>
          </CardHeader>
          <CardContent>
            {siteAssets.length > 0 ? (
              <div className="space-y-6">
                {siteAssets.map(asset => {
                  const schedules = assetSchedules[asset.id] || [];
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
                        <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-muted-foreground uppercase tracking-widest">
                          Schedule Status: {schedules.length === sortedTemplates.length ? 
                            <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Fully Planned</span> : 
                            <span className="text-orange-600 flex items-center gap-1"><Circle className="h-3 w-3" /> Incomplete</span>
                          }
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
                                onValueChange={(val) => handleUpdateSchedule(asset.id, template.id, val)}
                              >
                                <SelectTrigger className={cn(
                                  "h-9 text-xs transition-all",
                                  isScheduled && template.season === 'spring' && "border-emerald-200 bg-emerald-50 text-emerald-900",
                                  isScheduled && template.season === 'summer' && "border-orange-200 bg-orange-50 text-orange-900",
                                  isScheduled && template.season === 'fall' && "border-amber-200 bg-amber-50 text-amber-900",
                                  isScheduled && template.season === 'winter' && "border-sky-200 bg-sky-50 text-sky-900",
                                )}>
                                  <SelectValue placeholder="Not Scheduled" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none" className="text-xs text-destructive">Not Scheduled</SelectItem>
                                  <Separator className="my-1" />
                                  {months.map((m, i) => (
                                    <SelectItem key={m} value={(i + 1).toString()} className="text-xs">
                                      Due in {m}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg bg-background/50">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-sm font-medium text-muted-foreground">No equipment registered for this site.</p>
                <p className="text-xs text-muted-foreground mt-1">Please register equipment in the Assets & PM section first.</p>
              </div>
            )}
          </CardContent>
        </Card>
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
