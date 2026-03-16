'use client';

import { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { uploadPhotoWithThumbnail, deletePhotoMetadata } from '@/firebase/storage';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Ban, PlusCircle, Trash2, CalendarClock, Wrench, Camera, X } from 'lucide-react';
import type { Asset, WorkSite, AssetMaterial, PhotoMetadata } from '@/lib/types';
import { getWorkSites, getMaterials, getAssets } from '@/lib/data';
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
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [materialSuggestions, setMaterialSuggestions] = useState<{name: string, category: string, uom: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialFormData = useMemo(() => {
    if (asset) {
      return {
        ...asset,
        name: asset.name || '',
        assetTag: asset.assetTag || '',
        serialNumber: asset.serialNumber || '',
        manufacturer: asset.manufacturer || '',
        model: asset.model || '',
        siteId: asset.siteId || '',
        locationDescription: asset.locationDescription || '',
        notes: asset.notes || '',
        status: asset.status || 'active',
        criticality: asset.criticality || 'medium',
        installDate: asset.installDate || new Date().toISOString(),
        expectedLifeYears: asset.expectedLifeYears ?? 10,
        replacementCost: asset.replacementCost ?? 0,
        pmFrequency: asset.pmFrequency || 'none',
        pmLaborHours: asset.pmLaborHours ?? 0,
        pmMonth: asset.pmMonth ?? new Date().getMonth() + 1,
        customFields: asset.customFields || {},
        materials: asset.materials || [],
        photoUrls: asset.photoUrls || [],
      };
    }
    return {
      name: '',
      assetTag: '',
      serialNumber: '',
      manufacturer: '',
      model: '',
      siteId: searchParams.get('siteId') || '',
      locationDescription: '',
      notes: '',
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
      photoUrls: [],
    };
  }, [asset, searchParams]);

  const [formData, setFormData] = useState<Partial<Asset>>(initialFormData);

  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState<string>('ALL');
  const [newMatQty, setNewMatQty] = useState('1');
  const [newMatUom, setNewMatUom] = useState('EA');

  useEffect(() => {
    if (db) {
      getWorkSites(db).then(setWorkSites);
      
      const loadSuggestions = async () => {
        try {
          const [catalog, allAssets] = await Promise.all([
            getMaterials(db),
            getAssets(db)
          ]);
          
          const suggestions = new Map<string, {name: string, category: string, uom: string}>();
          
          catalog.forEach(m => {
            suggestions.set(m.name.toLowerCase(), { name: m.name, category: m.category, uom: m.uom });
          });
          
          allAssets.forEach(a => {
            a.materials?.forEach(m => {
              if (!suggestions.has(m.name.toLowerCase())) {
                suggestions.set(m.name.toLowerCase(), { name: m.name, category: m.category, uom: m.uom });
              }
            });
          });
          
          setMaterialSuggestions(Array.from(suggestions.values()).sort((a, b) => a.name.localeCompare(b.name)));
        } catch (e) {
          console.error("Failed to load material suggestions", e);
        }
      };
      
      loadSuggestions();
    }
  }, [db]);

  const allCategories = useMemo(() => {
    const suggestionCats = materialSuggestions.map(m => m.category);
    return Array.from(new Set([...commonCategories, ...suggestionCats])).filter(Boolean).sort();
  }, [materialSuggestions]);

  const filteredSuggestions = useMemo(() => {
    if (!newMatCategory || newMatCategory === 'ALL') return materialSuggestions;
    return materialSuggestions.filter(m => m.category === newMatCategory);
  }, [materialSuggestions, newMatCategory]);

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
    
    let finalCategory = newMatCategory === 'ALL' ? 'Other' : newMatCategory;
    const match = materialSuggestions.find(m => m.name.toLowerCase() === newMatName.toLowerCase());
    if (match) {
      finalCategory = match.category;
    }

    const newMat: AssetMaterial = {
      name: newMatName,
      category: finalCategory,
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingPhotos(true);
    const toastId = toast({ title: `Processing ${files.length} photo(s)...`, duration: Infinity });

    try {
      let i = 0;
      for (const file of Array.from(files)) {
        i++;
        const basePath = `assets/${formData.assetTag || 'new'}`;
        const fileName = `${Date.now()}-${file.name}`;
        
        toastId.update({ 
          id: toastId.id, 
          title: `Photo ${i}/${files.length}`,
          description: `Transferring ${file.name}...` 
        });

        const result = await uploadPhotoWithThumbnail(file, basePath, fileName);
        
        // Update local form state sequentially
        setFormData(prev => ({
          ...prev,
          photoUrls: [...(prev.photoUrls || []), result]
        }));
      }

      toastId.dismiss();
      toast({ title: "Photos Ready" });
    } catch (error: any) {
      console.error("Asset form upload failed:", error);
      toastId.dismiss();
      
      let errorDescription = "Transfer failed. Please check your connection.";
      if (error.code === 'storage/unauthorized') {
        errorDescription = "Access denied. Your session may have expired.";
      } else if (error.code === 'storage/canceled') {
        errorDescription = "The upload timed out. Try fewer photos at once.";
      } else if (error.message) {
        errorDescription = error.message;
      }

      toast({ 
        title: "Upload Failed", 
        variant: "destructive",
        description: errorDescription
      });
    } finally {
      setIsUploadingPhotos(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async (photo: string | PhotoMetadata) => {
    const targetUrl = typeof photo === 'string' ? photo : photo.url;
    setFormData(prev => ({
      ...prev,
      photoUrls: (prev.photoUrls || []).filter(p => (typeof p === 'string' ? p : p.url) !== targetUrl)
    }));
    try {
      await deletePhotoMetadata(photo);
    } catch (e) {
      console.warn("Could not delete from storage, but removed from form.");
    }
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

      router.back();
    } catch (error) {
      console.error('Error saving asset:', error);
      toast({ title: 'Error saving asset', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const getThumbUrl = (p: string | PhotoMetadata) => typeof p === 'string' ? p : p.thumbnailUrl || p.url;

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Asset Name *</Label>
                <Input id="name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Roof Top Unit 1" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assetTag">Asset Tag *</Label>
                  <Input id="assetTag" value={formData.assetTag || ''} onChange={(e) => setFormData({ ...formData, assetTag: e.target.value })} placeholder="RTU-001" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input id="serialNumber" value={formData.serialNumber || ''} onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input id="manufacturer" value={formData.manufacturer || ''} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" value={formData.model || ''} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

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
                    <Label className="text-[10px]">Type</Label>
                    <Select value={newMatCategory} onValueChange={setNewMatCategory}>
                      <SelectTrigger><SelectValue placeholder="Filter type..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Types</SelectItem>
                        {allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Name</Label>
                    <Input 
                      placeholder="Type to search..." 
                      value={newMatName} 
                      list="asset-material-datalist"
                      autoComplete="off"
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewMatName(val);
                        const match = materialSuggestions.find(m => m.name.toLowerCase() === val.toLowerCase());
                        if (match) {
                          setNewMatUom(match.uom);
                          if (newMatCategory === 'ALL' || newMatCategory !== match.category) {
                            setNewMatCategory(match.category);
                          }
                        }
                      }} 
                    />
                    <datalist id="asset-material-datalist">
                      {filteredSuggestions.map((m, i) => (
                        <option key={`${m.name}-${i}`} value={m.name}>
                          {m.category}
                        </option>
                      ))}
                    </datalist>
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
            <CardHeader><CardTitle>Equipment Photos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {formData.photoUrls?.map((photo, idx) => (
                  <div key={idx} className="relative aspect-square rounded-md overflow-hidden border">
                    <Image src={getThumbUrl(photo)} alt={`Asset photo ${idx + 1}`} fill sizes="150px" className="object-cover" />
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="icon" 
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => handleRemovePhoto(photo)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhotos}
                  className="aspect-square border-2 border-dashed rounded-md flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  {isUploadingPhotos ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <Camera className="h-6 w-6 mb-2" />
                      <span className="text-[10px] uppercase font-bold">Add Photo</span>
                    </>
                  )}
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                multiple 
                accept="image/*" 
                className="hidden" 
                onChange={handlePhotoUpload} 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Location & Classification</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="site">Work Site *</Label>
                <Select value={formData.siteId || ''} onValueChange={(val) => setFormData({ ...formData, siteId: val })}>
                  <SelectTrigger id="site"><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>{workSites.map((site) => (<SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationDescription">Location Description</Label>
                <Input id="locationDescription" value={formData.locationDescription || ''} onChange={(e) => setFormData({ ...formData, locationDescription: e.target.value })} placeholder="e.g. Northeast corner of roof" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status || 'active'} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
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
                  <Select value={formData.criticality || 'medium'} onValueChange={(val: any) => setFormData({ ...formData, criticality: val })}>
                    <SelectTrigger id="criticality"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Asset Notes</Label>
                <Textarea 
                  id="notes" 
                  value={formData.notes || ''} 
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                  placeholder="Record any specific asset notes here (access, safety, etc.)"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
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
                  <Select value={formData.pmFrequency || 'none'} onValueChange={(val: any) => setFormData({ ...formData, pmFrequency: val })}>
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
                    value={formData.pmMonth?.toString() || ''} 
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
                  value={formData.pmLaborHours || 0} 
                  onChange={(e) => setFormData({ ...formData, pmLaborHours: parseFloat(e.target.value) || 0 })}
                  disabled={formData.pmFrequency === 'none'}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Customized Specifications (Tag Missing Data)</CardTitle></CardHeader>
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
              <div className="space-y-3 pt-2">
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
