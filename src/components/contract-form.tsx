
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from './ui/date-picker';
import { useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Ban } from 'lucide-react';
import type { MaintenanceContract, WorkSite } from '@/lib/types';

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
      setFormData(contract);
    }
  }, [contract]);

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
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site">Select Work Site *</Label>
              <Select value={formData.siteId} onValueChange={(val) => setFormData({ ...formData, siteId: val })}>
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
                value={formData.contractNumber}
                onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                placeholder="e.g. MC-2024-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Agreement Status</Label>
              <Select value={formData.status} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
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
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                placeholder="Scope details, exclusions, or billing terms..."
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t pt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            <Ban className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {contract ? 'Update Contract' : 'Save Agreement'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
