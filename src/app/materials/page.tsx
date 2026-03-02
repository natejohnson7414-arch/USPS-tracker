
'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, PlusCircle, Search, Settings, Loader2, Trash2, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFirestore, deleteDocumentNonBlocking } from '@/firebase';
import { getMaterials } from '@/lib/data';
import type { Material } from '@/lib/types';
import { MaterialForm } from '@/components/material-form';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
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
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<Material | null>(null);

  const fetchMaterials = async () => {
    if (db) {
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
    fetchMaterials();
  }, [db]);

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
