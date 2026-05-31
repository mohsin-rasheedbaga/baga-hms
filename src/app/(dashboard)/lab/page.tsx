'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initLabData, getLabOrders, getLabStatistics, getLabInventory, getLowStockItems, todayStr } from '@/lib/lab-store';

export default function LabDashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initLabData();
    setMounted(true);
  }, []);

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>;

  const today = todayStr();
  const allOrders = getLabOrders();
  const todayOrders = allOrders.filter(o => o.date === today);
  const stats = getLabStatistics('today');
  const monthStats = getLabStatistics('month');
  const lowStock = getLowStockItems();

  const ordered = allOrders.filter(o => o.status === 'ordered').length;
  const collected = allOrders.filter(o => o.status === 'collected').length;
  const processing = allOrders.filter(o => o.status === 'processing').length;
  const completed = allOrders.filter(o => o.status === 'completed').length;
  const todayCompleted = todayOrders.filter(o => o.status === 'completed').length;
  const todayTests = todayOrders.reduce((s, o) => s + o.tests.length, 0);

  const recentOrders = [...allOrders].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 8);

  const statusColor = (s: string) => s === 'ordered' ? 'badge-amber' : s === 'collected' ? 'badge-blue' : s === 'processing' ? 'badge-purple' : 'badge-green';
  const urgencyColor = (u: string) => u === 'stat' ? 'badge-rose' : u === 'urgent' ? 'badge-amber' : 'badge-slate';

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <div className="bg-teal-600 rounded-xl p-5 text-white">
        <h2 className="text-xl font-bold">Laboratory Information System</h2>
        <p className="text-teal-200 text-sm">Laboratory Dashboard — {today}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Today&apos;s Orders</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{todayOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-amber-300" onClick={() => router.push('/lab/orders')}>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Pending Collection</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{ordered}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-purple-300" onClick={() => router.push('/lab/processing')}>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">In Processing</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{processing}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-green-300" onClick={() => router.push('/lab/reports')}>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Completed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{todayCompleted}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Today&apos;s Tests</p>
          <p className="text-2xl font-bold text-cyan-600 mt-1">{todayTests}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Today&apos;s Revenue</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">Rs. {stats.revenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Monthly Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-500">Total Orders</p>
            <p className="text-xl font-bold text-slate-800">{monthStats.totalOrders}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Completed</p>
            <p className="text-xl font-bold text-emerald-600">{monthStats.completedOrders}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Revenue</p>
            <p className="text-xl font-bold text-emerald-600">Rs. {monthStats.revenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Expenses</p>
            <p className="text-xl font-bold text-rose-600">Rs. {monthStats.totalExpenses.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Workflow Pipeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Workflow Pipeline</h3>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {[
            { label: 'Ordered', count: ordered, color: 'bg-amber-500', route: '/lab/orders' },
            { label: 'Collected', count: collected, color: 'bg-blue-500', route: '/lab/samples' },
            { label: 'Processing', count: processing, color: 'bg-purple-500', route: '/lab/processing' },
            { label: 'Completed', count: completed, color: 'bg-emerald-500', route: '/lab/reports' },
          ].map((step, i) => (
            <div key={step.label} className="flex-1 flex items-center">
              <div className={`flex-1 cursor-pointer ${step.color} rounded-xl p-4 text-white text-center hover:opacity-90 transition-opacity`} onClick={() => router.push(step.route)}>
                <p className="text-2xl font-bold">{step.count}</p>
                <p className="text-sm opacity-90">{step.label}</p>
              </div>
              {i < 3 && (
                <svg className="w-6 h-6 text-slate-300 flex-shrink-0 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 cursor-pointer hover:border-red-400" onClick={() => router.push('/lab/inventory')}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-red-800">Low Stock Alert ({lowStock.length} items)</h3>
            <span className="badge badge-rose">View Inventory</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.slice(0, 5).map(item => (
              <span key={item.id} className="bg-white border border-red-200 rounded px-3 py-1 text-sm text-red-700 font-medium">
                {item.name} <span className="text-red-400">({item.stock}/{item.minStock})</span>
              </span>
            ))}
            {lowStock.length > 5 && <span className="text-sm text-red-400">+{lowStock.length - 5} more</span>}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Recent Orders</h3>
          <button onClick={() => router.push('/lab/orders')} className="btn btn-primary btn-sm">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Patient</th><th>Tests</th><th>Urgency</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {recentOrders.map(o => (
                <tr key={o.id}>
                  <td>
                    <span className="font-mono font-bold text-blue-600">{o.patientNo}</span>
                    <span className="ml-2 font-medium">{o.patientName}</span>
                  </td>
                  <td><div className="flex flex-wrap gap-1">{o.tests.slice(0,2).map((t,i) => <span key={i} className="badge badge-blue">{t.testName}</span>)}{o.tests.length > 2 && <span className="badge badge-slate">+{o.tests.length-2}</span>}</div></td>
                  <td><span className={`badge ${urgencyColor(o.urgency)}`}>{o.urgency.toUpperCase()}</span></td>
                  <td><span className={`badge ${statusColor(o.status)}`}>{o.status.charAt(0).toUpperCase() + o.status.slice(1)}</span></td>
                  <td className="text-sm text-slate-500">{o.date} {o.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
