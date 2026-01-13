
'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { List, PlusCircle, MoreHorizontal, Ban } from 'lucide-react';
import { WorkSiteForm } from '@/components/work-site-form';
import type { WorkSite } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useTechnician } from '@/hooks/use-technician';

function WorkSiteItem({ site, onEdit, onDelete }: { site: WorkSite, onEdit: () => void, onDelete: () => void }) {
    return (
        <div className="flex items-center justify-between p-4 border-b">
            <div>
                <p className="font-semibold">{site.name}</p>
                <p className="text-sm text-muted-foreground">{site.address}</p>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Work Site Actions</span>
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                    Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                    Delete
                </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}


export default function WorkSitesPage() {
    const db = useFirestore();
    const { role, isLoading: isRoleLoading } = useTechnician();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<WorkSite | null>(null);
    const [deletingSite, setDeletingSite] = useState<WorkSite | null>(null);
    
    const workSitesQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, 'work_sites'));
    }, [db]);

    const { data: workSites, isLoading: areSitesLoading } = useCollection<WorkSite>(workSitesQuery);

    const handleFormSaved = () => {
        // The useCollection hook will update the list automatically
        setIsFormOpen(false);
        setEditingSite(null);
    }
    
    const handleCancel = () => {
        setIsFormOpen(false);
        setEditingSite(null);
    }
    
    const handleAddNew = () => {
        setEditingSite(null);
        setIsFormOpen(true);
    }
    
    const handleEdit = (site: WorkSite) => {
        setEditingSite(site);
        setIsFormOpen(true);
    }

    const handleDelete = (site: WorkSite) => {
        setDeletingSite(site);
    }
    
    const confirmDelete = () => {
        if (deletingSite && db) {
            const siteRef = doc(db, 'work_sites', deletingSite.id);
            deleteDocumentNonBlocking(siteRef);
            // Optimistic update handled by useCollection
            setDeletingSite(null);
        }
    }

    if (isRoleLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-full">
                    <p>Loading...</p>
                </div>
            </MainLayout>
        )
    }

    if (role?.name === 'Technician') {
        return (
             <MainLayout>
                <div className="container mx-auto py-8 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <Ban className="h-16 w-16 text-destructive" />
                        <h1 className="text-2xl font-bold">Unauthorized Access</h1>
                        <p className="text-muted-foreground">You do not have permission to view this page.</p>
                         <Button asChild>
                            <a href="/">Go to Dashboard</a>
                        </Button>
                    </div>
                </div>
            </MainLayout>
        )
    }


  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between space-y-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Work Sites</h1>
            <p className="text-muted-foreground">
              Manage and create new work site locations.
            </p>
          </div>
           <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Work Site
          </Button>
        </div>
        
        {isFormOpen ? (
            <div className="pb-24">
                <WorkSiteForm 
                    site={editingSite}
                    onFormSaved={handleFormSaved} 
                    onCancel={handleCancel}
                />
            </div>
        ) : (
             <Card>
                <CardHeader>
                    <CardTitle>All Work Sites</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {areSitesLoading ? (
                         <div className="p-6 text-center text-muted-foreground">Loading sites...</div>
                    ) : workSites && workSites.length > 0 ? (
                        <div>
                            {workSites.map(site => (
                                <WorkSiteItem 
                                    key={site.id} 
                                    site={site} 
                                    onEdit={() => handleEdit(site)}
                                    onDelete={() => handleDelete(site)}
                                />)
                            )}
                        </div>
                    ) : (
                         <div className="p-6 text-center text-muted-foreground">
                            <List className="mx-auto h-12 w-12" />
                            <p className="mt-4">No work sites found.</p>
                            <p className="text-sm mt-2">Get started by adding a new work site.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        )}
      </div>

       <AlertDialog open={!!deletingSite} onOpenChange={(open) => !open && setDeletingSite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the work site
              for <span className="font-bold">{deletingSite?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
