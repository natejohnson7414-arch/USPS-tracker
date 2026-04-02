'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { List, PlusCircle, MoreHorizontal, Ban, Search, MapPin, AlertTriangle, CheckCircle2, Loader2, Sparkles, Info } from 'lucide-react';
import { WorkSiteForm } from '@/components/work-site-form';
import type { WorkSite } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { identifyDuplicateSites, mergeSitesAction, type DuplicateSiteGroup } from '@/lib/site-service';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function WorkSiteItem({ site, onEdit, onDelete }: { site: WorkSite, onEdit: () => void, onDelete: () => void }) {
    return (
        <div className="flex items-center justify-between p-4 border-b hover:bg-muted/50 transition-colors">
            <Link href={`/work-sites/${site.id}`} className="flex-1">
                <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p className="font-semibold">{site.name}</p>
                        <p className="text-sm text-muted-foreground">{site.address}</p>
                    </div>
                </div>
            </Link>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Work Site Actions</span>
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link href={`/work-sites/${site.id}`}>View Details</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                    Edit Info
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
    const { user } = useUser();
    const { toast } = useToast();
    const { role, isLoading: isRoleLoading } = useTechnician();
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<WorkSite | null>(null);
    const [deletingSite, setDeletingSite] = useState<WorkSite | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name');
    
    // Merge Logic State
    const [isMerging, setIsMerging] = useState(false);
    const [selectedMasterIds, setSelectedMasterIds] = useState<Record<string, string>>({});

    const workSitesQuery = useMemoFirebase(() => {
        if (!db || !user) return null;
        return query(collection(db, 'work_sites'), orderBy('name', 'asc'));
    }, [db, user]);

    const { data: workSites, isLoading: areSitesLoading } = useCollection<WorkSite>(workSitesQuery);
    
    const filteredAndSortedSites = useMemo(() => {
        if (!workSites) return [];

        const lowercasedSearchTerm = searchTerm.toLowerCase();
        
        const filtered = workSites.filter(site =>
            (site.name?.toLowerCase().includes(lowercasedSearchTerm) || '') ||
            (site.address?.toLowerCase().includes(lowercasedSearchTerm) || '') ||
            (site.city?.toLowerCase().includes(lowercasedSearchTerm) || '') ||
            (site.state?.toLowerCase().includes(lowercasedSearchTerm) || '')
        );

        return filtered.sort((a, b) => {
            const fieldA = (a[sortBy as keyof WorkSite] as string | undefined)?.toLowerCase() || '';
            const fieldB = (b[sortBy as keyof WorkSite] as string | undefined)?.toLowerCase() || '';
            if (fieldA < fieldB) return -1;
            if (fieldA > fieldB) return 1;
            return 0;
        });

    }, [workSites, searchTerm, sortBy]);

    const duplicateGroups = useMemo(() => {
        if (!workSites) return [];
        return identifyDuplicateSites(workSites);
    }, [workSites]);

    const handleFormSaved = () => {
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
            setDeletingSite(null);
        }
    }

    const handleMergeGroup = async (group: DuplicateSiteGroup) => {
        if (!db) return;
        
        const masterId = selectedMasterIds[group.normalizedLocation];
        if (!masterId) {
            toast({ title: "Please select a master record", variant: 'destructive' });
            return;
        }

        const master = group.sites.find(s => s.id === masterId)!;
        setIsMerging(true);
        
        try {
            await mergeSitesAction(db, master, group.sites);
            toast({ title: "Sites Consolidated", description: `Merged duplicates into "${master.name}". All related records updated.` });
        } catch (e) {
            toast({ title: "Consolidation Failed", variant: 'destructive' });
        } finally {
            setIsMerging(false);
        }
    };

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
              Manage facilities and location-based data.
            </p>
          </div>
           {!isFormOpen && (
             <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Work Site
            </Button>
           )}
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
            <Tabs defaultValue="list">
                <TabsList className="mb-6">
                    <TabsTrigger value="list">Registry List</TabsTrigger>
                    <TabsTrigger value="cleanup" className="gap-2">
                        Cleanup Utility
                        {duplicateGroups.length > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 min-w-[1.25rem] justify-center animate-pulse">
                                {duplicateGroups.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="list">
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="relative w-full sm:w-auto">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, address..."
                                className="pl-8 sm:w-[300px]"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name">Sort by Name</SelectItem>
                                <SelectItem value="city">Sort by City</SelectItem>
                                <SelectItem value="state">Sort by State</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>All Work Sites</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {areSitesLoading ? (
                                 <div className="p-6 text-center text-muted-foreground">Loading sites...</div>
                            ) : filteredAndSortedSites && filteredAndSortedSites.length > 0 ? (
                                <div className="divide-y">
                                    {filteredAndSortedSites.map(site => (
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
                                    <p className="text-sm mt-2">Get started by adding a new work site, or try adjusting your search.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cleanup">
                    <div className="space-y-6">
                        <Alert className="bg-orange-50 border-orange-200">
                            <Info className="h-4 w-4 text-orange-600" />
                            <AlertTitle className="text-sm font-bold text-orange-900">Consolidation Utility</AlertTitle>
                            <AlertDescription className="text-xs text-orange-800">
                                This utility scans for sites with identical addresses. Merging will update all related <strong>Work Orders</strong>, <strong>PMs</strong>, and <strong>Assets</strong> to the master record.
                            </AlertDescription>
                        </Alert>

                        {duplicateGroups.length > 0 ? (
                            <div className="space-y-8">
                                {duplicateGroups.map(group => (
                                    <Card key={group.normalizedLocation} className="border-l-4 border-l-orange-500">
                                        <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <CardTitle className="text-lg flex items-center gap-2">
                                                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                                                        Conflict: <span className="font-mono bg-muted px-2 rounded">"{group.normalizedLocation}"</span>
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Found {group.sites.length} site records for this location.
                                                    </CardDescription>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => handleMergeGroup(group)}
                                                    disabled={isMerging || !selectedMasterIds[group.normalizedLocation]}
                                                >
                                                    {isMerging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                                    Merge & Update Records
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="w-[50px]">Master</TableHead>
                                                        <TableHead>Site Name</TableHead>
                                                        <TableHead>Address</TableHead>
                                                        <TableHead>ID Type</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.sites.map(s => (
                                                        <TableRow 
                                                            key={s.id} 
                                                            className={cn("cursor-pointer", selectedMasterIds[group.normalizedLocation] === s.id && "bg-primary/5")}
                                                            onClick={() => setSelectedMasterIds(prev => ({ ...prev, [group.normalizedLocation]: s.id }))}
                                                        >
                                                            <TableCell>
                                                                <Checkbox 
                                                                    checked={selectedMasterIds[group.normalizedLocation] === s.id}
                                                                    onCheckedChange={() => setSelectedMasterIds(prev => ({ ...prev, [group.normalizedLocation]: s.id }))}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="font-bold">{s.name}</TableCell>
                                                            <TableCell className="text-xs">{s.address}, {s.city}, {s.state}</TableCell>
                                                            <TableCell>
                                                                {s.id.includes('-') ? (
                                                                    <Badge variant="outline" className="text-[8px] h-4 bg-green-50">Standard ID</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[8px] h-4 bg-orange-50">Legacy ID</Badge>
                                                                )}
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
                                <h3 className="text-lg font-bold">Registry is Clean</h3>
                                <p className="text-muted-foreground">No duplicate site addresses were found.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
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
