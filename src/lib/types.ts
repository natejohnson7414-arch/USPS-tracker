
export type FileAttachment = {
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
};

export type PhotoMetadata = {
  url: string;
  thumbnailUrl?: string;
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
  defaultDispatchView?: 'day' | 'week' | 'two-week' | 'month';
};

export type WorkOrderNote = {
  id: string;
  text: string;
  createdAt: string;
  photoUrls?: (string | PhotoMetadata)[];
  excludeFromReport?: boolean;
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
  excludeFromReport?: boolean;
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
  beforePhotoUrls?: (string | PhotoMetadata)[];
  afterPhotoUrls?: (string | PhotoMetadata)[];
  receiptsAndPackingSlips?: (string | PhotoMetadata)[];
  uploadedFiles?: FileAttachment[];
  sourcePdfUrl?: string;
  internalNotes?: string;
  needsAttention?: boolean;
  attentionMessage?: string;
  technicianReplied?: boolean;
  customWorkPerformedSummary?: string;
  // Asset Integration
  assetId?: string;
  assetIds?: string[];
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
  category: string;
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
  pmFrequency?: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'none';
  pmLaborHours?: number;
  pmMonth?: number;
  customFields?: { [key: string]: string };
  materials?: AssetMaterial[];
  photoUrls?: (string | PhotoMetadata)[];
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
  nextDueDate: string; // ISO string, anchored to a month
  lastCompletedDate?: string;
  autoGenerateWorkOrder: boolean;
  status: 'active' | 'paused';
  // Denormalized for display
  assetName?: string;
  assetTag?: string;
  siteId?: string;
  siteName?: string;
  templateName?: string;
  frequencyType?: string;
  estimatedLaborHours?: number;
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
  photos?: (string | PhotoMetadata)[];
  followUpRequired?: boolean;
};

export type TimeEntry = {
  id: string;
  technicianId: string;
  workOrderId: string | null;
  date: string;
  hours: number;
  timeType: 'Regular' | 'Overtime' | 'Double Time';
  notes?: string;
  workOrder?: { id: string; jobName: string };
  technicianName?: string;
  excludeFromReport?: boolean;
};

export type PmTaskTemplate = {
  id: string;
  name: string;
  season: 'spring' | 'summer' | 'fall' | 'winter';
  tasks: string[];
};

export type PmSchedule = {
  id: string;
  templateId: string;
  templateName: string;
  season: string;
  dueMonth: number; // 1-12
  recurrence: 'yearly';
  active: boolean;
};

export type PmTask = {
  text: string;
  completed: boolean;
  isNA?: boolean;
  notes: string;
  photoUrls: (string | PhotoMetadata)[];
};

export type PmAssetTaskGroup = {
  assetId: string;
  assetName: string;
  assetTag: string;
  templateName: string;
  tasks: PmTask[];
};

export type PmWorkOrder = {
  id: string;
  status: 'Scheduled' | 'In Progress' | 'Submitted For Review' | 'Completed';
  workSiteId: string;
  workSiteName: string;
  scheduledMonth: number;
  scheduledYear: number;
  assetTasks: PmAssetTaskGroup[];
  assignedTechnicianId?: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type QuoteLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type Quote = {
  id: string;
  quoteNumber: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Archived';
  workOrderId: string;
  clientId?: string;
  workSiteId?: string;
  jobName: string;
  description: string;
  modelNumber: string;
  serialNumber: string;
  estimatedLabor?: string;
  materialsNeeded?: string;
  photos: (string | PhotoMetadata)[];
  videos: string[];
  createdDate: string;
  createdBy_technicianId: string;
  createdBy_technician?: Technician;
  client?: Client;
  workSite?: WorkSite;
  lineItems: QuoteLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  adminNotes?: string;
};
