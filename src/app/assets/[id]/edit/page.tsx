
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/main-layout';
import { AssetForm } from '@/components/asset-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useFirestore } from '@/firebase';
import { getAssetById } from '@/lib/data';
import type { Asset } from '@/lib/types';

export default function EditAssetPage() {
  const { id } = useParams();
  const db = useFirestore();
  const router = useRouter();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (db && id) {
      getAssetById(db, id as string)
        .then((a) => {
          if (a) {
            setAsset(a);
          } else {
            router.push('/assets');
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [db, id, router]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!asset) {
    return (
      <MainLayout>
        <div className="container py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold">Asset Not Found</h1>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href={`/assets/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Details
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Edit Asset</h1>
          <p className="text-muted-foreground font-mono">Tag: {asset.assetTag}</p>
        </div>

        <AssetForm asset={asset} />
      </div>
    </MainLayout>
  );
}
