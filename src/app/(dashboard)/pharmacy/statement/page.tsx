'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getHospitalSettings, getPharmacyExpenses, addPharmacyExpense, genId, todayStr, getHospital, getPharmacySalesDB, getPharmacyReturnsDB } from '@/lib/store';
import { triggerPrint } from '@/lib/print-utils';

const PHARMACY_CATEGORIES = ['Medicine Purchase', 'Consumables', 'Equipment', 'Maintenance', 'Utilities', 'Salaries', 'Miscellaneous'];

interface PharmacySale {
  id: string;
  patientNo: string;
  patientName: string;
  patientMobile: string;
  type: 'Indoor' | 'Outdoor';
  items: {
    medicineId: string;
    name: string;
    genericName: string;
    form: string;
    strength: string;
    packing: string;
    price: number;
    purchasePrice?: number;
    quantity: number;
    total: number;
  }[];
  totalAmount: number;
  date: string;
  time: string;
  servedBy: string;
}

function dateInRange(dateStr: string, from: string, to: string): boolean {
  if (!dateStr || !from || !to) return false;
  return dateStr >= from && dateStr <= to;
}

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}

const SALES_KEY = 'baga_pharmacy_sales';

export default function PharmacyStatementPage() {
  const [session, setSession] = useState<{ userId: string; name: string; role: string; department: string } | null>(null);
  const [currency, setCurrency] = useState('Rs.');

  // Custom date range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Expenses
  const [pharmacyExpenses, setPharmacyExpenses] = useState<any[]>([]);

  // Add Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expDesc, setExpDesc] = useState('');
  const [expCategory, setExpCategory] = useState('Medicine Purchase');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [expSupplier, setExpSupplier] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Net Profit
  const [showProfitModal, setShowProfitModal] = useState(false);
  const [profitPwd, setProfitPwd] = useState('');
  const [profitData, setProfitData] = useState<{ totalSales: number; totalExpenses: number; purchaseCost: number; netProfit: number; grossProfit: number; purchaseCostBreakdown: any } | null>(null);
  const [profitPwdError, setProfitPwdError] = useState('');

  const handleNetProfit = () => {
    const stored = localStorage.getItem('baga_profit_password');
    if (stored && stored !== profitPwd) {
      setProfitPwdError('Incorrect password');
      return;
    }
    if (!stored && !profitPwd) {
      setProfitPwdError('No password set. Set one in Settings first.');
      return;
    }
    if (!stored && profitPwd) {
      // First time setting - just allow access
    }
    setProfitPwdError('');

    // Calculate net profit
    const filtered = allSales.filter(s => dateInRange(s.date, startDate, endDate));
    const filteredExp = pharmacyExpenses.filter((e: any) => dateInRange(e.date, startDate, endDate));

    const totalSalesAmount = filtered.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalExpensesAmount = filteredExp.reduce((sum: number, e: any) => sum + e.amount, 0);

    // Calculate actual purchase cost from sold medicine items
    const medicinesList: any[] = JSON.parse(localStorage.getItem('baga_medicines') || '[]');
    const medMap: Record<string, any> = {};
    medicinesList.forEach((m: any) => { medMap[m.id] = m; });

    let purchaseCost = 0;
    const purchaseBreakdown: Record<string, number> = {};
    filtered.forEach(s => {
      s.items.forEach(item => {
        // Use stored purchasePrice from sale item (if available), else fallback to current inventory
        const cost = item.purchasePrice != null && item.purchasePrice > 0
          ? item.purchasePrice
          : (medMap[item.medicineId]?.purchasePrice || 0);
        const lineCost = item.quantity * cost;
        purchaseCost += lineCost;
        if (lineCost > 0) {
          const key = item.name || 'Unknown';
          purchaseBreakdown[key] = (purchaseBreakdown[key] || 0) + lineCost;
        }
      });
    });

    const grossProfit = totalSalesAmount - purchaseCost;
    const netProfit = totalSalesAmount - totalExpensesAmount - purchaseCost;

    setProfitData({
      totalSales: totalSalesAmount,
      totalExpenses: totalExpensesAmount,
      purchaseCost,
      grossProfit,
      netProfit,
      purchaseCostBreakdown: purchaseBreakdown,
    });
    setProfitPwd('');
  };

  useEffect(() => {
    try {
      const s = localStorage.getItem('baga_session');
      if (s) setSession(JSON.parse(s));
    } catch {}
    setCurrency(getHospitalSettings().currency);
    loadExpenses();
  }, []);

  // Default to current month
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  const loadExpenses = () => {
    setPharmacyExpenses(getPharmacyExpenses());
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
      addPharmacyExpense({
        id: genId(),
        description: expDesc.trim(),
        category: expCategory,
        amount: parseFloat(expAmount),
        date: expDate,
        notes: expNotes.trim(),
        supplier: expSupplier.trim(),
      });
      showToast('Expense added successfully');
      setShowExpenseModal(false);
      setExpDesc('');
      setExpCategory('Medicine Purchase');
      setExpAmount('');
      setExpDate('');
      setExpNotes('');
      setExpSupplier('');
      loadExpenses();
    } catch {
      showToast('Failed to add expense', 'error');
    }
  };

  const allSales: PharmacySale[] = getPharmacySalesDB() as PharmacySale[];
  const allReturns: any[] = getPharmacyReturnsDB() as any[];

  const filterLabel = startDate && endDate ? `${startDate} to ${endDate}` : '';

  const stats = useMemo(() => {
    const filtered = allSales.filter(s => dateInRange(s.date, startDate, endDate));
    const filteredExp = pharmacyExpenses.filter((e: any) => dateInRange(e.date, startDate, endDate));
    const filteredReturns = allReturns.filter((r: any) => dateInRange(r.date, startDate, endDate));

    const indoorSales = filtered.filter(s => s.type === 'Indoor');
    const outdoorSales = filtered.filter(s => s.type === 'Outdoor');

    const grossSales = filtered.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalRefunds = filteredReturns.reduce((sum, r) => sum + (r.totalRefund || 0), 0);
    const totalAmount = grossSales - totalRefunds; // NET revenue after returns
    const indoorAmount = indoorSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const outdoorAmount = outdoorSales.reduce((sum, s) => sum + s.totalAmount, 0);

    const totalMedicines = filtered.reduce((sum, s) => sum + s.items.reduce((is, item) => is + item.quantity, 0), 0);

    // Unique patients
    const uniquePatients = new Set(filtered.map(s => s.patientNo));

    // Top selling medicines
    const medMap: Record<string, { name: string; qty: number; total: number }> = {};
    filtered.forEach(s => {
      s.items.forEach(item => {
        if (!medMap[item.name]) {
          medMap[item.name] = { name: item.name, qty: 0, total: 0 };
        }
        medMap[item.name].qty += item.quantity;
        medMap[item.name].total += item.total;
      });
    });
    const topMeds = Object.values(medMap).sort((a, b) => b.total - a.total).slice(0, 10);

    // Expenses
    const totalExpenses = filteredExp.reduce((sum: number, e: any) => sum + e.amount, 0);

    // Calculate actual purchase cost from sold medicines
    const medicinesList: any[] = JSON.parse(localStorage.getItem('baga_medicines') || '[]');
    const medById: Record<string, any> = {};
    medicinesList.forEach((m: any) => { medById[m.id] = m; });
    let purchaseCost = 0;
    filtered.forEach(s => {
      s.items.forEach(item => {
        // Use stored purchasePrice from sale item (if available), else fallback to current inventory
        const cost = item.purchasePrice != null && item.purchasePrice > 0
          ? item.purchasePrice
          : (medById[item.medicineId]?.purchasePrice || 0);
        purchaseCost += item.quantity * cost;
      });
    });

    const profit = totalAmount - totalExpenses - purchaseCost;

    return {
      filtered,
      filteredExp,
      filteredReturns,
      totalSales: filtered.length,
      totalReturns: filteredReturns.length,
      grossSales,
      totalRefunds,
      indoorCount: indoorSales.length,
      outdoorCount: outdoorSales.length,
      totalAmount,
      indoorAmount,
      outdoorAmount,
      totalMedicines,
      uniquePatients: uniquePatients.size,
      topMeds,
      totalExpenses,
      profit,
    };
  }, [allSales, allReturns, pharmacyExpenses, startDate, endDate]);

  if (!session) return null;

  const generateStatementHTML = () => {
    const hosp = getHospital();
    const s = stats;
    const topMedRows = s.topMeds.slice(0, 10).map((m, i) => `<tr><td>${i+1}</td><td>${m.name}</td><td>${m.qty}</td><td>${currency} ${m.total.toLocaleString()}</td></tr>`).join('');
    const expRows = s.filteredExp.slice(0, 20).map((e: any, i: number) => `<tr><td>${i+1}</td><td>${e.description || '-'}</td><td>${e.category || '-'}</td><td>${e.date || '-'}</td><td>${currency} ${(e.amount || 0).toLocaleString()}</td></tr>`).join('');
    const salesRows = s.filtered.slice(0, 30).map((sl, i) => `<tr><td>${i+1}</td><td>${sl.date} ${sl.time}</td><td>${sl.patientName}</td><td>${sl.type}</td><td>${sl.items.length} items</td><td>${currency} ${sl.totalAmount.toLocaleString()}</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><title>Pharmacy Statement</title><style>
      body{font-family:Arial,sans-serif;padding:20px;color:#000;font-size:11px;}
      .header{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:15px;}
      .header h1{font-size:16px;margin:0;}
      .header p{margin:2px 0;font-size:10px;color:#000;}
      .title{text-align:center;font-size:13px;font-weight:bold;margin:10px 0;color:#000;}
      .subtitle{text-align:center;font-size:10px;color:#000;margin-bottom:15px;}
      table{width:100%;border-collapse:collapse;margin:10px 0;}
      th{background:#fff;border:1px solid #000;padding:5px;font-size:9px;text-align:left;}
      td{border:1px solid #000;padding:4px;font-size:10px;}
      .summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:15px 0;}
      .summary-box{border:1px solid #000;padding:8px;border-radius:4px;}
      .summary-box p{margin:2px 0;}
      .summary-box .val{font-size:14px;font-weight:bold;}
      .footer{text-align:center;margin-top:15px;font-size:9px;color:#000;border-top:1px solid #000;padding-top:8px;}
      .section-title{font-size:12px;font-weight:bold;margin:15px 0 5px;color:#000;border-bottom:1px solid #000;padding-bottom:3px;}
      @media print{body{padding:10px;}}
    </style></head><body>
    <div class="header">
      <h1>${hosp.name || 'BAGA Hospital'}</h1>
      ${hosp.address ? `<p>${hosp.address}</p>` : ''}
      ${hosp.phone ? `<p>Phone: ${hosp.phone}</p>` : ''}
      ${hosp.email ? `<p>Email: ${hosp.email}</p>` : ''}
    </div>
    <div class="title">Pharmacy Statement Report</div>
    <div class="subtitle">Period: ${startDate} to ${endDate} | Generated: ${new Date().toLocaleString()}</div>
    <div class="summary">
      <div class="summary-box"><p>Total Revenue</p><p class="val" style="color:#000">${currency} ${s.totalAmount.toLocaleString()}</p><p style="font-size:9px;color:#000">${s.totalSales} sales</p></div>
      <div class="summary-box"><p>Total Expenses</p><p class="val" style="color:#000">${currency} ${s.totalExpenses.toLocaleString()}</p><p style="font-size:9px;color:#000">${s.filteredExp.length} entries</p></div>
      <div class="summary-box"><p>Indoor Sales</p><p class="val" style="color:#000">${currency} ${s.indoorAmount.toLocaleString()}</p><p style="font-size:9px;color:#000">${s.indoorCount} patients</p></div>
      <div class="summary-box"><p>Outdoor Sales</p><p class="val" style="color:#000">${currency} ${s.outdoorAmount.toLocaleString()}</p><p style="font-size:9px;color:#000">${s.outdoorCount} patients</p></div>
    </div>
    <div class="section-title">Sales Details (${s.filtered.length} transactions)</div>
    <table><thead><tr><th>#</th><th>Date/Time</th><th>Patient</th><th>Type</th><th>Items</th><th>Amount</th></tr></thead><tbody>${salesRows}</tbody></table>
    <div class="section-title">Expense Details (${s.filteredExp.length} entries)</div>
    <table><thead><tr><th>#</th><th>Description</th><th>Category</th><th>Date</th><th>Amount</th></tr></thead><tbody>${expRows}</tbody></table>
    <div class="section-title">Top Selling Medicines</div>
    <table><thead><tr><th>#</th><th>Medicine</th><th>Qty Sold</th><th>Revenue</th></tr></thead><tbody>${topMedRows}</tbody></table>
    <div class="footer">Generated by BAGA HMS Pharmacy Management System | ${new Date().toLocaleDateString()}</div>
    </body></html>`;
  };

  const printStatementReport = () => {
    triggerPrint(generateStatementHTML());
  };

  const downloadStatementPDF = () => {
    const html = generateStatementHTML();
    const blob = new Blob([html], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pharmacy_Statement_${startDate}_to_${endDate}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium ${toastType === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toastMsg}
        </div>
      )}

      {/* Pharmacist Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-white font-bold text-lg">{session.name.charAt(0)}</div>
        <div className="flex-1">
          <p className="font-bold text-amber-800">{session.name}</p>
          <p className="text-sm text-amber-500">Pharmacist — Statement Report</p>
        </div>
        <button onClick={() => { setShowExpenseModal(true); setExpDate(todayStr()); }} className="btn btn-primary">
          + Add Expense
        </button>
        <button onClick={() => { setShowProfitModal(true); setProfitPwdError(''); }} className="btn btn-outline border-emerald-300 text-emerald-700 hover:bg-emerald-50 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Net Profit
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Gross Sales</p>
          <p className="text-2xl font-bold text-emerald-700">{currency} {stats.grossSales.toLocaleString()}</p>
          <p className="text-xs text-emerald-400">{stats.totalSales} sales</p>
        </div>
        <div className="stat-card card-hover border border-rose-200 bg-rose-50">
          <p className="text-xs text-rose-600 font-medium">Returns/Refunds</p>
          <p className="text-2xl font-bold text-rose-700">- {currency} {stats.totalRefunds.toLocaleString()}</p>
          <p className="text-xs text-rose-400">{stats.totalReturns} returns</p>
        </div>
        <div className="stat-card card-hover border border-teal-200 bg-teal-50">
          <p className="text-xs text-teal-600 font-medium">Net Revenue</p>
          <p className="text-2xl font-bold text-teal-700">{currency} {stats.totalAmount.toLocaleString()}</p>
          <p className="text-xs text-teal-400">After returns</p>
        </div>
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Indoor Sales</p>
          <p className="text-2xl font-bold text-blue-700">{currency} {stats.indoorAmount.toLocaleString()}</p>
          <p className="text-xs text-blue-400">{stats.indoorCount} patients</p>
        </div>
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Expenses</p>
          <p className="text-2xl font-bold text-amber-700">{currency} {stats.totalExpenses.toLocaleString()}</p>
          <p className="text-xs text-amber-400">{stats.filteredExp.length} entries</p>
        </div>
      </div>

      {/* Financial Summary Box */}
      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl border border-emerald-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Financial Summary ({filterLabel})
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Money Received</p>
            <p className="text-xl font-extrabold text-emerald-700">{currency} {stats.totalAmount.toLocaleString()}</p>
            <p className="text-xs text-slate-400">Total sales amount</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">From Indoor Patients</p>
            <p className="text-xl font-extrabold text-blue-700">{currency} {stats.indoorAmount.toLocaleString()}</p>
            <p className="text-xs text-slate-400">{stats.indoorCount} transactions</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">From Outdoor Patients</p>
            <p className="text-xl font-extrabold text-purple-700">{currency} {stats.outdoorAmount.toLocaleString()}</p>
            <p className="text-xs text-slate-400">{stats.outdoorCount} transactions</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Expenses</p>
            <p className="text-xl font-extrabold text-amber-700">{currency} {stats.totalExpenses.toLocaleString()}</p>
            <p className="text-xs text-slate-400">{stats.filteredExp.length} entries</p>
          </div>
        </div>
        <div className="flex items-center justify-end mt-3 gap-2">
          <button onClick={printStatementReport} className="btn btn-outline btn-sm flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print Statement
          </button>
          <button onClick={downloadStatementPDF} className="btn btn-primary btn-sm flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Download PDF
          </button>
        </div>
      </div>

      {/* Top Selling Medicines */}
      {stats.topMeds.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            <h3 className="font-bold text-slate-800">Top Selling Medicines</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Medicine Name</th>
                  <th className="text-center">Quantity Sold</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.topMeds.map((med, idx) => (
                  <tr key={med.name} className="hover:bg-slate-50">
                    <td className="text-slate-400 text-sm">{idx + 1}</td>
                    <td className="font-semibold text-slate-800">{med.name}</td>
                    <td className="text-center">
                      <span className="badge badge-blue">{med.qty}</span>
                    </td>
                    <td className="text-right font-bold text-emerald-700">{currency} {med.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sales Detail List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="font-bold text-slate-800">Sales Detail ({filterLabel})</h3>
          </div>
          <span className="badge badge-emerald">{stats.totalSales} sales</span>
        </div>

        {stats.filtered.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
            <p className="text-slate-400 font-medium">No sales found for this period</p>
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
                  <th>Type</th>
                  <th className="text-center">Items</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.filtered
                  .sort((a, b) => {
                    // Sort by date descending, then time descending (newest first)
                    const dateCmp = b.date.localeCompare(a.date);
                    if (dateCmp !== 0) return dateCmp;
                    return b.time.localeCompare(a.time);
                  })
                  .map((sale, idx) => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="text-slate-400 text-sm">{idx + 1}</td>
                      <td className="font-medium text-slate-700">{sale.date}</td>
                      <td className="text-slate-500">{sale.time}</td>
                      <td>
                        <div>
                          <p className="font-semibold text-slate-800">{sale.patientName}</p>
                          <p className="text-xs text-slate-400">
                            {(sale as any).billSerial ? `Annual: ${(sale as any).billSerial}` : sale.patientNo}
                            {sale.patientMobile ? ` — ${sale.patientMobile}` : ''}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${sale.type === 'Indoor' ? 'badge-blue' : 'badge-amber'}`}>{sale.type}</span>
                      </td>
                      <td className="text-center">
                        <span className="badge badge-slate">{sale.items.length} item{sale.items.length !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="text-right font-bold text-emerald-700">{currency} {sale.totalAmount.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-50">
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={6} className="px-4 py-3 text-right font-bold text-slate-700">Grand Total:</td>
                  <td className="px-4 py-3 text-right font-extrabold text-emerald-700 text-lg">{currency} {stats.totalAmount.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Pharmacy Expenses Detail */}
      {stats.filteredExp.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <h3 className="font-bold text-slate-800">Pharmacy Expenses ({filterLabel})</h3>
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
                  <th>Supplier</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {stats.filteredExp
                  .sort((a: any, b: any) => b.date.localeCompare(a.date))
                  .map((exp: any, idx: number) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="text-slate-400 text-sm">{idx + 1}</td>
                      <td className="font-medium text-slate-700">{exp.date}</td>
                      <td className="font-semibold text-slate-800">{exp.description}</td>
                      <td>
                        <span className="badge badge-slate">{exp.category}</span>
                      </td>
                      <td className="text-right font-bold text-rose-700">{currency} {exp.amount.toLocaleString()}</td>
                      <td className="text-sm text-slate-500">{exp.supplier || '-'}</td>
                      <td className="text-sm text-slate-500">{exp.notes || '-'}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-50">
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-slate-700">Total Expenses:</td>
                  <td className="px-4 py-3 text-right font-extrabold text-rose-700 text-lg">{currency} {stats.totalExpenses.toLocaleString()}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Net Profit Modal */}
      {showProfitModal && (
        <div className="modal-overlay" onClick={() => { setShowProfitModal(false); setProfitData(null); setProfitPwd(''); setProfitPwdError(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800">Net Profit Calculation</h3>
              <button onClick={() => { setShowProfitModal(false); setProfitData(null); setProfitPwd(''); setProfitPwdError(''); }} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            {!profitData ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">Enter the profit report password to view net profit calculation.</p>
                <div>
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={profitPwd}
                    onChange={e => setProfitPwd(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleNetProfit(); }}
                    placeholder="Enter profit password"
                    autoFocus
                  />
                  {profitPwdError && <p className="text-red-500 text-xs mt-1">{profitPwdError}</p>}
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => { setShowProfitModal(false); setProfitData(null); setProfitPwd(''); setProfitPwdError(''); }} className="btn btn-outline">Cancel</button>
                  <button onClick={handleNetProfit} className="btn btn-primary">Show Profit</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-emerald-600 font-medium">Total Sales Revenue</p>
                    <p className="text-xl font-extrabold text-emerald-700">{currency} {profitData.totalSales.toLocaleString()}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-amber-600 font-medium">Total Expenses</p>
                    <p className="text-xl font-extrabold text-amber-700">{currency} {profitData.totalExpenses.toLocaleString()}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-blue-600 font-medium">Medicine Purchase Cost</p>
                    <p className="text-xl font-extrabold text-blue-700">{currency} {profitData.purchaseCost.toLocaleString()}</p>
                  </div>
                  <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-violet-600 font-medium">Gross Profit</p>
                    <p className="text-xl font-extrabold text-violet-700">{currency} {profitData.grossProfit.toLocaleString()}</p>
                    <p className="text-xs text-violet-400 mt-1">Revenue - Purchase Cost</p>
                  </div>
                  <div className={`border-2 rounded-lg p-4 text-center col-span-2 ${profitData.netProfit >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
                    <p className="text-xs font-medium" style={{ color: profitData.netProfit >= 0 ? '#047857' : '#b91c1c' }}>Net Profit</p>
                    <p className={`text-2xl font-black ${profitData.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {profitData.netProfit >= 0 ? '' : '-'}{currency} {Math.abs(profitData.netProfit).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Revenue - Expenses - Purchase Cost</p>
                  </div>
                </div>
                {Object.keys(profitData.purchaseCostBreakdown).length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Purchase Cost Breakdown (from sold medicines)</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {Object.entries(profitData.purchaseCostBreakdown).map(([desc, amt]) => (
                        <div key={desc} className="flex justify-between text-sm">
                          <span className="text-slate-600">{desc}</span>
                          <span className="font-mono font-semibold text-slate-800">{currency} {Number(amt).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold border-t border-slate-300 pt-1 mt-1">
                        <span className="text-slate-700">Total Purchase Cost</span>
                        <span className="text-emerald-700">{currency} {profitData.purchaseCost.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 justify-end">
                  <button onClick={() => { setShowProfitModal(false); setProfitData(null); setProfitPwd(''); setProfitPwdError(''); }} className="btn btn-outline">Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800">Add Pharmacy Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label">Description *</label>
                <input type="text" className="form-input" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="e.g. Medicine Stock Purchase" />
              </div>
              <div>
                <label className="form-label">Category *</label>
                <select className="form-input" value={expCategory} onChange={e => setExpCategory(e.target.value)}>
                  {PHARMACY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
                <label className="form-label">Supplier</label>
                <input type="text" className="form-input" value={expSupplier} onChange={e => setExpSupplier(e.target.value)} placeholder="Optional supplier name" />
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
