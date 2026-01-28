'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { List, PlusCircle } from 'lucide-react';
import { ClientForm } from '@/components/client-form';
import type { Client } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useTechnician } from '@/hooks/use-technician';
import { Ban } from 'lucide-react';

function ClientItem({ site }: { site: Client }) {
    return (
        <div className="flex items-center justify-between p-4 border-b">
            <div>
                <p className="font-semibold">{site.name}</p>
                <p className="text-sm text-muted-foreground">{site.address}</p>
            </div>
            <Button variant="ghost" size="sm">Details</Button>
        </div>
    )
}


export default function ClientsPage() {
    const db = useFirestore();
    const { role, isLoading: isRoleLoading } = useTechnician();
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    const clientsQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, 'clients'), orderBy('name', 'asc'));
    }, [db]);

    const { data: clients, isLoading: areClientsLoading } = useCollection<Client>(clientsQuery);

    const handleClientAdded = (newSite: Client) => {
        // The useCollection hook will update the list automatically
        setIsFormOpen(false);
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
            <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
            <p className="text-muted-foreground">
              Manage and create new clients for billing.
            </p>
          </div>
           <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
        
        {isFormOpen ? (
            <div className="pb-24">
                <ClientForm 
                    onClientAdded={handleClientAdded} 
                    onCancel={() => setIsFormOpen(false)}
                />
            </div>
        ) : (
             <Card>
                <CardHeader>
                    <CardTitle>All Clients</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {areClientsLoading ? (
                         <div className="p-6 text-center text-muted-foreground">Loading clients...</div>
                    ) : clients && clients.length > 0 ? (
                        <div>
                            {clients.map(site => <ClientItem key={site.id} site={site} />)}
                        </div>
                    ) : (
                         <div className="p-6 text-center text-muted-foreground">
                            <List className="mx-auto h-12 w-12" />
                            <p className="mt-4">No clients found.</p>
                            <p className="text-sm mt-2">Get started by adding a new client.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        )}
      </div>
    </MainLayout>
  );
}
