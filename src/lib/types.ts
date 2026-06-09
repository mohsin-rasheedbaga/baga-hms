/* ========== TYPES ========== */

export interface Hospital {
  name: string;
  address: string;
  phone: string;
  email: string;
  licenseNo: string;
}

export interface HospitalSettings {
  receptionCanCollectPharmacy: boolean;
  receptionCanCollectLab: boolean;
  receptionCanCollectXray: boolean;
  receptionCanCollectUltrasound: boolean;
  currency: string;
  receiptFooter: string;
  roomChargesPerNight: number;
  wardChargesPerDay: number;
  hospitalCutRatio: number; // percentage, e.g. 40 means 40%
  admissionFee: number; // default admission fee
  // Printer Settings
  printerName: string;
  printerIP: string;
  printerPort: number;
  receiptSize: 'A4' | 'thermal' | 'a5';
  // Lab Report Settings
  labInChargeDoctor: string;
  // Lab Sticker Settings
  stickerWidth: number;
  stickerHeight: number;
  stickerShowHospital: boolean;
  stickerShowPatientAge: boolean;
  stickerShowTests: boolean;
}

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'super_admin' | 'reception' | 'doctor' | 'lab' | 'pharmacy' | 'xray' | 'ultrasound' | 'accounts';
  department: string;
  active: boolean;
  permissions: string[];
}

export interface Patient {
  id: string;
  patientNo: string;
  name: string;
  fatherName: string;
  mobile: string;
  age: string;
  gender: string;
  address: string;
  cardStatus: 'Active' | 'Expired';
  cardExpiry: string;
  totalVisits: number;
  lastVisit: string;
  regDate: string;
}

export interface Visit {
  id: string;
  patientId: string;
  patientNo: string;
  patientName: string;
  department: string;
  doctor: string;
  doctorFee: number;
  tokenNo: number;
  date: string;
  time: string;
  status: 'Active' | 'Completed' | 'Discharged';
  diagnosis: string;
  notes: string;
  vitals: { bp: string; pulse: string; temp: string; weight: string; };
}

export interface LabOrder {
  id: string;
  visitId: string;
  patientId: string;
  patientNo: string;
  patientName: string;
  tests: LabTest[];
  orderedBy: string;
  date: string;
  time: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  results: LabResult[];
}

export interface LabTest {
  testName: string;
  price: number;
  selected: boolean;
}

export interface LabResult {
  testName: string;
  value: string;
  unit: string;
  normalRange: string;
  status: 'Normal' | 'Low' | 'High';
}

export interface Prescription {
  id: string;
  visitId: string;
  patientId: string;
  patientNo: string;
  patientName: string;
  medicines: PrescriptionMedicine[];
  prescribedBy: string;
  date: string;
  time: string;
  status: 'Active' | 'Dispensed';
  notes: string;
}

export interface PrescriptionMedicine {
  name: string;
  form: string;
  strength: string;
  qtyPerDay: string;
  timing: string;
  duration: string;
  instructions: string;
  price: number;
  selected: boolean;
  dosage?: string;
  frequency?: string;
}

export interface DispenseRecord {
  id: string;
  prescriptionId: string;
  patientNo: string;
  patientName: string;
  medicines: string[];
  dispensedBy: string;
  date: string;
  time: string;
}

export interface Bill {
  id: string;
  patientId: string;
  patientNo: string;
  patientName: string;
  visitId: string;
  items: BillItem[];
  totalAmount: number;
  paidAmount: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  paymentMethod: 'Cash' | 'Card' | 'Pending' | 'Online';
  date: string;
  time: string;
  receivedBy: string;
}

export interface BillItem {
  description: string;
  amount: number;
  type: 'Consultation' | 'Lab' | 'X-Ray' | 'Ultrasound' | 'Pharmacy' | 'Card' | 'Renewal' | 'Admission';
  selected: boolean;
  quantity: number;
}

export interface XRayOrder {
  id: string;
  visitId: string;
  patientId: string;
  patientNo: string;
  patientName: string;
  xrayType: string;
  price: number;
  selected: boolean;
  orderedBy: string;
  date: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  report?: string;
  xrayImage?: string;
}

export interface UltrasoundOrder {
  id: string;
  visitId: string;
  patientId: string;
  patientNo: string;
  patientName: string;
  usgType: string;
  price: number;
  selected: boolean;
  orderedBy: string;
  date: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  report?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientNo: string;
  patientName: string;
  department: string;
  doctor: string;
  appointmentDate: string;
  appointmentTime: string;
  purpose: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  createdAt: string;
}

export interface Admission {
  id: string;
  patientId: string;
  patientNo: string;
  patientName: string;
  department: string;
  doctor: string;
  doctorFee: number;
  admissionDate: string;
  admittedAt: string; // date when actually admitted by reception
  dischargedAt: string; // date when discharged
  purpose: string;
  roomNo: string;
  roomTypeId: string; // room type ID for charge calculation
  roomChargesPerNight: number; // snapshot of room charges at admit time
  status: 'Approved' | 'Admitted' | 'Discharged';
  notes: string;
  createdAt: string;
  approvedBy: string;
}

export interface MedicineItem {
  id: string;
  name: string;
  genericName: string;
  form: 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'Cream' | 'Drops' | 'Inhaler' | 'Powder';
  strength: string; // e.g. "500mg", "250mg/5ml"
  packing: string;  // e.g. "10 tablets", "100ml bottle"
  price: number;
  category: string; // e.g. "Pain Relief", "Antibiotic"
  active: boolean;
  stock: number;         // current stock quantity
  expiryDate: string;   // YYYY-MM-DD format
  minStock: number;     // minimum stock level for alerts
  // Extended fields
  barcode?: string;
  batchNumber?: string;
  brandName?: string;
  companyName?: string;
  purchasePrice?: number;
  wholesalePrice?: number;
  mfgDate?: string;
  rackLocation?: string;
  supplierName?: string;
  supplierContact?: string;
  medicineType?: string;
  packingType?: string;
}

export interface LabTestCatalog {
  id: string;
  testName: string;
  category: string; // e.g. "Hematology", "Biochemistry"
  price: number;
  turnaroundTime: string; // e.g. "2 hours", "24 hours"
  active: boolean;
}

export interface RoomType {
  id: string;
  name: string; // e.g. "General Ward", "Private Room", "ICU"
  chargesPerNight: number;
  active: boolean;
}

export interface EducationRecord {
  degree: string;
  institution: string;
  year: string;
  grade: string;
}

export interface ExperienceRecord {
  organization: string;
  position: string;
  startDate: string;
  endDate: string;
  duration: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  type: 'CNIC' | 'CV' | 'Degree' | 'Certificate' | 'Experience Letter' | 'Photo' | 'Other';
  fileName: string;
  uploadDate: string;
}

export interface EquipmentRecord {
  id: string;
  itemName: string;
  category: 'Laptop' | 'Mobile' | 'Uniform' | 'ID Card' | 'Badge' | 'Vehicle' | 'Medical Kit' | 'Tools' | 'Keys' | 'Other';
  serialNumber: string;
  issuedDate: string;
  returnDate: string;
  condition: 'New' | 'Good' | 'Fair' | 'Damaged';
  status: 'Issued' | 'Returned' | 'Lost' | 'Damaged';
  notes: string;
}

export interface Employee {
  id: string;
  employeeCode: string; // Auto-generated 4-digit code e.g. "0001"
  name: string;
  fatherName: string;
  cnic: string;
  mobile: string;
  gender: string;
  age: string;
  address: string;
  designation: string;
  department: string;
  salary: number;
  joinDate: string;
  status: 'Active' | 'Inactive' | 'Terminated';
  education: EducationRecord[];
  experience: ExperienceRecord[];
  documents: DocumentRecord[];
  equipment: EquipmentRecord[];
  bankAccount: string;
  emergencyContact: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'Present' | 'Absent' | 'Half Day' | 'Leave' | 'Holiday';
  notes: string;
}

export interface SalaryRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  month: string; // "2025-05"
  basicSalary: number;
  allowances: number;
  deductions: number;
  absentDeduction: number;
  halfDayDeduction: number;
  overtime: number;
  bonus: number;
  netSalary: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  totalWorkingDays: number;
  status: 'Pending' | 'Approved' | 'Paid' | 'Partial';
  approvedBy: string;
  approvedDate: string;
  paidDate: string;
  forwardedToAccountant: boolean;
  accountantPaidDate: string;
  notes: string;
}
