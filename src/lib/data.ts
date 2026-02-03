

'use client';
import type { AppUser, Role, Technician, WorkOrder, WorkOrderNote, WorkSite, Client, TrainingRecord, HvacStartupReport, TimeEntry, Activity, ActivityHistoryItem, Quote } from '@/lib/types';
import { collection, getDoc, doc, query, where, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getDocumentNonBlocking, getCollectionNonBlocking } from '@/firebase/non-blocking-reads';
import { sampleRoles, sampleTechnicians, sampleWorkOrders, sampleWorkSites, sampleClients } from './sample-data';
import { setDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';

export const seedDatabase = async (db: any) => {
    // Check if roles exist, which is a good indicator of a seeded DB
    const rolesSnapshot = await getCollectionNonBlocking(collection(db, 'roles'));
    if (rolesSnapshot.empty) {
        console.log("Seeding database with sample data...");
        
        // Seed Roles first
        const roleRefs = await Promise.all(
            sampleRoles.map(role => addDocumentNonBlocking(collection(db, 'roles'), role))
        );
        const roles = await Promise.all(
             roleRefs.map(async (ref, i) => ({ id: ref.id, ...sampleRoles[i] }))
        );

        const technicianRole = roles.find(r => r.name === 'Technician');

        // Seed Technicians from sample data
        await Promise.all(
            sampleTechnicians.map(tech => {
                const [firstName, ...lastName] = tech.name.split(' ');
                const techData = {
                    id: tech.id, // Use the id from sample data
                    employeeId: tech.employeeId,
                    firstName,
                    lastName: lastName.join(' '),
                    email: tech.email,
                    avatarUrl: tech.avatarUrl,
                    roleId: technicianRole?.id,
                    disabled: false,
                };
                // Use set with merge:false to ensure we are creating new, clean documents
                return setDocumentNonBlocking(doc(db, 'technicians', tech.id), techData, { merge: false });
            })
        );
        
        // Seed work sites
        await Promise.all(
            sampleWorkSites.map(site => setDocumentNonBlocking(doc(db, 'work_sites', site.id), site, { merge: false }))
        );
        
        // Seed clients
         await Promise.all(
            sampleClients.map(client => setDocumentNonBlocking(doc(db, 'clients', client.id), client, { merge: false }))
        );


        // Seed Work Orders
        for (const [index, wo] of sampleWorkOrders.entries()) {
            const assignedTechnician = sampleTechnicians[index % sampleTechnicians.length];
            const woRef = doc(db, 'work_orders', wo.id);
            const woData = {
                ...wo,
                assignedTechnicianId: assignedTechnician.id,
            };
            setDocumentNonBlocking(woRef, woData, { merge: false });
        }
        
        console.log("Database seeding complete.");
    } else {
        console.log("Database already contains data. Skipping seed.");
    }
    
    // Always ensure the non-productive work order exists
    const nonProductiveWorkOrderRef = doc(db, 'work_orders', '24-0001');
    const nonProductiveWorkOrderSnap = await getDocumentNonBlocking(nonProductiveWorkOrderRef);
    if (!nonProductiveWorkOrderSnap.exists()) {
        console.log("Creating non-productive work order...");
        await setDocumentNonBlocking(nonProductiveWorkOrderRef, {
            id: '24-0001',
            jobName: 'Non-Productive Time',
            description: 'Assign non-billable tasks like shop time, training, or meetings.',
            status: 'Open',
            createdDate: new Date(0).toISOString(),
            notes: [],
            activities: [],
            work_history: [],
        }, { merge: false });
    }
}


// This function now needs to be async and fetch from Firestore.
export const getWorkOrders = async (db: any): Promise<WorkOrder[]> => {
  const workOrdersCol = collection(db, 'work_orders');
  const workOrderSnapshot = await getCollectionNonBlocking(workOrdersCol);
  const workOrdersList = workOrderSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      notes: [], // Notes should be fetched separately if needed
    } as WorkOrder;
  });
  return workOrdersList.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
};

export const getWorkOrderById = async (db: any, id: string): Promise<WorkOrder | undefined> => {
  const workOrderRef = doc(db, 'work_orders', id);
  const workOrderSnap = await getDocumentNonBlocking(workOrderRef);

  if (workOrderSnap.exists()) {
    const data = workOrderSnap.data();
    
    let workSite;
    if (data.workSiteId) {
        workSite = await getWorkSiteById(db, data.workSiteId);
    }
    
    let client;
    if (data.clientId) {
        client = await getClientById(db, data.clientId);
    }
    
    const notesCol = collection(db, 'work_orders', id, 'updates');
    const notesSnapshot = await getCollectionNonBlocking(notesCol);
    const notesList = notesSnapshot.docs.map(noteDoc => {
        const noteData = noteDoc.data();
        return {
            id: noteDoc.id,
            text: noteData.notes,
            photoUrls: noteData.photoUrls || [],
            createdAt: noteData.createdAt,
        } as WorkOrderNote
    });

    const activities = await getActivitiesByWorkOrderId(db, id);

    return {
      ...data,
      id: workOrderSnap.id,
      workSite: workSite,
      client: client,
      notes: notesList,
      activities: activities,
    } as WorkOrder;
  } else {
    return undefined;
  }
};


export const getTechnicians = async (db: any): Promise<Technician[]> => {
    if (!db) return [];
    const techniciansCol = collection(db, 'technicians');
    const techSnapshot = await getCollectionNonBlocking(techniciansCol);
    const techList = techSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            employeeId: data.employeeId,
            name: `${data.firstName} ${data.lastName}`,
            avatarUrl: data.avatarUrl,
            email: data.email,
            roleId: data.roleId,
            disabled: data.disabled || false,
        } as Technician;
    });
    return techList;
};

export const getTechnicianById = async (db: any, id: string): Promise<Technician | undefined> => {
    if (!id) return undefined;
    const techRef = doc(db, 'technicians', id);
    const techSnap = await getDocumentNonBlocking(techRef);
    if(techSnap.exists()) {
        const data = techSnap.data();
         return {
            id: techSnap.id,
            employeeId: data.employeeId,
            name: `${data.firstName} ${data.lastName}`,
            avatarUrl: data.avatarUrl,
            email: data.email,
            roleId: data.roleId,
            disabled: data.disabled || false,
        } as Technician;
    }
    return undefined;
};


export const getRoles = async (db: any): Promise<Role[]> => {
    if (!db) return [];
    const rolesCol = collection(db, 'roles');
    const roleSnapshot = await getCollectionNonBlocking(rolesCol);
    return roleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
};

export const getUsers = async (db: any, roles: Role[]): Promise<AppUser[]> => {
    const technicians = await getTechnicians(db);
    
    return technicians.map(tech => {
        const role = roles.find(r => r.id === tech.roleId);
        return {
            id: tech.id,
            employeeId: tech.employeeId,
            name: tech.name,
            email: tech.email || 'N/A',
            avatarUrl: tech.avatarUrl,
            role: role?.name || 'Unknown',
            disabled: tech.disabled || false,
        };
    });
};

export const getWorkSites = async (db: any): Promise<WorkSite[]> => {
    if (!db) return [];
    const workSitesCol = collection(db, 'work_sites');
    const workSiteSnapshot = await getCollectionNonBlocking(workSitesCol);
    return workSiteSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkSite));
};

export const getWorkSiteById = async (db: any, id: string): Promise<WorkSite | undefined> => {
    if (!id) return undefined;
    const workSiteRef = doc(db, 'work_sites', id);
    const workSiteSnap = await getDocumentNonBlocking(workSiteRef);
    if (workSiteSnap.exists()) {
        return { id: workSiteSnap.id, ...workSiteSnap.data() } as WorkSite;
    }
    return undefined;
};

export const getClients = async (db: any): Promise<Client[]> => {
    if (!db) return [];
    const clientsCol = collection(db, 'clients');
    const clientSnapshot = await getCollectionNonBlocking(clientsCol);
    return clientSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
};

export const getClientById = async (db: any, id: string): Promise<Client | undefined> => {
    if (!id) return undefined;
    const clientRef = doc(db, 'clients', id);
    const clientSnap = await getDocumentNonBlocking(clientRef);
    if (clientSnap.exists()) {
        return { id: clientSnap.id, ...clientSnap.data() } as Client;
    }
    return undefined;
};


export const getTrainingRecordsByWorkOrderId = async (db: any, workOrderId: string): Promise<TrainingRecord[]> => {
    if (!db) return [];
    const trainingRecordsCol = collection(db, 'training_records');
    const q = query(trainingRecordsCol, where("workOrderId", "==", workOrderId));
    const snapshot = await getCollectionNonBlocking(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingRecord));
};

export const getTrainingRecordById = async (db: any, id: string): Promise<TrainingRecord | undefined> => {
    if (!id) return undefined;
    const trainingRecordRef = doc(db, 'training_records', id);
    const trainingRecordSnap = await getDocumentNonBlocking(trainingRecordRef);
    if (trainingRecordSnap.exists()) {
        return { id: trainingRecordSnap.id, ...trainingRecordSnap.data() } as TrainingRecord;
    }
    return undefined;
}

export const deleteTrainingRecord = async (db: any, id: string): Promise<void> => {
    if (!id) return;
    const trainingRecordRef = doc(db, 'training_records', id);
    await deleteDoc(trainingRecordRef);
};


export const getHvacStartupReportById = async (db: any, id: string): Promise<HvacStartupReport | undefined> => {
    if (!id) return undefined;
    const reportRef = doc(db, 'hvac_startup_reports', id);
    const reportSnap = await getDocumentNonBlocking(reportRef);
    if (reportSnap.exists()) {
        return { id: reportSnap.id, ...reportSnap.data() } as HvacStartupReport;
    }
    return undefined;
}

export const getTimeEntriesByTechnician = async (db: any, technicianId: string): Promise<TimeEntry[]> => {
    if (!db || !technicianId) return [];
    const timeEntriesCol = collection(db, 'time_entries');
    const q = query(timeEntriesCol, where("technicianId", "==", technicianId));
    const snapshot = await getCollectionNonBlocking(q);
    
    const entries = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        let workOrder;
        if (data.workOrderId) {
            workOrder = await getWorkOrderById(db, data.workOrderId);
        }
        return {
            id: doc.id,
            ...data,
            workOrder: workOrder || undefined,
        } as TimeEntry;
    }));

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
    
export const getTimeEntriesByWorkOrder = async (db: any, workOrderId: string): Promise<(TimeEntry & { technicianName?: string })[]> => {
    if (!db || !workOrderId) return [];
    const timeEntriesCol = collection(db, 'time_entries');
    const q = query(timeEntriesCol, where("workOrderId", "==", workOrderId));
    const snapshot = await getCollectionNonBlocking(q);
    
    const entries = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        let technician;
        if (data.technicianId) {
            technician = await getTechnicianById(db, data.technicianId);
        }
        return {
            id: doc.id,
            ...data,
            technicianName: technician?.name || 'Unknown User',
        } as TimeEntry & { technicianName?: string };
    }));

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
    

export const getActivitiesByWorkOrderId = async (db: any, workOrderId: string): Promise<Activity[]> => {
    if (!db || !workOrderId) return [];
    const activitiesCol = collection(db, 'work_orders', workOrderId, 'activities');
    const snapshot = await getCollectionNonBlocking(activitiesCol);

    const activities = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        let technician;
        if (data.technicianId) {
            technician = await getTechnicianById(db, data.technicianId);
        }
        return {
            id: doc.id,
            ...data,
            technician: technician || undefined,
        } as Activity;
    }));
    return activities.sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());
};

export const updateWorkOrderStatus = async (db: any, workOrderId: string) => {
    const activities = await getActivitiesByWorkOrderId(db, workOrderId);
    const workOrderRef = doc(db, 'work_orders', workOrderId);
    const workOrderSnap = await getDocumentNonBlocking(workOrderRef);

    if (!workOrderSnap.exists()) return;

    const currentStatus = workOrderSnap.data().status;
    if (currentStatus === 'Completed') return; 

    const hasActiveOrScheduled = activities.some(a => a.status === 'active' || a.status === 'scheduled');
    const hasCompleted = activities.some(a => a.status === 'completed');
    const hasOpenTasks = activities.some(a => a.status !== 'completed' && a.status !== 'cancelled');

    let newStatus: WorkOrder['status'] | null = null;

    if (hasActiveOrScheduled) {
        newStatus = 'In Progress';
    } else if (hasCompleted && !hasOpenTasks && currentStatus !== 'Open') {
        newStatus = 'Review';
    }
    
    if (newStatus && newStatus !== currentStatus) {
        await updateDocumentNonBlocking(workOrderRef, { status: newStatus });
    }
};

export const addWorkHistoryItem = async (db: any, workOrderId: string, item: Omit<ActivityHistoryItem, 'id' | 'timestamp'>) => {
    const workOrderRef = doc(db, 'work_orders', workOrderId);
    const historyItem = {
        ...item,
        id: `hist-${Date.now()}`,
        timestamp: new Date().toISOString(),
    };
    await updateDoc(workOrderRef, {
        work_history: arrayUnion(historyItem)
    });
};

export const getAllActivitiesWithDetails = async (db: any): Promise<Activity[]> => {
    if (!db) return [];
    const workOrdersSnap = await getCollectionNonBlocking(collection(db, 'work_orders'));
    let allActivities: Activity[] = [];

    // Using Promise.all to fetch activities for all work orders concurrently
    await Promise.all(workOrdersSnap.docs.map(async (woDoc) => {
        const activitiesSnap = await getCollectionNonBlocking(collection(db, 'work_orders', woDoc.id, 'activities'));
        if (!activitiesSnap.empty) {
            const workOrderData = woDoc.data();
            const workSite = workOrderData.workSiteId ? await getWorkSiteById(db, workOrderData.workSiteId) : undefined;
            
            const activities = activitiesSnap.docs.map(activityDoc => ({
                id: activityDoc.id,
                ...activityDoc.data(),
                parentWorkOrder: {
                    id: woDoc.id,
                    jobName: workOrderData.jobName,
                    description: workOrderData.description,
                    workSite: workSite
                }
            } as Activity));
            allActivities.push(...activities);
        }
    }));

    // Now, populate all technician details in one go
    const technicianIds = [...new Set(allActivities.map(a => a.technicianId).filter(Boolean))];
    const technicianPromises = technicianIds.map(id => getTechnicianById(db, id as string));
    const technicians = (await Promise.all(technicianPromises)).filter(Boolean) as Technician[];
    const technicianMap = new Map(technicians.map(t => [t.id, t]));

    const populatedActivities = allActivities.map(activity => ({
        ...activity,
        technician: activity.technicianId ? technicianMap.get(activity.technicianId) : undefined,
    }));

    return populatedActivities;
};

export const getIncompleteWorkOrders = async (db: any): Promise<WorkOrder[]> => {
    if (!db) return [];
    const workOrdersCol = collection(db, 'work_orders');
    const q = query(workOrdersCol, where("status", "!=", "Completed"));
    const snapshot = await getCollectionNonBlocking(q);
    
    const workOrdersList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            notes: [], // These are not needed for the list view
            activities: [], // These are not needed for the list view
        } as WorkOrder;
    });
     return workOrdersList.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
};

export const getQuotesByWorkOrderId = async (db: any, workOrderId: string): Promise<Quote[]> => {
    if (!db || !workOrderId) return [];
    const quotesCol = collection(db, 'quotes');
    const q = query(quotesCol, where("workOrderId", "==", workOrderId));
    const snapshot = await getCollectionNonBlocking(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
};

export const getQuoteById = async (db: any, id: string): Promise<Quote | undefined> => {
    const quoteRef = doc(db, 'quotes', id);
    const quoteSnap = await getDocumentNonBlocking(quoteRef);

    if (quoteSnap.exists()) {
        const data = quoteSnap.data();
        
        const [client, workSite, technician] = await Promise.all([
            data.clientId ? getClientById(db, data.clientId) : Promise.resolve(undefined),
            data.workSiteId ? getWorkSiteById(db, data.workSiteId) : Promise.resolve(undefined),
            data.createdBy_technicianId ? getTechnicianById(db, data.createdBy_technicianId) : Promise.resolve(undefined)
        ]);

        return {
            ...data,
            id: quoteSnap.id,
            client,
            workSite,
            createdBy_technician: technician
        } as Quote;
    } else {
        return undefined;
    }
};

export const getQuotes = async (db: any): Promise<Quote[]> => {
  if (!db) return [];
  const quotesCol = collection(db, 'quotes');
  const snapshot = await getCollectionNonBlocking(quotesCol);
  
  const quotes = await Promise.all(snapshot.docs.map(async doc => {
    const data = doc.data();
    const client = data.clientId ? await getClientById(db, data.clientId) : undefined;
    return {
      ...data,
      id: doc.id,
      client,
    } as Quote;
  }));
  
  return quotes.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
};
