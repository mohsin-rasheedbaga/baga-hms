import { HMSData, Patient, Visit, PharmacyBill } from './types';

const STORAGE_KEY = 'baga_hms_data';
const DATA_VERSION_KEY = 'baga_hms_data_version';
const DATA_VERSION = '2.6.2'; // Bump this when demo data structure changes

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getDefaultSettings() {
  return {
    hospitalName: 'BAGA Hospital',
    hospitalAddress: 'Main Boulevard, Lahore',
    hospitalPhone: '0300-1234567',
    pharmacyPaymentLocation: 'pharmacy' as const,
    labPaymentLocation: 'lab' as const,
    xrayPaymentLocation: 'xray' as const,
    ultrasoundPaymentLocation: 'ultrasound' as const,
    surgeryPaymentLocation: 'reception' as const,
  };
}

function getDemoPatients(): Patient[] {
  const patients = [
    { name: 'Muhammad Ahmad', relationType: 'father' as const, relationName: 'Abdullah', mobile: '03001234567', age: '35', address: 'Gulberg, Lahore', gender: 'male' as const },
    { name: 'Fatima Bibi', relationType: 'husband' as const, relationName: 'Muhammad Umar', mobile: '03012345678', age: '28', address: 'Johar Town, Lahore', gender: 'female' as const },
    { name: 'Ali Hassan', relationType: 'father' as const, relationName: 'Hassan Ali', mobile: '03023456789', age: '45', address: 'Defence Road, Lahore', gender: 'male' as const },
    { name: 'Aina Bibi', relationType: 'father' as const, relationName: 'Ghulam Mohiuddin', mobile: '03034567890', age: '22', address: 'Minto Park, Lahore', gender: 'female' as const },
    { name: 'Bilal Ahmad', relationType: 'father' as const, relationName: 'Ahmad Khan', mobile: '03045678901', age: '50', address: 'Anarkali, Lahore', gender: 'male' as const },
    { name: 'Maryam Khatun', relationType: 'husband' as const, relationName: 'Khalid Mahmood', mobile: '03056789012', age: '32', address: 'Garden Town, Lahore', gender: 'female' as const },
    { name: 'Aslam', relationType: 'father' as const, relationName: 'Muhammad Aslam', mobile: '03067890123', age: '60', address: 'Samanabad, Lahore', gender: 'male' as const },
    { name: 'Zainab Bibi', relationType: 'husband' as const, relationName: 'Rafat Ali', mobile: '03078901234', age: '40', address: 'Dharampura, Lahore', gender: 'female' as const },
    { name: 'Hussain Ali', relationType: 'father' as const, relationName: 'Ali Muhammad', mobile: '03089012345', age: '18', address: 'Shad Bagh, Lahore', gender: 'male' as const },
    { name: 'Nargis Bibi', relationType: 'husband' as const, relationName: 'Sadiq Hussain', mobile: '03090123456', age: '55', address: 'Badami Bagh, Lahore', gender: 'female' as const },
    { name: 'Raza Ali', relationType: 'father' as const, relationName: 'Imran Ali', mobile: '03101234567', age: '8', address: 'H-Block, Lahore', gender: 'male' as const },
    { name: 'Sabiha Bibi', relationType: 'father' as const, relationName: 'Ishaq', mobile: '03112345678', age: '26', address: 'WAPDA Town, Lahore', gender: 'female' as const },
    { name: 'Tanveer Ahmad', relationType: 'father' as const, relationName: 'Ahmad Dindar', mobile: '03123456789', age: '70', address: 'Quetta Road, Lahore', gender: 'male' as const },
    { name: 'Shazia Bibi', relationType: 'husband' as const, relationName: 'Nasim Akhtar', mobile: '03134567890', age: '33', address: 'Faisal Town, Lahore', gender: 'female' as const },
    { name: 'Umar Farooq', relationType: 'father' as const, relationName: 'Farooq Ahmad', mobile: '03145678901', age: '42', address: 'Malikpura, Lahore', gender: 'male' as const },
  ];

  return patients.map((p, i) => ({
    ...p,
    id: generateId() + i,
    patientNumber: `PAT-${String(i + 1).padStart(4, '0')}`,
    cardStatus: 'active' as const,
    createdAt: new Date(Date.now() - (15 - i) * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

function getDemoVisits(patients: Patient[]): Visit[] {
  const doctors = ['Dr. Muhammad Ashraf', 'Dr. Sajid Raza', 'Dr. Nabeel Ahmad'];
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const visits: Visit[] = [
    {
      id: generateId() + 'v1',
      visitNumber: 'V-0001',
      patientId: patients[0].id,
      patientNumber: patients[0].patientNumber,
      date: today,
      time: '09:00',
      doctorName: doctors[0],
      status: 'seen',
      diagnosis: 'Flu and Fever',
      prescription: [
        { medicine: 'Panadol', dosage: '500mg', frequency: '3 times a day', duration: '3 days' },
        { medicine: 'Sepredine-C', dosage: '1 tablet', frequency: 'twice a day', duration: '5 days' },
        { medicine: 'Amoxil', dosage: '250mg', frequency: '3 times a day', duration: '5 days' },
      ],
      labTests: [
        { id: generateId() + 'l1', testName: 'CBC', price: 500, status: 'completed', result: 'WBC: 11000, RBC: 4.5M, Hb: 12.5g/dL, Platelets: 250K', paidAt: new Date().toISOString(), completedAt: new Date().toISOString(), paymentLocation: 'lab' },
      ],
      xrayOrders: [],
      ultrasoundOrders: [],
      surgeryOrder: null,
      notes: '',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId() + 'v2',
      visitNumber: 'V-0002',
      patientId: patients[1].id,
      patientNumber: patients[1].patientNumber,
      date: today,
      time: '09:30',
      doctorName: doctors[1],
      status: 'seen',
      diagnosis: 'Stomach Pain',
      prescription: [
        { medicine: 'Flagyl', dosage: '400mg', frequency: '3 times a day', duration: '7 days' },
        { medicine: 'Esomeprazole', dosage: '20mg', frequency: 'morning empty stomach', duration: '14 days' },
      ],
      labTests: [
        { id: generateId() + 'l2', testName: 'Liver Function Test', price: 1200, status: 'paid', result: '', paidAt: new Date().toISOString(), completedAt: null, paymentLocation: 'lab' },
      ],
      xrayOrders: [],
      ultrasoundOrders: [
        { id: generateId() + 'u1', testName: 'Ultrasound Abdomen', price: 2000, status: 'paid', result: '', paidAt: new Date().toISOString(), completedAt: null, paymentLocation: 'ultrasound' },
      ],
      surgeryOrder: null,
      notes: 'Waiting for ultrasound report',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId() + 'v3',
      visitNumber: 'V-0003',
      patientId: patients[2].id,
      patientNumber: patients[2].patientNumber,
      date: today,
      time: '10:00',
      doctorName: doctors[0],
      status: 'in-progress',
      diagnosis: '',
      prescription: [],
      labTests: [
        { id: generateId() + 'l3', testName: 'Blood Sugar (Fasting)', price: 300, status: 'ordered', result: '', paidAt: null, completedAt: null, paymentLocation: 'lab' },
        { id: generateId() + 'l4', testName: 'HbA1c', price: 800, status: 'ordered', result: '', paidAt: null, completedAt: null, paymentLocation: 'lab' },
      ],
      xrayOrders: [
        { id: generateId() + 'x1', testName: 'Chest X-Ray', price: 800, status: 'ordered', result: '', paidAt: null, completedAt: null, paymentLocation: 'xray' },
      ],
      ultrasoundOrders: [],
      surgeryOrder: null,
      notes: '',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId() + 'v4',
      visitNumber: 'V-0004',
      patientId: patients[3].id,
      patientNumber: patients[3].patientNumber,
      date: today,
      time: '10:30',
      doctorName: doctors[2],
      status: 'waiting',
      diagnosis: '',
      prescription: [],
      labTests: [],
      xrayOrders: [],
      ultrasoundOrders: [],
      surgeryOrder: null,
      notes: '',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId() + 'v5',
      visitNumber: 'V-0005',
      patientId: patients[4].id,
      patientNumber: patients[4].patientNumber,
      date: yesterday,
      time: '11:00',
      doctorName: doctors[0],
      status: 'completed',
      diagnosis: 'High Blood Pressure',
      prescription: [
        { medicine: 'Losartan', dosage: '50mg', frequency: 'once a day morning', duration: '30 days' },
        { medicine: 'Aspirin', dosage: '75mg', frequency: 'once a day afternoon', duration: '30 days' },
      ],
      labTests: [
        { id: generateId() + 'l5', testName: 'Lipid Profile', price: 1500, status: 'completed', result: 'Total Cholesterol: 240, LDL: 160, HDL: 35, Triglycerides: 180', paidAt: new Date().toISOString(), completedAt: new Date().toISOString(), paymentLocation: 'lab' },
      ],
      xrayOrders: [],
      ultrasoundOrders: [],
      surgeryOrder: {
        id: generateId() + 's1',
        surgeryType: 'Abdominal Surgery',
        totalCost: 50000,
        amountPaid: 25000,
        balance: 25000,
        status: 'scheduled',
        paymentLocation: 'reception',
        notes: 'Surgery scheduled for next week',
      },
      notes: 'Financial assistance needed, 25K paid',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId() + 'v6',
      visitNumber: 'V-0006',
      patientId: patients[5].id,
      patientNumber: patients[5].patientNumber,
      date: yesterday,
      time: '14:00',
      doctorName: doctors[1],
      status: 'completed',
      diagnosis: 'Throat Infection',
      prescription: [
        { medicine: 'Augmentin', dosage: '625mg', frequency: '3 times a day', duration: '7 days' },
        { medicine: 'Loxicom', dosage: '500mg', frequency: 'twice a day', duration: '3 days' },
      ],
      labTests: [],
      xrayOrders: [],
      ultrasoundOrders: [],
      surgeryOrder: null,
      notes: '',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: generateId() + 'v7',
      visitNumber: 'V-0007',
      patientId: patients[6].id,
      patientNumber: patients[6].patientNumber,
      date: today,
      time: '08:30',
      doctorName: doctors[2],
      status: 'waiting',
      diagnosis: '',
      prescription: [],
      labTests: [
        { id: generateId() + 'l6', testName: 'Creatinine', price: 400, status: 'ordered', result: '', paidAt: null, completedAt: null, paymentLocation: 'reception' },
      ],
      xrayOrders: [],
      ultrasoundOrders: [],
      surgeryOrder: null,
      notes: 'Elderly patient',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId() + 'v8',
      visitNumber: 'V-0008',
      patientId: patients[9].id,
      patientNumber: patients[9].patientNumber,
      date: yesterday,
      time: '15:00',
      doctorName: doctors[0],
      status: 'completed',
      diagnosis: 'Joint Pain',
      prescription: [
        { medicine: 'Diclofenac', dosage: '50mg', frequency: 'twice a day', duration: '7 days' },
        { medicine: 'Calcium + Vitamin D', dosage: '1 tablet', frequency: 'once a day', duration: '30 days' },
      ],
      labTests: [
        { id: generateId() + 'l7', testName: 'RA Factor', price: 700, status: 'completed', result: 'RA Factor: Positive (1:80)', paidAt: new Date().toISOString(), completedAt: new Date().toISOString(), paymentLocation: 'lab' },
        { id: generateId() + 'l8', testName: 'ESR', price: 200, status: 'completed', result: 'ESR: 45 mm/hr', paidAt: new Date().toISOString(), completedAt: new Date().toISOString(), paymentLocation: 'lab' },
      ],
      xrayOrders: [
        { id: generateId() + 'x2', testName: 'Joint X-Ray', price: 600, status: 'completed', result: ' joints: Mild degenerative changes, No fracture', paidAt: new Date().toISOString(), completedAt: new Date().toISOString(), paymentLocation: 'xray' },
      ],
      ultrasoundOrders: [],
      surgeryOrder: null,
      notes: '',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return visits;
}

function getDemoPharmacyBills(visits: Visit[], patients: Patient[]): PharmacyBill[] {
  const bills: PharmacyBill[] = [];

  // Bills for completed prescriptions
  const billedVisits = visits.filter(v => v.prescription.length > 0 && (v.status === 'seen' || v.status === 'completed'));
  billedVisits.forEach((visit) => {
    const patient = patients.find(p => p.id === visit.patientId);
    if (!patient) return;
    const totalAmount = visit.prescription.length * 150; // demo price per medicine
    bills.push({
      id: generateId() + 'b' + visit.id,
      visitId: visit.id,
      patientId: patient.id,
      patientNumber: patient.patientNumber,
      patientName: patient.name,
      medicines: visit.prescription,
      totalAmount,
      status: visit.status === 'completed' ? 'dispensed' : 'pending',
      paymentLocation: 'pharmacy',
      createdAt: visit.createdAt,
    });
  });

  return bills;
}

export function seedDemoData(): HMSData {
  const patients = getDemoPatients();
  const visits = getDemoVisits(patients);
  const pharmacyBills = getDemoPharmacyBills(visits, patients);

  return {
    patients,
    visits,
    pharmacyBills,
    settings: getDefaultSettings(),
    counters: { patient: 15, visit: 8 },
  };
}

export function loadData(): HMSData {
  if (typeof window === 'undefined') {
    return seedDemoData();
  }
  // Check if stored data version matches current version
  const storedVersion = localStorage.getItem(DATA_VERSION_KEY);
  if (storedVersion !== DATA_VERSION) {
    // Version mismatch — clear old data and re-seed with fresh English demo data
    console.log('[HMS] Data version mismatch. Clearing old data. Was:', storedVersion, 'Now:', DATA_VERSION);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
    const data = seedDemoData();
    saveData(data);
    return data;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const data = seedDemoData();
    saveData(data);
    return data;
  }
  try {
    return JSON.parse(raw) as HMSData;
  } catch {
    const data = seedDemoData();
    saveData(data);
    return data;
  }
}

export function saveData(data: HMSData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export { generateId };
