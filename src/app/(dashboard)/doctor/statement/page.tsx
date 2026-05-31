'use client';
import { useState, useEffect, useMemo } from 'react';
import { getVisits, getPrescriptions, getLabOrders, getXRayOrders, getUltrasoundOrders, getAdmissionsByPatient, getHospitalSettings, getBills } from '@/lib/store';
import type { Visit, Prescription, LabOrder, Bill } from '@/lib/types';

function dateInRange(dateStr: string, from: string, to: string): boolean {
  if (!dateStr || !from || !to) return false;
  return dateStr >= from && dateStr <= to;
}

export default function DoctorStatementPage() {
  const [session, setSession] = useState<{ userId: string; name: string; role: string; department: string } | null>(null);
  const [currency, setCurrency] = useState('Rs.');

  // Custom date range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    try {
      const s = localStorage.getItem('baga_session');
      if (s) setSession(JSON.parse(s));
    } catch {}
    setCurrency(getHospitalSettings().currency);
  }, []);

  // Set default to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  }, []);

  const stats = useMemo(() => {
    if (!session || !startDate || !endDate) return { visits: [], prescriptions: [], labOrders: [], totalVisits: 0, totalPrescriptions: 0, totalLabOrders: 0, totalDoctorFees: 0, uniquePatients: 0, totalBilled: 0, totalCollected: 0, totalPending: 0, bills: [], paidBills: [], unpaidBills: [] };

    const allVisits = getVisits();
    const allPrescriptions = getPrescriptions();
    const allLabOrders = getLabOrders();
    const allBills = getBills();

    // Filter visits by current doctor and date range
    const doctorVisits = allVisits.filter(v =>
      v.doctor === session.name &&
      dateInRange(v.date, startDate, endDate)
    );

    const doctorPrescriptions = allPrescriptions.filter(p =>
      p.prescribedBy === session.name &&
      dateInRange(p.date, startDate, endDate)
    );

    const doctorLabOrders = allLabOrders.filter(o =>
      o.orderedBy === session.name &&
      dateInRange(o.date, startDate, endDate)
    );

    // Get bills for this doctor's patients in the date range
    const doctorPatientIds = new Set(doctorVisits.map(v => v.patientId));
    const patientBills = allBills.filter(b => doctorPatientIds.has(b.patientId));
    const paidBills = patientBills.filter(b => b.status === 'Paid' || b.status === 'Partial');
    const unpaidBills = patientBills.filter(b => b.status === 'Unpaid');
    const totalBilled = patientBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalCollected = patientBills.reduce((sum, b) => sum + b.paidAmount, 0);
    const totalPending = totalBilled - totalCollected;

    const uniquePatientIds = new Set(doctorVisits.map(v => v.patientId));
    const totalDoctorFees = doctorVisits.reduce((sum, v) => sum + (v.doctorFee || 0), 0);

    return {
      visits: doctorVisits,
      prescriptions: doctorPrescriptions,
      labOrders: doctorLabOrders,
      bills: patientBills,
      paidBills,
      unpaidBills,
      totalVisits: doctorVisits.length,
      totalPrescriptions: doctorPrescriptions.length,
      totalLabOrders: doctorLabOrders.length,
      totalDoctorFees,
      uniquePatients: uniquePatientIds.size,
      totalBilled,
      totalCollected,
      totalPending,
    };
  }, [session, startDate, endDate]);

  if (!session) return null;

  const doctorName = session.name;
  const doctorDept = session.department;

  // Combine visit data with bill payment status
  const visitsWithPayment = useMemo(() => {
    if (!stats.visits.length) return [];
    const billMap = new Map<string, Bill[]>();
    stats.bills.forEach(b => {
      const existing = billMap.get(b.patientId) || [];
      existing.push(b);
      billMap.set(b.patientId, existing);
    });
    return stats.visits
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
      .map(v => {
        const patientBills = billMap.get(v.patientId) || [];
        const totalBilled = patientBills.reduce((s, b) => s + b.totalAmount, 0);
        const totalPaid = patientBills.reduce((s, b) => s + b.paidAmount, 0);
        const remaining = totalBilled - totalPaid;
        return { ...v, totalBilled, totalPaid, remaining, hasBill: patientBills.length > 0 };
      });
  }, [stats.visits, stats.bills]);

  return (
    <div className="space-y-5">
      {/* Doctor Info Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">{doctorName.charAt(0)}</div>
        <div>
          <p className="font-bold text-purple-800">{doctorName}</p>
          <p className="text-sm text-purple-500">Department: {doctorDept}</p>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          Select Date Range
        </h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1">
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="form-label">To Date</label>
            <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { const today = new Date().toISOString().split('T')[0]; setStartDate(today); setEndDate(today); }} className="btn btn-outline btn-sm">Today</button>
            <button onClick={() => { const t = new Date().toISOString().split('T')[0]; const w = new Date(); w.setDate(w.getDate() - 7); setStartDate(w.toISOString().split('T')[0]); setEndDate(t); }} className="btn btn-outline btn-sm">Last 7 Days</button>
            <button onClick={() => { const t = new Date().toISOString().split('T')[0]; const m = new Date(); m.setDate(m.getDate() - 30); setStartDate(m.toISOString().split('T')[0]); setEndDate(t); }} className="btn btn-outline btn-sm">Last 30 Days</button>
            <button onClick={() => { const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth(), 1); setStartDate(f.toISOString().split('T')[0]); setEndDate(t.toISOString().split('T')[0]); }} className="btn btn-outline btn-sm">This Month</button>
            <button onClick={() => { const t = new Date(); const f = new Date(t.getFullYear(), 0, 1); setStartDate(f.toISOString().split('T')[0]); setEndDate(t.toISOString().split('T')[0]); }} className="btn btn-outline btn-sm">This Year</button>
          </div>
        </div>
        {startDate && endDate && (
          <p className="text-sm text-slate-400 mt-2">
            Showing data from <span className="font-medium text-slate-600">{startDate}</span> to <span className="font-medium text-slate-600">{endDate}</span>
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-purple-200 bg-purple-50">
          <p className="text-xs text-purple-600 font-medium">Total Patients</p>
          <p className="text-2xl font-bold text-purple-700">{stats.uniquePatients}</p>
          <p className="text-xs text-purple-400">unique patients</p>
        </div>
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Total Visits</p>
          <p className="text-2xl font-bold text-blue-700">{stats.totalVisits}</p>
          <p className="text-xs text-blue-400">patient encounters</p>
        </div>
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Prescriptions</p>
          <p className="text-2xl font-bold text-emerald-700">{stats.totalPrescriptions}</p>
          <p className="text-xs text-emerald-400">written</p>
        </div>
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Lab Orders</p>
          <p className="text-2xl font-bold text-amber-700">{stats.totalLabOrders}</p>
          <p className="text-xs text-amber-400">ordered</p>
        </div>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-rose-200 bg-rose-50">
          <p className="text-xs text-rose-600 font-medium">Doctor Fees</p>
          <p className="text-2xl font-bold text-rose-700">{currency} {stats.totalDoctorFees.toLocaleString()}</p>
          <p className="text-xs text-rose-400">total earned</p>
        </div>
        <div className="stat-card card-hover border border-teal-200 bg-teal-50">
          <p className="text-xs text-teal-600 font-medium">Total Billed</p>
          <p className="text-2xl font-bold text-teal-700">{currency} {stats.totalBilled.toLocaleString()}</p>
          <p className="text-xs text-teal-400">all bills</p>
        </div>
        <div className="stat-card card-hover border border-green-200 bg-green-50">
          <p className="text-xs text-green-600 font-medium">Amount Collected</p>
          <p className="text-2xl font-bold text-green-700">{currency} {stats.totalCollected.toLocaleString()}</p>
          <p className="text-xs text-green-400">received</p>
        </div>
        <div className="stat-card card-hover border border-red-200 bg-red-50">
          <p className="text-xs text-red-600 font-medium">Amount Pending</p>
          <p className="text-2xl font-bold text-red-700">{currency} {stats.totalPending.toLocaleString()}</p>
          <p className="text-xs text-red-400">remaining balance</p>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h3 className="font-bold text-slate-800">Payment Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Status</th><th>Count</th><th className="text-right">Total Amount</th><th className="text-right">Paid</th><th className="text-right">Remaining</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="badge badge-green">Paid</span></td>
                <td className="font-medium">{stats.bills.filter(b => b.status === 'Paid').length}</td>
                <td className="text-right">{currency} {stats.bills.filter(b => b.status === 'Paid').reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}</td>
                <td className="text-right font-semibold text-green-700">{currency} {stats.bills.filter(b => b.status === 'Paid').reduce((s, b) => s + b.paidAmount, 0).toLocaleString()}</td>
                <td className="text-right">{currency} 0</td>
              </tr>
              <tr>
                <td><span className="badge badge-amber">Partial</span></td>
                <td className="font-medium">{stats.bills.filter(b => b.status === 'Partial').length}</td>
                <td className="text-right">{currency} {stats.bills.filter(b => b.status === 'Partial').reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}</td>
                <td className="text-right">{currency} {stats.bills.filter(b => b.status === 'Partial').reduce((s, b) => s + b.paidAmount, 0).toLocaleString()}</td>
                <td className="text-right text-amber-600">{currency} {stats.bills.filter(b => b.status === 'Partial').reduce((s, b) => s + (b.totalAmount - b.paidAmount), 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td><span className="badge badge-rose">Unpaid</span></td>
                <td className="font-medium">{stats.bills.filter(b => b.status === 'Unpaid').length}</td>
                <td className="text-right">{currency} {stats.bills.filter(b => b.status === 'Unpaid').reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}</td>
                <td className="text-right">{currency} 0</td>
                <td className="text-right text-red-600">{currency} {stats.bills.filter(b => b.status === 'Unpaid').reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}</td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td>Total</td>
                <td>{stats.bills.length}</td>
                <td className="text-right">{currency} {stats.totalBilled.toLocaleString()}</td>
                <td className="text-right text-green-700">{currency} {stats.totalCollected.toLocaleString()}</td>
                <td className="text-right text-red-700">{currency} {stats.totalPending.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Visit List with Payment Info */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <h3 className="font-bold text-slate-800">Patient Visits</h3>
          </div>
          <span className="badge badge-purple">{stats.totalVisits} visits</span>
        </div>

        {visitsWithPayment.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <p className="text-slate-400 font-medium">No visits found for this period</p>
            <p className="text-xs text-slate-300 mt-1">Try selecting a different date range</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="w-8">#</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Patient No</th>
                  <th>Patient Name</th>
                  <th>Diagnosis</th>
                  <th>Status</th>
                  <th className="text-right">Doctor Fee</th>
                  <th className="text-right">Billed</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {visitsWithPayment.map((v, idx) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="text-slate-400 text-sm">{idx + 1}</td>
                    <td className="font-medium text-slate-700">{v.date}</td>
                    <td className="text-slate-500">{v.time}</td>
                    <td>
                      <span className="font-mono text-purple-600 font-semibold">{v.patientNo}</span>
                    </td>
                    <td className="font-semibold text-slate-800">{v.patientName}</td>
                    <td className="text-slate-600 text-sm max-w-[200px] truncate">
                      {v.diagnosis || <span className="text-slate-400 italic">No diagnosis</span>}
                    </td>
                    <td>
                      <span className={`badge ${v.status === 'Active' ? 'badge-blue' : v.status === 'Discharged' ? 'badge-green' : 'badge-amber'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="text-right font-semibold text-emerald-700">{currency} {(v.doctorFee || 0).toLocaleString()}</td>
                    <td className="text-right text-slate-600">{v.hasBill ? `${currency} ${v.totalBilled.toLocaleString()}` : '-'}</td>
                    <td className="text-right text-green-600">{v.hasBill ? `${currency} ${v.totalPaid.toLocaleString()}` : '-'}</td>
                    <td className="text-right">
                      {v.hasBill ? (
                        v.remaining > 0 ? (
                          <span className="text-red-600 font-semibold">{currency} {v.remaining.toLocaleString()}</span>
                        ) : (
                          <span className="text-green-600 font-semibold">{currency} 0</span>
                        )
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Prescriptions Summary */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            <h3 className="font-bold text-slate-800">Prescriptions Written</h3>
          </div>
          <span className="badge badge-emerald">{stats.totalPrescriptions} prescriptions</span>
        </div>

        {stats.prescriptions.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No prescriptions found for this period</div>
        ) : (
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="w-8">#</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Medicines</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.prescriptions
                  .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                  .map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="text-slate-400 text-sm">{idx + 1}</td>
                      <td className="font-medium text-slate-700">{p.date}</td>
                      <td className="text-slate-500">{p.time}</td>
                      <td>
                        <span className="font-semibold text-slate-800">{p.patientName}</span>
                        <span className="text-xs text-slate-400 ml-2">({p.patientNo})</span>
                      </td>
                      <td>
                        <span className="badge badge-blue">{p.medicines.length} medicine{p.medicines.length !== 1 ? 's' : ''}</span>
                      </td>
                      <td>
                        <span className={`badge ${p.status === 'Active' ? 'badge-amber' : 'badge-green'}`}>{p.status}</span>
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
