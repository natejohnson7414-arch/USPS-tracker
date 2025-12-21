import type { AppUser, Role, Technician, WorkOrder } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const getImage = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageUrl || '';

export const technicians: Technician[] = [
  { id: 'tech-1', name: 'Sarah Chen', avatarUrl: getImage('tech-1'), email: 's.chen@workflow.com', roleId: 'role-admin' },
  { id: 'tech-2', name: 'David Rodriguez', avatarUrl: getImage('tech-2'), email: 'd.rodriguez@workflow.com', roleId: 'role-tech' },
  { id: 'tech-3', name: 'Maria Garcia', avatarUrl: getImage('tech-3'), email: 'm.garcia@workflow.com', roleId: 'role-tech' },
  { id: 'tech-4', name: 'Ben Carter', avatarUrl: getImage('tech-4'), email: 'b.carter@workflow.com', roleId: 'role-tech' },
];

export const roles: Role[] = [
    { id: 'role-admin', name: 'Administrator' },
    { id: 'role-tech', name: 'Technician' },
];

let workOrders: WorkOrder[] = [
  {
    id: 'WO-001',
    title: 'Fix Leaking Faucet in Apt 2B',
    description: 'Tenant in apartment 2B reported a continuously dripping faucet in the bathroom sink. Please investigate and repair.',
    priority: 'High',
    status: 'In Progress',
    assignedTechnicianId: 'tech-1',
    createdAt: '2023-10-26T10:00:00Z',
    dueDate: '2023-10-27T17:00:00Z',
    notes: [
      {
        id: 'note-1',
        authorId: 'tech-1',
        text: 'Arrived on site. The issue is a worn-out washer. Will need to replace it.',
        createdAt: '2023-10-26T11:30:00Z',
        photoUrls: [getImage('work-photo-1')]
      }
    ],
  },
  {
    id: 'WO-002',
    title: 'Repair Lobby Door Lock',
    description: 'The main lobby door lock is jamming and difficult to operate. It needs to be repaired or replaced.',
    priority: 'Medium',
    status: 'Open',
    assignedTechnicianId: 'tech-2',
    createdAt: '2023-10-26T09:30:00Z',
    dueDate: '2023-10-28T17:00:00Z',
    notes: [],
  },
  {
    id: 'WO-003',
    title: 'Quarterly HVAC Inspection - Building A',
    description: 'Perform the scheduled quarterly HVAC maintenance for all units in Building A.',
    priority: 'Low',
    status: 'Open',
    createdAt: '2023-10-25T15:00:00Z',
    dueDate: '2023-11-15T17:00:00Z',
    notes: [],
  },
  {
    id: 'WO-004',
    title: 'Replace Broken Window - Unit 5C',
    description: 'A window in the living room of unit 5C was reported broken by the tenant. Needs immediate replacement.',
    priority: 'High',
    status: 'Completed',
    assignedTechnicianId: 'tech-3',
    createdAt: '2023-10-24T08:00:00Z',
    dueDate: '2023-10-24T17:00:00Z',
    notes: [
      {
        id: 'note-2',
        authorId: 'tech-3',
        text: 'Window pane measured and temporary seal applied. New glass ordered.',
        createdAt: '2023-10-24T09:15:00Z',
      },
      {
        id: 'note-3',
        authorId: 'tech-3',
        text: 'New glass installed and sealed. Job complete.',
        createdAt: '2023-10-24T14:00:00Z',
        photoUrls: [getImage('work-photo-2')]
      }
    ],
  },
  {
    id: 'WO-005',
    title: 'Electrical Outlet Not Working - Gym',
    description: 'The electrical outlet near the treadmills in the gym is not providing power.',
    priority: 'Medium',
    status: 'On Hold',
    assignedTechnicianId: 'tech-4',
    createdAt: '2023-10-26T11:00:00Z',
    dueDate: '2023-10-29T17:00:00Z',
    notes: [
      {
        id: 'note-4',
        authorId: 'tech-4',
        text: 'Checked the breaker, no issue there. The outlet itself seems faulty. Will need a specific part to replace it, placing on hold until part arrives.',
        createdAt: '2023-10-26T14:20:00Z',
        photoUrls: [getImage('work-photo-3')]
      }
    ],
  },
  {
    id: 'WO-006',
    title: 'Paint touch-up in Hallway 3rd Floor',
    description: 'Scuff marks and chips in the paint along the 3rd-floor hallway need to be touched up.',
    priority: 'Low',
    status: 'Open',
    createdAt: '2023-10-27T10:00:00Z',
    dueDate: '2023-11-05T17:00:00Z',
    notes: [],
  },
];

// In a real app, these would be API calls.
export const getWorkOrders = () => {
  return workOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getWorkOrderById = (id: string) => {
  return workOrders.find(order => order.id === id);
};

export const getTechnicians = () => {
  return technicians;
};

export const getTechnicianById = (id: string) => {
  return technicians.find(tech => tech.id === id);
};

export const getUsers = (): AppUser[] => {
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
