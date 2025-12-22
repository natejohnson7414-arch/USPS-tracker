'use client';

import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

export default function LocationsPage() {
  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Work Site Locations</h1>
          <p className="text-muted-foreground">
            Manage and view all work site locations.
          </p>
        </div>
        <div className="mt-8">
            <Card>
                <CardHeader>
                    <CardTitle>Locations Map</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-96 w-full bg-muted rounded-lg flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                            <MapPin className="mx-auto h-12 w-12" />
                            <p className="mt-2">Map functionality will be implemented here.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </MainLayout>
  );
}
