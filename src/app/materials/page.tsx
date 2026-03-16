
'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, PlusCircle, Search, Settings, Loader2, Trash2, Edit, Sparkles, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFirestore, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { getMaterials } from '@/lib/data';
import type { Material } from '@/lib/types';
import { MaterialForm } from '@/components/material-form';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { identifyDuplicates, mergeMaterialsAction, type DuplicateGroup } from '@/lib/material-service';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function MaterialsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<Material | null>(null);

  // Deduplication State
  const [isMerging, setIsMerging] = useState(false);
  const [updateAssetsDuringMerge, setUpdateAssetsDuringMerge] = useState(true);
  const [selectedMasterIds, setSelectedMasterIds] = useState<Record<string, string>>({});

  const fetchMaterials = async () => {
    if (db && user) {
      setIsLoading(true);
      try {
        const fetched = await getMaterials(db);
        setMaterials(fetched);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (db && user) {
      fetchMaterials();
    }
  }, [db, user]);

  const duplicateGroups = useMemo(() => identifyDuplicates(materials), [materials]);

  const handleEdit = (m: Material) => {
    setEditingMaterial(m);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!db || !deletingMaterial) return;
    try {
      await deleteDocumentNonBlocking(doc(db, 'materials', deletingMaterial.id));
      toast({ title: 'Material Deleted' });
      setMaterials(prev => prev.filter(m => m.id !== deletingMaterial.id));
    } catch (error) {
      toast({ title: 'Delete Failed', variant: 'destructive' });
    } finally {
      setDeletingMaterial(null);
    }
  };

  const handleMergeGroup = async (group: DuplicateGroup) => {
    if (!db) return;
    
    const masterId = selectedMasterIds[group.normalizedName];
    if (!masterId) {
      toast({ title: "Please select a master record", variant: 'destructive' });
      return;
    }

    const master = group.materials.find(m => m.id === masterId)!;
    setIsMerging(true);
    
    try {
      await mergeMaterialsAction(db, master, group.materials, updateAssetsDuringMerge);
      toast({ title: "Materials Merged", description: `Standardized to "${master.name}".` });
      fetchMaterials();
    } catch (e) {
      toast({ title: "Merge Failed", variant: 'destructive' });
    } finally {
      setIsMerging(false);
    }
  };

  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.partNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">PM Materials Catalog</h1>
            <p className="text-muted-foreground">Manage parts, belts, filters and other recurring maintenance materials.</p>
          </div>
          {!isFormOpen && (
            <Button onClick={() => { setEditingMaterial(null); setIsFormOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Material
            </Button>
          )}
        </div>

        {isFormOpen ? (
          <div className="mb-12">
            <MaterialForm 
              material={editingMaterial}
              onCancel={() => setIsFormOpen(false)}
              onSaved={() => {
                setIsFormOpen(false);
                fetchMaterials();
              }}
            />
          </div>
        ) : (
          <Tabs defaultValue="catalog">
            <TabsList className="mb-6">
              <TabsTrigger value="catalog">Standard Catalog</TabsTrigger>
              <TabsTrigger value="cleanup" className="gap-2">
                Cleanup Utility
                {duplicateGroups.length > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 min-w-[1.25rem] justify-center">
                    {duplicateGroups.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="catalog">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle>Inventory & Specs</CardTitle>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search catalog..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Material Name</TableHead>
                        <TableHead>Part #</TableHead>
                        <TableHead>Specifications</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8">Loading materials...</TableCell></TableRow>
                      ) : filteredMaterials.length > 0 ? (
                        filteredMaterials.map(m => (
                          <TableRow key={m.id}>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">{m.category}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {m.name}
                              {m.description && <p className="text-xs text-muted-foreground font-normal">{m.description}</p>}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{m.partNumber || 'N/A'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(m.customFields || {}).map(([k, v]) => (
                                  <Badge key={k} variant="outline" className="text-[10px] px-1 h-5">
                                    {k}: {v}
                                  </Badge>
                                ))}
                                {Object.keys(m.customFields || {}).length === 0 && <span className="text-muted-foreground text-xs italic">No extra specs</span>}
                              </div>
                            </TableCell>
                            <TableCell>{m.uom}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(m)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingMaterial(m)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No materials found in the catalog.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cleanup">
              <div className="space-y-6">
                <Alert>
                  <Info className="h-4 w-4" />
                  <CardTitle className="text-sm font-bold">Standardization Utility</CardTitle>
                  <CardDescription className="text-xs">
                    Identify duplicate material names caused by inconsistent casing or spacing. Merge them to standardize your catalog and asset records.
                  </CardDescription>
                </Alert>

                <div className="flex items-center space-x-2 bg-muted/30 p-4 rounded-lg border border-dashed">
                  <Checkbox 
                    id="update-assets" 
                    checked={updateAssetsDuringMerge} 
                    onCheckedChange={(c) => setUpdateAssetsDuringMerge(!!c)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="update-assets" className="text-sm font-bold cursor-pointer">
                      Synchronize Equipment Registry
                    </label>
                    <p className="text-xs text-muted-foreground">
                      When merging, automatically update all existing Assets to use the "Master" name and specifications.
                    </p>
                  </div>
                </div>

                {duplicateGroups.length > 0 ? (
                  <div className="space-y-8">
                    {duplicateGroups.map(group => (
                      <Card key={group.normalizedName} className="border-l-4 border-l-orange-500">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                                Duplicate Group: <span className="font-mono bg-muted px-2 rounded">"{group.normalizedName}"</span>
                              </CardTitle>
                              <CardDescription>
                                Found {group.materials.length} variations in the catalog. Select the preferred "Master" record.
                              </CardDescription>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => handleMergeGroup(group)}
                              disabled={isMerging || !selectedMasterIds[group.normalizedName]}
                            >
                              {isMerging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                              Standardize Group
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="w-[50px]">Master</TableHead>
                                <TableHead>Display Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>UOM</TableHead>
                                <TableHead>Part #</TableHead>
                                <TableHead>Last Updated</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.materials.map(m => (
                                <TableRow 
                                  key={m.id} 
                                  className={selectedMasterIds[group.normalizedName] === m.id ? "bg-primary/5" : ""}
                                  onClick={() => setSelectedMasterIds(prev => ({ ...prev, [group.normalizedName]: m.id }))}
                                >
                                  <TableCell>
                                    <Checkbox 
                                      checked={selectedMasterIds[group.normalizedName] === m.id}
                                      onCheckedChange={() => setSelectedMasterIds(prev => ({ ...prev, [group.normalizedName]: m.id }))}
                                    />
                                  </TableCell>
                                  <TableCell className="font-bold">{m.name}</TableCell>
                                  <TableCell><Badge variant="secondary">{m.category}</Badge></TableCell>
                                  <TableCell>{m.uom}</TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground">{m.partNumber || 'None'}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {m.updatedAt ? format(new Date(m.updatedAt), 'MMM d, yyyy') : 'Legacy'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center border-2 border-dashed rounded-lg bg-muted/10">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-bold">Catalog is Clean</h3>
                    <p className="text-muted-foreground">No duplicate material names found in the current registry.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AlertDialog open={!!deletingMaterial} onOpenChange={(open) => !open && setDeletingMaterial(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Material?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-bold text-foreground">{deletingMaterial?.name}</span> from the catalog? This will not affect existing work orders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
