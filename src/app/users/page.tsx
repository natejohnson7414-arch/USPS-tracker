'use client';
import { MainLayout } from '@/components/main-layout';
import { UsersTable } from '@/components/users-table';
import { getUsers, getRoles } from '@/lib/data';
import type { AppUser, Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Ban, Database, Loader2, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { UserEditDialog } from '@/components/user-edit-dialog';
import { useFirestore, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { doc } from 'firebase/firestore';
import { useTechnician } from '@/hooks/use-technician';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { backfillThumbnails, type MigrationProgress } from '@/lib/migration-service';

export default function UsersPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { role, isLoading: isRoleLoading } = useTechnician();
  
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);

  // Migration State
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);

  const fetchAndSetData = async () => {
    if (!db || !user) return;
    setIsLoading(true);
    try {
      const fetchedRoles = await getRoles(db);
      setRoles(fetchedRoles);
      const fetchedUsers = await getUsers(db, fetchedRoles);
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch user and role data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (db && user && role?.name !== 'Technician') {
        fetchAndSetData();
    } else if (role?.name === 'Technician') {
        setIsLoading(false);
    }
  }, [db, user, role]);

  const handleRunMigration = async () => {
    if (!db) return;
    setIsMigrating(true);
    try {
      await backfillThumbnails(db, (p) => setMigrationProgress(p));
    } finally {
      setIsMigrating(false);
    }
  };

  const handleUserSaved = () => {
    fetchAndSetData();
    setEditingUser(null);
  };

  const handleEditUser = (user: AppUser) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };
  
  const handleAddNewUser = () => {
    setEditingUser(null);
    setIsEditDialogOpen(true);
  }
  
  const handleDeleteUser = (user: AppUser) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = () => {
    if (deletingUser) {
        const userRef = doc(db, 'technicians', deletingUser.id);
        deleteDocumentNonBlocking(userRef);
        setUsers(users.filter(u => u.id !== deletingUser.id));
        setDeletingUser(null);
        setIsDeleteDialogOpen(false);
    }
  };

  const handleToggleDisableUser = (user: AppUser) => {
    const userRef = doc(db, 'technicians', user.id);
    const newDisabledState = !user.disabled;
    updateDocumentNonBlocking(userRef, { disabled: newDisabledState });
    setUsers(users.map(u => u.id === user.id ? { ...u, disabled: newDisabledState } : u));
  };

  if (isLoading || isRoleLoading) {
    return (
        <MainLayout>
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
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
            <h1 className="text-3xl font-bold tracking-tight">System Administration</h1>
            <p className="text-muted-foreground">Manage users, roles, and system maintenance tasks.</p>
          </div>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="mb-8">
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="maintenance">System Maintenance</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="flex justify-end mb-4">
              <Button onClick={handleAddNewUser}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>
            <UsersTable 
              users={users} 
              onEditUser={handleEditUser} 
              onDeleteUser={handleDeleteUser}
              onToggleDisableUser={handleToggleDisableUser}
            />
          </TabsContent>

          <TabsContent value="maintenance">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Media Migration Utility
                  </CardTitle>
                  <CardDescription>
                    Backfill missing thumbnails for legacy photos to improve app performance and prevent crashes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {migrationProgress ? (
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{migrationProgress.currentAction}</span>
                        <span>{Math.round((migrationProgress.processed / migrationProgress.total) * 100)}%</span>
                      </div>
                      <Progress value={(migrationProgress.processed / migrationProgress.total) * 100} className="h-2" />
                      <div className="grid grid-cols-3 gap-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                        <div className="p-2 bg-muted rounded text-center">
                          <p className="text-foreground text-base">{migrationProgress.processed}</p>
                          Items
                        </div>
                        <div className="p-2 bg-primary/5 rounded text-center">
                          <p className="text-primary text-base">{migrationProgress.updated}</p>
                          Updated
                        </div>
                        <div className="p-2 bg-destructive/5 rounded text-center">
                          <p className="text-destructive text-base">{migrationProgress.errors}</p>
                          Errors
                        </div>
                      </div>
                      {migrationProgress.processed === migrationProgress.total && !isMigrating && (
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-md text-sm font-bold">
                          <CheckCircle2 className="h-4 w-4" />
                          Migration process finished.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex gap-3 items-start">
                      <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-orange-800 leading-relaxed">
                        This utility will iterate through all work orders, assets, and quotes. It will fetch original images, generate thumbnails, and update the database. 
                        <strong> Run this only once per environment.</strong>
                      </p>
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleRunMigration} 
                    disabled={isMigrating} 
                    className="w-full"
                    variant={migrationProgress ? "outline" : "default"}
                  >
                    {isMigrating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Media...</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" /> {migrationProgress ? "Run Again" : "Backfill Legacy Thumbnails"}</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <UserEditDialog
        isOpen={isEditDialogOpen}
        setIsOpen={setIsEditDialogOpen}
        user={editingUser}
        roles={roles}
        onUserSaved={handleUserSaved}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              account for <span className="font-bold">{deletingUser?.name}</span> and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
