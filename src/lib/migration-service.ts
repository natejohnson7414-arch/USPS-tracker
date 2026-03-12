'use client';

import { collection, getDocs, doc, writeBatch, query, limit } from 'firebase/firestore';
import { createThumbnail, uploadImageResumable } from '@/firebase/storage';
import type { PhotoMetadata, WorkOrder, Asset, Quote } from './types';

export interface MigrationProgress {
  total: number;
  processed: number;
  updated: number;
  errors: number;
  currentAction: string;
}

/**
 * Helper to determine if a photo entry needs a thumbnail.
 */
const needsThumbnail = (photo: string | PhotoMetadata): boolean => {
  if (typeof photo === 'string') return true;
  return !photo.thumbnailUrl;
};

/**
 * Fetches an image URL as a Blob for processing.
 */
async function fetchImageAsBlob(url: string): Promise<Blob> {
  const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
  return await response.blob();
}

/**
 * Processes a list of photos, creating thumbnails for any that need them.
 */
async function processPhotoList(
  photos: (string | PhotoMetadata)[], 
  basePath: string,
  onLog: (msg: string) => void
): Promise<{ updatedPhotos: PhotoMetadata[], count: number }> {
  let updatedCount = 0;
  const results: PhotoMetadata[] = [];

  for (const photo of photos) {
    if (needsThumbnail(photo)) {
      const originalUrl = typeof photo === 'string' ? photo : photo.url;
      try {
        onLog(`Processing ${originalUrl.split('/').pop()?.split('?')[0]}...`);
        const blob = await fetchImageAsBlob(originalUrl);
        const thumbBlob = await createThumbnail(blob);
        
        // Generate a filename from the URL or timestamp
        const urlParts = new URL(originalUrl);
        const fileName = decodeURIComponent(urlParts.pathname.split('/').pop() || `migrated-${Date.now()}.jpg`);
        const thumbPath = `${basePath}/thumbnails/${fileName}`;

        const { downloadURL: thumbnailUrl } = await uploadImageResumable(thumbBlob, thumbPath);
        
        results.push({ url: originalUrl, thumbnailUrl });
        updatedCount++;
      } catch (e) {
        console.error("Migration failed for photo:", originalUrl, e);
        results.push(typeof photo === 'string' ? { url: photo } : photo);
      }
    } else {
      results.push(photo as PhotoMetadata);
    }
  }

  return { updatedPhotos: results, count: updatedCount };
}

/**
 * Main migration function to backfill thumbnails for all relevant entities.
 */
export async function backfillThumbnails(
  db: any, 
  onProgress: (p: MigrationProgress) => void
) {
  const progress: MigrationProgress = {
    total: 0,
    processed: 0,
    updated: 0,
    errors: 0,
    currentAction: 'Initializing migration...'
  };

  const log = (msg: string) => {
    progress.currentAction = msg;
    onProgress({ ...progress });
  };

  try {
    // 1. Scan Work Orders
    log("Scanning Work Orders...");
    const woSnap = await getDocs(collection(db, 'work_orders'));
    progress.total = woSnap.size;
    
    for (const woDoc of woSnap.docs) {
      const wo = woDoc.data() as WorkOrder;
      let woUpdated = false;
      const updates: any = {};

      // Check Before Photos
      if (wo.beforePhotoUrls?.some(needsThumbnail)) {
        log(`WO #${woDoc.id}: Processing Before Photos...`);
        const { updatedPhotos, count } = await processPhotoList(wo.beforePhotoUrls, `work-orders/${woDoc.id}/before`, log);
        updates.beforePhotoUrls = updatedPhotos;
        progress.updated += count;
        woUpdated = true;
      }

      // Check After Photos
      if (wo.afterPhotoUrls?.some(needsThumbnail)) {
        log(`WO #${woDoc.id}: Processing After Photos...`);
        const { updatedPhotos, count } = await processPhotoList(wo.afterPhotoUrls, `work-orders/${woDoc.id}/after`, log);
        updates.afterPhotoUrls = updatedPhotos;
        progress.updated += count;
        woUpdated = true;
      }

      // Check Receipts
      if (wo.receiptsAndPackingSlips?.some(needsThumbnail)) {
        log(`WO #${woDoc.id}: Processing Receipts...`);
        const { updatedPhotos, count } = await processPhotoList(wo.receiptsAndPackingSlips, `work-orders/${woDoc.id}/receipts`, log);
        updates.receiptsAndPackingSlips = updatedPhotos;
        progress.updated += count;
        woUpdated = true;
      }

      // Check Notes (Subcollection)
      const notesSnap = await getDocs(collection(woDoc.ref, 'updates'));
      for (const noteDoc of notesSnap.docs) {
        const note = noteDoc.data();
        if (note.photoUrls?.some(needsThumbnail)) {
          log(`WO #${woDoc.id} Note: Processing Photos...`);
          const { updatedPhotos, count } = await processPhotoList(note.photoUrls, `work-orders/${woDoc.id}/notes`, log);
          const batch = writeBatch(db);
          batch.update(noteDoc.ref, { photoUrls: updatedPhotos });
          await batch.commit();
          progress.updated += count;
        }
      }

      if (woUpdated) {
        const batch = writeBatch(db);
        batch.update(woDoc.ref, updates);
        await batch.commit();
      }

      progress.processed++;
      onProgress({ ...progress });
    }

    // 2. Scan Assets
    log("Scanning Assets...");
    const assetSnap = await getDocs(collection(db, 'assets'));
    for (const assetDoc of assetSnap.docs) {
      const asset = assetDoc.data() as Asset;
      if (asset.photoUrls?.some(needsThumbnail)) {
        log(`Asset ${asset.assetTag}: Processing Photos...`);
        const { updatedPhotos, count } = await processPhotoList(asset.photoUrls, `assets/${asset.assetTag}`, log);
        const batch = writeBatch(db);
        batch.update(assetDoc.ref, { photoUrls: updatedPhotos });
        await batch.commit();
        progress.updated += count;
      }
    }

    // 3. Scan Quotes
    log("Scanning Quotes...");
    const quoteSnap = await getDocs(collection(db, 'quotes'));
    for (const quoteDoc of quoteSnap.docs) {
      const quote = quoteDoc.data() as Quote;
      if (quote.photos?.some(needsThumbnail)) {
        log(`Quote ${quote.quoteNumber}: Processing Photos...`);
        const { updatedPhotos, count } = await processPhotoList(quote.photos, `quotes/${quote.quoteNumber}/photos`, log);
        const batch = writeBatch(db);
        batch.update(quoteDoc.ref, { photos: updatedPhotos });
        await batch.commit();
        progress.updated += count;
      }
    }

    log("Migration Complete!");
  } catch (error) {
    console.error("Migration Error:", error);
    log(`Migration halted with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    progress.errors++;
    onProgress({ ...progress });
  }
}
