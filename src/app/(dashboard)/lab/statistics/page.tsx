'use client';
import { useState, useEffect } from 'react';
import { initLabData, getLabStatistics, todayStr } from '@/lib/lab-store';

export default function StatisticsPage() {
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');

  useEffect(() => { initLabData(); setMounted(true); }, []);

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>;

  const stats = getLabStatistics(period);
  const dailyStats = stats.dailyStats;
  const maxOrders = Math.max(...dailyStats.map(d => d.orders), 1);
  const maxRevenue = Math.max(...dailyStats.map(d => d.revenue), 1);

  const periodLabel = period === 'today' ? 'Today' : period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : period === 'year' ? 'This Year' : 'All Time';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Statistics</h2>
          <p className="text-sm text-slate-500">Lab performance analytics — {periodLabel}</p>
        </div>
        <div className="flex gap-2">
          {(['today', 'week', 'month', 'year', 'all'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-outline'}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue & Profit Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Orders</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalOrders}</p>
          <p className="text-xs text-slate-400 mt-1">Completed: {stats.completedOrders}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Revenue</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">Rs. {stats.revenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Expenses</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">Rs. {stats.totalExpenses.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Profit</p>
          <p className={`text-2xl font-bold mt-1 ${stats.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            Rs. {stats.profit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Daily Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Daily Orders Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Daily Orders</h3>
          {dailyStats.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No data for this period</p>
          ) : (
            <div className="space-y-2">
              {dailyStats.map(d => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-20 flex-shrink-0">{d.date.slice(5)}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2 transition-all" style={{ width: `${(d.orders / maxOrders) * 100}%`, minWidth: d.orders > 0 ? '24px' : '0' }}>
                      {d.orders > 0 && <span className="text-xs text-white font-bold">{d.orders}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily Revenue Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Daily Revenue</h3>
          {dailyStats.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No data for this period</p>
          ) : (
            <div className="space-y-2">
              {dailyStats.map(d => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-20 flex-shrink-0">{d.date.slice(5)}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full flex items-center justify-end pr-2 transition-all" style={{ width: `${(d.revenue / maxRevenue) * 100}%`, minWidth: d.revenue > 0 ? '24px' : '0' }}>
                      {d.revenue > 0 && <span className="text-xs text-white font-bold">{(d.revenue / 1000).toFixed(0)}k</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Most Ordered Tests */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Most Ordered Tests</h3>
          {stats.topTests.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No data</p>
          ) : (
            <div className="space-y-3">
              {stats.topTests.map((t, i) => {
                const maxCount = stats.topTests[0].count;
                return (
                  <div key={t.name} className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-sm text-slate-400">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-700">{t.name}</span>
                        <span className="text-xs text-slate-500">{t.count} orders</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(t.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Referring Doctors */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Top Referring Doctors</h3>
          {stats.topDoctors.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No data</p>
          ) : (
            <div className="space-y-3">
              {stats.topDoctors.map((d, i) => {
                const maxCount = stats.topDoctors[0].count;
                return (
                  <div key={d.name} className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-sm text-slate-400">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-slate-700">{d.name}</span>
                        <span className="text-xs text-slate-500">{d.count} orders</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(d.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Additional Stats */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Performance Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-800">{stats.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0}%</p>
            <p className="text-xs text-slate-500 mt-1">Completion Rate</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-800">{stats.completedOrders > 0 ? Math.round(stats.revenue / stats.completedOrders) : 0}</p>
            <p className="text-xs text-slate-500 mt-1">Avg Revenue/Order</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{stats.abnormalCount}</p>
            <p className="text-xs text-slate-500 mt-1">Abnormal Results</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-800">{stats.topTests.reduce((s, t) => s + t.count, 0)}</p>
            <p className="text-xs text-slate-500 mt-1">Total Tests Run</p>
          </div>
        </div>
      </div>
    </div>
  );
}
