'use client';
import { useState, useEffect } from 'react';
import { searchPatients, getPatientByNo, addAdmission, getAdmissionsByPatient, getHospitalSettings, genId, todayStr, timeStr } from '@/lib/store';
import type { Patient, Admission } from '@/lib/types';

export default function DoctorAdmissionPage() {
  const [session, setSession] = useState<{ userId: string; name: string; role: string; department: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Admission form
  const [admissionPurpose, setAdmissionPurpose] = useState('');
  const [admissionDate, setAdmissionDate] = useState('');
  const [admissionNotes, setAdmissionNotes] = useState('');
  const [admissionFee, setAdmissionFee] = useState('');

  // Admission history
  const [admissions, setAdmissions] = useState<Admission[]>([]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    try {
      const s = localStorage.getItem('baga_session');
      if (s) setSession(JSON.parse(s));
    } catch {}
  }, []);

  const doctorName = session?.name || 'Doctor';
  const doctorDept = session?.department || 'General';
  const currency = getHospitalSettings().currency;

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
    setAdmissionPurpose('');
    setAdmissionDate('');
    setAdmissionNotes('');
    setAdmissionFee('');
    setAdmissions(getAdmissionsByPatient(p.id));
  };

  const handleAdmission = () => {
    if (!selectedPatient || !admissionPurpose) {
      showToast('Please select a patient and admission purpose', 'error');
      return;
    }
    const fee = parseFloat(admissionFee) || 0;
    addAdmission({
      id: genId(),
      patientId: selectedPatient.id,
      patientNo: selectedPatient.patientNo,
      patientName: selectedPatient.name,
      department: doctorDept,
      doctor: doctorName,
      doctorFee: fee,
      admissionDate: admissionDate || todayStr(),
      admittedAt: '',
      dischargedAt: '',
      purpose: admissionPurpose,
      roomNo: '',
      roomTypeId: '',
      roomChargesPerNight: 0,
      status: 'Approved',
      notes: admissionNotes,
      createdAt: todayStr(),
      approvedBy: doctorName,
    });
    setAdmissions(getAdmissionsByPatient(selectedPatient.id));
    setAdmissionPurpose('');
    setAdmissionDate('');
    setAdmissionNotes('');
    setAdmissionFee('');
    showToast('Admission Approved! Reception has been notified.', 'success');
  };

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Page Header */}
      <div className="bg-purple-600 rounded-xl p-5 text-white">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          Patient Admission
        </h1>
        <p className="text-purple-200 mt-1">Search for a patient and approve their admission. Department and doctor info are auto-filled from your profile.</p>
      </div>

      {/* Doctor Info Banner */}
      {session && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">{doctorName.charAt(0)}</div>
          <div>
            <p className="font-semibold text-purple-800 text-sm">{doctorName}</p>
            <p className="text-xs text-purple-500">Department: {doctorDept}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border-2 border-purple-200 p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-3">Search Patient - Card Number / Mobile</h2>
        <div className="flex gap-3">
          <input
            className="form-input flex-1 text-lg"
            placeholder="Enter card number (BAGA-0001) or mobile number..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="btn btn-primary btn-lg">Search</button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map(p => (
              <button key={p.id} onClick={() => selectPatient(p)} className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-purple-50 transition-colors text-left">
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

      {/* Admission Form */}
      {selectedPatient ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Patient Banner */}
          <div className="bg-purple-600 text-white p-4">
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-lg">{selectedPatient.patientNo}</span>
              <span className="text-purple-200">{selectedPatient.name}</span>
              <span className="text-sm text-purple-300 ml-2">({selectedPatient.gender}, {selectedPatient.age})</span>
              <span className="text-sm text-purple-300 ml-2">Mobile: {selectedPatient.mobile}</span>
            </div>
            <div className="flex gap-4 mt-1 text-sm text-purple-200">
              <span>Father: {selectedPatient.fatherName}</span>
              <span>Visits: {selectedPatient.totalVisits}</span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Info Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-bold text-amber-800 text-sm uppercase tracking-wide">Patient Admission - Doctor Approval</h3>
              <p className="text-xs text-amber-600 mt-1">Doctor approves admission. Department and doctor name are auto-filled from your profile.</p>
            </div>

            {/* Auto-filled Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500">Department (Auto)</p>
                <p className="font-bold text-purple-700">{doctorDept}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500">Doctor Name (Auto)</p>
                <p className="font-bold text-purple-700">{doctorName}</p>
              </div>
            </div>

            {/* Patient Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-500">Patient</p>
              <p className="font-bold text-blue-800">{selectedPatient.patientNo} - {selectedPatient.name}</p>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Admission Date *</label>
                <input className="form-input" type="date" value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Select the admission date</p>
              </div>
              <div>
                <label className="form-label">Purpose *</label>
                <select className="form-input" value={admissionPurpose} onChange={e => setAdmissionPurpose(e.target.value)}>
                  <option value="">-- Select Purpose --</option>
                  <option>Surgery</option>
                  <option>Checkup</option>
                  <option>Delivery</option>
                  <option>Emergency</option>
                  <option>Observation</option>
                  <option>ICU</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="form-label">Doctor Fee ({currency})</label>
                <input className="form-input" type="number" min="0" placeholder="e.g. 5000" value={admissionFee} onChange={e => setAdmissionFee(e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Admission / surgery fee amount</p>
              </div>
            </div>

            <div>
              <label className="form-label">Doctor Notes</label>
              <textarea className="form-input" rows={3} value={admissionNotes} onChange={e => setAdmissionNotes(e.target.value)} placeholder="Enter admission notes... e.g. type of surgery, reason for admission, etc." />
            </div>

            <button onClick={handleAdmission} className="btn btn-success btn-lg w-full">
              Approve Admission
            </button>
            <p className="text-xs text-center text-slate-400">After approval, reception will be notified to process the admission</p>

            {/* Admission History */}
            {admissions.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <h4 className="font-semibold text-sm mb-2">Patient Admission History</h4>
                <div className="space-y-2">
                  {admissions.map(a => (
                    <div key={a.id} className={`border rounded-lg p-3 ${a.status === 'Approved' ? 'border-amber-200 bg-amber-50' : a.status === 'Admitted' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`}>
                      <div className="flex justify-between">
                        <span className="font-medium">{a.purpose}</span>
                        <span className={`badge ${a.status === 'Approved' ? 'badge-amber' : a.status === 'Admitted' ? 'badge-blue' : 'badge-green'}`}>
                          {a.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        Date: {a.admissionDate} | Dept: {a.department} | Doctor: {a.doctor}
                        {a.roomNo && ` | Room: ${a.roomNo}`}
                        {a.doctorFee > 0 && ` | Fee: ${currency}${a.doctorFee}`}
                      </div>
                      {a.notes && <div className="text-sm text-slate-500 mt-1">Notes: {a.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <svg className="w-16 h-16 mx-auto text-slate-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          <p className="text-slate-400 font-medium">Search for a patient above to start the admission process</p>
          <p className="text-xs text-slate-300 mt-1">Enter a card number or mobile number to find the patient</p>
        </div>
      )}
    </div>
  );
}
