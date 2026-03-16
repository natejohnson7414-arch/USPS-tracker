
'use client';

import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import type { Material, Asset } from './types';

export type DuplicateGroup = {
  normalizedName: string;
  materials: Material[];
};

/**
 * Groups materials by their normalized name to identify duplicates.
 * Normalization: Lowercase, trimmed, and single-spaced.
 */
export function identifyDuplicates(materials: Material[]): DuplicateGroup[] {
  const groups = new Map<string, Material[]>();
  
  materials.forEach(m => {
    const key = m.name.toLowerCase().trim().replace(/\s+/g, ' ');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(m);
  });
  
  return Array.from(groups.entries())
    .filter(([_, list]) => list.length > 1)
    .map(([name, list]) => ({ normalizedName: name, materials: list }))
    .sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
}

/**
 * Merges a group of duplicate materials into a single master record.
 */
export async function mergeMaterialsAction(
  db: any,
  master: Material,
  duplicates: Material[],
  updateAssets: boolean
) {
  const batch = writeBatch(db);
  
  // 1. Identify IDs to remove (all in the group except the master)
  const idsToRemove = duplicates
    .filter(d => d.id !== master.id)
    .map(d => d.id);
  
  const namesToStandardize = duplicates.map(d => d.name.toLowerCase().trim().replace(/\s+/g, ' '));

  // 2. Delete duplicate records from the materials catalog
  idsToRemove.forEach(id => {
    batch.delete(doc(db, 'materials', id));
  });
  
  // 3. Update the master record's timestamp
  batch.update(doc(db, 'materials', master.id), {
    updatedAt: new Date().toISOString()
  });
  
  // 4. Optionally scan and update all assets that reference these names
  if (updateAssets) {
    const assetsSnap = await getDocs(collection(db, 'assets'));
    
    assetsSnap.docs.forEach(assetDoc => {
      const asset = assetDoc.data() as Asset;
      if (!asset.materials || asset.materials.length === 0) return;
      
      let changed = false;
      const updatedMaterials = asset.materials.map(mat => {
        const matNameLower = mat.name.toLowerCase().trim().replace(/\s+/g, ' ');
        const isMatch = namesToStandardize.includes(matNameLower);
        
        if (isMatch) {
          // Only update if it's actually different from the master specs
          if (mat.name !== master.name || mat.category !== master.category || mat.uom !== master.uom) {
            changed = true;
            return {
              ...mat,
              name: master.name,
              category: master.category,
              uom: master.uom
            };
          }
        }
        return mat;
      });
      
      if (changed) {
        batch.update(assetDoc.ref, { materials: updatedMaterials });
      }
    });
  }
  
  await batch.commit();
}
