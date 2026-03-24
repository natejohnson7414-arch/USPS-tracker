'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase/provider';
import { collection, query, where, getDocs, limit, doc, getDoc, or } from 'firebase/firestore';
import { useTechnician } from '@/hooks/use-technician';
import { getActiveUploadCount } from '@/firebase/storage';

declare global {
  interface Window {
    __UPLOAD_IN_PROGRESS__?: boolean;
  }
}

/**
 * Background component that pre-caches data for technicians.
 * Uses direct imports from provider to avoid circular dependencies with the main barrel file.
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
      // Find jobs where user is lead or crew
      const involvedQuery = query(
        collection(db, 'work_orders'), 
        or(
          where('assignedTechnicianId', '==', user.uid),
          where('involvedTechnicianIds', 'array-contains', user.uid)
        ),
        limit(30)
      );
      const involvedSnap = await getDocs(involvedQuery);
      const allTargetIds = involvedSnap.docs.map(d => d.id);
      
      for (const woId of allTargetIds) {
        const currentUploads = getActiveUploadCount() > 0 || (typeof window !== 'undefined' && window.__UPLOAD_IN_PROGRESS__);
        if (!isSyncing.current || currentUploads) break;

        try {
            await getDoc(doc(db, 'work_orders', woId));
            await getDocs(collection(db, 'work_orders', woId, 'updates'));
            await new Promise(resolve => setTimeout(resolve, 500));
            await getDocs(collection(db, 'work_orders', woId, 'activities'));
        } catch (e) {
            console.warn(`[SyncManager] Skip cache for ${woId}:`, e);
        }
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
      const initialTimer = setTimeout(performSync, 30000);
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
