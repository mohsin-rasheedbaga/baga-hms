'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getActiveAdmissions, getAdmissions, getBillsByPatient, getVisitsByPatient,
  getPrescriptionsByPatient, getLabOrdersByPatient,
  getHospitalSettings, getRoomTypeById,
  genId, todayStr, timeStr,
  addPrescription, addLabOrder, searchMedicines, updateVisit,
} from '@/lib/store';
import type { Admission, Visit, Prescription, LabOrder } from '@/lib/types';

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

function calcDays(admittedAt: string, dischargedAt?: string): number {
  const start = new Date(admittedAt);
  const end = dischargedAt ? new Date(dischargedAt) : new Date();
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function AdmittedPatientsPage() {
  const [session, setSession] = useState<{ userId: string; name: string; role: string; department: string } | null>(null);
  const [admittedPatients, setAdmittedPatients] = useState<Admission[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [currency, setCurrency] = useState('Rs.');

  // Expanded admission detail view
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'prescriptions' | 'lab' | 'notes'>('overview');

  // Quick add prescription for admitted patient
  const [rxMeds, setRxMeds] = useState<{ name: string; form: string; strength: string; qtyPerDay: string; timing: string; duration: string; instructions: string; price: number }[]>([]);
  const [rxNotes, setRxNotes] = useState('');
  const [rxSearchQuery, setRxSearchQuery] = useState('');
  const [rxSearchResults, setRxSearchResults] = useState<{ id: string; name: string; form: string; strength: string; price: number }[]>([]);

  // Quick add lab order for admitted patient
  const [selectedLabTests, setSelectedLabTests] = useState<string[]>([]);

  // Diagnosis / notes for admitted patient
  const [diagnosis, setDiagnosis] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [patientPrescriptions, setPatientPrescriptions] = useState<Prescription[]>([]);
  const [patientLabOrders, setPatientLabOrders] = useState<LabOrder[]>([]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshData = useCallback(() => {
    // Show all admitted patients
    const all = getAdmissions().filter(a => a.status === 'Admitted');
    setAdmittedPatients(all);
    const settings = getHospitalSettings();
    setCurrency(settings.currency);
  }, []);

  useEffect(() => {
    try {
      const s = localStorage.getItem('baga_session');
      if (s) setSession(JSON.parse(s));
    } catch {}
    refreshData();

    // Auto-refresh every 5 seconds to catch updates from reception
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const doctorName = session?.name || 'Doctor';
  const doctorDept = session?.department || 'General';

  // ──────────── View Patient Details ────────────
  const viewPatient = (adm: Admission) => {
    setSelectedAdmission(adm);
    setDetailTab('overview');
    setRxMeds([]);
    setRxNotes('');
    setRxSearchQuery('');
    setRxSearchResults([]);
    setSelectedLabTests([]);
    setDiagnosis('');
    setDoctorNotes('');

    // Load patient data
    const visits = getVisitsByPatient(adm.patientId);
    setPatientVisits(visits);
    const activeVisit = visits.find(v => v.status === 'Active');
    if (activeVisit) {
      setDiagnosis(activeVisit.diagnosis || '');
      setDoctorNotes(activeVisit.notes || '');
    }

    setPatientPrescriptions(getPrescriptionsByPatient(adm.patientId));
    setPatientLabOrders(getLabOrdersByPatient(adm.patientId));
  };

  // ──────────── Quick Order Lab ────────────
  const orderLabTests = () => {
    if (!selectedAdmission || selectedLabTests.length === 0) { showToast('Select tests first', 'error'); return; }
    const orderId = genId();
    addLabOrder({
      id: orderId,
      visitId: patientVisits.find(v => v.status === 'Active')?.id || '',
      patientId: selectedAdmission.patientId,
      patientNo: selectedAdmission.patientNo,
      patientName: selectedAdmission.patientName,
      tests: selectedLabTests.map(t => ({ testName: t, price: 0, selected: true })),
      orderedBy: doctorName,
      date: todayStr(),
      time: timeStr(),
      status: 'Pending',
      results: [],
    });
    setSelectedLabTests([]);
    setPatientLabOrders(getLabOrdersByPatient(selectedAdmission.patientId));
    showToast(`${selectedLabTests.length} lab test(s) ordered!`, 'success');
  };

  const toggleLabTest = (test: string) => {
    setSelectedLabTests(prev => prev.includes(test) ? prev.filter(t => t !== test) : [...prev, test]);
  };

  // ──────────── Medicine Search ────────────
  const handleMedSearch = (q: string) => {
    setRxSearchQuery(q);
    if (q.trim().length > 1) {
      setRxSearchResults(searchMedicines(q.trim()).map((m: any) => ({ id: m.id, name: m.name, form: m.form, strength: m.strength, price: m.price })));
    } else {
      setRxSearchResults([]);
    }
  };

  const addMed = (med: { id: string; name: string; form: string; strength: string; price: number }) => {
    setRxMeds(prev => [...prev, { name: med.name, form: med.form, strength: med.strength, qtyPerDay: '1', timing: '', duration: '', instructions: '', price: med.price }]);
    setRxSearchQuery('');
    setRxSearchResults([]);
  };

  const updateRxMed = (idx: number, field: string, value: string) => {
    const u = [...rxMeds];
    u[idx] = { ...u[idx], [field]: value };
    setRxMeds(u);
  };

  const savePrescription = () => {
    if (!selectedAdmission || rxMeds.length === 0) { showToast('Add medicines first', 'error'); return; }
    const activeVisit = patientVisits.find(v => v.status === 'Active');
    addPrescription({
      id: genId(),
      visitId: activeVisit?.id || '',
      patientId: selectedAdmission.patientId,
      patientNo: selectedAdmission.patientNo,
      patientName: selectedAdmission.patientName,
      medicines: rxMeds.map(m => ({ ...m, dosage: `${m.qtyPerDay} ${m.form.toLowerCase()}(s)`, frequency: m.timing, selected: true })),
      prescribedBy: doctorName,
      date: todayStr(),
      time: timeStr(),
      status: 'Active',
      notes: rxNotes,
    });
    setRxMeds([]);
    setRxNotes('');
    setPatientPrescriptions(getPrescriptionsByPatient(selectedAdmission.patientId));
    showToast('Prescription saved!', 'success');
  };

  // ──────────── Purpose Badge ────────────
  const purposeBadge = (purpose: string) => {
    const colors: Record<string, string> = {
      Surgery: 'bg-red-100 text-red-700 border-red-200',
      Emergency: 'bg-red-100 text-red-700 border-red-200',
      ICU: 'bg-red-100 text-red-700 border-red-200',
      Delivery: 'bg-purple-100 text-purple-700 border-purple-200',
      Checkup: 'bg-blue-100 text-blue-700 border-blue-200',
      Observation: 'bg-amber-100 text-amber-700 border-amber-200',
    };
    return <span className={`badge ${colors[purpose] || 'bg-green-100 text-green-700 border-green-200'}`}>{purpose}</span>;
  };

  // ──────────── RENDER ────────────
  return (
    <div className="space-y-5">
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>
      )}

      {/* Page Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-xl p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Admitted Patients
        </h1>
        <p className="text-emerald-200 mt-1">View and manage all currently admitted inpatients. These patients have been confirmed by reception.</p>
      </div>

      {/* Doctor Info */}
      {session && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">{doctorName.charAt(0)}</div>
          <div>
            <p className="font-semibold text-purple-800 text-sm">{doctorName}</p>
            <p className="text-xs text-purple-500">Department: {doctorDept}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card bg-emerald-50 border-emerald-200">
          <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold">Total Admitted</p>
          <p className="text-3xl font-bold text-emerald-700 mt-1">{admittedPatients.length}</p>
        </div>
        <div className="stat-card bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Today Admitted</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{admittedPatients.filter(a => a.admittedAt === todayStr()).length}</p>
        </div>
        <div className="stat-card bg-amber-50 border-amber-200">
          <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">ICU / Surgery</p>
          <p className="text-3xl font-bold text-amber-700 mt-1">{admittedPatients.filter(a => a.purpose === 'ICU' || a.purpose === 'Surgery').length}</p>
        </div>
        <div className="stat-card bg-purple-50 border-purple-200">
          <p className="text-xs text-purple-600 uppercase tracking-wide font-semibold">Rooms Occupied</p>
          <p className="text-3xl font-bold text-purple-700 mt-1">{admittedPatients.filter(a => a.roomNo).length}</p>
        </div>
      </div>

      {/* ──── Detail View Modal ──── */}
      {selectedAdmission && (
        <div className="modal-overlay" onClick={() => setSelectedAdmission(null)}>
          <div className="modal-content max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  <span className="font-mono text-emerald-600">{selectedAdmission.patientNo}</span> - {selectedAdmission.patientName}
                </h3>
                <p className="text-sm text-slate-500">Room: <strong>{selectedAdmission.roomNo}</strong> | Purpose: {purposeBadge(selectedAdmission.purpose)} | Admitted: {selectedAdmission.admittedAt}</p>
              </div>
              <button onClick={() => setSelectedAdmission(null)} className="btn btn-outline btn-sm">Close</button>
            </div>

            {/* Detail Tabs */}
            <div className="border-b border-slate-200 mb-4 flex gap-1">
              {[
                { key: 'overview' as const, label: 'Overview' },
                { key: 'prescriptions' as const, label: 'Medicines' },
                { key: 'lab' as const, label: 'Lab Orders' },
                { key: 'notes' as const, label: 'Notes' },
              ].map(t => (
                <button key={t.key} onClick={() => setDetailTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${detailTab === t.key ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {detailTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Department</p>
                    <p className="font-semibold text-slate-800">{selectedAdmission.department}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Doctor</p>
                    <p className="font-semibold text-slate-800">{selectedAdmission.doctor}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Admission Date</p>
                    <p className="font-semibold text-slate-800">{selectedAdmission.admissionDate}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Days Stayed</p>
                    <p className="font-bold text-amber-700 text-lg">{calcDays(selectedAdmission.admittedAt || selectedAdmission.admissionDate)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <p className="text-xs text-emerald-500">Room No</p>
                    <p className="font-bold text-emerald-700 text-lg">{selectedAdmission.roomNo}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-xs text-amber-500">Room Charges/Night</p>
                    <p className="font-bold text-amber-700">{currency}{(selectedAdmission.roomChargesPerNight || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-xs text-purple-500">Total Room Charges</p>
                    <p className="font-bold text-purple-700">{currency}{((selectedAdmission.roomChargesPerNight || 0) * calcDays(selectedAdmission.admittedAt || selectedAdmission.admissionDate)).toLocaleString()}</p>
                  </div>
                </div>

                {selectedAdmission.notes && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-500 font-semibold">Doctor Notes</p>
                    <p className="text-sm text-blue-800 mt-1">{selectedAdmission.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Medicines Tab */}
            {detailTab === 'prescriptions' && (
              <div className="space-y-4">
                {/* Quick Add Medicine */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-800 text-sm mb-2">Quick Add Prescription</h4>
                  <div className="relative mb-3">
                    <input className="form-input" placeholder="Search medicine name..." value={rxSearchQuery}
                      onChange={e => handleMedSearch(e.target.value)}
                      onFocus={() => { if (rxSearchQuery.trim().length > 1) handleMedSearch(rxSearchQuery); }}
                      onBlur={() => setTimeout(() => setRxSearchResults([]), 200)} />
                    {rxSearchResults.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {rxSearchResults.map(med => (
                          <button key={med.id} onClick={() => addMed(med)} className="w-full flex justify-between px-3 py-2 hover:bg-purple-50 text-sm border-b last:border-b-0">
                            <span className="font-medium">{med.name} <span className="text-slate-400 text-xs">{med.form} {med.strength}</span></span>
                            <span className="font-bold text-purple-700">{currency}{med.price}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {rxMeds.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {rxMeds.map((med, idx) => (
                        <div key={idx} className="bg-white rounded-lg border p-2 flex items-center gap-2">
                          <span className="font-medium text-sm flex-1">{med.name} {med.strength} {med.form}</span>
                          <input className="form-input py-1 text-xs w-14 text-center" type="number" min="1" value={med.qtyPerDay} onChange={e => updateRxMed(idx, 'qtyPerDay', e.target.value)} placeholder="Qty" />
                          <select className="form-input py-1 text-xs" value={med.timing} onChange={e => updateRxMed(idx, 'timing', e.target.value)}>
                            <option value="">Timing</option>
                            {TIMING_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <select className="form-input py-1 text-xs" value={med.duration} onChange={e => updateRxMed(idx, 'duration', e.target.value)}>
                            <option value="">Duration</option>
                            {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <button onClick={() => setRxMeds(rxMeds.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-lg font-bold">&times;</button>
                        </div>
                      ))}
                      <button onClick={savePrescription} className="btn btn-success btn-sm w-full">Save Prescription ({rxMeds.length} medicine{rxMeds.length !== 1 ? 's' : ''})</button>
                    </div>
                  )}
                </div>

                {/* Previous Prescriptions */}
                <h4 className="font-semibold text-sm text-slate-700">Prescription History</h4>
                {patientPrescriptions.length === 0 ? (
                  <p className="text-slate-400 text-center py-4 text-sm">No prescriptions yet</p>
                ) : (
                  patientPrescriptions.map(rx => (
                    <div key={rx.id} className="border border-slate-200 rounded-lg p-3 mb-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">{rx.date} {rx.time} - {rx.prescribedBy}</span>
                        <span className="badge badge-blue">{rx.status}</span>
                      </div>
                      {rx.notes && <p className="text-xs text-slate-400 mt-1 italic">{rx.notes}</p>}
                      <div className="overflow-x-auto mt-2">
                        <table className="data-table">
                          <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Timing</th><th>Duration</th></tr></thead>
                          <tbody>
                            {rx.medicines.map((m, i) => (
                              <tr key={i}>
                                <td className="text-slate-400 text-xs">{i + 1}</td>
                                <td className="font-medium">{m.name}</td>
                                <td>{m.qtyPerDay || m.dosage || '-'}</td>
                                <td>{m.timing || m.frequency || '-'}</td>
                                <td>{m.duration}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Lab Orders Tab */}
            {detailTab === 'lab' && (
              <div className="space-y-4">
                {/* Quick Order Lab */}
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <h4 className="font-semibold text-teal-800 text-sm mb-2">Order Lab Tests</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                    {LAB_TESTS.map(t => (
                      <label key={t} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-all text-xs ${selectedLabTests.includes(t) ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-slate-200 hover:border-teal-400'}`}>
                        <input type="checkbox" checked={selectedLabTests.includes(t)} onChange={() => toggleLabTest(t)} className="sr-only" />
                        <span>{selectedLabTests.includes(t) ? '\u2713 ' : ''}{t}</span>
                      </label>
                    ))}
                  </div>
                  <button onClick={orderLabTests} disabled={selectedLabTests.length === 0} className="btn btn-primary btn-sm bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Order {selectedLabTests.length} Test(s)
                  </button>
                </div>

                {/* Lab Order History */}
                <h4 className="font-semibold text-sm text-slate-700">Lab Order History</h4>
                {patientLabOrders.length === 0 ? (
                  <p className="text-slate-400 text-center py-4 text-sm">No lab orders yet</p>
                ) : (
                  patientLabOrders.map(order => (
                    <div key={order.id} className="border border-slate-200 rounded-lg p-3 mb-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">{order.date} {order.time} - {order.orderedBy}</span>
                        <span className={`badge ${order.status === 'Completed' ? 'badge-green' : 'badge-amber'}`}>{order.status}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {order.tests.map((t, i) => <span key={i} className="badge badge-blue">{t.testName}</span>)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Notes Tab */}
            {detailTab === 'notes' && (
              <div className="space-y-4">
                <div>
                  <label className="form-label">Diagnosis</label>
                  <textarea className="form-input" rows={3} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Enter diagnosis..." />
                </div>
                <div>
                  <label className="form-label">Doctor Notes</label>
                  <textarea className="form-input" rows={4} value={doctorNotes} onChange={e => setDoctorNotes(e.target.value)} placeholder="Enter notes about patient condition..." />
                </div>
                <button onClick={() => {
                  const activeVisit = patientVisits.find(v => v.status === 'Active');
                  if (!activeVisit) { showToast('No active visit found', 'error'); return; }
                  updateVisit(activeVisit.id, { diagnosis, notes: doctorNotes });
                  showToast('Notes saved!', 'success');
                }} className="btn btn-primary w-full">Save Notes</button>

                {/* Previous Visit Notes */}
                {patientVisits.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">Visit History</h4>
                    {patientVisits.map(v => (
                      <div key={v.id} className="border border-slate-200 rounded-lg p-3 mb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500">{v.date} - {v.doctor}</span>
                          <span className={`badge ${v.status === 'Active' ? 'badge-green' : v.status === 'Discharged' ? 'badge-blue' : 'badge-amber'}`}>{v.status}</span>
                        </div>
                        {v.diagnosis && <p className="text-sm text-slate-700 mt-1"><strong>Diagnosis:</strong> {v.diagnosis}</p>}
                        {v.notes && <p className="text-xs text-slate-500 mt-1"><strong>Notes:</strong> {v.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──── Admitted Patients List ──── */}
      <div className="bg-white rounded-xl border-2 border-emerald-200 overflow-hidden">
        <div className="bg-emerald-50 px-5 py-3 border-b border-emerald-200">
          <h3 className="font-bold text-emerald-800">Currently Admitted Patients ({admittedPatients.length})</h3>
          <p className="text-xs text-emerald-600">Only patients whose admission has been confirmed by reception (fee collected & room assigned) are shown here.</p>
        </div>
        {admittedPatients.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <svg className="w-16 h-16 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="font-semibold text-lg">No Admitted Patients</p>
            <p className="text-sm mt-1">When patients are admitted (approved by doctor + processed by reception), they will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Room</th>
                  <th>Patient No</th>
                  <th>Patient Name</th>
                  <th>Department</th>
                  <th>Purpose</th>
                  <th>Admitted On</th>
                  <th>Days</th>
                  <th>Room Charges</th>
                  <th>Doctor Fee</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admittedPatients.map((a, i) => {
                  const days = calcDays(a.admittedAt || a.admissionDate);
                  const rcTotal = (a.roomChargesPerNight || 0) * days;
                  return (
                    <tr key={a.id} className="hover:bg-emerald-50/50 transition-colors">
                      <td className="font-semibold">{i + 1}</td>
                      <td><span className="badge badge-green font-mono text-sm">{a.roomNo || '-'}</span></td>
                      <td><span className="font-mono font-bold text-blue-600">{a.patientNo}</span></td>
                      <td className="font-semibold">{a.patientName}</td>
                      <td className="text-sm">{a.department}</td>
                      <td>{purposeBadge(a.purpose)}</td>
                      <td>{a.admittedAt || a.admissionDate}</td>
                      <td><span className="font-bold text-amber-700">{days}</span></td>
                      <td><span className="font-mono font-bold text-emerald-700">{currency}{rcTotal.toLocaleString()}</span></td>
                      <td><span className="font-mono">{currency}{(a.doctorFee || 0).toLocaleString()}</span></td>
                      <td>
                        <button onClick={() => viewPatient(a)} className="btn btn-primary btn-sm">Manage Patient</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
