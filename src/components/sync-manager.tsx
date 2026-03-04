'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useTechnician } from '@/hooks/use-technician';
import { getActiveUploadCount } from '@/firebase/storage';

declare global {
  interface Window {
    __UPLOAD_IN_PROGRESS__?: boolean;
  }
}

/**
 * Background component that pre-caches data for technicians.
 * 
 * INTERLOCK: This component yields completely when activeUploadCount > 0 
 * or window.__UPLOAD_IN_PROGRESS__ is true to prevent connection pool saturation.
 */
export function SyncManager() {
  const db = useFirestore();
  const { user } = useUser();
  const { technician, role, isLoading: isProfileLoading } = useTechnician();
  const isSyncing = useRef(false);

  const performSync = useCallback(async () => {
    // 1. High-priority Interlock
    const isUploading = getActiveUploadCount() > 0 || (typeof window !== 'undefined' && window.__UPLOAD_IN_PROGRESS__);
    if (!db || !user || !technician || !role || isSyncing.current || !navigator.onLine || isUploading) {
      if (isUploading) console.log('[SyncManager] yielding to active upload...');
      return;
    }

    isSyncing.current = true;
    const isDebug = process.env.NEXT_PUBLIC_DEBUG_UPLOADS === '1';
    if (isDebug) console.log('[SyncManager] Starting background sync cycle...');

    try {
      const q = query(
        collection(db, 'work_orders'), 
        where('assignedTechnicianId', '==', user.uid)
      );
      
      const snapshot = await getDocs(q);
      
      // Process work orders SEQUENTIALLY with delays
      for (const woDoc of snapshot.docs) {
        // Re-check interlock inside loop
        const currentUploads = getActiveUploadCount() > 0 || (typeof window !== 'undefined' && window.__UPLOAD_IN_PROGRESS__);
        if (!isSyncing.current || currentUploads) break;

        const woId = woDoc.id;
        try {
            await getDocs(collection(db, 'work_orders', woId, 'updates'));
            await new Promise(resolve => setTimeout(resolve, 800)); // Yield more
            
            await getDocs(collection(db, 'work_orders', woId, 'activities'));
            await new Promise(resolve => setTimeout(resolve, 800));
        } catch (e) {
            console.warn(`[SyncManager] Skip subcollections for ${woId}:`, e);
        }
      }
      
      // Cache base registries
      if (!window.__UPLOAD_IN_PROGRESS__ && getActiveUploadCount() === 0) {
        await getDocs(collection(db, 'work_sites'));
        await new Promise(resolve => setTimeout(resolve, 500));
        await getDocs(collection(db, 'clients'));
        await new Promise(resolve => setTimeout(resolve, 500));
        await getDocs(collection(db, 'technicians'));
      }

      if (isDebug) console.log('[SyncManager] Sync cycle complete.');
    } catch (error) {
      console.error('[SyncManager] Sync cycle failed:', error);
    } finally {
      isSyncing.current = false;
    }
  }, [db, user, technician, role]);

  useEffect(() => {
    if (user && !isProfileLoading && technician && role) {
      // Start delay: Wait 10 seconds after boot to allow initial renders
      const initialTimer = setTimeout(performSync, 10000);
      const interval = setInterval(performSync, 15 * 60 * 1000);
      
      return () => {
        isSyncing.current = false;
        clearTimeout(initialTimer);
        clearInterval(interval);
      };
    }
  }, [user, isProfileLoading, technician, role, performSync]);

  return null;
}
