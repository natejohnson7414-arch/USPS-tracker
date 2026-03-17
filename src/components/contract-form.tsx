
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from './ui/date-picker';
import { useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Ban, CalendarClock, Package, PlusCircle, Trash2, Sparkles, Wrench, Clock, Info } from 'lucide-react';
import type { MaintenanceContract, WorkSite, Asset, PmTaskTemplate, PmSchedule } from '@/lib/types';
import { getAssetsBySiteId, getPmTaskTemplates, getPmSchedulesForAsset, savePmSchedule } from '@/lib/data';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
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

export function ContractForm({ contract, workSites, onCancel, onSaved }: ContractFormProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [siteAssets, setSiteAssets] = useState<Asset[]>([]);
  const [pmTemplates, setPmTemplates] = useState<PmTaskTemplate[]>([]);
  const [assetSchedules, setAssetSchedules] = useState<Record<string, PmSchedule[]>>({});
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);

  const [formData, setFormData] = useState<Partial<MaintenanceContract>>(() => {
    if (contract) return { ...contract };
    return {
      siteId: '',
      contractNumber: '',
      startDate: new Date().toISOString(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
      status: 'active',
      notes: '',
    };
  });

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

  const handleAddSchedule = async (assetId: string, templateId: string, month: number) => {
    if (!db) return;
    const template = pmTemplates.find(t => t.id === templateId);
    if (!template) return;

    const newSchedule: Omit<PmSchedule, 'id'> = {
      templateId,
      templateName: template.name,
      season: template.season,
      dueMonth: month,
      recurrence: 'yearly',
      active: true,
    };

    try {
      await savePmSchedule(db, assetId, newSchedule);
      toast({ title: 'PM Cycle Added' });
      loadSitePlanningData(formData.siteId!);
    } catch (e) {
      toast({ title: 'Failed to add cycle', variant: 'destructive' });
    }
  };

  const handleDeleteSchedule = async (assetId: string, scheduleId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'assets', assetId, 'pmSchedules', scheduleId));
      toast({ title: 'PM Cycle Removed' });
      loadSitePlanningData(formData.siteId!);
    } catch (e) {
      toast({ title: 'Failed to remove cycle', variant: 'destructive' });
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
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CalendarClock className="h-5 w-5" />
                  Site PM Planning & Seasonal Tasking
                </CardTitle>
                <CardDescription>Coordinate preventative maintenance cycles for registered equipment at this site.</CardDescription>
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
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold">{asset.name}</p>
                            <p className="text-[10px] font-mono uppercase text-muted-foreground">TAG: {asset.assetTag}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select onValueChange={(val) => {
                            const [tid, month] = val.split(':');
                            handleAddSchedule(asset.id, tid, parseInt(month));
                          }}>
                            <SelectTrigger className="w-[200px] h-8 text-xs">
                              <PlusCircle className="h-3 w-3 mr-2" />
                              <SelectValue placeholder="Schedule New Cycle" />
                            </SelectTrigger>
                            <SelectContent>
                              {pmTemplates.map(t => (
                                <SelectGroup key={t.id}>
                                  <SelectLabel className="text-[10px] uppercase font-black text-muted-foreground px-2 py-1.5">{t.name} ({t.season})</SelectLabel>
                                  {[3, 6, 9, 12].map(m => (
                                    <SelectItem key={`${t.id}-${m}`} value={`${t.id}:${m}`} className="text-xs">
                                      Due in {months[m-1]}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {schedules.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {schedules.map(sch => (
                            <div key={sch.id} className="relative group p-3 rounded-md border border-dashed flex flex-col gap-1.5 hover:bg-muted/30 transition-colors">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className={cn(
                                  "text-[8px] uppercase font-bold",
                                  sch.season === 'spring' && "text-emerald-600 border-emerald-200 bg-emerald-50",
                                  sch.season === 'summer' && "text-orange-600 border-orange-200 bg-orange-50",
                                  sch.season === 'fall' && "text-amber-700 border-amber-200 bg-amber-50",
                                  sch.season === 'winter' && "text-sky-600 border-sky-200 bg-sky-50"
                                )}>
                                  {sch.season} Cycle
                                </Badge>
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteSchedule(asset.id, sch.id);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <p className="text-xs font-bold">{sch.templateName}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>Due: {months[sch.dueMonth - 1]}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground italic bg-muted/20 p-2 rounded border border-dashed">
                          <Info className="h-3.5 w-3.5" />
                          No repeatable maintenance scheduled for this unit.
                        </div>
                      )}
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

// Helper components for Select
const SelectGroup = ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={cn("py-1", className)}>{children}</div>;
const SelectLabel = ({ children, className }: { children: React.ReactNode, className?: string }) => <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>{children}</div>;
