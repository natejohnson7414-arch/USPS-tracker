
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, PlusCircle, Search, Settings, Loader2, Trash2, Edit, Sparkles, AlertTriangle, CheckCircle2, Info, Ban, Database } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFirestore, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { getMaterials, getAssets } from '@/lib/data';
import type { Material, Asset, AssetMaterial } from '@/lib/types';
import { MaterialForm } from '@/components/material-form';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { identifyDuplicates, mergeMaterialsAction, type DuplicateGroup, type UnifiedMaterial } from '@/lib/material-service';
import { useTechnician } from '@/hooks/use-technician';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function MaterialsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { role, isLoading: isRoleLoading } = useTechnician();
  
  const [catalogMaterials, setCatalogMaterials] = useState<Material[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<Material | null>(null);

  // Deduplication State
  const [isMerging, setIsMerging] = useState(false);
  const [updateAssetsDuringMerge, setUpdateAssetsDuringMerge] = useState(true);
  const [selectedMasterIds, setSelectedMasterIds] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    if (db && user) {
      setIsLoading(true);
      try {
        const [fetchedMaterials, fetchedAssets] = await Promise.all([
          getMaterials(db),
          getAssets(db)
        ]);
        setCatalogMaterials(fetchedMaterials);
        setAssets(fetchedAssets);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [db, user]);

  useEffect(() => {
    if (db && user && role?.name !== 'Technician') {
      fetchData();
    }
  }, [db, user, role, fetchData]);

  /**
   * Unified List: Combines Global Catalog items with materials found only on Assets.
   */
  const unifiedMaterials = useMemo(() => {
    const list: UnifiedMaterial[] = catalogMaterials.map(m => ({
      ...m,
      source: 'catalog'
    }));

    // Extract materials from assets that aren't in the global catalog
    const catalogNames = new Set(catalogMaterials.map(m => m.name.toLowerCase().trim()));
    
    assets.forEach(asset => {
      asset.materials?.forEach(am => {
        const normalizedName = am.name.toLowerCase().trim();
        if (!catalogNames.has(normalizedName)) {
          // Add as a "virtual" material entry for identification/cleanup
          list.push({
            id: `asset-mat-${normalizedName.replace(/\s+/g, '-')}`,
            name: am.name,
            category: am.category,
            uom: am.uom,
            source: 'asset',
            createdAt: asset.createdAt,
            updatedAt: asset.updatedAt
          });
          catalogNames.add(normalizedName); // Only add once per unique name
        }
      });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogMaterials, assets]);

  const duplicateGroups = useMemo(() => identifyDuplicates(unifiedMaterials), [unifiedMaterials]);

  const handleEdit = (m: UnifiedMaterial) => {
    if (m.source === 'asset') {
      // If it's only on an asset, pre-fill a new form to add it to the catalog
      setEditingMaterial({
        id: '',
        name: m.name,
        category: m.category,
        uom: m.uom,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Material);
    } else {
      setEditingMaterial(catalogMaterials.find(cm => cm.id === m.id) || null);
    }
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!db || !deletingMaterial) return;
    try {
      await deleteDocumentNonBlocking(doc(db, 'materials', deletingMaterial.id));
      toast({ title: 'Material Deleted' });
      setCatalogMaterials(prev => prev.filter(m => m.id !== deletingMaterial.id));
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
      toast({ title: "Database Standardized", description: `Merged variations into "${master.name}".` });
      fetchData();
    } catch (e) {
      toast({ title: "Standardization Failed", variant: 'destructive' });
    } finally {
      setIsMerging(false);
    }
  };

  const filteredMaterials = unifiedMaterials.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m as any).partNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isRoleLoading) {
    return (
      <MainLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (role?.name === 'Technician') {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <Ban className="h-16 w-16 text-destructive" />
            <h1 className="text-2xl font-bold">Unauthorized Access</h1>
            <p className="text-muted-foreground">You do not have permission to manage the materials catalog.</p>
            <Button asChild>
              <a href="/">Go to Dashboard</a>
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">PM Materials Catalog</h1>
            <p className="text-muted-foreground">Comprehensive scan of parts catalog and equipment registry.</p>
          </div>
          {!isFormOpen && (
            <Button onClick={() => { setEditingMaterial(null); setIsFormOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add to Catalog
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
                fetchData();
              }}
            />
          </div>
        ) : (
          <Tabs defaultValue="catalog">
            <TabsList className="mb-6">
              <TabsTrigger value="catalog">System Catalog</TabsTrigger>
              <TabsTrigger value="cleanup" className="gap-2">
                Cleanup Utility
                {duplicateGroups.length > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 min-w-[1.25rem] justify-center animate-pulse">
                    {duplicateGroups.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="catalog">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle>Master List</CardTitle>
                      <CardDescription>All materials detected in the system, including those added ad-hoc to assets.</CardDescription>
                    </div>
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
                        <TableHead>Source</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Material Name</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8">Scanning database...</TableCell></TableRow>
                      ) : filteredMaterials.length > 0 ? (
                        filteredMaterials.map(m => (
                          <TableRow key={m.id}>
                            <TableCell>
                              {m.source === 'catalog' ? (
                                <Badge variant="outline" className="gap-1.5 border-green-200 text-green-700 bg-green-50">
                                  <CheckCircle2 className="h-3 w-3" /> Standard
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1.5 border-orange-200 text-orange-700 bg-orange-50">
                                  <Database className="h-3 w-3" /> From Asset
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">{m.category}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {m.name}
                              {(m as any).partNumber && <p className="text-[10px] font-mono text-muted-foreground uppercase">SKU: {(m as any).partNumber}</p>}
                            </TableCell>
                            <TableCell>{m.uom}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(m)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {m.source === 'catalog' && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingMaterial(m as Material)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No materials found in the scan.</TableCell></TableRow>
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
                  <AlertTitle className="text-sm font-bold">Standardization Utility</AlertTitle>
                  <AlertDescription className="text-xs">
                    This utility scans both the global catalog and individual asset records to find variations like <span className="font-mono bg-muted px-1">"20x20x2"</span> vs <span className="font-mono bg-muted px-1">"20X20X2"</span>.
                  </AlertDescription>
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
                      Automatically update every Asset in the system to use the "Master" name and specifications.
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
                                Conflict Group: <span className="font-mono bg-muted px-2 rounded">"{group.normalizedName}"</span>
                              </CardTitle>
                              <CardDescription>
                                Found {group.materials.length} variations. Select the record to use as the standard.
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
                                <TableHead>Source</TableHead>
                                <TableHead>Display Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>UOM</TableHead>
                                <TableHead>Last Updated</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.materials.map(m => (
                                <TableRow 
                                  key={m.id} 
                                  className={cn("cursor-pointer", selectedMasterIds[group.normalizedName] === m.id && "bg-primary/5")}
                                  onClick={() => setSelectedMasterIds(prev => ({ ...prev, [group.normalizedName]: m.id }))}
                                >
                                  <TableCell>
                                    <Checkbox 
                                      checked={selectedMasterIds[group.normalizedName] === m.id}
                                      onCheckedChange={() => setSelectedMasterIds(prev => ({ ...prev, [group.normalizedName]: m.id }))}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {m.source === 'catalog' ? (
                                      <Badge variant="outline" className="text-[8px] h-4 bg-green-50">Catalog</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[8px] h-4 bg-orange-50">Asset</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="font-bold">{m.name}</TableCell>
                                  <TableCell><Badge variant="secondary" className="h-5 text-[10px]">{m.category}</Badge></TableCell>
                                  <TableCell>{m.uom}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {m.updatedAt ? format(new Date(m.updatedAt), 'MMM d, yyyy') : 'N/A'}
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
                    <p className="text-muted-foreground">No variations in material naming were found in the database scan.</p>
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
