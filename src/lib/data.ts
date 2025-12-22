
'use client';
import type { AppUser, Role, Technician, WorkOrder, WorkOrderNote, WorkSite } from '@/lib/types';
import { collection, getDoc, doc, runTransaction } from 'firebase/firestore';
import { getDocumentNonBlocking, getCollectionNonBlocking } from '@/firebase/non-blocking-reads';
import { sampleRoles, sampleTechnicians, sampleWorkOrders } from './sample-data';
import { setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { format } from 'date-fns';

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

        const adminRole = roles.find(r => r.name === 'Administrator');
        const technicianRole = roles.find(r => r.name === 'Technician');

        // Seed Technicians
        const technicianRefs = await Promise.all(
            sampleTechnicians.map(tech => {
                const [firstName, ...lastName] = tech.name.split(' ');
                const techData = {
                    firstName,
                    lastName: lastName.join(' '),
                    email: tech.email,
                    avatarUrl: tech.avatarUrl,
                    roleId: technicianRole?.id,
                    disabled: false,
                };
                return addDocumentNonBlocking(collection(db, 'technicians'), techData);
            })
        );
        
        const technicians = await Promise.all(
            technicianRefs.map(async (ref) => getDocumentNonBlocking(ref))
        );

        // Seed Work Orders
        for (const [index, wo] of sampleWorkOrders.entries()) {
            const assignedTechnician = technicians[index % technicians.length];
            const year = format(new Date(), 'yy');
            const counterRef = doc(db, 'counters', `work_orders_${year}`);

            const newId = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    nextNumber = counterDoc.data().lastNumber + 1;
                }
                transaction.set(counterRef, { lastNumber: nextNumber }, { merge: true });
                return `WO-${year}-${String(nextNumber).padStart(4, '0')}`;
            });

            const woRef = doc(db, 'work_orders', newId);
            const woData = {
                ...wo,
                id: newId,
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
      id: doc.id,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: data.status,
      assignedTechnicianId: data.assignedTechnicianId,
      createdAt: data.createdAt,
      dueDate: data.dueDate,
      notes: [], // Notes should be fetched separately if needed
    } as WorkOrder;
  });
  return workOrdersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    
    const notesCol = collection(db, 'work_orders', id, 'updates');
    const notesSnapshot = await getCollectionNonBlocking(notesCol);
    const notesList = notesSnapshot.docs.map(noteDoc => {
        const noteData = noteDoc.data();
        return {
            id: noteDoc.id,
            authorId: noteData.technicianId,
            text: noteData.notes,
            createdAt: noteData.updateDate,
            photoUrls: noteData.photoUrls || []
        } as WorkOrderNote
    });

    return {
      id: workOrderSnap.id,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: data.status,
      assignedTechnicianId: data.assignedTechnicianId,
      workSiteId: data.workSiteId,
      workSite: workSite,
      createdAt: data.createdAt,
      dueDate: data.dueDate,
      notes: notesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
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
