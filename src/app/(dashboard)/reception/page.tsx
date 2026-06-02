'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  getPatients, setPatients, getPatientCounter, setPatientCounter,
  getVisits, setVisits, addVisit,
  getLabOrders, getLabOrdersByVisit,
  getPrescriptions, getPrescriptionsByVisit,
  getXRayOrders, getXRayOrdersByVisit,
  getUltrasoundOrders, getUltrasoundOrdersByVisit,
  getBills, addBill,
  getHospitalSettings,
  addPatient, updatePatient,
  todayStr, timeStr, genId, getNextTokenNo,
} from '@/lib/store';
import type { Patient, Visit, LabOrder, Prescription, XRayOrder, UltrasoundOrder, Bill, BillItem, HospitalSettings } from '@/lib/types';
import { initLabData, getLabOrders as getLisLabOrders } from '@/lib/lab-store';
import type { LabOrderItem } from '@/lib/lab-store';
import { triggerPrint } from '@/lib/print-utils';

/* ========== DOCTORS DATA ========== */
interface Doctor {
  id: string; name: string; dept: string; fee: number; timing: string;
}

const DEPARTMENTS = [
  'Emergency', 'General Medicine', 'Cardiology', 'Orthopedic',
  'Gynecology', 'Pediatrician', 'ENT', 'Skin Specialist',
  'Eye Specialist', 'Dental', 'Physiotherapy', 'Surgery'
];

const DOCTORS: Doctor[] = [
  { id: 'd1', name: 'Dr. Ahmed Hassan', dept: 'Emergency', fee: 1500, timing: '9AM - 1PM' },
  { id: 'd2', name: 'Dr. Muhammad Ali', dept: 'Cardiology', fee: 2500, timing: '2PM - 6PM' },
  { id: 'd3', name: 'Dr. Sara Khan', dept: 'Gynecology', fee: 2000, timing: '10AM - 2PM' },
  { id: 'd4', name: 'Dr. Bilal Siddiqui', dept: 'Orthopedic', fee: 1800, timing: '4PM - 8PM' },
  { id: 'd5', name: 'Dr. Zainab Malik', dept: 'Pediatrician', fee: 1500, timing: '9AM - 1PM' },
  { id: 'd6', name: 'Dr. Usman Tariq', dept: 'ENT', fee: 2000, timing: '3PM - 7PM' },
  { id: 'd7', name: 'Dr. Imran Raza', dept: 'General Medicine', fee: 1200, timing: '9AM - 5PM' },
  { id: 'd8', name: 'Dr. Nadia Ashraf', dept: 'Skin Specialist', fee: 2000, timing: '11AM - 3PM' },
  { id: 'd9', name: 'Dr. Kamran Hyder', dept: 'Eye Specialist', fee: 2200, timing: '10AM - 4PM' },
  { id: 'd10', name: 'Dr. Farhan Ali', dept: 'Dental', fee: 1500, timing: '9AM - 2PM' },
  { id: 'd11', name: 'Dr. Saima Noor', dept: 'Physiotherapy', fee: 1000, timing: '8AM - 12PM' },
  { id: 'd12', name: 'Dr. Rizwan Ahmad', dept: 'Surgery', fee: 5000, timing: 'By Appointment' },
];

/* ========== BILL MODAL DATA ========== */
interface BillModalData {
  patient: Patient;
  visit: Visit;
  labOrders: LabOrder[];
  prescriptions: Prescription[];
  xrayOrders: XRayOrder[];
  ultrasoundOrders: UltrasoundOrder[];
  // Editable copies
  labTests: { testName: string; price: number; selected: boolean }[];
  medicines: { name: string; dosage: string; duration: string; frequency: string; instructions: string; price: number; selected: boolean }[];
  xrays: { id: string; xrayType: string; price: number; selected: boolean }[];
  ultrasounds: { id: string; usgType: string; price: number; selected: boolean }[];
}

/* ========== MAIN COMPONENT ========== */
export default function ReceptionPage() {
  // Data from store
  const [patients, setPatientsState] = useState<Patient[]>([]);
  const [visits, setVisitsState] = useState<Visit[]>([]);
  const [labOrders, setLabOrdersState] = useState<LabOrder[]>([]);
  const [prescriptions, setPrescriptionsState] = useState<Prescription[]>([]);
  const [xrayOrders, setXrayOrdersState] = useState<XRayOrder[]>([]);
  const [ultrasoundOrders, setUltrasoundOrdersState] = useState<UltrasoundOrder[]>([]);
  const [bills, setBillsState] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<HospitalSettings | null>(null);
  const [patientCounter, setPatientCounterState] = useState(4);

  // UI State
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [printContent, setPrintContent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searched, setSearched] = useState(false);

  // Registration form
  const [form, setForm] = useState({
    name: '', fatherName: '', mobile: '', age: '', gender: 'Male', address: '',
    department: '', doctor: ''
  });

  // New visit modal
  const [visitPatient, setVisitPatient] = useState<Patient | null>(null);
  const [visitDept, setVisitDept] = useState('');
  const [visitDoctor, setVisitDoctor] = useState('');

  // Edit modal
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  // Bill modal
  const [billModal, setBillModal] = useState<BillModalData | null>(null);

  // Receipt modal
  const [receiptBill, setReceiptBill] = useState<Bill | null>(null);

  // Load data
  useEffect(() => {
    initLabData();
    refreshData();
  }, []);

  const refreshData = () => {
    setPatientsState(getPatients());
    setVisitsState(getVisits());
    setLabOrdersState(getLabOrders());
    setPrescriptionsState(getPrescriptions());
    setXrayOrdersState(getXRayOrders());
    setUltrasoundOrdersState(getUltrasoundOrders());
    setBillsState(getBills());
    setSettings(getHospitalSettings());
    setPatientCounterState(getPatientCounter());
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredDoctors = (dept: string) => DOCTORS.filter(d => d.dept === dept);
  const selectedDoctorData = (docName: string) => DOCTORS.find(d => d.name === docName);

  // ========= SEARCH =========
  const handleSearch = () => {
    if (!searchQuery.trim()) { showToast('Enter mobile number, card number or name', 'error'); return; }
    const q = searchQuery.trim().toLowerCase();
    const results = patients.filter(p =>
      p.mobile.includes(q) || p.patientNo.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    );
    setSearchResults(results);
    setSearched(true);
  };

  // ========= GET ACTIVE VISIT =========
  const getActiveVisit = (patientId: string): Visit | undefined => {
    return visits.find(v => v.patientId === patientId && v.status === 'Active');
  };

  // ========= OPEN BILL MODAL =========
  const handleOpenBill = (patient: Patient) => {
    const activeVisit = getActiveVisit(patient.id);
    if (!activeVisit) {
      showToast('No active visit found for this patient', 'error');
      return;
    }

    const vLabOrders = getLabOrdersByVisit(activeVisit.id);
    const vPrescriptions = getPrescriptionsByVisit(activeVisit.id);
    const vXrayOrders = getXRayOrdersByVisit(activeVisit.id);
    const vUltrasoundOrders = getUltrasoundOrdersByVisit(activeVisit.id);

    // Check if already paid
    const existingBill = bills.find(b => b.visitId === activeVisit.id && b.status === 'Paid');
    if (existingBill) {
      showToast('Bill already paid for this visit. Receipt #' + existingBill.id.toUpperCase(), 'error');
      return;
    }

    // Build editable copies
    let labTests: { testName: string; price: number; selected: boolean }[] = [];
    vLabOrders.forEach(lo => {
      lo.tests.forEach(t => {
        labTests.push({ testName: t.testName, price: t.price, selected: t.selected });
      });
    });

    let meds: { name: string; dosage: string; duration: string; frequency: string; instructions: string; price: number; selected: boolean }[] = [];
    vPrescriptions.forEach(pr => {
      pr.medicines.forEach(m => {
        meds.push({ name: m.name, dosage: m.dosage||'', duration: m.duration, frequency: m.frequency||'', instructions: m.instructions, price: m.price, selected: m.selected });
      });
    });

    let xrays = vXrayOrders.map(x => ({ id: x.id, xrayType: x.xrayType, price: x.price, selected: x.selected }));
    let ultrasounds = vUltrasoundOrders.map(u => ({ id: u.id, usgType: u.usgType, price: u.price, selected: u.selected }));

    setBillModal({
      patient,
      visit: activeVisit,
      labOrders: vLabOrders,
      prescriptions: vPrescriptions,
      xrayOrders: vXrayOrders,
      ultrasoundOrders: vUltrasoundOrders,
      labTests,
      medicines: meds,
      xrays,
      ultrasounds,
    });
  };

  // ========= BILL CALCULATIONS =========
  const billCalculations = useMemo(() => {
    if (!billModal) return null;
    const labTotal = billModal.labTests.filter(t => t.selected).reduce((s, t) => s + t.price, 0);
    const xrayTotal = billModal.xrays.filter(x => x.selected).reduce((s, x) => s + x.price, 0);
    const usgTotal = billModal.ultrasounds.filter(u => u.selected).reduce((s, u) => s + u.price, 0);
    const pharmacyTotal = billModal.medicines.filter(m => m.selected).reduce((s, m) => s + m.price, 0);
    const grandTotal = labTotal + xrayTotal + usgTotal + pharmacyTotal;
    return { labTotal, xrayTotal, usgTotal, pharmacyTotal, grandTotal };
  }, [billModal]);

  // ========= RECEIVE PAYMENT & PRINT RECEIPT =========
  const handleReceivePayment = () => {
    if (!billModal || !billCalculations) return;
    if (billCalculations.grandTotal === 0) {
      showToast('No items selected for billing', 'error');
      return;
    }

    const { labTotal, xrayTotal, usgTotal, pharmacyTotal, grandTotal } = billCalculations;
    const items: BillItem[] = [];

    billModal.labTests.filter(t => t.selected).forEach(t => {
      items.push({ description: `Lab: ${t.testName}`, amount: t.price, type: 'Lab', selected: true, quantity: 1 });
    });
    billModal.xrays.filter(x => x.selected).forEach(x => {
      items.push({ description: `X-Ray: ${x.xrayType}`, amount: x.price, type: 'X-Ray', selected: true, quantity: 1 });
    });
    billModal.ultrasounds.filter(u => u.selected).forEach(u => {
      items.push({ description: `Ultrasound: ${u.usgType}`, amount: u.price, type: 'Ultrasound', selected: true, quantity: 1 });
    });
    if (settings?.receptionCanCollectPharmacy !== false) {
      billModal.medicines.filter(m => m.selected).forEach(m => {
        items.push({ description: `Medicine: ${m.name} (${m.dosage}, ${m.duration})`, amount: m.price, type: 'Pharmacy', selected: true, quantity: 1 });
      });
    }

    const bill: Bill = {
      id: genId(),
      patientId: billModal.patient.id,
      patientNo: billModal.patient.patientNo,
      patientName: billModal.patient.name,
      visitId: billModal.visit.id,
      items,
      totalAmount: grandTotal,
      paidAmount: grandTotal,
      status: 'Paid',
      paymentMethod: 'Cash',
      date: todayStr(),
      time: timeStr(),
      receivedBy: 'Reception',
    };

    addBill(bill);
    setReceiptBill(bill);
    setBillModal(null);
    refreshData();
    showToast(`Payment received: ${settings?.currency || 'Rs.'} ${grandTotal.toLocaleString()}`, 'success');
  };

  // ========= GENERATE RECEIPT HTML =========
  const getReceiptHtml = (bill: Bill): string => {
    const curr = settings?.currency || 'Rs.';
    const hospital = JSON.parse(localStorage.getItem('baga_hospital') || '{}');
    const footer = settings?.receiptFooter || 'Thank you for choosing BAGA Hospital. Get well soon!';
    return `
      <html><head><title>Receipt - ${bill.patientNo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; }
        .receipt { border: 2px solid #333; border-radius: 8px; padding: 24px; max-width: 400px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 12px; margin-bottom: 12px; }
        .header h1 { color: #1e293b; font-size: 20px; }
        .header p { color: #64748b; font-size: 11px; margin-top: 2px; }
        .receipt-title { text-align: center; font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
        .info-grid .label { color: #64748b; }
        .info-grid .value { color: #1e293b; font-weight: 500; }
        .items-table { width: 100%; font-size: 11px; border-collapse: collapse; margin-bottom: 12px; }
        .items-table th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #cbd5e1; }
        .items-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
        .items-table td:last-child { text-align: right; font-weight: 600; }
        .type-badge { font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: 600; }
        .type-lab { background: #d1fae5; color: #065f46; }
        .type-xray { background: #fee2e2; color: #991b1b; }
        .type-ultrasound { background: #ede9fe; color: #5b21b6; }
        .type-pharmacy { background: #fef3c7; color: #92400e; }
        .total-section { border-top: 2px solid #333; padding-top: 10px; margin-top: 8px; }
        .total-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
        .total-row.grand { font-size: 18px; font-weight: 700; color: #1e293b; }
        .footer { text-align: center; margin-top: 16px; padding-top: 12px; border-top: 2px dashed #333; }
        .footer p { font-size: 10px; color: #64748b; }
        .footer .thank { font-size: 12px; color: #1e293b; font-weight: 600; margin-top: 4px; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>${hospital.name || 'BAGA Hospital'}</h1>
            <p>${hospital.address || 'Main Road, City'} | ${hospital.phone || ''}</p>
            <p>License: ${hospital.licenseNo || 'BAGA-LIC-0001'}</p>
          </div>
          <div class="receipt-title">PAYMENT RECEIPT</div>
          <div class="info-grid">
            <div><span class="label">Receipt #:</span><br/><span class="value">${bill.id.toUpperCase()}</span></div>
            <div><span class="label">Date:</span><br/><span class="value">${bill.date} ${bill.time}</span></div>
            <div><span class="label">Patient:</span><br/><span class="value">${bill.patientName}</span></div>
            <div><span class="label">Patient No:</span><br/><span class="value">${bill.patientNo}</span></div>
          </div>
          <table class="items-table">
            <thead><tr><th>#</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              ${bill.items.map((item, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>
                    ${item.description}
                    <span class="type-badge type-${item.type.toLowerCase()}">${item.type}</span>
                  </td>
                  <td>${curr} ${item.amount.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total-section">
            <div class="total-row grand">
              <span>TOTAL PAID</span>
              <span>${curr} ${bill.totalAmount.toLocaleString()}</span>
            </div>
            <div class="total-row" style="margin-top:4px;">
              <span>Payment Method:</span>
              <span>${bill.paymentMethod}</span>
            </div>
          </div>
          <div class="footer">
            <p>Received by: ${bill.receivedBy}</p>
            <p class="thank">${footer}</p>
          </div>
        </div>
        <script>window.onload=function(){window.print();}</script>
      </body></html>
    `;
  };

  // ========= REGISTER =========
  const handleRegister = () => {
    if (!form.name.trim() || !form.fatherName.trim() || !form.mobile.trim() || !form.age.trim() || !form.address.trim()) {
      showToast('All 5 fields are compulsory (Name, Father Name, Mobile, Age, Address)', 'error'); return;
    }
    if (!form.department) { showToast('Please select Department', 'error'); return; }
    if (!form.doctor) { showToast('Please select Doctor', 'error'); return; }

    const newCounter = patientCounter;
    const patientNo = `BAGA-${String(newCounter).padStart(4, '0')}`;
    const today = todayStr();
    const doc = selectedDoctorData(form.doctor);
    const tokenNo = getNextTokenNo();

    const newPatient: Patient = {
      id: genId(), patientNo, name: form.name.trim(), fatherName: form.fatherName.trim(),
      mobile: form.mobile.trim(), age: form.age.trim(), gender: form.gender,
      address: form.address.trim(), cardStatus: 'Active', cardExpiry: '',
      totalVisits: 0, lastVisit: today, regDate: today
    };
    addPatient(newPatient);
    setPatientCounter(newCounter + 1);
    setPatientCounterState(newCounter + 1);

    const newVisit: Visit = {
      id: genId(), patientId: newPatient.id, patientNo: newPatient.patientNo, patientName: newPatient.name,
      department: form.department, doctor: form.doctor, doctorFee: doc?.fee || 0,
      tokenNo,
      date: today, time: timeStr(), status: 'Active', diagnosis: '', notes: '',
      vitals: { bp: '', pulse: '', temp: '', weight: '' }
    };
    addVisit(newVisit);

    setForm({ name: '', fatherName: '', mobile: '', age: '', gender: 'Male', address: '', department: '', doctor: '' });
    handlePrintCard(newPatient, newVisit);
    refreshData();
    showToast(`Patient registered: ${patientNo}`, 'success');
  };

  // ========= NEW VISIT =========
  const handleNewVisit = () => {
    if (!visitPatient) return;
    if (!visitDept) { showToast('Please select Department', 'error'); return; }
    if (!visitDoctor) { showToast('Please select Doctor', 'error'); return; }

    const today = todayStr();
    const doc = selectedDoctorData(visitDoctor);
    const tokenNo = getNextTokenNo();

    const newVisit: Visit = {
      id: genId(), patientId: visitPatient.id, patientNo: visitPatient.patientNo, patientName: visitPatient.name,
      department: visitDept, doctor: visitDoctor, doctorFee: doc?.fee || 0,
      tokenNo,
      date: today, time: timeStr(), status: 'Active', diagnosis: '', notes: '',
      vitals: { bp: '', pulse: '', temp: '', weight: '' }
    };
    addVisit(newVisit);

    const updatedPatient = { ...visitPatient, totalVisits: visitPatient.totalVisits + 1, lastVisit: today };
    updatePatient(visitPatient.id, {
      totalVisits: visitPatient.totalVisits + 1,
      lastVisit: today,
    });

    handlePrintCard(updatedPatient, newVisit);
    setVisitPatient(null);
    setVisitDept('');
    setVisitDoctor('');
    refreshData();
    showToast('New visit created successfully!', 'success');
  };

  // ========= PRINT CARD =========
  const handlePrintCard = (patient: Patient, visit: Visit | null) => {
    const curr = settings?.currency || 'Rs.';
    const cardHtml = `
      <html><head><title>Patient Card - ${patient.patientNo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; }
        .page { max-width: 400px; margin: 0 auto; }

        /* Card Circle - Patient Info */
        .card {
          border: 3px solid #2563eb;
          border-radius: 20px;
          padding: 24px 20px;
          position: relative;
        }
        .card .header {
          text-align: center;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 10px;
          margin-bottom: 14px;
        }
        .card .header h1 { color: #2563eb; font-size: 20px; }
        .card .header p { color: #64748b; font-size: 11px; }
        .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        .row:last-child { border-bottom: none; }
        .row .label { color: #64748b; font-weight: 600; }
        .row .value { color: #1e293b; font-weight: 500; text-align: right; }

        /* Visit Info - Below Card */
        .visit-slip {
          margin-top: 12px;
          border: 2px dashed #1e293b;
          border-radius: 10px;
          padding: 14px 18px;
          background: #f8fafc;
        }
        .visit-slip .visit-header {
          text-align: center;
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid #cbd5e1;
        }
        .visit-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 16px;
          font-size: 12px;
        }
        .visit-grid .vl { color: #64748b; }
        .visit-grid .vv { color: #1e293b; font-weight: 600; }
        .visit-grid .token-row {
          grid-column: 1 / -1;
          text-align: center;
          background: #2563eb;
          color: white;
          padding: 6px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 700;
          margin-top: 6px;
        }

        .footer { text-align: center; margin-top: 10px; font-size: 9px; color: #94a3b8; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>
        <div class="page">
          <div class="card">
            <div class="header">
              <h1>BAGA Hospital</h1>
              <p>Patient Card</p>
            </div>
            <div class="row"><span class="label">Patient No:</span><span class="value">${patient.patientNo}</span></div>
            <div class="row"><span class="label">Name:</span><span class="value">${patient.name}</span></div>
            <div class="row"><span class="label">Father/Husband:</span><span class="value">${patient.fatherName}</span></div>
            <div class="row"><span class="label">Mobile:</span><span class="value">${patient.mobile}</span></div>
            <div class="row"><span class="label">Age/Gender:</span><span class="value">${patient.age} / ${patient.gender}</span></div>
            <div class="row"><span class="label">Address:</span><span class="value">${patient.address}</span></div>
          </div>

          ${visit ? `
          <div class="visit-slip">
            <div class="visit-header">Current Visit Details</div>
            <div class="visit-grid">
              <div><span class="vl">Department:</span></div>
              <div><span class="vv">${visit.department}</span></div>
              <div><span class="vl">Doctor:</span></div>
              <div><span class="vv">${visit.doctor}</span></div>
              <div><span class="vl">Doctor Fee:</span></div>
              <div><span class="vv">${curr} ${visit.doctorFee.toLocaleString()}</span></div>
              <div><span class="vl">Token No:</span></div>
              <div><span class="vv">${visit.tokenNo}</span></div>
              <div><span class="vl">Time:</span></div>
              <div><span class="vv">${visit.time}</span></div>
              <div><span class="vl">Date:</span></div>
              <div><span class="vv">${visit.date}</span></div>
              <div class="token-row">TOKEN # ${visit.tokenNo}</div>
            </div>
          </div>
          ` : ''}

          <div class="footer">Registered: ${patient.regDate} | Total Visits: ${patient.totalVisits}</div>
        </div>
        <script>window.onload=function(){window.print();}</script>
      </body></html>
    `;
    setPrintContent(cardHtml);
  };

  // ========= EDIT PATIENT =========
  const handleEditSave = () => {
    if (!editingPatient) return;
    updatePatient(editingPatient.id, editingPatient);
    setEditingPatient(null);
    refreshData();
    showToast('Patient updated!', 'success');
  };

  const todayVisits = visits.filter(v => v.date === todayStr());
  const curr = settings?.currency || 'Rs.';

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Print Card Window */}
      {printContent && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Patient Card</h3>
              <div className="flex gap-2">
                <button onClick={() => triggerPrint(printContent || '')} className="btn btn-primary btn-sm">Print</button>
                <button onClick={() => setPrintContent(null)} className="btn btn-outline btn-sm">Close</button>
              </div>
            </div>
            <iframe srcDoc={printContent} style={{ width: '100%', height: '600px', border: 'none' }} title="Patient Card" />
          </div>
        </div>
      )}

      {/* ===== SEARCH BAR - TOP ===== */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-3">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            Search Patient
          </span>
        </h2>
        <div className="flex gap-3">
          <input
            className="form-input flex-1 text-lg"
            placeholder="Enter mobile number, card number (BAGA-0001) or name..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearched(false); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="btn btn-primary btn-lg">Search</button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Search by mobile number, card number (BAGA-XXXX), or patient name</p>

        {/* Search Results */}
        {searched && searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-600">{searchResults.length} patient(s) found</p>
            {searchResults.map(p => {
              const activeVisit = getActiveVisit(p.id);
              const visitLabOrders = activeVisit ? getLabOrdersByVisit(activeVisit.id) : [];
              const visitLabOrdersLis = activeVisit ? getLisLabOrders().filter(o => o.visitId === activeVisit.id || o.patientId === activeVisit.patientId) : [];
              const visitPresc = activeVisit ? getPrescriptionsByVisit(activeVisit.id) : [];
              const visitXray = activeVisit ? getXRayOrdersByVisit(activeVisit.id) : [];
              const visitUsg = activeVisit ? getUltrasoundOrdersByVisit(activeVisit.id) : [];
              const existingBill = activeVisit ? bills.find(b => b.visitId === activeVisit.id && b.status === 'Paid') : null;

              return (
                <div key={p.id} className="border-2 border-slate-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-blue-600 text-lg">{p.patientNo}</span>
                        {activeVisit && <span className="badge badge-blue">Active Visit</span>}
                        {existingBill && <span className="badge badge-green">Bill Paid</span>}
                      </div>
                      <p className="font-semibold text-slate-800 text-lg">{p.name} <span className="text-slate-500 font-normal text-sm">({p.gender}, {p.age})</span></p>
                      <p className="text-sm text-slate-500">Father/Husband: {p.fatherName} | Mobile: {p.mobile}</p>
                      <p className="text-sm text-slate-500">Address: {p.address}</p>

                      {/* Active Visit Details */}
                      {activeVisit && (
                        <div className="mt-3 space-y-2">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm font-semibold text-blue-800 mb-1">Current Visit - {activeVisit.date} {activeVisit.time} | Token: <strong>#{activeVisit.tokenNo}</strong></p>
                            <p className="text-xs text-blue-700">Department: <strong>{activeVisit.department}</strong> | Doctor: <strong>{activeVisit.doctor}</strong> | Fee: <strong>{curr} {activeVisit.doctorFee.toLocaleString()}</strong></p>
                            {activeVisit.diagnosis && <p className="text-xs text-blue-700 mt-1">Diagnosis: {activeVisit.diagnosis}</p>}
                          </div>

                          {/* Lab Tests */}
                          {visitLabOrdersLis.length > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <p className="text-sm font-semibold text-green-800 mb-1">
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                  Lab Tests
                                  <span className={`ml-1 badge text-xs ${visitLabOrdersLis.some(o => o.status === 'completed') ? 'badge-green' : visitLabOrdersLis.some(o => o.status === 'processing') ? 'badge-blue' : 'badge-amber'}`}>
                                    {visitLabOrdersLis.some(o => o.status === 'completed') ? 'Completed' : visitLabOrdersLis.some(o => o.status === 'processing') ? 'In Progress' : 'Pending'}
                                  </span>
                                </span>
                              </p>
                              <div className="space-y-1">
                                {visitLabOrdersLis.map(lo => lo.tests.map((t, i) => (
                                  <div key={i} className="flex justify-between text-xs">
                                    <span className="text-green-700">{t.testName}</span>
                                    <span className="font-semibold text-green-800">{curr} {t.price.toLocaleString()}</span>
                                  </div>
                                )))}
                                <div className="flex justify-between text-xs font-bold border-t border-green-300 pt-1 mt-1">
                                  <span className="text-green-800">Lab Subtotal</span>
                                  <span className="text-green-800">{curr} {visitLabOrdersLis.reduce((s, lo) => s + lo.tests.reduce((ss, t) => ss + t.price, 0), 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* X-Ray */}
                          {visitXray.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-sm font-semibold text-red-800 mb-2">
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  X-Ray
                                </span>
                              </p>
                              {visitXray.map(x => (
                                <div key={x.id} className="flex justify-between text-xs">
                                  <span className="text-red-700">{x.xrayType}</span>
                                  <span className="font-semibold text-red-800">{curr} {x.price.toLocaleString()}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-xs font-bold border-t border-red-300 pt-1 mt-1">
                                <span className="text-red-800">X-Ray Subtotal</span>
                                <span className="text-red-800">{curr} {visitXray.reduce((s, x) => s + x.price, 0).toLocaleString()}</span>
                              </div>
                            </div>
                          )}

                          {/* Ultrasound */}
                          {visitUsg.length > 0 && (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                              <p className="text-sm font-semibold text-purple-800 mb-2">
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  Ultrasound
                                </span>
                              </p>
                              {visitUsg.map(u => (
                                <div key={u.id} className="flex justify-between text-xs">
                                  <span className="text-purple-700">{u.usgType}</span>
                                  <span className="font-semibold text-purple-800">{curr} {u.price.toLocaleString()}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-xs font-bold border-t border-purple-300 pt-1 mt-1">
                                <span className="text-purple-800">Ultrasound Subtotal</span>
                                <span className="text-purple-800">{curr} {visitUsg.reduce((s, u) => s + u.price, 0).toLocaleString()}</span>
                              </div>
                            </div>
                          )}

                          {/* Medication/Pharmacy */}
                          {visitPresc.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <p className="text-sm font-semibold text-amber-800 mb-2">
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                  Medicines / Pharmacy
                                </span>
                              </p>
                              <div className="space-y-1">
                                {visitPresc.map(pr => pr.medicines.map((m, i) => (
                                  <div key={i} className="flex justify-between text-xs">
                                    <span className="text-amber-700">{m.name} ({m.dosage}, {m.duration})</span>
                                    <span className="font-semibold text-amber-800">{curr} {m.price.toLocaleString()}</span>
                                  </div>
                                )))}
                              </div>
                              <div className="flex justify-between text-xs font-bold border-t border-amber-300 pt-1 mt-1">
                                <span className="text-amber-800">Pharmacy Subtotal</span>
                                <span className="text-amber-800">{curr} {visitPresc.reduce((s, pr) => s + pr.medicines.reduce((ss, m) => ss + m.price, 0), 0).toLocaleString()}</span>
                              </div>
                            </div>
                          )}

                          {/* Grand Total (no consultation fee) */}
                          {(visitLabOrdersLis.length > 0 || visitXray.length > 0 || visitUsg.length > 0 || visitPresc.length > 0) && (
                            <div className="bg-slate-800 rounded-lg p-3">
                              <div className="flex justify-between text-sm text-white font-bold">
                                <span>GRAND TOTAL</span>
                                <span>{curr} {(
                                  visitLabOrdersLis.reduce((s, lo) => s + lo.tests.reduce((ss, t) => ss + t.price, 0), 0) +
                                  visitXray.reduce((s, x) => s + x.price, 0) +
                                  visitUsg.reduce((s, u) => s + u.price, 0) +
                                  visitPresc.reduce((s, pr) => s + pr.medicines.reduce((ss, m) => ss + m.price, 0), 0)
                                ).toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 min-w-[120px]">
                      {activeVisit && !existingBill && (
                        <button onClick={() => handleOpenBill(p)} className="btn btn-primary btn-sm whitespace-nowrap">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          Generate Bill
                        </button>
                      )}
                      {existingBill && (
                        <button onClick={() => setReceiptBill(existingBill)} className="btn btn-success btn-sm whitespace-nowrap">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          View Receipt
                        </button>
                      )}
                      {!activeVisit && (
                        <button onClick={() => { setVisitPatient(p); setVisitDept(''); setVisitDoctor(''); }} className="btn btn-success btn-sm whitespace-nowrap">New Visit</button>
                      )}
                      <button onClick={() => handlePrintCard(p, activeVisit || null)} className="btn btn-outline btn-sm whitespace-nowrap">Print Card</button>
                      <button onClick={() => setEditingPatient({ ...p })} className="btn btn-outline btn-sm whitespace-nowrap">Edit</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {searched && searchResults.length === 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            No patient found. Please register as new patient below.
          </div>
        )}
      </div>

      {/* ===== NEW PATIENT REGISTRATION ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-slate-800">
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              New Patient Registration
            </span>
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1">
            <span className="text-sm text-blue-700 font-semibold">Next No: BAGA-{String(patientCounter).padStart(4, '0')}</span>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-5">Fields with * are compulsory. After registration, card will be printed automatically.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Patient Name *</label>
            <input className="form-input" placeholder="Full name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div>
            <label className="form-label">Father / Husband Name *</label>
            <input className="form-input" placeholder="Father or husband name" value={form.fatherName} onChange={e => setForm({...form, fatherName: e.target.value})} />
          </div>
          <div>
            <label className="form-label">Mobile Number *</label>
            <input className="form-input" placeholder="03001234567" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} />
          </div>
          <div>
            <label className="form-label">Age *</label>
            <input className="form-input" placeholder="Age in years" value={form.age} onChange={e => setForm({...form, age: e.target.value})} />
          </div>
          <div>
            <label className="form-label">Gender</label>
            <select className="form-input" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>
          <div>
            <label className="form-label">Address *</label>
            <input className="form-input" placeholder="Full address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          </div>
          <div>
            <label className="form-label">Department *</label>
            <select className="form-input" value={form.department} onChange={e => { setForm({...form, department: e.target.value, doctor: ''}); }}>
              <option value="">-- Select Department --</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Doctor *</label>
            <select className="form-input" value={form.doctor} onChange={e => setForm({...form, doctor: e.target.value})} disabled={!form.department}>
              <option value="">-- Select Doctor --</option>
              {form.department && filteredDoctors(form.department).map(d => (
                <option key={d.id} value={d.name}>{d.name} ({curr} {d.fee.toLocaleString()})</option>
              ))}
            </select>
          </div>
          {form.doctor && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-sm text-blue-700">Doctor Fee: <strong>{curr} {selectedDoctorData(form.doctor)?.fee.toLocaleString()}</strong></span>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={handleRegister} className="btn btn-success btn-lg">Register Patient & Print Card</button>
          <button onClick={() => setForm({ name: '', fatherName: '', mobile: '', age: '', gender: 'Male', address: '', department: '', doctor: '' })} className="btn btn-outline btn-lg">Clear</button>
        </div>
      </div>

      {/* ===== TODAY'S VISITS ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Today&apos;s Visits ({todayVisits.length})</h2>
        <p className="text-sm text-slate-500 mb-4">All visits created today</p>
        {todayVisits.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p>No visits created today yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Token</th><th>Patient No</th><th>Name</th><th>Department</th><th>Doctor</th><th>Fee</th><th>Time</th><th>Status</th></tr>
              </thead>
              <tbody>
                {todayVisits.map(v => {
                  const hasBill = bills.find(b => b.visitId === v.id && b.status === 'Paid');
                  return (
                    <tr key={v.id}>
                      <td className="font-bold text-blue-600 text-center bg-blue-50">#{v.tokenNo}</td>
                      <td className="font-mono font-bold text-blue-600">{v.patientNo}</td>
                      <td className="font-medium">{v.patientName}</td>
                      <td><span className="badge badge-purple">{v.department}</span></td>
                      <td className="text-sm">{v.doctor}</td>
                      <td className="font-semibold">{curr} {v.doctorFee.toLocaleString()}</td>
                      <td>{v.time}</td>
                      <td>
                        {hasBill ? <span className="badge badge-green">Paid</span> : <span className="badge badge-amber">Unpaid</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== PENDING LAB TESTS ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Pending Lab Tests
            <span className="bg-green-100 text-green-700 text-sm font-bold px-2 py-0.5 rounded-full">
              {labOrders.filter(lo => lo.status !== 'Completed').reduce((s, lo) => s + lo.tests.length, 0)}
            </span>
          </h2>
        </div>
        {labOrders.filter(lo => lo.status !== 'Completed').length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <svg className="w-10 h-10 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-sm">No pending lab tests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Patient No</th><th>Patient Name</th><th>Tests</th><th>Doctor</th><th>Status</th></tr>
              </thead>
              <tbody>
                {labOrders.filter(lo => lo.status !== 'Completed').map(lo => {
                  const patient = patients.find(p => p.id === lo.patientId);
                  const visit = visits.find(v => v.id === lo.visitId);
                  return lo.tests.map((t, i) => (
                    <tr key={`${lo.id}-${i}`}>
                      <td className="font-mono font-bold text-blue-600">{patient?.patientNo || '-'}</td>
                      <td className="font-medium">{patient?.name || '-'}</td>
                      <td>{t.testName}</td>
                      <td className="text-sm">{visit?.doctor || '-'}</td>
                      <td>
                        <span className={`badge ${lo.status === 'Completed' ? 'badge-green' : lo.status === 'In Progress' ? 'badge-blue' : 'badge-amber'}`}>
                          {lo.status || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== PENDING X-RAY ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Pending X-Ray
            <span className="bg-red-100 text-red-700 text-sm font-bold px-2 py-0.5 rounded-full">
              {xrayOrders.filter(x => x.status !== 'Completed').length}
            </span>
          </h2>
        </div>
        {xrayOrders.filter(x => x.status !== 'Completed').length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <svg className="w-10 h-10 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-sm">No pending x-rays</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Patient No</th><th>Patient Name</th><th>X-Ray Type</th><th>Doctor</th><th>Status</th></tr>
              </thead>
              <tbody>
                {xrayOrders.filter(x => x.status !== 'Completed').map(x => {
                  const patient = patients.find(p => p.id === x.patientId);
                  const visit = visits.find(v => v.id === x.visitId);
                  return (
                    <tr key={x.id}>
                      <td className="font-mono font-bold text-blue-600">{patient?.patientNo || '-'}</td>
                      <td className="font-medium">{patient?.name || '-'}</td>
                      <td>{x.xrayType}</td>
                      <td className="text-sm">{visit?.doctor || '-'}</td>
                      <td>
                        <span className={`badge ${x.status === 'Completed' ? 'badge-green' : x.status === 'In Progress' ? 'badge-blue' : 'badge-amber'}`}>
                          {x.status || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== PENDING ULTRASOUND ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Pending Ultrasound
            <span className="bg-purple-100 text-purple-700 text-sm font-bold px-2 py-0.5 rounded-full">
              {ultrasoundOrders.filter(u => u.status !== 'Completed').length}
            </span>
          </h2>
        </div>
        {ultrasoundOrders.filter(u => u.status !== 'Completed').length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <svg className="w-10 h-10 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-sm">No pending ultrasounds</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Patient No</th><th>Patient Name</th><th>USG Type</th><th>Doctor</th><th>Status</th></tr>
              </thead>
              <tbody>
                {ultrasoundOrders.filter(u => u.status !== 'Completed').map(u => {
                  const patient = patients.find(p => p.id === u.patientId);
                  const visit = visits.find(v => v.id === u.visitId);
                  return (
                    <tr key={u.id}>
                      <td className="font-mono font-bold text-blue-600">{patient?.patientNo || '-'}</td>
                      <td className="font-medium">{patient?.name || '-'}</td>
                      <td>{u.usgType}</td>
                      <td className="text-sm">{visit?.doctor || '-'}</td>
                      <td>
                        <span className={`badge ${u.status === 'Completed' ? 'badge-green' : u.status === 'In Progress' ? 'badge-blue' : 'badge-amber'}`}>
                          {u.status || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== ALL PATIENTS TABLE ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-1">All Registered Patients ({patients.length})</h2>
        <p className="text-sm text-slate-500 mb-4">Complete patient records</p>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient No</th><th>Name</th><th>Father Name</th><th>Mobile</th><th>Age/Gender</th>
                <th>Department</th><th>Doctor</th><th>Visits</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => {
                const activeVisit = getActiveVisit(p.id);
                const hasBill = activeVisit ? bills.find(b => b.visitId === activeVisit.id && b.status === 'Paid') : false;
                return (
                  <tr key={p.id}>
                    <td className="font-mono font-bold text-blue-600">{p.patientNo}</td>
                    <td className="font-medium">{p.name}</td>
                    <td>{p.fatherName}</td>
                    <td className="font-mono text-sm">{p.mobile}</td>
                    <td>{p.age}/{p.gender}</td>
                    <td><span className="badge badge-purple">{activeVisit?.department || '-'}</span></td>
                    <td className="text-sm">{activeVisit?.doctor || '-'}</td>
                    <td className="text-center">{p.totalVisits}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {activeVisit && !hasBill && (
                          <button onClick={() => handleOpenBill(p)} className="btn btn-primary btn-sm">Bill</button>
                        )}
                        {activeVisit && hasBill && (
                          <button onClick={() => setReceiptBill(hasBill)} className="btn btn-success btn-sm">Receipt</button>
                        )}
                        {!activeVisit && (
                          <button onClick={() => { setVisitPatient(p); setVisitDept(''); setVisitDoctor(''); }} className="btn btn-success btn-sm">Visit</button>
                        )}
                        <button onClick={() => handlePrintCard(p, activeVisit || null)} className="btn btn-outline btn-sm">Print</button>
                        <button onClick={() => setEditingPatient({ ...p })} className="btn btn-outline btn-sm">Edit</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== BILL MODAL ===== */}
      {billModal && billCalculations && (
        <div className="modal-overlay" onClick={() => setBillModal(null)}>
          <div className="modal-content" style={{ maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Generate Bill</h3>
                <p className="text-sm text-blue-600 font-mono">{billModal.patient.patientNo} - {billModal.patient.name}</p>
              </div>
              <button onClick={() => setBillModal(null)} className="btn btn-outline btn-sm">Close</button>
            </div>

            {/* Patient Info */}
            <div className="bg-slate-50 rounded-lg p-3 mb-4 grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">Father/Husband:</span> <strong>{billModal.patient.fatherName}</strong></div>
              <div><span className="text-slate-500">Mobile:</span> <strong>{billModal.patient.mobile}</strong></div>
              <div><span className="text-slate-500">Department:</span> <strong>{billModal.visit.department}</strong></div>
              <div><span className="text-slate-500">Doctor:</span> <strong>{billModal.visit.doctor}</strong></div>
              <div><span className="text-slate-500">Visit Date:</span> <strong>{billModal.visit.date} {billModal.visit.time}</strong></div>
              <div><span className="text-slate-500">Token No:</span> <strong>#{billModal.visit.tokenNo}</strong></div>
              {billModal.visit.diagnosis && <div><span className="text-slate-500">Diagnosis:</span> <strong>{billModal.visit.diagnosis}</strong></div>}
            </div>

            <p className="text-xs text-amber-600 mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <strong>Instructions:</strong> Patient can ask to remove any test or medicine they do not want. Uncheck the items below to remove them from the bill. The total will adjust automatically.
            </p>

            {/* No items message */}
            {billModal.labTests.length === 0 && billModal.xrays.length === 0 && billModal.ultrasounds.length === 0 && billModal.medicines.length === 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center mb-3">
                <svg className="w-10 h-10 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <p className="text-sm text-slate-500">No doctor orders yet. The doctor has not ordered any tests, x-rays, ultrasounds, or medicines for this visit.</p>
              </div>
            )}

            {/* Lab Tests */}
            {billModal.labTests.length > 0 && (
              <div className="border border-green-200 rounded-lg mb-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-t-lg border-b border-green-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <span className="font-semibold text-green-800">Lab Tests</span>
                    <span className="text-xs text-green-600">({billModal.labTests.filter(t => t.selected).length}/{billModal.labTests.length} selected)</span>
                  </div>
                  <span className="font-bold text-green-700">{curr} {billCalculations.labTotal.toLocaleString()}</span>
                </div>
                <div className="p-3 space-y-2">
                  {billModal.labTests.map((test, idx) => (
                    <label key={idx} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${test.selected ? 'bg-white border border-green-200' : 'bg-slate-50 border border-slate-200 opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={test.selected}
                          onChange={e => {
                            const newTests = [...billModal.labTests];
                            newTests[idx] = { ...newTests[idx], selected: e.target.checked };
                            setBillModal({ ...billModal, labTests: newTests });
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                        />
                        <span className={`text-sm ${test.selected ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{test.testName}</span>
                      </div>
                      <span className={`font-semibold text-sm ${test.selected ? 'text-green-700' : 'text-slate-400'}`}>{curr} {test.price.toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* X-Ray */}
            {billModal.xrays.length > 0 && (
              <div className="border border-red-200 rounded-lg mb-3">
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-t-lg border-b border-red-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span className="font-semibold text-red-800">X-Ray</span>
                    <span className="text-xs text-red-600">({billModal.xrays.filter(x => x.selected).length}/{billModal.xrays.length} selected)</span>
                  </div>
                  <span className="font-bold text-red-700">{curr} {billCalculations.xrayTotal.toLocaleString()}</span>
                </div>
                <div className="p-3 space-y-2">
                  {billModal.xrays.map((xray, idx) => (
                    <label key={xray.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${xray.selected ? 'bg-white border border-red-200' : 'bg-slate-50 border border-slate-200 opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={xray.selected}
                          onChange={e => {
                            const newXrays = [...billModal.xrays];
                            newXrays[idx] = { ...newXrays[idx], selected: e.target.checked };
                            setBillModal({ ...billModal, xrays: newXrays });
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span className={`text-sm ${xray.selected ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{xray.xrayType}</span>
                      </div>
                      <span className={`font-semibold text-sm ${xray.selected ? 'text-red-700' : 'text-slate-400'}`}>{curr} {xray.price.toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Ultrasound */}
            {billModal.ultrasounds.length > 0 && (
              <div className="border border-purple-200 rounded-lg mb-3">
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-t-lg border-b border-purple-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="font-semibold text-purple-800">Ultrasound</span>
                    <span className="text-xs text-purple-600">({billModal.ultrasounds.filter(u => u.selected).length}/{billModal.ultrasounds.length} selected)</span>
                  </div>
                  <span className="font-bold text-purple-700">{curr} {billCalculations.usgTotal.toLocaleString()}</span>
                </div>
                <div className="p-3 space-y-2">
                  {billModal.ultrasounds.map((usg, idx) => (
                    <label key={usg.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${usg.selected ? 'bg-white border border-purple-200' : 'bg-slate-50 border border-slate-200 opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={usg.selected}
                          onChange={e => {
                            const newUsgs = [...billModal.ultrasounds];
                            newUsgs[idx] = { ...newUsgs[idx], selected: e.target.checked };
                            setBillModal({ ...billModal, ultrasounds: newUsgs });
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className={`text-sm ${usg.selected ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{usg.usgType}</span>
                      </div>
                      <span className={`font-semibold text-sm ${usg.selected ? 'text-purple-700' : 'text-slate-400'}`}>{curr} {usg.price.toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Medicines / Pharmacy */}
            {billModal.medicines.length > 0 && (settings?.receptionCanCollectPharmacy !== false) && (
              <div className="border border-amber-200 rounded-lg mb-3">
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-t-lg border-b border-amber-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    <span className="font-semibold text-amber-800">Medicines / Pharmacy</span>
                    <span className="text-xs text-amber-600">({billModal.medicines.filter(m => m.selected).length}/{billModal.medicines.length} selected)</span>
                  </div>
                  <span className="font-bold text-amber-700">{curr} {billCalculations.pharmacyTotal.toLocaleString()}</span>
                </div>
                <div className="p-3 space-y-2">
                  {billModal.medicines.map((med, idx) => (
                    <label key={idx} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${med.selected ? 'bg-white border border-amber-200' : 'bg-slate-50 border border-slate-200 opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={med.selected}
                          onChange={e => {
                            const newMeds = [...billModal.medicines];
                            newMeds[idx] = { ...newMeds[idx], selected: e.target.checked };
                            setBillModal({ ...billModal, medicines: newMeds });
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <span className={`text-sm ${med.selected ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{med.name}</span>
                          <span className="text-xs text-slate-500 ml-2">({med.dosage}, {med.duration}, {med.frequency})</span>
                        </div>
                      </div>
                      <span className={`font-semibold text-sm ${med.selected ? 'text-amber-700' : 'text-slate-400'}`}>{curr} {med.price.toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Medicines hidden by Super Admin */}
            {billModal.medicines.length > 0 && (settings?.receptionCanCollectPharmacy === false) && (
              <div className="border border-slate-200 rounded-lg mb-3 p-3 bg-slate-100">
                <p className="text-sm text-slate-500 text-center">
                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Pharmacy payment collection is disabled by Super Admin. Patients will pay directly at Pharmacy.
                </p>
              </div>
            )}

            {/* Total Section */}
            <div className="bg-slate-800 rounded-xl p-4 text-white">
              <div className="space-y-2">
                {billCalculations.labTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Lab Tests</span>
                    <span>{curr} {billCalculations.labTotal.toLocaleString()}</span>
                  </div>
                )}
                {billCalculations.xrayTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>X-Ray</span>
                    <span>{curr} {billCalculations.xrayTotal.toLocaleString()}</span>
                  </div>
                )}
                {billCalculations.usgTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Ultrasound</span>
                    <span>{curr} {billCalculations.usgTotal.toLocaleString()}</span>
                  </div>
                )}
                {billCalculations.pharmacyTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Medicines / Pharmacy</span>
                    <span>{curr} {billCalculations.pharmacyTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold border-t border-slate-600 pt-2 mt-2">
                  <span>GRAND TOTAL</span>
                  <span>{curr} {billCalculations.grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleReceivePayment}
                disabled={billCalculations.grandTotal === 0}
                className="btn btn-success btn-lg flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Receive Payment & Print Receipt ({curr} {billCalculations.grandTotal.toLocaleString()})
              </button>
              <button onClick={() => setBillModal(null)} className="btn btn-outline btn-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RECEIPT MODAL ===== */}
      {receiptBill && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Payment Receipt</h3>
              <button onClick={() => setReceiptBill(null)} className="btn btn-outline btn-sm">Close</button>
            </div>
            <iframe
              srcDoc={getReceiptHtml(receiptBill)}
              style={{ width: '100%', height: '600px', border: 'none' }}
              title="Receipt"
            />
          </div>
        </div>
      )}

      {/* ===== NEW VISIT MODAL ===== */}
      {visitPatient && (
        <div className="modal-overlay" onClick={() => setVisitPatient(null)}>
          <div className="modal-content" style={{ maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">New Visit</h3>
                <p className="text-sm text-blue-600 font-mono">{visitPatient.patientNo} - {visitPatient.name}</p>
              </div>
              <button onClick={() => setVisitPatient(null)} className="btn btn-outline btn-sm">Close</button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <p><span className="text-slate-500">Father/Husband:</span> <strong>{visitPatient.fatherName}</strong></p>
              <p><span className="text-slate-500">Mobile:</span> <strong>{visitPatient.mobile}</strong></p>
              <p><span className="text-slate-500">Total Previous Visits:</span> <strong>{visitPatient.totalVisits}</strong></p>
              <p><span className="text-slate-500">Last Visit:</span> <strong>{visitPatient.lastVisit}</strong></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label">Select Department *</label>
                <select className="form-input" value={visitDept} onChange={e => { setVisitDept(e.target.value); setVisitDoctor(''); }}>
                  <option value="">-- Select Department --</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Select Doctor *</label>
                <select className="form-input" value={visitDoctor} onChange={e => setVisitDoctor(e.target.value)} disabled={!visitDept}>
                  <option value="">-- Select Doctor --</option>
                  {visitDept && filteredDoctors(visitDept).map(d => (
                    <option key={d.id} value={d.name}>{d.name} - {curr} {d.fee.toLocaleString()} ({d.timing})</option>
                  ))}
                </select>
              </div>
              {visitDoctor && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-blue-700">Doctor Fee:</span>
                  <span className="font-bold text-blue-700 text-lg">{curr} {selectedDoctorData(visitDoctor)?.fee.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handleNewVisit} className="btn btn-success btn-lg flex-1">Create Visit & Print Card</button>
              <button onClick={() => setVisitPatient(null)} className="btn btn-outline btn-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== EDIT PATIENT MODAL ===== */}
      {editingPatient && (
        <div className="modal-overlay" onClick={() => setEditingPatient(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Edit Patient - {editingPatient.patientNo}</h3>
              <button onClick={() => setEditingPatient(null)} className="btn btn-outline btn-sm">Close</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label">Patient Name *</label>
                <input className="form-input" value={editingPatient.name} onChange={e => setEditingPatient({...editingPatient, name: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Father / Husband Name *</label>
                <input className="form-input" value={editingPatient.fatherName} onChange={e => setEditingPatient({...editingPatient, fatherName: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Mobile *</label>
                  <input className="form-input" value={editingPatient.mobile} onChange={e => setEditingPatient({...editingPatient, mobile: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Age *</label>
                  <input className="form-input" value={editingPatient.age} onChange={e => setEditingPatient({...editingPatient, age: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="form-label">Gender</label>
                <select className="form-input" value={editingPatient.gender} onChange={e => setEditingPatient({...editingPatient, gender: e.target.value})}>
                  <option>Male</option><option>Female</option>
                </select>
              </div>
              <div>
                <label className="form-label">Address *</label>
                <input className="form-input" value={editingPatient.address} onChange={e => setEditingPatient({...editingPatient, address: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleEditSave} className="btn btn-primary btn-lg">Save Changes</button>
                <button onClick={() => setEditingPatient(null)} className="btn btn-outline btn-lg">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
