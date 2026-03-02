
export type FileAttachment = {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
};

export type Acknowledgement = {
  name: string;
  signatureUrl: string;
  date: string;
};

export type Technician = {
  id: string;
  employeeId?: string;
  name: string;
  avatarUrl: string;
  email?: string;
  roleId?: string;
  disabled?: boolean;
  passwordChangeRequired?: boolean;
};

export type WorkOrderNote = {
  id: string;
  text: string;
  createdAt: string;
  photoUrls?: string[];
};

export type Activity = {
  id: string;
  workOrderId: string;
  technicianId: string;
  createdDate: string;
  scheduled_date: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  description: string;
  technician?: Technician;
  parentWorkOrder?: Partial<WorkOrder>;
};

export type ActivityHistoryItem = {
  id: string;
  timestamp: string;
  type: 'note' | 'time_log' | 'status_change' | 'activity_update';
  text: string;
  authorId: string;
  authorName: string;
};

export type WorkOrder = {
  id: string;
  createdDate: string;
  billTo?: string;
  clientId?: string;
  client?: Client;
  poNumber?: string;
  contactInfo?: string;
  jobName: string;
  workSiteId?: string;
  workSite?: WorkSite;
  description: string;
  serviceScheduleDate?: string;
  quotedAmount?: number;
  taxable?: boolean;
  timeAndMaterial?: boolean;
  exempt?: boolean;
  permit?: boolean;
  locates?: string;
  locatesDone?: string;
  permitCost?: number;
  digNumber?: string;
  permitFiled?: string;
  coi?: boolean;
  coiRequested?: string;
  bondNeeded?: string;
  bondAppliedFor?: string;
  bondSent?: string;
  certifiedPayroll?: boolean;
  certifiedPayrollRequested?: string;
  intercoPO?: string;
  customerPO?: string;
  estimator?: string;
  status: 'Open' | 'In Progress' | 'On Hold' | 'Review' | 'Completed';
  assignedTechnicianId?: string;
  notes: WorkOrderNote[];
  activities: Activity[];
  work_history: ActivityHistoryItem[];
  checkInOutURL?: string;
  checkInWorkOrderNumber?: string;
  tempOnArrival?: string;
  tempOnLeaving?: string;
  acknowledgements?: Acknowledgement[];
  customerSignatureUrl?: string;
  signatureDate?: string;
  beforePhotoUrls?: string[];
  afterPhotoUrls?: string[];
  receiptsAndPackingSlips?: string[];
  uploadedFiles?: FileAttachment[];
  sourcePdfUrl?: string;
  internalNotes?: string;
  needsAttention?: boolean;
  attentionMessage?: string;
  technicianReplied?: boolean;
  // Asset Integration
  assetId?: string;
  pmScheduleId?: string;
  isPm?: boolean;
};

export type Role = {
    id: string;
    name: string;
}

export type AppUser = {
    id: string;
    employeeId?: string;
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

export type Client = {
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
}

export type AssetMaterial = {
  name: string;
  description?: string;
  quantity: number;
  uom: string;
}

export type Asset = {
  id: string;
  name: string;
  assetTag: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  siteId: string;
  locationDescription?: string;
  installDate: string;
  warrantyExpiration?: string;
  status: 'active' | 'retired' | 'out_of_service';
  criticality: 'low' | 'medium' | 'high';
  expectedLifeYears?: number;
  replacementCost?: number;
  lastServiceDate?: string;
  nextServiceDate?: string;
  createdAt: string;
  updatedAt: string;
  customFields?: { [key: string]: string };
  materials?: AssetMaterial[];
  // Denormalized for display
  siteName?: string;
};

export type Material = {
  id: string;
  name: string;
  category: string;
  partNumber?: string;
  description?: string;
  uom: string;
  customFields?: { [key: string]: string };
  createdAt: string;
  updatedAt: string;
};

export type RequiredMaterial = {
  materialId: string;
  name: string;
  quantity: number;
  uom: string;
};

export type ChecklistStep = {
  step: string;
  requiresPhoto?: boolean;
  requiresMeasurement?: boolean;
};

export type PmTemplate = {
  id: string;
  name: string;
  description: string;
  frequencyType: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom_days';
  customIntervalDays?: number;
  estimatedLaborHours: number;
  requiredMaterials: RequiredMaterial[];
  checklist: ChecklistStep[];
  safetyNotes?: string;
  complianceCategory?: string;
};

export type AssetPmSchedule = {
  id: string;
  assetId: string;
  templateId: string;
  nextDueDate: string;
  lastCompletedDate?: string;
  autoGenerateWorkOrder: boolean;
  status: 'active' | 'paused';
  // Denormalized for display
  assetName?: string;
  templateName?: string;
};

export type AssetServiceHistory = {
  id: string;
  assetId: string;
  workOrderId: string;
  technicianId: string;
  completedDate: string;
  notes: string;
  materialsUsed?: any[];
  measurements?: Record<string, any>;
  photos?: string[];
  followUpRequired?: boolean;
};
