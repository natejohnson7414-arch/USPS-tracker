
'use client';
import type { 
  AppUser, Role, Technician, WorkOrder, WorkOrderNote, WorkSite, Client, 
  TrainingRecord, HvacStartupReport, TimeEntry, Activity, ActivityHistoryItem, 
  Quote, Asset, PmTemplate, AssetPmSchedule, AssetServiceHistory, Material
} from '@/lib/types';
import { collection, doc, query, where, arrayUnion, orderBy, collectionGroup, getDocs, documentId } from 'firebase/firestore';
import { getDocumentNonBlocking, getCollectionNonBlocking } from '@/firebase/non-blocking-reads';
import { sampleRoles, sampleTechnicians, sampleWorkOrders, sampleWorkSites, sampleClients } from './sample-data';
import { setDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { parseISO } from 'date-fns';

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
  try {
    const workOrderRef = doc(db, 'work_orders', id);
    const workOrderSnap = await getDocumentNonBlocking(workOrderRef);
    if (workOrderSnap.exists()) {
      const data = workOrderSnap.data();
      
      // Attempt to load associated data but catch failures gracefully
      let workSite = data.workSiteId ? await getWorkSiteById(db, data.workSiteId).catch(() => undefined) : undefined;
      let client = data.clientId ? await getClientById(db, data.clientId).catch(() => undefined) : undefined;
      
      const notesSnapshot = await getCollectionNonBlocking(collection(db, 'work_orders', id, 'updates')).catch(() => ({ docs: [] }));
      const notesList = notesSnapshot.docs.map((d: any) => ({ 
        id: d.id, 
        text: d.data().notes, 
        photoUrls: d.data().photoUrls || [], 
        createdAt: d.data().createdAt,
        excludeFromReport: d.data().excludeFromReport || false
      }));
      
      const activities = await getActivitiesByWorkOrderId(db, id).catch(() => []);
      
      return { 
        ...data, 
        id: workOrderSnap.id, 
        workSite, 
        client, 
        notes: notesList, 
        activities 
      } as WorkOrder;
    }
  } catch (error) {
    console.error(`Error in getWorkOrderById for ${id}:`, error);
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
    if (newStatus && newStatus !== data.status) {
        updateDocumentNonBlocking(workOrderRef, { status: newStatus });
    }
};

export const getAssets = async (db: any): Promise<Asset[]> => {
  const snapshot = await getCollectionNonBlocking(collection(db, 'assets'));
  const assets = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Asset));
  const sites = await getWorkSites(db);
  return assets.map(a => ({ ...a, siteName: sites.find(s => s.id === a.siteId)?.name }));
};

export const getAssetsByIds = async (db: any, ids: string[]): Promise<Asset[]> => {
  if (!ids || ids.length === 0) return [];
  // Firestore IN query limited to 10-30 items depending on SDK, but usually fine for assets on a job
  const q = query(collection(db, 'assets'), where(documentId(), 'in', ids.slice(0, 10)));
  const snapshot = await getCollectionNonBlocking(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Asset));
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

export const getAssetPmSchedules = async (db: any, assetId?: string): Promise<AssetPmSchedule[]> => {
  let q = collection(db, 'asset_pm_schedules');
  if (assetId) q = query(q, where('assetId', '==', assetId)) as any;
  const snapshot = await getCollectionNonBlocking(q);
  const standaloneSchedules = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AssetPmSchedule));
  
  const [assets, templates, sites] = await Promise.all([getAssets(db), getPmTemplates(db), getWorkSites(db)]);
  
  const filteredAssets = assetId ? assets.filter(a => a.id === assetId) : assets;
  const assetSchedules: AssetPmSchedule[] = filteredAssets
    .filter(a => a.pmFrequency && a.pmFrequency !== 'none')
    .map(a => {
      const currentYear = new Date().getFullYear();
      const dueDate = new Date(currentYear, (a.pmMonth || 1) - 1, 1);
      
      return {
        id: `asset-pm-${a.id}`,
        assetId: a.id,
        templateId: 'built-in',
        nextDueDate: dueDate.toISOString(),
        autoGenerateWorkOrder: false,
        status: 'active',
        assetName: a.name,
        assetTag: a.assetTag,
        siteId: a.siteId,
        siteName: sites.find(s => s.id === a.siteId)?.name,
        templateName: `${a.pmFrequency?.toUpperCase()} Maintenance`,
        frequencyType: a.pmFrequency,
        estimatedLaborHours: a.pmLaborHours || 0
      };
    });

  const combined = [...standaloneSchedules.map(s => {
    const asset = assets.find(a => a.id === s.assetId);
    const template = templates.find(t => t.id === s.templateId);
    return {
      ...s,
      assetName: asset?.name,
      assetTag: asset?.assetTag,
      siteId: asset?.siteId,
      siteName: sites.find(site => site.id === asset?.siteId)?.name,
      templateName: template?.name,
      frequencyType: template?.frequencyType,
      estimatedLaborHours: template?.estimatedLaborHours
    };
  }), ...assetSchedules];

  return combined;
};

export const getAssetServiceHistory = async (db: any, assetId: string): Promise<AssetServiceHistory[]> => {
  const q = query(collection(db, 'asset_service_history'), where('assetId', '==', assetId), orderBy('completedDate', 'desc'));
  const snapshot = await getCollectionNonBlocking(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AssetServiceHistory));
};

export const getTrainingRecordsByWorkOrderId = async (db: any, workOrderId: string): Promise<TrainingRecord[]> => {
    const q = query(collection(db, 'training_records'), where('workOrderId', '==', workOrderId));
    const snapshot = await getCollectionNonBlocking(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingRecord));
};

export const getTrainingRecordById = async (db: any, id: string): Promise<TrainingRecord | undefined> => {
    const snap = await getDocumentNonBlocking(doc(db, 'training_records', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } as TrainingRecord : undefined;
};

export const getTimeEntriesByWorkOrder = async (db: any, workOrderId: string): Promise<TimeEntry[]> => {
    try {
        const q = query(collection(db, 'time_entries'), where('workOrderId', '==', workOrderId));
        const snapshot = await getCollectionNonBlocking(q);
        
        return snapshot.docs.map((docRef) => ({ 
            id: docRef.id, 
            ...docRef.data() 
        } as TimeEntry));
    } catch (error) {
        console.error("Error in getTimeEntriesByWorkOrder:", error);
        return [];
    }
};

export const deleteTrainingRecord = async (db: any, recordId: string) => {
    const recordRef = doc(db, 'training_records', recordId);
    deleteDocumentNonBlocking(recordRef);
};

export const getQuotesByWorkOrderId = async (db: any, workOrderId: string): Promise<Quote[]> => {
    const q = query(collection(db, 'quotes'), where('workOrderId', '==', workOrderId));
    const snapshot = await getCollectionNonBlocking(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
};

export const getHvacStartupReportsByWorkOrderId = async (db: any, workOrderId: string): Promise<HvacStartupReport[]> => {
    const q = query(collection(db, 'hvac_startup_reports'), where('workOrderId', '==', workOrderId));
    const snapshot = await getCollectionNonBlocking(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HvacStartupReport));
};

export const getHvacStartupReportById = async (db: any, id: string): Promise<HvacStartupReport | undefined> => {
    const snap = await getDocumentNonBlocking(doc(db, 'hvac_startup_reports', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } as HvacStartupReport : undefined;
};

export const deleteHvacStartupReport = async (db: any, reportId: string) => {
    const reportRef = doc(db, 'hvac_startup_reports', reportId);
    deleteDocumentNonBlocking(reportRef);
};

export const addWorkHistoryItem = async (db: any, workOrderId: string, item: Omit<ActivityHistoryItem, 'id' | 'timestamp'>) => {
    const workOrderRef = doc(db, 'work_orders', workOrderId);
    const historyItem = {
        ...item,
        id: `hist-${Date.now()}`,
        timestamp: new Date().toISOString(),
    };
    updateDocumentNonBlocking(workOrderRef, {
        work_history: arrayUnion(historyItem)
    });
};

export const getTimeEntriesByTechnician = async (db: any, technicianId: string): Promise<TimeEntry[]> => {
    const q = query(collection(db, 'time_entries'), where('technicianId', '==', technicianId));
    const snapshot = await getCollectionNonBlocking(q);
    const entries = await Promise.all(snapshot.docs.map(async (docRef) => {
        const data = docRef.data();
        let workOrder;
        if (data.workOrderId) {
            const woSnap = await getDocumentNonBlocking(doc(db, 'work_orders', data.workOrderId));
            if (woSnap.exists()) {
                workOrder = { id: woSnap.id, jobName: woSnap.data().jobName };
            }
        }
        return { id: docRef.id, ...data, workOrder } as TimeEntry;
    }));
    return entries;
};

export const getQuoteById = async (db: any, id: string): Promise<Quote | undefined> => {
    const snap = await getDocumentNonBlocking(doc(db, 'quotes', id));
    if (!snap.exists()) return undefined;
    const data = snap.data();
    const client = data.clientId ? await getClientById(db, data.clientId) : undefined;
    const workSite = data.workSiteId ? await getWorkSiteById(db, data.workSiteId) : undefined;
    const createdBy = data.createdBy_technicianId ? await getTechnicianById(db, data.createdBy_technicianId) : undefined;
    return { ...data, id: snap.id, client, workSite, createdBy_technician: createdBy } as Quote;
};

export const getQuotes = async (db: any): Promise<Quote[]> => {
    const snapshot = await getCollectionNonBlocking(collection(db, 'quotes'));
    return Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data();
        const createdBy = data.createdBy_technicianId ? await getTechnicianById(db, data.createdBy_technicianId) : undefined;
        return { ...data, id: d.id, createdBy_technician: createdBy } as Quote;
    }));
};

export const getAllActivitiesWithDetails = async (db: any): Promise<Activity[]> => {
    const snapshot = await getCollectionNonBlocking(collectionGroup(db, 'activities'));
    const activities = await Promise.all(snapshot.docs.map(async (actDoc) => {
        const actData = actDoc.data();
        const workOrderRef = actDoc.ref.parent.parent;
        if (!workOrderRef) return null;
        
        const [woSnap, tech] = await Promise.all([
            getDocumentNonBlocking(workOrderRef),
            actData.technicianId ? getTechnicianById(db, actData.technicianId) : Promise.resolve(undefined)
        ]);
        
        if (!woSnap.exists()) return null;
        const woData = woSnap.data();
        const site = woData.workSiteId ? await getWorkSiteById(db, woData.workSiteId) : undefined;

        return {
            id: actDoc.id,
            ...actData,
            technician: tech,
            parentWorkOrder: {
                id: woSnap.id,
                jobName: woData.jobName,
                workSite: site
            }
        } as Activity;
    }));
    return activities.filter((a): a is Activity => a !== null).sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());
};

export const getUsers = async (db: any, roles: Role[]): Promise<AppUser[]> => {
    const snapshot = await getCollectionNonBlocking(collection(db, 'technicians'));
    return snapshot.docs.map(docRef => {
        const data = docRef.data();
        const role = roles.find(r => r.id === data.roleId);
        return {
            id: docRef.id,
            employeeId: data.employeeId,
            name: `${data.firstName} ${data.lastName}`,
            email: data.email,
            avatarUrl: data.avatarUrl,
            role: role?.name || 'User',
            disabled: data.disabled || false,
        } as AppUser;
    });
};

export const getMaterials = async (db: any): Promise<Material[]> => {
  const snapshot = await getCollectionNonBlocking(collection(db, 'materials'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Material)).sort((a, b) => a.name.localeCompare(b.name));
};

export const getMaterialById = async (db: any, id: string): Promise<Material | undefined> => {
  const snap = await getDocumentNonBlocking(doc(db, 'materials', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Material : undefined;
};

export const generatePmWorkOrders = async (db: any) => {
  return { count: 0 };
};

export const calculateAssetMetrics = (history: AssetServiceHistory[]) => {
  if (history.length < 2) return { mtbf: 0, mttr: 0 };
  
  const totalIntervals = history.length - 1;
  let totalTimeMs = 0;
  for (let i = 0; i < totalIntervals; i++) {
    totalTimeMs += new Date(history[i].completedDate).getTime() - new Date(history[i+1].completedDate).getTime();
  }
  const mtbfDays = (totalTimeMs / totalIntervals) / (1000 * 60 * 60 * 24);

  return { mtbf: mtbfDays, mttr: 4.5 }; 
};
