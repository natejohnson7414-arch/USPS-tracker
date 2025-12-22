'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { List, PlusCircle } from 'lucide-react';
import { WorkSiteForm } from '@/components/work-site-form';
import type { WorkSite } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';

function WorkSiteItem({ site }: { site: WorkSite }) {
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


export default function WorkSitesPage() {
    const db = useFirestore();
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    const workSitesQuery = useMemoFirebase(() => {
        if (!db) return null;
        return query(collection(db, 'work_sites'));
    }, [db]);

    const { data: workSites, isLoading } = useCollection<WorkSite>(workSitesQuery);

    const handleSiteAdded = (newSite: WorkSite) => {
        // The useCollection hook will update the list automatically
        setIsFormOpen(false);
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
           <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Work Site
          </Button>
        </div>
        
        {isFormOpen ? (
            <WorkSiteForm 
                onSiteAdded={handleSiteAdded} 
                onCancel={() => setIsFormOpen(false)}
            />
        ) : (
             <Card>
                <CardHeader>
                    <CardTitle>All Work Sites</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                         <div className="p-6 text-center text-muted-foreground">Loading sites...</div>
                    ) : workSites && workSites.length > 0 ? (
                        <div>
                            {workSites.map(site => <WorkSiteItem key={site.id} site={site} />)}
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
    </MainLayout>
  );
}
