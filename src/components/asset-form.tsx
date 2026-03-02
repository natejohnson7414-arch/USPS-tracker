
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Ban } from 'lucide-react';
import type { Asset, WorkSite } from '@/lib/types';
import { getWorkSites } from '@/lib/data';

interface AssetFormProps {
  asset?: Asset | null;
  onCancel?: () => void;
}

export function AssetForm({ asset, onCancel }: AssetFormProps) {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);

  const [formData, setFormData] = useState<Partial<Asset>>({
    name: '',
    assetTag: '',
    serialNumber: '',
    manufacturer: '',
    model: '',
    siteId: '',
    locationDescription: '',
    status: 'active',
    criticality: 'medium',
    installDate: new Date().toISOString(),
    expectedLifeYears: 10,
    replacementCost: 0,
  });

  useEffect(() => {
    if (db) {
      getWorkSites(db).then(setWorkSites);
    }
  }, [db]);

  useEffect(() => {
    if (asset) {
      setFormData(asset);
    }
  }, [asset]);

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
      router.refresh();
    } catch (error) {
      console.error('Error saving asset:', error);
      toast({ title: 'Error saving asset', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-24">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Asset Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Roof Top Unit 1"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assetTag">Asset Tag *</Label>
                <Input
                  id="assetTag"
                  value={formData.assetTag}
                  onChange={(e) => setFormData({ ...formData, assetTag: e.target.value })}
                  placeholder="RTU-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location & Classification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site">Work Site *</Label>
              <Select
                value={formData.siteId}
                onValueChange={(val) => setFormData({ ...formData, siteId: val })}
              >
                <SelectTrigger id="site">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {workSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationDescription">Location Description</Label>
              <Input
                id="locationDescription"
                value={formData.locationDescription}
                onChange={(e) => setFormData({ ...formData, locationDescription: e.target.value })}
                placeholder="e.g. Northeast corner of roof"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                    <SelectItem value="out_of_service">Out of Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="criticality">Criticality</Label>
                <Select
                  value={formData.criticality}
                  onValueChange={(val: any) => setFormData({ ...formData, criticality: val })}
                >
                  <SelectTrigger id="criticality">
                    <SelectValue />
                  </SelectTrigger>
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

        <Card>
          <CardHeader>
            <CardTitle>Lifecycle & Costs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Install Date</Label>
                <DatePicker
                  date={formData.installDate ? new Date(formData.installDate) : undefined}
                  setDate={(date) => setFormData({ ...formData, installDate: date?.toISOString() })}
                />
              </div>
              <div className="space-y-2">
                <Label>Warranty Expiration</Label>
                <DatePicker
                  date={formData.warrantyExpiration ? new Date(formData.warrantyExpiration) : undefined}
                  setDate={(date) => setFormData({ ...formData, warrantyExpiration: date?.toISOString() })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lifeYears">Expected Life (Years)</Label>
                <Input
                  id="lifeYears"
                  type="number"
                  value={formData.expectedLifeYears}
                  onChange={(e) => setFormData({ ...formData, expectedLifeYears: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Replacement Cost ($)</Label>
                <Input
                  id="cost"
                  type="number"
                  value={formData.replacementCost}
                  onChange={(e) => setFormData({ ...formData, replacementCost: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-background border-t shadow-lg z-50">
        <div className="container mx-auto py-4 px-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel || (() => router.back())}
            disabled={isSaving}
          >
            <Ban className="mr-2 h-4 w-4" />
            Cancel
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
