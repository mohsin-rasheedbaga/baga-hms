'use client';
import { useState, useEffect, useCallback } from 'react';
import { getVisits, getPatients, getBills, getAppointments, getAdmissions, getHospitalSettings, getLabOrders } from '@/lib/store';
import type { Visit, Patient, Bill, Appointment, Admission, LabOrder } from '@/lib/types';

export default function ReceptionStatementPage() {
  const [session, setSession] = useState<{ userId: string; name: string; role: string; department: string } | null>(null);
  const [currency, setCurrency] = useState('Rs.');

  // Date range filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Data
  const [visits, setVisits] = useState<Visit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);

  useEffect(() => {
    try {
      const s = localStorage.getItem('baga_session');
      if (s) setSession(JSON.parse(s));
    } catch {}
    setCurrency(getHospitalSettings().currency);
  }, []);

  const loadData = useCallback(() => {
    const allVisits = getVisits();
    const allPatients = getPatients();
    const allBills = getBills();
    const allAppointments = getAppointments();
    const allAdmissions = getAdmissions();
    const allLabOrders = getLabOrders();
    setVisits(allVisits);
    setPatients(allPatients);
    setBills(allBills);
    setAppointments(allAppointments);
    setAdmissions(allAdmissions);
    setLabOrders(allLabOrders);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Set default date range to current month
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  const filterByDate = <T extends { date: string }>(items: T[]): T[] => {
    if (!startDate || !endDate) return items;
    return items.filter(item => item.date >= startDate && item.date <= endDate);
  };

  const filteredVisits = filterByDate(visits);
  const filteredBills = filterByDate(bills);
  const filteredAppointments = startDate && endDate
    ? appointments.filter(a => a.appointmentDate >= startDate && a.appointmentDate <= endDate)
    : appointments;
  const filteredAdmissions = admissions.filter(a => {
    if (!startDate || !endDate) return true;
    return a.admissionDate >= startDate && a.admissionDate <= endDate;
  });
  const filteredLabOrders = filterByDate(labOrders);

  // Stats
  const newPatients = patients.filter(p => {
    if (!startDate || !endDate) return false;
    return p.regDate >= startDate && p.regDate <= endDate;
  });
  const totalRevenue = filteredBills.reduce((sum, b) => sum + b.paidAmount, 0);
  const totalBilled = filteredBills.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalPending = totalBilled - totalRevenue;
  const completedAppointments = filteredAppointments.filter(a => a.status === 'Completed');
  const scheduledAppointments = filteredAppointments.filter(a => a.status === 'Scheduled');
  const admittedCount = filteredAdmissions.filter(a => a.status === 'Admitted').length;
  const dischargedCount = filteredAdmissions.filter(a => a.status === 'Discharged').length;
  const labCompleted = filteredLabOrders.filter(o => o.status === 'Completed').length;
  const labPending = filteredLabOrders.filter(o => o.status !== 'Completed').length;

  // Unique patients visited in the period
  const uniquePatientsVisited = [...new Set(filteredVisits.map(v => v.patientId))].length;

  // Bills breakdown by status
  const paidBills = filteredBills.filter(b => b.status === 'Paid');
  const partialBills = filteredBills.filter(b => b.status === 'Partial');
  const unpaidBills = filteredBills.filter(b => b.status === 'Unpaid');

  // Map visits with bill payment info
  const visitsWithPayment = filteredVisits
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
    .map(v => {
      const patientBills = bills.filter(b => b.patientId === v.patientId);
      const totalBilled = patientBills.reduce((s, b) => s + b.totalAmount, 0);
      const totalPaid = patientBills.reduce((s, b) => s + b.paidAmount, 0);
      const remaining = totalBilled - totalPaid;
      return { ...v, totalBilled, totalPaid, remaining, hasBill: patientBills.length > 0 };
    });

  const receptionName = session?.name || 'Receptionist';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Reception Statement</h2>
        <p className="text-sm text-slate-500">Check your performance and work summary for any selected date range.</p>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1">
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const today = new Date();
                setStartDate(today.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
              }}
              className="btn btn-outline btn-sm"
            >
              Today
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                setStartDate(weekAgo.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
              }}
              className="btn btn-outline btn-sm"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const monthAgo = new Date(today);
                monthAgo.setDate(monthAgo.getDate() - 30);
                setStartDate(monthAgo.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
              }}
              className="btn btn-outline btn-sm"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                setStartDate(firstDay.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
              }}
              className="btn btn-outline btn-sm"
            >
              This Month
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const firstDay = new Date(today.getFullYear(), 0, 1);
                setStartDate(firstDay.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
              }}
              className="btn btn-outline btn-sm"
            >
              This Year
            </button>
          </div>
        </div>
        {startDate && endDate && (
          <p className="text-sm text-slate-400 mt-2">
            Showing data from <span className="font-medium text-slate-600">{startDate}</span> to <span className="font-medium text-slate-600">{endDate}</span>
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Total Visits</p>
          <p className="text-2xl font-bold text-emerald-700">{filteredVisits.length}</p>
          <p className="text-xs text-emerald-500 mt-1">{uniquePatientsVisited} unique patients</p>
        </div>
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">New Registrations</p>
          <p className="text-2xl font-bold text-blue-700">{newPatients.length}</p>
        </div>
        <div className="stat-card card-hover border border-purple-200 bg-purple-50">
          <p className="text-xs text-purple-600 font-medium">Appointments</p>
          <p className="text-2xl font-bold text-purple-700">{filteredAppointments.length}</p>
          <p className="text-xs text-purple-500 mt-1">{completedAppointments.length} completed, {scheduledAppointments.length} scheduled</p>
        </div>
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Admissions</p>
          <p className="text-2xl font-bold text-amber-700">{filteredAdmissions.length}</p>
          <p className="text-xs text-amber-500 mt-1">{admittedCount} active, {dischargedCount} discharged</p>
        </div>
      </div>

      {/* Revenue & Lab Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-teal-200 bg-teal-50">
          <p className="text-xs text-teal-600 font-medium">Total Billed</p>
          <p className="text-2xl font-bold text-teal-700">{currency} {totalBilled.toLocaleString()}</p>
        </div>
        <div className="stat-card card-hover border border-green-200 bg-green-50">
          <p className="text-xs text-green-600 font-medium">Amount Collected</p>
          <p className="text-2xl font-bold text-green-700">{currency} {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="stat-card card-hover border border-rose-200 bg-rose-50">
          <p className="text-xs text-rose-600 font-medium">Amount Pending</p>
          <p className="text-2xl font-bold text-rose-700">{currency} {totalPending.toLocaleString()}</p>
        </div>
        <div className="stat-card card-hover border border-indigo-200 bg-indigo-50">
          <p className="text-xs text-indigo-600 font-medium">Lab Orders</p>
          <p className="text-2xl font-bold text-indigo-700">{filteredLabOrders.length}</p>
          <p className="text-xs text-indigo-500 mt-1">{labCompleted} completed, {labPending} pending</p>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bills Summary */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="font-bold text-slate-800">Bills Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Status</th><th>Count</th><th className="text-right">Total Amount</th><th className="text-right">Paid</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="badge badge-green">Paid</span></td>
                  <td className="font-medium">{paidBills.length}</td>
                  <td className="text-right">{currency} {paidBills.reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}</td>
                  <td className="text-right font-semibold text-green-700">{currency} {paidBills.reduce((s, b) => s + b.paidAmount, 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td><span className="badge badge-amber">Partial</span></td>
                  <td className="font-medium">{partialBills.length}</td>
                  <td className="text-right">{currency} {partialBills.reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}</td>
                  <td className="text-right">{currency} {partialBills.reduce((s, b) => s + b.paidAmount, 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td><span className="badge badge-rose">Unpaid</span></td>
                  <td className="font-medium">{unpaidBills.length}</td>
                  <td className="text-right">{currency} {unpaidBills.reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}</td>
                  <td className="text-right">{currency} 0</td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td>Total</td>
                  <td>{filteredBills.length}</td>
                  <td className="text-right">{currency} {totalBilled.toLocaleString()}</td>
                  <td className="text-right text-green-700">{currency} {totalRevenue.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Admissions Summary */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            <h3 className="font-bold text-slate-800">Admissions Summary</h3>
          </div>
          {filteredAdmissions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p className="font-medium">No admissions in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="data-table">
                <thead className="sticky top-0 bg-white">
                  <tr><th>Patient</th><th>Purpose</th><th>Dept</th><th>Status</th><th>Doctor</th></tr>
                </thead>
                <tbody>
                  {filteredAdmissions.map(a => (
                    <tr key={a.id}>
                      <td>
                        <p className="font-mono text-xs text-blue-600">{a.patientNo}</p>
                        <p className="font-medium text-sm">{a.patientName}</p>
                      </td>
                      <td className="text-sm">{a.purpose}</td>
                      <td className="text-sm">{a.department}</td>
                      <td>
                        <span className={`badge ${a.status === 'Admitted' ? 'badge-blue' : a.status === 'Discharged' ? 'badge-green' : 'badge-amber'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="text-sm">{a.doctor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Visits */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <h3 className="font-bold text-slate-800">Patient Visits ({filteredVisits.length})</h3>
          </div>
        </div>
        {visitsWithPayment.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="font-medium">No visits recorded in this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr><th>Date</th><th>Time</th><th>Patient No</th><th>Patient Name</th><th>Department</th><th>Doctor</th><th>Status</th><th className="text-right">Billed</th><th className="text-right">Paid</th><th className="text-right">Remaining</th></tr>
              </thead>
              <tbody>
                {visitsWithPayment.map(v => (
                  <tr key={v.id}>
                    <td className="text-sm text-slate-500 whitespace-nowrap">{v.date}</td>
                    <td className="text-sm text-slate-500 whitespace-nowrap">{v.time}</td>
                    <td className="font-mono font-bold text-blue-600 text-sm">{v.patientNo}</td>
                    <td className="font-medium text-sm">{v.patientName}</td>
                    <td className="text-sm">{v.department}</td>
                    <td className="text-sm">{v.doctor}</td>
                    <td>
                      <span className={`badge ${v.status === 'Active' ? 'badge-blue' : v.status === 'Discharged' ? 'badge-green' : 'badge-amber'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="text-right text-sm text-slate-600">{v.hasBill ? `${currency} ${v.totalBilled.toLocaleString()}` : '-'}</td>
                    <td className="text-right text-sm text-green-600">{v.hasBill ? `${currency} ${v.totalPaid.toLocaleString()}` : '-'}</td>
                    <td className="text-right text-sm">
                      {v.hasBill ? (
                        v.remaining > 0 ? (
                          <span className="text-red-600 font-semibold">{currency} {v.remaining.toLocaleString()}</span>
                        ) : (
                          <span className="text-green-600">{currency} 0</span>
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

      {/* New Registrations */}
      {newPatients.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            <h3 className="font-bold text-slate-800">New Patient Registrations ({newPatients.length})</h3>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr><th>Reg Date</th><th>Patient No</th><th>Name</th><th>Gender</th><th>Age</th><th>Mobile</th></tr>
              </thead>
              <tbody>
                {newPatients.sort((a, b) => b.regDate.localeCompare(a.regDate)).map(p => (
                  <tr key={p.id}>
                    <td className="text-sm text-slate-500">{p.regDate}</td>
                    <td className="font-mono font-bold text-blue-600 text-sm">{p.patientNo}</td>
                    <td className="font-medium text-sm">{p.name}</td>
                    <td className="text-sm">{p.gender}</td>
                    <td className="text-sm">{p.age}</td>
                    <td className="text-sm">{p.mobile}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
