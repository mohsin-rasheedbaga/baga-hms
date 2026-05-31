'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getHospitalSettings, todayStr } from '@/lib/store';

/* ==================== LOCAL TYPES ==================== */
interface CartItem {
  medicineId: string;
  name: string;
  genericName: string;
  form: string;
  strength: string;
  packing: string;
  price: number;
  quantity: number;
  total: number;
}

interface PharmacySale {
  id: string;
  patientNo: string;
  patientName: string;
  patientMobile: string;
  type: 'Indoor' | 'Outdoor';
  items: CartItem[];
  totalAmount: number;
  date: string;
  time: string;
  servedBy: string;
}

/* ==================== LOCAL STORAGE HELPERS ==================== */
function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}

const SALES_KEY = 'baga_pharmacy_sales';
function getPharmacySales(): PharmacySale[] { return lsGet<PharmacySale[]>(SALES_KEY, []); }

/* ==================== DATE HELPERS ==================== */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function getMonthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

type Period = 'today' | '7days' | 'month' | 'custom';

export default function ReportsPage() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [currency, setCurrency] = useState('Rs.');

  useEffect(() => {
    const s = getHospitalSettings();
    setCurrency(s.currency);
  }, []);

  const [period, setPeriod] = useState<Period>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sales, setSales] = useState<PharmacySale[]>([]);

  const loadSales = useCallback(() => {
    setSales(getPharmacySales());
  }, []);
  useEffect(() => { loadSales(); }, [loadSales]);

  const [showDetail, setShowDetail] = useState<PharmacySale | null>(null);

  const dateRange = useMemo(() => {
    switch (period) {
      case 'today': return { from: todayStr(), to: todayStr() };
      case '7days': return { from: daysAgo(6), to: todayStr() };
      case 'month': return { from: getMonthStart(), to: todayStr() };
      case 'custom':
        if (!customFrom || !customTo) return { from: todayStr(), to: todayStr() };
        return { from: customFrom, to: customTo };
    }
  }, [period, customFrom, customTo]);

  const filtered = useMemo(() => {
    return sales.filter(s => s.date >= dateRange.from && s.date <= dateRange.to);
  }, [sales, dateRange]);

  const totalAmount = useMemo(() => filtered.reduce((a, s) => a + s.totalAmount, 0), [filtered]);
  const totalIndoor = useMemo(() => filtered.filter(s => s.type === 'Indoor').reduce((a, s) => a + s.totalAmount, 0), [filtered]);
  const totalOutdoor = useMemo(() => filtered.filter(s => s.type === 'Outdoor').reduce((a, s) => a + s.totalAmount, 0), [filtered]);
  const indoorCount = filtered.filter(s => s.type === 'Indoor').length;
  const outdoorCount = filtered.filter(s => s.type === 'Outdoor').length;

  // Medicine-wise summary
  const medSummary = useMemo(() => {
    const map: Record<string, { name: string; form: string; strength: string; price: number; qty: number; total: number }> = {};
    filtered.forEach(sale => {
      sale.items.forEach(item => {
        const key = item.medicineId;
        if (!map[key]) {
          map[key] = { name: item.name, form: item.form, strength: item.strength, price: item.price, qty: 0, total: 0 };
        }
        map[key].qty += item.quantity;
        map[key].total += item.total;
      });
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'today': return 'Today';
      case '7days': return 'Last 7 Days';
      case 'month': return 'This Month';
      case 'custom': return `${customFrom} to ${customTo}`;
    }
  }, [period, customFrom, customTo]);

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Sales Reports</h2>
        <p className="text-sm text-slate-500">View pharmacy sales analytics, medicine-wise breakdown, and transaction history</p>
      </div>

      {/* Period Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="font-semibold text-slate-700">Period:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'today' as Period, label: 'Today' },
              { key: '7days' as Period, label: 'Last 7 Days' },
              { key: 'month' as Period, label: 'This Month' },
              { key: 'custom' as Period, label: 'Custom' },
            ]).map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`btn btn-sm ${period === p.key ? 'btn-primary' : 'btn-outline'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" className="form-input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <span className="text-slate-400">to</span>
              <input type="date" className="form-input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">{periodLabel} Sales</p>
          <p className="text-2xl font-bold text-emerald-700">{currency} {totalAmount.toLocaleString()}</p>
        </div>
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Indoor Sales ({indoorCount})</p>
          <p className="text-2xl font-bold text-blue-700">{currency} {totalIndoor.toLocaleString()}</p>
        </div>
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Outdoor Sales ({outdoorCount})</p>
          <p className="text-2xl font-bold text-amber-700">{currency} {totalOutdoor.toLocaleString()}</p>
        </div>
        <div className="stat-card card-hover border border-purple-200 bg-purple-50">
          <p className="text-xs text-purple-600 font-medium">Total Transactions</p>
          <p className="text-2xl font-bold text-purple-700">{filtered.length}</p>
        </div>
      </div>

      {/* Medicine-wise Sales Summary */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">Medicine-wise Sales Summary ({periodLabel})</h3>
          <p className="text-xs text-slate-400 mt-1">Breakdown of all medicines sold in the selected period</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Medicine Name</th>
                <th>Form</th>
                <th>Strength</th>
                <th>Total Qty Sold</th>
                <th>Unit Price</th>
                <th className="text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {medSummary.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No sales in the selected period</td></tr>
              ) : medSummary.map((m, i) => (
                <tr key={i}>
                  <td className="text-slate-400 font-medium">{i + 1}</td>
                  <td className="font-semibold">{m.name}</td>
                  <td><span className="badge badge-blue">{m.form}</span></td>
                  <td className="text-sm">{m.strength}</td>
                  <td className="font-bold text-center">{m.qty}</td>
                  <td className="text-sm">{currency} {m.price.toLocaleString()}</td>
                  <td className="text-right font-bold text-emerald-700">{currency} {m.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                <td colSpan={6} className="px-4 py-3 text-right font-bold text-emerald-800">Grand Total:</td>
                <td className="px-4 py-3 text-right font-extrabold text-emerald-700 text-lg">{currency} {totalAmount.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Sales by Patient Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-3">Indoor Patient Sales ({indoorCount})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filtered.filter(s => s.type === 'Indoor').length === 0 ? (
              <p className="text-slate-400 text-center py-4">No indoor sales in this period</p>
            ) : filtered.filter(s => s.type === 'Indoor').sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).map(s => (
              <button
                key={s.id}
                onClick={() => setShowDetail(s)}
                className="w-full border border-slate-100 rounded-lg p-3 flex items-center justify-between hover:bg-blue-50 transition-colors text-left"
              >
                <div>
                  <p className="font-semibold text-sm text-slate-800">{s.patientName}</p>
                  <p className="text-xs text-slate-400">{s.patientNo} | {s.date} {s.time}</p>
                </div>
                <p className="font-bold text-blue-700">{currency} {s.totalAmount.toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-3">Outdoor Patient Sales ({outdoorCount})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filtered.filter(s => s.type === 'Outdoor').length === 0 ? (
              <p className="text-slate-400 text-center py-4">No outdoor sales in this period</p>
            ) : filtered.filter(s => s.type === 'Outdoor').sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).map(s => (
              <button
                key={s.id}
                onClick={() => setShowDetail(s)}
                className="w-full border border-slate-100 rounded-lg p-3 flex items-center justify-between hover:bg-amber-50 transition-colors text-left"
              >
                <div>
                  <p className="font-semibold text-sm text-slate-800">{s.patientName}</p>
                  <p className="text-xs text-slate-400">{s.patientNo} | {s.date} {s.time}</p>
                </div>
                <p className="font-bold text-amber-700">{currency} {s.totalAmount.toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* All Sales History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">All Sales Records ({periodLabel})</h3>
        </div>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="data-table">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Patient No</th>
                <th>Patient Name</th>
                <th>Type</th>
                <th>Medicines</th>
                <th className="text-right">Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">No sales in the selected period</td></tr>
              ) : filtered.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).map(s => (
                <tr key={s.id}>
                  <td className="text-sm text-slate-500">{s.date}</td>
                  <td className="text-sm text-slate-500">{s.time}</td>
                  <td className="font-mono font-bold text-blue-600 text-sm">{s.patientNo}</td>
                  <td className="font-medium text-sm">{s.patientName}</td>
                  <td><span className={`badge ${s.type === 'Indoor' ? 'badge-blue' : 'badge-amber'}`}>{s.type}</span></td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {s.items.slice(0, 3).map((it, i) => (
                        <span key={i} className="badge text-xs">{it.name} x{it.quantity}</span>
                      ))}
                      {s.items.length > 3 && <span className="badge badge-amber text-xs">+{s.items.length - 3}</span>}
                    </div>
                  </td>
                  <td className="text-right font-bold text-emerald-700">{currency} {s.totalAmount.toLocaleString()}</td>
                  <td>
                    <button onClick={() => setShowDetail(s)} className="btn btn-outline btn-sm">Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Detail Modal */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Sale Details</h3>
              <button onClick={() => setShowDetail(null)} className="btn btn-outline btn-sm">Close</button>
            </div>

            {/* Patient Info */}
            <div className={`rounded-lg p-4 mb-4 ${showDetail.type === 'Indoor' ? 'bg-blue-50 border border-blue-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 ${showDetail.type === 'Indoor' ? 'bg-blue-600' : 'bg-amber-500'} rounded-full flex items-center justify-center text-white font-bold text-lg`}>
                  {showDetail.patientName.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{showDetail.patientName}</p>
                  <p className="text-sm text-slate-500">
                    <span className="font-mono font-semibold">{showDetail.patientNo}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    {showDetail.patientMobile}
                    <span className="mx-2 text-slate-300">|</span>
                    <span className={`badge ${showDetail.type === 'Indoor' ? 'badge-blue' : 'badge-amber'} text-xs`}>{showDetail.type}</span>
                  </p>
                  <p className="text-xs text-slate-400">{showDetail.date} at {showDetail.time} &middot; Served by {showDetail.servedBy}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Medicine</th>
                    <th>Strength</th>
                    <th>Packing</th>
                    <th className="text-right">Price</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {showDetail.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="text-slate-400 font-medium">{idx + 1}</td>
                      <td>
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.genericName}</p>
                      </td>
                      <td className="text-sm">{item.strength}</td>
                      <td className="text-sm text-slate-500">{item.packing}</td>
                      <td className="text-right">{currency} {item.price.toLocaleString()}</td>
                      <td className="text-center font-bold">{item.quantity}</td>
                      <td className="text-right font-bold text-emerald-700">{currency} {item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                    <td colSpan={6} className="px-4 py-3 text-right font-bold text-emerald-800">Grand Total:</td>
                    <td className="px-4 py-3 text-right font-extrabold text-emerald-700 text-lg">{currency} {showDetail.totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
