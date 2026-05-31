'use client';
import { useState, useEffect, useCallback } from 'react';
import { getPatients, searchPatients, getPatientCounter, todayStr, getVisitsByPatient, getBillsByPatient } from '@/lib/store';
import type { Patient, Visit, Bill } from '@/lib/types';

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [viewPatient, setViewPatient] = useState<Patient | null>(null);
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [patientBills, setPatientBills] = useState<Bill[]>([]);

  const loadData = useCallback(() => {
    const all = getPatients();
    setPatients(all);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const today = todayStr();
  const totalPatients = patients.length;
  const activeCards = patients.filter(p => p.cardStatus === 'Active').length;
  const todayNew = patients.filter(p => p.regDate === today).length;

  const displayed = search ? searchPatients(search) : patients;

  const handleView = (p: Patient) => {
    setViewPatient(p);
    setPatientVisits(getVisitsByPatient(p.id));
    setPatientBills(getBillsByPatient(p.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">All Patients</h2>
          <p className="text-sm text-slate-500">{totalPatients} total registered patients</p>
        </div>
        <div className="w-80">
          <input className="form-input" placeholder="Search by name, number, or mobile..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Total Patients</p>
          <p className="text-2xl font-bold text-blue-700">{totalPatients}</p>
        </div>
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Active Cards</p>
          <p className="text-2xl font-bold text-emerald-700">{activeCards}</p>
        </div>
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Today&apos;s New Patients</p>
          <p className="text-2xl font-bold text-amber-700">{todayNew}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="data-table">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th>Patient No</th><th>Name</th><th>Father Name</th><th>Age</th><th>Gender</th><th>Mobile</th><th>Card Status</th><th>Total Visits</th><th>Last Visit</th><th>Reg. Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr><td colSpan={11} className="text-center text-slate-400 py-8">No patients found</td></tr>
              )}
              {displayed.map(p => (
                <tr key={p.id}>
                  <td className="font-mono font-bold text-blue-600">{p.patientNo}</td>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.fatherName}</td>
                  <td>{p.age}</td>
                  <td>{p.gender}</td>
                  <td className="font-mono">{p.mobile}</td>
                  <td><span className={`badge ${p.cardStatus === 'Active' ? 'badge-green' : 'badge-red'}`}>{p.cardStatus}</span></td>
                  <td className="text-center">{p.totalVisits}</td>
                  <td>{p.lastVisit}</td>
                  <td>{p.regDate}</td>
                  <td>
                    <button onClick={() => handleView(p)} className="btn btn-outline btn-sm">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Details Modal */}
      {viewPatient && (
        <div className="modal-overlay" onClick={() => setViewPatient(null)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Patient Details</h3>
              <button onClick={() => setViewPatient(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Patient No</p>
                <p className="font-mono font-bold text-blue-600">{viewPatient.patientNo}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Full Name</p>
                <p className="font-semibold">{viewPatient.name}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Father/Husband Name</p>
                <p>{viewPatient.fatherName}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Age / Gender</p>
                <p>{viewPatient.age} / {viewPatient.gender}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Mobile</p>
                <p className="font-mono">{viewPatient.mobile}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Address</p>
                <p>{viewPatient.address}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Card Status</p>
                <span className={`badge ${viewPatient.cardStatus === 'Active' ? 'badge-green' : 'badge-red'}`}>{viewPatient.cardStatus}</span>
                {viewPatient.cardExpiry && <p className="text-xs text-slate-400 mt-1">Exp: {viewPatient.cardExpiry}</p>}
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Total Visits</p>
                <p className="font-semibold text-lg">{viewPatient.totalVisits}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Last Visit</p>
                <p>{viewPatient.lastVisit}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Registration Date</p>
                <p>{viewPatient.regDate}</p>
              </div>
            </div>

            {/* Visit History */}
            {patientVisits.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-slate-700 mb-2">Visit History</h4>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="data-table">
                    <thead className="sticky top-0 bg-white">
                      <tr><th>Date</th><th>Doctor</th><th>Department</th><th>Diagnosis</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {patientVisits.map(v => (
                        <tr key={v.id}>
                          <td className="whitespace-nowrap">{v.date} {v.time}</td>
                          <td>{v.doctor}</td>
                          <td>{v.department}</td>
                          <td className="text-sm">{v.diagnosis}</td>
                          <td><span className={`badge ${v.status === 'Active' ? 'badge-green' : v.status === 'Completed' ? 'badge-blue' : 'badge-amber'}`}>{v.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bill History */}
            {patientBills.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">Bill History</h4>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="data-table">
                    <thead className="sticky top-0 bg-white">
                      <tr><th>Date</th><th>Total</th><th>Paid</th><th>Status</th><th>Method</th></tr>
                    </thead>
                    <tbody>
                      {patientBills.map(b => (
                        <tr key={b.id}>
                          <td>{b.date}</td>
                          <td>Rs. {b.totalAmount.toLocaleString()}</td>
                          <td className="text-emerald-600">Rs. {b.paidAmount.toLocaleString()}</td>
                          <td><span className={`badge ${b.status === 'Paid' ? 'badge-green' : b.status === 'Unpaid' ? 'badge-red' : 'badge-amber'}`}>{b.status}</span></td>
                          <td>{b.paymentMethod}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button onClick={() => setViewPatient(null)} className="btn btn-outline w-full mt-4">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
