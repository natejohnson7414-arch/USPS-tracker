
'use client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { AssetPmSchedule, PmTemplate, RequiredMaterial, WorkSite } from '@/lib/types';
import { getAssetPmSchedules, getPmTemplates, getWorkSites } from './data';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export interface MaterialForecast {
  materialId: string;
  name: string;
  quantity: number;
  uom: string;
}

export interface SiteForecast {
  siteId: string;
  siteName: string;
  materials: MaterialForecast[];
}

export const generateMonthlyMaterialsForecast = async (db: any, year: number, month: number): Promise<SiteForecast[]> => {
  const targetDate = new Date(year, month - 1, 1);
  const start = startOfMonth(targetDate);
  const end = endOfMonth(targetDate);

  const [schedules, templates, sites, assets] = await Promise.all([
    getAssetPmSchedules(db),
    getPmTemplates(db),
    getWorkSites(db),
    // Fetch all assets to map schedules to sites
    getDocs(collection(db, 'assets')).then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as any)))
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
            siteForecast.materials.push({ ...mat });
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
