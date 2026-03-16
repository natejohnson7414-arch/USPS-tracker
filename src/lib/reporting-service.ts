
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

export interface LaborForecast {
  month: string;
  hours: number;
}

/**
 * Filter and project schedules for a target month.
 */
const getDueSchedulesForMonth = (schedules: AssetPmSchedule[], targetStart: Date, targetEnd: Date) => {
  return schedules.filter(s => {
    if (s.status !== 'active') return false;
    
    const startDueDate = parseISO(s.nextDueDate);
    
    // If it starts exactly in this month
    if (isWithinInterval(startDueDate, { start: targetStart, end: targetEnd })) {
      return true;
    }

    // If it's a recurring schedule, check if it projects into this month
    if (startDueDate < targetStart) {
      const monthsDiff = differenceInMonths(targetStart, startDueDate);
      
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
};

/**
 * Generates a labor hours forecast for the next 12 months.
 */
export const generateLaborForecast = async (db: any): Promise<LaborForecast[]> => {
  const [schedules] = await Promise.all([
    getAssetPmSchedules(db)
  ]);

  const forecast: LaborForecast[] = [];
  const today = new Date();

  for (let i = 0; i < 12; i++) {
    const monthDate = addMonths(today, i);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    
    const dueSchedules = getDueSchedulesForMonth(schedules, start, end);
    const totalHours = dueSchedules.reduce((acc, s) => acc + (s.estimatedLaborHours || 0), 0);

    forecast.push({
      month: format(monthDate, 'MMM yyyy'),
      hours: totalHours
    });
  }

  return forecast;
};

/**
 * Generates a material forecast report based on PM schedules due in a specific month.
 * Handles repeatable schedule logic to project future requirements.
 * Aggregates materials case-insensitively.
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
  const dueSchedules = getDueSchedulesForMonth(schedules, start, end).filter(s => {
    const asset = assets.find(a => a.id === s.assetId);
    return !asset ? false : (siteIds.length === 0 || siteIds.includes(asset.siteId));
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
      // Normalize for comparison
      const normalizedName = mat.name.toLowerCase().trim().replace(/\s+/g, ' ');
      
      let item = group.items.find(i => 
        i.name.toLowerCase().trim().replace(/\s+/g, ' ') === normalizedName && 
        i.category === mat.category
      );
      
      if (item) {
        item.quantity += mat.quantity;
        if (!item.affectedAssets.some(aa => aa.tag === asset.assetTag)) {
          item.affectedAssets.push({ name: asset.name, tag: asset.assetTag });
        }
      } else {
        group.items.push({
          name: mat.name, // Use the first encounter as the display name
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
