
'use client';

import { useEffect, useCallback } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

/**
 * Background component that pre-caches data for technicians
 * to ensure offline availability.
 */
export function SyncManager() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const performSync = useCallback(async () => {
    if (!db || !user) return;

    try {
      // 1. Fetch assigned work orders to put them in persistent cache
      const q = query(
        collection(db, 'work_orders'), 
        where('assignedTechnicianId', '==', user.uid)
      );
      
      const snapshot = await getDocs(q);
      
      // 2. For each work order, fetch subcollections to ensure they are local
      const syncPromises = snapshot.docs.map(async (woDoc) => {
        const woId = woDoc.id;
        // Trigger reads for subcollections so they are cached
        await Promise.all([
          getDocs(collection(db, 'work_orders', woId, 'updates')),
          getDocs(collection(db, 'work_orders', woId, 'activities'))
        ]);
      });

      await Promise.all(syncPromises);
      
      // 3. Also cache standard lookup data
      await Promise.all([
        getDocs(collection(db, 'work_sites')),
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'technicians'))
      ]);

      console.log('Background sync: Technician data cached locally.');
    } catch (error) {
      console.warn('Background sync encountered an issue:', error);
    }
  }, [db, user]);

  useEffect(() => {
    if (user) {
      performSync();
      
      // Re-sync every 15 minutes while app is open
      const interval = setInterval(performSync, 15 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user, performSync]);

  return null;
}
