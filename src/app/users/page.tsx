
'use client';
import { MainLayout } from '@/components/main-layout';
import { UsersTable } from '@/components/users-table';
import { getUsers, getRoles } from '@/lib/data';
import type { AppUser, Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Ban } from 'lucide-react';
import { useState, useEffect } from 'react';
import { UserEditDialog } from '@/components/user-edit-dialog';
import { useFirestore, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
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


export default function UsersPage() {
  const db = useFirestore();
  const { role, isLoading: isRoleLoading } = useTechnician();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);

  const fetchAndSetData = async () => {
    if (!db) return;
    setIsLoading(true);
    try {
      const fetchedRoles = await getRoles(db);
      setRoles(fetchedRoles);
      // Now that roles are set, fetch users
      const fetchedUsers = await getUsers(db, fetchedRoles);
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch user and role data:", error);
      // Optionally set an error state to show in the UI
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (db && role?.name !== 'Technician') {
        fetchAndSetData();
    } else if (role?.name === 'Technician') {
        setIsLoading(false);
    }
  }, [db, role]);

  const handleUserSaved = () => {
    // Refetch all data to ensure the UI is consistent with the database
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
        // Optimistic update
        setUsers(users.filter(u => u.id !== deletingUser.id));
        setDeletingUser(null);
        setIsDeleteDialogOpen(false);
    }
  };

  const handleToggleDisableUser = (user: AppUser) => {
    const userRef = doc(db, 'technicians', user.id);
    const newDisabledState = !user.disabled;
    updateDocumentNonBlocking(userRef, { disabled: newDisabledState });
     // Optimistic update
    setUsers(users.map(u => u.id === user.id ? { ...u, disabled: newDisabledState } : u));
  };


  if (isLoading || isRoleLoading) {
    return (
        <MainLayout>
            <div className="flex items-center justify-center h-full">
                <p>Loading users...</p>
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
        <div className="flex items-center justify-between space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">
              View, add, and manage user roles in the system.
            </p>
          </div>
          <Button onClick={handleAddNewUser}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
        <div className="mt-8">
          <UsersTable 
            users={users} 
            onEditUser={handleEditUser} 
            onDeleteUser={handleDeleteUser}
            onToggleDisableUser={handleToggleDisableUser}
          />
        </div>
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
