
'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useTechnician } from '@/hooks/use-technician';

/**
 * Background component that pre-caches data for technicians
 * to ensure offline availability.
 * 
 * FIX: Now gated on technician profile readiness to ensure security rules pass.
 * FIX: Implemented sequential throttling to prevent IndexedDB/Network saturation.
 */
export function SyncManager() {
  const db = useFirestore();
  const { user } = useUser();
  const { technician, role, isLoading: isProfileLoading } = useTechnician();
  const isSyncing = useRef(false);

  const performSync = useCallback(async () => {
    // CRITICAL GATE: Only sync if auth is ready AND the technician profile (needed for rules) is loaded
    if (!db || !user || !technician || !role || isSyncing.current || !navigator.onLine) return;

    isSyncing.current = true;
    console.log('[SyncManager] Starting throttled background sync for:', technician.name);

    try {
      // 1. Fetch assigned work orders first
      const q = query(
        collection(db, 'work_orders'), 
        where('assignedTechnicianId', '==', user.uid)
      );
      
      const snapshot = await getDocs(q);
      console.log(`[SyncManager] Caching ${snapshot.docs.length} assigned work orders`);
      
      // 2. Process subcollections SEQUENTIALLY with small delays
      // This prevents "Breaking Uploads" by avoiding IndexedDB transaction saturation
      for (const woDoc of snapshot.docs) {
        const woId = woDoc.id;
        try {
            // Sequential fetch for sub-data
            await getDocs(collection(db, 'work_orders', woId, 'updates'));
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms throttle
            await getDocs(collection(db, 'work_orders', woId, 'activities'));
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
            console.warn(`[SyncManager] Could not sync subcollections for ${woId}`, e);
        }
      }
      
      // 3. Cache lookup data (sites, clients, techs)
      await getDocs(collection(db, 'work_sites'));
      await getDocs(collection(db, 'clients'));
      await getDocs(collection(db, 'technicians'));

      console.log('[SyncManager] Sync complete. Local cache primed.');
    } catch (error) {
      console.error('[SyncManager] Sync error:', error);
    } finally {
      isSyncing.current = false;
    }
  }, [db, user, technician, role]);

  useEffect(() => {
    if (user && !isProfileLoading && technician && role) {
      // Initial delay to let the UI settle and any immediate uploads start
      const initialTimer = setTimeout(performSync, 2000);
      
      // Re-sync every 15 minutes
      const interval = setInterval(performSync, 15 * 60 * 1000);
      
      return () => {
        clearTimeout(initialTimer);
        clearInterval(interval);
      };
    }
  }, [user, isProfileLoading, technician, role, performSync]);

  return null;
}
