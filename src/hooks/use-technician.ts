
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
    if (user && db) {
      setIsLoading(true);
      getTechnicianById(db, user.uid)
        .then(techProfile => {
          if (techProfile) {
            setTechnician(techProfile);
          } else {
            // This might happen if a user exists in Auth but not in the 'technicians' collection
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
    } else {
      // No user or db, so not loading and no technician
      setIsLoading(false);
      setTechnician(null);
    }
  }, [user, db]);

  return { technician, isLoading };
}
