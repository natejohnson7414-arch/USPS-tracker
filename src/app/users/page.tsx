
'use client';
import { MainLayout } from '@/components/main-layout';
import { UsersTable } from '@/components/users-table';
import { getUsers, getRoles } from '@/lib/data';
import type { AppUser, Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { UserEditDialog } from '@/components/user-edit-dialog';
import { useFirestore } from '@/firebase';

export default function UsersPage() {
  const db = useFirestore();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const fetchAndSetData = async () => {
    setIsLoading(true);
    const fetchedRoles = await getRoles(db);
    const fetchedUsers = await getUsers(db, fetchedRoles);
    setRoles(fetchedRoles);
    setUsers(fetchedUsers);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAndSetData();
  }, [db]);

  const handleUserSaved = () => {
    // Refetch all data to ensure the UI is consistent with the database
    fetchAndSetData();
    setEditingUser(null);
  };

  const handleEditUser = (user: AppUser) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  };
  
  const handleAddNewUser = () => {
    setEditingUser(null);
    setIsDialogOpen(true);
  }

  if (isLoading) {
    return (
        <MainLayout>
            <div className="flex items-center justify-center h-full">
                <p>Loading users...</p>
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
          <UsersTable users={users} onEditUser={handleEditUser} />
        </div>
      </div>
       <UserEditDialog
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        user={editingUser}
        roles={roles}
        onUserSaved={handleUserSaved}
      />
    </MainLayout>
  );
}
