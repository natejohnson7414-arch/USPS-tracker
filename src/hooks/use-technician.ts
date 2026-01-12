'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { getTechnicianById } from '@/lib/data';
import type { Technician } from '@/lib/types';

export function useTechnician() {
  const { user } = useUser();
  const db = useFirestore();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only proceed if we have a user and a database connection.
    if (user && db) {
      setIsLoading(true);
      getTechnicianById(db, user.uid)
        .then(techProfile => {
          if (techProfile) {
            setTechnician(techProfile);
          } else {
            // This case handles when a user is authenticated but doesn't have a profile
            // in the 'technicians' collection yet.
            setTechnician(null);
          }
        })
        .catch(error => {
          console.error("Error fetching technician profile:", error);
          setTechnician(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!user) {
      // If there's no authenticated user, we're not loading and there's no technician.
      setIsLoading(false);
      setTechnician(null);
    }
  }, [user, db]);

  return { technician, isLoading };
}
