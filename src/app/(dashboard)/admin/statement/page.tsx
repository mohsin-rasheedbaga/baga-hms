'use client';
import { useState, useEffect, useMemo } from 'react';
import { getHospitalSettings, getVisits, getBills, getPatients, getAppointments, getAdmissions, getLabOrders, getPharmacyExpenses, getXRayOrders, getUltrasoundOrders, getPharmacySalesDB, getPharmacyReturnsDB } from '@/lib/store';
import { getLabExpenses, getLabOrders as getLisLabOrders } from '@/lib/lab-store';

function dateInRange(dateStr: string, from: string, to: string): boolean {
  if (!dateStr || !from || !to) return false;
  return dateStr >= from && dateStr <= to;
}

export default function AdminStatementPage() {
  const [mounted, setMounted] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('Rs.');

  useEffect(() => {
    setMounted(true);
    setCurrency(getHospitalSettings().currency);
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!startDate || !endDate) return null;

  // Load all data from localStorage
  const allVisits = getVisits();
  const allBills = getBills();
  const allPatients = getPatients();
  const allAppointments = getAppointments();
  const allAdmissions = getAdmissions();
  const storeLabOrders = getLabOrders(); // from store.ts (main)
  const lisLabOrders = getLisLabOrders(); // from lab-store (LIS)
  const labExpenses = getLabExpenses();
  const pharmacyExpenses = getPharmacyExpenses();
  const xrayOrders = getXRayOrders();
  const ultrasoundOrders = getUltrasoundOrders();

  // Filter by date range
  const filterLabel = `${startDate} to ${endDate}`;

  const filteredVisits = allVisits.filter(v => dateInRange(v.date, startDate, endDate));
  const filteredBills = allBills.filter(b => dateInRange(b.date, startDate, endDate));
  const filteredPatients = allPatients.filter(p => dateInRange(p.regDate, startDate, endDate));
  const filteredAppointments = allAppointments.filter(a => dateInRange(a.appointmentDate, startDate, endDate));
  const filteredAdmissions = allAdmissions.filter(a => dateInRange(a.admissionDate, startDate, endDate));
  const filteredStoreLab = storeLabOrders.filter(o => dateInRange(o.date, startDate, endDate));
  const filteredLisLab = lisLabOrders.filter(o => dateInRange(o.date, startDate, endDate));
  const filteredLabExpenses = labExpenses.filter(e => dateInRange(e.date, startDate, endDate));
  const filteredPharmacyExpenses = pharmacyExpenses.filter(e => dateInRange(e.date, startDate, endDate));
  const filteredXray = xrayOrders.filter(o => dateInRange(o.date, startDate, endDate));
  const filteredUltrasound = ultrasoundOrders.filter(o => dateInRange(o.date, startDate, endDate));

  // Pharmacy sales from SQLite (via store.ts) — works for both Electron host and LAN
  // This ensures ALL pharmacy sales (from all users, all machines) appear in main statement
  let pharmacySales: any[] = [];
  try {
    pharmacySales = getPharmacySalesDB() as any[];
  } catch {
    // Fallback to localStorage if SQLite read fails
    try {
      const raw = localStorage.getItem('baga_pharmacy_sales');
      if (raw) pharmacySales = JSON.parse(raw);
    } catch {}
  }
  const filteredPharmacySales = pharmacySales.filter((s: any) => dateInRange(s.date, startDate, endDate));

  // Pharmacy returns from SQLite (via store.ts) — these are refunds that should
  // be subtracted from pharmacy revenue
  let pharmacyReturns: any[] = [];
  try {
    pharmacyReturns = getPharmacyReturnsDB() as any[];
  } catch {
    try {
      const raw = localStorage.getItem('baga_pharmacy_returns');
      if (raw) pharmacyReturns = JSON.parse(raw);
    } catch {}
  }
  const filteredPharmacyReturns = pharmacyReturns.filter((r: any) => dateInRange(r.date, startDate, endDate));
  const totalPharmacyRefunds = filteredPharmacyReturns.reduce((s, r: any) => s + (r.totalRefund || 0), 0);

  // ===== Section 2: Overview Stats =====
  const uniquePatientsInPeriod = new Set(filteredVisits.map(v => v.patientId)).size;
  const totalVisits = filteredVisits.length;
  const totalBilled = filteredBills.reduce((s, b) => s + b.totalAmount, 0);
  const totalCollected = filteredBills.reduce((s, b) => s + b.paidAmount, 0);
  const totalPending = totalBilled - totalCollected;
  const totalLabOrders = filteredLisLab.length;
  const totalLabRevenue = filteredLisLab
    .filter(o => o.status === 'completed')
    .reduce((s, o) => s + o.paidAmount, 0);
  const totalPharmacyRevenue = filteredPharmacySales.reduce((s, sale: any) => s + sale.totalAmount, 0);

  // ===== Section 3: Department-wise Financial Summary =====
  // Reception (Bills)
  const receptionBilled = totalBilled;
  const receptionCollected = totalCollected;
  const receptionPending = totalPending;
  const receptionCount = filteredBills.length;

  // Lab (from LIS store)
  const labOrdersCount = filteredLisLab.length;
  const labBilled = filteredLisLab.reduce((s, o) => s + o.totalAmount, 0);
  const labCollected = filteredLisLab.reduce((s, o) => s + o.paidAmount, 0);
  const labPending = labBilled - labCollected;
  const labRevenue = filteredLisLab.filter(o => o.status === 'completed').reduce((s, o) => s + o.paidAmount, 0);
  const labExp = filteredLabExpenses.reduce((s, e) => s + e.amount, 0);
  const labProfit = labRevenue - labExp;

  // X-Ray
  const xrayCount = filteredXray.length;
  const xrayBilled = filteredXray.reduce((s, o) => s + (o.price || 0), 0);

  // Ultrasound
  const usgCount = filteredUltrasound.length;
  const usgBilled = filteredUltrasound.reduce((s, o) => s + (o.price || 0), 0);

  // Pharmacy (sales minus returns)
  const pharmacyCount = filteredPharmacySales.length;
  const pharmacyReturnCount = filteredPharmacyReturns.length;
  const pharmacyBilled = filteredPharmacySales.reduce((s, sale: any) => s + sale.totalAmount, 0);
  const pharmacyRefunds = totalPharmacyRefunds;
  const pharmacyNet = pharmacyBilled - pharmacyRefunds; // net revenue after returns
  const pharmacyExp = filteredPharmacyExpenses.reduce((s, e: any) => s + e.amount, 0);
  const pharmacyProfit = pharmacyNet - pharmacyExp;

  // Totals — pharmacy net (after returns) is used in grand totals
  const grandOrders = receptionCount + labOrdersCount + xrayCount + usgCount + pharmacyCount;
  const grandBilled = receptionBilled + labBilled + xrayBilled + usgBilled + pharmacyNet;
  const grandCollected = receptionCollected + labCollected;
  const grandPending = receptionPending + labPending;
  const grandExpenses = labExp + pharmacyExp + pharmacyRefunds; // refunds count as expenses
  const grandProfit = (labRevenue + pharmacyNet) - grandExpenses;

  // ===== Section 4: Doctor-wise Revenue =====
  const doctorMap: Record<string, { name: string; department: string; patients: Set<string>; visits: number; fees: number; billed: number; collected: number }> = {};
  filteredVisits.forEach(v => {
    const key = v.doctor;
    if (!doctorMap[key]) {
      doctorMap[key] = { name: v.doctor, department: v.department, patients: new Set(), visits: 0, fees: 0, billed: 0, collected: 0 };
    }
    doctorMap[key].patients.add(v.patientId);
    doctorMap[key].visits += 1;
    doctorMap[key].fees += (v.doctorFee || 0);
  });
  // Add bill data to doctors
  filteredBills.forEach(b => {
    const visit = filteredVisits.find(v => v.patientId === b.patientId);
    if (visit && doctorMap[visit.doctor]) {
      doctorMap[visit.doctor].billed += b.totalAmount;
      doctorMap[visit.doctor].collected += b.paidAmount;
    }
  });
  const doctorRows = Object.values(doctorMap).map(d => ({
    ...d,
    patients: d.patients.size,
  })).sort((a, b) => b.billed - a.billed);

  // ===== Section 5: Expense Summary =====
  const allExpenses: any[] = [
    ...filteredLabExpenses.map(e => ({ ...e, department: 'Lab' })),
    ...filteredPharmacyExpenses.map(e => ({ ...e, department: 'Pharmacy' })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  // ===== Section 6: Top Tests =====
  const testMap: Record<string, { name: string; count: number; revenue: number }> = {};
  filteredLisLab.forEach(o => {
    o.tests.forEach(t => {
      if (!testMap[t.testName]) {
        testMap[t.testName] = { name: t.testName, count: 0, revenue: 0 };
      }
      testMap[t.testName].count += 1;
      testMap[t.testName].revenue += t.price;
    });
  });
  const topTests = Object.values(testMap).sort((a, b) => b.count - a.count).slice(0, 10);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <div>
          <p className="font-bold text-blue-800">Main Hospital Statement</p>
          <p className="text-sm text-blue-500">Comprehensive financial report across all departments</p>
        </div>
      </div>

      {/* Date Range Picker */}
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

      {/* Section 2: Overview Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Total Patients</p>
          <p className="text-2xl font-bold text-blue-700">{uniquePatientsInPeriod}</p>
          <p className="text-xs text-blue-400">unique in range</p>
        </div>
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Total Visits</p>
          <p className="text-2xl font-bold text-emerald-700">{totalVisits}</p>
          <p className="text-xs text-emerald-400">patient encounters</p>
        </div>
        <div className="stat-card card-hover border border-purple-200 bg-purple-50">
          <p className="text-xs text-purple-600 font-medium">Amount Billed</p>
          <p className="text-2xl font-bold text-purple-700">{currency} {totalBilled.toLocaleString()}</p>
          <p className="text-xs text-purple-400">{filteredBills.length} bills</p>
        </div>
        <div className="stat-card card-hover border border-green-200 bg-green-50">
          <p className="text-xs text-green-600 font-medium">Amount Collected</p>
          <p className="text-2xl font-bold text-green-700">{currency} {totalCollected.toLocaleString()}</p>
          <p className="text-xs text-green-400">received</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-rose-200 bg-rose-50">
          <p className="text-xs text-rose-600 font-medium">Amount Pending</p>
          <p className="text-2xl font-bold text-rose-700">{currency} {totalPending.toLocaleString()}</p>
          <p className="text-xs text-rose-400">remaining balance</p>
        </div>
        <div className="stat-card card-hover border border-teal-200 bg-teal-50">
          <p className="text-xs text-teal-600 font-medium">Total Lab Orders</p>
          <p className="text-2xl font-bold text-teal-700">{totalLabOrders}</p>
          <p className="text-xs text-teal-400">from LIS</p>
        </div>
        <div className="stat-card card-hover border border-cyan-200 bg-cyan-50">
          <p className="text-xs text-cyan-600 font-medium">Total Lab Revenue</p>
          <p className="text-2xl font-bold text-cyan-700">{currency} {totalLabRevenue.toLocaleString()}</p>
          <p className="text-xs text-cyan-400">completed orders</p>
        </div>
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Total Pharmacy Revenue (Net)</p>
          <p className="text-2xl font-bold text-amber-700">{currency} {pharmacyNet.toLocaleString()}</p>
          <p className="text-xs text-amber-400">{filteredPharmacySales.length} sales • {filteredPharmacyReturns.length} returns</p>
        </div>
      </div>

      {/* Section 3: Department-wise Financial Summary */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          <h3 className="font-bold text-slate-800">Department-wise Financial Summary ({filterLabel})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th className="text-center">Orders/Visits</th>
                <th className="text-right">Total Billed</th>
                <th className="text-right">Collected</th>
                <th className="text-right">Pending</th>
                <th className="text-right">Expenses</th>
                <th className="text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-slate-50">
                <td className="font-semibold text-slate-800">Reception (Bills)</td>
                <td className="text-center"><span className="badge badge-emerald">{receptionCount}</span></td>
                <td className="text-right">{currency} {receptionBilled.toLocaleString()}</td>
                <td className="text-right text-green-700 font-medium">{currency} {receptionCollected.toLocaleString()}</td>
                <td className="text-right text-rose-600">{currency} {receptionPending.toLocaleString()}</td>
                <td className="text-right text-slate-400">-</td>
                <td className="text-right text-slate-400">-</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="font-semibold text-slate-800">Lab</td>
                <td className="text-center"><span className="badge badge-teal">{labOrdersCount}</span></td>
                <td className="text-right">{currency} {labBilled.toLocaleString()}</td>
                <td className="text-right text-green-700 font-medium">{currency} {labCollected.toLocaleString()}</td>
                <td className="text-right text-rose-600">{currency} {labPending.toLocaleString()}</td>
                <td className="text-right text-amber-600">{currency} {labExp.toLocaleString()}</td>
                <td className={`text-right font-semibold ${labProfit >= 0 ? 'text-green-700' : 'text-rose-700'}`}>
                  {currency} {labProfit.toLocaleString()}
                </td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="font-semibold text-slate-800">X-Ray</td>
                <td className="text-center"><span className="badge badge-rose">{xrayCount}</span></td>
                <td className="text-right">{currency} {xrayBilled.toLocaleString()}</td>
                <td className="text-right text-slate-400">-</td>
                <td className="text-right text-slate-400">-</td>
                <td className="text-right text-slate-400">-</td>
                <td className="text-right text-slate-400">-</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="font-semibold text-slate-800">Ultrasound</td>
                <td className="text-center"><span className="badge badge-purple">{usgCount}</span></td>
                <td className="text-right">{currency} {usgBilled.toLocaleString()}</td>
                <td className="text-right text-slate-400">-</td>
                <td className="text-right text-slate-400">-</td>
                <td className="text-right text-slate-400">-</td>
                <td className="text-right text-slate-400">-</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="font-semibold text-slate-800">Pharmacy</td>
                <td className="text-center"><span className="badge badge-amber">{pharmacyCount}</span></td>
                <td className="text-right">{currency} {pharmacyBilled.toLocaleString()}</td>
                <td className="text-right text-rose-600">- {currency} {pharmacyRefunds.toLocaleString()}</td>
                <td className="text-right font-semibold text-amber-700">{currency} {pharmacyNet.toLocaleString()}</td>
                <td className="text-right text-amber-600">{currency} {pharmacyExp.toLocaleString()}</td>
                <td className={`text-right font-semibold ${pharmacyProfit >= 0 ? 'text-green-700' : 'text-rose-700'}`}>
                  {currency} {pharmacyProfit.toLocaleString()}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 font-bold">
                <td className="text-blue-800">TOTAL</td>
                <td className="text-center"><span className="badge badge-blue">{grandOrders}</span></td>
                <td className="text-right text-blue-800">{currency} {grandBilled.toLocaleString()}</td>
                <td className="text-right text-green-700">{currency} {grandCollected.toLocaleString()}</td>
                <td className="text-right text-rose-600">{currency} {grandPending.toLocaleString()}</td>
                <td className="text-right text-amber-600">{currency} {grandExpenses.toLocaleString()}</td>
                <td className={`text-right ${grandProfit >= 0 ? 'text-green-700' : 'text-rose-700'}`}>
                  {currency} {grandProfit.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Section 4: Doctor-wise Revenue */}
      {doctorRows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <h3 className="font-bold text-slate-800">Doctor-wise Revenue ({filterLabel})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Doctor Name</th>
                  <th>Department</th>
                  <th className="text-center">Patients</th>
                  <th className="text-center">Visits</th>
                  <th className="text-right">Fees</th>
                  <th className="text-right">Total Billed</th>
                  <th className="text-right">Collected</th>
                </tr>
              </thead>
              <tbody>
                {doctorRows.map(d => (
                  <tr key={d.name} className="hover:bg-slate-50">
                    <td className="font-semibold text-slate-800">{d.name}</td>
                    <td className="text-slate-600">{d.department}</td>
                    <td className="text-center"><span className="badge badge-blue">{d.patients}</span></td>
                    <td className="text-center"><span className="badge badge-emerald">{d.visits}</span></td>
                    <td className="text-right">{currency} {d.fees.toLocaleString()}</td>
                    <td className="text-right font-medium">{currency} {d.billed.toLocaleString()}</td>
                    <td className="text-right text-green-700">{currency} {d.collected.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 5: Expense Summary */}
      {allExpenses.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <h3 className="font-bold text-slate-800">Expense Summary ({filterLabel})</h3>
            </div>
            <span className="badge badge-amber">{currency} {(labExp + pharmacyExp).toLocaleString()}</span>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="w-8">#</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Department</th>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {allExpenses.map((exp: any, idx: number) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="text-slate-400 text-sm">{idx + 1}</td>
                    <td className="font-medium text-slate-700">{exp.date}</td>
                    <td className="font-semibold text-slate-800">{exp.description}</td>
                    <td>
                      <span className={`badge ${exp.department === 'Lab' ? 'badge-teal' : 'badge-amber'}`}>{exp.department}</span>
                    </td>
                    <td>
                      <span className="badge badge-slate">{exp.category}</span>
                    </td>
                    <td className="text-right font-bold text-rose-700">{currency} {exp.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-50">
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">Total Expenses:</td>
                  <td className="px-4 py-3 text-right font-extrabold text-rose-700 text-lg">{currency} {(labExp + pharmacyExp).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Section 6: Top Tests */}
      {topTests.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            <h3 className="font-bold text-slate-800">Top Tests ({filterLabel})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Test Name</th>
                  <th className="text-center">Count</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topTests.map((test, idx) => (
                  <tr key={test.name} className="hover:bg-slate-50">
                    <td className="text-slate-400 text-sm">{idx + 1}</td>
                    <td className="font-semibold text-slate-800">{test.name}</td>
                    <td className="text-center"><span className="badge badge-teal">{test.count}</span></td>
                    <td className="text-right font-bold text-emerald-700">{currency} {test.revenue.toLocaleString()}</td>
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
