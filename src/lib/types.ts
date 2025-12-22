
export type Technician = {
  id: string;
  name: string;
  avatarUrl: string;
  email?: string;
  roleId?: string;
  disabled?: boolean;
};

export type WorkOrderNote = {
  id: string;
  authorId: string;
  text: string;
  photoUrls?: string[];
  createdAt: string;
};

export type WorkOrder = {
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'In Progress' | 'On Hold' | 'Completed';
  assignedTechnicianId?: string;
  workSiteId?: string;
  createdAt: string;
  dueDate: string;
  notes: WorkOrderNote[];
};

export type Role = {
    id: string;
    name: string;
}

export type AppUser = {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
    role: string;
    disabled?: boolean;
}

export type WorkSite = {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    contact?: {
        name: string;
        phone: string;
        email: string;
    };
    notes?: string;
}
