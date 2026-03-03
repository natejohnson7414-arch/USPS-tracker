
'use client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { AssetPmSchedule, PmTemplate, RequiredMaterial, WorkSite, Asset, AssetMaterial } from '@/lib/types';
import { getAssetPmSchedules, getPmTemplates, getWorkSites, getAssets } from './data';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addMonths, differenceInMonths } from 'date-fns';

export interface MaterialForecast {
  materialId: string;
  name: string;
  quantity: number;
  uom: string;
  category: string;
}

export interface SiteForecast {
  siteId: string;
  siteName: string;
  materials: MaterialForecast[];
}

export interface MaterialReportGroup {
  groupName: string;
  items: {
    name: string;
    category: string;
    quantity: number;
    uom: string;
    affectedAssets: { name: string; tag: string }[];
  }[];
}

/**
 * Generates a material forecast report based on PM schedules due in a specific month.
 * Handles repeatable schedule logic to project future requirements.
 */
export const generateMaterialsReport = async (
  db: any, 
  year: number, 
  month: number, 
  siteIds: string[], 
  groupBy: 'site' | 'category'
): Promise<MaterialReportGroup[]> => {
  const targetDate = new Date(year, month - 1, 1);
  const start = startOfMonth(targetDate);
  const end = endOfMonth(targetDate);

  const [schedules, assets, sites] = await Promise.all([
    getAssetPmSchedules(db),
    getAssets(db),
    getWorkSites(db)
  ]);

  // Filter schedules by projected recurrence hits
  const dueSchedules = schedules.filter(s => {
    if (s.status !== 'active') return false;
    
    const asset = assets.find(a => a.id === s.assetId);
    if (!asset) return false;
    
    const isCorrectSite = siteIds.length === 0 || siteIds.includes(asset.siteId);
    if (!isCorrectSite) return false;

    const startDueDate = parseISO(s.nextDueDate);
    
    // If it starts this month
    if (isWithinInterval(startDueDate, { start, end })) {
      return true;
    }

    // If it started before, check recurrence pattern
    if (startDueDate < start) {
      const monthsDiff = differenceInMonths(start, startDueDate);
      
      switch (s.frequencyType) {
        case 'monthly':
          return true;
        case 'quarterly':
          return monthsDiff % 3 === 0;
        case 'semiannual':
          return monthsDiff % 6 === 0;
        case 'annual':
          return monthsDiff % 12 === 0;
        default:
          return false;
      }
    }

    return false;
  });

  const reportGroups = new Map<string, MaterialReportGroup>();

  dueSchedules.forEach(schedule => {
    const asset = assets.find(a => a.id === schedule.assetId);
    if (!asset || !asset.materials || asset.materials.length === 0) return;

    const groupKey = groupBy === 'site' 
      ? (sites.find(s => s.id === asset.siteId)?.name || 'Unknown Site')
      : 'Material Forecast';

    if (!reportGroups.has(groupKey)) {
      reportGroups.set(groupKey, { groupName: groupKey, items: [] });
    }

    const group = reportGroups.get(groupKey)!;

    asset.materials.forEach((mat: AssetMaterial) => {
      let item = group.items.find(i => i.name === mat.name && i.category === mat.category);
      
      if (item) {
        item.quantity += mat.quantity;
        if (!item.affectedAssets.some(aa => aa.tag === asset.assetTag)) {
          item.affectedAssets.push({ name: asset.name, tag: asset.assetTag });
        }
      } else {
        group.items.push({
          name: mat.name,
          category: mat.category,
          quantity: mat.quantity,
          uom: mat.uom,
          affectedAssets: [{ name: asset.name, tag: asset.assetTag }]
        });
      }
    });
  });

  if (groupBy === 'category') {
    const categoryGroups = new Map<string, MaterialReportGroup>();
    
    const masterGroup = reportGroups.get('Material Forecast');
    if (masterGroup) {
      masterGroup.items.forEach(item => {
        if (!categoryGroups.has(item.category)) {
          categoryGroups.set(item.category, { groupName: item.category, items: [] });
        }
        categoryGroups.get(item.category)!.items.push(item);
      });
    }
    return Array.from(categoryGroups.values()).sort((a, b) => a.groupName.localeCompare(b.groupName));
  }

  return Array.from(reportGroups.values()).sort((a, b) => a.groupName.localeCompare(b.groupName));
};
