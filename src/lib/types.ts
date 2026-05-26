export interface Patient {
  id: string;
  patientNumber: string;
  name: string;
  relationType: 'father' | 'husband';
  relationName: string;
  mobile: string;
  age: string;
  address: string;
  gender: 'male' | 'female';
  cardStatus: 'active' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  visitNumber: string;
  patientId: string;
  patientNumber: string;
  date: string;
  time: string;
  doctorName: string;
  status: 'waiting' | 'in-progress' | 'seen' | 'completed';
  diagnosis: string;
  prescription: PrescriptionItem[];
  labTests: LabOrder[];
  xrayOrders: XrayOrder[];
  ultrasoundOrders: UltrasoundOrder[];
  surgeryOrder: SurgeryOrder | null;
  notes: string;
  createdAt: string;
}

export interface PrescriptionItem {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface LabOrder {
  id: string;
  testName: string;
  price: number;
  status: 'ordered' | 'paid' | 'processing' | 'completed';
  result: string;
  paidAt: string | null;
  completedAt: string | null;
  paymentLocation: 'lab' | 'reception';
}

export interface XrayOrder {
  id: string;
  testName: string;
  price: number;
  status: 'ordered' | 'paid' | 'processing' | 'completed';
  result: string;
  paidAt: string | null;
  completedAt: string | null;
  paymentLocation: 'xray' | 'reception';
}

export interface UltrasoundOrder {
  id: string;
  testName: string;
  price: number;
  status: 'ordered' | 'paid' | 'processing' | 'completed';
  result: string;
  paidAt: string | null;
  completedAt: string | null;
  paymentLocation: 'ultrasound' | 'reception';
}

export interface SurgeryOrder {
  id: string;
  surgeryType: string;
  totalCost: number;
  amountPaid: number;
  balance: number;
  status: 'scheduled' | 'in-progress' | 'completed';
  paymentLocation: 'reception' | 'surgery';
  notes: string;
}

export interface PharmacyBill {
  id: string;
  visitId: string;
  patientId: string;
  patientNumber: string;
  patientName: string;
  medicines: PrescriptionItem[];
  totalAmount: number;
  status: 'pending' | 'paid' | 'dispensed';
  paymentLocation: 'pharmacy' | 'reception';
  createdAt: string;
}

export interface HMSData {
  patients: Patient[];
  visits: Visit[];
  pharmacyBills: PharmacyBill[];
  settings: HMSSettings;
  counters: {
    patient: number;
    visit: number;
  };
}

export interface HMSSettings {
  hospitalName: string;
  hospitalAddress: string;
  hospitalPhone: string;
  pharmacyPaymentLocation: 'pharmacy' | 'reception';
  labPaymentLocation: 'lab' | 'reception';
  xrayPaymentLocation: 'xray' | 'reception';
  ultrasoundPaymentLocation: 'ultrasound' | 'reception';
  surgeryPaymentLocation: 'reception' | 'surgery';
}

export type UserRole = 'reception' | 'doctor' | 'pharmacy' | 'lab' | 'xray' | 'ultrasound' | 'admin';
