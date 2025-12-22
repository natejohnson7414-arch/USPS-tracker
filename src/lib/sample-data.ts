import type { Role, Technician, WorkOrder } from '@/lib/types';
import { PlaceHolderImages } from './placeholder-images';

export const sampleRoles: Omit<Role, 'id'>[] = [
    { name: 'Administrator' },
    { name: 'Technician' },
];

export const sampleTechnicians: Omit<Technician, 'id' | 'roleId'>[] = [
  {
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    avatarUrl: PlaceHolderImages.find(img => img.id === 'tech-1')?.imageUrl || '',
  },
  {
    name: 'David Rodriguez',
    email: 'david.rodriguez@example.com',
    avatarUrl: PlaceHolderImages.find(img => img.id === 'tech-2')?.imageUrl || '',
  },
   {
    name: 'Maria Garcia',
    email: 'maria.garcia@example.com',
    avatarUrl: PlaceHolderImages.find(img => img.id === 'tech-3')?.imageUrl || '',
  },
   {
    name: 'Ben Carter',
    email: 'ben.carter@example.com',
    avatarUrl: PlaceHolderImages.find(img => img.id === 'tech-4')?.imageUrl || '',
  },
];

export const sampleWorkOrders: Omit<WorkOrder, 'assignedTechnicianId' | 'notes'>[] = [
  {
    id: 'WO-24-0001',
    customerOrderId: 'CUST-A4B3',
    title: 'Fix leaking faucet in breakroom',
    description: 'The main faucet in the employee breakroom is continuously dripping. Please inspect and repair.',
    priority: 'High',
    status: 'Open',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'WO-24-0002',
    customerOrderId: 'CUST-X9Y8',
    title: 'Replace broken window in Conference Room A',
    description: 'A window pane was cracked during the recent storm. Needs to be replaced.',
    priority: 'Medium',
    status: 'Open',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'WO-24-0003',
    title: 'HVAC unit on rooftop making loud noises',
    description: 'The HVAC unit for the west wing is making a loud clanking noise. Suspect a loose fan belt.',
    priority: 'High',
    status: 'In Progress',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'WO-24-0004',
    customerOrderId: 'CUST-Z1C2',
    title: 'Annual fire extinguisher inspection',
    description: 'Perform the annual inspection for all fire extinguishers in the building.',
    priority: 'Low',
    status: 'Completed',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
  },
    {
    id: 'WO-24-0005',
    title: 'Repair faulty wiring in main server room',
    description: 'Lights are flickering in the server room. Possible faulty wiring or breaker issue. Urgent attention required.',
    priority: 'High',
    status: 'Open',
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

    