
import type { Role, Technician, WorkOrder, Client, WorkSite } from '@/lib/types';
import { PlaceHolderImages } from './placeholder-images';

export const sampleRoles: Omit<Role, 'id'>[] = [
    { name: 'Administrator' },
    { name: 'Technician' },
];

export const sampleTechnicians: Omit<Technician, 'roleId'>[] = [
  {
    id: 'tech_1',
    name: 'Sarah Chen',
    email: 'admin@crawford-company.com',
    avatarUrl: PlaceHolderImages.find(img => img.id === 'tech-1')?.imageUrl || '',
  },
  {
    id: 'tech_2',
    name: 'David Rodriguez',
    email: 'david.rodriguez@example.com',
    avatarUrl: PlaceHolderImages.find(img => img.id === 'tech-2')?.imageUrl || '',
  },
   {
    id: 'tech_3',
    name: 'Maria Garcia',
    email: 'maria.garcia@example.com',
    avatarUrl: PlaceHolderImages.find(img => img.id === 'tech-3')?.imageUrl || '',
  },
   {
    id: 'tech_4',
    name: 'Ben Carter',
    email: 'ben.carter@example.com',
    avatarUrl: PlaceHolderImages.find(img => img.id === 'tech-4')?.imageUrl || '',
  },
];

export const sampleWorkSites: WorkSite[] = [
    {
        id: 'usps-indianapolis',
        name: 'USPS - Indianapolis',
        address: '125 W South St, Indianapolis, IN 46206',
        city: 'Indianapolis',
        state: 'IN',
        zip: '46206'
    },
    {
        id: 'downtown-office',
        name: 'Downtown Office',
        address: '45 N Pennsylvania St, Indianapolis, IN 46204',
        city: 'Indianapolis',
        state: 'IN',
        zip: '46204'
    }
];

export const sampleClients: Client[] = [
    {
        id: 'cts-client',
        name: 'CTS',
        address: '123 Tech Way, Indianapolis, IN 46268',
        city: 'Indianapolis',
        state: 'IN',
        zip: '46268'
    }
];


export const sampleWorkOrders: Omit<WorkOrder, 'assignedTechnicianId' | 'notes' | 'workSite' | 'client'>[] = [
  {
    id: '25-6775',
    customerPO: 'SC4185',
    jobName: 'No Heat Boiler',
    description: 'The main faucet in the employee breakroom is continuously dripping. Please inspect and repair.',
    status: 'Open',
    createdDate: new Date('2025-06-19').toISOString(),
    clientId: 'cts-client',
    estimator: 'Scott Stubblefield',
    timeAndMaterial: true,
    permit: false,
    coi: false,
    certifiedPayroll: true,
    certifiedPayrollRequested: new Date('2025-12-16').toISOString(),
    workSiteId: 'usps-indianapolis' // Example, you'd create this work site
  },
  {
    id: 'WO-24-0002',
    customerPO: 'CUST-X9Y8',
    jobName: 'Replace broken window',
    description: 'A window pane was cracked during the recent storm. Needs to be replaced.',
    status: 'Open',
    createdDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    serviceScheduleDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    workSiteId: 'downtown-office',
  },
  {
    id: 'WO-24-0003',
    jobName: 'HVAC unit noisy',
    description: 'The HVAC unit for the west wing is making a loud clanking noise. Suspect a loose fan belt.',
    status: 'In Progress',
    createdDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    serviceScheduleDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    workSiteId: 'usps-indianapolis',
  },
  {
    id: 'WO-24-0004',
    customerPO: 'CUST-Z1C2',
    jobName: 'Fire extinguisher inspection',
    description: 'Perform the annual inspection for all fire extinguishers in the building.',
    status: 'Completed',
    createdDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    serviceScheduleDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    workSiteId: 'downtown-office',
  },
    {
    id: 'WO-24-0005',
    jobName: 'Repair faulty server room wiring',
    description: 'Lights are flickering in the server room. Possible faulty wiring or breaker issue. Urgent attention required.',
    status: 'Open',
    createdDate: new Date().toISOString(),
    serviceScheduleDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    workSiteId: 'usps-indianapolis',
  },
];
