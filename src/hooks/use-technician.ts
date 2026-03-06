
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import type { Technician, Role } from '@/lib/types';
import { doc, collection } from 'firebase/firestore';

/**
 * Hook to retrieve the current user's technician profile and role.
 * Uses real-time listeners to ensure UI consistency when data changes (like default view preferences).
 */
export function useTechnician() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  
  // Memoize document and collection references to prevent infinite loops in hooks
  const techRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'technicians', user.uid);
  }, [db, user]);

  const rolesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'roles');
  }, [db, user]);

  // Subscribe to the technician profile in real-time
  const { data: technician, isLoading: isTechLoading } = useDoc<Technician>(techRef);
  
  // Subscribe to roles collection in real-time
  const { data: roles, isLoading: areRolesLoading } = useCollection<Role>(rolesQuery);

  // Derive role information from the reactive lists
  const role = roles?.find(r => r.id === technician?.roleId) || null;
  const isLoading = isUserLoading || isTechLoading || areRolesLoading;
  const passwordChangeRequired = technician?.passwordChangeRequired ?? false;

  return { technician, role, isLoading, passwordChangeRequired };
}
