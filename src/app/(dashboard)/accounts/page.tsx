'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getBills, updateBill, getVisits, getLabOrders, getXRayOrders, getUltrasoundOrders,
  getPrescriptions, getDispenses, getAdmissions, getHospitalSettings, todayStr, timeStr, genId,
  searchPatients, getSalaryRecords, updateSalaryRecord,
} from '@/lib/store';
import type { Bill, Visit, LabOrder, XRayOrder, UltrasoundOrder, Prescription, DispenseRecord, Admission, SalaryRecord } from '@/lib/types';
import { triggerPrint } from '@/lib/print-utils';

/* ──────────────────────────── local helpers ──────────────────────────── */
function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}
function lsSet<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

interface DoctorPayment {
  id: string; doctorName: string; amount: number; date: string; time: string; notes: string; receivedBy: string;
}
interface Expense {
  id: string; description: string; amount: number; category: string; date: string; time: string; addedBy: string;
}
interface DoctorPayRecord {
  id: string; doctorName: string; totalEarned: number; totalPaid: number; balance: number; payments: DoctorPayment[];
}

const EXPENSE_CATEGORIES = [
  'Utilities', 'Salary', 'Medical Supplies', 'Equipment', 'Rent', 'Maintenance',
  'Medicine Purchase', 'Laboratory Supplies', 'Cleaning', 'Transport', 'Food', 'Miscellaneous',
];

const DEPARTMENTS = ['All', 'OPD', 'Lab', 'X-Ray', 'Ultrasound', 'Pharmacy', 'Admission'] as const;
type DeptFilter = typeof DEPARTMENTS[number];

/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */
export default function AccountsPage() {
  /* ─── state ─── */
  const [mainTab, setMainTab] = useState<'dashboard' | 'bills' | 'reports' | 'doctor-payments' | 'expenses' | 'salaries'>('dashboard');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Core data
  const [bills, setBills] = useState<Bill[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [xrayOrders, setXrayOrders] = useState<XRayOrder[]>([]);
  const [usgOrders, setUsgOrders] = useState<UltrasoundOrder[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [dispenses, setDispenses] = useState<DispenseRecord[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [settings, setSettings] = useState({ hospitalCutRatio: 40, currency: 'Rs.', roomChargesPerNight: 1500, admissionFee: 2000 });
  const [doctorPayments, setDoctorPayments] = useState<DoctorPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Bills tab state
  const [billSearch, setBillSearch] = useState('');
  const [billStatusFilter, setBillStatusFilter] = useState<'all' | 'Paid' | 'Unpaid' | 'Partial'>('all');
  const [collectModal, setCollectModal] = useState<Bill | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState<'Cash' | 'Card'>('Cash');
  const [receiptModal, setReceiptModal] = useState<Bill | null>(null);

  // Reports tab state
  const [reportFromDate, setReportFromDate] = useState('');
  const [reportToDate, setReportToDate] = useState('');
  const [reportDept, setReportDept] = useState<DeptFilter>('All');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Doctor Payments tab state
  const [payModalDoctor, setPayModalDoctor] = useState<string | null>(null);
  const [payModalAmount, setPayModalAmount] = useState('');
  const [payModalNotes, setPayModalNotes] = useState('');

  // Expenses tab state
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expDate, setExpDate] = useState(todayStr());

  // Salaries tab state
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [salaryMonth, setSalaryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [salaryDetailModal, setSalaryDetailModal] = useState<SalaryRecord | null>(null);

  /* ─── load all data ─── */
  const loadData = useCallback(() => {
    setBills(getBills());
    setVisits(getVisits());
    setLabOrders(getLabOrders());
    setXrayOrders(getXRayOrders());
    setUsgOrders(getUltrasoundOrders());
    setPrescriptions(getPrescriptions());
    setDispenses(getDispenses());
    setAdmissions(getAdmissions());
    const s = getHospitalSettings();
    setSettings({ hospitalCutRatio: s.hospitalCutRatio, currency: s.currency, roomChargesPerNight: s.roomChargesPerNight, admissionFee: s.admissionFee });
    setDoctorPayments(lsGet<DoctorPayment[]>('baga_doctor_payments', []));
    setExpenses(lsGet<Expense[]>('baga_expenses', []));
    setSalaryRecords(getSalaryRecords().filter(s => s.forwardedToAccountant));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ─── helpers ─── */
  const cur = settings.currency;
  const today = todayStr();
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const inDateRange = (date: string, from: string, to: string) => {
    if (!from && !to) return true;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  const filterByDept = (items: { date: string; type?: string }[], dept: DeptFilter) => {
    return items.filter(item => {
      if (dept === 'All') return true;
      const t = (item as Bill & { items?: unknown }).items
        ? ((item as unknown as Bill).items as { type: string }[]).some((i: { type: string }) => {
            if (dept === 'OPD') return i.type === 'Consultation' || i.type === 'Renewal' || i.type === 'Card';
            return i.type === dept;
          })
        : false;
      return t;
    });
  };

  /* ═══════════════════ COMPUTED VALUES ═══════════════════ */

  // Dashboard stats
  const todayBills = useMemo(() => bills.filter(b => b.date === today), [bills, today]);
  const monthBills = useMemo(() => bills.filter(b => b.date.startsWith(monthStr)), [bills, monthStr]);
  const unpaidBills = useMemo(() => bills.filter(b => b.status === 'Unpaid' || b.status === 'Partial'), [bills]);

  const todayCollection = todayBills.reduce((s, b) => s + b.paidAmount, 0);
  const monthCollection = monthBills.reduce((s, b) => s + b.paidAmount, 0);
  const totalRevenue = bills.reduce((s, b) => s + b.paidAmount, 0);
  const pendingBills = unpaidBills.reduce((s, b) => s + (b.totalAmount - b.paidAmount), 0);
  const todayBillsCount = todayBills.length;
  const monthBillsCount = monthBills.length;

  // All unique doctors
  const allDoctors = useMemo(() => {
    const map = new Map<string, { name: string; dept: string; fee: number }>();
    visits.forEach(v => {
      if (!map.has(v.doctor)) map.set(v.doctor, { name: v.doctor, dept: v.department, fee: v.doctorFee });
    });
    return Array.from(map.values());
  }, [visits]);

  /* ─── Report data ─── */
  const reportFrom = reportFromDate || '2000-01-01';
  const reportTo = reportToDate || '2099-12-31';

  const reportBills = useMemo(() => bills.filter(b => inDateRange(b.date, reportFrom, reportTo)), [bills, reportFrom, reportTo]);
  const reportVisits = useMemo(() => visits.filter(v => inDateRange(v.date, reportFrom, reportTo)), [visits, reportFrom, reportTo]);
  const reportLabOrders = useMemo(() => labOrders.filter(o => inDateRange(o.date, reportFrom, reportTo)), [labOrders, reportFrom, reportTo]);
  const reportXrayOrders = useMemo(() => xrayOrders.filter(o => inDateRange(o.date, reportFrom, reportTo)), [xrayOrders, reportFrom, reportTo]);
  const reportUsgOrders = useMemo(() => usgOrders.filter(o => inDateRange(o.date, reportFrom, reportTo)), [usgOrders, reportFrom, reportTo]);
  const reportDispenses = useMemo(() => dispenses.filter(d => inDateRange(d.date, reportFrom, reportTo)), [dispenses, reportFrom, reportTo]);
  const reportAdmissions = useMemo(() => admissions.filter(a => inDateRange(a.admissionDate, reportFrom, reportTo) || inDateRange(a.dischargedAt, reportFrom, reportTo) || inDateRange(a.createdAt, reportFrom, reportTo)), [admissions, reportFrom, reportTo]);
  const reportExpenses = useMemo(() => expenses.filter(e => inDateRange(e.date, reportFrom, reportTo)), [expenses, reportFrom, reportTo]);

  // Revenue Summary
  const revenueSummary = useMemo(() => {
    let filtered = reportBills;
    if (reportDept !== 'All') {
      filtered = filtered.filter(b => b.items.some(i => {
        if (reportDept === 'OPD') return i.type === 'Consultation' || i.type === 'Renewal' || i.type === 'Card';
        return i.type === reportDept;
      }));
    }
    const totalBilled = filtered.reduce((s, b) => s + b.totalAmount, 0);
    const totalCollected = filtered.reduce((s, b) => s + b.paidAmount, 0);
    const totalPending = totalBilled - totalCollected;
    return { totalBilled, totalCollected, totalPending, billCount: filtered.length };
  }, [reportBills, reportDept]);

  // Doctor-wise Report
  const doctorReport = useMemo(() => {
    return allDoctors.map(doc => {
      const docVisits = reportVisits.filter(v => v.doctor === doc.name);
      const totalVisits = docVisits.length;
      const totalFee = docVisits.reduce((s, v) => s + v.doctorFee, 0);
      const hospCut = Math.round(totalFee * settings.hospitalCutRatio / 100);
      const docShare = totalFee - hospCut;
      const collectedAmount = docVisits.reduce((s, v) => {
        const bill = bills.find(b => b.visitId === v.id);
        const paid = bill?.paidAmount || 0;
        const feeItems = bill?.items.filter(i => i.type === 'Consultation').reduce((a, i) => a + i.amount, 0) || 0;
        return s + (bill && bill.paidAmount > 0 ? Math.min(paid, feeItems || v.doctorFee) : 0);
      }, 0);
      const pendingAmount = totalFee - collectedAmount;
      return { name: doc.name, dept: doc.dept, totalVisits, totalFee, hospCut, docShare, collectedAmount, pendingAmount };
    }).filter(d => d.totalVisits > 0).sort((a, b) => b.totalFee - a.totalFee);
  }, [allDoctors, reportVisits, bills, settings.hospitalCutRatio]);

  // Department-wise reports
  const labReport = useMemo(() => {
    const orders = reportLabOrders;
    const totalTests = orders.reduce((s, o) => s + o.tests.filter(t => t.selected).length, 0);
    const totalBilled = orders.reduce((s, o) => s + o.tests.filter(t => t.selected).reduce((a, t) => a + t.price, 0), 0);
    // collected from bills for lab items
    const labBillItems = reportBills.flatMap(b => b.items.filter(i => i.type === 'Lab'));
    const collectedFromBills = labBillItems.reduce((s, i) => s + i.amount, 0);
    // more accurate: find bills matching lab orders
    const collected = orders.reduce((s, o) => {
      const bill = bills.find(b => b.visitId === o.visitId);
      const labItems = bill?.items.filter(i => i.type === 'Lab') || [];
      return s + labItems.reduce((a, i) => a + i.amount, 0);
    }, 0);
    const pending = totalBilled - collected;
    return { totalTests, totalBilled, collected, pending };
  }, [reportLabOrders, reportBills, bills]);

  const xrayReport = useMemo(() => {
    const orders = reportXrayOrders;
    const totalOrders = orders.length;
    const totalBilled = orders.reduce((s, o) => s + o.price, 0);
    const collected = orders.reduce((s, o) => {
      const bill = bills.find(b => b.visitId === o.visitId);
      const xrayItems = bill?.items.filter(i => i.type === 'X-Ray') || [];
      return s + xrayItems.reduce((a, i) => a + i.amount, 0);
    }, 0);
    const pending = totalBilled - collected;
    return { totalOrders, totalBilled, collected, pending };
  }, [reportXrayOrders, bills]);

  const usgReport = useMemo(() => {
    const orders = reportUsgOrders;
    const totalOrders = orders.length;
    const totalBilled = orders.reduce((s, o) => s + o.price, 0);
    const collected = orders.reduce((s, o) => {
      const bill = bills.find(b => b.visitId === o.visitId);
      const usgItems = bill?.items.filter(i => i.type === 'Ultrasound') || [];
      return s + usgItems.reduce((a, i) => a + i.amount, 0);
    }, 0);
    const pending = totalBilled - collected;
    return { totalOrders, totalBilled, collected, pending };
  }, [reportUsgOrders, bills]);

  const pharmacyReport = useMemo(() => {
    // Pharmacy revenue comes from dispense records + bill items with type Pharmacy
    const dispCount = reportDispenses.length;
    const pharmacyBills = reportBills.filter(b => b.items.some(i => i.type === 'Pharmacy'));
    const totalBilled = pharmacyBills.reduce((s, b) => s + b.items.filter(i => i.type === 'Pharmacy').reduce((a, i) => a + i.amount, 0), 0);
    const collected = totalBilled; // pharmacy usually collected at time of dispense
    // Indoor vs outdoor
    const outdoorBills = pharmacyBills.filter(b => {
      const visit = visits.find(v => v.id === b.visitId);
      const admit = admissions.find(a => a.patientId === b.patientId && a.status === 'Admitted');
      return !admit;
    });
    const indoorBills = pharmacyBills.filter(b => {
      const admit = admissions.find(a => a.patientId === b.patientId && a.status === 'Admitted');
      return !!admit;
    });
    const outdoorRevenue = outdoorBills.reduce((s, b) => s + b.items.filter(i => i.type === 'Pharmacy').reduce((a, i) => a + i.amount, 0), 0);
    const indoorRevenue = indoorBills.reduce((s, b) => s + b.items.filter(i => i.type === 'Pharmacy').reduce((a, i) => a + i.amount, 0), 0);
    return { dispCount, totalBilled, collected, outdoorRevenue, indoorRevenue };
  }, [reportDispenses, reportBills, visits, admissions]);

  const admissionReport = useMemo(() => {
    const totalAdmissions = reportAdmissions.length;
    const admissionBills = reportBills.filter(b => b.items.some(i => i.type === 'Admission'));
    const totalBilled = admissionBills.reduce((s, b) => s + b.items.filter(i => i.type === 'Admission').reduce((a, i) => a + i.amount, 0), 0);
    const collected = totalBilled;
    return { totalAdmissions, totalBilled, collected };
  }, [reportAdmissions, reportBills]);

  // Monthly Comparison
  const monthlyComparison = useMemo(() => {
    const months = new Map<string, { billed: number; collected: number; pending: number; visits: number }>();
    reportBills.forEach(b => {
      const m = b.date.substring(0, 7);
      if (!months.has(m)) months.set(m, { billed: 0, collected: 0, pending: 0, visits: 0 });
      const entry = months.get(m)!;
      entry.billed += b.totalAmount;
      entry.collected += b.paidAmount;
      entry.pending += (b.totalAmount - b.paidAmount);
    });
    reportVisits.forEach(v => {
      const m = v.date.substring(0, 7);
      if (!months.has(m)) months.set(m, { billed: 0, collected: 0, pending: 0, visits: 0 });
      months.get(m)!.visits += 1;
    });
    return Array.from(months.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [reportBills, reportVisits]);

  // Patient search for reports
  const patientResults = useMemo(() => {
    if (!patientSearchQuery || patientSearchQuery.length < 1) return [];
    return searchPatients(patientSearchQuery).slice(0, 20);
  }, [patientSearchQuery]);

  const selectedPatientBills = useMemo(() => {
    if (!selectedPatientId) return [];
    return bills.filter(b => b.patientId === selectedPatientId).sort((a, b) => b.date.localeCompare(a.date));
  }, [bills, selectedPatientId]);

  const selectedPatientName = useMemo(() => {
    if (!selectedPatientId) return '';
    const p = patientResults.find(p => p.id === selectedPatientId);
    return p ? `${p.name} (${p.patientNo})` : selectedPatientId;
  }, [selectedPatientId, patientResults]);

  // Doctor Payments computed
  const doctorPayRecords = useMemo((): DoctorPayRecord[] => {
    return allDoctors.map(doc => {
      const allVisits = visits.filter(v => v.doctor === doc.name);
      const totalFee = allVisits.reduce((s, v) => s + v.doctorFee, 0);
      const hospCut = Math.round(totalFee * settings.hospitalCutRatio / 100);
      const totalEarned = totalFee - hospCut;
      const payments = doctorPayments.filter(p => p.doctorName === doc.name);
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
      return { id: doc.name, doctorName: doc.name, totalEarned, totalPaid, balance: totalEarned - totalPaid, payments };
    }).filter(d => d.totalEarned > 0).sort((a, b) => b.balance - a.balance);
  }, [allDoctors, visits, settings.hospitalCutRatio, doctorPayments]);

  // Expenses summary
  const expenseSummary = useMemo(() => {
    const byCategory = new Map<string, number>();
    let total = 0;
    reportExpenses.forEach(e => {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
      total += e.amount;
    });
    return { total, byCategory: Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]) };
  }, [reportExpenses]);

  /* ─── Filtered bills for Bills tab ─── */
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const matchSearch = !billSearch || b.patientName.toLowerCase().includes(billSearch.toLowerCase()) || b.patientNo.toLowerCase().includes(billSearch.toLowerCase()) || b.id.toLowerCase().includes(billSearch.toLowerCase());
      const matchStatus = billStatusFilter === 'all' || b.status === billStatusFilter;
      return matchSearch && matchStatus;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  }, [bills, billSearch, billStatusFilter]);

  /* ═══════════════════ HANDLERS ═══════════════════ */

  const handleCollect = () => {
    if (!collectModal || !collectAmount) return;
    const amt = Number(collectAmount);
    const balance = collectModal.totalAmount - collectModal.paidAmount;
    if (amt <= 0 || amt > balance) { showToast('Invalid amount', 'error'); return; }
    const newPaid = collectModal.paidAmount + amt;
    const newStatus: Bill['status'] = newPaid >= collectModal.totalAmount ? 'Paid' : 'Partial';
    updateBill(collectModal.id, { paidAmount: newPaid, status: newStatus, paymentMethod: collectMethod, receivedBy: 'Accountant' });
    showToast(`${cur} ${amt.toLocaleString()} collected successfully`, 'success');
    setCollectModal(null); setCollectAmount(''); loadData();
  };

  const handleDoctorPay = () => {
    if (!payModalDoctor || !payModalAmount || Number(payModalAmount) <= 0) { showToast('Enter a valid amount', 'error'); return; }
    const payment: DoctorPayment = {
      id: genId(), doctorName: payModalDoctor, amount: Number(payModalAmount),
      date: todayStr(), time: timeStr(), notes: payModalNotes, receivedBy: 'Accountant',
    };
    const all = [...doctorPayments, payment];
    lsSet('baga_doctor_payments', all);
    setDoctorPayments(all);
    showToast(`${cur} ${Number(payModalAmount).toLocaleString()} paid to ${payModalDoctor}`, 'success');
    setPayModalDoctor(null); setPayModalAmount(''); setPayModalNotes('');
  };

  const handleAddExpense = () => {
    if (!expDesc || !expAmount || Number(expAmount) <= 0) { showToast('Fill all required fields', 'error'); return; }
    const expense: Expense = {
      id: genId(), description: expDesc, amount: Number(expAmount), category: expCategory,
      date: expDate, time: timeStr(), addedBy: 'Accountant',
    };
    const all = [...expenses, expense];
    lsSet('baga_expenses', all);
    setExpenses(all);
    setExpDesc(''); setExpAmount('');
    showToast('Expense added successfully', 'success');
  };

  const handleDeleteExpense = (id: string) => {
    const all = expenses.filter(e => e.id !== id);
    lsSet('baga_expenses', all);
    setExpenses(all);
    showToast('Expense deleted', 'success');
  };

  const handlePrintReceipt = () => {
    if (!receiptModal) return;
    const itemsHtml = receiptModal.items.map(item =>
      `<tr><td>${item.type}</td><td>${item.description}${item.quantity > 1 ? ' x' + item.quantity : ''}</td><td style="text-align:right">${cur} ${item.amount.toLocaleString()}</td></tr>`
    ).join('');
    const balance = receiptModal.totalAmount - receiptModal.paidAmount;
    const html = `<!DOCTYPE html><html><head><title>Receipt - ${receiptModal.id}</title><style>body{font-family:Arial,sans-serif;padding:30px;max-width:500px;margin:0 auto;color:#333}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{padding:6px 8px;text-align:left;font-size:13px;border-bottom:1px solid #e2e8f0}th{background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b}.total{font-weight:bold;font-size:15px;border-top:2px solid #1e293b;padding-top:8px}.paid{color:#059669}.balance{color:#dc2626}.header{text-align:center;border-bottom:2px solid #1e293b;padding-bottom:12px;margin-bottom:16px}.header h1{font-size:20px;color:#1e293b}.header p{font-size:11px;color:#64748b}</style></head><body><div class="header"><h1>Bill Receipt</h1><p>${receiptModal.date} ${receiptModal.time}</p></div><table><tr><th colspan="2">Bill ID</th><td style="text-align:right">${receiptModal.id}</td></tr><tr><th colspan="2">Patient</th><td style="text-align:right">${receiptModal.patientName} (${receiptModal.patientNo})</td></tr></table><table><thead><tr><th>Type</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>${itemsHtml}</tbody></table><table><tr class="total"><td colspan="2">Total</td><td style="text-align:right">${cur} ${receiptModal.totalAmount.toLocaleString()}</td></tr><tr class="paid"><td colspan="2">Paid</td><td style="text-align:right">${cur} ${receiptModal.paidAmount.toLocaleString()}</td></tr>${balance > 0 ? `<tr class="balance"><td colspan="2">Balance</td><td style="text-align:right">${cur} ${balance.toLocaleString()}</td></tr>` : ''}<tr><td>Status</td><td>${receiptModal.status}</td><td style="text-align:right">${receiptModal.paymentMethod}</td></tr></table><p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:20px">Received By: ${receiptModal.receivedBy}</p></body></html>`;
    triggerPrint(html);
  };

  const handlePrintReport = () => {
    // Generate a clean print-specific HTML instead of sending the entire DOM
    // (sending full DOM via data: URL causes print timeout)
    const html = `<!DOCTYPE html><html><head><title>Accounts Report</title><style>
      body{font-family:Arial,sans-serif;padding:20px;color:#333;font-size:12px}
      h2{font-size:16px;margin-bottom:12px;color:#1e293b}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{padding:5px 8px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:11px}
      th{background:#f1f5f9;color:#475569;font-weight:600}
      .num{text-align:right}
      .total-row{font-weight:bold;border-top:2px solid #1e293b}
      .hdr{text-align:center;border-bottom:2px solid #1e293b;padding-bottom:8px;margin-bottom:16px}
      @media print{body{padding:10px}}
    </style></head><body>
      <div class="hdr"><h1>BAGA Hospital Management System</h1><p>Accounts Report</p></div>
      <h2>${bills.length} Transaction(s)</h2>
      <table><thead><tr><th>ID</th><th>Date</th><th>Patient</th><th>Type</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead>
      <tbody>${bills.map(r => {
        const bal = r.totalAmount - r.paidAmount;
        return `<tr><td>${r.id}</td><td>${r.date}</td><td>${r.patientName || '-'}</td><td>${r.type || '-'}</td><td class="num">${cur} ${r.totalAmount.toLocaleString()}</td><td class="num">${cur} ${r.paidAmount.toLocaleString()}</td><td class="num">${cur} ${bal.toLocaleString()}</td><td>${r.status}</td></tr>`;
      }).join('')}</tbody></table>
    </body></html>`;
    triggerPrint(html);
  };

  // Salary handlers for Accountant
  const loadSalaries = useCallback(() => {
    const all = getSalaryRecords().filter(s => s.forwardedToAccountant);
    setSalaryRecords(all);
  }, []);
  useEffect(() => { loadSalaries(); }, [loadSalaries]);
  const filteredSalaryRecords = useMemo(() => salaryRecords.filter(s => s.month === salaryMonth), [salaryRecords, salaryMonth]);
  const salaryTotalNet = filteredSalaryRecords.reduce((t, s) => t + s.netSalary, 0);
  const salaryPaidCount = filteredSalaryRecords.filter(s => s.status === 'Paid' || s.status === 'Partial').length;
  const salaryPendingCount = filteredSalaryRecords.filter(s => s.status !== 'Paid' && s.status !== 'Partial').length;
  const salaryPaidAmount = filteredSalaryRecords.filter(s => s.status === 'Paid').reduce((t, s) => t + s.netSalary, 0);
  const handleAccountantPay = (record: SalaryRecord) => {
    updateSalaryRecord(record.id, { status: 'Paid', paidDate: todayStr(), accountantPaidDate: todayStr() });
    showToast(`${record.employeeName} salary marked as Paid - Rs. ${record.netSalary.toLocaleString()}`, 'success');
    loadSalaries();
  };
  const handleAccountantPartial = (record: SalaryRecord) => {
    if (!confirm(`Mark ${record.employeeName}'s salary as Partial Payment?`)) return;
    updateSalaryRecord(record.id, { status: 'Partial', paidDate: todayStr(), accountantPaidDate: todayStr() });
    showToast(`${record.employeeName} marked as Partial`, 'success');
    loadSalaries();
  };
  const handleAccountantPayAll = () => {
    const pending = filteredSalaryRecords.filter(s => s.status !== 'Paid' && s.status !== 'Partial');
    if (pending.length === 0) { showToast('No pending salaries to pay', 'error'); return; }
    if (confirm(`Pay all ${pending.length} pending salaries? Total: Rs. ${pending.reduce((t, s) => t + s.netSalary, 0).toLocaleString()}`)) {
      pending.forEach(s => { updateSalaryRecord(s.id, { status: 'Paid', paidDate: todayStr(), accountantPaidDate: todayStr() }); });
      showToast(`${pending.length} salaries marked as Paid`, 'success');
      loadSalaries();
    }
  };
  const formatSalaryMonth = (m: string) => {
    const [y, mo] = m.split('-');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[parseInt(mo) - 1]} ${y}`;
  };
  const salaryMonthOptions: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    salaryMonthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  /* ═══════════════════ TAB ICONS ═══════════════════ */
  const TabIcon = ({ name }: { name: string }) => {
    const icons: Record<string, React.ReactNode> = {
      dashboard: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
      bills: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      reports: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
      'doctor-payments': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      expenses: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      salaries: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    };
    return icons[name] || null;
  };

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Accounts & Billing</h2>
            <p className="text-sm text-slate-500">Financial management and reporting</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
        {([
          { key: 'dashboard' as const, label: 'Dashboard' },
          { key: 'bills' as const, label: 'Bills' },
          { key: 'reports' as const, label: 'Reports' },
          { key: 'doctor-payments' as const, label: 'Doctor Payments' },
          { key: 'expenses' as const, label: 'Expenses' },
          { key: 'salaries' as const, label: 'Salaries' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${mainTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <TabIcon name={tab.key} />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════ TAB 1: DASHBOARD ═══════════════ */}
      {mainTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-emerald-600 font-medium">Today&apos;s Collection</p>
                <div className="w-8 h-8 rounded-lg bg-emerald-200/60 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-700">{cur} {todayCollection.toLocaleString()}</p>
              <p className="text-xs text-emerald-500 mt-1">{todayBillsCount} bills today</p>
            </div>
            <div className="stat-card card-hover border border-blue-200 bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-blue-600 font-medium">Monthly Collection</p>
                <div className="w-8 h-8 rounded-lg bg-blue-200/60 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-700">{cur} {monthCollection.toLocaleString()}</p>
              <p className="text-xs text-blue-500 mt-1">{monthBillsCount} bills this month</p>
            </div>
            <div className="stat-card card-hover border border-purple-200 bg-purple-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-purple-600 font-medium">Total Revenue</p>
                <div className="w-8 h-8 rounded-lg bg-purple-200/60 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-purple-700">{cur} {totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-purple-500 mt-1">{bills.length} total bills</p>
            </div>
            <div className="stat-card card-hover border border-red-200 bg-red-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-red-600 font-medium">Pending Bills</p>
                <div className="w-8 h-8 rounded-lg bg-red-200/60 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-red-700">{cur} {pendingBills.toLocaleString()}</p>
              <p className="text-xs text-red-500 mt-1">{unpaidBills.length} unpaid bills</p>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{reportVisits.length}</p>
              <p className="text-xs text-slate-500">Total Visits</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{reportLabOrders.length}</p>
              <p className="text-xs text-slate-500">Lab Orders</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{reportXrayOrders.length}</p>
              <p className="text-xs text-slate-500">X-Ray Orders</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{reportUsgOrders.length}</p>
              <p className="text-xs text-slate-500">Ultrasound Orders</p>
            </div>
          </div>

          {/* Recent Bills */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Recent Bills</h3>
              <button onClick={() => setMainTab('bills')} className="btn btn-outline btn-sm">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Patient</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {bills.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).slice(0, 5).map(bill => (
                    <tr key={bill.id}>
                      <td className="whitespace-nowrap">{bill.date}</td>
                      <td><span className="font-medium">{bill.patientName}</span> <span className="text-xs text-slate-400">{bill.patientNo}</span></td>
                      <td className="font-semibold">{cur} {bill.totalAmount.toLocaleString()}</td>
                      <td><span className={`badge ${bill.status === 'Paid' ? 'badge-green' : bill.status === 'Unpaid' ? 'badge-red' : 'badge-amber'}`}>{bill.status}</span></td>
                      <td><button onClick={() => setReceiptModal(bill)} className="btn btn-outline btn-sm">Receipt</button></td>
                    </tr>
                  ))}
                  {bills.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-8">No bills yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB 2: BILLS ═══════════════ */}
      {mainTab === 'bills' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-48">
                <input className="form-input" placeholder="Search by patient, number, or bill ID..." value={billSearch} onChange={e => setBillSearch(e.target.value)} />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'Paid', 'Unpaid', 'Partial'] as const).map(s => (
                  <button key={s} onClick={() => setBillStatusFilter(s)} className={`btn ${billStatusFilter === s ? 'btn-primary' : 'btn-outline'} btn-sm`}>
                    {s === 'all' ? 'All' : s} {s === 'all' ? `(${bills.length})` : `(${bills.filter(b => b.status === s).length})`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bills Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">All Bills <span className="text-sm font-normal text-slate-400">({filteredBills.length})</span></h3>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="data-table">
                <thead className="sticky top-0 bg-white z-10">
                  <tr>
                    <th>Date</th><th>Patient No</th><th>Patient Name</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Method</th><th>Received By</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.length === 0 && <tr><td colSpan={10} className="text-center text-slate-400 py-8">No bills found</td></tr>}
                  {filteredBills.map(bill => {
                    const bal = bill.totalAmount - bill.paidAmount;
                    return (
                      <tr key={bill.id}>
                        <td className="whitespace-nowrap">{bill.date}<br /><span className="text-xs text-slate-400">{bill.time}</span></td>
                        <td className="font-mono text-blue-600 font-bold">{bill.patientNo}</td>
                        <td className="font-medium">{bill.patientName}</td>
                        <td className="font-semibold">{cur} {bill.totalAmount.toLocaleString()}</td>
                        <td className="font-semibold text-emerald-600">{cur} {bill.paidAmount.toLocaleString()}</td>
                        <td className="font-semibold text-red-600">{cur} {bal.toLocaleString()}</td>
                        <td><span className={`badge ${bill.status === 'Paid' ? 'badge-green' : bill.status === 'Unpaid' ? 'badge-red' : 'badge-amber'}`}>{bill.status}</span></td>
                        <td><span className={`badge ${bill.paymentMethod === 'Cash' ? 'badge-green' : bill.paymentMethod === 'Card' ? 'badge-blue' : 'badge-amber'}`}>{bill.paymentMethod}</span></td>
                        <td className="text-sm">{bill.receivedBy}</td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            <button onClick={() => setReceiptModal(bill)} className="btn btn-outline btn-sm">Receipt</button>
                            {(bill.status === 'Unpaid' || bill.status === 'Partial') && (
                              <button onClick={() => { setCollectModal(bill); setCollectAmount(String(bill.totalAmount - bill.paidAmount)); }} className="btn btn-success btn-sm">Collect</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB 3: REPORTS ═══════════════ */}
      {mainTab === 'reports' && (
        <div className="space-y-6">
          {/* Report Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-32">
                <label className="form-label text-xs">From Date</label>
                <input type="date" className="form-input" value={reportFromDate} onChange={e => setReportFromDate(e.target.value)} />
              </div>
              <div className="flex-1 min-w-32">
                <label className="form-label text-xs">To Date</label>
                <input type="date" className="form-input" value={reportToDate} onChange={e => setReportToDate(e.target.value)} />
              </div>
              <div className="min-w-36">
                <label className="form-label text-xs">Department</label>
                <select className="form-input" value={reportDept} onChange={e => setReportDept(e.target.value as DeptFilter)}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button onClick={handlePrintReport} className="btn btn-primary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print Report
              </button>
            </div>
            {(reportFromDate || reportToDate) && (
              <p className="text-xs text-slate-400 mt-2">Showing data from {reportFromDate || 'beginning'} to {reportToDate || 'today'}</p>
            )}
          </div>

          {/* Revenue Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
            <div className="stat-card card-hover border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Total Billed</p>
              <p className="text-xl font-bold text-slate-800">{cur} {revenueSummary.totalBilled.toLocaleString()}</p>
              <p className="text-xs text-slate-400">{revenueSummary.billCount} bills</p>
            </div>
            <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
              <p className="text-xs text-emerald-600 font-medium">Total Collected</p>
              <p className="text-xl font-bold text-emerald-700">{cur} {revenueSummary.totalCollected.toLocaleString()}</p>
              <p className="text-xs text-emerald-500">{revenueSummary.totalBilled > 0 ? Math.round(revenueSummary.totalCollected / revenueSummary.totalBilled * 100) : 0}% collected</p>
            </div>
            <div className="stat-card card-hover border border-red-200 bg-red-50">
              <p className="text-xs text-red-600 font-medium">Total Pending</p>
              <p className="text-xl font-bold text-red-700">{cur} {revenueSummary.totalPending.toLocaleString()}</p>
            </div>
            <div className="stat-card card-hover border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Total Expenses</p>
              <p className="text-xl font-bold text-orange-600">{cur} {expenseSummary.total.toLocaleString()}</p>
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm opacity-80">Net Revenue (Collected - Expenses)</p>
                <p className="text-3xl font-bold">{cur} {(revenueSummary.totalCollected - expenseSummary.total).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80">Hospital Earnings (from visits)</p>
                <p className="text-xl font-bold">{cur} {doctorReport.reduce((s, d) => s + d.hospCut, 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Monthly Comparison */}
          {monthlyComparison.length > 1 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <h3 className="text-base font-bold text-slate-800">Monthly Comparison</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>Month</th><th>Billed</th><th>Collected</th><th>Pending</th><th>Visits</th><th>Collection Rate</th></tr>
                  </thead>
                  <tbody>
                    {monthlyComparison.map(([m, d]) => (
                      <tr key={m}>
                        <td className="font-medium">{m}</td>
                        <td>{cur} {d.billed.toLocaleString()}</td>
                        <td className="text-emerald-600 font-semibold">{cur} {d.collected.toLocaleString()}</td>
                        <td className="text-red-600">{d.pending > 0 ? `${cur} ${d.pending.toLocaleString()}` : '-'}</td>
                        <td className="text-center">{d.visits}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-24">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.billed > 0 ? Math.min(100, Math.round(d.collected / d.billed * 100)) : 0}%` }} />
                            </div>
                            <span className="text-xs font-medium">{d.billed > 0 ? Math.round(d.collected / d.billed * 100) : 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold">
                    <tr>
                      <td>Total</td>
                      <td>{cur} {monthlyComparison.reduce((s, [, d]) => s + d.billed, 0).toLocaleString()}</td>
                      <td className="text-emerald-600">{cur} {monthlyComparison.reduce((s, [, d]) => s + d.collected, 0).toLocaleString()}</td>
                      <td className="text-red-600">{cur} {monthlyComparison.reduce((s, [, d]) => s + d.pending, 0).toLocaleString()}</td>
                      <td className="text-center">{monthlyComparison.reduce((s, [, d]) => s + d.visits, 0)}</td>
                      <td>-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Doctor-wise Report */}
          {doctorReport.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <h3 className="text-base font-bold text-slate-800">Doctor-wise Report</h3>
                <span className="badge badge-purple text-xs">{doctorReport.length} doctors</span>
              </div>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="data-table">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr>
                      <th>Doctor</th><th>Department</th><th>Visits</th><th>Total Fee</th>
                      <th>Hospital Cut ({settings.hospitalCutRatio}%)</th><th>Doctor Share</th><th>Collected</th><th>Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctorReport.map((d, i) => (
                      <tr key={i}>
                        <td className="font-medium">{d.name}</td>
                        <td>{d.dept}</td>
                        <td className="text-center">{d.totalVisits}</td>
                        <td className="font-semibold">{cur} {d.totalFee.toLocaleString()}</td>
                        <td className="font-semibold text-purple-600">{cur} {d.hospCut.toLocaleString()}</td>
                        <td className="font-semibold text-blue-600">{cur} {d.docShare.toLocaleString()}</td>
                        <td className="font-semibold text-emerald-600">{cur} {d.collectedAmount.toLocaleString()}</td>
                        <td className="font-semibold text-red-600">{cur} {d.pendingAmount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold">
                    <tr>
                      <td colSpan={2}>Total</td>
                      <td className="text-center">{doctorReport.reduce((s, d) => s + d.totalVisits, 0)}</td>
                      <td>{cur} {doctorReport.reduce((s, d) => s + d.totalFee, 0).toLocaleString()}</td>
                      <td className="text-purple-600">{cur} {doctorReport.reduce((s, d) => s + d.hospCut, 0).toLocaleString()}</td>
                      <td className="text-blue-600">{cur} {doctorReport.reduce((s, d) => s + d.docShare, 0).toLocaleString()}</td>
                      <td className="text-emerald-600">{cur} {doctorReport.reduce((s, d) => s + d.collectedAmount, 0).toLocaleString()}</td>
                      <td className="text-red-600">{cur} {doctorReport.reduce((s, d) => s + d.pendingAmount, 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Department-wise Report */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Lab Revenue */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <h3 className="text-base font-bold text-slate-800">Laboratory Revenue</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Total Tests</p><p className="text-lg font-bold text-slate-800">{labReport.totalTests}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Total Billed</p><p className="text-lg font-bold text-slate-800">{cur} {labReport.totalBilled.toLocaleString()}</p></div>
                  <div className="bg-emerald-50 rounded-lg p-3"><p className="text-xs text-emerald-600">Collected</p><p className="text-lg font-bold text-emerald-700">{cur} {labReport.collected.toLocaleString()}</p></div>
                  <div className="bg-red-50 rounded-lg p-3"><p className="text-xs text-red-600">Pending</p><p className="text-lg font-bold text-red-700">{cur} {labReport.pending.toLocaleString()}</p></div>
                </div>
              </div>
            </div>

            {/* X-Ray Revenue */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h3 className="text-base font-bold text-slate-800">X-Ray Revenue</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Total X-Rays</p><p className="text-lg font-bold text-slate-800">{xrayReport.totalOrders}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Total Billed</p><p className="text-lg font-bold text-slate-800">{cur} {xrayReport.totalBilled.toLocaleString()}</p></div>
                  <div className="bg-emerald-50 rounded-lg p-3"><p className="text-xs text-emerald-600">Collected</p><p className="text-lg font-bold text-emerald-700">{cur} {xrayReport.collected.toLocaleString()}</p></div>
                  <div className="bg-red-50 rounded-lg p-3"><p className="text-xs text-red-600">Pending</p><p className="text-lg font-bold text-red-700">{cur} {xrayReport.pending.toLocaleString()}</p></div>
                </div>
              </div>
            </div>

            {/* Ultrasound Revenue */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-base font-bold text-slate-800">Ultrasound Revenue</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Total USG</p><p className="text-lg font-bold text-slate-800">{usgReport.totalOrders}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Total Billed</p><p className="text-lg font-bold text-slate-800">{cur} {usgReport.totalBilled.toLocaleString()}</p></div>
                  <div className="bg-emerald-50 rounded-lg p-3"><p className="text-xs text-emerald-600">Collected</p><p className="text-lg font-bold text-emerald-700">{cur} {usgReport.collected.toLocaleString()}</p></div>
                  <div className="bg-red-50 rounded-lg p-3"><p className="text-xs text-red-600">Pending</p><p className="text-lg font-bold text-red-700">{cur} {usgReport.pending.toLocaleString()}</p></div>
                </div>
              </div>
            </div>

            {/* Pharmacy Revenue */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <h3 className="text-base font-bold text-slate-800">Pharmacy Revenue</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Dispenses</p><p className="text-lg font-bold text-slate-800">{pharmacyReport.dispCount}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Total Billed</p><p className="text-lg font-bold text-slate-800">{cur} {pharmacyReport.totalBilled.toLocaleString()}</p></div>
                  <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-blue-600">Outdoor Revenue</p><p className="text-lg font-bold text-blue-700">{cur} {pharmacyReport.outdoorRevenue.toLocaleString()}</p></div>
                  <div className="bg-purple-50 rounded-lg p-3"><p className="text-xs text-purple-600">Indoor Revenue</p><p className="text-lg font-bold text-purple-700">{cur} {pharmacyReport.indoorRevenue.toLocaleString()}</p></div>
                </div>
              </div>
            </div>
          </div>

          {/* Admission Revenue (if any) */}
          {admissionReport.totalAdmissions > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <h3 className="text-base font-bold text-slate-800">Admission Revenue</h3>
                <span className="badge badge-amber">{admissionReport.totalAdmissions} admissions</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Total Billed</p><p className="text-lg font-bold">{cur} {admissionReport.totalBilled.toLocaleString()}</p></div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center"><p className="text-xs text-emerald-600">Collected</p><p className="text-lg font-bold text-emerald-700">{cur} {admissionReport.collected.toLocaleString()}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Admissions</p><p className="text-lg font-bold">{admissionReport.totalAdmissions}</p></div>
                </div>
              </div>
            </div>
          )}

          {/* Patient-wise Report */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <h3 className="text-base font-bold text-slate-800">Patient-wise Report</h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Patient Search */}
              <div className="flex gap-3 items-center">
                <div className="flex-1 relative">
                  <input className="form-input" placeholder="Search patient by name, number, or mobile..." value={patientSearchQuery} onChange={e => { setPatientSearchQuery(e.target.value); setSelectedPatientId(null); }} />
                  {patientSearchQuery.length > 0 && patientResults.length > 0 && !selectedPatientId && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto z-20">
                      {patientResults.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPatientId(p.id); setPatientSearchQuery(p.name); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm flex items-center gap-2 border-b border-slate-100 last:border-0">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-slate-400">{p.patientNo}</span>
                          <span className="text-xs text-slate-400">{p.mobile}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedPatientId && (
                  <button onClick={() => { setSelectedPatientId(null); setPatientSearchQuery(''); }} className="btn btn-outline btn-sm">Clear</button>
                )}
              </div>

              {/* Patient Bills */}
              {selectedPatientId && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-3">Bills for {selectedPatientName}</p>
                  {selectedPatientBills.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No bills found for this patient</p>
                  ) : (
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="data-table">
                        <thead className="sticky top-0 bg-white">
                          <tr><th>Date</th><th>Description</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                          {selectedPatientBills.map(bill => (
                            <tr key={bill.id}>
                              <td className="whitespace-nowrap">{bill.date}</td>
                              <td className="text-sm">{bill.items.map(i => i.description).join(', ')}</td>
                              <td className="font-semibold">{cur} {bill.totalAmount.toLocaleString()}</td>
                              <td className="text-emerald-600">{cur} {bill.paidAmount.toLocaleString()}</td>
                              <td className="text-red-600">{cur} {(bill.totalAmount - bill.paidAmount).toLocaleString()}</td>
                              <td><span className={`badge ${bill.status === 'Paid' ? 'badge-green' : bill.status === 'Unpaid' ? 'badge-red' : 'badge-amber'}`}>{bill.status}</span></td>
                              <td><button onClick={() => setReceiptModal(bill)} className="btn btn-outline btn-sm">Receipt</button></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-semibold">
                          <tr>
                            <td colSpan={2}>Total</td>
                            <td>{cur} {selectedPatientBills.reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}</td>
                            <td className="text-emerald-600">{cur} {selectedPatientBills.reduce((s, b) => s + b.paidAmount, 0).toLocaleString()}</td>
                            <td className="text-red-600">{cur} {selectedPatientBills.reduce((s, b) => s + (b.totalAmount - b.paidAmount), 0).toLocaleString()}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Expense Summary in Reports */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <h3 className="text-base font-bold text-slate-800">Expense Summary</h3>
              <span className="badge badge-red">{reportExpenses.length} entries</span>
            </div>
            <div className="p-4">
              {expenseSummary.byCategory.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
                  <p className="text-sm text-slate-400">No expenses recorded. Go to Expenses tab to add expenses.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expenseSummary.byCategory.map(([cat, amt]) => (
                    <div key={cat} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-600">{cat}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-400 rounded-full" style={{ width: `${expenseSummary.total > 0 ? Math.min(100, Math.round(amt / expenseSummary.total * 100)) : 0}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-slate-800 min-w-24 text-right">{cur} {amt.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 font-bold text-slate-800">
                    <span>Total Expenses</span>
                    <span>{cur} {expenseSummary.total.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB 4: DOCTOR PAYMENTS ═══════════════ */}
      {mainTab === 'doctor-payments' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card card-hover border border-blue-200 bg-blue-50">
              <p className="text-xs text-blue-600 font-medium">Total Doctor Earnings</p>
              <p className="text-xl font-bold text-blue-700">{cur} {doctorPayRecords.reduce((s, d) => s + d.totalEarned, 0).toLocaleString()}</p>
            </div>
            <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
              <p className="text-xs text-emerald-600 font-medium">Total Paid to Doctors</p>
              <p className="text-xl font-bold text-emerald-700">{cur} {doctorPayRecords.reduce((s, d) => s + d.totalPaid, 0).toLocaleString()}</p>
            </div>
            <div className="stat-card card-hover border border-red-200 bg-red-50">
              <p className="text-xs text-red-600 font-medium">Total Outstanding</p>
              <p className="text-xl font-bold text-red-700">{cur} {doctorPayRecords.reduce((s, d) => s + d.balance, 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Doctor Payment Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <h3 className="text-base font-bold text-slate-800">Doctor Payment Ledger</h3>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="data-table">
                <thead className="sticky top-0 bg-white z-10">
                  <tr>
                    <th>Doctor</th><th>Total Earned</th><th>Total Paid</th><th>Outstanding</th><th>Last Payment</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctorPayRecords.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">No doctor earnings data available</td></tr>}
                  {doctorPayRecords.map(d => (
                    <tr key={d.id}>
                      <td className="font-medium">{d.doctorName}</td>
                      <td className="font-semibold text-blue-600">{cur} {d.totalEarned.toLocaleString()}</td>
                      <td className="font-semibold text-emerald-600">{cur} {d.totalPaid.toLocaleString()}</td>
                      <td className="font-semibold text-red-600">{cur} {d.balance.toLocaleString()}</td>
                      <td className="text-sm">
                        {d.payments.length > 0
                          ? `${d.payments[d.payments.length - 1].date} (${cur} ${d.payments[d.payments.length - 1].amount.toLocaleString()})`
                          : <span className="text-slate-400">No payments yet</span>
                        }
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => setPayModalDoctor(d.doctorName)} className="btn btn-success btn-sm" disabled={d.balance <= 0}>
                            Pay
                          </button>
                          {d.payments.length > 0 && (
                            <button onClick={() => {}} className="btn btn-outline btn-sm group relative">
                              History ({d.payments.length})
                              <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 w-72 max-h-64 overflow-y-auto">
                                <div className="px-4 py-3 border-b border-slate-100">
                                  <p className="font-semibold text-sm text-slate-800">Payment History</p>
                                  <p className="text-xs text-slate-500">{d.doctorName}</p>
                                </div>
                                {d.payments.slice().reverse().map(p => (
                                  <div key={p.id} className="px-4 py-2 border-b border-slate-50 text-sm">
                                    <div className="flex justify-between">
                                      <span>{p.date} {p.time}</span>
                                      <span className="font-semibold text-emerald-600">{cur} {p.amount.toLocaleString()}</span>
                                    </div>
                                    {p.notes && <p className="text-xs text-slate-400 mt-0.5">{p.notes}</p>}
                                  </div>
                                ))}
                              </div>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td>Total</td>
                    <td className="text-blue-600">{cur} {doctorPayRecords.reduce((s, d) => s + d.totalEarned, 0).toLocaleString()}</td>
                    <td className="text-emerald-600">{cur} {doctorPayRecords.reduce((s, d) => s + d.totalPaid, 0).toLocaleString()}</td>
                    <td className="text-red-600">{cur} {doctorPayRecords.reduce((s, d) => s + d.balance, 0).toLocaleString()}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB 5: EXPENSES ═══════════════ */}
      {mainTab === 'expenses' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card card-hover border border-orange-200 bg-orange-50">
              <p className="text-xs text-orange-600 font-medium">Total Expenses (All Time)</p>
              <p className="text-xl font-bold text-orange-700">{cur} {expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</p>
            </div>
            <div className="stat-card card-hover border border-blue-200 bg-blue-50">
              <p className="text-xs text-blue-600 font-medium">This Month</p>
              <p className="text-xl font-bold text-blue-700">{cur} {expenses.filter(e => e.date.startsWith(monthStr)).reduce((s, e) => s + e.amount, 0).toLocaleString()}</p>
            </div>
            <div className="stat-card card-hover border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Total Entries</p>
              <p className="text-xl font-bold text-slate-800">{expenses.length}</p>
            </div>
          </div>

          {/* Add Expense Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-base font-bold text-slate-800 mb-4">Add Expense</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="form-label text-xs">Description *</label>
                <input className="form-input" placeholder="e.g., Electricity bill" value={expDesc} onChange={e => setExpDesc(e.target.value)} />
              </div>
              <div>
                <label className="form-label text-xs">Amount *</label>
                <input type="number" className="form-input" placeholder="0" value={expAmount} onChange={e => setExpAmount(e.target.value)} min={1} />
              </div>
              <div>
                <label className="form-label text-xs">Category</label>
                <select className="form-input" value={expCategory} onChange={e => setExpCategory(e.target.value)}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label text-xs">Date</label>
                <input type="date" className="form-input" value={expDate} onChange={e => setExpDate(e.target.value)} />
              </div>
              <button onClick={handleAddExpense} className="btn btn-primary">
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Expense
              </button>
            </div>
          </div>

          {/* Expense List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <h3 className="text-base font-bold text-slate-800">Expense History</h3>
              <span className="badge badge-amber">{expenses.length} entries</span>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="data-table">
                <thead className="sticky top-0 bg-white z-10">
                  <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Added By</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {expenses.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">No expenses recorded yet</td></tr>}
                  {expenses.slice().sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).map(exp => (
                    <tr key={exp.id}>
                      <td className="whitespace-nowrap">{exp.date}<br /><span className="text-xs text-slate-400">{exp.time}</span></td>
                      <td className="font-medium">{exp.description}</td>
                      <td><span className="badge badge-purple">{exp.category}</span></td>
                      <td className="font-semibold text-red-600">{cur} {exp.amount.toLocaleString()}</td>
                      <td className="text-sm">{exp.addedBy}</td>
                      <td>
                        <button onClick={() => handleDeleteExpense(exp.id)} className="btn btn-outline btn-sm text-red-600 border-red-200 hover:bg-red-50">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td colSpan={3}>Total</td>
                    <td className="text-red-600">{cur} {expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB 6: SALARIES (Forwarded from HR) ═══════════════ */}
      {mainTab === 'salaries' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <div>
                <h3 className="font-bold text-teal-700">Employee Salaries</h3>
                <p className="text-xs text-teal-600">These salaries have been approved by HR and forwarded to you for payment processing.</p>
              </div>
            </div>
          </div>

          {/* Month Selector & Actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div>
                <label className="form-label">Select Month</label>
                <select className="form-input w-52" value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)}>
                  {salaryMonthOptions.map(m => <option key={m} value={m}>{formatSalaryMonth(m)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAccountantPayAll} className="btn btn-success">Pay All Pending</button>
            </div>
          </div>

          {/* Salary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card card-hover border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Total Forwarded</p>
              <p className="text-xl font-bold text-slate-800">{filteredSalaryRecords.length}</p>
              <p className="text-xs text-slate-400">employees</p>
            </div>
            <div className="stat-card card-hover border border-purple-200 bg-purple-50">
              <p className="text-xs text-purple-600 font-medium">Total Payroll</p>
              <p className="text-xl font-bold text-purple-700">Rs. {salaryTotalNet.toLocaleString()}</p>
              <p className="text-xs text-purple-500">{formatSalaryMonth(salaryMonth)}</p>
            </div>
            <div className="stat-card card-hover border border-amber-200 bg-amber-50">
              <p className="text-xs text-amber-600 font-medium">Pending Payment</p>
              <p className="text-xl font-bold text-amber-700">{salaryPendingCount}</p>
              <p className="text-xs text-amber-500">awaiting payment</p>
            </div>
            <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
              <p className="text-xs text-emerald-600 font-medium">Paid</p>
              <p className="text-xl font-bold text-emerald-700">Rs. {salaryPaidAmount.toLocaleString()}</p>
              <p className="text-xs text-emerald-500">{salaryPaidCount} employees</p>
            </div>
          </div>

          {/* Salary Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Salary Records - {formatSalaryMonth(salaryMonth)}</h3>
              <span className="badge badge-teal">{filteredSalaryRecords.length} forwarded</span>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="data-table">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th>#</th><th>Employee</th><th>Code</th><th>Department</th><th>Designation</th><th>Basic</th><th>Deductions</th><th>Net Salary</th><th>Status</th><th>Approved By</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalaryRecords.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center text-slate-400 py-8">
                        No forwarded salaries for {formatSalaryMonth(salaryMonth)}. Salaries will appear here when HR forwards them.
                      </td>
                    </tr>
                  )}
                  {filteredSalaryRecords.map((s, i) => (
                    <tr key={s.id}>
                      <td className="text-slate-400">{i + 1}</td>
                      <td className="font-medium">{s.employeeName}</td>
                      <td><span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{s.employeeCode}</span></td>
                      <td><span className="badge badge-blue text-xs">{s.department}</span></td>
                      <td className="text-xs text-slate-600">{s.designation}</td>
                      <td>Rs. {s.basicSalary.toLocaleString()}</td>
                      <td className="text-red-600">{s.deductions > 0 ? `-Rs. ${s.deductions.toLocaleString()}` : '-'}</td>
                      <td className="font-bold text-lg">Rs. {s.netSalary.toLocaleString()}</td>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <span className={`badge ${s.status === 'Paid' ? 'badge-green' : s.status === 'Partial' ? 'badge-amber' : s.status === 'Approved' ? 'badge-blue' : 'badge-red'}`}>
                            {s.status}
                          </span>
                          {s.paidDate && <span className="text-[9px] text-slate-400">Paid: {s.paidDate}</span>}
                        </div>
                      </td>
                      <td className="text-xs text-slate-500">{s.approvedBy || '-'}</td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          <button onClick={() => setSalaryDetailModal(s)} className="btn btn-outline btn-sm">View</button>
                          {s.status !== 'Paid' && s.status !== 'Partial' && (
                            <button onClick={() => handleAccountantPay(s)} className="btn btn-success btn-sm">Pay</button>
                          )}
                          {s.status !== 'Paid' && s.status !== 'Partial' && (
                            <button onClick={() => handleAccountantPartial(s)} className="btn btn-sm" style={{background:'#d97706',color:'white',border:'none',cursor:'pointer',padding:'4px 8px',borderRadius:'6px',fontSize:'12px'}}>Partial</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filteredSalaryRecords.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-white font-bold">
                    <tr className="border-t-2 border-slate-300">
                      <td colSpan={5} className="text-right">TOTAL</td>
                      <td>Rs. {filteredSalaryRecords.reduce((t, s) => t + s.basicSalary, 0).toLocaleString()}</td>
                      <td className="text-red-600">-Rs. {filteredSalaryRecords.reduce((t, s) => t + s.deductions, 0).toLocaleString()}</td>
                      <td>Rs. {salaryTotalNet.toLocaleString()}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Salary Detail Modal */}
      {salaryDetailModal && (
        <div className="modal-overlay" onClick={() => setSalaryDetailModal(null)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Salary Details</h3>
                  <p className="text-sm text-slate-400">{salaryDetailModal.employeeName}</p>
                </div>
              </div>
              <button onClick={() => setSalaryDetailModal(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Employee Code:</span><span className="font-mono font-bold text-blue-600">{salaryDetailModal.employeeCode}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Department:</span><span className="font-medium">{salaryDetailModal.department}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Designation:</span><span className="font-medium">{salaryDetailModal.designation}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Month:</span><span className="font-medium">{formatSalaryMonth(salaryDetailModal.month)}</span></div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Basic Salary:</span><span className="font-medium">Rs. {salaryDetailModal.basicSalary.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">+ Allowances:</span><span className="text-emerald-600">Rs. {salaryDetailModal.allowances.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">+ Overtime:</span><span className="text-blue-600">Rs. {salaryDetailModal.overtime.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">+ Bonus:</span><span className="text-purple-600">Rs. {salaryDetailModal.bonus.toLocaleString()}</span></div>
              <hr className="border-slate-200" />
              <div className="flex justify-between text-sm"><span className="text-slate-500">- Absent Deduction ({salaryDetailModal.absentDays} days):</span><span className="text-red-600">Rs. {salaryDetailModal.absentDeduction.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">- Half Day Deduction ({salaryDetailModal.halfDays} days):</span><span className="text-red-500">Rs. {salaryDetailModal.halfDayDeduction.toLocaleString()}</span></div>
              <hr className="border-slate-200" />
              <div className="flex justify-between text-sm"><span className="text-slate-500">Attendance:</span><span><span className="text-emerald-600 font-bold">{salaryDetailModal.presentDays}P</span> {salaryDetailModal.absentDays > 0 && <><span className="text-red-500 font-bold"> {salaryDetailModal.absentDays}A</span> </>}<span className="text-slate-400">/ {salaryDetailModal.totalWorkingDays}</span></span></div>
              <div className="flex justify-between font-bold text-base border-t-2 border-slate-300 pt-2"><span>Net Salary:</span><span className="text-blue-700">Rs. {salaryDetailModal.netSalary.toLocaleString()}</span></div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-1 text-xs text-slate-500">
              <p><span className="font-medium">Status:</span> <span className={`badge ${salaryDetailModal.status === 'Paid' ? 'badge-green' : salaryDetailModal.status === 'Partial' ? 'badge-amber' : 'badge-blue'}`}>{salaryDetailModal.status}</span></p>
              <p><span className="font-medium">Approved By:</span> {salaryDetailModal.approvedBy} on {salaryDetailModal.approvedDate}</p>
              {salaryDetailModal.notes && <p><span className="font-medium">Notes:</span> {salaryDetailModal.notes}</p>}
            </div>
            <div className="flex gap-3">
              {salaryDetailModal.status !== 'Paid' && salaryDetailModal.status !== 'Partial' ? (
                <>
                  <button onClick={() => { handleAccountantPay(salaryDetailModal); setSalaryDetailModal(null); }} className="btn btn-success flex-1">Mark as Paid</button>
                  <button onClick={() => { handleAccountantPartial(salaryDetailModal); setSalaryDetailModal(null); }} className="btn flex-1" style={{background:'#d97706',color:'white',border:'none',cursor:'pointer',padding:'8px 16px',borderRadius:'6px',fontSize:'14px',fontWeight:500}}>Mark as Partial</button>
                  <button onClick={() => setSalaryDetailModal(null)} className="btn btn-outline">Close</button>
                </>
              ) : (
                <button onClick={() => setSalaryDetailModal(null)} className="btn btn-outline flex-1">Close</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ COLLECT PAYMENT MODAL ═══════════════ */}
      {collectModal && (
        <div className="modal-overlay" onClick={() => setCollectModal(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">Collect Payment</h3>
            </div>
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                <p className="text-sm text-slate-500">Patient: <span className="font-semibold text-slate-800">{collectModal.patientName} ({collectModal.patientNo})</span></p>
                <p className="text-sm text-slate-500">Total: <span className="font-semibold">{cur} {collectModal.totalAmount.toLocaleString()}</span></p>
                <p className="text-sm text-slate-500">Already Paid: <span className="font-semibold text-emerald-600">{cur} {collectModal.paidAmount.toLocaleString()}</span></p>
                <p className="text-sm text-slate-500">Balance: <span className="font-semibold text-red-600">{cur} {(collectModal.totalAmount - collectModal.paidAmount).toLocaleString()}</span></p>
              </div>
              <div>
                <label className="form-label">Amount to Collect</label>
                <input type="number" className="form-input" value={collectAmount} onChange={e => setCollectAmount(e.target.value)} max={collectModal.totalAmount - collectModal.paidAmount} min={1} />
              </div>
              <div>
                <label className="form-label">Payment Method</label>
                <select className="form-input" value={collectMethod} onChange={e => setCollectMethod(e.target.value as 'Cash' | 'Card')}>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setCollectModal(null)} className="btn btn-outline flex-1">Cancel</button>
                <button onClick={handleCollect} className="btn btn-success flex-1">Collect Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ VIEW RECEIPT MODAL ═══════════════ */}
      {receiptModal && (
        <div className="modal-overlay" onClick={() => setReceiptModal(null)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">Bill Receipt</h3>
              </div>
              <button onClick={() => setReceiptModal(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Bill ID:</span><span className="font-mono">{receiptModal.id}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Patient:</span><span className="font-medium">{receiptModal.patientName} ({receiptModal.patientNo})</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Date:</span><span>{receiptModal.date} {receiptModal.time}</span></div>
              <hr className="border-slate-200" />
              {receiptModal.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`badge ${item.type === 'Consultation' ? 'badge-blue' : item.type === 'Lab' ? 'badge-cyan' : item.type === 'X-Ray' ? 'badge-amber' : item.type === 'Ultrasound' ? 'badge-purple' : item.type === 'Pharmacy' ? 'badge-green' : 'badge-blue'}`} style={{ display: 'inline-flex' }}>{item.type}</span>
                    {item.description} {item.quantity > 1 ? `x${item.quantity}` : ''}
                  </span>
                  <span className="font-medium">{cur} {item.amount.toLocaleString()}</span>
                </div>
              ))}
              <hr className="border-slate-200" />
              <div className="flex justify-between font-bold text-base"><span>Total:</span><span>{cur} {receiptModal.totalAmount.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm text-emerald-600"><span>Paid:</span><span>{cur} {receiptModal.paidAmount.toLocaleString()}</span></div>
              {receiptModal.totalAmount - receiptModal.paidAmount > 0 && (
                <div className="flex justify-between text-sm text-red-600 font-semibold"><span>Balance:</span><span>{cur} {(receiptModal.totalAmount - receiptModal.paidAmount).toLocaleString()}</span></div>
              )}
              <div className="flex justify-between text-sm"><span>Status:</span><span className={`badge ${receiptModal.status === 'Paid' ? 'badge-green' : receiptModal.status === 'Unpaid' ? 'badge-red' : 'badge-amber'}`}>{receiptModal.status}</span></div>
              <div className="flex justify-between text-sm"><span>Payment Method:</span><span>{receiptModal.paymentMethod}</span></div>
              <div className="flex justify-between text-sm"><span>Received By:</span><span>{receiptModal.receivedBy}</span></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handlePrintReceipt} className="btn btn-primary flex-1">
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print Receipt
              </button>
              <button onClick={() => setReceiptModal(null)} className="btn btn-outline flex-1">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DOCTOR PAYMENT MODAL ═══════════════ */}
      {payModalDoctor && (
        <div className="modal-overlay" onClick={() => setPayModalDoctor(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Pay Doctor</h3>
                <p className="text-sm text-slate-500">{payModalDoctor}</p>
              </div>
            </div>
            <div className="space-y-3">
              {(() => {
                const rec = doctorPayRecords.find(d => d.doctorName === payModalDoctor);
                return rec ? (
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                    <p className="text-sm text-slate-500">Total Earned: <span className="font-semibold text-blue-600">{cur} {rec.totalEarned.toLocaleString()}</span></p>
                    <p className="text-sm text-slate-500">Already Paid: <span className="font-semibold text-emerald-600">{cur} {rec.totalPaid.toLocaleString()}</span></p>
                    <p className="text-sm text-slate-500">Outstanding: <span className="font-semibold text-red-600">{cur} {rec.balance.toLocaleString()}</span></p>
                  </div>
                ) : null;
              })()}
              <div>
                <label className="form-label">Payment Amount</label>
                <input type="number" className="form-input" placeholder="Enter amount" value={payModalAmount} onChange={e => setPayModalAmount(e.target.value)} min={1} />
              </div>
              <div>
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" placeholder="e.g., Monthly payment for May" value={payModalNotes} onChange={e => setPayModalNotes(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setPayModalDoctor(null); setPayModalAmount(''); setPayModalNotes(''); }} className="btn btn-outline flex-1">Cancel</button>
                <button onClick={handleDoctorPay} className="btn btn-success flex-1">Confirm Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
