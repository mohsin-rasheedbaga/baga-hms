import { HMSData, Patient, Visit, PharmacyBill } from './types';

const STORAGE_KEY = 'baga_hms_data';

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
    { name: 'محمد احمد', relationType: 'father' as const, relationName: 'عبداللہ', mobile: '03001234567', age: '35', address: 'گلبرگ، لاہور', gender: 'male' as const },
    { name: 'فاطمہ بی بی', relationType: 'husband' as const, relationName: 'محمد عمر', mobile: '03012345678', age: '28', address: 'جوہر ٹاؤن، لاہور', gender: 'female' as const },
    { name: 'علی حسن', relationType: 'father' as const, relationName: 'حسن علی', mobile: '03023456789', age: '45', address: 'ڈفیا روڈ، لاہور', gender: 'male' as const },
    { name: 'آئینہ Bibi', relationType: 'father' as const, relationName: 'غلام محی الدین', mobile: '03034567890', age: '22', address: 'منٹو پارک، لاہور', gender: 'female' as const },
    { name: 'بلال احمد', relationType: 'father' as const, relationName: 'احمد خان', mobile: '03045678901', age: '50', address: 'انارکلی، لاہور', gender: 'male' as const },
    { name: 'مریم خاتون', relationType: 'husband' as const, relationName: 'خالد محمود', mobile: '03056789012', age: '32', address: 'گارڈن ٹاؤن، لاہور', gender: 'female' as const },
    { name: 'اسلمؔ', relationType: 'father' as const, relationName: 'محمد اسلم', mobile: '03067890123', age: '60', address: 'سمن آباد، لاہور', gender: 'male' as const },
    { name: 'زینب بی بی', relationType: 'husband' as const, relationName: 'رفعت علی', mobile: '03078901234', age: '40', address: 'ڈھرم پورہ، لاہور', gender: 'female' as const },
    { name: 'حسین علی', relationType: 'father' as const, relationName: 'علی محمد', mobile: '03089012345', age: '18', address: 'شاد باغ، لاہور', gender: 'male' as const },
    { name: 'نرگس بی بی', relationType: 'husband' as const, relationName: 'صدیق حسین', mobile: '03090123456', age: '55', address: 'بادامی باغ، لاہور', gender: 'female' as const },
    { name: 'رضا علی', relationType: 'father' as const, relationName: 'عمران علی', mobile: '03101234567', age: '8', address: 'ایچ بلاک، لاہور', gender: 'male' as const },
    { name: 'صبیحہ بی بی', relationType: 'father' as const, relationName: 'اسحاق', mobile: '03112345678', age: '26', address: 'واپڈا ٹاؤن، لاہور', gender: 'female' as const },
    { name: 'تانویر احمد', relationType: 'father' as const, relationName: 'احمد دیندار', mobile: '03123456789', age: '70', address: 'کوئٹہ روڈ، لاہور', gender: 'male' as const },
    { name: 'شازیہ بی بی', relationType: 'husband' as const, relationName: 'نسیم اختر', mobile: '03134567890', age: '33', address: 'فیصل ٹاؤن، لاہور', gender: 'female' as const },
    { name: ' عمر فاروق', relationType: 'father' as const, relationName: 'فاروق احمد', mobile: '03145678901', age: '42', address: 'ملک پورہ، لاہور', gender: 'male' as const },
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
  const doctors = ['ڈاکٹر محمد اشرف', 'ڈاکٹر ساجد رضا', 'ڈاکٹر نبیل احمد'];
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
      diagnosis: 'نزلہ زکام اور بخار',
      prescription: [
        { medicine: 'پانیاڈول', dosage: '500mg', frequency: 'تین بار دن', duration: '3 دن' },
        { medicine: 'سپریڈین سی', dosage: '1 ٹیبلٹ', frequency: 'دو بار دن', duration: '5 دن' },
        { medicine: 'اموکسل', dosage: '250mg', frequency: 'تین بار دن', duration: '5 دن' },
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
      diagnosis: 'پیٹ میں درد',
      prescription: [
        { medicine: 'فلاگیل', dosage: '400mg', frequency: 'تین بار دن', duration: '7 دن' },
        { medicine: 'ایسومپرازول', dosage: '20mg', frequency: 'صبح خالی', duration: '14 دن' },
      ],
      labTests: [
        { id: generateId() + 'l2', testName: 'Liver Function Test', price: 1200, status: 'paid', result: '', paidAt: new Date().toISOString(), completedAt: null, paymentLocation: 'lab' },
      ],
      xrayOrders: [],
      ultrasoundOrders: [
        { id: generateId() + 'u1', testName: 'ابڈومن الٹراساؤنڈ', price: 2000, status: 'paid', result: '', paidAt: new Date().toISOString(), completedAt: null, paymentLocation: 'ultrasound' },
      ],
      surgeryOrder: null,
      notes: 'الٹراساؤنڈ رپورٹ کا انتظار',
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
      diagnosis: 'بلڈ پریشر ہائی',
      prescription: [
        { medicine: 'لوزارٹن', dosage: '50mg', frequency: 'صبح ایک', duration: '30 دن' },
        { medicine: 'ایسپرن', dosage: '75mg', frequency: 'دوپہر ایک', duration: '30 دن' },
      ],
      labTests: [
        { id: generateId() + 'l5', testName: 'Lipid Profile', price: 1500, status: 'completed', result: 'Total Cholesterol: 240, LDL: 160, HDL: 35, Triglycerides: 180', paidAt: new Date().toISOString(), completedAt: new Date().toISOString(), paymentLocation: 'lab' },
      ],
      xrayOrders: [],
      ultrasoundOrders: [],
      surgeryOrder: {
        id: generateId() + 's1',
        surgeryType: 'پیٹ کی سرجری',
        totalCost: 50000,
        amountPaid: 25000,
        balance: 25000,
        status: 'scheduled',
        paymentLocation: 'reception',
        notes: 'اگلے ہفتے سرجری شیڈول',
      },
      notes: 'مالی اعانت کی کمی، 25 ہزار ادا',
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
      diagnosis: 'گلا میں انفیکشن',
      prescription: [
        { medicine: 'آگمنتین', dosage: '625mg', frequency: 'تین بار دن', duration: '7 دن' },
        { medicine: 'لوکیکام', dosage: '500mg', frequency: 'دو بار دن', duration: '3 دن' },
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
        { id: generateId() + 'l6', testName: 'کریاٹائین', price: 400, status: 'ordered', result: '', paidAt: null, completedAt: null, paymentLocation: 'reception' },
      ],
      xrayOrders: [],
      ultrasoundOrders: [],
      surgeryOrder: null,
      notes: 'بڑی عمر کے مریض',
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
      diagnosis: 'جوڑوں کا درد',
      prescription: [
        { medicine: 'ڈائکلوفیناک', dosage: '50mg', frequency: 'دو بار دن', duration: '7 دن' },
        { medicine: 'کیلسیم + وٹامن ڈی', dosage: '1 ٹیبلٹ', frequency: 'ایک بار دن', duration: '30 دن' },
      ],
      labTests: [
        { id: generateId() + 'l7', testName: 'RA Factor', price: 700, status: 'completed', result: 'RA Factor: Positive (1:80)', paidAt: new Date().toISOString(), completedAt: new Date().toISOString(), paymentLocation: 'lab' },
        { id: generateId() + 'l8', testName: 'ESR', price: 200, status: 'completed', result: 'ESR: 45 mm/hr', paidAt: new Date().toISOString(), completedAt: new Date().toISOString(), paymentLocation: 'lab' },
      ],
      xrayOrders: [
        { id: generateId() + 'x2', testName: 'کھینچے ہوئے جوڑوں کا ایکس ری', price: 600, status: 'completed', result: ' joints: Mild degenerative changes, No fracture', paidAt: new Date().toISOString(), completedAt: new Date().toISOString(), paymentLocation: 'xray' },
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
