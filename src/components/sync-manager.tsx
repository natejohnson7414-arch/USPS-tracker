'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useTechnician } from '@/hooks/use-technician';

declare global {
  interface Window {
    __UPLOAD_IN_PROGRESS__?: boolean;
  }
}

/**
 * Background component that pre-caches data for technicians.
 * 
 * OPTIMIZATION: Implemented sequential throttling and concurrency capping 
 * to ensure background sync doesn't block high-priority photo uploads.
 * 
 * PAUSE LOGIC: Sync skips iterations if an upload is active.
 */
export function SyncManager() {
  const db = useFirestore();
  const { user } = useUser();
  const { technician, role, isLoading: isProfileLoading } = useTechnician();
  const isSyncing = useRef(false);

  const performSync = useCallback(async () => {
    // Skip if already syncing, offline, or if an UPLOAD is in progress
    if (!db || !user || !technician || !role || isSyncing.current || !navigator.onLine) return;
    if (typeof window !== 'undefined' && window.__UPLOAD_IN_PROGRESS__) {
      console.log('[SyncManager] Pause: Active upload detected.');
      return;
    }

    isSyncing.current = true;
    console.log('[SyncManager] Throttled background sync starting...');

    try {
      const q = query(
        collection(db, 'work_orders'), 
        where('assignedTechnicianId', '==', user.uid)
      );
      
      const snapshot = await getDocs(q);
      
      // Process work orders one by one with a delay to yield to the UI thread and network
      for (const woDoc of snapshot.docs) {
        // Stop if component unmounted, user logged out, or UPLOAD started mid-sync
        if (!isSyncing.current || (typeof window !== 'undefined' && window.__UPLOAD_IN_PROGRESS__)) break;

        const woId = woDoc.id;
        try {
            // Fetch updates and activities with significant yielding
            await getDocs(collection(db, 'work_orders', woId, 'updates'));
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await getDocs(collection(db, 'work_orders', woId, 'activities'));
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.warn(`[SyncManager] Skip ${woId}:`, e);
        }
      }
      
      // Cache base registries
      if (!window.__UPLOAD_IN_PROGRESS__) {
        await getDocs(collection(db, 'work_sites'));
        await getDocs(collection(db, 'clients'));
        await getDocs(collection(db, 'technicians'));
      }

      console.log('[SyncManager] Sync cycle complete.');
    } catch (error) {
      console.error('[SyncManager] Sync cycle failed:', error);
    } finally {
      isSyncing.current = false;
    }
  }, [db, user, technician, role]);

  useEffect(() => {
    if (user && !isProfileLoading && technician && role) {
      // Start delay: Wait 5 seconds after boot to allow initial uploads/renders
      const initialTimer = setTimeout(performSync, 5000);
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
