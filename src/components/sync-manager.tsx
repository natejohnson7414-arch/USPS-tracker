
'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useTechnician } from '@/hooks/use-technician';

/**
 * Background component that pre-caches data for technicians.
 * 
 * OPTIMIZATION: Implemented sequential throttling and concurrency capping 
 * to ensure background sync doesn't block high-priority photo uploads.
 */
export function SyncManager() {
  const db = useFirestore();
  const { user } = useUser();
  const { technician, role, isLoading: isProfileLoading } = useTechnician();
  const isSyncing = useRef(false);
  const abortController = useRef<AbortController | null>(null);

  const performSync = useCallback(async () => {
    if (!db || !user || !technician || !role || isSyncing.current || !navigator.onLine) return;

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
        // Yield check: Stop if component unmounted or user logged out
        if (!isSyncing.current) break;

        const woId = woDoc.id;
        try {
            // Fetch updates and activities with significant yielding
            await getDocs(collection(db, 'work_orders', woId, 'updates'));
            await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay
            
            await getDocs(collection(db, 'work_orders', woId, 'activities'));
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
            console.warn(`[SyncManager] Skip ${woId}:`, e);
        }
      }
      
      // Cache base registries
      await getDocs(collection(db, 'work_sites'));
      await getDocs(collection(db, 'clients'));
      await getDocs(collection(db, 'technicians'));

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
