export type Technician = {
  id: string;
  name: string;
  avatarUrl: string;
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
  createdAt: string;
  dueDate: string;
  notes: WorkOrderNote[];
};
