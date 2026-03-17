
'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, limit, collectionGroup, doc, getDoc } from 'firebase/firestore';
import { useTechnician } from '@/hooks/use-technician';
import { getActiveUploadCount } from '@/firebase/storage';

declare global {
  interface Window {
    __UPLOAD_IN_PROGRESS__?: boolean;
  }
}

/**
 * Background component that pre-caches data for technicians.
 * Updated to include work orders linked via activities.
 */
export function SyncManager() {
  const db = useFirestore();
  const { user } = useUser();
  const { technician, role, isLoading: isProfileLoading } = useTechnician();
  const isSyncing = useRef(false);

  const performSync = useCallback(async () => {
    const isUploading = getActiveUploadCount() > 0 || (typeof window !== 'undefined' && window.__UPLOAD_IN_PROGRESS__);
    if (!db || !user || !technician || !role || isSyncing.current || !navigator.onLine || isUploading) {
      return;
    }

    isSyncing.current = true;
    const isDebug = process.env.NEXT_PUBLIC_DEBUG_UPLOADS === '1';
    if (isDebug) console.log('[SyncManager] Starting background sync cycle...');

    try {
      // 1. Get IDs of work orders where user is Lead
      const leadQuery = query(
        collection(db, 'work_orders'), 
        where('assignedTechnicianId', '==', user.uid),
        limit(15)
      );
      const leadSnap = await getDocs(leadQuery);
      const leadIds = leadSnap.docs.map(d => d.id);

      // 2. Get IDs of work orders where user has an activity
      const actQuery = query(
        collectionGroup(db, 'activities'),
        where('technicianId', '==', user.uid),
        limit(20)
      );
      const actSnap = await getDocs(actQuery);
      const activityIds = Array.from(new Set(actSnap.docs.map(d => d.data().workOrderId)));

      // 3. Combine unique IDs
      const allTargetIds = Array.from(new Set([...leadIds, ...activityIds])).slice(0, 20);
      
      for (const woId of allTargetIds) {
        const currentUploads = getActiveUploadCount() > 0 || (typeof window !== 'undefined' && window.__UPLOAD_IN_PROGRESS__);
        if (!isSyncing.current || currentUploads) break;

        try {
            // Cache the main document if not already in local cache
            await getDoc(doc(db, 'work_orders', woId));
            
            // Cache subcollections
            await getDocs(collection(db, 'work_orders', woId, 'updates'));
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await getDocs(collection(db, 'work_orders', woId, 'activities'));
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
            console.warn(`[SyncManager] Skip cache for ${woId}:`, e);
        }
      }
      
      if (!window.__UPLOAD_IN_PROGRESS__ && getActiveUploadCount() === 0) {
        await getDocs(collection(db, 'work_sites'));
        await new Promise(resolve => setTimeout(resolve, 2000));
        await getDocs(collection(db, 'clients'));
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
      // Conservative Start Delay: Wait 45 seconds after boot to allow initial renders
      const initialTimer = setTimeout(performSync, 45000);
      const interval = setInterval(performSync, 20 * 60 * 1000); // Sync every 20m
      
      return () => {
        isSyncing.current = false;
        clearTimeout(initialTimer);
        clearInterval(interval);
      };
    }
  }, [user, isProfileLoading, technician, role, performSync]);

  return null;
}
