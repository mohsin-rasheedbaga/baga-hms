'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getMedicines, getPharmacySales, getExpiredMedicines, getLowStockMedicines,
  getHospitalSettings, todayStr,
} from '@/lib/store';
import type { MedicineItem } from '@/lib/types';

/* ==================== HELPER FUNCTIONS ==================== */

function getNearExpiryMedicines(days: number = 30): MedicineItem[] {
  const meds = getMedicines();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threshold = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  return meds.filter(m => {
    if (!m.expiryDate || m.expiryDate === '') return false;
    const exp = new Date(m.expiryDate);
    exp.setHours(0, 0, 0, 0);
    return exp >= today && exp <= threshold;
  });
}

function getMonthlySalesData(sales: any[]) {
  const months: { label: string; total: number }[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const label = monthNames[d.getMonth()];
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const total = sales
      .filter(s => s.date && s.date.startsWith(monthStr))
      .reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    months.push({ label, total });
  }
  return months;
}

function getTopSellingMedicines(sales: any[], limit: number = 5) {
  const medSales: Record<string, { name: string; qty: number }> = {};
  for (const sale of sales) {
    for (const item of (sale.items || [])) {
      if (!medSales[item.medicineId]) {
        medSales[item.medicineId] = { name: item.name, qty: 0 };
      }
      medSales[item.medicineId].qty += item.quantity;
    }
  }
  return Object.values(medSales).sort((a, b) => b.qty - a.qty).slice(0, limit);
}

/* ==================== SVG ICON COMPONENTS ==================== */

function PillIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-6 h-6'} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.75v4.5m0-4.5h4.5m-4.5 0L6 9.75m3.75-6v15m0-15h4.5m-4.5 0L18 9.75M6 9.75h12M6 9.75l3.75 3.75M18 9.75l-3.75 3.75M6 9.75v4.5m12-4.5v4.5m-12 4.5h12m-12 0l3.75-3.75m4.5 0L18 18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      <rect x="8" y="7" width="8" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-6 h-6'} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-6 h-6'} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-6 h-6'} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-6 h-6'} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-6 h-6'} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/* ==================== STAT CARD COMPONENT ==================== */

function StatCard({
  icon,
  label,
  value,
  sub,
  colorClass,
  warning,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  colorClass: string;
  warning?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`stat-card card-hover border rounded-xl p-4 transition-all ${
        warning
          ? 'bg-amber-50 border-amber-300'
          : colorClass
      } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
        </div>
        <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          warning
            ? 'bg-amber-100 text-amber-600'
            : 'bg-white/60 opacity-70'
        }`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ==================== MAIN COMPONENT ==================== */

export default function PharmacyDashboardPage() {
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [currency, setCurrency] = useState('Rs.');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setMedicines(getMedicines());
    setSales(getPharmacySales());
    const settings = getHospitalSettings();
    setCurrency(settings.currency || 'Rs.');
  }, []);

  useEffect(() => {
    loadData();
    setLoading(false);
  }, [loadData]);

  // Refresh when storage changes (another tab/window)
  useEffect(() => {
    const handleStorage = () => loadData();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  /* ==================== COMPUTED DATA ==================== */
  const totalMedicines = medicines.filter(m => m.active).length;
  const expiredMeds = getExpiredMedicines();
  const lowStockMeds = getLowStockMedicines();
  const nearExpiryMeds = getNearExpiryMedicines(30);

  const todaySales = sales.filter(s => s.date === todayStr());
  const todaySalesCount = todaySales.length;
  const todaySalesTotal = todaySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlyRevenue = sales
    .filter(s => s.date && s.date.startsWith(currentMonthStr))
    .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  const monthlyData = getMonthlySalesData(sales);
  const topSelling = getTopSellingMedicines(sales, 5);
  const maxTopQty = topSelling.length > 0 ? topSelling[0].qty : 1;

  // Bar chart: max height for bars (px)
  const chartMaxVal = Math.max(...monthlyData.map(m => m.total), 1);

  return (
    <div className="space-y-5">
      {/* ==================== PAGE HEADER ==================== */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Pharmacy Dashboard</h2>
        <p className="text-sm text-slate-500">Medicine inventory overview, sales analytics, and stock alerts</p>
      </div>

      {/* ==================== TOP STATS ROW (6 cards) ==================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Medicines */}
        <StatCard
          icon={<PillIcon className="w-5 h-5 text-teal-600" />}
          label="Total Medicines"
          value={totalMedicines}
          sub="Active medicines"
          colorClass="bg-teal-50 border-teal-200 text-teal-700"
        />

        {/* 2. Today's Sales */}
        <StatCard
          icon={<CartIcon className="w-5 h-5 text-teal-600" />}
          label="Today's Sales"
          value={todaySalesCount}
          sub={`${currency} ${todaySalesTotal.toLocaleString()}`}
          colorClass="bg-teal-50 border-teal-200 text-teal-700"
        />

        {/* 3. Low Stock - Warning style */}
        <StatCard
          icon={<WarningIcon className="w-5 h-5 text-amber-600" />}
          label="Low Stock"
          value={lowStockMeds.length}
          sub="Below minimum level"
          colorClass="bg-amber-50 border-amber-300 text-amber-700"
          warning
        />

        {/* 4. Near Expiry (30 days) */}
        <StatCard
          icon={<ClockIcon className="w-5 h-5 text-orange-600" />}
          label="Near Expiry"
          value={nearExpiryMeds.length}
          sub="Within 30 days"
          colorClass="bg-orange-50 border-orange-200 text-orange-700"
        />

        {/* 5. Monthly Revenue */}
        <StatCard
          icon={<TrendingUpIcon className="w-5 h-5 text-teal-600" />}
          label="Monthly Revenue"
          value={`${currency} ${monthlyRevenue.toLocaleString()}`}
          sub="This month"
          colorClass="bg-teal-50 border-teal-200 text-teal-700"
        />

        {/* 6. Expired */}
        <StatCard
          icon={<XCircleIcon className="w-5 h-5 text-red-600" />}
          label="Expired"
          value={expiredMeds.length}
          sub="Need removal"
          colorClass="bg-red-50 border-red-200 text-red-700"
        />
      </div>

      {/* ==================== MIDDLE SECTION: Chart + Top Selling ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Monthly Revenue Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Monthly Revenue</h3>
              <p className="text-xs text-slate-500">Last 6 months sales overview</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-teal-500"></div>
              <span className="text-xs text-slate-500">Revenue</span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-2 h-48 px-2">
            {monthlyData.map((m, i) => {
              const heightPct = chartMaxVal > 0 ? (m.total / chartMaxVal) * 100 : 0;
              const barHeight = Math.max(heightPct, 2); // min 2% so empty months still show a thin bar
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  {/* Value on top */}
                  <span className="text-[10px] font-semibold text-slate-600 whitespace-nowrap">
                    {m.total > 0 ? `${(m.total / 1000).toFixed(1)}k` : '-'}
                  </span>
                  {/* Bar */}
                  <div className="w-full max-w-[40px] bg-slate-100 rounded-t-md relative" style={{ height: '140px' }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-teal-600 to-teal-400 rounded-t-md transition-all duration-500 ease-out"
                      style={{ height: `${barHeight}%` }}
                    ></div>
                  </div>
                  {/* Month label */}
                  <span className="text-[11px] font-medium text-slate-500">{m.label}</span>
                </div>
              );
            })}
          </div>

          {/* Month Year row */}
          <div className="flex items-end justify-between gap-2 px-2 mt-1">
            {monthlyData.map((m, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - (5 - i));
              const yearStr = String(d.getFullYear()).slice(-2);
              return (
                <div key={i} className="flex-1 text-center">
                  <span className="text-[9px] text-slate-400">{yearStr}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Top Selling Medicines */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Top Selling Medicines</h3>
              <p className="text-xs text-slate-500">By quantity sold (all time)</p>
            </div>
            <span className="badge badge-teal text-xs">Top 5</span>
          </div>

          {topSelling.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <p className="text-sm">No sales data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topSelling.map((med, i) => {
                const pct = maxTopQty > 0 ? (med.qty / maxTopQty) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-slate-400 w-4">{i + 1}.</span>
                        <span className="text-sm font-semibold text-slate-700 truncate">{med.name}</span>
                      </div>
                      <span className="text-sm font-bold text-teal-700 shrink-0 ml-2">{med.qty} sold</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ==================== BOTTOM SECTION: Alert Panels ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Expired Medicines Alert */}
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
              <XCircleIcon className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-red-800">Expired Medicines</h3>
              <p className="text-xs text-red-500">{expiredMeds.length} medicine{expiredMeds.length !== 1 ? 's' : ''} need removal</p>
            </div>
          </div>

          {expiredMeds.length === 0 ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-green-700 font-medium">No expired medicines</p>
              <p className="text-xs text-green-500">All medicines are within their expiry date</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {expiredMeds.map(m => (
                <div key={m.id} className="bg-white border border-red-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-red-800 truncate">{m.name}</p>
                    <p className="text-xs text-red-500">{m.strength} &middot; Batch: {m.id.slice(-6).toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-red-400">{m.expiryDate}</span>
                    <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Expired</span>
                  </div>
                </div>
              ))}
              {expiredMeds.length > 10 && (
                <p className="text-xs text-red-400 text-center py-1">+{expiredMeds.length - 10} more expired medicines</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Low Stock Alert */}
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <WarningIcon className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-amber-800">Low Stock Alert</h3>
              <p className="text-xs text-amber-500">{lowStockMeds.length} medicine{lowStockMeds.length !== 1 ? 's' : ''} below minimum</p>
            </div>
          </div>

          {lowStockMeds.length === 0 ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-green-700 font-medium">All stocks are sufficient</p>
              <p className="text-xs text-green-500">No medicines are below minimum stock level</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {lowStockMeds.map(m => (
                <div key={m.id} className="bg-white border border-amber-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-800 truncate">{m.name}</p>
                    <p className="text-xs text-amber-500">
                      Current: <span className="font-bold text-red-600">{m.stock}</span> &middot; Min: <span className="font-bold">{m.minStock}</span>
                    </p>
                  </div>
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">Low Stock</span>
                </div>
              ))}
              {lowStockMeds.length > 10 && (
                <p className="text-xs text-amber-400 text-center py-1">+{lowStockMeds.length - 10} more low stock medicines</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
