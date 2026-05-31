'use client';
import { useState, useEffect } from 'react';
import { initLabData, getLabOrders, updateLabOrder, type LabOrderItem } from '@/lib/lab-store';

export default function SampleCollectionPage() {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [orders, setOrders] = useState<LabOrderItem[]>([]);

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadData = () => { setOrders(getLabOrders()); };

  useEffect(() => { initLabData(); loadData(); setMounted(true); }, []);

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>;

  const pending = orders.filter(o => o.status === 'ordered');
  const collected = orders.filter(o => o.status === 'collected');
  const totalCollected = orders.filter(o => o.collectedAt).length;

  const collectSample = (order: LabOrderItem) => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const time = `${h % 12 || 12}:${m} ${ampm}`;
    updateLabOrder(order.id, { status: 'collected', collectedAt: time, collectedBy: 'Lab Tech' });
    loadData();
    showToast(`Sample collected for ${order.patientName}`, 'success');
  };

  const sendToLab = (order: LabOrderItem) => {
    updateLabOrder(order.id, { status: 'processing' });
    loadData();
    showToast(`Sent to lab for processing`, 'success');
  };

  const printSticker = (order: LabOrderItem) => {
    const html = `<!DOCTYPE html><html><head><title>Sample Sticker</title><style>
      body{margin:0;padding:20px;font-family:Arial,sans-serif;}
      .sticker{border:2px solid #000;padding:15px;width:300px;page-break-after:always;}
      h2{margin:0 0 5px;font-size:14px;text-align:center;} .center{text-align:center;}
      .row{display:flex;justify-content:space-between;margin:3px 0;font-size:12px;}
      .bold{font-weight:bold;} .small{font-size:10px;}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px;}
      th,td{border:1px solid #000;padding:4px 6px;text-align:left;}
      th{background:#f0f0f0;font-size:10px;}
      @media print{body{padding:0;}}
    </style></head><body>
      <div class="sticker">
        <h2 class="center">BAGA HOSPITAL - LABORATORY</h2>
        <div class="row"><span class="bold">Patient:</span><span>${order.patientName}</span></div>
        <div class="row"><span class="bold">ID:</span><span>${order.patientNo}</span></div>
        <div class="row"><span class="bold">Gender/Age:</span><span>${order.gender} / ${order.age}</span></div>
        <div class="row"><span class="bold">Order ID:</span><span>${order.id}</span></div>
        <div class="row"><span class="bold">Date:</span><span>${order.date} ${order.time}</span></div>
        <div class="row"><span class="bold">Sample:</span><span>${order.sampleType}</span></div>
        <div class="row"><span class="bold">Urgency:</span><span>${order.urgency.toUpperCase()}</span></div>
        <table>
          <tr><th>#</th><th>Test Name</th></tr>
          ${order.tests.map((t,i) => `<tr><td>${i+1}</td><td>${t.testName}</td></tr>`).join('')}
        </table>
        <div class="row small" style="margin-top:10px;"><span>Ordered by: ${order.orderedBy}</span></div>
        <div class="row small"><span>Collected: ${order.collectedAt || '-'} by ${order.collectedBy || '-'}</span></div>
      </div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const urgencyColor = (u: string) => u === 'stat' ? 'badge-rose' : u === 'urgent' ? 'badge-amber' : 'badge-slate';

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      <div>
        <h2 className="text-xl font-bold text-slate-800">Sample Collection</h2>
        <p className="text-sm text-slate-500">Collect and track laboratory samples</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Pending Collection</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pending.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Collected Today</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{collected.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Collected (All)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{totalCollected}</p>
        </div>
      </div>

      {/* Pending Collection */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Pending Collection ({pending.length})
          {pending.length > 0 && <span className="ml-2 badge badge-amber">Action Required</span>}
        </h3>
        {pending.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No samples pending collection</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Patient</th><th>Tests</th><th>Urgency</th><th>Sample</th><th>Ordered By</th><th>Time</th><th>Action</th></tr></thead>
              <tbody>
                {pending.map(o => (
                  <tr key={o.id}>
                    <td>
                      <span className="font-mono font-bold text-blue-600 text-xs">{o.patientNo}</span>
                      <div className="font-medium">{o.patientName}</div>
                    </td>
                    <td><div className="flex flex-wrap gap-1">{o.tests.slice(0,2).map((t,i) => <span key={i} className="badge badge-blue text-xs">{t.testName}</span>)}{o.tests.length > 2 && <span className="badge badge-slate text-xs">+{o.tests.length-2}</span>}</div></td>
                    <td><span className={`badge ${urgencyColor(o.urgency)}`}>{o.urgency.toUpperCase()}</span></td>
                    <td className="text-sm">{o.sampleType}</td>
                    <td className="text-sm">{o.orderedBy}</td>
                    <td className="text-sm text-slate-500">{o.time}</td>
                    <td><button onClick={() => collectSample(o)} className="btn btn-primary btn-sm">Collect</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collected Samples */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Collected Samples ({collected.length})</h3>
        {collected.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No collected samples</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Patient</th><th>Tests</th><th>Collected At</th><th>Actions</th></tr></thead>
              <tbody>
                {collected.map(o => (
                  <tr key={o.id}>
                    <td>
                      <span className="font-mono font-bold text-blue-600 text-xs">{o.patientNo}</span>
                      <div className="font-medium">{o.patientName}</div>
                    </td>
                    <td><div className="flex flex-wrap gap-1">{o.tests.map((t,i) => <span key={i} className="badge badge-blue text-xs">{t.testName}</span>)}</div></td>
                    <td className="text-sm">{o.collectedAt} <span className="text-slate-400">by {o.collectedBy}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => printSticker(o)} className="btn btn-outline btn-sm">Print Sticker</button>
                        <button onClick={() => sendToLab(o)} className="btn btn-primary btn-sm">Send to Lab</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
