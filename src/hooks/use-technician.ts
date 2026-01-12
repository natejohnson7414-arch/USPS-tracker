
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { getTechnicianById, getRoles } from '@/lib/data';
import type { Technician, Role } from '@/lib/types';

export function useTechnician() {
  const { user } = useUser();
  const db = useFirestore();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
              if (techProfile.roleId) {
                const userRole = roles.find(r => r.id === techProfile.roleId);
                setRole(userRole || null);
              } else {
                 setRole(null);
              }
            } else {
              setTechnician(null);
              setRole(null);
            }
          } catch (error) {
              console.error("Error fetching technician profile and roles:", error);
              setTechnician(null);
              setRole(null);
          } finally {
              setIsLoading(false);
          }
      };
      
      fetchTechnicianAndRole();

    } else if (!user) {
      // If there's no authenticated user, we're not loading and there's no technician.
      setIsLoading(false);
      setTechnician(null);
      setRole(null);
    }
  }, [user, db]);

  return { technician, role, isLoading };
}
