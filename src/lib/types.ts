


export type Technician = {
  id: string;
  employeeId?: string;
  name: string;
  avatarUrl: string;
  email?: string;
  roleId?: string;
  disabled?: boolean;
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
  id: string; // Job #
  createdDate: string; // DATE
  billTo?: string; // BILL TO
  clientId?: string; // Client ID
  client?: Client; // Client (populated)
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
  status: 'Open' | 'In Progress' | 'On Hold' | 'Review' | 'Completed';
  assignedTechnicianId?: string;
  notes: WorkOrderNote[];
  activities: Activity[];
  work_history: ActivityHistoryItem[];
  checkInOutURL?: string; // CHECK-IN/OUT
  checkInWorkOrderNumber?: string;
  // New fields for report
  tempOnArrival?: string;
  tempOnLeaving?: string;
  customerSignatureUrl?: string;
  signatureDate?: string;
  beforePhotoUrls?: string[];
  afterPhotoUrls?: string[];
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

export type TrainingRecord = {
    id: string;
    workOrderId?: string | null;
    trainingCourse: string;
    trainer: string;
    description: string;
    basUserName: string;
    basPassword?: string | null;
    date?: string;
    trainerSignatureUrl?: string | null;
    attendees: Attendee[];
    checklist?: { [key: string]: boolean };
};

export type Attendee = {
    id: string;
    name: string;
    signatureUrl?: string | null;
};

export type HvacStartupReport = {
    id: string;
    workOrderId?: string;
    technicianId?: string;
    date: string;
    site?: string;
    technician?: string;
    equipmentBeingRemoved?: string;
    unitTag?: string;
    manufacturer?: string;
    mNumber?: string;
    sNumber?: string;
    equipmentType?: string;
    equipmentManufacturer?: string;
    model?: string;
    serial?: string;
    location?: string;
    beltSize?: string;
    filterSizeAndQty?: string;
    ambientTemp?: string;
    equipmentId?: string;
    areaEquipmentServes?: string;
    supplyVoltage_L1_L2?: string;
    supplyVoltage_L2_L3?: string;
    supplyVoltage_L3_L1?: string;
    controlVoltageACDC?: string;
    motorHp?: string;
    motorAmps?: string;
    suctionPressure_S1?: string;
    suctionPressure_S2?: string;
    suctionPressure_S3?: string;
    suctionPressure_S4?: string;
    dischargePressure_S1?: string;
    dischargePressure_S2?: string;
    dischargePressure_S3?: string;
    dischargePressure_S4?: string;
    crankcaseHeaterAmp_S1?: string;
    crankcaseHeaterAmp_S2?: string;
    crankcaseHeaterAmp_S3?: string;
    crankcaseHeaterAmp_S4?: string;
    compressorAmp_T1?: string;
    compressorAmp_T2?: string;
    compressorAmp_T3?: string;
    compressorVoltage_T1_T2?: string;
    compressorVoltage_T2_T3?: string;
    compressorVoltage_T3_T1?: string;
    condenserFanVoltage?: string;
    condenserFanAmp?: string;
    cooling_evaporatorEAT?: string;
    cooling_evaporatorLAT?: string;
    cooling_condenserEAT?: string;
    cooling_condenserLAT?: string;
    motorRatedAmps_T1?: string;
    motorRatedAmps_T2?: string;
    motorRatedAmps_T3?: string;
    gasHeating_RAT_SAT_S1?: string;
    gasHeating_RAT_SAT_S2?: string;
    gasHeating_RAT_SAT_S3?: string;
    gasHeating_RAT_SAT_S4?: string;
    gasPressureInWC?: string;
    electricHeating_RAT_SAT_S1?: string;
    electricHeating_RAT_SAT_S2?: string;
    electricHeating_RAT_SAT_S3?: string;
    electricHeating_RAT_SAT_S4?: string;
    voltage_T1_T2?: string;
    voltage_T2_T3?: string;
    voltage_T3_T1?: string;
    amps_T1?: string;
    amps_T2?: string;
    amps_T3?: string;
    checkedRotation?: string;
};

export type TimeEntry = {
    id: string;
    technicianId: string;
    workOrderId: string | null;
    date: string;
    hours: number;
    timeType: 'Regular' | 'Overtime' | 'Double Time';
    notes?: string;
    workOrder?: WorkOrder; // For display purposes on the timesheet
    technicianName?: string;
};
    
export type QuoteLineItem = {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
};

export type Quote = {
    id: string;
    workOrderId?: string;
    quoteNumber: string;
    status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Archived';
    clientId?: string;
    client?: Client;
    workSiteId?: string;
    workSite?: WorkSite;
    jobName?: string; // Denormalized for display
    description: string;
    estimatedLabor?: string;
    materialsNeeded?: string;
    photos: string[];
    videos: string[];
    createdDate: string;
    createdBy_technicianId: string;
    createdBy_technician?: Technician;
    lineItems: QuoteLineItem[];
    subtotal: number;
    tax: number;
    total: number;
    adminNotes?: string;
};
