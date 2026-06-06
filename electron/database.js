/**
 * BAGA Hospital Management System - SQLite Database Layer
 *
 * Uses better-sqlite3 for synchronous, high-performance SQLite access.
 * Data is stored in a "JSON document" model (id + JSON blob) to mirror
 * the existing localStorage structure for easy migration.
 *
 * All public functions are SYNCHRONOUS.
 */

const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

let db = null;
let dbPath = '';

// ─────────────────────────────────────────────────────────────────────────────
// Table definitions – JSON document tables  (id TEXT, data TEXT)
// and key-value tables              (key TEXT, value TEXT)
// ─────────────────────────────────────────────────────────────────────────────

const JSON_TABLES = [
  'hospital',
  'hospital_settings',
  'users',
  'patients',
  'visits',
  'lab_orders',
  'lis_orders',
  'lab_tests',
  'lab_inventory',
  'lab_expenses',
  'lab_doctors',
  'prescriptions',
  'dispenses',
  'bills',
  'xray_orders',
  'ultrasound_orders',
  'appointments',
  'admissions',
  'medicines',
  'lab_test_catalog',
  'room_types',
  'employees',
  'attendance',
  'salaries',
  'pharmacy_expenses',
];

const KV_TABLES = [
  'counters',
  'kv_store',
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed data
// ─────────────────────────────────────────────────────────────────────────────

const SEED_USERS = [
  { id: 'u1', email: 'admin', password: 'admin', name: 'Hospital Admin', role: 'super_admin', department: 'Management', active: true, permissions: ['all'] },
  { id: 'u2', email: 'reception', password: 'reception', name: 'Reception Staff', role: 'reception', department: 'Reception', active: true, permissions: ['register_patient', 'new_visit', 'search_patient', 'card_renewal', 'print_card'] },
  { id: 'u3', email: 'doctor', password: 'doctor', name: 'Dr. Ahmed Hassan', role: 'doctor', department: 'Emergency', active: true, permissions: ['search_patient', 'order_lab', 'prescribe', 'order_xray', 'order_ultrasound', 'write_notes', 'discharge', 'view_reports'] },
  { id: 'u4', email: 'lab', password: 'lab', name: 'Lab Technician', role: 'lab', department: 'Laboratory', active: true, permissions: ['view_lab_orders', 'enter_results', 'print_report'] },
  { id: 'u5', email: 'pharmacy', password: 'pharmacy', name: 'Pharmacist', role: 'pharmacy', department: 'Pharmacy', active: true, permissions: ['view_prescriptions', 'dispense_medicine'] },
  { id: 'u6', email: 'xray', password: 'xray', name: 'Radiologist', role: 'xray', department: 'X-Ray', active: true, permissions: ['view_xray_orders', 'enter_report'] },
  { id: 'u7', email: 'ultrasound', password: 'ultrasound', name: 'USG Technician', role: 'ultrasound', department: 'Ultrasound', active: true, permissions: ['view_usg_orders', 'enter_report'] },
  { id: 'u8', email: 'accounts', password: 'accounts', name: 'Accountant', role: 'accounts', department: 'Accounts', active: true, permissions: ['view_bills', 'collect_payment', 'daily_report'] },
];

const SEED_HOSPITAL = {
  name: 'BAGA Hospital',
  address: 'Main Road, City',
  phone: '0300-1234567',
  email: 'info@bagahospital.com',
  licenseNo: 'BAGA-LIC-0001',
};

const SEED_HOSPITAL_SETTINGS = {
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

const SEED_PATIENTS = [
  { id: 'p1', patientNo: 'BAGA-0001', name: 'Muhammad Ali', fatherName: 'Abdul Rehman', mobile: '03001234567', age: '35', gender: 'Male', address: 'Street 5, Lahore', cardStatus: 'Active', cardExpiry: '2026-05-15', totalVisits: 5, lastVisit: '2025-05-16', regDate: '2025-01-15' },
  { id: 'p2', patientNo: 'BAGA-0002', name: 'Fatima Bibi', fatherName: 'Haji Rasool', mobile: '03119876543', age: '28', gender: 'Female', address: 'Block C, Karachi', cardStatus: 'Active', cardExpiry: '2026-02-20', totalVisits: 3, lastVisit: '2025-05-16', regDate: '2025-02-20' },
  { id: 'p3', patientNo: 'BAGA-0003', name: 'Ahmed Khan', fatherName: 'Ghulam Khan', mobile: '03234567890', age: '45', gender: 'Male', address: 'Mohalla Shah, Multan', cardStatus: 'Active', cardExpiry: '2026-04-15', totalVisits: 8, lastVisit: '2025-05-16', regDate: '2024-12-05' },
];

const SEED_VISITS = [
  { id: 'v1', patientId: 'p1', patientNo: 'BAGA-0001', patientName: 'Muhammad Ali', department: 'Cardiology', doctor: 'Dr. Muhammad Ali', doctorFee: 2500, tokenNo: 1, date: '2025-05-16', time: '09:30 AM', status: 'Active', diagnosis: 'Chest pain - under investigation', notes: 'Patient reports chest pain for 3 days', vitals: { bp: '140/90', pulse: '88', temp: '98.6F', weight: '75kg' } },
  { id: 'v2', patientId: 'p2', patientNo: 'BAGA-0002', patientName: 'Fatima Bibi', department: 'Gynecology', doctor: 'Dr. Sara Khan', doctorFee: 2000, tokenNo: 2, date: '2025-05-16', time: '10:15 AM', status: 'Active', diagnosis: 'Prenatal checkup', notes: 'Routine pregnancy checkup', vitals: { bp: '120/80', pulse: '76', temp: '98.4F', weight: '65kg' } },
  { id: 'v3', patientId: 'p3', patientNo: 'BAGA-0003', patientName: 'Ahmed Khan', department: 'Orthopedic', doctor: 'Dr. Bilal Siddiqui', doctorFee: 1800, tokenNo: 3, date: '2025-05-16', time: '11:00 AM', status: 'Active', diagnosis: 'Knee pain - suspected ligament injury', notes: 'Pain in right knee after fall', vitals: { bp: '130/85', pulse: '80', temp: '98.6F', weight: '80kg' } },
];

const SEED_LAB_ORDERS = [
  { id: 'lo1', visitId: 'v1', patientId: 'p1', patientNo: 'BAGA-0001', patientName: 'Muhammad Ali', tests: [{ testName: 'CBC (Complete Blood Count)', price: 800, selected: true }, { testName: 'Lipid Profile', price: 1200, selected: true }, { testName: 'Liver Function Test (LFT)', price: 1500, selected: true }, { testName: 'Kidney Function Test (KFT)', price: 1200, selected: true }, { testName: 'Blood Sugar (Fasting)', price: 400, selected: true }, { testName: 'Troponin T', price: 1800, selected: true }], orderedBy: 'Dr. Muhammad Ali', date: '2025-05-16', time: '09:45 AM', status: 'Pending', results: [] },
  { id: 'lo2', visitId: 'v2', patientId: 'p2', patientNo: 'BAGA-0002', patientName: 'Fatima Bibi', tests: [{ testName: 'CBC (Complete Blood Count)', price: 800, selected: true }, { testName: 'Blood Group & Rh', price: 500, selected: true }, { testName: 'Hemoglobin', price: 400, selected: true }, { testName: 'Urine Routine Examination', price: 300, selected: true }], orderedBy: 'Dr. Sara Khan', date: '2025-05-16', time: '10:30 AM', status: 'Pending', results: [] },
];

const SEED_PRESCRIPTIONS = [
  { id: 'pr1', visitId: 'v1', patientId: 'p1', patientNo: 'BAGA-0001', patientName: 'Muhammad Ali', medicines: [{ name: 'Aspirin', form: 'Tablet', strength: '75mg', qtyPerDay: '1', timing: 'After Breakfast', duration: '7 days', instructions: 'Take with water', price: 35, selected: true, dosage: '1 tablet', frequency: 'After Breakfast' }, { name: 'Clopidogrel', form: 'Tablet', strength: '75mg', qtyPerDay: '1', timing: 'After Lunch', duration: '7 days', instructions: '', price: 180, selected: true, dosage: '1 tablet', frequency: 'After Lunch' }, { name: 'Atorvastatin', form: 'Tablet', strength: '20mg', qtyPerDay: '1', timing: 'At Bedtime', duration: '30 days', instructions: '', price: 150, selected: true, dosage: '1 tablet', frequency: 'At Bedtime' }, { name: 'Metoprolol', form: 'Tablet', strength: '50mg', qtyPerDay: '1', timing: 'After Meal', duration: '7 days', instructions: 'Do not stop suddenly', price: 90, selected: true, dosage: '1 tablet', frequency: 'Twice daily' }, { name: 'Omeprazole', form: 'Capsule', strength: '20mg', qtyPerDay: '1', timing: 'Empty Stomach', duration: '14 days', instructions: 'Take 30 min before breakfast', price: 75, selected: true, dosage: '1 capsule', frequency: 'Empty Stomach' }], prescribedBy: 'Dr. Muhammad Ali', date: '2025-05-16', time: '10:00 AM', status: 'Active', notes: 'Complete the full course. Avoid heavy meals.' },
  { id: 'pr2', visitId: 'v2', patientId: 'p2', patientNo: 'BAGA-0002', patientName: 'Fatima Bibi', medicines: [{ name: 'Folic Acid', form: 'Tablet', strength: '5mg', qtyPerDay: '1', timing: 'After Breakfast', duration: '30 days', instructions: '', price: 35, selected: true, dosage: '1 tablet', frequency: 'After Breakfast' }, { name: 'Iron Supplement', form: 'Tablet', strength: '200mg', qtyPerDay: '1', timing: 'Empty Stomach', duration: '30 days', instructions: 'Take with orange juice', price: 95, selected: true, dosage: '1 tablet', frequency: 'Empty Stomach' }, { name: 'Calcium + Vitamin D', form: 'Tablet', strength: '500mg+200IU', qtyPerDay: '1', timing: 'After Lunch', duration: '30 days', instructions: '', price: 95, selected: true, dosage: '1 tablet', frequency: 'After Lunch' }], prescribedBy: 'Dr. Sara Khan', date: '2025-05-16', time: '10:45 AM', status: 'Active', notes: 'Continue prenatal vitamins throughout pregnancy.' },
];

const SEED_XRAY_ORDERS = [
  { id: 'xo1', visitId: 'v1', patientId: 'p1', patientNo: 'BAGA-0001', patientName: 'Muhammad Ali', xrayType: 'Chest X-Ray (PA View)', price: 1500, selected: true, orderedBy: 'Dr. Muhammad Ali', date: '2025-05-16', status: 'Pending' },
  { id: 'xo2', visitId: 'v3', patientId: 'p3', patientNo: 'BAGA-0003', patientName: 'Ahmed Khan', xrayType: 'Knee X-Ray (Both AP & Lateral)', price: 1800, selected: true, orderedBy: 'Dr. Bilal Siddiqui', date: '2025-05-16', status: 'Pending' },
];

const SEED_ULTRASOUND_ORDERS = [
  { id: 'uo1', visitId: 'v2', patientId: 'p2', patientNo: 'BAGA-0002', patientName: 'Fatima Bibi', usgType: 'Obstetric Ultrasound', price: 2500, selected: true, orderedBy: 'Dr. Sara Khan', date: '2025-05-16', status: 'Pending' },
  { id: 'uo2', visitId: 'v3', patientId: 'p3', patientNo: 'BAGA-0003', patientName: 'Ahmed Khan', usgType: 'Knee Ultrasound', price: 2000, selected: true, orderedBy: 'Dr. Bilal Siddiqui', date: '2025-05-16', status: 'Pending' },
];

// ─── 80 Medicines (from src/lib/store.ts) ──────────────────────────────────

const SEED_MEDICINES = [
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
];

// ─── Lab Test Catalog (30 tests, from src/lib/store.ts) ───────────────────

const SEED_LAB_TEST_CATALOG = [
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

// ─── Room Types ────────────────────────────────────────────────────────────

const SEED_ROOM_TYPES = [
  { id: 'rt1', name: 'General Ward', chargesPerNight: 1500, active: true },
  { id: 'rt2', name: 'Private Room', chargesPerNight: 3000, active: true },
  { id: 'rt3', name: 'Semi-Private', chargesPerNight: 2000, active: true },
  { id: 'rt4', name: 'ICU', chargesPerNight: 5000, active: true },
  { id: 'rt5', name: 'VIP Suite', chargesPerNight: 8000, active: true },
];

// ─── Default Employees ────────────────────────────────────────────────────

const SEED_EMPLOYEES = [
  { id: 'e1', employeeCode: '0001', name: 'Dr. Ahmed Hassan', fatherName: 'Hassan Ali', cnic: '35201-1234567-1', mobile: '03001234567', gender: 'Male', age: '42', address: 'Street 5, Lahore', designation: 'Medical Officer', department: 'Emergency', salary: 150000, joinDate: '2024-01-15', status: 'Active', education: [{ degree: 'MBBS', institution: 'King Edward Medical University', year: '2008', grade: 'Distinction' }], experience: [{ organization: 'Mayo Hospital', position: 'Medical Officer', startDate: '2010-01-01', endDate: '2023-12-31', duration: '14 years' }], documents: [{ id: 'd1', name: 'CNIC Copy', type: 'CNIC', fileName: 'cnic_e1.jpg', uploadDate: '2024-01-10' }, { id: 'd2', name: 'PMDC Certificate', type: 'Certificate', fileName: 'pmdc_e1.pdf', uploadDate: '2024-01-10' }], equipment: [], bankAccount: 'IBAN-1234567890', emergencyContact: '03009876543' },
  { id: 'e2', employeeCode: '0002', name: 'Dr. Sara Khan', fatherName: 'Khan Muhammad', cnic: '35201-7654321-1', mobile: '03119876543', gender: 'Female', age: '38', address: 'Block C, Karachi', designation: 'Gynecologist', department: 'Gynecology', salary: 200000, joinDate: '2024-02-01', status: 'Active', education: [{ degree: 'MBBS', institution: 'Dow Medical College', year: '2010', grade: 'First Class' }, { degree: 'FCPS', institution: 'CPSP', year: '2016', grade: 'Passed' }], experience: [{ organization: 'Jinnah Hospital', position: 'Resident', startDate: '2012-01-01', endDate: '2020-12-31', duration: '9 years' }], documents: [{ id: 'd3', name: 'CNIC Copy', type: 'CNIC', fileName: 'cnic_e2.jpg', uploadDate: '2024-01-28' }, { id: 'd4', name: 'PMDC Certificate', type: 'Certificate', fileName: 'pmdc_e2.pdf', uploadDate: '2024-01-28' }], equipment: [], bankAccount: 'IBAN-0987654321', emergencyContact: '03118765432' },
  { id: 'e3', employeeCode: '0003', name: 'Nurse Fatima', fatherName: 'Muhammad Akram', cnic: '35201-9876543-1', mobile: '03234567890', gender: 'Female', age: '30', address: 'Mohalla Shah, Multan', designation: 'Staff Nurse', department: 'General Ward', salary: 60000, joinDate: '2024-03-10', status: 'Active', education: [{ degree: 'BS Nursing', institution: 'Nursing College Lahore', year: '2017', grade: 'First Class' }], experience: [{ organization: 'Services Hospital', position: 'Staff Nurse', startDate: '2018-06-01', endDate: '2024-02-28', duration: '6 years' }], documents: [{ id: 'd5', name: 'CNIC Copy', type: 'CNIC', fileName: 'cnic_e3.jpg', uploadDate: '2024-03-05' }, { id: 'd6', name: 'Nursing License', type: 'Certificate', fileName: 'license_e3.pdf', uploadDate: '2024-03-05' }], equipment: [], bankAccount: 'IBAN-5678901234', emergencyContact: '03234567891' },
];

// ─── Counters ──────────────────────────────────────────────────────────────

const SEED_COUNTERS = {
  patient_counter: '4',
  employee_counter: '1',
};

// ─────────────────────────────────────────────────────────────────────────────
// initDatabase
// ─────────────────────────────────────────────────────────────────────────────

function initDatabase(app) {
  if (db) {
    console.log('[DB] Database already initialized');
    return;
  }

  try {
    // Resolve database path
    const userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'baga-hms.db');
    console.log('[DB] Database path:', dbPath);

    // Ensure the directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open (or create) the database
    db = new Database(dbPath);

    // WAL journal mode for reliability & concurrent readers
    db.pragma('journal_mode = WAL');
    // Foreign keys
    db.pragma('foreign_keys = ON');
    // Busy timeout 5000ms
    db.pragma('busy_timeout = 5000');

    console.log('[DB] Database opened, pragmas set');

    // ── Create tables ──────────────────────────────────────────────────────
    createTables();

    // ── Seed if empty ──────────────────────────────────────────────────────
    seedIfEmpty();

    console.log('[DB] Initialization complete');
  } catch (err) {
    console.error('[DB] Failed to initialize database:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createTables
// ─────────────────────────────────────────────────────────────────────────────

function createTables() {
  console.log('[DB] Creating tables…');

  // JSON document tables: id TEXT PRIMARY KEY, data TEXT
  for (const table of JSON_TABLES) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS [${table}] (
        id  TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);
  }

  // Key-value tables: key TEXT PRIMARY KEY, value TEXT
  for (const table of KV_TABLES) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS [${table}] (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
  }

  console.log('[DB] All tables created');
}

// ─────────────────────────────────────────────────────────────────────────────
// seedIfEmpty – inserts default data on first run
// ─────────────────────────────────────────────────────────────────────────────

function seedIfEmpty() {
  // Check if the users table already has data
  const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get();
  if (userCount && userCount.cnt > 0) {
    console.log('[DB] Seed data already present, skipping');
    return;
  }

  console.log('[DB] Inserting seed data…');

  // Use a single transaction for all seed inserts
  const insertDoc = db.prepare('INSERT OR REPLACE INTO [?] (id, data) VALUES (?, ?)');
  const insertKV   = db.prepare('INSERT OR REPLACE INTO [?] (key, value) VALUES (?, ?)');

  const seedMany = db.transaction((records, table) => {
    for (const rec of records) {
      insertDoc.run(table, rec.id, JSON.stringify(rec));
    }
  });

  const seedSingle = db.transaction((table, id, data) => {
    insertDoc.run(table, id, JSON.stringify(data));
  });

  const seedKVMany = db.transaction((pairs, table) => {
    for (const [key, value] of Object.entries(pairs)) {
      insertKV.run(table, key, String(value));
    }
  });

  // ── Users ──────────────────────────────────────────────────────────────────
  seedMany(SEED_USERS, 'users');
  console.log(`[DB]   users: ${SEED_USERS.length} records`);

  // ── Hospital (single-row) ─────────────────────────────────────────────────
  seedSingle('hospital', 'h1', SEED_HOSPITAL);
  console.log('[DB]   hospital: 1 record');

  // ── Hospital Settings (single-row) ─────────────────────────────────────────
  seedSingle('hospital_settings', 'hs1', SEED_HOSPITAL_SETTINGS);
  console.log('[DB]   hospital_settings: 1 record');

  // ── Patients ───────────────────────────────────────────────────────────────
  seedMany(SEED_PATIENTS, 'patients');
  console.log(`[DB]   patients: ${SEED_PATIENTS.length} records`);

  // ── Visits ────────────────────────────────────────────────────────────────
  seedMany(SEED_VISITS, 'visits');
  console.log(`[DB]   visits: ${SEED_VISITS.length} records`);

  // ── Lab Orders ────────────────────────────────────────────────────────────
  seedMany(SEED_LAB_ORDERS, 'lab_orders');
  console.log(`[DB]   lab_orders: ${SEED_LAB_ORDERS.length} records`);

  // ── Prescriptions ─────────────────────────────────────────────────────────
  seedMany(SEED_PRESCRIPTIONS, 'prescriptions');
  console.log(`[DB]   prescriptions: ${SEED_PRESCRIPTIONS.length} records`);

  // ── X-Ray Orders ──────────────────────────────────────────────────────────
  seedMany(SEED_XRAY_ORDERS, 'xray_orders');
  console.log(`[DB]   xray_orders: ${SEED_XRAY_ORDERS.length} records`);

  // ── Ultrasound Orders ─────────────────────────────────────────────────────
  seedMany(SEED_ULTRASOUND_ORDERS, 'ultrasound_orders');
  console.log(`[DB]   ultrasound_orders: ${SEED_ULTRASOUND_ORDERS.length} records`);

  // ── Medicines (80) ────────────────────────────────────────────────────────
  seedMany(SEED_MEDICINES, 'medicines');
  console.log(`[DB]   medicines: ${SEED_MEDICINES.length} records`);

  // ── Lab Test Catalog (30) ──────────────────────────────────────────────────
  seedMany(SEED_LAB_TEST_CATALOG, 'lab_test_catalog');
  console.log(`[DB]   lab_test_catalog: ${SEED_LAB_TEST_CATALOG.length} records`);

  // ── Room Types ────────────────────────────────────────────────────────────
  seedMany(SEED_ROOM_TYPES, 'room_types');
  console.log(`[DB]   room_types: ${SEED_ROOM_TYPES.length} records`);

  // ── Employees ─────────────────────────────────────────────────────────────
  seedMany(SEED_EMPLOYEES, 'employees');
  console.log(`[DB]   employees: ${SEED_EMPLOYEES.length} records`);

  // ── Counters (key-value) ──────────────────────────────────────────────────
  seedKVMany(SEED_COUNTERS, 'counters');
  console.log('[DB]   counters: 2 records');

  console.log('[DB] Seed data insertion complete');
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD API – Generic operations (JSON document tables)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an array of parsed JSON records from a table.
 * @param {string} table – must be a known JSON_TABLE
 * @returns {Array}
 */
function getAll(table) {
  try {
    const rows = db.prepare(`SELECT data FROM [${table}]`).all();
    return rows.map(r => JSON.parse(r.data));
  } catch (err) {
    console.error(`[DB] getAll(${table}) error:`, err.message);
    return [];
  }
}

/**
 * Returns a single parsed record by id, or null.
 * @param {string} table
 * @param {string} id
 * @returns {object|null}
 */
function getById(table, id) {
  try {
    const row = db.prepare(`SELECT data FROM [${table}] WHERE id = ?`).get(id);
    return row ? JSON.parse(row.data) : null;
  } catch (err) {
    console.error(`[DB] getById(${table}, ${id}) error:`, err.message);
    return null;
  }
}

/**
 * Insert or update (upsert) a single record by id.
 * @param {string} table
 * @param {string} id
 * @param {object} data
 */
function setById(table, id, data) {
  try {
    db.prepare(`INSERT OR REPLACE INTO [${table}] (id, data) VALUES (?, ?)`)
      .run(id, JSON.stringify(data));
  } catch (err) {
    console.error(`[DB] setById(${table}, ${id}) error:`, err.message);
  }
}

/**
 * Replace ALL records in a table with the provided array.
 * Runs inside a transaction.
 * @param {string} table
 * @param {Array} dataArray – array of objects that each have an `id` field
 */
function setAll(table, dataArray) {
  try {
    const deleteAll = db.prepare(`DELETE FROM [${table}]`);
    const insert = db.prepare(`INSERT INTO [${table}] (id, data) VALUES (?, ?)`);

    const tx = db.transaction((records) => {
      deleteAll.run();
      for (const rec of records) {
        insert.run(rec.id, JSON.stringify(rec));
      }
    });

    tx(dataArray);
  } catch (err) {
    console.error(`[DB] setAll(${table}) error:`, err.message);
  }
}

/**
 * Delete a single record by id.
 * @param {string} table
 * @param {string} id
 * @returns {boolean} true if a row was deleted
 */
function deleteById(table, id) {
  try {
    const info = db.prepare(`DELETE FROM [${table}] WHERE id = ?`).run(id);
    return info.changes > 0;
  } catch (err) {
    console.error(`[DB] deleteById(${table}, ${id}) error:`, err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD API – Key-value operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a counter value (returns number).
 * Returns 0 if the key does not exist.
 * @param {string} key
 * @returns {number}
 */
function getCounter(key) {
  try {
    const row = db.prepare(`SELECT value FROM counters WHERE key = ?`).get(key);
    return row ? parseInt(row.value, 10) || 0 : 0;
  } catch (err) {
    console.error(`[DB] getCounter(${key}) error:`, err.message);
    return 0;
  }
}

/**
 * Set a counter value.
 * @param {string} key
 * @param {number|string} value
 */
function setCounter(key, value) {
  try {
    db.prepare(`INSERT OR REPLACE INTO counters (key, value) VALUES (?, ?)`)
      .run(key, String(value));
  } catch (err) {
    console.error(`[DB] setCounter(${key}) error:`, err.message);
  }
}

/**
 * Get a key-value store value.
 * Returns the raw string, or null.
 * @param {string} key
 * @returns {string|null}
 */
function getKV(key) {
  try {
    const row = db.prepare(`SELECT value FROM kv_store WHERE key = ?`).get(key);
    return row ? row.value : null;
  } catch (err) {
    console.error(`[DB] getKV(${key}) error:`, err.message);
    return null;
  }
}

/**
 * Set a key-value store value.
 * @param {string} key
 * @param {string} value
 */
function setKV(key, value) {
  try {
    db.prepare(`INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)`)
      .run(key, String(value));
  } catch (err) {
    console.error(`[DB] setKV(${key}) error:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Backup the database to a destination file path.
 * Uses SQLite built-in backup API via better-sqlite3.
 * @param {string} filePath – absolute path for the backup file
 */
function backup(filePath) {
  try {
    console.log(`[DB] Backing up to: ${filePath}`);
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db.backup(filePath);
    console.log('[DB] Backup complete');
    return true;
  } catch (err) {
    console.error('[DB] Backup error:', err.message);
    return false;
  }
}

/**
 * Returns the resolved database file path.
 * @returns {string}
 */
function getDbPath() {
  return dbPath;
}

/**
 * Close the database connection.
 */
function close() {
  try {
    if (db) {
      db.close();
      db = null;
      console.log('[DB] Connection closed');
    }
  } catch (err) {
    console.error('[DB] Close error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  initDatabase,
  // Generic CRUD
  getAll,
  getById,
  setById,
  setAll,
  deleteById,
  // Key-value
  getCounter,
  setCounter,
  getKV,
  setKV,
  // Utility
  backup,
  getDbPath,
  close,
};
