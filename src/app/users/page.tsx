'use client';
import { MainLayout } from '@/components/main-layout';
import { UsersTable } from '@/components/users-table';
import { getUsers, getRoles } from '@/lib/data';
import type { AppUser, Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { UserEditDialog } from '@/components/user-edit-dialog';

export default function UsersPage() {
  const initialUsers = getUsers();
  const roles = getRoles();
  const [users, setUsers] = useState<AppUser[]>(initialUsers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const handleUserSaved = (user: AppUser) => {
    if (editingUser) {
      setUsers(users.map(u => (u.id === user.id ? user : u)));
    } else {
      const newUser = { ...user, id: `user-${Date.now()}` };
      setUsers([newUser, ...users]);
    }
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
