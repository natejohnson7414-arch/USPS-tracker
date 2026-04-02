'use client';

import { collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';
import type { WorkSite, WorkOrder, PmWorkOrder, Asset, MaintenanceContract } from './types';

export type DuplicateSiteGroup = {
  normalizedLocation: string;
  sites: WorkSite[];
};

/**
 * Groups sites by their normalized location to identify duplicates.
 */
export function identifyDuplicateSites(sites: WorkSite[]): DuplicateSiteGroup[] {
  const groups = new Map<string, WorkSite[]>();

  sites.forEach(site => {
    const normalize = (val: string) => (val || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const key = `${normalize(site.city)}-${normalize(site.state)}-${normalize(site.address)}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(site);
  });

  return Array.from(groups.entries())
    .filter(([_, list]) => list.length > 1)
    .map(([key, list]) => ({ normalizedLocation: key, sites: list }))
    .sort((a, b) => a.normalizedLocation.localeCompare(b.normalizedLocation));
}

/**
 * Merges a group of duplicate sites into a single master record.
 * Redirects all related data (Work Orders, Assets, PMs, Contracts) to the master ID.
 */
export async function mergeSitesAction(
  db: any,
  master: WorkSite,
  duplicates: WorkSite[]
) {
  const batch = writeBatch(db);
  const masterId = master.id;
  const duplicateIds = duplicates.filter(d => d.id !== masterId).map(d => d.id);

  if (duplicateIds.length === 0) return;

  // 1. Update Work Orders
  const woSnap = await getDocs(query(collection(db, 'work_orders'), where('workSiteId', 'in', duplicateIds)));
  woSnap.docs.forEach(d => {
    batch.update(d.ref, { workSiteId: masterId });
  });

  // 2. Update PM Work Orders
  const pmWoSnap = await getDocs(query(collection(db, 'pm_work_orders'), where('workSiteId', 'in', duplicateIds)));
  pmWoSnap.docs.forEach(d => {
    batch.update(d.ref, { workSiteId: masterId });
  });

  // 3. Update Assets
  const assetsSnap = await getDocs(query(collection(db, 'assets'), where('siteId', 'in', duplicateIds)));
  assetsSnap.docs.forEach(d => {
    batch.update(d.ref, { siteId: masterId });
  });

  // 4. Update Contracts
  const contractsSnap = await getDocs(query(collection(db, 'contracts'), where('siteId', 'in', duplicateIds)));
  contractsSnap.docs.forEach(d => {
    batch.update(d.ref, { siteId: masterId });
  });

  // 5. Delete duplicate site documents
  duplicateIds.forEach(id => {
    batch.delete(doc(db, 'work_sites', id));
  });

  await batch.commit();
}
