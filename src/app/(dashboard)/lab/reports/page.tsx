'use client';
import { useState, useEffect } from 'react';
import { initLabData, getLabOrders, type LabOrderItem } from '@/lib/lab-store';
import { generateProfessionalLabReportHtml, getLabPrintData } from '@/lib/print-lab-report';
import { triggerPrint } from '@/lib/print-utils';

export default function CompletedReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [orders, setOrders] = useState<LabOrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [viewOrder, setViewOrder] = useState<LabOrderItem | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadData = () => { setOrders(getLabOrders()); };

  useEffect(() => { initLabData(); loadData(); setMounted(true); }, []);

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>;

  const completed = orders.filter(o => o.status === 'completed');
  const abnormalReports = completed.filter(o => o.results.some(r => r.flag !== 'Normal'));
  const totalRevenue = completed.reduce((s, o) => s + o.paidAmount, 0);

  const filtered = completed.filter(o => {
    const matchSearch = search === '' || o.patientName.toLowerCase().includes(search.toLowerCase()) || o.patientNo.toLowerCase().includes(search.toLowerCase());
    const matchDate = dateFilter === '' || o.date === dateFilter;
    return matchSearch && matchDate;
  });

  const flagClass = (flag: string) => flag === 'Normal' ? 'bg-green-50 text-green-700' : flag === 'Low' ? 'bg-amber-50 text-amber-700' : flag === 'High' ? 'bg-orange-50 text-orange-700' : 'bg-red-100 text-red-800';
  const flagBadge = (flag: string) => flag === 'Normal' ? 'badge-green' : flag === 'Low' ? 'badge-amber' : flag === 'High' ? 'badge-rose' : 'badge-red';

  const printReport = (order: LabOrderItem) => {
    const printData = getLabPrintData();
    const html = generateProfessionalLabReportHtml({
      patientName: order.patientName,
      patientNo: order.patientNo,
      age: order.age,
      gender: order.gender,
      sampleType: order.sampleType,
      orderedBy: order.orderedBy,
      date: order.date,
      time: order.time || '',
      orderId: order.id,
      collectedAt: order.collectedAt,
      completedAt: order.completedAt,
      results: order.results,
      techName: printData.techName,
      reportDocHtml: printData.reportDocHtml,
      hospitalName: printData.hospitalName,
      hospitalAddress: printData.hospitalAddress,
      hospitalPhone: printData.hospitalPhone,
    });
    triggerPrint(html);
  };

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      <div>
        <h2 className="text-xl font-bold text-slate-800">Completed Reports</h2>
        <p className="text-sm text-slate-500">View and print completed lab reports</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Reports</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{completed.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Abnormal Reports</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{abnormalReports.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">Rs. {totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <input type="text" className="form-input pl-10" placeholder="Search by patient name or ID..." value={search} onChange={e => setSearch(e.target.value)} />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <input type="date" className="form-input w-auto" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        {dateFilter && <button onClick={() => setDateFilter('')} className="btn btn-outline btn-sm">Clear Date</button>}
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Patient</th><th>Tests</th><th>Abnormal</th><th>Amount</th><th>Completed</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(o => {
                const abnormalCount = o.results.filter(r => r.flag !== 'Normal').length;
                return (
                  <tr key={o.id}>
                    <td>
                      <span className="font-mono font-bold text-blue-600 text-xs">{o.patientNo}</span>
                      <div className="font-medium">{o.patientName}</div>
                      <div className="text-xs text-slate-400">{o.gender} / {o.age}</div>
                    </td>
                    <td><div className="flex flex-wrap gap-1">{o.tests.map((t,i) => <span key={i} className="badge badge-blue text-xs">{t.testName}</span>)}</div></td>
                    <td>
                      {abnormalCount > 0 ? (
                        <span className="badge badge-rose">{abnormalCount} abnormal</span>
                      ) : (
                        <span className="badge badge-green">Normal</span>
                      )}
                    </td>
                    <td className="font-semibold text-emerald-600">Rs. {o.paidAmount.toLocaleString()}</td>
                    <td className="text-sm text-slate-500">{o.completedAt}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => setViewOrder(o)} className="btn btn-outline btn-sm">View</button>
                        <button onClick={() => printReport(o)} className="btn btn-primary btn-sm">Print</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No completed reports found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Report Modal */}
      {viewOrder && (
        <div className="modal-overlay" onClick={() => setViewOrder(null)}>
          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Lab Report</h3>
                <p className="text-sm text-blue-600">{viewOrder.patientNo} — {viewOrder.patientName} ({viewOrder.gender}, {viewOrder.age})</p>
                <p className="text-xs text-slate-400">Ordered by {viewOrder.orderedBy} on {viewOrder.date} | Collected: {viewOrder.collectedAt || '-'} | Completed: {viewOrder.completedAt || '-'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => printReport(viewOrder)} className="btn btn-primary btn-sm">Print</button>
                <button onClick={() => setViewOrder(null)} className="btn btn-outline btn-sm">Close</button>
              </div>
            </div>

            {[...new Set(viewOrder.results.map(r => r.testName))].map(testName => {
              const testResults = viewOrder.results.filter(r => r.testName === testName);
              return (
                <div key={testName} className="mb-4">
                  <h4 className="font-semibold text-slate-800 mb-2">{testName}</h4>
                  <table className="data-table">
                    <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Ref Range</th><th>Flag</th></tr></thead>
                    <tbody>
                      {testResults.map((r, i) => (
                        <tr key={i} className={flagClass(r.flag)}>
                          <td className="font-medium">{r.parameter}</td>
                          <td className="font-bold">{r.value}</td>
                          <td className="text-sm">{r.unit}</td>
                          <td className="text-sm text-slate-500">{r.refRange}</td>
                          <td><span className={`badge ${flagBadge(r.flag)}`}>{r.flag}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm">
              <strong>Summary:</strong> {viewOrder.results.length} parameters | {viewOrder.results.filter(r => r.flag !== 'Normal').length} abnormal
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
