
'use client';
import type { 
  AppUser, Role, Technician, WorkOrder, WorkOrderNote, WorkSite, Client, 
  TrainingRecord, HvacStartupReport, TimeEntry, Activity, ActivityHistoryItem, 
  Quote, Asset, PmTemplate, AssetPmSchedule, AssetServiceHistory, Material
} from '@/lib/types';
import { collection, getDoc, doc, query, where, arrayUnion, orderBy, limit, getDocs, writeBatch } from 'firebase/firestore';
import { getDocumentNonBlocking, getCollectionNonBlocking } from '@/firebase/non-blocking-reads';
import { sampleRoles, sampleTechnicians, sampleWorkOrders, sampleWorkSites, sampleClients } from './sample-data';
import { setDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { addDays, addMonths, format } from 'date-fns';

export const seedDatabase = async (db: any) => {
    const rolesSnapshot = await getCollectionNonBlocking(collection(db, 'roles'));
    if (rolesSnapshot.empty) {
        console.log("Seeding database...");
        const roleRefs = await Promise.all(sampleRoles.map(role => addDocumentNonBlocking(collection(db, 'roles'), role)));
        const roles = await Promise.all(roleRefs.map(async (ref, i) => ({ id: ref.id, ...sampleRoles[i] })));
        const technicianRole = roles.find(r => r.name === 'Technician');

        await Promise.all(sampleTechnicians.map(tech => {
            const [firstName, ...lastName] = tech.name.split(' ');
            const techData = {
                id: tech.id,
                employeeId: tech.employeeId,
                firstName,
                lastName: lastName.join(' '),
                email: tech.email,
                avatarUrl: tech.avatarUrl,
                roleId: technicianRole?.id,
                disabled: false,
            };
            return setDocumentNonBlocking(doc(db, 'technicians', tech.id), techData, { merge: false });
        }));
        
        await Promise.all(sampleWorkSites.map(site => setDocumentNonBlocking(doc(db, 'work_sites', site.id), site, { merge: false })));
        await Promise.all(sampleClients.map(client => setDocumentNonBlocking(doc(db, 'clients', client.id), client, { merge: false })));

        for (const [index, wo] of sampleWorkOrders.entries()) {
            const assignedTechnician = sampleTechnicians[index % sampleTechnicians.length];
            setDocumentNonBlocking(doc(db, 'work_orders', wo.id), { ...wo, assignedTechnicianId: assignedTechnician.id }, { merge: false });
        }
    }
};

export const getWorkOrderById = async (db: any, id: string): Promise<WorkOrder | undefined> => {
  const workOrderRef = doc(db, 'work_orders', id);
  const workOrderSnap = await getDocumentNonBlocking(workOrderRef);
  if (workOrderSnap.exists()) {
    const data = workOrderSnap.data();
    let workSite = data.workSiteId ? await getWorkSiteById(db, data.workSiteId) : undefined;
    let client = data.clientId ? await getClientById(db, data.clientId) : undefined;
    const notesSnapshot = await getCollectionNonBlocking(collection(db, 'work_orders', id, 'updates'));
    const notesList = notesSnapshot.docs.map(d => ({ id: d.id, text: d.data().notes, photoUrls: d.data().photoUrls || [], createdAt: d.data().createdAt }));
    const activities = await getActivitiesByWorkOrderId(db, id);
    return { ...data, id: workOrderSnap.id, workSite, client, notes: notesList, activities } as WorkOrder;
  }
  return undefined;
};

export const getTechnicians = async (db: any): Promise<Technician[]> => {
    const techSnapshot = await getCollectionNonBlocking(collection(db, 'technicians'));
    return techSnapshot.docs.map(doc => ({ id: doc.id, employeeId: doc.data().employeeId, name: `${doc.data().firstName} ${doc.data().lastName}`, avatarUrl: doc.data().avatarUrl, email: doc.data().email, roleId: doc.data().roleId, disabled: doc.data().disabled || false }));
};

export const getTechnicianById = async (db: any, id: string): Promise<Technician | undefined> => {
    if (!id) return undefined;
    const techSnap = await getDocumentNonBlocking(doc(db, 'technicians', id));
    if(techSnap.exists()) {
        const data = techSnap.data();
        return { id: techSnap.id, employeeId: data.employeeId, name: `${data.firstName} ${data.lastName}`, avatarUrl: data.avatarUrl, email: data.email, roleId: data.roleId, disabled: data.disabled || false };
    }
    return undefined;
};

export const getRoles = async (db: any): Promise<Role[]> => {
    const roleSnapshot = await getCollectionNonBlocking(collection(db, 'roles'));
    return roleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
};

export const getWorkSites = async (db: any): Promise<WorkSite[]> => {
    const snapshot = await getCollectionNonBlocking(collection(db, 'work_sites'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkSite));
};

export const getWorkSiteById = async (db: any, id: string): Promise<WorkSite | undefined> => {
    if (!id) return undefined;
    const snap = await getDocumentNonBlocking(doc(db, 'work_sites', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } as WorkSite : undefined;
};

export const getClients = async (db: any): Promise<Client[]> => {
    const snapshot = await getCollectionNonBlocking(collection(db, 'clients'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
};

export const getClientById = async (db: any, id: string): Promise<Client | undefined> => {
    if (!id) return undefined;
    const snap = await getDocumentNonBlocking(doc(db, 'clients', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } as Client : undefined;
};

export const getActivitiesByWorkOrderId = async (db: any, workOrderId: string): Promise<Activity[]> => {
    const snapshot = await getCollectionNonBlocking(collection(db, 'work_orders', workOrderId, 'activities'));
    const activities = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const technician = data.technicianId ? await getTechnicianById(db, data.technicianId) : undefined;
        return { id: doc.id, ...data, technician } as Activity;
    }));
    return activities.sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());
};

export const updateWorkOrderStatus = async (db: any, workOrderId: string) => {
    const activities = await getActivitiesByWorkOrderId(db, workOrderId);
    const workOrderRef = doc(db, 'work_orders', workOrderId);
    const workOrderSnap = await getDocumentNonBlocking(workOrderRef);
    if (!workOrderSnap.exists()) return;
    const data = workOrderSnap.data();
    if (data.status === 'Completed') return;
    const hasActive = activities.some(a => a.status === 'active' || a.status === 'scheduled');
    const hasCompleted = activities.some(a => a.status === 'completed');
    const hasOpen = activities.some(a => a.status !== 'completed' && a.status !== 'cancelled');
    let newStatus: WorkOrder['status'] | null = null;
    if (hasActive) newStatus = 'In Progress';
    else if (hasCompleted && !hasOpen && data.status !== 'Open') newStatus = 'Review';
    if (newStatus && newStatus !== data.status) await updateDocumentNonBlocking(workOrderRef, { status: newStatus });
};

// --- Asset & PM Services ---

export const getAssets = async (db: any): Promise<Asset[]> => {
  const snapshot = await getCollectionNonBlocking(collection(db, 'assets'));
  const assets = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Asset));
  const sites = await getWorkSites(db);
  return assets.map(a => ({ ...a, siteName: sites.find(s => s.id === a.siteId)?.name }));
};

export const getAssetsBySiteId = async (db: any, siteId: string): Promise<Asset[]> => {
  const q = query(collection(db, 'assets'), where('siteId', '==', siteId));
  const snapshot = await getCollectionNonBlocking(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Asset));
};

export const getAssetById = async (db: any, id: string): Promise<Asset | undefined> => {
  const snap = await getDocumentNonBlocking(doc(db, 'assets', id));
  if (!snap.exists()) return undefined;
  const data = snap.data() as Asset;
  const site = await getWorkSiteById(db, data.siteId);
  return { ...data, id: snap.id, siteName: site?.name };
};

export const getPmTemplates = async (db: any): Promise<PmTemplate[]> => {
  const snapshot = await getCollectionNonBlocking(collection(db, 'pm_templates'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PmTemplate));
};

export const getPmTemplateById = async (db: any, id: string): Promise<PmTemplate | undefined> => {
  const snap = await getDocumentNonBlocking(doc(db, 'pm_templates', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as PmTemplate : undefined;
};

export const getAssetPmSchedules = async (db: any, assetId?: string): Promise<AssetPmSchedule[]> => {
  let q = collection(db, 'asset_pm_schedules');
  if (assetId) q = query(q, where('assetId', '==', assetId)) as any;
  const snapshot = await getCollectionNonBlocking(q);
  const schedules = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AssetPmSchedule));
  const [assets, templates, sites] = await Promise.all([getAssets(db), getPmTemplates(db), getWorkSites(db)]);
  return schedules.map(s => {
    const asset = assets.find(a => a.id === s.assetId);
    const template = templates.find(t => t.id === s.templateId);
    return {
      ...s,
      assetName: asset?.name,
      assetTag: asset?.assetTag,
      siteId: asset?.siteId,
      siteName: sites.find(site => site.id === asset?.siteId)?.name,
      templateName: template?.name,
      frequencyType: template?.frequencyType
    };
  });
};

export const getAssetServiceHistory = async (db: any, assetId: string): Promise<AssetServiceHistory[]> => {
  const q = query(collection(db, 'asset_service_history'), where('assetId', '==', assetId), orderBy('completedDate', 'desc'));
  const snapshot = await getCollectionNonBlocking(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AssetServiceHistory));
};

// --- Material Services ---

export const getMaterials = async (db: any): Promise<Material[]> => {
  const snapshot = await getCollectionNonBlocking(collection(db, 'materials'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Material)).sort((a, b) => a.name.localeCompare(b.name));
};

export const getMaterialById = async (db: any, id: string): Promise<Material | undefined> => {
  const snap = await getDocumentNonBlocking(doc(db, 'materials', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Material : undefined;
};

// Automation Service
export const generatePmWorkOrders = async (db: any) => {
  // Manual trigger removed as per request to not auto-generate work orders.
  return { count: 0 };
};

// Calculation Metrics
export const calculateAssetMetrics = (history: AssetServiceHistory[]) => {
  if (history.length < 2) return { mtbf: 0, mttr: 0 };
  
  // Simplified MTBF: average time between service records
  const totalIntervals = history.length - 1;
  let totalTimeMs = 0;
  for (let i = 0; i < totalIntervals; i++) {
    totalTimeMs += new Date(history[i].completedDate).getTime() - new Date(history[i+1].completedDate).getTime();
  }
  const mtbfDays = (totalTimeMs / totalIntervals) / (1000 * 60 * 60 * 24);

  return { mtbf: mtbfDays, mttr: 4.5 }; // MTTR placeholder without explicit repair time tracking
};
