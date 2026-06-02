'use client';
import { useState, useEffect, useRef } from 'react';
import {
  searchPatients, getPatientByNo, getVisitsByPatient, getActiveVisitByPatient,
  getAdmissionsByPatient, updateVisit, updatePatient, updateAdmission,
  getHospitalSettings, getBillsByPatient,
  addPrescription, addLabOrder, searchMedicines,
  genId, todayStr, timeStr,
} from '@/lib/store';
import type { Patient, Visit, Admission, MedicineItem } from '@/lib/types';
import { triggerPrint } from '@/lib/print-utils';

const LAB_TESTS = [
  'CBC', 'Blood Sugar (Fasting)', 'Blood Sugar (Random)',
  'Liver Function Test (LFT)', 'Kidney Function Test (KFT)',
  'Urine Routine', 'Urine Culture', 'Thyroid Panel (T3,T4,TSH)',
  'Lipid Profile', 'HbA1c', 'ESR', 'CRP',
  'HIV', 'Hepatitis B', 'Hepatitis C', 'Dengue NS1',
  'Electrolytes', 'Vitamin D', 'Iron Studies', 'Blood Group', 'PT/INR',
];

const TIMING_OPTIONS = [
  'Before Breakfast', 'After Breakfast', 'Before Lunch', 'After Lunch',
  'Before Dinner', 'After Dinner', 'At Bedtime', 'Every 6 Hours',
  'Every 8 Hours', 'SOS', 'After Meal', 'Before Meal', 'Empty Stomach',
];

const DURATION_OPTIONS = [
  '3 days', '5 days', '7 days', '10 days', '15 days', '30 days', 'As needed',
];

export default function DoctorDischargePage() {
  const [session, setSession] = useState<{ userId: string; name: string; role: string; department: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Patient Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Visit & Admission data
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [activeAdmission, setActiveAdmission] = useState<Admission | null>(null);
  const [allAdmissions, setAllAdmissions] = useState<Admission[]>([]);
  const [visitHistory, setVisitHistory] = useState<Visit[]>([]);

  // Billing
  const [billInfo, setBillInfo] = useState<{ total: number; paid: number; remaining: number }>({ total: 0, paid: 0, remaining: 0 });

  // Discharge form
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [dischargeAdvice, setDischargeAdvice] = useState('');

  // Discharge medicines
  const [dischargeMeds, setDischargeMeds] = useState<{
    name: string; form: string; strength: string; qtyPerDay: string;
    timing: string; duration: string; instructions: string; price: number; selected: boolean;
  }[]>([]);
  const [medSearchQuery, setMedSearchQuery] = useState('');
  const [medSearchResults, setMedSearchResults] = useState<MedicineItem[]>([]);
  const medSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Lab tests
  const [selectedLabTests, setSelectedLabTests] = useState<string[]>([]);

  // Discharge slip
  const [showDischargeSlip, setShowDischargeSlip] = useState(false);
  const [dischargeSlipHtml, setDischargeSlipHtml] = useState('');
  const [discharged, setDischarged] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    try {
      const s = localStorage.getItem('baga_session');
      if (s) setSession(JSON.parse(s)); // eslint-disable-line
    } catch { /* empty */ }
  }, []);

  const doctorName = session?.name || 'Doctor';
  const doctorDept = session?.department || 'General';
  const currency = getHospitalSettings().currency;

  // ──────────── Patient Search ────────────
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const r = searchPatients(searchQuery.trim());
    const byNo = getPatientByNo(searchQuery.trim());
    if (byNo && !r.find(x => x.id === byNo.id)) r.unshift(byNo);
    setSearchResults(r);
  };

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setSearchResults([]);
    setDiagnosis('');
    setNotes('');
    setDischargeNotes('');
    setDischargeAdvice('');
    setDischargeMeds([]);
    setMedSearchQuery('');
    setMedSearchResults([]);
    setSelectedLabTests([]);
    setDischarged(false);
    setShowDischargeSlip(false);
    setDischargeSlipHtml('');

    // Get active visit
    const ev = getActiveVisitByPatient(p.id);
    if (ev) {
      setActiveVisit(ev);
      setDiagnosis(ev.diagnosis || '');
      setNotes(ev.notes || '');
    } else {
      setActiveVisit(null);
    }

    // Get admissions
    const admList = getAdmissionsByPatient(p.id);
    setAllAdmissions(admList);
    const adm = admList.find(a => a.status === 'Admitted') || null;
    setActiveAdmission(adm);

    // Get visit history
    const visits = getVisitsByPatient(p.id);
    setVisitHistory(visits);

    // Check billing
    const bills = getBillsByPatient(p.id);
    const total = bills.reduce((s, b) => s + b.totalAmount, 0);
    const paid = bills.reduce((s, b) => s + b.paidAmount, 0);
    setBillInfo({ total, paid, remaining: total - paid });
  };

  // ──────────── Medicine Search ────────────
  const handleMedSearchChange = (q: string) => {
    setMedSearchQuery(q);
    if (medSearchTimeout.current) clearTimeout(medSearchTimeout.current);
    if (q.trim().length > 1) {
      medSearchTimeout.current = setTimeout(() => {
        setMedSearchResults(searchMedicines(q.trim()));
      }, 200);
    } else {
      setMedSearchResults([]);
    }
  };

  const addMedFromSearch = (med: MedicineItem) => {
    setDischargeMeds(prev => [
      ...prev,
      {
        name: med.name, form: med.form, strength: med.strength,
        qtyPerDay: '1', timing: '', duration: '', instructions: '',
        price: med.price, selected: true,
      },
    ]);
    setMedSearchQuery('');
    setMedSearchResults([]);
  };

  const updateDischargeMed = (idx: number, field: string, value: string) => {
    const u = [...dischargeMeds];
    u[idx] = { ...u[idx], [field]: value };
    setDischargeMeds(u);
  };

  const removeDischargeMed = (idx: number) => {
    setDischargeMeds(prev => prev.filter((_, i) => i !== idx));
  };

  // ──────────── Lab Test Toggle ────────────
  const toggleLabTest = (test: string) => {
    setSelectedLabTests(prev =>
      prev.includes(test) ? prev.filter(t => t !== test) : [...prev, test]
    );
  };

  // ──────────── Execute Discharge ────────────
  const executeDischarge = () => {
    if (!activeVisit || !selectedPatient) {
      showToast('No active visit found for this patient', 'error');
      return;
    }
    if (!activeAdmission || activeAdmission.status !== 'Admitted') {
      showToast('Cannot discharge — patient is not currently admitted. Admission must be confirmed at reception first.', 'error');
      return;
    }
    if (billInfo.remaining > 0) {
      showToast('Cannot discharge — outstanding balance must be cleared first', 'error');
      return;
    }
    if (!confirm(`Discharge ${selectedPatient.name}? This action cannot be undone.`)) return;

    // Save discharge medicines as prescription
    if (dischargeMeds.length > 0) {
      addPrescription({
        id: genId(),
        visitId: activeVisit.id,
        patientId: selectedPatient.id,
        patientNo: selectedPatient.patientNo,
        patientName: selectedPatient.name,
        medicines: dischargeMeds.map(m => ({
          ...m,
          dosage: `${m.qtyPerDay} ${m.form.toLowerCase()}(s)`,
          frequency: m.timing,
        })),
        prescribedBy: doctorName,
        date: todayStr(),
        time: timeStr(),
        status: 'Active',
        notes: `[Discharge Prescription] ${dischargeAdvice || ''}`,
      });
    }

    // Save recommended lab tests
    if (selectedLabTests.length > 0) {
      addLabOrder({
        id: genId(),
        visitId: activeVisit.id,
        patientId: selectedPatient.id,
        patientNo: selectedPatient.patientNo,
        patientName: selectedPatient.name,
        tests: selectedLabTests.map(t => ({ testName: `[Discharge Recommendation] ${t}`, price: 0, selected: true })),
        orderedBy: doctorName,
        date: todayStr(),
        time: timeStr(),
        status: 'Pending',
        results: [],
      });
    }

    // Update visit
    updateVisit(activeVisit.id, { status: 'Discharged', diagnosis, notes });

    // Update patient
    updatePatient(selectedPatient.id, {
      lastVisit: todayStr(),
      totalVisits: selectedPatient.totalVisits + 1,
    });

    // Discharge from admission if admitted
    if (activeAdmission) {
      updateAdmission(activeAdmission.id, {
        status: 'Discharged',
        dischargedAt: todayStr(),
      });
    }

    // Generate discharge slip HTML
    generateDischargeSlip();

    setDischarged(true);
    showToast('Patient discharged successfully! Discharge slip generated.', 'success');
  };

  // ──────────── Discharge Slip ────────────
  const generateDischargeSlip = () => {
    if (!selectedPatient) return;

    const hospital = getHospitalSettings();

    const medRows = dischargeMeds.map((m, i) =>
      `<tr><td>${i + 1}</td><td>${m.name}</td><td>${m.strength} ${m.form}</td><td>${m.qtyPerDay}x daily</td><td>${m.timing || '-'}</td><td>${m.duration || '-'}</td>${m.instructions ? `<td>${m.instructions}</td>` : ''}</tr>`
    ).join('');

    const labList = selectedLabTests.map(t => `<li>${t}</li>`).join('');

    const slip = `<!DOCTYPE html>
<html>
<head>
  <title>Discharge Slip - ${selectedPatient.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; background: #fff; }
    @page { size: A4; margin: 15mm; }
    .header { text-align: center; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 26px; color: #1a1a1a; letter-spacing: 1px; }
    .header .subtitle { margin: 4px 0; color: #666; font-size: 14px; font-weight: 600; }
    .header .tagline { font-size: 11px; color: #999; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 20px; padding: 14px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef; }
    .info-item { font-size: 13px; }
    .info-item span { font-weight: bold; color: #1a1a1a; }
    .divider { border: none; border-top: 2px solid #e9ecef; margin: 20px 0; }
    .section { margin: 20px 0; }
    .section h3 { color: #1a1a1a; border-bottom: 2px solid #7c3aed; padding-bottom: 6px; margin-bottom: 12px; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
    th { background: #7c3aed; color: white; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 7px 10px; border: 1px solid #dee2e6; }
    tr:nth-child(even) { background: #f8f9fa; }
    .lab-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
    .lab-item { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 6px 10px; border-radius: 4px; font-size: 13px; }
    .lab-item::before { content: "\\2713  "; color: #16a34a; font-weight: bold; }
    .notes-box { background: #fefce8; border: 1px solid #fde68a; padding: 14px; border-radius: 8px; font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
    .advice-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 14px; border-radius: 8px; font-size: 13px; line-height: 1.7; white-space: pre-wrap; margin-top: 10px; }
    .signature-area { display: flex; justify-content: space-between; margin-top: 50px; }
    .sig-block { text-align: center; width: 200px; }
    .sig-line { border-top: 1px solid #333; padding-top: 6px; font-size: 12px; color: #1a1a1a; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #e9ecef; padding-top: 10px; }
    .print-btn { position: fixed; top: 15px; right: 15px; padding: 10px 24px; background: #7c3aed; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(124,58,237,0.4); z-index: 999; }
    .print-btn:hover { background: #6d28d9; }
    @media print { body { padding: 0; } @page { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>BAGA Hospital</h1>
    <p class="subtitle">Discharge Summary</p>
    <p class="tagline">${hospital.receiptFooter || 'Quality Healthcare for Everyone'}</p>
  </div>

  <div class="info-grid">
    <div class="info-item"><span>Patient Name:</span> ${selectedPatient.name}</div>
    <div class="info-item"><span>Patient No:</span> ${selectedPatient.patientNo}</div>
    <div class="info-item"><span>Age/Gender:</span> ${selectedPatient.age} / ${selectedPatient.gender}</div>
    <div class="info-item"><span>Father/Husband:</span> ${selectedPatient.fatherName}</div>
    <div class="info-item"><span>Mobile:</span> ${selectedPatient.mobile}</div>
    <div class="info-item"><span>Discharge Date:</span> ${todayStr()}</div>
    <div class="info-item"><span>Department:</span> ${doctorDept}</div>
    <div class="info-item"><span>Doctor:</span> ${doctorName}</div>
    <div class="info-item"><span>Address:</span> ${selectedPatient.address || 'N/A'}</div>
  </div>

  <div class="section">
    <h3>Diagnosis</h3>
    <p style="font-size:13px; line-height:1.6;">${diagnosis || 'N/A'}</p>
  </div>

  ${activeAdmission ? `
  <div class="section">
    <h3>Admission Details</h3>
    <table>
      <tr><th>Purpose</th><th>Room</th><th>Admission Date</th><th>Discharge Date</th></tr>
      <tr>
        <td>${activeAdmission.purpose}</td>
        <td>${activeAdmission.roomNo || 'N/A'}</td>
        <td>${activeAdmission.admissionDate}</td>
        <td>${todayStr()}</td>
      </tr>
    </table>
  </div>` : ''}

  ${dischargeMeds.length > 0 ? `
  <div class="section">
    <h3>Discharge Medicines</h3>
    <table>
      <thead>
        <tr><th>#</th><th>Medicine</th><th>Form / Strength</th><th>Dosage</th><th>Timing</th><th>Duration</th>${dischargeMeds.some(m => m.instructions) ? '<th>Instructions</th>' : ''}</tr>
      </thead>
      <tbody>${medRows}</tbody>
    </table>
  </div>` : ''}

  ${selectedLabTests.length > 0 ? `
  <div class="section">
    <h3>Recommended Follow-up Lab Tests</h3>
    <div class="lab-grid">${labList}</div>
  </div>` : ''}

  <div class="section">
    <h3>Doctor Notes</h3>
    <div class="notes-box">${dischargeNotes || 'No additional notes.'}</div>
  </div>

  ${dischargeAdvice ? `
  <div class="section">
    <h3>Patient Advice (After Discharge)</h3>
    <div class="advice-box">${dischargeAdvice}</div>
  </div>` : ''}

  <div class="signature-area">
    <div class="sig-block">
      <div style="height:60px"></div>
      <div class="sig-line">${doctorName}</div>
      <p style="font-size:11px;color:#666;margin-top:4px">${doctorDept} Department</p>
    </div>
    <div class="sig-block">
      <div style="height:60px"></div>
      <div class="sig-line">Medical Superintendent</div>
      <p style="font-size:11px;color:#666;margin-top:4px">BAGA Hospital</p>
    </div>
  </div>

  <div class="footer">
    <p>This is a computer-generated document. Generated on ${todayStr()} at ${timeStr()}.</p>
    <p>BAGA Hospital &mdash; ${getHospitalSettings().receiptFooter || 'Quality Healthcare for Everyone'}</p>
  </div>
</body>
</html>`;

    setDischargeSlipHtml(slip);
    setShowDischargeSlip(true);
  };

  const printDischargeSlip = () => {
    if (!dischargeSlipHtml) return;
    triggerPrint(dischargeSlipHtml);
  };

  // Patient can only be discharged if: has active visit, not already discharged, AND has confirmed admission (status=Admitted)
  const canDischarge = activeVisit && activeVisit.status === 'Active' && !discharged && activeAdmission && activeAdmission.status === 'Admitted';
  const hasApprovedOnly = activeVisit && activeVisit.status === 'Active' && allAdmissions.some(a => a.status === 'Approved') && !activeAdmission;
  const noAdmission = activeVisit && activeVisit.status === 'Active' && !discharged && allAdmissions.length === 0;

  // ──────────── RENDER ────────────
  return (
    <div className="space-y-5">
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.msg}
        </div>
      )}

      {/* Page Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Patient Discharge
        </h1>
        <p className="text-purple-200 mt-1">Search for a patient, review billing, add discharge medicines &amp; notes, then discharge.</p>
      </div>

      {/* Doctor Info Banner */}
      {session && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {doctorName.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-purple-800 text-sm">{doctorName}</p>
            <p className="text-xs text-purple-500">Department: {doctorDept}</p>
          </div>
        </div>
      )}

      {/* ═══════════ Patient Search ═══════════ */}
      <div className="bg-white rounded-xl border-2 border-purple-200 p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-3">Search Patient &mdash; Card Number / Mobile</h2>
        <div className="flex gap-3">
          <input
            className="form-input flex-1 text-lg"
            placeholder="Enter card number (BAGA-0001) or mobile number..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="btn btn-primary btn-lg">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map(p => (
              <button
                key={p.id}
                onClick={() => selectPatient(p)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-purple-50 transition-colors text-left"
              >
                <div>
                  <span className="font-mono font-bold text-purple-600">{p.patientNo}</span>
                  <span className="font-semibold text-slate-800 ml-3">{p.name}</span>
                  <span className="text-sm text-slate-500 ml-2">({p.gender}, {p.age})</span>
                </div>
                <span className="text-sm text-slate-500">{p.mobile}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════ Empty State ═══════════ */}
      {!selectedPatient && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <svg className="w-20 h-20 mx-auto text-slate-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <p className="text-slate-400 font-semibold text-lg">No Patient Selected</p>
          <p className="text-xs text-slate-300 mt-1">Enter a card number or mobile number above to find a patient and begin the discharge process.</p>
        </div>
      )}

      {/* ═══════════ Patient Panel ═══════════ */}
      {selectedPatient && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Patient Banner */}
          <div className="bg-purple-600 text-white p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-lg">{selectedPatient.patientNo}</span>
                  <span className="text-purple-200 text-lg">{selectedPatient.name}</span>
                  {discharged && <span className="badge badge-green">Discharged</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-purple-200">
                  <span>Father: {selectedPatient.fatherName}</span>
                  <span>Mobile: {selectedPatient.mobile}</span>
                  <span>Age: {selectedPatient.age}/{selectedPatient.gender}</span>
                  <span>Visits: {selectedPatient.totalVisits}</span>
                </div>
              </div>
              {!discharged && activeVisit && activeVisit.status === 'Active' && (
                <span className="badge badge-green">Active Visit</span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* ──── No Active Visit ──── */}
            {!activeVisit && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
                <svg className="w-14 h-14 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-slate-500 font-medium">No active visit found for this patient</p>
                <p className="text-xs text-slate-400 mt-1">The patient does not have an active visit. Please create a visit first.</p>
              </div>
            )}

            {/* ──── Already Discharged ──── */}
            {activeVisit && activeVisit.status === 'Discharged' && !discharged && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                <svg className="w-14 h-14 mx-auto text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-700 font-semibold text-lg">Patient has already been discharged</p>
                <p className="text-xs text-green-500 mt-1">This patient&apos;s visit status is already &quot;Discharged&quot;.</p>
              </div>
            )}

            {/* ──── No Admission At All ──── */}
            {noAdmission && (
              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-8 text-center">
                <svg className="w-16 h-16 mx-auto text-orange-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <p className="text-orange-800 font-bold text-lg">Patient Cannot Be Discharged</p>
                <p className="text-sm text-orange-600 mt-2 font-medium">This patient has no admission record. Only admitted patients can be discharged.</p>
                <p className="text-xs text-orange-400 mt-1">Please admit the patient first through the Patient Admission page, then have reception process the admission.</p>
              </div>
            )}

            {/* ──── Admission Approved But Not Yet Processed ──── */}
            {hasApprovedOnly && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-8 text-center">
                <svg className="w-16 h-16 mx-auto text-amber-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-amber-800 font-bold text-lg">Admission Not Yet Confirmed</p>
                <p className="text-sm text-amber-600 mt-2 font-medium">This patient has a doctor-approved admission but it has not been processed yet.</p>
                <p className="text-xs text-amber-500 mt-1">The reception must collect the admission fee and assign a room before the patient can be discharged. Until then, discharge is blocked.</p>
                <div className="mt-4 bg-white border border-amber-200 rounded-lg p-3 max-w-sm mx-auto text-left">
                  <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-2">Admission Workflow:</p>
                  <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                    <li>Doctor approves admission</li>
                    <li>Reception collects fee & assigns room</li>
                    <li>Patient is officially Admitted</li>
                    <li>Doctor manages treatment</li>
                    <li>Then discharge becomes available</li>
                  </ol>
                </div>
              </div>
            )}

            {/* ──── Active Visit Section ──── */}
            {activeVisit && activeVisit.status === 'Active' && !noAdmission && !hasApprovedOnly && (
              <>
                {/* Active Visit Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-bold text-blue-800 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Active Visit Details
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-slate-500">Visit Date</p>
                      <p className="font-semibold text-slate-800">{activeVisit.date}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-slate-500">Department</p>
                      <p className="font-semibold text-slate-800">{activeVisit.department}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-slate-500">Doctor</p>
                      <p className="font-semibold text-slate-800">{activeVisit.doctor}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-slate-500">Status</p>
                      <span className="badge badge-blue">Active</span>
                    </div>
                  </div>
                </div>

                {/* Active Admission Card */}
                {activeAdmission && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="font-bold text-amber-800 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      Active Admission
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-slate-500">Purpose</p>
                        <p className="font-semibold text-slate-800">{activeAdmission.purpose}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-slate-500">Room</p>
                        <p className="font-semibold text-slate-800">{activeAdmission.roomNo || 'Not assigned'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-slate-500">Admission Date</p>
                        <p className="font-semibold text-slate-800">{activeAdmission.admissionDate}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-slate-500">Status</p>
                        <span className="badge badge-blue">Admitted</span>
                      </div>
                    </div>
                    {activeAdmission.doctorFee > 0 && (
                      <p className="text-sm text-amber-700 mt-3 font-medium">Doctor Fee: <span className="font-bold">{currency}{activeAdmission.doctorFee.toLocaleString()}</span></p>
                    )}
                  </div>
                )}

                {/* ──── Billing Status ──── */}
                <div className={`rounded-lg p-4 ${billInfo.remaining > 0 ? 'border-2 border-red-300 bg-red-50' : 'border-2 border-green-300 bg-green-50'}`}>
                  <h3 className="font-bold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Billing Status
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Total Bill</p>
                      <p className="font-bold text-lg text-slate-800">{currency}{billInfo.total.toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Paid Amount</p>
                      <p className="font-bold text-lg text-green-600">{currency}{billInfo.paid.toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">Remaining</p>
                      <p className={`font-bold text-lg ${billInfo.remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {currency}{billInfo.remaining.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {billInfo.remaining > 0 && (
                    <div className="mt-4 bg-red-100 border border-red-300 rounded-lg p-3 flex items-start gap-2">
                      <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      <div className="text-red-700 text-sm font-semibold">
                        WARNING: Patient has an outstanding balance of <strong>{currency}{billInfo.remaining.toLocaleString()}</strong>. Discharge is <strong>blocked</strong> until the bill is cleared. Please ensure payment is collected.
                      </div>
                    </div>
                  )}
                  {billInfo.remaining <= 0 && (
                    <div className="mt-3 text-green-600 text-sm font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      All bills cleared. Patient is ready for discharge.
                    </div>
                  )}
                </div>

                {/* ──── Diagnosis ──── */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Diagnosis
                  </h3>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                    placeholder="Enter final diagnosis..."
                  />
                </div>

                {/* ──── Discharge Medicines ──── */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    Discharge Medicines
                    <span className="text-xs text-slate-400 font-normal">(optional — prescribe medicines for after discharge)</span>
                  </h3>

                  {/* Medicine Search */}
                  <div className="relative mb-3">
                    <div className="flex items-center gap-2 border-2 border-purple-200 rounded-lg px-3 py-2 bg-white focus-within:border-purple-500 transition-colors">
                      <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        className="flex-1 outline-none text-sm bg-transparent placeholder:text-slate-400"
                        placeholder="Type medicine name, generic name, or category..."
                        value={medSearchQuery}
                        onChange={e => handleMedSearchChange(e.target.value)}
                        onFocus={() => { if (medSearchQuery.trim().length > 1) setMedSearchResults(searchMedicines(medSearchQuery.trim())); }}
                        onBlur={() => setTimeout(() => setMedSearchResults([]), 200)}
                      />
                      {medSearchQuery && (
                        <button onClick={() => { setMedSearchQuery(''); setMedSearchResults([]); }} className="text-slate-400 hover:text-slate-600 shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                    {/* Search Results Dropdown */}
                    {medSearchResults.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                        {medSearchResults.map(med => (
                          <button
                            key={med.id}
                            onClick={() => addMedFromSearch(med)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-50 border-b border-slate-100 last:border-b-0 transition-colors text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-800 text-sm truncate">
                                {med.name} <span className="text-slate-400 font-normal">{med.genericName !== med.name ? `(${med.genericName})` : ''}</span>
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">{med.form} &middot; {med.strength} &middot; {med.packing}</p>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="font-bold text-purple-700">{currency}{med.price}</p>
                              <span className="badge badge-blue text-xs">{med.category}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {medSearchQuery.trim().length > 1 && medSearchResults.length === 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-4 text-center text-slate-400 text-sm">
                        No medicines found matching &ldquo;{medSearchQuery}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Discharge Medicine Table */}
                  {dischargeMeds.length > 0 && (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-xs uppercase text-slate-600">
                            <th className="px-2 py-2 text-left">Medicine</th>
                            <th className="px-2 py-2 text-left">Form</th>
                            <th className="px-2 py-2 text-left">Strength</th>
                            <th className="px-2 py-2 text-center">Qty/Day</th>
                            <th className="px-2 py-2 text-left min-w-[140px]">Timing</th>
                            <th className="px-2 py-2 text-left min-w-[110px]">Duration</th>
                            <th className="px-2 py-2 text-left min-w-[130px]">Instructions</th>
                            <th className="px-2 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {dischargeMeds.map((med, idx) => (
                            <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-2 py-2 font-medium text-slate-800">{med.name}</td>
                              <td className="px-2 py-2 text-slate-600">{med.form}</td>
                              <td className="px-2 py-1 font-mono text-xs text-slate-600">{med.strength}</td>
                              <td className="px-2 py-1">
                                <input
                                  className="form-input py-1 text-sm text-center w-14"
                                  type="number"
                                  min="1"
                                  value={med.qtyPerDay}
                                  onChange={e => updateDischargeMed(idx, 'qtyPerDay', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-1">
                                <select
                                  className="form-input py-1 text-sm"
                                  value={med.timing}
                                  onChange={e => updateDischargeMed(idx, 'timing', e.target.value)}
                                >
                                  <option value="">-- Select --</option>
                                  {TIMING_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-1">
                                <select
                                  className="form-input py-1 text-sm"
                                  value={med.duration}
                                  onChange={e => updateDischargeMed(idx, 'duration', e.target.value)}
                                >
                                  <option value="">-- Select --</option>
                                  {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-1">
                                <input
                                  className="form-input py-1 text-sm"
                                  placeholder="Instructions"
                                  value={med.instructions}
                                  onChange={e => updateDischargeMed(idx, 'instructions', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-1 text-center">
                                <button
                                  onClick={() => removeDischargeMed(idx)}
                                  className="text-red-400 hover:text-red-600 font-bold text-lg leading-none"
                                  title="Remove medicine"
                                >
                                  &times;
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {dischargeMeds.length === 0 && (
                    <p className="text-xs text-slate-400 mt-1">No discharge medicines added yet. Search and add medicines above.</p>
                  )}
                </div>

                {/* ──── Follow-up Lab Test Recommendations ──── */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    Follow-up Lab Test Recommendations
                    <span className="text-xs text-slate-400 font-normal">(optional — tests the patient should do after discharge)</span>
                  </h3>
                  {selectedLabTests.length > 0 && (
                    <div className="mb-3 flex items-center gap-2">
                      <span className="badge badge-purple">{selectedLabTests.length} test(s) selected</span>
                      <button
                        onClick={() => setSelectedLabTests([])}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {LAB_TESTS.map(t => (
                      <label
                        key={t}
                        className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer text-sm transition-colors border ${
                          selectedLabTests.includes(t)
                            ? 'border-purple-400 bg-purple-50 text-purple-800'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded text-purple-600"
                          checked={selectedLabTests.includes(t)}
                          onChange={() => toggleLabTest(t)}
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>

                {/* ──── Discharge Notes & Advice ──── */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Discharge Notes &amp; Advice
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Doctor Notes</label>
                      <textarea
                        className="form-input"
                        rows={4}
                        value={dischargeNotes}
                        onChange={e => setDischargeNotes(e.target.value)}
                        placeholder="Doctor notes for discharge summary..."
                      />
                    </div>
                    <div>
                      <label className="form-label">Patient Advice</label>
                      <textarea
                        className="form-input"
                        rows={4}
                        value={dischargeAdvice}
                        onChange={e => setDischargeAdvice(e.target.value)}
                        placeholder="Advice for the patient after discharge (diet, follow-up, precautions)..."
                      />
                    </div>
                  </div>
                </div>

                {/* ──── Discharge Action ──── */}
                <div className="bg-white border-2 border-slate-200 rounded-lg p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <h3 className="font-bold text-slate-800">Discharge Patient</h3>
                  </div>

                  {/* Summary before discharge */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500">Diagnosis</p>
                      <p className="font-semibold text-sm text-slate-800 truncate">{diagnosis || 'Not set'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500">Medicines</p>
                      <p className="font-semibold text-sm text-slate-800">{dischargeMeds.length > 0 ? `${dischargeMeds.length} prescribed` : 'None'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500">Lab Tests</p>
                      <p className="font-semibold text-sm text-slate-800">{selectedLabTests.length > 0 ? `${selectedLabTests.length} recommended` : 'None'}</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${billInfo.remaining > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <p className="text-xs text-slate-500">Bill Status</p>
                      <p className={`font-semibold text-sm ${billInfo.remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {billInfo.remaining > 0 ? `${currency}${billInfo.remaining.toLocaleString()} due` : 'Cleared'}
                      </p>
                    </div>
                  </div>

                  {/* ── Admission Status Banner ── */}
                  {activeAdmission && activeAdmission.status === 'Admitted' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 mb-4">
                      <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-green-700 text-sm font-medium">Patient is admitted in Room <strong>{activeAdmission.roomNo || 'N/A'}</strong> since {activeAdmission.admittedAt || activeAdmission.admissionDate}. Ready for discharge if bills are clear.</p>
                    </div>
                  )}

                  <button
                    onClick={executeDischarge}
                    disabled={!canDischarge || billInfo.remaining > 0}
                    className={`btn flex-1 text-white text-lg py-3 w-full font-bold transition-colors ${
                      !canDischarge || billInfo.remaining > 0
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                  >
                    {!canDischarge ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Cannot Discharge - Admission Not Confirmed
                      </span>
                    ) : billInfo.remaining > 0 ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Clear Bill Before Discharge ({currency}{billInfo.remaining.toLocaleString()} pending)
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Discharge Patient
                      </span>
                    )}
                  </button>

                  {canDischarge && billInfo.remaining <= 0 && activeAdmission && (
                    <p className="text-xs text-center text-slate-400 mt-2">
                      This will discharge the patient from Room {activeAdmission.roomNo || 'N/A'} and close the admission record.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ──── Discharge Slip Section ──── */}
            {discharged && showDischargeSlip && dischargeSlipHtml && (
              <div className="border-2 border-green-300 bg-green-50 rounded-lg overflow-hidden">
                <div className="bg-green-600 text-white p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div>
                      <h3 className="font-bold text-lg">Patient Discharged Successfully!</h3>
                      <p className="text-green-200 text-sm">Discharge slip is ready below</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={printDischargeSlip}
                      className="bg-white text-green-700 hover:bg-green-100 font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Print Slip
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                    <iframe
                      srcDoc={dischargeSlipHtml}
                      className="w-full"
                      style={{ height: '70vh', border: 'none' }}
                      title="Discharge Slip"
                    />
                  </div>
                  <div className="mt-3 text-center">
                    <button
                      onClick={printDischargeSlip}
                      className="btn btn-primary"
                    >
                      Open in New Window &amp; Print
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ──── Admission History ──── */}
            {allAdmissions.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Admission History
                </h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {allAdmissions.map(a => (
                    <div key={a.id} className={`border rounded-lg p-3 ${
                      a.status === 'Admitted' ? 'border-blue-200 bg-blue-50' :
                      a.status === 'Approved' ? 'border-amber-200 bg-amber-50' :
                      a.status === 'Discharged' ? 'border-green-200 bg-green-50' :
                      'border-slate-200 bg-slate-50'
                    }`}>
                      <div className="flex justify-between">
                        <span className="font-medium">{a.purpose}</span>
                        <span className={`badge ${
                          a.status === 'Admitted' ? 'badge-blue' :
                          a.status === 'Approved' ? 'badge-amber' :
                          a.status === 'Discharged' ? 'badge-green' : ''
                        }`}>
                          {a.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        Date: {a.admissionDate} | Dept: {a.department} | Doctor: {a.doctor}
                        {a.roomNo && ` | Room: ${a.roomNo}`}
                        {a.dischargedAt && ` | Discharged: ${a.dischargedAt}`}
                        {a.doctorFee > 0 && ` | Fee: ${currency}${a.doctorFee}`}
                      </div>
                      {a.notes && <div className="text-sm text-slate-500 mt-1">Notes: {a.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ──── Visit History ──── */}
            {visitHistory.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Visit History
                </h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {visitHistory.map(v => (
                    <div key={v.id} className={`border rounded-lg p-3 ${
                      v.status === 'Active' ? 'border-blue-200 bg-blue-50' :
                      v.status === 'Discharged' ? 'border-green-200 bg-green-50' :
                      'border-slate-200 bg-slate-50'
                    }`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium text-slate-800">{v.date} {v.time}</span>
                          <span className="text-sm text-slate-500 ml-2">- {v.department}</span>
                        </div>
                        <span className={`badge ${
                          v.status === 'Active' ? 'badge-blue' :
                          v.status === 'Discharged' ? 'badge-green' : ''
                        }`}>
                          {v.status}
                        </span>
                      </div>
                      {v.diagnosis && <p className="text-sm text-slate-600 mt-1">Diagnosis: {v.diagnosis}</p>}
                      {v.doctor && <p className="text-xs text-slate-400">Doctor: {v.doctor}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
