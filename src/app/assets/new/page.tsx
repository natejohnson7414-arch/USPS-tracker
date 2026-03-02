
'use client';

import { MainLayout } from '@/components/main-layout';
import { AssetForm } from '@/components/asset-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewAssetPage() {
  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/assets">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assets
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Add New Asset</h1>
          <p className="text-muted-foreground">Register a new piece of equipment into the registry.</p>
        </div>

        <AssetForm />
      </div>
    </MainLayout>
  );
}
