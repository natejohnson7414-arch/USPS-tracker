
'use client';
import type { AppUser, Role, Technician, WorkOrder, WorkOrderNote } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getSdks } from '@/firebase'; // Assuming getSdks is exported and gives firestore instance

const getImage = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageUrl || '';

// In a real app, these would be API calls.

// This function now needs to be async and fetch from Firestore.
export const getWorkOrders = async (db: any): Promise<WorkOrder[]> => {
  const workOrdersCol = collection(db, 'work_orders');
  const workOrderSnapshot = await getDocs(workOrdersCol);
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
  const workOrderSnap = await getDoc(workOrderRef);

  if (workOrderSnap.exists()) {
    const data = workOrderSnap.data();
    const notesCol = collection(db, 'work_orders', id, 'updates');
    const notesSnapshot = await getDocs(notesCol);
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
      createdAt: data.createdAt,
      dueDate: data.dueDate,
      notes: notesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    } as WorkOrder;
  } else {
    return undefined;
  }
};


export const getTechnicians = async (db: any): Promise<Technician[]> => {
    const techniciansCol = collection(db, 'technicians');
    const techSnapshot = await getDocs(techniciansCol);
    const techList = techSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: `${data.firstName} ${data.lastName}`,
            avatarUrl: getImage(doc.id) || getImage('tech-1'), // Fallback avatar
            email: data.email,
            roleId: data.roleId,
        } as Technician;
    });
    return techList;
};

export const getTechnicianById = async (db: any, id: string): Promise<Technician | undefined> => {
    if (!id) return undefined;
    const techRef = doc(db, 'technicians', id);
    const techSnap = await getDoc(techRef);
    if(techSnap.exists()) {
        const data = techSnap.data();
         return {
            id: techSnap.id,
            name: `${data.firstName} ${data.lastName}`,
            avatarUrl: getImage(techSnap.id) || getImage('tech-1'),
            email: data.email,
            roleId: data.roleId,
        } as Technician;
    }
    return undefined;
};


export const getRoles = async (db: any): Promise<Role[]> => {
    const rolesCol = collection(db, 'roles');
    const roleSnapshot = await getDocs(rolesCol);
    return roleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
};

export const getUsers = async (db: any): Promise<AppUser[]> => {
    const technicians = await getTechnicians(db);
    const roles = await getRoles(db);
    
    return technicians.map(tech => {
        const role = roles.find(r => r.id === tech.roleId);
        return {
            id: tech.id,
            name: tech.name,
            email: tech.email || 'N/A',
            avatarUrl: tech.avatarUrl,
            role: role?.name || 'Unknown'
        };
    });
};
