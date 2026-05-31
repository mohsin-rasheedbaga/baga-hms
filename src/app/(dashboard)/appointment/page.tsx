'use client';
import { useState, useEffect } from 'react';
import {
  searchPatients, getPatientByNo, getPatients,
  addAppointment, getAppointments, updateAppointment, getTodayAppointments,
  genId, todayStr, timeStr,
} from '@/lib/store';
import type { Patient, Appointment } from '@/lib/types';

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

/* ========== HELPER: get tomorrow as YYYY-MM-DD ========== */
function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/* ========== STATUS BADGE HELPER ========== */
function statusBadge(status: Appointment['status']) {
  switch (status) {
    case 'Scheduled': return <span className="badge badge-blue">Scheduled</span>;
    case 'Completed': return <span className="badge badge-green">Completed</span>;
    case 'Cancelled': return <span className="badge badge-red">Cancelled</span>;
    default: return null;
  }
}

/* ========== MAIN COMPONENT ========== */
export default function AppointmentPage() {
  // Data
  const [appointments, setAppointmentsState] = useState<Appointment[]>([]);
  const [todayApts, setTodayApts] = useState<Appointment[]>([]);

  // UI State
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [printContent, setPrintContent] = useState<string | null>(null);

  // Patient search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searched, setSearched] = useState(false);

  // Form
  const [form, setForm] = useState({
    department: '',
    doctor: '',
    date: '',
    time: '',
    purpose: '',
  });

  // Load data
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setAppointmentsState(getAppointments());
    setTodayApts(getTodayAppointments());
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredDoctors = DEPARTMENTS.includes(form.department)
    ? DOCTORS.filter(d => d.dept === form.department)
    : [];

  // ========== SEARCH PATIENT ==========
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      showToast('Enter card number or mobile number to search', 'error');
      return;
    }
    const q = searchQuery.trim();
    const results = searchPatients(q);
    setSearchResults(results);
    setSearched(true);
    setSelectedPatient(null);
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    setSearched(false);
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    setSearchQuery('');
    setSearched(false);
    setSearchResults([]);
  };

  // ========== BOOK APPOINTMENT ==========
  const handleBook = () => {
    if (!selectedPatient) {
      showToast('Please search and select a patient first', 'error');
      return;
    }
    if (!form.department) {
      showToast('Please select a department', 'error');
      return;
    }
    if (!form.doctor) {
      showToast('Please select a doctor', 'error');
      return;
    }
    if (!form.date) {
      showToast('Please select an appointment date', 'error');
      return;
    }
    if (!form.time) {
      showToast('Please select an appointment time', 'error');
      return;
    }

    addAppointment({
      id: genId(),
      patientId: selectedPatient.id,
      patientNo: selectedPatient.patientNo,
      patientName: selectedPatient.name,
      department: form.department,
      doctor: form.doctor,
      appointmentDate: form.date,
      appointmentTime: form.time,
      purpose: form.purpose.trim(),
      status: 'Scheduled',
      createdAt: todayStr(),
    });

    setForm({ department: '', doctor: '', date: '', time: '', purpose: '' });
    setSelectedPatient(null);
    setSearchQuery('');
    refreshData();
    showToast(`Appointment booked for ${selectedPatient.name} with ${form.doctor}`, 'success');
  };

  // ========== COMPLETE / CANCEL ==========
  const handleComplete = (id: string) => {
    updateAppointment(id, { status: 'Completed' });
    refreshData();
    showToast('Appointment marked as completed', 'success');
  };

  const handleCancel = (id: string) => {
    updateAppointment(id, { status: 'Cancelled' });
    refreshData();
    showToast('Appointment cancelled', 'success');
  };

  // ========== PRINT SLIP ==========
  const handlePrintSlip = (apt: Appointment) => {
    const doc = DOCTORS.find(d => d.name === apt.doctor);
    const hospital = JSON.parse(localStorage.getItem('baga_hospital') || '{}');
    const curr = hospital.currency || 'Rs.';
    const slipHtml = `
      <html><head><title>Appointment Slip - ${apt.patientNo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; }
        .slip {
          border: 2px solid #1e293b;
          border-radius: 12px;
          padding: 24px 20px;
          max-width: 400px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          border-bottom: 2px dashed #1e293b;
          padding-bottom: 14px;
          margin-bottom: 14px;
        }
        .header h1 { color: #1e293b; font-size: 20px; }
        .header p { color: #64748b; font-size: 11px; margin-top: 2px; }
        .slip-title {
          text-align: center;
          font-size: 16px;
          font-weight: 700;
          color: #2563eb;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 16px;
          font-size: 12px;
          margin-bottom: 14px;
          padding-bottom: 14px;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-grid .label { color: #64748b; }
        .info-grid .value { color: #1e293b; font-weight: 600; }
        .detail-box {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 14px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-size: 12px;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child { border-bottom: none; }
        .detail-row .dl { color: #64748b; }
        .detail-row .dv { color: #1e293b; font-weight: 600; }
        .fee-box {
          text-align: center;
          background: #1e293b;
          color: white;
          border-radius: 8px;
          padding: 10px;
          margin-bottom: 14px;
        }
        .fee-box .fee-label { font-size: 11px; color: #94a3b8; }
        .fee-box .fee-amount { font-size: 22px; font-weight: 700; margin-top: 2px; }
        .status-box {
          text-align: center;
          border: 2px solid #2563eb;
          border-radius: 8px;
          padding: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #2563eb;
          background: #eff6ff;
        }
        .footer {
          text-align: center;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 2px dashed #1e293b;
        }
        .footer p { font-size: 10px; color: #64748b; }
        .footer .thank { font-size: 12px; color: #1e293b; font-weight: 600; margin-top: 4px; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>
        <div class="slip">
          <div class="header">
            <h1>${hospital.name || 'BAGA Hospital'}</h1>
            <p>${hospital.address || 'Main Road, City'} | ${hospital.phone || ''}</p>
            <p>License: ${hospital.licenseNo || 'BAGA-LIC-0001'}</p>
          </div>
          <div class="slip-title">Appointment Slip</div>
          <div class="info-grid">
            <div><span class="label">Patient:</span><br/><span class="value">${apt.patientName}</span></div>
            <div><span class="label">Patient No:</span><br/><span class="value">${apt.patientNo}</span></div>
            <div><span class="label">Appt ID:</span><br/><span class="value">${apt.id.toUpperCase()}</span></div>
            <div><span class="label">Booked On:</span><br/><span class="value">${apt.createdAt}</span></div>
          </div>
          <div class="detail-box">
            <div class="detail-row"><span class="dl">Department</span><span class="dv">${apt.department}</span></div>
            <div class="detail-row"><span class="dl">Doctor</span><span class="dv">${apt.doctor}</span></div>
            <div class="detail-row"><span class="dl">Doctor Timing</span><span class="dv">${doc?.timing || 'N/A'}</span></div>
            <div class="detail-row"><span class="dl">Appointment Date</span><span class="dv">${apt.appointmentDate}</span></div>
            <div class="detail-row"><span class="dl">Appointment Time</span><span class="dv">${apt.appointmentTime}</span></div>
            ${apt.purpose ? `<div class="detail-row"><span class="dl">Purpose</span><span class="dv">${apt.purpose}</span></div>` : ''}
          </div>
          ${doc ? `
          <div class="fee-box">
            <div class="fee-label">Consultation Fee</div>
            <div class="fee-amount">${curr} ${doc.fee.toLocaleString()}</div>
          </div>` : ''}
          <div class="status-box">Status: ${apt.status}</div>
          <div class="footer">
            <p>Please arrive 10 minutes before your appointment time.</p>
            <p class="thank">Thank you for choosing ${hospital.name || 'BAGA Hospital'}!</p>
          </div>
        </div>
        <script>window.onload=function(){window.print();}</script>
      </body></html>
    `;
    setPrintContent(slipHtml);
  };

  // ========== TODAY'S APPOINTMENTS DATA ==========
  const todayScheduled = todayApts;
  const todayAll = appointments.filter(a => a.appointmentDate === todayStr());

  // ========== RENDER ==========
  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.msg}
        </div>
      )}

      {/* Print Slip Modal */}
      {printContent && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-slate-800">Appointment Slip</h3>
              <button onClick={() => setPrintContent(null)} className="btn btn-outline btn-sm">Close</button>
            </div>
            <iframe srcDoc={printContent} style={{ width: '100%', height: '650px', border: 'none' }} title="Appointment Slip" />
          </div>
        </div>
      )}

      {/* ===== BOOK NEW APPOINTMENT ===== */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-1">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Book New Appointment
          </span>
        </h2>
        <p className="text-sm text-slate-500 mb-5">Search patient by card number or mobile, then fill in appointment details.</p>

        {/* Patient Search */}
        <div className="mb-5">
          <label className="form-label">Search Patient (Card No. or Mobile)</label>
          {selectedPatient ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex-1">
                <span className="font-mono font-bold text-blue-600 text-lg">{selectedPatient.patientNo}</span>
                <span className="mx-2 text-slate-300">|</span>
                <span className="font-semibold text-slate-800">{selectedPatient.name}</span>
                <span className="mx-2 text-slate-300">|</span>
                <span className="text-sm text-slate-500">{selectedPatient.mobile}</span>
              </div>
              <button onClick={handleClearPatient} className="btn btn-outline btn-sm">Change</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                className="form-input flex-1"
                placeholder="Enter card number (BAGA-0001) or mobile number..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearched(false); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} className="btn btn-primary">Search</button>
            </div>
          )}

          {/* Search Results */}
          {searched && searchResults.length > 0 && (
            <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPatient(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-slate-100 last:border-b-0"
                >
                  <span className="font-mono font-bold text-blue-600">{p.patientNo}</span>
                  <span className="font-semibold text-slate-800">{p.name}</span>
                  <span className="text-sm text-slate-500">({p.gender}, {p.age})</span>
                  <span className="text-sm text-slate-400 ml-auto">{p.mobile}</span>
                </button>
              ))}
            </div>
          )}
          {searched && searchResults.length === 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              No patient found. Please check the card number or mobile number and try again.
            </div>
          )}
        </div>

        {/* Appointment Form */}
        {selectedPatient && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Department *</label>
              <select
                className="form-input"
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value, doctor: '' })}
              >
                <option value="">-- Select Department --</option>
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Doctor *</label>
              <select
                className="form-input"
                value={form.doctor}
                onChange={e => setForm({ ...form, doctor: e.target.value })}
                disabled={!form.department}
              >
                <option value="">-- Select Doctor --</option>
                {filteredDoctors.map(d => (
                  <option key={d.id} value={d.name}>
                    {d.name} ({d.timing})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Appointment Date *</label>
              <input
                type="date"
                className="form-input"
                min={getTomorrow()}
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Appointment Time *</label>
              <input
                type="time"
                className="form-input"
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Purpose (Reason for Visit)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Follow-up, Consultation..."
                value={form.purpose}
                onChange={e => setForm({ ...form, purpose: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <button onClick={handleBook} className="btn btn-success btn-lg w-full">
                <svg className="w-5 h-5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Book Appointment
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== TODAY'S APPOINTMENTS ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Today&apos;s Appointments
              <span className="badge badge-blue">{todayAll.length}</span>
            </span>
          </h2>
          <span className="text-sm text-slate-500">{todayStr()}</span>
        </div>

        {todayAll.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">No appointments scheduled for today.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Card No.</th>
                  <th>Department</th>
                  <th>Doctor</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {todayAll.map((apt, idx) => (
                  <tr key={apt.id}>
                    <td className="font-mono text-sm">{idx + 1}</td>
                    <td className="font-semibold">{apt.appointmentTime}</td>
                    <td>
                      <div className="font-semibold text-slate-800">{apt.patientName}</div>
                    </td>
                    <td className="font-mono text-blue-600 text-sm">{apt.patientNo}</td>
                    <td><span className="badge badge-purple">{apt.department}</span></td>
                    <td className="text-sm">{apt.doctor}</td>
                    <td className="text-sm text-slate-600 max-w-[150px] truncate">{apt.purpose || '-'}</td>
                    <td>{statusBadge(apt.status)}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {apt.status === 'Scheduled' && (
                          <>
                            <button onClick={() => handleComplete(apt.id)} className="btn btn-success btn-sm" title="Mark Complete">
                              Complete
                            </button>
                            <button onClick={() => handleCancel(apt.id)} className="btn btn-danger btn-sm" title="Cancel">
                              Cancel
                            </button>
                          </>
                        )}
                        <button onClick={() => handlePrintSlip(apt)} className="btn btn-outline btn-sm" title="Print Slip">
                          Print Slip
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== ALL APPOINTMENTS ===== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              All Appointments
              <span className="badge badge-amber">{appointments.length}</span>
            </span>
          </h2>
        </div>

        {appointments.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No appointments booked yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Appt Date</th>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Card No.</th>
                  <th>Department</th>
                  <th>Doctor</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Booked On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Show newest first */}
                {[...appointments].reverse().map((apt, idx) => (
                  <tr key={apt.id}>
                    <td className="font-mono text-sm">{appointments.length - idx}</td>
                    <td className="font-semibold">{apt.appointmentDate}</td>
                    <td className="font-semibold">{apt.appointmentTime}</td>
                    <td>
                      <div className="font-semibold text-slate-800">{apt.patientName}</div>
                    </td>
                    <td className="font-mono text-blue-600 text-sm">{apt.patientNo}</td>
                    <td><span className="badge badge-purple">{apt.department}</span></td>
                    <td className="text-sm">{apt.doctor}</td>
                    <td className="text-sm text-slate-600 max-w-[120px] truncate">{apt.purpose || '-'}</td>
                    <td>{statusBadge(apt.status)}</td>
                    <td className="text-xs text-slate-400">{apt.createdAt}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {apt.status === 'Scheduled' && (
                          <>
                            <button onClick={() => handleComplete(apt.id)} className="btn btn-success btn-sm" title="Mark Complete">
                              Complete
                            </button>
                            <button onClick={() => handleCancel(apt.id)} className="btn btn-danger btn-sm" title="Cancel">
                              Cancel
                            </button>
                          </>
                        )}
                        <button onClick={() => handlePrintSlip(apt)} className="btn btn-outline btn-sm" title="Print Slip">
                          Print Slip
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
