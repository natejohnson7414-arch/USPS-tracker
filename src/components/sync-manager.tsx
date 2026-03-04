
'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useTechnician } from '@/hooks/use-technician';

/**
 * Background component that pre-caches data for technicians
 * to ensure offline availability.
 */
export function SyncManager() {
  const db = useFirestore();
  const { user } = useUser();
  const { technician, isLoading: isProfileLoading } = useTechnician();
  const isSyncing = useRef(false);

  const performSync = useCallback(async () => {
    // CRITICAL: Only sync if user is logged in, profile is loaded, and we aren't already syncing
    if (!db || !user || !technician || isSyncing.current || !navigator.onLine) return;

    isSyncing.current = true;
    console.log('Background sync starting for technician:', technician.name);

    try {
      // 1. Fetch assigned work orders to put them in persistent cache
      const q = query(
        collection(db, 'work_orders'), 
        where('assignedTechnicianId', '==', user.uid)
      );
      
      const snapshot = await getDocs(q);
      
      // 2. For each work order, fetch subcollections to ensure they are local
      // We process these sequentially to avoid saturating IndexedDB/Network
      for (const woDoc of snapshot.docs) {
        const woId = woDoc.id;
        try {
            await Promise.all([
                getDocs(collection(db, 'work_orders', woId, 'updates')),
                getDocs(collection(db, 'work_orders', woId, 'activities'))
            ]);
        } catch (e) {
            console.warn(`Could not sync subcollections for ${woId}`);
        }
      }
      
      // 3. Also cache standard lookup data
      await Promise.all([
        getDocs(collection(db, 'work_sites')),
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'technicians'))
      ]);

      console.log('Background sync: Complete. Technician data cached locally.');
    } catch (error) {
      console.warn('Background sync encountered an issue:', error);
    } finally {
      isSyncing.current = false;
    }
  }, [db, user, technician]);

  useEffect(() => {
    if (user && !isProfileLoading && technician) {
      performSync();
      
      // Re-sync every 15 minutes while app is open
      const interval = setInterval(performSync, 15 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user, isProfileLoading, technician, performSync]);

  return null;
}
