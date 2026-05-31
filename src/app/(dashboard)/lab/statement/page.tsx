'use client';
import { useState, useEffect, useMemo } from 'react';
import { getHospitalSettings } from '@/lib/store';
import { getLabOrders, getLabExpenses, getLabTests, addExpense } from '@/lib/lab-store';
import { genId, todayStr } from '@/lib/store';
import type { LabOrderItem, LabExpense } from '@/lib/lab-store';

const LAB_CATEGORIES = ['Reagents', 'Consumables', 'Equipment', 'Maintenance', 'Waste Management', 'Utilities', 'Salaries', 'Miscellaneous'];

function dateInRange(dateStr: string, from: string, to: string): boolean {
  if (!dateStr || !from || !to) return false;
  return dateStr >= from && dateStr <= to;
}

export default function LabStatementPage() {
  const [session, setSession] = useState<{ userId: string; name: string; role: string; department: string } | null>(null);
  const [currency, setCurrency] = useState('Rs.');
  const [orders, setOrders] = useState<LabOrderItem[]>([]);
  const [expenses, setExpenses] = useState<LabExpense[]>([]);

  // Custom date range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Add Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expDesc, setExpDesc] = useState('');
  const [expCategory, setExpCategory] = useState('Reagents');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    try {
      const s = localStorage.getItem('baga_session');
      if (s) setSession(JSON.parse(s));
    } catch {}
    setCurrency(getHospitalSettings().currency);
    loadExpenses();
    // Load fresh data
    setOrders(getLabOrders());
  }, []);

  // Default to current month
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  const loadExpenses = () => {
    setExpenses(getLabExpenses());
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleAddExpense = () => {
    if (!expDesc.trim() || !expAmount || !expDate) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    try {
      addExpense({
        id: genId(),
        description: expDesc.trim(),
        category: expCategory,
        amount: parseFloat(expAmount),
        date: expDate,
        notes: expNotes.trim(),
      });
      showToast('Expense added successfully');
      setShowExpenseModal(false);
      setExpDesc('');
      setExpCategory('Reagents');
      setExpAmount('');
      setExpDate('');
      setExpNotes('');
      loadExpenses();
    } catch {
      showToast('Failed to add expense', 'error');
    }
  };

  const filterLabel = startDate && endDate ? `${startDate} to ${endDate}` : '';

  const stats = useMemo(() => {
    const filtered = orders.filter(o => dateInRange(o.date, startDate, endDate));
    const filteredExp = expenses.filter(e => dateInRange(e.date, startDate, endDate));

    const orderedCount = filtered.filter(o => o.status === 'ordered').length;
    const collectedCount = filtered.filter(o => o.status === 'collected').length;
    const processingCount = filtered.filter(o => o.status === 'processing').length;
    const completedCount = filtered.filter(o => o.status === 'completed').length;

    // Revenue from completed orders
    const totalRevenue = filtered
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.paidAmount, 0);

    const totalBilled = filtered.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalPaid = filtered.reduce((sum, o) => sum + o.paidAmount, 0);
    const totalPending = totalBilled - totalPaid;

    // Total expenses
    const totalExpenses = filteredExp.reduce((sum, e) => sum + e.amount, 0);
    const profit = totalRevenue - totalExpenses;

    // Unique patients
    const uniquePatients = new Set(filtered.map(o => o.patientNo));

    // Total tests performed
    const totalTests = filtered.reduce((sum, o) => sum + o.tests.length, 0);
    const completedTests = filtered
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.tests.length, 0);

    // Urgency breakdown
    const urgentCount = filtered.filter(o => o.urgency === 'urgent' || o.urgency === 'stat').length;

    // Top tests ordered
    const testMap: Record<string, { name: string; count: number; revenue: number }> = {};
    filtered.forEach(o => {
      if (o.status === 'completed') {
        o.tests.forEach(t => {
          if (!testMap[t.testName]) {
            testMap[t.testName] = { name: t.testName, count: 0, revenue: 0 };
          }
          testMap[t.testName].count += 1;
          testMap[t.testName].revenue += t.price;
        });
      }
    });
    const topTests = Object.values(testMap).sort((a, b) => b.count - a.count).slice(0, 10);

    // Top referring doctors
    const doctorMap: Record<string, { name: string; count: number }> = {};
    filtered.forEach(o => {
      if (!doctorMap[o.orderedBy]) {
        doctorMap[o.orderedBy] = { name: o.orderedBy, count: 0 };
      }
      doctorMap[o.orderedBy].count += 1;
    });
    const topDoctors = Object.values(doctorMap).sort((a, b) => b.count - a.count).slice(0, 5);

    // Payment status breakdown
    const paidOrders = filtered.filter(o => o.paymentStatus === 'paid');
    const unpaidOrders = filtered.filter(o => o.paymentStatus === 'unpaid');
    const partialOrders = filtered.filter(o => o.paymentStatus === 'partial');

    // Abnormal results count
    const abnormalCount = filtered
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.results.filter(r => r.flag !== 'Normal').length, 0);

    return {
      filtered,
      filteredExp,
      totalOrders: filtered.length,
      orderedCount,
      collectedCount,
      processingCount,
      completedCount,
      totalRevenue,
      totalBilled,
      totalPaid,
      totalPending,
      totalExpenses,
      profit,
      uniquePatients: uniquePatients.size,
      totalTests,
      completedTests,
      urgentCount,
      topTests,
      topDoctors,
      paidOrders,
      unpaidOrders,
      partialOrders,
      abnormalCount,
    };
  }, [orders, expenses, startDate, endDate]);

  if (!session) return null;

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium ${toastType === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toastMsg}
        </div>
      )}

      {/* Lab Tech Info Banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg">{session.name.charAt(0)}</div>
        <div className="flex-1">
          <p className="font-bold text-teal-800">{session.name}</p>
          <p className="text-sm text-teal-500">Lab Technician — Statement Report</p>
        </div>
        <button onClick={() => { setShowExpenseModal(true); setExpDate(todayStr()); }} className="btn btn-primary">
          + Add Expense
        </button>
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

      {/* Stats Cards Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-teal-200 bg-teal-50">
          <p className="text-xs text-teal-600 font-medium">Total Orders</p>
          <p className="text-2xl font-bold text-teal-700">{stats.totalOrders}</p>
          <p className="text-xs text-teal-400">{stats.completedCount} completed</p>
        </div>
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Revenue</p>
          <p className="text-2xl font-bold text-emerald-700">{currency} {stats.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-emerald-400">{stats.completedTests} tests done</p>
        </div>
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Tests Ordered</p>
          <p className="text-2xl font-bold text-blue-700">{stats.totalTests}</p>
          <p className="text-xs text-blue-400">{stats.uniquePatients} patients</p>
        </div>
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Expenses</p>
          <p className="text-2xl font-bold text-amber-700">{currency} {stats.totalExpenses.toLocaleString()}</p>
          <p className="text-xs text-amber-400">{stats.filteredExp.length} entries</p>
        </div>
      </div>

      {/* Stats Cards Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-purple-200 bg-purple-50">
          <p className="text-xs text-purple-600 font-medium">Pending</p>
          <p className="text-2xl font-bold text-purple-700">{stats.orderedCount}</p>
          <p className="text-xs text-purple-400">waiting for sample</p>
        </div>
        <div className="stat-card card-hover border border-indigo-200 bg-indigo-50">
          <p className="text-xs text-indigo-600 font-medium">Collected</p>
          <p className="text-2xl font-bold text-indigo-700">{stats.collectedCount}</p>
          <p className="text-xs text-indigo-400">samples collected</p>
        </div>
        <div className="stat-card card-hover border border-rose-200 bg-rose-50">
          <p className="text-xs text-rose-600 font-medium">Processing</p>
          <p className="text-2xl font-bold text-rose-700">{stats.processingCount}</p>
          <p className="text-xs text-rose-400">in progress</p>
        </div>
        <div className="stat-card card-hover border border-cyan-200 bg-cyan-50">
          <p className="text-xs text-cyan-600 font-medium">Urgent / STAT</p>
          <p className="text-2xl font-bold text-cyan-700">{stats.urgentCount}</p>
          <p className="text-xs text-cyan-400">priority orders</p>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Financial Summary ({filterLabel})
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Total Billed</p>
            <p className="text-xl font-extrabold text-slate-700">{currency} {stats.totalBilled.toLocaleString()}</p>
            <p className="text-xs text-slate-400">{stats.totalOrders} orders</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Amount Collected</p>
            <p className="text-xl font-extrabold text-emerald-700">{currency} {stats.totalPaid.toLocaleString()}</p>
            <p className="text-xs text-slate-400">{stats.paidOrders.length} paid</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Amount Pending</p>
            <p className="text-xl font-extrabold text-rose-700">{currency} {stats.totalPending.toLocaleString()}</p>
            <p className="text-xs text-slate-400">{stats.unpaidOrders.length} unpaid</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Lab Expenses</p>
            <p className="text-xl font-extrabold text-amber-700">{currency} {stats.totalExpenses.toLocaleString()}</p>
            <p className="text-xs text-slate-400">{stats.filteredExp.length} entries</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Net Profit</p>
            <p className={`text-xl font-extrabold ${stats.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {stats.profit >= 0 ? '' : '-'}{currency} {Math.abs(stats.profit).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400">revenue - expenses</p>
          </div>
        </div>
      </div>

      {/* Top Tests & Top Doctors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Ordered Tests */}
        {stats.topTests.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              <h3 className="font-bold text-slate-800">Top Tests</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th>Test Name</th>
                    <th className="text-center">Performed</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topTests.map((test, idx) => (
                    <tr key={test.name} className="hover:bg-slate-50">
                      <td className="text-slate-400 text-sm">{idx + 1}</td>
                      <td className="font-semibold text-slate-800">{test.name}</td>
                      <td className="text-center">
                        <span className="badge badge-teal">{test.count}</span>
                      </td>
                      <td className="text-right font-bold text-emerald-700">{currency} {test.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Referring Doctors */}
        {stats.topDoctors.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <h3 className="font-bold text-slate-800">Top Referring Doctors</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th>Doctor Name</th>
                    <th className="text-center">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topDoctors.map((doc, idx) => (
                    <tr key={doc.name} className="hover:bg-slate-50">
                      <td className="text-slate-400 text-sm">{idx + 1}</td>
                      <td className="font-semibold text-slate-800">{doc.name}</td>
                      <td className="text-center">
                        <span className="badge badge-purple">{doc.count}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Order History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="font-bold text-slate-800">Order History ({filterLabel})</h3>
          </div>
          <span className="badge badge-teal">{stats.totalOrders} orders</span>
        </div>

        {stats.filtered.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <p className="text-slate-400 font-medium">No orders found for this period</p>
            <p className="text-xs text-slate-300 mt-1">Try selecting a different time range</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="w-8">#</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Tests</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.filtered
                  .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                  .map((order, idx) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="text-slate-400 text-sm">{idx + 1}</td>
                      <td className="font-medium text-slate-700">{order.date}</td>
                      <td className="text-slate-500">{order.time}</td>
                      <td>
                        <div>
                          <p className="font-semibold text-slate-800">{order.patientName}</p>
                          <p className="text-xs text-slate-400">{order.patientNo}</p>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {order.tests.map((t, i) => (
                            <span key={i} className="inline-block text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {t.testName.length > 20 ? t.testName.substring(0, 20) + '...' : t.testName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          order.urgency === 'stat' ? 'badge-rose' :
                          order.urgency === 'urgent' ? 'badge-amber' :
                          'badge-slate'
                        }`}>
                          {order.urgency === 'stat' ? 'STAT' : order.urgency.charAt(0).toUpperCase() + order.urgency.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          order.status === 'completed' ? 'badge-green' :
                          order.status === 'processing' ? 'badge-blue' :
                          order.status === 'collected' ? 'badge-indigo' :
                          'badge-slate'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          order.paymentStatus === 'paid' ? 'badge-green' :
                          order.paymentStatus === 'partial' ? 'badge-amber' :
                          'badge-rose'
                        }`}>
                          {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                        </span>
                      </td>
                      <td className="text-right font-bold text-emerald-700">{currency} {order.totalAmount.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-50">
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={8} className="px-4 py-3 text-right font-bold text-slate-700">Grand Total:</td>
                  <td className="px-4 py-3 text-right font-extrabold text-teal-700 text-lg">{currency} {stats.totalBilled.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Expense Detail */}
      {stats.filteredExp.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <h3 className="font-bold text-slate-800">Lab Expenses ({filterLabel})</h3>
            </div>
            <span className="badge badge-amber">{currency} {stats.totalExpenses.toLocaleString()}</span>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="w-8">#</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {stats.filteredExp
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((exp, idx) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="text-slate-400 text-sm">{idx + 1}</td>
                      <td className="font-medium text-slate-700">{exp.date}</td>
                      <td className="font-semibold text-slate-800">{exp.description}</td>
                      <td>
                        <span className="badge badge-slate">{exp.category}</span>
                      </td>
                      <td className="text-right font-bold text-rose-700">{currency} {exp.amount.toLocaleString()}</td>
                      <td className="text-sm text-slate-500">{exp.notes}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-50">
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-slate-700">Total Expenses:</td>
                  <td className="px-4 py-3 text-right font-extrabold text-rose-700 text-lg">{currency} {stats.totalExpenses.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800">Add Lab Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label">Description *</label>
                <input type="text" className="form-input" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="e.g. CBC Reagent Kit Purchase" />
              </div>
              <div>
                <label className="form-label">Category *</label>
                <select className="form-input" value={expCategory} onChange={e => setExpCategory(e.target.value)}>
                  {LAB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Amount *</label>
                  <input type="number" className="form-input" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0" min="0" />
                </div>
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" value={expDate} onChange={e => setExpDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={expNotes} onChange={e => setExpNotes(e.target.value)} placeholder="Optional notes" />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowExpenseModal(false)} className="btn btn-outline">Cancel</button>
                <button onClick={handleAddExpense} className="btn btn-primary">Save Expense</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
