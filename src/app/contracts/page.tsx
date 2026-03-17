
'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, PlusCircle, Search, Loader2, Trash2, Edit, CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFirestore, useUser, deleteDocumentNonBlocking } from '@/firebase';
import { getContracts, getWorkSites } from '@/lib/data';
import type { MaintenanceContract, WorkSite } from '@/lib/types';
import { ContractForm } from '@/components/contract-form';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
import { format } from 'date-fns';
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

export default function ContractsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<MaintenanceContract[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<MaintenanceContract | null>(null);
  const [deletingContract, setDeletingContract] = useState<MaintenanceContract | null>(null);

  const fetchData = async () => {
    if (db && user) {
      setIsLoading(true);
      try {
        const [fetchedContracts, fetchedSites] = await Promise.all([
          getContracts(db),
          getWorkSites(db)
        ]);
        setContracts(fetchedContracts);
        setWorkSites(fetchedSites);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [db, user]);

  const handleEdit = (c: MaintenanceContract) => {
    setEditingContract(c);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!db || !deletingContract) return;
    try {
      await deleteDocumentNonBlocking(doc(db, 'contracts', deletingContract.id));
      toast({ title: 'Contract Deleted' });
      setContracts(prev => prev.filter(c => c.id !== deletingContract.id));
    } catch (error) {
      toast({ title: 'Delete Failed', variant: 'destructive' });
    } finally {
      setDeletingContract(null);
    }
  };

  const filteredContracts = contracts.filter(c => 
    c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.siteName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Maintenance Contracts</h1>
            <p className="text-muted-foreground">Manage service agreements. Only sites with active contracts will auto-generate PMs.</p>
          </div>
          {!isFormOpen && (
            <Button onClick={() => { setEditingContract(null); setIsFormOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Contract
            </Button>
          )}
        </div>

        {isFormOpen ? (
          <div className="mb-12">
            <ContractForm 
              key={editingContract?.id || 'new'}
              contract={editingContract}
              workSites={workSites}
              onCancel={() => setIsFormOpen(false)}
              onSaved={() => {
                setIsFormOpen(false);
                fetchData();
              }}
            />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Agreement Registry</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contracts..."
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
                    <TableHead>Status</TableHead>
                    <TableHead>Contract #</TableHead>
                    <TableHead>Work Site</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">Loading contracts...</TableCell></TableRow>
                  ) : filteredContracts.length > 0 ? (
                    filteredContracts.map(c => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold">{c.contractNumber}</TableCell>
                        <TableCell className="font-medium">{c.siteName || 'Unknown Site'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs">
                            <CalendarDays className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(c.startDate), 'MM/dd/yy')} - {format(new Date(c.endDate), 'MM/dd/yy')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingContract(c)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No maintenance contracts found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deletingContract} onOpenChange={(open) => !open && setDeletingContract(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove contract <span className="font-bold text-foreground">{deletingContract?.contractNumber}</span>? 
              This will disable automatic PM generation for this site.
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
