
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Ban, PlusCircle, Trash2 } from 'lucide-react';
import type { Material } from '@/lib/types';

interface MaterialFormProps {
  material?: Material | null;
  onCancel?: () => void;
  onSaved?: () => void;
}

const commonCategories = ['Belt', 'Filter', 'Oil', 'Refrigerant', 'Gasket', 'Fuse', 'Other'];

export function MaterialForm({ material, onCancel, onSaved }: MaterialFormProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Material>>({
    name: '',
    category: '',
    partNumber: '',
    description: '',
    uom: 'EA',
    customFields: {},
  });

  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  useEffect(() => {
    if (material) {
      setFormData({
        ...material,
        customFields: material.customFields || {},
      });
    }
  }, [material]);

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
    const updatedFields = { ...formData.customFields };
    delete updatedFields[key];
    setFormData(prev => ({ ...prev, customFields: updatedFields }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    if (!formData.name || !formData.category || !formData.uom) {
      toast({ title: 'Missing required fields', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const data = {
        ...formData,
        updatedAt: new Date().toISOString(),
      };

      if (material?.id) {
        await updateDocumentNonBlocking(doc(db, 'materials', material.id), data);
        toast({ title: 'Material Updated' });
      } else {
        const newData = {
          ...data,
          createdAt: new Date().toISOString(),
        };
        await addDocumentNonBlocking(collection(db, 'materials'), newData);
        toast({ title: 'Material Created' });
      }

      if (onSaved) onSaved();
    } catch (error) {
      console.error('Error saving material:', error);
      toast({ title: 'Error saving material', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Material Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. 20x25x1 Pleated Filter"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <div className="flex gap-2">
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Select or type..."
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {commonCategories.map(cat => (
                    <Button
                      key={cat}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-6 px-2"
                      onClick={() => setFormData({ ...formData, category: cat })}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="uom">UOM *</Label>
                <Input
                  id="uom"
                  value={formData.uom}
                  onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                  placeholder="EA, PK, LB..."
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="partNumber">Part / SKU Number</Label>
              <Input
                id="partNumber"
                value={formData.partNumber}
                onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customized Specifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {Object.entries(formData.customFields || {}).map(([key, value]) => (
                <div key={key} className="flex items-end gap-2 border p-2 rounded-md bg-muted/20">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">{key}</Label>
                    <p className="font-medium text-sm">{value}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRemoveCustomField(key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-3 pt-2">
              <Label>Add New Detail / Missing Data</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Field Name (e.g. Size)"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                />
                <Input
                  placeholder="Value (e.g. 14 inch)"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleAddCustomField}
                disabled={!newFieldName}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Tag Missing Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          <Ban className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {material ? 'Update Material' : 'Create Material'}
        </Button>
      </div>
    </form>
  );
}
