
'use client';

import { collection, getDocs, doc, writeBatch, addDoc } from 'firebase/firestore';
import type { Material, Asset } from './types';

export type UnifiedMaterial = {
  id: string;
  name: string;
  category: string;
  uom: string;
  source: 'catalog' | 'asset';
  createdAt?: string;
  updatedAt?: string;
};

export type DuplicateGroup = {
  normalizedName: string;
  materials: UnifiedMaterial[];
};

/**
 * Groups materials by their normalized name to identify duplicates.
 * Normalization: Lowercase, trimmed, and single-spaced.
 */
export function identifyDuplicates(materials: UnifiedMaterial[]): DuplicateGroup[] {
  const groups = new Map<string, UnifiedMaterial[]>();
  
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
 * Standardizes names across the catalog and all assets.
 */
export async function mergeMaterialsAction(
  db: any,
  master: UnifiedMaterial,
  duplicates: UnifiedMaterial[],
  updateAssets: boolean
) {
  const batch = writeBatch(db);
  
  // 1. Ensure the master record exists in the catalog
  let masterCatalogId = master.id;
  if (master.source === 'asset') {
    const newDocRef = await addDoc(collection(db, 'materials'), {
      name: master.name,
      category: master.category,
      uom: master.uom,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    masterCatalogId = newDocRef.id;
  } else {
    batch.update(doc(db, 'materials', master.id), {
      updatedAt: new Date().toISOString()
    });
  }

  // 2. Remove redundant global catalog records
  duplicates.forEach(d => {
    if (d.source === 'catalog' && d.id !== masterCatalogId) {
      batch.delete(doc(db, 'materials', d.id));
    }
  });
  
  const namesToStandardize = duplicates.map(d => d.name.toLowerCase().trim().replace(/\s+/g, ' '));

  // 3. Scan and update every Asset referencing these variations
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
          // Check if it already matches the master specs exactly
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
