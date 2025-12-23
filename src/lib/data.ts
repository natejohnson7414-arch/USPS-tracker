
'use client';
import type { AppUser, Role, Technician, WorkOrder, WorkOrderNote, WorkSite, Client, TrainingRecord } from '@/lib/types';
import { collection, getDoc, doc, query, where } from 'firebase/firestore';
import { getDocumentNonBlocking, getCollectionNonBlocking } from '@/firebase/non-blocking-reads';
import { sampleRoles, sampleTechnicians, sampleWorkOrders, sampleWorkSites, sampleClients } from './sample-data';
import { setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';

export const seedDatabase = async (db: any) => {
    // Check if roles exist
    const rolesSnapshot = await getCollectionNonBlocking(collection(db, 'roles'));
    if (rolesSnapshot.empty) {
        console.log("Seeding database with sample data...");
        // Seed Roles
        const roleRefs = await Promise.all(
            sampleRoles.map(role => addDocumentNonBlocking(collection(db, 'roles'), role))
        );
        const roles = await Promise.all(
             roleRefs.map(async (ref, i) => ({ id: ref.id, ...sampleRoles[i] }))
        );

        const technicianRole = roles.find(r => r.name === 'Technician');

        // Seed Technicians
        const technicianRefs = await Promise.all(
            sampleTechnicians.map(tech => {
                const [firstName, ...lastName] = tech.name.split(' ');
                const techData = {
                    id: tech.id, // Use the id from sample data
                    firstName,
                    lastName: lastName.join(' '),
                    email: tech.email,
                    avatarUrl: tech.avatarUrl,
                    roleId: technicianRole?.id,
                    disabled: false,
                };
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
            photoUrls: noteData.photoUrls || []
        } as WorkOrderNote
    });

    return {
      ...data,
      id: workOrderSnap.id,
      workSite: workSite,
      client: client,
      notes: notesList,
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

    