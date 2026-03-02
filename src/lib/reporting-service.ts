
'use client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { AssetPmSchedule, PmTemplate, RequiredMaterial, WorkSite, Asset, AssetMaterial } from '@/lib/types';
import { getAssetPmSchedules, getPmTemplates, getWorkSites, getAssets } from './data';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, addMonths } from 'date-fns';

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

  // Filter schedules by date and site
  const dueSchedules = schedules.filter(s => {
    const dueDate = parseISO(s.nextDueDate);
    const asset = assets.find(a => a.id === s.assetId);
    if (!asset) return false;
    
    const isDue = isWithinInterval(dueDate, { start, end });
    const isCorrectSite = siteIds.length === 0 || siteIds.includes(asset.siteId);
    
    return isDue && isCorrectSite && s.status === 'active';
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
      const itemKey = groupBy === 'category' ? `${mat.category} - ${mat.name}` : mat.name;
      
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

  // If grouping by category, we need a different top-level structure
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

export const generateMonthlyMaterialsForecast = async (db: any, year: number, month: number): Promise<SiteForecast[]> => {
  const targetDate = new Date(year, month - 1, 1);
  const start = startOfMonth(targetDate);
  const end = endOfMonth(targetDate);

  const [schedules, templates, sites, assets] = await Promise.all([
    getAssetPmSchedules(db),
    getPmTemplates(db),
    getWorkSites(db),
    getAssets(db)
  ]);

  const siteMap = new Map<string, SiteForecast>();

  schedules.forEach(schedule => {
    const dueDate = parseISO(schedule.nextDueDate);
    if (isWithinInterval(dueDate, { start, end })) {
      const template = templates.find(t => t.id === schedule.templateId);
      const asset = assets.find(a => a.id === schedule.assetId);
      if (template && asset) {
        const site = sites.find(s => s.id === asset.siteId);
        if (!site) return;

        if (!siteMap.has(site.id)) {
          siteMap.set(site.id, { siteId: site.id, siteName: site.name, materials: [] });
        }

        const siteForecast = siteMap.get(site.id)!;
        template.requiredMaterials.forEach(mat => {
          const existing = siteForecast.materials.find(m => m.materialId === mat.materialId);
          if (existing) {
            existing.quantity += mat.quantity;
          } else {
            siteForecast.materials.push({ ...mat, category: 'General' });
          }
        });
      }
    }
  });

  return Array.from(siteMap.values());
};

export const generateLaborForecast = async (db: any, monthsAhead: number = 6): Promise<{ month: string, hours: number }[]> => {
  const [schedules, templates] = await Promise.all([
    getAssetPmSchedules(db),
    getPmTemplates(db)
  ]);

  const forecast: Record<string, number> = {};
  const today = new Date();

  for (let i = 0; i < monthsAhead; i++) {
    const monthKey = format(addMonths(today, i), 'yyyy-MM');
    forecast[monthKey] = 0;
  }

  schedules.forEach(schedule => {
    const dueDate = parseISO(schedule.nextDueDate);
    const monthKey = format(dueDate, 'yyyy-MM');
    if (forecast[monthKey] !== undefined) {
      const template = templates.find(t => t.id === schedule.templateId);
      if (template) {
        forecast[monthKey] += template.estimatedLaborHours;
      }
    }
  });

  return Object.entries(forecast).map(([month, hours]) => ({ month, hours }));
};
