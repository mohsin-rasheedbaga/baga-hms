/* ========== DATA STORE - Offline / LocalStorage + Electron SQLite ========== */
import type { Hospital, HospitalSettings, User, Patient, Visit, LabOrder, Prescription, DispenseRecord, Bill, XRayOrder, UltrasoundOrder, Appointment, Admission, MedicineItem, LabTestCatalog, RoomType, Employee, AttendanceRecord, SalaryRecord } from './types';
import { isElectron, isLanMode, dbGetAll, dbSetAll, dbSetById, dbGetCounter, dbSetCounter } from './db-bridge';

const KEYS = {
  hospital: 'baga_hospital',
  hospitalSettings: 'baga_hospital_settings',
  users: 'baga_users',
  patients: 'baga_patients',
  visits: 'baga_visits',
  labOrders: 'baga_lab_orders',
  prescriptions: 'baga_prescriptions',
  dispenses: 'baga_dispenses',
  bills: 'baga_bills',
  xrayOrders: 'baga_xray_orders',
  ultrasoundOrders: 'baga_ultrasound_orders',
  patientCounter: 'baga_patient_counter',
  appointments: 'baga_appointments',
  admissions: 'baga_admissions',
  medicines: 'baga_medicines',
  labTestCatalog: 'baga_lab_test_catalog',
  roomTypes: 'baga_room_types',
  employees: 'baga_employees',
  employeeCounter: 'baga_employee_counter',
  attendance: 'baga_attendance',
  salaries: 'baga_salaries',
};

/* ========== Generic Helpers ========== */

// Table name mapping for SQLite
const TABLES: Record<string, string> = {
  baga_hospital: 'hospital',
  baga_hospital_settings: 'hospital_settings',
  baga_users: 'users',
  baga_patients: 'patients',
  baga_visits: 'visits',
  baga_lab_orders: 'lab_orders',
  baga_prescriptions: 'prescriptions',
  baga_dispenses: 'dispenses',
  baga_bills: 'bills',
  baga_xray_orders: 'xray_orders',
  baga_ultrasound_orders: 'ultrasound_orders',
  baga_appointments: 'appointments',
  baga_admissions: 'admissions',
  baga_medicines: 'medicines',
  baga_lab_test_catalog: 'lab_test_catalog',
  baga_room_types: 'room_types',
  baga_employees: 'employees',
  baga_attendance: 'attendance',
  baga_salaries: 'salaries',
};

function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  // Single-object tables: hospital, hospital_settings
  const SINGLE_OBJECT_KEYS = ['baga_hospital', 'baga_hospital_settings'];

  // Try Electron SQLite first
  if (isElectron()) {
    const tableName = TABLES[key];
    if (tableName) {
      const data = dbGetAll(tableName);
      if (data !== null) {
        if (SINGLE_OBJECT_KEYS.includes(key)) {
          // For single-object tables, return the first element
          if (Array.isArray(data) && data.length > 0) return data[0] as T;
        }
        return data as T;
      }
    }
  }

  // Try LAN server API (for browser clients connected via LAN)
  if (isLanMode() && TABLES[key]) {
    const data = dbGetAll(TABLES[key]);
    if (data !== null) {
      if (SINGLE_OBJECT_KEYS.includes(key)) {
        if (Array.isArray(data) && data.length > 0) return data[0] as T;
      }
      return data as T;
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
    const tableName = TABLES[key];
    if (tableName) {
      // Single-object tables (hospital, settings) - use setById
      if (!Array.isArray(data)) {
        const item = data as any;
        const id = item.id || 'main';
        if (dbSetById(tableName, id, item)) return;
      } else {
        // Array data: pass directly to dbSetAll (NO wrapping)
        // database.js setAll expects flat objects with id field
        if (dbSetAll(tableName, data)) return;
      }
    }
  }

  // Try LAN server API (for browser clients connected via LAN)
  if (isLanMode() && TABLES[key]) {
    if (!Array.isArray(data)) {
      const item = data as any;
      const id = item.id || 'main';
      if (dbSetById(TABLES[key], id, item)) return;
    } else {
      if (dbSetAll(TABLES[key], data)) return;
    }
  }

  // Fall back to localStorage
  localStorage.setItem(key, JSON.stringify(data));
}

/* ========== HOSPITAL ========== */
const defaultHospital: Hospital = {
  name: 'BAGA Hospital',
  address: 'Main Road, City',
  phone: '0300-1234567',
  email: 'info@bagahospital.com',
  licenseNo: 'BAGA-LIC-0001',
};

export function getHospital(): Hospital { return get(KEYS.hospital, defaultHospital); }
export function setHospital(h: Hospital): void { set(KEYS.hospital, h); }

/* ========== HOSPITAL SETTINGS ========== */
const defaultSettings: HospitalSettings = {
  receptionCanCollectPharmacy: true,
  receptionCanCollectLab: true,
  receptionCanCollectXray: true,
  receptionCanCollectUltrasound: true,
  currency: 'Rs.',
  receiptFooter: 'Thank you for choosing BAGA Hospital. Get well soon!',
  roomChargesPerNight: 1500,
  wardChargesPerDay: 1000,
  hospitalCutRatio: 40,
  admissionFee: 2000,
  printerName: 'Default Printer',
  printerIP: '127.0.0.1',
  printerPort: 9100,
  receiptSize: 'A4',
  labInChargeDoctor: '',
  stickerWidth: 80,
  stickerHeight: 40,
  stickerShowHospital: true,
  stickerShowPatientAge: true,
  stickerShowTests: true,
};

export function getHospitalSettings(): HospitalSettings { return get(KEYS.hospitalSettings, defaultSettings); }
export function setHospitalSettings(s: HospitalSettings): void { set(KEYS.hospitalSettings, s); }
export function updateHospitalSettings(data: Partial<HospitalSettings>): void {
  setHospitalSettings({ ...getHospitalSettings(), ...data });
}

/* ========== USERS ========== */
const defaultUsers: User[] = [];

export function getUsers(): User[] { return get(KEYS.users, defaultUsers); }
export function setUsers(u: User[]): void { set(KEYS.users, u); }
export function addUser(u: User): void { const all = getUsers(); all.push(u); setUsers(all); }
export function updateUser(id: string, data: Partial<User>): void {
  setUsers(getUsers().map(u => u.id === id ? { ...u, ...data } : u));
}
export function deleteUser(id: string): void { setUsers(getUsers().filter(u => u.id !== id)); }

/* ========== PATIENTS ========== */
const defaultPatients: Patient[] = [
  { id: 'p1', patientNo: 'BAGA-0001', name: 'Muhammad Ali', fatherName: 'Abdul Rehman', mobile: '03001234567', age: '35', gender: 'Male', address: 'Street 5, Lahore', cardStatus: 'Active', cardExpiry: '2026-05-15', totalVisits: 5, lastVisit: '2025-05-16', regDate: '2025-01-15' },
  { id: 'p2', patientNo: 'BAGA-0002', name: 'Fatima Bibi', fatherName: 'Haji Rasool', mobile: '03119876543', age: '28', gender: 'Female', address: 'Block C, Karachi', cardStatus: 'Active', cardExpiry: '2026-02-20', totalVisits: 3, lastVisit: '2025-05-16', regDate: '2025-02-20' },
  { id: 'p3', patientNo: 'BAGA-0003', name: 'Ahmed Khan', fatherName: 'Ghulam Khan', mobile: '03234567890', age: '45', gender: 'Male', address: 'Mohalla Shah, Multan', cardStatus: 'Active', cardExpiry: '2026-04-15', totalVisits: 8, lastVisit: '2025-05-16', regDate: '2024-12-05' },
];

export function getPatients(): Patient[] { return get(KEYS.patients, defaultPatients); }
export function setPatients(p: Patient[]): void { set(KEYS.patients, p); }
export function addPatient(p: Patient): void { const all = getPatients(); all.push(p); setPatients(all); }
export function updatePatient(id: string, data: Partial<Patient>): void {
  setPatients(getPatients().map(p => p.id === id ? { ...p, ...data } : p));
}
export function getPatientById(id: string): Patient | undefined { return getPatients().find(p => p.id === id); }
export function getPatientByNo(no: string): Patient | undefined { return getPatients().find(p => p.patientNo === no); }
export function getPatientByMobile(mobile: string): Patient[] { return getPatients().filter(p => p.mobile.includes(mobile)); }
export function searchPatients(q: string): Patient[] {
  const lq = q.toLowerCase();
  return getPatients().filter(p =>
    p.patientNo.toLowerCase().includes(lq) ||
    p.mobile.includes(q) ||
    p.name.toLowerCase().includes(lq)
  );
}
/* Department-specific Patient ID counters:
 * Reception: baga_patient_counter → BAGA-XXXX
 * Lab:       lab_patient_counter  → LAB-XXXX  (in lab-store.ts)
 * Pharmacy:  baga_outdoor_counter → OUT-XXXX   (in pharmacy page.tsx)
 */
export function getPatientCounter(): number {
  if (isElectron()) {
    const val = dbGetCounter('patient_counter');
    if (val !== null) return val;
  }
  return get(KEYS.patientCounter, 4);
}
export function setPatientCounter(n: number): void {
  if (isElectron()) {
    dbSetCounter('patient_counter', n);
    return;
  }
  set(KEYS.patientCounter, n);
}

/* ========== VISITS ========== */
const defaultVisits: Visit[] = [
  { id: 'v1', patientId: 'p1', patientNo: 'BAGA-0001', patientName: 'Muhammad Ali', department: 'Cardiology', doctor: 'Dr. Muhammad Ali', doctorFee: 2500, tokenNo: 1, date: '2025-05-16', time: '09:30 AM', status: 'Active', diagnosis: 'Chest pain - under investigation', notes: 'Patient reports chest pain for 3 days', vitals: { bp: '140/90', pulse: '88', temp: '98.6F', weight: '75kg' } },
  { id: 'v2', patientId: 'p2', patientNo: 'BAGA-0002', patientName: 'Fatima Bibi', department: 'Gynecology', doctor: 'Dr. Sara Khan', doctorFee: 2000, tokenNo: 2, date: '2025-05-16', time: '10:15 AM', status: 'Active', diagnosis: 'Prenatal checkup', notes: 'Routine pregnancy checkup', vitals: { bp: '120/80', pulse: '76', temp: '98.4F', weight: '65kg' } },
  { id: 'v3', patientId: 'p3', patientNo: 'BAGA-0003', patientName: 'Ahmed Khan', department: 'Orthopedic', doctor: 'Dr. Bilal Siddiqui', doctorFee: 1800, tokenNo: 3, date: '2025-05-16', time: '11:00 AM', status: 'Active', diagnosis: 'Knee pain - suspected ligament injury', notes: 'Pain in right knee after fall', vitals: { bp: '130/85', pulse: '80', temp: '98.6F', weight: '80kg' } },
];

export function getVisits(): Visit[] { return get(KEYS.visits, defaultVisits); }
export function setVisits(v: Visit[]): void { set(KEYS.visits, v); }
export function addVisit(v: Visit): void { const all = getVisits(); all.push(v); setVisits(all); }
export function updateVisit(id: string, data: Partial<Visit>): void {
  setVisits(getVisits().map(v => v.id === id ? { ...v, ...data } : v));
}
export function getVisitsByPatient(patientId: string): Visit[] { return getVisits().filter(v => v.patientId === patientId); }
export function getActiveVisitByPatient(patientId: string): Visit | undefined { return getVisits().find(v => v.patientId === patientId && v.status === 'Active'); }
export function getVisitsByDate(date: string): Visit[] { return getVisits().filter(v => v.date === date); }

/* ========== LAB ORDERS (Doctor creates, Lab sees) ========== */
const defaultLabOrders: LabOrder[] = [
  {
    id: 'lo1', visitId: 'v1', patientId: 'p1', patientNo: 'BAGA-0001', patientName: 'Muhammad Ali',
    tests: [
      { testName: 'CBC (Complete Blood Count)', price: 800, selected: true },
      { testName: 'Lipid Profile', price: 1200, selected: true },
      { testName: 'Liver Function Test (LFT)', price: 1500, selected: true },
      { testName: 'Kidney Function Test (KFT)', price: 1200, selected: true },
      { testName: 'Blood Sugar (Fasting)', price: 400, selected: true },
      { testName: 'Troponin T', price: 1800, selected: true },
    ],
    orderedBy: 'Dr. Muhammad Ali', date: '2025-05-16', time: '09:45 AM', status: 'Pending', results: []
  },
  {
    id: 'lo2', visitId: 'v2', patientId: 'p2', patientNo: 'BAGA-0002', patientName: 'Fatima Bibi',
    tests: [
      { testName: 'CBC (Complete Blood Count)', price: 800, selected: true },
      { testName: 'Blood Group & Rh', price: 500, selected: true },
      { testName: 'Hemoglobin', price: 400, selected: true },
      { testName: 'Urine Routine Examination', price: 300, selected: true },
    ],
    orderedBy: 'Dr. Sara Khan', date: '2025-05-16', time: '10:30 AM', status: 'Pending', results: []
  },
];

export function getLabOrders(): LabOrder[] { return get(KEYS.labOrders, defaultLabOrders); }
export function setLabOrders(o: LabOrder[]): void { set(KEYS.labOrders, o); }
export function addLabOrder(o: LabOrder): void { const all = getLabOrders(); all.push(o); setLabOrders(all); }
export function updateLabOrder(id: string, data: Partial<LabOrder>): void {
  setLabOrders(getLabOrders().map(o => o.id === id ? { ...o, ...data } : o));
}
export function getLabOrdersByPatient(patientId: string): LabOrder[] { return getLabOrders().filter(o => o.patientId === patientId); }
export function getLabOrdersByVisit(visitId: string): LabOrder[] { return getLabOrders().filter(o => o.visitId === visitId); }
export function getPendingLabOrders(): LabOrder[] { return getLabOrders().filter(o => o.status !== 'Completed'); }

/* ========== PRESCRIPTIONS (Doctor creates, Pharmacy sees) ========== */
const defaultPrescriptions: Prescription[] = [
  {
    id: 'pr1', visitId: 'v1', patientId: 'p1', patientNo: 'BAGA-0001', patientName: 'Muhammad Ali',
    medicines: [
      { name: 'Aspirin', form: 'Tablet', strength: '75mg', qtyPerDay: '1', timing: 'After Breakfast', duration: '7 days', instructions: 'Take with water', price: 35, selected: true, dosage: '1 tablet', frequency: 'After Breakfast' },
      { name: 'Clopidogrel', form: 'Tablet', strength: '75mg', qtyPerDay: '1', timing: 'After Lunch', duration: '7 days', instructions: '', price: 180, selected: true, dosage: '1 tablet', frequency: 'After Lunch' },
      { name: 'Atorvastatin', form: 'Tablet', strength: '20mg', qtyPerDay: '1', timing: 'At Bedtime', duration: '30 days', instructions: '', price: 150, selected: true, dosage: '1 tablet', frequency: 'At Bedtime' },
      { name: 'Metoprolol', form: 'Tablet', strength: '50mg', qtyPerDay: '1', timing: 'After Meal', duration: '7 days', instructions: 'Do not stop suddenly', price: 90, selected: true, dosage: '1 tablet', frequency: 'Twice daily' },
      { name: 'Omeprazole', form: 'Capsule', strength: '20mg', qtyPerDay: '1', timing: 'Empty Stomach', duration: '14 days', instructions: 'Take 30 min before breakfast', price: 75, selected: true, dosage: '1 capsule', frequency: 'Empty Stomach' },
    ],
    prescribedBy: 'Dr. Muhammad Ali', date: '2025-05-16', time: '10:00 AM', status: 'Active', notes: 'Complete the full course. Avoid heavy meals.'
  },
  {
    id: 'pr2', visitId: 'v2', patientId: 'p2', patientNo: 'BAGA-0002', patientName: 'Fatima Bibi',
    medicines: [
      { name: 'Folic Acid', form: 'Tablet', strength: '5mg', qtyPerDay: '1', timing: 'After Breakfast', duration: '30 days', instructions: '', price: 35, selected: true, dosage: '1 tablet', frequency: 'After Breakfast' },
      { name: 'Iron Supplement', form: 'Tablet', strength: '200mg', qtyPerDay: '1', timing: 'Empty Stomach', duration: '30 days', instructions: 'Take with orange juice', price: 95, selected: true, dosage: '1 tablet', frequency: 'Empty Stomach' },
      { name: 'Calcium + Vitamin D', form: 'Tablet', strength: '500mg+200IU', qtyPerDay: '1', timing: 'After Lunch', duration: '30 days', instructions: '', price: 95, selected: true, dosage: '1 tablet', frequency: 'After Lunch' },
    ],
    prescribedBy: 'Dr. Sara Khan', date: '2025-05-16', time: '10:45 AM', status: 'Active', notes: 'Continue prenatal vitamins throughout pregnancy.'
  },
];

export function getPrescriptions(): Prescription[] { return get(KEYS.prescriptions, defaultPrescriptions); }
export function setPrescriptions(p: Prescription[]): void { set(KEYS.prescriptions, p); }
export function addPrescription(p: Prescription): void { const all = getPrescriptions(); all.push(p); setPrescriptions(all); }
export function updatePrescription(id: string, data: Partial<Prescription>): void {
  setPrescriptions(getPrescriptions().map(p => p.id === id ? { ...p, ...data } : p));
}
export function getPrescriptionsByPatient(patientId: string): Prescription[] { return getPrescriptions().filter(p => p.patientId === patientId); }
export function getPrescriptionsByVisit(visitId: string): Prescription[] { return getPrescriptions().filter(p => p.visitId === visitId); }
export function getActivePrescriptions(): Prescription[] { return getPrescriptions().filter(p => p.status === 'Active'); }

/* ========== DISPENSE RECORDS (Pharmacy creates) ========== */
export function getDispenses(): DispenseRecord[] { return get(KEYS.dispenses, []); }
export function setDispenses(d: DispenseRecord[]): void { set(KEYS.dispenses, d); }
export function addDispense(d: DispenseRecord): void { const all = getDispenses(); all.push(d); setDispenses(all); }

/* ========== BILLS ========== */
export function getBills(): Bill[] { return get(KEYS.bills, []); }
export function setBills(b: Bill[]): void { set(KEYS.bills, b); }
export function addBill(b: Bill): void { const all = getBills(); all.push(b); setBills(all); }
export function updateBill(id: string, data: Partial<Bill>): void {
  setBills(getBills().map(b => b.id === id ? { ...b, ...data } : b));
}
export function getBillsByPatient(patientId: string): Bill[] { return getBills().filter(b => b.patientId === patientId); }

/* ========== X-RAY ORDERS ========== */
const defaultXRayOrders: XRayOrder[] = [
  {
    id: 'xo1', visitId: 'v1', patientId: 'p1', patientNo: 'BAGA-0001', patientName: 'Muhammad Ali',
    xrayType: 'Chest X-Ray (PA View)', price: 1500, selected: true,
    orderedBy: 'Dr. Muhammad Ali', date: '2025-05-16', status: 'Pending'
  },
  {
    id: 'xo2', visitId: 'v3', patientId: 'p3', patientNo: 'BAGA-0003', patientName: 'Ahmed Khan',
    xrayType: 'Knee X-Ray (Both AP & Lateral)', price: 1800, selected: true,
    orderedBy: 'Dr. Bilal Siddiqui', date: '2025-05-16', status: 'Pending'
  },
];

export function getXRayOrders(): XRayOrder[] { return get(KEYS.xrayOrders, defaultXRayOrders); }
export function setXRayOrders(o: XRayOrder[]): void { set(KEYS.xrayOrders, o); }
export function addXRayOrder(o: XRayOrder): void { const all = getXRayOrders(); all.push(o); setXRayOrders(all); }
export function updateXRayOrder(id: string, data: Partial<XRayOrder>): void {
  setXRayOrders(getXRayOrders().map(o => o.id === id ? { ...o, ...data } : o));
}
export function getXRayOrdersByVisit(visitId: string): XRayOrder[] { return getXRayOrders().filter(o => o.visitId === visitId); }
export function getPendingXRayOrders(): XRayOrder[] { return getXRayOrders().filter(o => o.status !== 'Completed'); }

/* ========== ULTRASOUND ORDERS ========== */
const defaultUltrasoundOrders: UltrasoundOrder[] = [
  {
    id: 'uo1', visitId: 'v2', patientId: 'p2', patientNo: 'BAGA-0002', patientName: 'Fatima Bibi',
    usgType: 'Obstetric Ultrasound', price: 2500, selected: true,
    orderedBy: 'Dr. Sara Khan', date: '2025-05-16', status: 'Pending'
  },
  {
    id: 'uo2', visitId: 'v3', patientId: 'p3', patientNo: 'BAGA-0003', patientName: 'Ahmed Khan',
    usgType: 'Knee Ultrasound', price: 2000, selected: true,
    orderedBy: 'Dr. Bilal Siddiqui', date: '2025-05-16', status: 'Pending'
  },
];

export function getUltrasoundOrders(): UltrasoundOrder[] { return get(KEYS.ultrasoundOrders, defaultUltrasoundOrders); }
export function setUltrasoundOrders(o: UltrasoundOrder[]): void { set(KEYS.ultrasoundOrders, o); }
export function addUltrasoundOrder(o: UltrasoundOrder): void { const all = getUltrasoundOrders(); all.push(o); setUltrasoundOrders(all); }
export function updateUltrasoundOrder(id: string, data: Partial<UltrasoundOrder>): void {
  setUltrasoundOrders(getUltrasoundOrders().map(o => o.id === id ? { ...o, ...data } : o));
}
export function getUltrasoundOrdersByVisit(visitId: string): UltrasoundOrder[] { return getUltrasoundOrders().filter(o => o.visitId === visitId); }
export function getPendingUltrasoundOrders(): UltrasoundOrder[] { return getUltrasoundOrders().filter(o => o.status !== 'Completed'); }

/* ========== APPOINTMENTS ========== */
export function getAppointments(): Appointment[] { return get(KEYS.appointments, []); }
export function setAppointments(a: Appointment[]): void { set(KEYS.appointments, a); }
export function addAppointment(a: Appointment): void { const all = getAppointments(); all.push(a); setAppointments(all); }
export function updateAppointment(id: string, data: Partial<Appointment>): void {
  setAppointments(getAppointments().map(a => a.id === id ? { ...a, ...data } : a));
}
export function getAppointmentsByPatient(patientId: string): Appointment[] { return getAppointments().filter(a => a.patientId === patientId); }
export function getTodayAppointments(): Appointment[] { return getAppointments().filter(a => a.appointmentDate === todayStr() && a.status === 'Scheduled'); }

/* ========== ADMISSIONS ========== */
export function getAdmissions(): Admission[] { return get(KEYS.admissions, []); }
export function setAdmissions(a: Admission[]): void { set(KEYS.admissions, a); }
export function addAdmission(a: Admission): void { const all = getAdmissions(); all.push(a); setAdmissions(all); }
export function updateAdmission(id: string, data: Partial<Admission>): void {
  setAdmissions(getAdmissions().map(a => a.id === id ? { ...a, ...data } : a));
}
export function getAdmissionsByPatient(patientId: string): Admission[] { return getAdmissions().filter(a => a.patientId === patientId); }
export function getActiveAdmissions(): Admission[] { return getAdmissions().filter(a => a.status === 'Admitted'); }
export function getNextTokenNo(): number {
  const todayVisits = getVisits().filter(v => v.date === todayStr());
  return todayVisits.length + 1;
}

/* ========== MEDICINES DATABASE ========== */
const defaultMedicines: MedicineItem[] = [
  { id: 'med1', name: 'Paracetamol', genericName: 'Acetaminophen', form: 'Tablet', strength: '500mg', packing: '10 tablets', price: 30, category: 'Pain Relief', active: true, stock: 150, expiryDate: '2027-06-30', minStock: 20 },
  { id: 'med2', name: 'Paracetamol', genericName: 'Acetaminophen', form: 'Syrup', strength: '125mg/5ml', packing: '60ml bottle', price: 85, category: 'Pain Relief', active: true, stock: 150, expiryDate: '2027-06-30', minStock: 20 },
  { id: 'med3', name: 'Ibuprofen', genericName: 'Ibuprofen', form: 'Tablet', strength: '400mg', packing: '10 tablets', price: 45, category: 'Pain Relief', active: true, stock: 150, expiryDate: '2027-06-30', minStock: 20 },
  { id: 'med4', name: 'Ibuprofen', genericName: 'Ibuprofen', form: 'Syrup', strength: '100mg/5ml', packing: '60ml bottle', price: 95, category: 'Pain Relief', active: true, stock: 150, expiryDate: '2027-06-30', minStock: 20 },
  { id: 'med5', name: 'Amoxicillin', genericName: 'Amoxicillin', form: 'Capsule', strength: '250mg', packing: '10 capsules', price: 65, category: 'Antibiotic', active: true, stock: 0, expiryDate: '2025-01-15', minStock: 20 },
  { id: 'med6', name: 'Amoxicillin', genericName: 'Amoxicillin', form: 'Capsule', strength: '500mg', packing: '10 capsules', price: 110, category: 'Antibiotic', active: true, stock: 100, expiryDate: '2027-09-30', minStock: 15 },
  { id: 'med7', name: 'Azithromycin', genericName: 'Azithromycin', form: 'Tablet', strength: '500mg', packing: '3 tablets', price: 120, category: 'Antibiotic', active: true, stock: 100, expiryDate: '2027-09-30', minStock: 15 },
  { id: 'med8', name: 'Ciprofloxacin', genericName: 'Ciprofloxacin', form: 'Tablet', strength: '500mg', packing: '10 tablets', price: 90, category: 'Antibiotic', active: true, stock: 100, expiryDate: '2027-09-30', minStock: 15 },
  { id: 'med9', name: 'Metronidazole', genericName: 'Metronidazole', form: 'Tablet', strength: '400mg', packing: '10 tablets', price: 55, category: 'Antibiotic', active: true, stock: 100, expiryDate: '2027-09-30', minStock: 15 },
  { id: 'med10', name: 'Omeprazole', genericName: 'Omeprazole', form: 'Capsule', strength: '20mg', packing: '10 capsules', price: 75, category: 'Gastrointestinal', active: true, stock: 5, expiryDate: '2025-04-30', minStock: 15 },
  { id: 'med11', name: 'Pantoprazole', genericName: 'Pantoprazole', form: 'Tablet', strength: '40mg', packing: '10 tablets', price: 95, category: 'Gastrointestinal', active: true, stock: 80, expiryDate: '2027-03-31', minStock: 10 },
  { id: 'med12', name: 'Ranitidine', genericName: 'Ranitidine', form: 'Tablet', strength: '150mg', packing: '10 tablets', price: 60, category: 'Gastrointestinal', active: true, stock: 80, expiryDate: '2027-03-31', minStock: 10 },
  { id: 'med13', name: 'Domperidone', genericName: 'Domperidone', form: 'Tablet', strength: '10mg', packing: '10 tablets', price: 50, category: 'Gastrointestinal', active: true, stock: 80, expiryDate: '2027-03-31', minStock: 10 },
  { id: 'med14', name: 'Antacid Suspension', genericName: 'Aluminium/Magnesium Hydroxide', form: 'Syrup', strength: '200mg/200mg/5ml', packing: '170ml bottle', price: 110, category: 'Gastrointestinal', active: true, stock: 80, expiryDate: '2027-03-31', minStock: 10 },
  { id: 'med15', name: 'Cetirizine', genericName: 'Cetirizine', form: 'Tablet', strength: '10mg', packing: '10 tablets', price: 40, category: 'Antihistamine', active: true, stock: 3, expiryDate: '2025-03-20', minStock: 10 },
  { id: 'med16', name: 'Loratadine', genericName: 'Loratadine', form: 'Tablet', strength: '10mg', packing: '10 tablets', price: 55, category: 'Antihistamine', active: true, stock: 60, expiryDate: '2026-12-31', minStock: 10 },
  { id: 'med17', name: 'Metformin', genericName: 'Metformin', form: 'Tablet', strength: '500mg', packing: '10 tablets', price: 45, category: 'Antidiabetic', active: true, stock: 60, expiryDate: '2026-12-31', minStock: 10 },
  { id: 'med18', name: 'Metformin', genericName: 'Metformin', form: 'Tablet', strength: '850mg', packing: '10 tablets', price: 65, category: 'Antidiabetic', active: true, stock: 60, expiryDate: '2026-12-31', minStock: 10 },
  { id: 'med19', name: 'Glimepiride', genericName: 'Glimepiride', form: 'Tablet', strength: '2mg', packing: '10 tablets', price: 80, category: 'Antidiabetic', active: true, stock: 60, expiryDate: '2026-12-31', minStock: 10 },
  { id: 'med20', name: 'Amlodipine', genericName: 'Amlodipine', form: 'Tablet', strength: '5mg', packing: '10 tablets', price: 55, category: 'Antihypertensive', active: true, stock: 60, expiryDate: '2026-12-31', minStock: 10 },
  { id: 'med21', name: 'Amlodipine', genericName: 'Amlodipine', form: 'Tablet', strength: '10mg', packing: '10 tablets', price: 85, category: 'Antihypertensive', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med22', name: 'Losartan', genericName: 'Losartan', form: 'Tablet', strength: '50mg', packing: '10 tablets', price: 90, category: 'Antihypertensive', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med23', name: 'Enalapril', genericName: 'Enalapril', form: 'Tablet', strength: '5mg', packing: '10 tablets', price: 65, category: 'Antihypertensive', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med24', name: 'Aspirin', genericName: 'Aspirin', form: 'Tablet', strength: '75mg', packing: '30 tablets', price: 35, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med25', name: 'Aspirin', genericName: 'Aspirin', form: 'Tablet', strength: '300mg', packing: '10 tablets', price: 25, category: 'Pain Relief', active: true, stock: 2, expiryDate: '2027-06-30', minStock: 15 },
  { id: 'med26', name: 'Clopidogrel', genericName: 'Clopidogrel', form: 'Tablet', strength: '75mg', packing: '10 tablets', price: 180, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med27', name: 'Atorvastatin', genericName: 'Atorvastatin', form: 'Tablet', strength: '10mg', packing: '10 tablets', price: 90, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med28', name: 'Atorvastatin', genericName: 'Atorvastatin', form: 'Tablet', strength: '20mg', packing: '10 tablets', price: 150, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med29', name: 'Atorvastatin', genericName: 'Atorvastatin', form: 'Tablet', strength: '40mg', packing: '10 tablets', price: 250, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med30', name: 'Salbutamol Inhaler', genericName: 'Albuterol', form: 'Inhaler', strength: '100mcg/dose', packing: '200 doses', price: 350, category: 'Respiratory', active: true, stock: 1, expiryDate: '2027-06-30', minStock: 10 },
  { id: 'med31', name: 'Montelukast', genericName: 'Montelukast', form: 'Tablet', strength: '10mg', packing: '10 tablets', price: 120, category: 'Respiratory', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med32', name: 'Diclofenac', genericName: 'Diclofenac Sodium', form: 'Tablet', strength: '50mg', packing: '10 tablets', price: 35, category: 'Pain Relief', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med33', name: 'Diclofenac Gel', genericName: 'Diclofenac Diethylamine', form: 'Cream', strength: '1%', packing: '30g tube', price: 120, category: 'Pain Relief', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med34', name: 'Naproxen', genericName: 'Naproxen', form: 'Tablet', strength: '250mg', packing: '10 tablets', price: 55, category: 'Pain Relief', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med35', name: 'Tramadol', genericName: 'Tramadol', form: 'Capsule', strength: '50mg', packing: '10 capsules', price: 80, category: 'Pain Relief', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med36', name: 'ORS', genericName: 'Oral Rehydration Salts', form: 'Powder', strength: '20.5g/sachet', packing: '1 sachet', price: 25, category: 'Electrolyte', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med37', name: 'Vitamin C', genericName: 'Ascorbic Acid', form: 'Tablet', strength: '500mg', packing: '10 tablets', price: 40, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med38', name: 'Multivitamin', genericName: 'Multivitamin', form: 'Tablet', strength: '', packing: '10 tablets', price: 85, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med39', name: 'Calcium + Vitamin D', genericName: 'Calcium Carbonate + Vit D3', form: 'Tablet', strength: '500mg+200IU', packing: '10 tablets', price: 95, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med40', name: 'Vitamin D3', genericName: 'Cholecalciferol', form: 'Capsule', strength: '60000 IU', packing: '4 capsules', price: 130, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med41', name: 'Iron Supplement', genericName: 'Ferrous Fumarate', form: 'Tablet', strength: '200mg', packing: '30 tablets', price: 95, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med42', name: 'Folic Acid', genericName: 'Folic Acid', form: 'Tablet', strength: '5mg', packing: '30 tablets', price: 35, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med43', name: 'Vitamin B12', genericName: 'Cyanocobalamin', form: 'Tablet', strength: '500mcg', packing: '10 tablets', price: 55, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med44', name: 'Vitamin B Complex', genericName: 'Vitamin B Complex', form: 'Tablet', strength: '', packing: '10 tablets', price: 50, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med45', name: 'Cephalexin', genericName: 'Cephalexin', form: 'Capsule', strength: '500mg', packing: '10 capsules', price: 110, category: 'Antibiotic', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med46', name: 'Doxycycline', genericName: 'Doxycycline', form: 'Capsule', strength: '100mg', packing: '10 capsules', price: 85, category: 'Antibiotic', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med47', name: 'Ceftriaxone', genericName: 'Ceftriaxone', form: 'Injection', strength: '1g', packing: '1 vial', price: 180, category: 'Antibiotic', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med48', name: 'Ceftriaxone', genericName: 'Ceftriaxone', form: 'Injection', strength: '2g', packing: '1 vial', price: 320, category: 'Antibiotic', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med49', name: 'Ampicillin', genericName: 'Ampicillin', form: 'Injection', strength: '500mg', packing: '1 vial', price: 65, category: 'Antibiotic', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med50', name: 'Gentamicin', genericName: 'Gentamicin', form: 'Injection', strength: '80mg/2ml', packing: '1 ampoule', price: 45, category: 'Antibiotic', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med51', name: 'Diclofenac', genericName: 'Diclofenac Sodium', form: 'Injection', strength: '75mg/3ml', packing: '1 ampoule', price: 55, category: 'Pain Relief', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med52', name: 'Metformin', genericName: 'Metformin', form: 'Tablet', strength: '1000mg', packing: '10 tablets', price: 90, category: 'Antidiabetic', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med53', name: 'Insulin Glargine', genericName: 'Insulin Glargine', form: 'Injection', strength: '100IU/ml', packing: '10ml vial', price: 2500, category: 'Antidiabetic', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med54', name: 'Insulin Mixtard', genericName: 'Biphasic Isophane', form: 'Injection', strength: '100IU/ml', packing: '10ml vial', price: 1800, category: 'Antidiabetic', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med55', name: 'Nifedipine', genericName: 'Nifedipine', form: 'Tablet', strength: '10mg', packing: '10 tablets', price: 45, category: 'Antihypertensive', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med56', name: 'Hydrochlorothiazide', genericName: 'HCTZ', form: 'Tablet', strength: '25mg', packing: '10 tablets', price: 30, category: 'Antihypertensive', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med57', name: 'Furosemide', genericName: 'Furosemide', form: 'Tablet', strength: '40mg', packing: '10 tablets', price: 35, category: 'Antihypertensive', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med58', name: 'Spironolactone', genericName: 'Spironolactone', form: 'Tablet', strength: '25mg', packing: '10 tablets', price: 50, category: 'Antihypertensive', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med59', name: 'Digoxin', genericName: 'Digoxin', form: 'Tablet', strength: '0.25mg', packing: '10 tablets', price: 70, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med60', name: 'Warfarin', genericName: 'Warfarin', form: 'Tablet', strength: '5mg', packing: '10 tablets', price: 120, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med61', name: 'Nitroglycerin', genericName: 'Glyceryl Trinitrate', form: 'Tablet', strength: '0.5mg', packing: '20 tablets', price: 150, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med62', name: 'Alprazolam', genericName: 'Alprazolam', form: 'Tablet', strength: '0.25mg', packing: '10 tablets', price: 40, category: 'Sedative', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med63', name: 'Diazepam', genericName: 'Diazepam', form: 'Tablet', strength: '5mg', packing: '10 tablets', price: 45, category: 'Sedative', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med64', name: 'Promethazine', genericName: 'Promethazine', form: 'Tablet', strength: '25mg', packing: '10 tablets', price: 35, category: 'Antihistamine', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med65', name: 'Chlorpheniramine', genericName: 'Chlorpheniramine', form: 'Tablet', strength: '4mg', packing: '10 tablets', price: 20, category: 'Antihistamine', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med66', name: 'Prednisolone', genericName: 'Prednisolone', form: 'Tablet', strength: '5mg', packing: '10 tablets', price: 40, category: 'Steroid', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med67', name: 'Dexamethasone', genericName: 'Dexamethasone', form: 'Tablet', strength: '4mg', packing: '10 tablets', price: 50, category: 'Steroid', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med68', name: 'Dexamethasone', genericName: 'Dexamethasone', form: 'Injection', strength: '4mg/ml', packing: '1 ampoule', price: 35, category: 'Steroid', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med69', name: 'Hydrocortisone', genericName: 'Hydrocortisone', form: 'Cream', strength: '1%', packing: '30g tube', price: 140, category: 'Steroid', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med70', name: 'Betamethasone Cream', genericName: 'Betamethasone', form: 'Cream', strength: '0.05%', packing: '20g tube', price: 100, category: 'Steroid', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med71', name: 'Clotrimazole Cream', genericName: 'Clotrimazole', form: 'Cream', strength: '1%', packing: '20g tube', price: 85, category: 'Antifungal', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med72', name: 'Fluconazole', genericName: 'Fluconazole', form: 'Tablet', strength: '150mg', packing: '1 tablet', price: 130, category: 'Antifungal', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med73', name: 'Acyclovir', genericName: 'Acyclovir', form: 'Tablet', strength: '400mg', packing: '10 tablets', price: 150, category: 'Antiviral', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med74', name: 'Albendazole', genericName: 'Albendazole', form: 'Tablet', strength: '400mg', packing: '1 tablet', price: 45, category: 'Antiparasitic', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med75', name: 'Metoprolol', genericName: 'Metoprolol', form: 'Tablet', strength: '50mg', packing: '10 tablets', price: 90, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med76', name: 'Carvedilol', genericName: 'Carvedilol', form: 'Tablet', strength: '6.25mg', packing: '10 tablets', price: 130, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med77', name: 'Ondansetron', genericName: 'Ondansetron', form: 'Tablet', strength: '4mg', packing: '10 tablets', price: 120, category: 'Gastrointestinal', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med78', name: 'Ondansetron', genericName: 'Ondansetron', form: 'Injection', strength: '4mg/2ml', packing: '1 ampoule', price: 80, category: 'Gastrointestinal', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med79', name: 'Loperamide', genericName: 'Loperamide', form: 'Capsule', strength: '2mg', packing: '10 capsules', price: 45, category: 'Gastrointestinal', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },
  { id: 'med80', name: 'Sucralfate', genericName: 'Sucralfate', form: 'Tablet', strength: '1g', packing: '10 tablets', price: 85, category: 'Gastrointestinal', active: true, stock: 50, expiryDate: '2027-01-15', minStock: 10 },

  { id: 'med81', name: 'Cefixime', genericName: 'Cefixime', form: 'Tablet', strength: '400mg', packing: '10 tablets', price: 120, category: 'Antibiotic', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 65 },
  { id: 'med82', name: 'Levofloxacin', genericName: 'Levofloxacin', form: 'Tablet', strength: '500mg', packing: '5 tablets', price: 180, category: 'Antibiotic', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 95 },
  { id: 'med83', name: 'Cefuroxime', genericName: 'Cefuroxime', form: 'Tablet', strength: '250mg', packing: '10 tablets', price: 130, category: 'Antibiotic', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 75 },
  { id: 'med84', name: 'Telmisartan', genericName: 'Telmisartan', form: 'Tablet', strength: '40mg', packing: '10 tablets', price: 95, category: 'Antihypertensive', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 50 },
  { id: 'med85', name: 'Valsartan', genericName: 'Valsartan', form: 'Tablet', strength: '80mg', packing: '10 tablets', price: 85, category: 'Antihypertensive', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 45 },
  { id: 'med86', name: 'Lansoprazole', genericName: 'Lansoprazole', form: 'Capsule', strength: '30mg', packing: '10 capsules', price: 85, category: 'Gastrointestinal', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 42 },
  { id: 'med87', name: 'Esomeprazole', genericName: 'Esomeprazole', form: 'Tablet', strength: '20mg', packing: '10 tablets', price: 90, category: 'Gastrointestinal', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 48 },
  { id: 'med88', name: 'Famotidine', genericName: 'Famotidine', form: 'Tablet', strength: '20mg', packing: '10 tablets', price: 60, category: 'Gastrointestinal', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 28 },
  { id: 'med89', name: 'Mefenamic Acid', genericName: 'Mefenamic Acid', form: 'Capsule', strength: '250mg', packing: '10 capsules', price: 45, category: 'Pain Relief', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 20 },
  { id: 'med90', name: 'Etoricoxib', genericName: 'Etoricoxib', form: 'Tablet', strength: '60mg', packing: '5 tablets', price: 150, category: 'Pain Relief', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 85 },
  { id: 'med91', name: 'Budesonide', genericName: 'Budesonide', form: 'Inhaler', strength: '200mcg/dose', packing: '200 doses', price: 450, category: 'Respiratory', active: true, stock: 30, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 250 },
  { id: 'med92', name: 'Fluticasone', genericName: 'Fluticasone', form: 'Cream', strength: '0.05%', packing: '30g tube', price: 250, category: 'Respiratory', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 120 },
  { id: 'med93', name: 'Zinc Supplement', genericName: 'Zinc Sulphate', form: 'Tablet', strength: '50mg', packing: '30 tablets', price: 85, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 40 },
  { id: 'med94', name: 'Biotin', genericName: 'Biotin', form: 'Tablet', strength: '5000mcg', packing: '30 tablets', price: 120, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 65 },
  { id: 'med95', name: 'Omega-3', genericName: 'Fish Oil', form: 'Capsule', strength: '1000mg', packing: '30 capsules', price: 250, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 130 },
  { id: 'med96', name: 'Sitagliptin', genericName: 'Sitagliptin', form: 'Tablet', strength: '100mg', packing: '10 tablets', price: 280, category: 'Antidiabetic', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 180 },
  { id: 'med97', name: 'Vildagliptin', genericName: 'Vildagliptin', form: 'Tablet', strength: '50mg', packing: '10 tablets', price: 220, category: 'Antidiabetic', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 140 },
  { id: 'med98', name: 'Glipizide', genericName: 'Glipizide', form: 'Tablet', strength: '5mg', packing: '10 tablets', price: 65, category: 'Antidiabetic', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 32 },
  { id: 'med99', name: 'Isosorbide', genericName: 'Isosorbide Dinitrate', form: 'Tablet', strength: '5mg', packing: '30 tablets', price: 60, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 25 },
  { id: 'med100', name: 'Verapamil', genericName: 'Verapamil', form: 'Tablet', strength: '80mg', packing: '10 tablets', price: 60, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 28 },
  { id: 'med101', name: 'Ketoconazole', genericName: 'Ketoconazole', form: 'Cream', strength: '2%', packing: '30g tube', price: 120, category: 'Antifungal', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 60 },
  { id: 'med102', name: 'Terbinafine', genericName: 'Terbinafine', form: 'Cream', strength: '1%', packing: '15g tube', price: 150, category: 'Antifungal', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 80 },
  { id: 'med103', name: 'Terbinafine', genericName: 'Terbinafine', form: 'Tablet', strength: '250mg', packing: '10 tablets', price: 180, category: 'Antifungal', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 95 },
  { id: 'med104', name: 'Metoclopramide', genericName: 'Metoclopramide', form: 'Tablet', strength: '10mg', packing: '10 tablets', price: 30, category: 'Gastrointestinal', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 15 },
  { id: 'med105', name: 'Fexofenadine', genericName: 'Fexofenadine', form: 'Tablet', strength: '120mg', packing: '10 tablets', price: 65, category: 'Antihistamine', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 32 },
  { id: 'med106', name: 'Bilastine', genericName: 'Bilastine', form: 'Tablet', strength: '20mg', packing: '10 tablets', price: 70, category: 'Antihistamine', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 35 },
  { id: 'med107', name: 'Propranolol', genericName: 'Propranolol', form: 'Tablet', strength: '40mg', packing: '10 tablets', price: 35, category: 'Cardiac', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 18 },
  { id: 'med108', name: 'Amlodipine 2.5mg', genericName: 'Amlodipine', form: 'Tablet', strength: '2.5mg', packing: '10 tablets', price: 40, category: 'Antihypertensive', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 20 },
  { id: 'med109', name: 'Cetirizine Syrup', genericName: 'Cetirizine', form: 'Syrup', strength: '5mg/5ml', packing: '60ml bottle', price: 70, category: 'Antihistamine', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 25 },
  { id: 'med110', name: 'Multivitamin Syrup', genericName: 'Multivitamin', form: 'Syrup', strength: '', packing: '120ml bottle', price: 120, category: 'Vitamin', active: true, stock: 50, expiryDate: '2027-06-30', minStock: 10, purchasePrice: 55 },

];

export function getMedicines(): MedicineItem[] { return get(KEYS.medicines, defaultMedicines); }
export function setMedicines(m: MedicineItem[]): void { set(KEYS.medicines, m); }
export function addMedicine(m: MedicineItem): void { const all = getMedicines(); all.push(m); setMedicines(all); }
export function updateMedicine(id: string, data: Partial<MedicineItem>): void { setMedicines(getMedicines().map(m => m.id === id ? { ...m, ...data } : m)); }
export function deleteMedicine(id: string): void { setMedicines(getMedicines().filter(m => m.id !== id)); }
export function searchMedicines(q: string): MedicineItem[] {
  const lq = q.toLowerCase();
  return getMedicines().filter(m => m.active && (m.name.toLowerCase().includes(lq) || m.genericName.toLowerCase().includes(lq) || m.category.toLowerCase().includes(lq)));
}
export function getMedicineCategories(): string[] { return [...new Set(getMedicines().filter(m => m.active).map(m => m.category))]; }
export function getExpiredMedicines(): MedicineItem[] {
  const today = todayStr();
  return getMedicines().filter(m => m.active && m.expiryDate && m.expiryDate < today);
}
export function getLowStockMedicines(): MedicineItem[] {
  return getMedicines().filter(m => m.active && m.stock <= (m.minStock || 10));
}
export function getOutOfStockMedicines(): MedicineItem[] {
  return getMedicines().filter(m => m.active && m.stock <= 0);
}

/* ========== LAB TEST CATALOG ========== */
const defaultLabTests: LabTestCatalog[] = [
  { id: 'lt1', testName: 'CBC (Complete Blood Count)', category: 'Hematology', price: 800, turnaroundTime: '2 hours', active: true },
  { id: 'lt2', testName: 'Blood Group & Rh Factor', category: 'Hematology', price: 500, turnaroundTime: '1 hour', active: true },
  { id: 'lt3', testName: 'Hemoglobin (Hb)', category: 'Hematology', price: 400, turnaroundTime: '1 hour', active: true },
  { id: 'lt4', testName: 'ESR', category: 'Hematology', price: 300, turnaroundTime: '1 hour', active: true },
  { id: 'lt5', testName: 'Blood Sugar Fasting', category: 'Biochemistry', price: 400, turnaroundTime: '2 hours', active: true },
  { id: 'lt6', testName: 'Blood Sugar Random', category: 'Biochemistry', price: 400, turnaroundTime: '2 hours', active: true },
  { id: 'lt7', testName: 'HbA1c', category: 'Biochemistry', price: 1200, turnaroundTime: '4 hours', active: true },
  { id: 'lt8', testName: 'Liver Function Test (LFT)', category: 'Biochemistry', price: 1500, turnaroundTime: '4 hours', active: true },
  { id: 'lt9', testName: 'Kidney Function Test (KFT)', category: 'Biochemistry', price: 1200, turnaroundTime: '4 hours', active: true },
  { id: 'lt10', testName: 'Lipid Profile', category: 'Biochemistry', price: 1200, turnaroundTime: '4 hours', active: true },
  { id: 'lt11', testName: 'Uric Acid', category: 'Biochemistry', price: 500, turnaroundTime: '2 hours', active: true },
  { id: 'lt12', testName: 'CRP', category: 'Biochemistry', price: 600, turnaroundTime: '2 hours', active: true },
  { id: 'lt13', testName: 'Thyroid Panel (T3, T4, TSH)', category: 'Biochemistry', price: 1800, turnaroundTime: '6 hours', active: true },
  { id: 'lt14', testName: 'Electrolytes (Na, K, Cl)', category: 'Biochemistry', price: 800, turnaroundTime: '2 hours', active: true },
  { id: 'lt15', testName: 'Calcium', category: 'Biochemistry', price: 500, turnaroundTime: '2 hours', active: true },
  { id: 'lt16', testName: 'Vitamin D', category: 'Biochemistry', price: 1500, turnaroundTime: '24 hours', active: true },
  { id: 'lt17', testName: 'Iron Studies', category: 'Biochemistry', price: 1000, turnaroundTime: '4 hours', active: true },
  { id: 'lt18', testName: 'PT/INR', category: 'Hematology', price: 700, turnaroundTime: '2 hours', active: true },
  { id: 'lt19', testName: 'D-Dimer', category: 'Hematology', price: 1500, turnaroundTime: '4 hours', active: true },
  { id: 'lt20', testName: 'HIV', category: 'Serology', price: 800, turnaroundTime: '24 hours', active: true },
  { id: 'lt21', testName: 'Hepatitis B', category: 'Serology', price: 800, turnaroundTime: '24 hours', active: true },
  { id: 'lt22', testName: 'Hepatitis C', category: 'Serology', price: 800, turnaroundTime: '24 hours', active: true },
  { id: 'lt23', testName: 'Dengue NS1', category: 'Serology', price: 1200, turnaroundTime: '24 hours', active: true },
  { id: 'lt24', testName: 'Dengue IgM/IgG', category: 'Serology', price: 1500, turnaroundTime: '24 hours', active: true },
  { id: 'lt25', testName: 'Urine Routine Examination', category: 'Urinalysis', price: 300, turnaroundTime: '2 hours', active: true },
  { id: 'lt26', testName: 'Urine Culture', category: 'Urinalysis', price: 800, turnaroundTime: '48 hours', active: true },
  { id: 'lt27', testName: 'Blood Culture', category: 'Microbiology', price: 1000, turnaroundTime: '72 hours', active: true },
  { id: 'lt28', testName: 'Troponin T', category: 'Cardiac Markers', price: 1800, turnaroundTime: '2 hours', active: true },
  { id: 'lt29', testName: 'CK-MB', category: 'Cardiac Markers', price: 1000, turnaroundTime: '2 hours', active: true },
  { id: 'lt30', testName: 'Procalcitonin', category: 'Biochemistry', price: 2000, turnaroundTime: '4 hours', active: true },
];

export function getLabTestCatalog(): LabTestCatalog[] { return get(KEYS.labTestCatalog, defaultLabTests); }
export function setLabTestCatalog(t: LabTestCatalog[]): void { set(KEYS.labTestCatalog, t); }
export function addLabTest(t: LabTestCatalog): void { const all = getLabTestCatalog(); all.push(t); setLabTestCatalog(all); }
export function updateLabTest(id: string, data: Partial<LabTestCatalog>): void { setLabTestCatalog(getLabTestCatalog().map(t => t.id === id ? { ...t, ...data } : t)); }
export function deleteLabTest(id: string): void { setLabTestCatalog(getLabTestCatalog().filter(t => t.id !== id)); }
export function searchLabTests(q: string): LabTestCatalog[] {
  const lq = q.toLowerCase();
  return getLabTestCatalog().filter(t => t.active && (t.testName.toLowerCase().includes(lq) || t.category.toLowerCase().includes(lq)));
}
export function getLabTestCategories(): string[] { return [...new Set(getLabTestCatalog().filter(t => t.active).map(t => t.category))]; }

/* ========== ROOM TYPES ========== */
const defaultRoomTypes: RoomType[] = [
  { id: 'rt1', name: 'General Ward', chargesPerNight: 1500, active: true },
  { id: 'rt2', name: 'Semi-Private Room', chargesPerNight: 3000, active: true },
  { id: 'rt3', name: 'Private Room', chargesPerNight: 5000, active: true },
  { id: 'rt4', name: 'VIP Room', chargesPerNight: 10000, active: true },
  { id: 'rt5', name: 'ICU', chargesPerNight: 15000, active: true },
  { id: 'rt6', name: 'CCU', chargesPerNight: 15000, active: true },
  { id: 'rt7', name: 'Operation Theater', chargesPerNight: 20000, active: true },
  { id: 'rt8', name: 'Emergency Ward', chargesPerNight: 2000, active: true },
];

export function getRoomTypes(): RoomType[] { return get(KEYS.roomTypes, defaultRoomTypes); }
export function setRoomTypes(r: RoomType[]): void { set(KEYS.roomTypes, r); }
export function addRoomType(r: RoomType): void { const all = getRoomTypes(); all.push(r); setRoomTypes(all); }
export function updateRoomType(id: string, data: Partial<RoomType>): void { setRoomTypes(getRoomTypes().map(r => r.id === id ? { ...r, ...data } : r)); }
export function deleteRoomType(id: string): void { setRoomTypes(getRoomTypes().filter(r => r.id !== id)); }
export function getRoomTypeById(id: string): RoomType | undefined { return getRoomTypes().find(r => r.id === id); }
export function getActiveRoomTypes(): RoomType[] { return getRoomTypes().filter(r => r.active); }

/* ========== EMPLOYEES (HR) ========== */
const defaultEmployees: Employee[] = [
  { id: 'e1', employeeCode: '0001', name: 'Dr. Ahmed Hassan', fatherName: 'Hassan Ali', cnic: '35201-1234567-1', mobile: '03001234567', gender: 'Male', age: '42', address: 'Street 5, Lahore', designation: 'Medical Officer', department: 'Emergency', salary: 150000, joinDate: '2024-01-15', status: 'Active', education: [{ degree: 'MBBS', institution: 'King Edward Medical University', year: '2008', grade: 'Distinction' }], experience: [{ organization: 'Mayo Hospital', position: 'Medical Officer', startDate: '2010-01-01', endDate: '2023-12-31', duration: '14 years' }], documents: [{ id: 'd1', name: 'CNIC Copy', type: 'CNIC', fileName: 'cnic_e1.jpg', uploadDate: '2024-01-10' }, { id: 'd2', name: 'PMDC Certificate', type: 'Certificate', fileName: 'pmdc_e1.pdf', uploadDate: '2024-01-10' }], equipment: [], bankAccount: 'IBAN-1234567890', emergencyContact: '03009876543' },
  { id: 'e2', employeeCode: '0002', name: 'Dr. Sara Khan', fatherName: 'Khan Muhammad', cnic: '35201-7654321-1', mobile: '03119876543', gender: 'Female', age: '38', address: 'Block C, Karachi', designation: 'Gynecologist', department: 'Gynecology', salary: 200000, joinDate: '2024-02-01', status: 'Active', education: [{ degree: 'MBBS', institution: 'Dow Medical College', year: '2010', grade: 'First Class' }, { degree: 'FCPS', institution: 'CPSP', year: '2016', grade: 'Passed' }], experience: [{ organization: 'Jinnah Hospital', position: 'Resident', startDate: '2012-01-01', endDate: '2020-12-31', duration: '9 years' }], documents: [{ id: 'd3', name: 'CNIC Copy', type: 'CNIC', fileName: 'cnic_e2.jpg', uploadDate: '2024-01-28' }, { id: 'd4', name: 'PMDC Certificate', type: 'Certificate', fileName: 'pmdc_e2.pdf', uploadDate: '2024-01-28' }], equipment: [], bankAccount: 'IBAN-0987654321', emergencyContact: '03118765432' },
  { id: 'e3', employeeCode: '0003', name: 'Nurse Fatima', fatherName: 'Muhammad Akram', cnic: '35201-9876543-1', mobile: '03234567890', gender: 'Female', age: '30', address: 'Mohalla Shah, Multan', designation: 'Staff Nurse', department: 'General Ward', salary: 60000, joinDate: '2024-03-10', status: 'Active', education: [{ degree: 'BS Nursing', institution: 'Nursing College Lahore', year: '2017', grade: 'First Class' }], experience: [{ organization: 'Services Hospital', position: 'Staff Nurse', startDate: '2018-06-01', endDate: '2024-02-28', duration: '6 years' }], documents: [{ id: 'd5', name: 'CNIC Copy', type: 'CNIC', fileName: 'cnic_e3.jpg', uploadDate: '2024-03-05' }, { id: 'd6', name: 'Nursing License', type: 'Certificate', fileName: 'license_e3.pdf', uploadDate: '2024-03-05' }], equipment: [], bankAccount: 'IBAN-5678901234', emergencyContact: '03234567891' },
];

export function getEmployees(): Employee[] { return get(KEYS.employees, defaultEmployees); }
export function setEmployees(e: Employee[]): void { set(KEYS.employees, e); }
export function addEmployee(e: Employee): void { const all = getEmployees(); all.push(e); setEmployees(all); }
export function updateEmployee(id: string, data: Partial<Employee>): void { setEmployees(getEmployees().map(e => e.id === id ? { ...e, ...data } : e)); }
export function deleteEmployee(id: string): void { setEmployees(getEmployees().filter(e => e.id !== id)); }
export function searchEmployees(q: string): Employee[] {
  const lq = q.toLowerCase();
  return getEmployees().filter(e =>
    (e as Employee).employeeCode?.toLowerCase().includes(lq) ||
    e.name.toLowerCase().includes(lq) ||
    e.department.toLowerCase().includes(lq) ||
    e.designation.toLowerCase().includes(lq) ||
    e.cnic.includes(q)
  );
}

export function getEmployeeCounter(): number {
  if (isElectron()) {
    const val = dbGetCounter('employee_counter');
    if (val !== null) return val;
  }
  return get(KEYS.employeeCounter, 3);
}
export function setEmployeeCounter(n: number): void {
  if (isElectron()) {
    dbSetCounter('employee_counter', n);
    return;
  }
  set(KEYS.employeeCounter, n);
}

export function generateEmployeeCode(): string {
  const counter = getEmployeeCounter();
  const code = String(counter + 1).padStart(4, '0');
  setEmployeeCounter(counter + 1);
  return code;
}

/* ========== ATTENDANCE (HR) ========== */
export function getAttendanceRecords(): AttendanceRecord[] { return get(KEYS.attendance, []); }
export function setAttendanceRecords(a: AttendanceRecord[]): void { set(KEYS.attendance, a); }
export function addAttendanceRecord(a: AttendanceRecord): void { const all = getAttendanceRecords(); all.push(a); setAttendanceRecords(all); }
export function updateAttendanceRecord(id: string, data: Partial<AttendanceRecord>): void {
  setAttendanceRecords(getAttendanceRecords().map(a => a.id === id ? { ...a, ...data } : a));
}
export function deleteAttendanceRecord(id: string): void { setAttendanceRecords(getAttendanceRecords().filter(a => a.id !== id)); }
export function getAttendanceByEmployee(employeeId: string): AttendanceRecord[] { return getAttendanceRecords().filter(a => a.employeeId === employeeId); }
export function getAttendanceByDate(date: string): AttendanceRecord[] { return getAttendanceRecords().filter(a => a.date === date); }

/* ========== SALARIES (HR) ========== */
export function getSalaryRecords(): SalaryRecord[] { return get(KEYS.salaries, []); }
export function setSalaryRecords(s: SalaryRecord[]): void { set(KEYS.salaries, s); }
export function addSalaryRecord(s: SalaryRecord): void { const all = getSalaryRecords(); all.push(s); setSalaryRecords(all); }
export function updateSalaryRecord(id: string, data: Partial<SalaryRecord>): void {
  setSalaryRecords(getSalaryRecords().map(s => s.id === id ? { ...s, ...data } : s));
}
export function deleteSalaryRecord(id: string): void { setSalaryRecords(getSalaryRecords().filter(s => s.id !== id)); }
export function getSalaryByEmployee(employeeId: string): SalaryRecord[] { return getSalaryRecords().filter(s => s.employeeId === employeeId); }
export function getSalaryByMonth(month: string): SalaryRecord[] { return getSalaryRecords().filter(s => s.month === month); }

/* ========== UTILITY ========== */
export function todayStr(): string { return new Date().toISOString().split('T')[0]; }
export function timeStr(): string { return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
export function genId(): string { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

// ==================== PHARMACY EXPENSES ====================
export interface PharmacyExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  notes: string;
  supplier: string;
}

const PHARMACY_EXPENSES_KEY = 'baga_pharmacy_expenses';

export function getPharmacyExpenses(): PharmacyExpense[] {
  if (typeof window === 'undefined') return [];
  try { const d = localStorage.getItem(PHARMACY_EXPENSES_KEY); return d ? JSON.parse(d) : []; } catch { return []; }
}

export function addPharmacyExpense(expense: PharmacyExpense): void {
  if (typeof window === 'undefined') return;
  const all = getPharmacyExpenses();
  all.push(expense);
  localStorage.setItem(PHARMACY_EXPENSES_KEY, JSON.stringify(all));
}

export function updatePharmacyExpense(id: string, data: Partial<PharmacyExpense>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PHARMACY_EXPENSES_KEY, JSON.stringify(getPharmacyExpenses().map(e => e.id === id ? { ...e, ...data } : e)));
}

export function deletePharmacyExpense(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PHARMACY_EXPENSES_KEY, JSON.stringify(getPharmacyExpenses().filter(e => e.id !== id)));
}

/* ========== PHARMACY SALES (SQLite-backed for LAN sync + unique serial) ========== */
// Sales are stored in the `pharmacy_sales` SQLite table (and localStorage as fallback).
// This ensures that sales are:
//   1. Synced across all LAN browsers (each browser sees all sales from the host)
//   2. The bill serial counter is shared (so each sale gets a UNIQUE serial across machines)

export interface PharmacySaleRecord {
  id: string;
  patientNo: string;
  patientName: string;
  patientMobile: string;
  type: 'Indoor' | 'Outdoor';
  items: any[];
  totalAmount: number;
  date: string;
  time: string;
  servedBy: string;
  paymentMethod: 'Cash' | 'Card' | 'Online';
  dailyToken: string;
  billSerial: string;
  returnCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  discountType?: 'patient' | 'prescriber';
}

const PHARMACY_SALES_LS_KEY = 'baga_pharmacy_sales';

/**
 * Read pharmacy sales from SQLite (preferred) or localStorage (fallback).
 * Returns an empty array if neither is available.
 */
export function getPharmacySalesDB(): PharmacySaleRecord[] {
  if (typeof window === 'undefined') return [];
  // Try SQLite via db-bridge (works for both Electron host and LAN browsers)
  try {
    if (isElectron() || isLanMode()) {
      const data = dbGetAll('pharmacy_sales');
      if (Array.isArray(data)) return data as PharmacySaleRecord[];
    }
  } catch {}
  // Fallback to localStorage (preserves backward compat with existing data)
  try {
    const d = localStorage.getItem(PHARMACY_SALES_LS_KEY);
    return d ? JSON.parse(d) as PharmacySaleRecord[] : [];
  } catch { return []; }
}

/**
 * Persist the full pharmacy sales array back to SQLite (and localStorage mirror).
 * Use this after adding/updating a sale.
 */
export function setPharmacySalesDB(sales: PharmacySaleRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (isElectron() || isLanMode()) {
      dbSetAll('pharmacy_sales', sales);
    }
  } catch (e) { console.error('setPharmacySalesDB SQLite failed:', e); }
  // Always mirror to localStorage as a safety net
  try { localStorage.setItem(PHARMACY_SALES_LS_KEY, JSON.stringify(sales)); } catch {}
}

export function addPharmacySaleDB(sale: PharmacySaleRecord): void {
  const all = getPharmacySalesDB();
  all.push(sale);
  setPharmacySalesDB(all);
}

export function updatePharmacySaleDB(id: string, data: Partial<PharmacySaleRecord>): void {
  const all = getPharmacySalesDB().map(s => s.id === id ? { ...s, ...data } : s);
  setPharmacySalesDB(all);
}

/* ========== PHARMACY RETURNS (SQLite-backed for LAN sync) ========== */
export interface PharmacyReturnRecord {
  id: string;
  slipId: string;
  slipBillSerial?: string;
  patientNo: string;
  patientName: string;
  items: Array<{ medicineId: string; name: string; quantity: number; price: number }>;
  totalRefund: number;
  returnedBy: string;
  date: string;
  time: string;
}

const PHARMACY_RETURNS_LS_KEY = 'baga_pharmacy_returns';

export function getPharmacyReturnsDB(): PharmacyReturnRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const d = localStorage.getItem(PHARMACY_RETURNS_LS_KEY);
    return d ? JSON.parse(d) as PharmacyReturnRecord[] : [];
  } catch { return []; }
}

export function setPharmacyReturnsDB(returns: PharmacyReturnRecord[]): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PHARMACY_RETURNS_LS_KEY, JSON.stringify(returns)); } catch {}
}

export function addPharmacyReturnDB(r: PharmacyReturnRecord): void {
  const all = getPharmacyReturnsDB();
  all.push(r);
  setPharmacyReturnsDB(all);
}

/* ========== PHARMACY SALE SERIAL COUNTER (SQLite-backed, unique across LAN) ========== */
/**
 * Generates a unique 6-digit annual serial number for each pharmacy sale.
 * The counter is stored in SQLite's `counters` table so it's shared across
 * all machines on the LAN — every sale (whether on the host or a LAN browser)
 * gets the next sequential number, preventing fraud.
 *
 * Format: 000001, 000002, ... resets to 000001 at the start of each year.
 */
export function nextPharmacyBillSerial(): string {
  if (typeof window === 'undefined') return '000001';
  const year = new Date().getFullYear();
  const counterKey = `pharmacy_sale_serial_${year}`;
  let nextVal = 1;

  // Try SQLite counter (works for both Electron host and LAN browsers)
  if (isElectron() || isLanMode()) {
    try {
      const current = dbGetCounter(counterKey);
      nextVal = (typeof current === 'number' ? current : 0) + 1;
      dbSetCounter(counterKey, nextVal);
      return String(nextVal).padStart(6, '0');
    } catch (e) {
      console.error('nextPharmacyBillSerial SQLite failed, falling back to localStorage:', e);
    }
  }

  // Fallback: localStorage (single-machine only, may collide on LAN)
  const lsKey = `baga_pharmacy_annual_sale_counter_${year}`;
  try {
    const cur = parseInt(localStorage.getItem(lsKey) || '0', 10);
    nextVal = cur + 1;
    localStorage.setItem(lsKey, String(nextVal));
  } catch {}
  return String(nextVal).padStart(6, '0');
}

/**
 * Formats a 6-digit bill serial as a full annual token with year prefix.
 * Example: '000001' → '2026-000001'
 * This is what appears on the printed slip so the customer and pharmacist
 * can identify the sale for medicine returns.
 */
export function formatAnnualToken(billSerial: string): string {
  const year = new Date().getFullYear();
  return `${year}-${billSerial}`;
}

/**
 * Generates a random alphanumeric Return Code for each pharmacy sale.
 * Format: 7 characters, mixed case letters + digits (no ambiguous chars).
 * Example: '3fgT4et', 'K7mP2xq', '9aB3rYn'
 *
 * This code is:
 * - Printed prominently on the receipt (separate from the barcode area)
 * - Unique per sale (practically impossible to guess)
 * - Used by the medicine returns page to find the sale
 * - Different every time, preventing fraud/duplicate returns
 *
 * The character set excludes: 0, O, I, 1, l (ambiguous characters).
 */
const RETURN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
export function generateReturnCode(length: number = 7): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += RETURN_CODE_CHARS.charAt(Math.floor(Math.random() * RETURN_CODE_CHARS.length));
  }
  return code;
}

/**
 * Generates a unique Return Code, checking against existing sales to avoid collisions.
 */
export function generateUniqueReturnCode(): string {
  let code = generateReturnCode();
  try {
    const sales = getPharmacySalesDB();
    const existingCodes = new Set(sales.map(s => (s as any).returnCode).filter(Boolean));
    let attempts = 0;
    while (existingCodes.has(code) && attempts < 10) {
      code = generateReturnCode();
      attempts++;
    }
  } catch {}
  return code;
}

/* ========== PHARMACY DAILY TOKEN (SQLite-backed, resets daily) ========== */
/**
 * Generates a 4-digit daily token that resets at midnight.
 * Stored in SQLite so the token sequence is shared across all LAN machines.
 */
export function nextPharmacyDailyToken(): string {
  if (typeof window === 'undefined') return '0001';
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const counterKey = `pharmacy_daily_token_${today}`;
  let nextVal = 1;

  if (isElectron() || isLanMode()) {
    try {
      const current = dbGetCounter(counterKey);
      nextVal = (typeof current === 'number' ? current : 0) + 1;
      dbSetCounter(counterKey, nextVal);
      return String(nextVal).padStart(4, '0');
    } catch (e) {
      console.error('nextPharmacyDailyToken SQLite failed, falling back to localStorage:', e);
    }
  }

  // Fallback: localStorage
  const lsKey = 'baga_pharmacy_daily_token';
  try {
    const stored = JSON.parse(localStorage.getItem(lsKey) || '{"date":"","token":0}');
    nextVal = (stored.date === today ? stored.token : 0) + 1;
    localStorage.setItem(lsKey, JSON.stringify({ date: today, token: nextVal }));
  } catch {}
  return String(nextVal).padStart(4, '0');
}
