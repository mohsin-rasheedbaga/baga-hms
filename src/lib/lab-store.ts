/* ========== LAB INFORMATION SYSTEM (LIS) STORE ========== */
/* All LIS-specific data operations with localStorage / SQLite (Electron) */

import { isElectron, dbGetAll, dbSetAll, dbSetById } from './db-bridge';

// ==================== TYPES ====================

export interface LabParameter {
  name: string;
  unit: string;
  refRange: string;
  refMale: string;
  refFemale: string;
  criticalLow: number;
  criticalHigh: number;
  normalLow: number;
  normalHigh: number;
}

export interface LabTestDefinition {
  id: string;
  name: string;
  category: string;
  price: number;
  turnaroundTime: string;
  sampleType: string;
  active: boolean;
  parameters: LabParameter[];
}

export interface LabOrderItem {
  id: string;
  visitId: string;
  patientId: string;
  patientNo: string;
  patientName: string;
  gender: string;
  age: string;
  tests: { testName: string; testId: string; price: number }[];
  orderedBy: string;
  urgency: 'routine' | 'urgent' | 'stat';
  sampleType: string;
  status: 'ordered' | 'collected' | 'processing' | 'completed';
  date: string;
  time: string;
  collectedAt?: string;
  collectedBy?: string;
  completedAt?: string;
  completedBy?: string;
  results: LabResultEntry[];
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
}

export interface LabResultEntry {
  testId: string;
  testName: string;
  parameter: string;
  value: string;
  unit: string;
  refRange: string;
  flag: 'Normal' | 'Low' | 'High' | 'Critical';
}

export interface LabInventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  costPrice: number;
  sellingPrice: number;
  expiryDate: string;
  supplier: string;
  batchNo: string;
}

export interface LabExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  notes: string;
}

// ==================== LOCAL STORAGE HELPERS ====================

const KEYS = {
  tests: 'baga_lab_tests',
  orders: 'baga_lis_orders',      // Separate key to avoid clash with store.ts
  inventory: 'baga_lab_inventory',
  expenses: 'baga_lab_expenses',
  initialized: 'baga_lab_initialized',
  mainOrdersKey: 'baga_lab_orders', // Main store key (store.ts) for sync
  doctors: 'baga_lab_doctors',       // Lab doctors / pathologists / supervisors
};

const TABLE_MAP: Record<string, string> = {
  [KEYS.tests]: 'lab_tests',
  [KEYS.orders]: 'lis_orders',
  [KEYS.inventory]: 'lab_inventory',
  [KEYS.expenses]: 'lab_expenses',
  [KEYS.doctors]: 'lab_doctors',
};

function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  // Try Electron SQLite first
  if (isElectron()) {
    const tableName = TABLE_MAP[key];
    if (tableName) {
      const data = dbGetAll(tableName);
      if (data !== null) return data as T;
    }
  }

  // Fall back to localStorage
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; }
  catch { return fallback; }
}
function set<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;

  // Try Electron SQLite first
  if (isElectron()) {
    const tableName = TABLE_MAP[key];
    if (tableName && Array.isArray(data)) {
      const rows = data.map(item => {
        const id = (item as any).id || genId();
        return { id, data: item };
      });
      if (dbSetAll(tableName, rows)) return;
    }
  }

  // Fall back to localStorage
  localStorage.setItem(key, JSON.stringify(data));
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function nowTime(): string {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

// ==================== DEFAULT TEST DEFINITIONS ====================

const defaultTests: LabTestDefinition[] = [
  {
    id: 'lt_cbc', name: 'CBC (Complete Blood Count)', category: 'Hematology', price: 800,
    turnaroundTime: '2 hours', sampleType: 'Blood (EDTA)', active: true,
    parameters: [
      { name: 'Hemoglobin', unit: 'g/dL', refRange: '12-16', refMale: '13.5-17.5', refFemale: '12-16', criticalLow: 7, criticalHigh: 20, normalLow: 13.5, normalHigh: 17.5 },
      { name: 'RBC', unit: 'million/μL', refRange: '4-5.5', refMale: '4.5-5.9', refFemale: '4-5.5', criticalLow: 2.5, criticalHigh: 7, normalLow: 4.5, normalHigh: 5.9 },
      { name: 'WBC', unit: 'x10³/μL', refRange: '4-11', refMale: '4-11', refFemale: '4-11', criticalLow: 2, criticalHigh: 30, normalLow: 4, normalHigh: 11 },
      { name: 'Platelets', unit: 'x10³/μL', refRange: '150-400', refMale: '150-400', refFemale: '150-400', criticalLow: 50, criticalHigh: 800, normalLow: 150, normalHigh: 400 },
      { name: 'Hematocrit', unit: '%', refRange: '37-48', refMale: '41-53', refFemale: '37-48', criticalLow: 20, criticalHigh: 60, normalLow: 41, normalHigh: 53 },
      { name: 'MCV', unit: 'fL', refRange: '80-100', refMale: '80-100', refFemale: '80-100', criticalLow: 60, criticalHigh: 120, normalLow: 80, normalHigh: 100 },
      { name: 'MCH', unit: 'pg', refRange: '27-33', refMale: '27-33', refFemale: '27-33', criticalLow: 20, criticalHigh: 40, normalLow: 27, normalHigh: 33 },
      { name: 'MCHC', unit: 'g/dL', refRange: '32-36', refMale: '32-36', refFemale: '32-36', criticalLow: 28, criticalHigh: 40, normalLow: 32, normalHigh: 36 },
    ]
  },
  {
    id: 'lt_lft', name: 'LFT (Liver Function Test)', category: 'Biochemistry', price: 1500,
    turnaroundTime: '4 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'ALT (SGPT)', unit: 'U/L', refRange: '7-56', refMale: '10-40', refFemale: '7-35', criticalLow: 0, criticalHigh: 500, normalLow: 10, normalHigh: 40 },
      { name: 'AST (SGOT)', unit: 'U/L', refRange: '10-40', refMale: '10-40', refFemale: '10-35', criticalLow: 0, criticalHigh: 500, normalLow: 10, normalHigh: 40 },
      { name: 'Total Bilirubin', unit: 'mg/dL', refRange: '0.3-1.2', refMale: '0.3-1.2', refFemale: '0.3-1.2', criticalLow: 0, criticalHigh: 10, normalLow: 0.3, normalHigh: 1.2 },
      { name: 'Direct Bilirubin', unit: 'mg/dL', refRange: '0-0.3', refMale: '0-0.3', refFemale: '0-0.3', criticalLow: 0, criticalHigh: 5, normalLow: 0, normalHigh: 0.3 },
      { name: 'ALP', unit: 'U/L', refRange: '44-147', refMale: '45-129', refFemale: '44-147', criticalLow: 0, criticalHigh: 500, normalLow: 45, normalHigh: 129 },
      { name: 'Total Protein', unit: 'g/dL', refRange: '6-8.3', refMale: '6-8.3', refFemale: '6-8.3', criticalLow: 3, criticalHigh: 12, normalLow: 6, normalHigh: 8.3 },
      { name: 'Albumin', unit: 'g/dL', refRange: '3.5-5', refMale: '3.5-5', refFemale: '3.5-5', criticalLow: 2, criticalHigh: 6, normalLow: 3.5, normalHigh: 5 },
      { name: 'GGT', unit: 'U/L', refRange: '9-48', refMale: '9-48', refFemale: '5-36', criticalLow: 0, criticalHigh: 500, normalLow: 9, normalHigh: 48 },
    ]
  },
  {
    id: 'lt_rft', name: 'RFT (Renal Function Test)', category: 'Biochemistry', price: 1200,
    turnaroundTime: '4 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'Blood Urea', unit: 'mg/dL', refRange: '7-20', refMale: '7-20', refFemale: '7-20', criticalLow: 0, criticalHigh: 100, normalLow: 7, normalHigh: 20 },
      { name: 'Serum Creatinine', unit: 'mg/dL', refRange: '0.6-1.2', refMale: '0.7-1.3', refFemale: '0.6-1.1', criticalLow: 0, criticalHigh: 5, normalLow: 0.7, normalHigh: 1.3 },
      { name: 'BUN', unit: 'mg/dL', refRange: '7-20', refMale: '7-20', refFemale: '7-20', criticalLow: 0, criticalHigh: 100, normalLow: 7, normalHigh: 20 },
      { name: 'Uric Acid', unit: 'mg/dL', refRange: '3-7', refMale: '3.5-7.2', refFemale: '2.6-6', criticalLow: 1, criticalHigh: 15, normalLow: 3.5, normalHigh: 7.2 },
      { name: 'eGFR', unit: 'mL/min', refRange: '>60', refMale: '>60', refFemale: '>60', criticalLow: 15, criticalHigh: 200, normalLow: 60, normalHigh: 120 },
      { name: 'Sodium', unit: 'mEq/L', refRange: '135-145', refMale: '135-145', refFemale: '135-145', criticalLow: 120, criticalHigh: 160, normalLow: 135, normalHigh: 145 },
      { name: 'Potassium', unit: 'mEq/L', refRange: '3.5-5', refMale: '3.5-5', refFemale: '3.5-5', criticalLow: 2.5, criticalHigh: 6.5, normalLow: 3.5, normalHigh: 5 },
    ]
  },
  {
    id: 'lt_lipid', name: 'Lipid Profile', category: 'Biochemistry', price: 1200,
    turnaroundTime: '4 hours', sampleType: 'Blood (Fasting)', active: true,
    parameters: [
      { name: 'Total Cholesterol', unit: 'mg/dL', refRange: '<200', refMale: '<200', refFemale: '<200', criticalLow: 0, criticalHigh: 300, normalLow: 0, normalHigh: 200 },
      { name: 'Triglycerides', unit: 'mg/dL', refRange: '<150', refMale: '<150', refFemale: '<150', criticalLow: 0, criticalHigh: 500, normalLow: 0, normalHigh: 150 },
      { name: 'HDL', unit: 'mg/dL', refRange: '>40', refMale: '>40', refFemale: '>50', criticalLow: 20, criticalHigh: 100, normalLow: 40, normalHigh: 60 },
      { name: 'LDL', unit: 'mg/dL', refRange: '<130', refMale: '<130', refFemale: '<130', criticalLow: 0, criticalHigh: 190, normalLow: 0, normalHigh: 130 },
      { name: 'VLDL', unit: 'mg/dL', refRange: '5-40', refMale: '5-40', refFemale: '5-40', criticalLow: 0, criticalHigh: 80, normalLow: 5, normalHigh: 40 },
      { name: 'LDL/HDL Ratio', unit: '', refRange: '<3', refMale: '<3', refFemale: '<3', criticalLow: 0, criticalHigh: 7, normalLow: 0, normalHigh: 3 },
    ]
  },
  {
    id: 'lt_thyroid', name: 'Thyroid Panel', category: 'Endocrinology', price: 1800,
    turnaroundTime: '6 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'TSH', unit: 'mIU/L', refRange: '0.4-4', refMale: '0.4-4', refFemale: '0.4-4', criticalLow: 0.1, criticalHigh: 20, normalLow: 0.4, normalHigh: 4 },
      { name: 'Free T3', unit: 'pg/mL', refRange: '2.3-4.2', refMale: '2.3-4.2', refFemale: '2.3-4.2', criticalLow: 1, criticalHigh: 8, normalLow: 2.3, normalHigh: 4.2 },
      { name: 'Free T4', unit: 'ng/dL', refRange: '0.8-1.8', refMale: '0.8-1.8', refFemale: '0.8-1.8', criticalLow: 0.3, criticalHigh: 4, normalLow: 0.8, normalHigh: 1.8 },
      { name: 'Total T3', unit: 'ng/dL', refRange: '80-200', refMale: '80-200', refFemale: '80-200', criticalLow: 40, criticalHigh: 400, normalLow: 80, normalHigh: 200 },
      { name: 'Total T4', unit: 'μg/dL', refRange: '5-12', refMale: '5-12', refFemale: '5-12', criticalLow: 2, criticalHigh: 20, normalLow: 5, normalHigh: 12 },
    ]
  },
  {
    id: 'lt_hba1c', name: 'HbA1c', category: 'Endocrinology', price: 900,
    turnaroundTime: '4 hours', sampleType: 'Blood (EDTA)', active: true,
    parameters: [
      { name: 'HbA1c', unit: '%', refRange: '<5.7', refMale: '<5.7', refFemale: '<5.7', criticalLow: 3, criticalHigh: 14, normalLow: 4, normalHigh: 5.7 },
      { name: 'Estimated Avg Glucose', unit: 'mg/dL', refRange: '<117', refMale: '<117', refFemale: '<117', criticalLow: 50, criticalHigh: 300, normalLow: 70, normalHigh: 117 },
    ]
  },
  {
    id: 'lt_esr', name: 'ESR (Erythrocyte Sedimentation Rate)', category: 'Hematology', price: 300,
    turnaroundTime: '1 hour', sampleType: 'Blood (EDTA)', active: true,
    parameters: [
      { name: 'ESR', unit: 'mm/hr', refRange: '0-20', refMale: '0-15', refFemale: '0-20', criticalLow: 0, criticalHigh: 100, normalLow: 0, normalHigh: 15 },
    ]
  },
  {
    id: 'lt_ptinr', name: 'PT/INR', category: 'Hematology', price: 600,
    turnaroundTime: '2 hours', sampleType: 'Blood (Citrate)', active: true,
    parameters: [
      { name: 'PT', unit: 'seconds', refRange: '11-13.5', refMale: '11-13.5', refFemale: '11-13.5', criticalLow: 8, criticalHigh: 40, normalLow: 11, normalHigh: 13.5 },
      { name: 'INR', unit: '', refRange: '0.8-1.1', refMale: '0.8-1.1', refFemale: '0.8-1.1', criticalLow: 0.5, criticalHigh: 5, normalLow: 0.8, normalHigh: 1.1 },
      { name: 'aPTT', unit: 'seconds', refRange: '25-35', refMale: '25-35', refFemale: '25-35', criticalLow: 15, criticalHigh: 60, normalLow: 25, normalHigh: 35 },
    ]
  },
  {
    id: 'lt_crp', name: 'CRP (C-Reactive Protein)', category: 'Immunology', price: 500,
    turnaroundTime: '2 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'CRP', unit: 'mg/L', refRange: '<10', refMale: '<10', refFemale: '<10', criticalLow: 0, criticalHigh: 200, normalLow: 0, normalHigh: 10 },
      { name: 'hs-CRP', unit: 'mg/L', refRange: '<3', refMale: '<3', refFemale: '<3', criticalLow: 0, criticalHigh: 50, normalLow: 0, normalHigh: 3 },
    ]
  },
  {
    id: 'lt_rbs', name: 'RBS (Random Blood Sugar)', category: 'Biochemistry', price: 250,
    turnaroundTime: '30 min', sampleType: 'Blood (Fluoride)', active: true,
    parameters: [
      { name: 'Random Blood Sugar', unit: 'mg/dL', refRange: '<140', refMale: '<140', refFemale: '<140', criticalLow: 50, criticalHigh: 400, normalLow: 70, normalHigh: 140 },
    ]
  },
  {
    id: 'lt_fbs', name: 'FBS (Fasting Blood Sugar)', category: 'Biochemistry', price: 250,
    turnaroundTime: '30 min', sampleType: 'Blood (Fasting)', active: true,
    parameters: [
      { name: 'Fasting Blood Sugar', unit: 'mg/dL', refRange: '70-100', refMale: '70-100', refFemale: '70-100', criticalLow: 50, criticalHigh: 300, normalLow: 70, normalHigh: 100 },
    ]
  },
  {
    id: 'lt_urine', name: 'Urinalysis', category: 'Urine', price: 400,
    turnaroundTime: '1 hour', sampleType: 'Urine', active: true,
    parameters: [
      { name: 'Color', unit: '', refRange: 'Pale Yellow', refMale: 'Pale Yellow', refFemale: 'Pale Yellow', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
      { name: 'Appearance', unit: '', refRange: 'Clear', refMale: 'Clear', refFemale: 'Clear', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
      { name: 'pH', unit: '', refRange: '4.5-8', refMale: '4.5-8', refFemale: '4.5-8', criticalLow: 4, criticalHigh: 9, normalLow: 4.5, normalHigh: 8 },
      { name: 'Specific Gravity', unit: '', refRange: '1.005-1.030', refMale: '1.005-1.030', refFemale: '1.005-1.030', criticalLow: 1.001, criticalHigh: 1.040, normalLow: 1.005, normalHigh: 1.030 },
      { name: 'Protein', unit: '', refRange: 'Negative', refMale: 'Negative', refFemale: 'Negative', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
      { name: 'Glucose', unit: '', refRange: 'Negative', refMale: 'Negative', refFemale: 'Negative', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
      { name: 'Blood', unit: '', refRange: 'Negative', refMale: 'Negative', refFemale: 'Negative', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
    ]
  },
  // Additional common Pakistani lab tests
  {
    id: 'lt_fbs', name: 'FBS (Fasting Blood Sugar)', category: 'Biochemistry', price: 250,
    turnaroundTime: '2 hours', sampleType: 'Blood (Fasting)', active: true,
    parameters: [
      { name: 'Glucose (Fasting)', unit: 'mg/dL', refRange: '70-100', refMale: '70-100', refFemale: '70-100', criticalLow: 50, criticalHigh: 300, normalLow: 70, normalHigh: 100 },
    ]
  },
  {
    id: 'lt_rbs', name: 'RBS (Random Blood Sugar)', category: 'Biochemistry', price: 200,
    turnaroundTime: '1 hour', sampleType: 'Blood', active: true,
    parameters: [
      { name: 'Glucose (Random)', unit: 'mg/dL', refRange: '70-140', refMale: '70-140', refFemale: '70-140', criticalLow: 50, criticalHigh: 400, normalLow: 70, normalHigh: 140 },
    ]
  },
  {
    id: 'lt_hba1c', name: 'HbA1c (Glycated Hemoglobin)', category: 'Biochemistry', price: 1500,
    turnaroundTime: '4 hours', sampleType: 'Blood (EDTA)', active: true,
    parameters: [
      { name: 'HbA1c', unit: '%', refRange: '4-5.6', refMale: '4-5.6', refFemale: '4-5.6', criticalLow: 3, criticalHigh: 15, normalLow: 4, normalHigh: 5.6 },
    ]
  },
  {
    id: 'lt_esr', name: 'ESR (Erythrocyte Sedimentation Rate)', category: 'Hematology', price: 300,
    turnaroundTime: '2 hours', sampleType: 'Blood', active: true,
    parameters: [
      { name: 'ESR (1st hour)', unit: 'mm/hr', refRange: '0-15', refMale: '0-15', refFemale: '0-20', criticalLow: 0, criticalHigh: 100, normalLow: 0, normalHigh: 15 },
    ]
  },
  {
    id: 'lt_pt', name: 'PT/INR (Prothrombin Time)', category: 'Coagulation', price: 600,
    turnaroundTime: '2 hours', sampleType: 'Blood (Citrate)', active: true,
    parameters: [
      { name: 'PT', unit: 'seconds', refRange: '11-13.5', refMale: '11-13.5', refFemale: '11-13.5', criticalLow: 8, criticalHigh: 30, normalLow: 11, normalHigh: 13.5 },
      { name: 'INR', unit: '', refRange: '0.8-1.2', refMale: '0.8-1.2', refFemale: '0.8-1.2', criticalLow: 0.5, criticalHigh: 5, normalLow: 0.8, normalHigh: 1.2 },
    ]
  },
  {
    id: 'lt_bilirubin', name: 'Bilirubin (Total & Direct)', category: 'Biochemistry', price: 400,
    turnaroundTime: '2 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'Total Bilirubin', unit: 'mg/dL', refRange: '0.3-1.2', refMale: '0.3-1.2', refFemale: '0.3-1.2', criticalLow: 0, criticalHigh: 10, normalLow: 0.3, normalHigh: 1.2 },
      { name: 'Direct Bilirubin', unit: 'mg/dL', refRange: '0-0.3', refMale: '0-0.3', refFemale: '0-0.3', criticalLow: 0, criticalHigh: 5, normalLow: 0, normalHigh: 0.3 },
    ]
  },
  {
    id: 'lt_ionic', name: 'Electrolytes (Na, K, Cl)', category: 'Biochemistry', price: 800,
    turnaroundTime: '2 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'Sodium', unit: 'mEq/L', refRange: '135-145', refMale: '135-145', refFemale: '135-145', criticalLow: 120, criticalHigh: 160, normalLow: 135, normalHigh: 145 },
      { name: 'Potassium', unit: 'mEq/L', refRange: '3.5-5', refMale: '3.5-5', refFemale: '3.5-5', criticalLow: 2.5, criticalHigh: 6.5, normalLow: 3.5, normalHigh: 5 },
      { name: 'Chloride', unit: 'mEq/L', refRange: '96-106', refMale: '96-106', refFemale: '96-106', criticalLow: 80, criticalHigh: 120, normalLow: 96, normalHigh: 106 },
    ]
  },
  {
    id: 'lt calcium', name: 'Serum Calcium', category: 'Biochemistry', price: 500,
    turnaroundTime: '2 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'Calcium', unit: 'mg/dL', refRange: '8.6-10.3', refMale: '8.6-10.3', refFemale: '8.6-10.3', criticalLow: 6, criticalHigh: 13, normalLow: 8.6, normalHigh: 10.3 },
    ]
  },
  {
    id: 'lt_phosphorus', name: 'Serum Phosphorus', category: 'Biochemistry', price: 500,
    turnaroundTime: '2 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'Phosphorus', unit: 'mg/dL', refRange: '2.5-4.5', refMale: '2.5-4.5', refFemale: '2.5-4.5', criticalLow: 1, criticalHigh: 8, normalLow: 2.5, normalHigh: 4.5 },
    ]
  },
  {
    id: 'lt_iron', name: 'Serum Iron & TIBC', category: 'Biochemistry', price: 800,
    turnaroundTime: '4 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'Serum Iron', unit: 'µg/dL', refRange: '60-170', refMale: '65-175', refFemale: '50-170', criticalLow: 20, criticalHigh: 300, normalLow: 60, normalHigh: 170 },
      { name: 'TIBC', unit: 'µg/dL', refRange: '240-450', refMale: '240-450', refFemale: '240-450', criticalLow: 100, criticalHigh: 600, normalLow: 240, normalHigh: 450 },
    ]
  },
  {
    id: 'lt_vitd', name: 'Vitamin D (25-OH)', category: 'Endocrinology', price: 2500,
    turnaroundTime: '1 day', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: '25-OH Vitamin D', unit: 'ng/mL', refRange: '30-100', refMale: '30-100', refFemale: '30-100', criticalLow: 5, criticalHigh: 150, normalLow: 30, normalHigh: 100 },
    ]
  },
  {
    id: 'lt_vitb12', name: 'Vitamin B12', category: 'Endocrinology', price: 2000,
    turnaroundTime: '1 day', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'Vitamin B12', unit: 'pg/mL', refRange: '200-900', refMale: '200-900', refFemale: '200-900', criticalLow: 100, criticalHigh: 2000, normalLow: 200, normalHigh: 900 },
    ]
  },
  {
    id: 'lt_dengue', name: 'Dengue NS1 Antigen', category: 'Serology', price: 1500,
    turnaroundTime: '4 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'NS1 Antigen', unit: '', refRange: 'Negative', refMale: 'Negative', refFemale: 'Negative', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
    ]
  },
  {
    id: 'lt_widal', name: 'Widal Test (Typhoid)', category: 'Serology', price: 500,
    turnaroundTime: '2 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'S. typhi O', unit: '', refRange: '< 1:80', refMale: '< 1:80', refFemale: '< 1:80', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
      { name: 'S. typhi H', unit: '', refRange: '< 1:160', refMale: '< 1:160', refFemale: '< 1:160', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
    ]
  },
  {
    id: 'lt_pcr', name: 'PCR (Hepatitis C)', category: 'Molecular', price: 5000,
    turnaroundTime: '3 days', sampleType: 'Blood (Plasma)', active: true,
    parameters: [
      { name: 'HCV RNA', unit: 'IU/mL', refRange: 'Not Detected', refMale: 'Not Detected', refFemale: 'Not Detected', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
    ]
  },
  {
    id: 'lt_hbsag', name: 'HBsAg (Hepatitis B)', category: 'Serology', price: 600,
    turnaroundTime: '2 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'HBsAg', unit: '', refRange: 'Negative', refMale: 'Negative', refFemale: 'Negative', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
    ]
  },
  {
    id: 'lt_antiHCV', name: 'Anti-HCV (Hepatitis C)', category: 'Serology', price: 600,
    turnaroundTime: '2 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'Anti-HCV', unit: '', refRange: 'Negative', refMale: 'Negative', refFemale: 'Negative', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
    ]
  },
  {
    id: 'lt_hiv', name: 'HIV (Screening)', category: 'Serology', price: 500,
    turnaroundTime: '2 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'HIV Antibody', unit: '', refRange: 'Negative', refMale: 'Negative', refFemale: 'Negative', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
    ]
  },
  {
    id: 'lt_pregnancy', name: 'Pregnancy Test (hCG)', category: 'Serology', price: 300,
    turnaroundTime: '30 min', sampleType: 'Urine/Serum', active: true,
    parameters: [
      { name: 'hCG', unit: '', refRange: 'Negative', refMale: 'N/A', refFemale: 'Negative', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
    ]
  },
  {
    id: 'lt_stool', name: 'Stool Routine Examination', category: 'Microbiology', price: 400,
    turnaroundTime: '2 hours', sampleType: 'Stool', active: true,
    parameters: [
      { name: 'Color', unit: '', refRange: 'Brown', refMale: 'Brown', refFemale: 'Brown', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
      { name: 'Consistency', unit: '', refRange: 'Soft', refMale: 'Soft', refFemale: 'Soft', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
      { name: 'Occult Blood', unit: '', refRange: 'Negative', refMale: 'Negative', refFemale: 'Negative', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
      { name: 'Parasites', unit: '', refRange: 'Not Found', refMale: 'Not Found', refFemale: 'Not Found', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 },
    ]
  },
  {
    id: 'lt_ami', name: 'Cardiac Enzymes (CK-MB, Troponin)', category: 'Biochemistry', price: 2000,
    turnaroundTime: '4 hours', sampleType: 'Blood (Serum)', active: true,
    parameters: [
      { name: 'CK-MB', unit: 'U/L', refRange: '0-25', refMale: '0-25', refFemale: '0-25', criticalLow: 0, criticalHigh: 100, normalLow: 0, normalHigh: 25 },
      { name: 'Troponin I', unit: 'ng/mL', refRange: '< 0.4', refMale: '< 0.4', refFemale: '< 0.4', criticalLow: 0, criticalHigh: 10, normalLow: 0, normalHigh: 0.4 },
    ]
  },
];

// ==================== DEFAULT ORDERS ====================

const defaultOrders: LabOrderItem[] = [
  {
    id: 'lis_ord_1', visitId: 'v1', patientId: 'p1', patientNo: 'BAGA-0001', patientName: 'Muhammad Ali',
    gender: 'Male', age: '35',
    tests: [
      { testName: 'CBC (Complete Blood Count)', testId: 'lt_cbc', price: 800 },
      { testName: 'LFT (Liver Function Test)', testId: 'lt_lft', price: 1500 },
      { testName: 'RFT (Renal Function Test)', testId: 'lt_rft', price: 1200 },
      { testName: 'Lipid Profile', testId: 'lt_lipid', price: 1200 },
    ],
    orderedBy: 'Dr. Ahmed Hassan', urgency: 'routine', sampleType: 'Blood',
    status: 'ordered', date: todayStr(), time: '09:45 AM',
    results: [], totalAmount: 4700, paidAmount: 4700, paymentStatus: 'paid',
  },
  {
    id: 'lis_ord_2', visitId: 'v2', patientId: 'p2', patientNo: 'BAGA-0002', patientName: 'Fatima Bibi',
    gender: 'Female', age: '28',
    tests: [
      { testName: 'CBC (Complete Blood Count)', testId: 'lt_cbc', price: 800 },
      { testName: 'Thyroid Panel', testId: 'lt_thyroid', price: 1800 },
      { testName: 'Urinalysis', testId: 'lt_urine', price: 400 },
    ],
    orderedBy: 'Dr. Sara Khan', urgency: 'routine', sampleType: 'Blood',
    status: 'ordered', date: todayStr(), time: '10:30 AM',
    results: [], totalAmount: 3000, paidAmount: 3000, paymentStatus: 'paid',
  },
  {
    id: 'lis_ord_3', visitId: 'v3', patientId: 'p3', patientNo: 'BAGA-0003', patientName: 'Ahmed Khan',
    gender: 'Male', age: '45',
    tests: [
      { testName: 'RBS (Random Blood Sugar)', testId: 'lt_rbs', price: 250 },
      { testName: 'HbA1c', testId: 'lt_hba1c', price: 900 },
    ],
    orderedBy: 'Dr. Bilal Siddiqui', urgency: 'urgent', sampleType: 'Blood',
    status: 'collected', date: todayStr(), time: '08:15 AM',
    collectedAt: '08:45 AM', collectedBy: 'Lab Tech',
    results: [], totalAmount: 1150, paidAmount: 1150, paymentStatus: 'paid',
  },
  {
    id: 'lis_ord_4', visitId: 'v_old1', patientId: 'p1', patientNo: 'BAGA-0001', patientName: 'Muhammad Ali',
    gender: 'Male', age: '35',
    tests: [
      { testName: 'CRP (C-Reactive Protein)', testId: 'lt_crp', price: 500 },
      { testName: 'ESR (Erythrocyte Sedimentation Rate)', testId: 'lt_esr', price: 300 },
    ],
    orderedBy: 'Dr. Ahmed Hassan', urgency: 'routine', sampleType: 'Blood',
    status: 'processing', date: todayStr(), time: '07:30 AM',
    collectedAt: '08:00 AM', collectedBy: 'Lab Tech',
    results: [],
    totalAmount: 800, paidAmount: 800, paymentStatus: 'paid',
  },
  {
    id: 'lis_ord_5', visitId: 'v_old2', patientId: 'p2', patientNo: 'BAGA-0002', patientName: 'Fatima Bibi',
    gender: 'Female', age: '28',
    tests: [
      { testName: 'FBS (Fasting Blood Sugar)', testId: 'lt_fbs', price: 250 },
    ],
    orderedBy: 'Dr. Sara Khan', urgency: 'routine', sampleType: 'Blood',
    status: 'completed', date: todayStr(), time: '07:00 AM',
    collectedAt: '07:15 AM', collectedBy: 'Lab Tech',
    completedAt: '08:30 AM', completedBy: 'Lab Tech',
    results: [
      { testId: 'lt_fbs', testName: 'FBS (Fasting Blood Sugar)', parameter: 'Fasting Blood Sugar', value: '92', unit: 'mg/dL', refRange: '70-100', flag: 'Normal' },
    ],
    totalAmount: 250, paidAmount: 250, paymentStatus: 'paid',
  },
  {
    id: 'lis_ord_6', visitId: 'v_old3', patientId: 'p3', patientNo: 'BAGA-0003', patientName: 'Ahmed Khan',
    gender: 'Male', age: '45',
    tests: [
      { testName: 'CBC (Complete Blood Count)', testId: 'lt_cbc', price: 800 },
      { testName: 'PT/INR', testId: 'lt_ptinr', price: 600 },
    ],
    orderedBy: 'Dr. Bilal Siddiqui', urgency: 'stat', sampleType: 'Blood',
    status: 'completed', date: todayStr(), time: '06:30 AM',
    collectedAt: '06:45 AM', collectedBy: 'Lab Tech',
    completedAt: '08:00 AM', completedBy: 'Lab Tech',
    results: [
      { testId: 'lt_cbc', testName: 'CBC (Complete Blood Count)', parameter: 'Hemoglobin', value: '14.2', unit: 'g/dL', refRange: '13.5-17.5', flag: 'Normal' },
      { testId: 'lt_cbc', testName: 'CBC (Complete Blood Count)', parameter: 'RBC', value: '4.8', unit: 'million/μL', refRange: '4.5-5.9', flag: 'Normal' },
      { testId: 'lt_cbc', testName: 'CBC (Complete Blood Count)', parameter: 'WBC', value: '11.5', unit: 'x10³/μL', refRange: '4-11', flag: 'High' },
      { testId: 'lt_cbc', testName: 'CBC (Complete Blood Count)', parameter: 'Platelets', value: '180', unit: 'x10³/μL', refRange: '150-400', flag: 'Normal' },
      { testId: 'lt_cbc', testName: 'CBC (Complete Blood Count)', parameter: 'Hematocrit', value: '42.5', unit: '%', refRange: '41-53', flag: 'Normal' },
      { testId: 'lt_cbc', testName: 'CBC (Complete Blood Count)', parameter: 'MCV', value: '88.5', unit: 'fL', refRange: '80-100', flag: 'Normal' },
      { testId: 'lt_cbc', testName: 'CBC (Complete Blood Count)', parameter: 'MCH', value: '29.6', unit: 'pg', refRange: '27-33', flag: 'Normal' },
      { testId: 'lt_cbc', testName: 'CBC (Complete Blood Count)', parameter: 'MCHC', value: '33.4', unit: 'g/dL', refRange: '32-36', flag: 'Normal' },
      { testId: 'lt_ptinr', testName: 'PT/INR', parameter: 'PT', value: '12.8', unit: 'seconds', refRange: '11-13.5', flag: 'Normal' },
      { testId: 'lt_ptinr', testName: 'PT/INR', parameter: 'INR', value: '1.0', unit: '', refRange: '0.8-1.1', flag: 'Normal' },
      { testId: 'lt_ptinr', testName: 'PT/INR', parameter: 'aPTT', value: '30', unit: 'seconds', refRange: '25-35', flag: 'Normal' },
    ],
    totalAmount: 1400, paidAmount: 1400, paymentStatus: 'paid',
  },
];

// ==================== DEFAULT INVENTORY ====================

const defaultInventory: LabInventoryItem[] = [
  { id: 'li1', name: 'EDTA Tubes (2mL)', category: 'Blood Collection', unit: 'Box (100)', stock: 25, minStock: 5, costPrice: 800, sellingPrice: 1200, expiryDate: '2027-12-31', supplier: 'MediSupply Co.', batchNo: 'EDTA-2024-001' },
  { id: 'li2', name: 'Serum Separator Tubes', category: 'Blood Collection', unit: 'Box (100)', stock: 18, minStock: 5, costPrice: 1200, sellingPrice: 1800, expiryDate: '2027-12-31', supplier: 'MediSupply Co.', batchNo: 'SST-2024-001' },
  { id: 'li3', name: 'Citrate Tubes', category: 'Blood Collection', unit: 'Box (100)', stock: 8, minStock: 3, costPrice: 1500, sellingPrice: 2200, expiryDate: '2027-12-31', supplier: 'MediSupply Co.', batchNo: 'CIT-2024-001' },
  { id: 'li4', name: 'Fluoride Tubes', category: 'Blood Collection', unit: 'Box (100)', stock: 3, minStock: 5, costPrice: 1000, sellingPrice: 1500, expiryDate: '2027-06-30', supplier: 'LabChem Inc.', batchNo: 'FLU-2024-001' },
  { id: 'li5', name: 'CBC Reagent Kit', category: 'Reagents', unit: 'Kit', stock: 6, minStock: 2, costPrice: 5000, sellingPrice: 7500, expiryDate: '2026-06-30', supplier: 'LabChem Inc.', batchNo: 'CBC-REAG-001' },
  { id: 'li6', name: 'LFT Reagent Kit', category: 'Reagents', unit: 'Kit', stock: 4, minStock: 2, costPrice: 8000, sellingPrice: 12000, expiryDate: '2026-06-30', supplier: 'LabChem Inc.', batchNo: 'LFT-REAG-001' },
  { id: 'li7', name: 'Gloves (Latex, S)', category: 'Consumables', unit: 'Box (100)', stock: 45, minStock: 10, costPrice: 400, sellingPrice: 600, expiryDate: '2027-12-31', supplier: 'SafeGuard Ltd.', batchNo: 'GL-S-2024' },
  { id: 'li8', name: 'Needles 21G', category: 'Consumables', unit: 'Box (100)', stock: 12, minStock: 5, costPrice: 600, sellingPrice: 900, expiryDate: '2028-12-31', supplier: 'SafeGuard Ltd.', batchNo: 'ND-21G-2024' },
  { id: 'li9', name: 'Syringes 5mL', category: 'Consumables', unit: 'Box (100)', stock: 2, minStock: 5, costPrice: 500, sellingPrice: 800, expiryDate: '2028-12-31', supplier: 'SafeGuard Ltd.', batchNo: 'SY-5ML-2024' },
  { id: 'li10', name: 'Urine Containers', category: 'Consumables', unit: 'Pack (50)', stock: 30, minStock: 10, costPrice: 300, sellingPrice: 500, expiryDate: '2028-12-31', supplier: 'MediSupply Co.', batchNo: 'UC-50-2024' },
];

// ==================== DEFAULT EXPENSES ====================

const defaultExpenses: LabExpense[] = [
  { id: 'le1', description: 'CBC Reagent Kit Purchase', category: 'Reagents', amount: 5000, date: todayStr(), notes: 'Monthly reagent restock' },
  { id: 'le2', description: 'Blood Collection Tubes', category: 'Consumables', amount: 3600, date: todayStr(), notes: 'EDTA and SST tubes' },
  { id: 'le3', description: 'Equipment Calibration', category: 'Maintenance', amount: 2500, date: todayStr(), notes: 'Quarterly calibration' },
  { id: 'le4', description: 'Biohazard Disposal', category: 'Waste Management', amount: 1500, date: todayStr(), notes: 'Monthly waste disposal fee' },
];

// ==================== DEFAULT LAB DOCTORS ====================

export interface LabDoctor {
  id: string;
  name: string;
  designation: string; // e.g. 'Pathologist', 'Lab In-Charge', 'Supervisor', 'Microbiologist'
  qualification: string; // e.g. 'MBBS, FCPS', 'M.Phil Pathology'
  phone: string;
  active: boolean;
  showOnReport: boolean; // Whether to show on printed reports
}

const defaultLabDoctors: LabDoctor[] = [
  {
    id: 'ld_1',
    name: 'Dr. Muhammad Asif',
    designation: 'Pathologist',
    qualification: 'MBBS, FCPS (Pathology)',
    phone: '0300-1234567',
    active: true,
    showOnReport: true,
  },
  {
    id: 'ld_2',
    name: 'Dr. Fatima Noor',
    designation: 'Lab In-Charge',
    qualification: 'M.Phil (Pathology)',
    phone: '0311-9876543',
    active: true,
    showOnReport: true,
  },
];

// ==================== INITIALIZATION ====================

export function initLabData(): void {
  // Always ensure doctors exist (migration for existing installations)
  try {
    const existingDocs = localStorage.getItem(KEYS.doctors);
    if (!existingDocs) {
      set(KEYS.doctors, defaultLabDoctors);
    }
  } catch {}

  // Only set static defaults (tests, inventory, expenses, doctors) once
  if (!localStorage.getItem(KEYS.initialized)) {
    set(KEYS.tests, defaultTests);
    set(KEYS.inventory, defaultInventory);
    set(KEYS.expenses, defaultExpenses);
    set(KEYS.doctors, defaultLabDoctors);
    set(KEYS.initialized, 'true');

    // First-time: check if main store has orders, otherwise use defaults
    try {
      const mainRaw = localStorage.getItem(KEYS.mainOrdersKey);
      if (mainRaw) {
        const mainOrders: any[] = JSON.parse(mainRaw);
        const lisOrders: LabOrderItem[] = mainOrders.map(o => convertMainToLis(o));
        set(KEYS.orders, lisOrders);
      } else {
        set(KEYS.orders, defaultOrders);
      }
    } catch (e) {
      console.warn('Failed to import orders from main store:', e);
      set(KEYS.orders, defaultOrders);
    }
  }

  // ALWAYS sync new orders from main store (store.ts) into LIS store
  // This picks up orders created by Doctor page which writes to main store
  syncFromMainStore();
}

/** Convert a main store lab order to LIS format */
function convertMainToLis(o: any): LabOrderItem {
  return {
    id: o.id,
    visitId: o.visitId || '',
    patientId: o.patientId,
    patientNo: o.patientNo,
    patientName: o.patientName,
    gender: o.gender || 'Unknown',
    age: o.age || '',
    tests: (o.tests || []).map((t: any) => ({
      testName: t.testName,
      testId: t.testId || t.testName,
      price: t.price || 0,
    })),
    orderedBy: o.orderedBy || '',
    urgency: 'routine',
    sampleType: 'Blood',
    status: o.status === 'Completed' ? 'completed' as const
      : o.status === 'In Progress' ? 'processing' as const
      : o.status === 'processing' ? 'processing' as const
      : 'ordered' as const,
    date: o.date || todayStr(),
    time: o.time || '',
    results: (o.results || []).map((r: any) => ({
      testId: r.testId || '',
      testName: r.testName || r.parameter || '',
      parameter: r.parameter || r.testName || '',
      value: r.value || '',
      unit: r.unit || '',
      refRange: r.refRange || r.normalRange || '',
      flag: r.flag || r.status || 'Normal',
    })),
    totalAmount: (o.tests || []).reduce((s: number, t: any) => s + (t.price || 0), 0),
    paidAmount: 0,
    paymentStatus: 'unpaid' as const,
  };
}

/**
 * Bidirectional sync between main store (store.ts) and LIS store.
 * - NEW orders from main store → added to LIS store
 * - Status changes from LIS store → pushed to main store
 * - Status changes from main store → pulled into LIS store (if LIS is still "ordered")
 * This is called on EVERY page load so data is always fresh.
 */
export function syncFromMainStore(): void {
  try {
    const mainRaw = localStorage.getItem(KEYS.mainOrdersKey);
    if (!mainRaw) return;
    const mainOrders: any[] = JSON.parse(mainRaw);
    const lisOrders = getLabOrders();
    const lisMap = new Map(lisOrders.map(o => [o.id, o]));
    let changed = false;

    for (const mainOrder of mainOrders) {
      const existing = lisMap.get(mainOrder.id);
      if (!existing) {
        // New order from Doctor — add to LIS store
        lisOrders.push(convertMainToLis(mainOrder));
        changed = true;
      } else {
        // Existing order — check if LIS has a newer status (Lab Tech updated it)
        // Priority: LIS status wins because Lab Tech is the one processing
        const mainStatus = mainOrder.status === 'Completed' ? 'completed'
          : mainOrder.status === 'In Progress' ? 'processing'
          : mainOrder.status === 'processing' ? 'processing'
          : 'ordered';
        // Sync results from LIS to main if LIS has results
        if (existing.results && existing.results.length > 0 && (!mainOrder.results || mainOrder.results.length === 0)) {
          const lisStatus = existing.status === 'completed' ? 'Completed'
            : existing.status === 'processing' ? 'In Progress'
            : 'Pending';
          // Update main store with LIS data
          const updatedMain = mainOrders.map((o: any) => {
            if (o.id === existing.id) {
              return {
                ...o,
                status: lisStatus,
                results: existing.results.map((r: any) => ({
                  testName: r.testName || r.parameter || '',
                  value: r.value || '',
                  unit: r.unit || '',
                  normalRange: r.refRange || '',
                  status: r.flag || 'Normal',
                })),
              };
            }
            return o;
          });
          localStorage.setItem(KEYS.mainOrdersKey, JSON.stringify(updatedMain));
        } else if (mainStatus !== existing.status && existing.status === 'ordered') {
          // If main store has a newer status and LIS is still "ordered", update LIS
          existing.status = mainStatus;
          changed = true;
        }
      }
    }

    if (changed) {
      set(KEYS.orders, lisOrders);
    }
  } catch (e) {
    // Silent fail — don't break the page
  }
}

/**
 * Dispatch a custom event so other tabs/pages on the same browser
 * can auto-refresh their lab data.
 */
function dispatchLabUpdate(): void {
  try {
    window.dispatchEvent(new CustomEvent('baga_lab_update'));
    // In Electron, SQLite is the source of truth, no need for localStorage sync timestamp
    if (!isElectron()) {
      localStorage.setItem('baga_lab_sync_ts', Date.now().toString());
    }
  } catch {}
}

// ==================== RESULT ANALYSIS ====================

export function analyzeResult(value: string, param: LabParameter | undefined, gender: string): 'Normal' | 'Low' | 'High' | 'Critical' {
  if (!param) return 'Normal';
  const numVal = parseFloat(value);
  if (isNaN(numVal)) return 'Normal';
  
  // Text-based parameters (like Urinalysis)
  if (param.normalLow === 0 && param.normalHigh === 0 && param.criticalLow === 0 && param.criticalHigh === 0) {
    if (value.toLowerCase() === 'negative' || value.toLowerCase() === 'clear' || value.toLowerCase() === 'pale yellow') return 'Normal';
    if (value.toLowerCase() === 'trace' || value.toLowerCase() === '1+' || value.toLowerCase() === '+') return 'Low';
    if (value.toLowerCase() === '2+' || value.toLowerCase() === '3+' || value.toLowerCase() === '++++') return 'High';
    return 'Normal';
  }

  // Check critical ranges first
  if (numVal <= param.criticalLow || numVal >= param.criticalHigh) return 'Critical';

  // Gender-specific ranges
  const isMale = gender.toLowerCase() === 'male';
  const refLow = isMale ? param.normalLow : (param.refFemale ? parseRangeLow(param.refFemale) : param.normalLow);
  const refHigh = isMale ? param.normalHigh : (param.refFemale ? parseRangeHigh(param.refFemale) : param.normalHigh);

  if (numVal < refLow) return 'Low';
  if (numVal > refHigh) return 'High';
  return 'Normal';
}

function parseRangeLow(range: string): number {
  if (range.startsWith('<')) return 0;
  const match = range.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function parseRangeHigh(range: string): number {
  if (range.startsWith('<') || range.startsWith('>')) {
    const match = range.match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 999;
  }
  const parts = range.split('-');
  if (parts.length === 2) return parseFloat(parts[1].trim());
  return 999;
}

export function getRefRange(param: LabParameter, gender: string): string {
  const isMale = gender.toLowerCase() === 'male';
  return isMale ? param.refMale : param.refFemale;
}

// ==================== TEST DEFINITIONS CRUD ====================

export function getLabTests(): LabTestDefinition[] {
  return get(KEYS.tests, defaultTests);
}

export function getActiveLabTests(): LabTestDefinition[] {
  return getLabTests().filter(t => t.active);
}

export function getLabTestById(id: string): LabTestDefinition | undefined {
  return getLabTests().find(t => t.id === id);
}

export function getLabTestCategories(): string[] {
  return [...new Set(getLabTests().map(t => t.category))];
}

export function addLabTest(test: LabTestDefinition): void {
  const all = getLabTests();
  all.push(test);
  set(KEYS.tests, all);
}

export function updateLabTest(id: string, data: Partial<LabTestDefinition>): void {
  set(KEYS.tests, getLabTests().map(t => t.id === id ? { ...t, ...data } : t));
}

export function deleteLabTest(id: string): void {
  set(KEYS.tests, getLabTests().filter(t => t.id !== id));
}

// ==================== ORDERS CRUD ====================

export function getLabOrders(): LabOrderItem[] {
  return get(KEYS.orders, defaultOrders);
}

export function getLabOrderById(id: string): LabOrderItem | undefined {
  return getLabOrders().find(o => o.id === id);
}

export function addLabOrder(order: LabOrderItem): void {
  const all = getLabOrders();
  all.push(order);
  set(KEYS.orders, all);
  dispatchLabUpdate();
}

export function updateLabOrder(id: string, data: Partial<LabOrderItem>): void {
  set(KEYS.orders, getLabOrders().map(o => o.id === id ? { ...o, ...data } : o));

  // Sync ALL status changes back to main store (store.ts) so Reception/Dashboard see them
  try {
    const mainKey = KEYS.mainOrdersKey;
    const raw = localStorage.getItem(mainKey);
    if (raw) {
      const mainOrders = JSON.parse(raw);
      const order = getLabOrderById(id);
      if (order) {
        // Map lab-store status to main store status
        const lisStatus = data.status || order.status;
        const mainStatus = lisStatus === 'completed' ? 'Completed'
          : lisStatus === 'processing' || lisStatus === 'collected' ? 'In Progress'
          : 'Pending';
        // Build results in main store format
        const results = (data.results || order.results || []).map((r: any) => ({
          testName: r.testName || r.parameter || '',
          value: r.value || '',
          unit: r.unit || '',
          normalRange: r.refRange || r.normalRange || '',
          status: r.flag || r.status || 'Normal',
        }));
        let needsUpdate = false;
        const updated = mainOrders.map((o: any) => {
          if (o.id === id || (o.patientId === order.patientId && o.visitId === order.visitId)) {
            needsUpdate = true;
            return { ...o, status: mainStatus, results };
          }
          return o;
        });
        // Always write to main store to ensure sync
        if (needsUpdate) {
          localStorage.setItem(mainKey, JSON.stringify(updated));
        } else {
          // Order not in main store yet — add it
          mainOrders.push({
            id: order.id, visitId: order.visitId, patientId: order.patientId,
            patientNo: order.patientNo, patientName: order.patientName,
            tests: order.tests.map((t: any) => ({ testName: t.testName, price: t.price, selected: true })),
            orderedBy: order.orderedBy, date: order.date, time: order.time,
            status: mainStatus, results,
          });
          localStorage.setItem(mainKey, JSON.stringify(mainOrders));
        }
      }
    }
  } catch (e) { console.warn('Failed to sync lab status to main store:', e); }

  // Notify other pages/tabs to refresh
  dispatchLabUpdate();
}

export function deleteLabOrder(id: string): void {
  set(KEYS.orders, getLabOrders().filter(o => o.id !== id));
}

export function getLabOrdersByStatus(status: string): LabOrderItem[] {
  return getLabOrders().filter(o => o.status === status);
}

export function getLabOrdersByDate(date: string): LabOrderItem[] {
  return getLabOrders().filter(o => o.date === date);
}

// ==================== INVENTORY CRUD ====================

export function getLabInventory(): LabInventoryItem[] {
  return get(KEYS.inventory, defaultInventory);
}

export function addInventoryItem(item: LabInventoryItem): void {
  const all = getLabInventory();
  all.push(item);
  set(KEYS.inventory, all);
}

export function updateInventoryItem(id: string, data: Partial<LabInventoryItem>): void {
  set(KEYS.inventory, getLabInventory().map(i => i.id === id ? { ...i, ...data } : i));
}

export function deleteInventoryItem(id: string): void {
  set(KEYS.inventory, getLabInventory().filter(i => i.id !== id));
}

export function getLowStockItems(): LabInventoryItem[] {
  return getLabInventory().filter(i => i.stock <= i.minStock);
}

export function getExpiringItems(days: number): LabInventoryItem[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return getLabInventory().filter(i => i.expiryDate <= cutoffStr);
}

export function getInventoryCategories(): string[] {
  return [...new Set(getLabInventory().map(i => i.category))];
}

// ==================== EXPENSES CRUD ====================

export function getLabExpenses(): LabExpense[] {
  return get(KEYS.expenses, defaultExpenses);
}

export function addExpense(expense: LabExpense): void {
  const all = getLabExpenses();
  all.push(expense);
  set(KEYS.expenses, all);
}

export function updateExpense(id: string, data: Partial<LabExpense>): void {
  set(KEYS.expenses, getLabExpenses().map(e => e.id === id ? { ...e, ...data } : e));
}

export function deleteExpense(id: string): void {
  set(KEYS.expenses, getLabExpenses().filter(e => e.id !== id));
}

// ==================== STATISTICS ====================

export function getLabStatistics(period: 'today' | 'week' | 'month' | 'year' | 'all') {
  const allOrders = getLabOrders();
  const allExpenses = getLabExpenses();
  const today = todayStr();

  let filteredOrders: LabOrderItem[];
  let filteredExpenses: LabExpense[];

  switch (period) {
    case 'today':
      filteredOrders = allOrders.filter(o => o.date === today);
      filteredExpenses = allExpenses.filter(e => e.date === today);
      break;
    case 'week': {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekStr = weekAgo.toISOString().split('T')[0];
      filteredOrders = allOrders.filter(o => o.date >= weekStr);
      filteredExpenses = allExpenses.filter(e => e.date >= weekStr);
      break;
    }
    case 'month':
      filteredOrders = allOrders.filter(o => o.date >= today.substring(0, 7) + '-01');
      filteredExpenses = allExpenses.filter(e => e.date >= today.substring(0, 7) + '-01');
      break;
    case 'year':
      filteredOrders = allOrders.filter(o => o.date >= today.substring(0, 4) + '-01-01');
      filteredExpenses = allExpenses.filter(e => e.date >= today.substring(0, 4) + '-01-01');
      break;
    default:
      filteredOrders = allOrders;
      filteredExpenses = allExpenses;
  }

  const totalOrders = filteredOrders.length;
  const completedOrders = filteredOrders.filter(o => o.status === 'completed');
  const revenue = completedOrders.reduce((s, o) => s + o.paidAmount, 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const profit = revenue - totalExpenses;
  const abnormalCount = completedOrders.reduce((s, o) => {
    return s + o.results.filter(r => r.flag !== 'Normal').length;
  }, 0);

  // Daily breakdown for charts
  const dailyMap = new Map<string, { orders: number; revenue: number }>();
  filteredOrders.forEach(o => {
    const existing = dailyMap.get(o.date) || { orders: 0, revenue: 0 };
    existing.orders += 1;
    if (o.status === 'completed') existing.revenue += o.paidAmount;
    dailyMap.set(o.date, existing);
  });
  const dailyStats = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14); // last 14 days

  // Most ordered tests
  const testCounts = new Map<string, number>();
  filteredOrders.forEach(o => {
    o.tests.forEach(t => {
      testCounts.set(t.testName, (testCounts.get(t.testName) || 0) + 1);
    });
  });
  const topTests = Array.from(testCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top referring doctors
  const doctorCounts = new Map<string, number>();
  filteredOrders.forEach(o => {
    doctorCounts.set(o.orderedBy, (doctorCounts.get(o.orderedBy) || 0) + 1);
  });
  const topDoctors = Array.from(doctorCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalOrders,
    completedOrders: completedOrders.length,
    revenue,
    totalExpenses,
    profit,
    abnormalCount,
    dailyStats,
    topTests,
    topDoctors,
  };
}

// ==================== LAB DOCTORS CRUD ====================

export function getLabDoctors(): LabDoctor[] {
  return get(KEYS.doctors, defaultLabDoctors);
}

export function getActiveLabDoctors(): LabDoctor[] {
  return getLabDoctors().filter(d => d.active);
}

export function getReportDoctors(): LabDoctor[] {
  return getLabDoctors().filter(d => d.active && d.showOnReport);
}

export function addLabDoctor(doctor: LabDoctor): void {
  const all = getLabDoctors();
  all.push(doctor);
  set(KEYS.doctors, all);
}

export function updateLabDoctor(id: string, data: Partial<LabDoctor>): void {
  set(KEYS.doctors, getLabDoctors().map(d => d.id === id ? { ...d, ...data } : d));
}

export function deleteLabDoctor(id: string): void {
  set(KEYS.doctors, getLabDoctors().filter(d => d.id !== id));
}

// ==================== UTILITY ====================

export { todayStr, genId, nowTime };
