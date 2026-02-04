
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { getTechnicianById, getRoles } from '@/lib/data';
import type { Technician, Role } from '@/lib/types';

export function useTechnician() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);

  useEffect(() => {
    // Only proceed if we have a user and a database connection.
    if (user && db) {
      setIsLoading(true);
      
      const fetchTechnicianAndRole = async () => {
          try {
            const [techProfile, roles] = await Promise.all([
              getTechnicianById(db, user.uid),
              getRoles(db)
            ]);

            if (techProfile) {
              setTechnician(techProfile);
              setPasswordChangeRequired(techProfile.passwordChangeRequired ?? false);
              if (techProfile.roleId) {
                const userRole = roles.find(r => r.id === techProfile.roleId);
                setRole(userRole || null);
              } else {
                 setRole(null);
              }
            } else {
              setTechnician(null);
              setRole(null);
              setPasswordChangeRequired(false);
            }
          } catch (error) {
              console.error("Error fetching technician profile and roles:", error);
              setTechnician(null);
              setRole(null);
              setPasswordChangeRequired(false);
          } finally {
              setIsLoading(false);
          }
      };
      
      fetchTechnicianAndRole();

    } else if (!isUserLoading && !user) {
      // If auth is done and there's no user, we're not loading and there's no data.
      setIsLoading(false);
      setTechnician(null);
      setRole(null);
      setPasswordChangeRequired(false);
    }
  }, [user, db, isUserLoading]);

  return { technician, role, isLoading, passwordChangeRequired };
}
