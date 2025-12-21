import { MainLayout } from '@/components/main-layout';
import { UsersTable } from '@/components/users-table';
import { getUsers } from '@/lib/data';

export default function UsersPage() {
  const users = getUsers();

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            View and manage user roles in the system.
          </p>
        </div>
        <div className="mt-8">
          <UsersTable users={users} />
        </div>
      </div>
    </MainLayout>
  );
}
