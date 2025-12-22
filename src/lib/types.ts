

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
  id: string; // Job #
  createdDate: string; // DATE
  billTo?: string; // BILL TO
  poNumber?: string; // PO#
  contactInfo?: string; // CONTACT INFO
  jobName: string; // JOB NAME
  workSiteId?: string; // JOB SITE
  workSite?: WorkSite; // JOB SITE (populated)
  description: string; // JOB DESCRIPTION
  serviceScheduleDate?: string; // SERVICE SCHEDULE DATE
  quotedAmount?: number; // QUOTED AMOUNT
  taxable?: boolean; // TAXABLE
  timeAndMaterial?: boolean; // TIME & MATERIAL
  exempt?: boolean; // EXEMPT
  permit?: boolean; // PERMIT
  locates?: string; // LOCATES
  locatesDone?: string; // LOCATES DONE
  permitCost?: number; // PERMIT COST
  digNumber?: string; // DIG#
  permitFiled?: string; // PERMIT FILED
  coi?: boolean; // COI
  coiRequested?: string; // COI REQUESTED
  bondNeeded?: string; // BOND NEEDED
  bondAppliedFor?: string; // APPLIED FOR
  bondSent?: string; // SENT
  certifiedPayroll?: boolean; // CERTIFIED PAYROLL
  certifiedPayrollRequested?: string; // REQUESTED
  intercoPO?: string; // INTERCO PO#
  customerPO?: string; // CUSTOMER PO#
  estimator?: string; // ESTIMATOR/REQUESTED BY
  status: 'Open' | 'In Progress' | 'On Hold' | 'Completed';
  assignedTechnicianId?: string;
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

    