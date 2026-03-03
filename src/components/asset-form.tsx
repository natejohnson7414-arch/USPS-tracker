
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Ban, PlusCircle, Trash2, CalendarClock, Clock, Wrench } from 'lucide-react';
import type { Asset, WorkSite, AssetMaterial } from '@/lib/types';
import { getWorkSites } from '@/lib/data';
import { Separator } from '@/components/ui/separator';

interface AssetFormProps {
  asset?: Asset | null;
  onCancel?: () => void;
}

const commonCategories = ['Filter', 'Belt', 'Oil', 'Refrigerant', 'Gasket', 'Fuse', 'Other'];
const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function AssetFormInner({ asset, onCancel }: AssetFormProps) {
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const siteIdFromQuery = searchParams.get('siteId') || '';

  const [isSaving, setIsSaving] = useState(false);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);

  const [formData, setFormData] = useState<Partial<Asset>>({
    name: '',
    assetTag: '',
    serialNumber: '',
    manufacturer: '',
    model: '',
    siteId: siteIdFromQuery,
    locationDescription: '',
    status: 'active',
    criticality: 'medium',
    installDate: new Date().toISOString(),
    expectedLifeYears: 10,
    replacementCost: 0,
    pmFrequency: 'none',
    pmLaborHours: 0,
    pmMonth: new Date().getMonth() + 1,
    customFields: {},
    materials: [],
  });

  // Local state for adding new items
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState('Filter');
  const [newMatQty, setNewMatQty] = useState('1');
  const [newMatUom, setNewMatUom] = useState('EA');

  useEffect(() => {
    if (db) {
      getWorkSites(db).then(setWorkSites);
    }
  }, [db]);

  useEffect(() => {
    if (asset) {
      setFormData({
        ...asset,
        customFields: asset.customFields || {},
        materials: asset.materials || [],
        pmFrequency: asset.pmFrequency || 'none',
        pmLaborHours: asset.pmLaborHours || 0,
        pmMonth: asset.pmMonth || new Date().getMonth() + 1,
      });
    }
  }, [asset]);

  const handleAddCustomField = () => {
    if (!newFieldName) return;
    setFormData(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [newFieldName]: newFieldValue,
      }
    }));
    setNewFieldName('');
    setNewFieldValue('');
  };

  const handleRemoveCustomField = (key: string) => {
    const updated = { ...formData.customFields };
    delete updated[key];
    setFormData(prev => ({ ...prev, customFields: updated }));
  };

  const handleAddMaterial = () => {
    if (!newMatName) return;
    const newMat: AssetMaterial = {
      name: newMatName,
      category: newMatCategory,
      quantity: parseFloat(newMatQty) || 1,
      uom: newMatUom
    };
    setFormData(prev => ({
      ...prev,
      materials: [...(prev.materials || []), newMat]
    }));
    setNewMatName('');
    setNewMatQty('1');
    setNewMatUom('EA');
  };

  const handleRemoveMaterial = (index: number) => {
    setFormData(prev => ({
      ...prev,
      materials: (prev.materials || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    if (!formData.name || !formData.assetTag || !formData.siteId) {
      toast({ title: 'Missing required fields', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const data = {
        ...formData,
        updatedAt: new Date().toISOString(),
      };

      if (asset?.id) {
        await updateDocumentNonBlocking(doc(db, 'assets', asset.id), data);
        toast({ title: 'Asset Updated' });
      } else {
        const newData = {
          ...data,
          createdAt: new Date().toISOString(),
        };
        await addDocumentNonBlocking(collection(db, 'assets'), newData);
        toast({ title: 'Asset Created' });
      }

      router.push('/assets');
    } catch (error) {
      console.error('Error saving asset:', error);
      toast({ title: 'Error saving asset', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Asset Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Roof Top Unit 1" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assetTag">Asset Tag *</Label>
                  <Input id="assetTag" value={formData.assetTag} onChange={(e) => setFormData({ ...formData, assetTag: e.target.value })} placeholder="RTU-001" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input id="serialNumber" value={formData.serialNumber} onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input id="manufacturer" value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Location & Classification</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="site">Work Site *</Label>
                <Select value={formData.siteId} onValueChange={(val) => setFormData({ ...formData, siteId: val })}>
                  <SelectTrigger id="site"><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>{workSites.map((site) => (<SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationDescription">Location Description</Label>
                <Input id="locationDescription" value={formData.locationDescription} onChange={(e) => setFormData({ ...formData, locationDescription: e.target.value })} placeholder="e.g. Northeast corner of roof" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                      <SelectItem value="out_of_service">Out of Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="criticality">Criticality</Label>
                  <Select value={formData.criticality} onValueChange={(val: any) => setFormData({ ...formData, criticality: val })}>
                    <SelectTrigger id="criticality"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                Maintenance Planning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>PM Frequency</Label>
                  <Select value={formData.pmFrequency} onValueChange={(val: any) => setFormData({ ...formData, pmFrequency: val })}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Repair Only)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="semiannual">Semi-Annual</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Anchor Month</Label>
                  <Select 
                    value={formData.pmMonth?.toString()} 
                    onValueChange={(val) => setFormData({ ...formData, pmMonth: parseInt(val) })}
                    disabled={formData.pmFrequency === 'none'}
                  >
                    <SelectTrigger className="bg-background">
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
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Wrench className="h-3 w-3" /> Est. Labor Hours per Cycle</Label>
                <Input 
                  type="number" 
                  step="0.5" 
                  className="bg-background"
                  value={formData.pmLaborHours} 
                  onChange={(e) => setFormData({ ...formData, pmLaborHours: parseFloat(e.target.value) || 0 })}
                  disabled={formData.pmFrequency === 'none'}
                />
                <p className="text-[10px] text-muted-foreground">This value is used for site-wide labor demand forecasting.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle>PM Materials (Filters, Belts, etc.)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {formData.materials?.map((mat, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 border rounded-md bg-muted/20">
                    <div className="text-sm">
                      <span className="font-bold">{mat.quantity} {mat.uom}</span> - {mat.name} <span className="text-xs text-muted-foreground">({mat.category})</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveMaterial(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs uppercase text-muted-foreground">Add Required Material</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Name</Label>
                    <Input placeholder="e.g. 20x25x1 Filter" value={newMatName} onChange={(e) => setNewMatName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Type</Label>
                    <Select value={newMatCategory} onValueChange={setNewMatCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {commonCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Qty</Label>
                    <Input type="number" placeholder="Qty" value={newMatQty} onChange={(e) => setNewMatQty(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">UOM</Label>
                    <Input placeholder="UOM" value={newMatUom} onChange={(e) => setNewMatUom(e.target.value)} />
                  </div>
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={handleAddMaterial} disabled={!newMatName}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Material
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Custom Specifications (Tag Missing Data)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {Object.entries(formData.customFields || {}).map(([key, value]) => (
                  <div key={key} className="flex items-end gap-2 border p-2 rounded-md bg-muted/20">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">{key}</Label>
                      <p className="font-medium text-sm">{value}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveCustomField(key)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs uppercase text-muted-foreground">Add Custom Field</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Field Name (e.g. Phase)" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} />
                  <Input placeholder="Value (e.g. 3 Phase)" value={newFieldValue} onChange={(e) => setNewFieldValue(e.target.value)} />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={handleAddCustomField} disabled={!newFieldName}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Tag Custom Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-background border-t shadow-lg z-50">
        <div className="container mx-auto py-4 px-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel || (() => router.back())} disabled={isSaving}>
            <Ban className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {asset ? 'Update Asset' : 'Create Asset'}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function AssetForm(props: AssetFormProps) {
  return (
    <Suspense fallback={<div className="p-12 text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" /><p className="mt-4 text-muted-foreground">Loading form...</p></div>}>
      <AssetFormInner {...props} />
    </Suspense>
  );
}
