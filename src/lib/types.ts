

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
  text: string;
  photoUrls?: string[];
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
  status: 'Open' | 'In Progress' | 'On Hold' | 'Completed';
  assignedTechnicianId?: string;
  notes: WorkOrderNote[];
  // New fields for report
  tempOnArrival?: string;
  tempOnLeaving?: string;
  customerSignatureUrl?: string;
  signatureDate?: string;
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
    workOrderId?: string;
    trainingCourse: string;
    trainer: string;
    description: string;
    basUserName: string;
    basPassword?: string;
    date?: string;
    trainerSignatureUrl?: string;
    attendees: Attendee[];
    checklist?: { [key: string]: boolean };
};

export type Attendee = {
    id: string;
    name: string;
    signatureUrl?: string;
};

export type HvacStartupReport = {
    id: string;
    workOrderId?: string;
    technicianId?: string;
    date: string;
    site?: string;
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
    suctionPressure: (string | undefined)[];
    dischargePressure: (string | undefined)[];
    crankcaseHeaterAmp: (string | undefined)[];
    compressorAmp: (string | undefined)[];
    compressorVoltage: (string | undefined)[];
    condenserFanVoltage?: string;
    condenserFanAmp?: string;
    cooling_evaporatorEAT?: string;
    cooling_evaporatorLAT?: string;
    cooling_condenserEAT?: string;
    cooling_condenserLAT?: string;
    motorRatedAmps: (string | undefined)[];
    gasHeating_RAT_SAT: (string | undefined)[];
    gasPressureInWC?: string;
    electricHeating_RAT_SAT: (string | undefined)[];
    voltage: (string | undefined)[];
    amps: (string | undefined)[];
    checkedRotation?: string;
};
    