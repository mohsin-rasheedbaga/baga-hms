'use client';
import { useState, useEffect } from 'react';
import { initLabData, getLabOrders, updateLabOrder, type LabOrderItem } from '@/lib/lab-store';
import { triggerPrint } from '@/lib/print-utils';
import { getLabPrintDataAsync } from '@/lib/print-lab-report';

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

  const printStickers = async (order: LabOrderItem) => {
    // One sticker per test — each printed separately
    try {
      const printData = await getLabPrintDataAsync();
      const stickerTemplates = order.tests.map((t, i) => {
        const barcode = `${order.patientNo}-${t.testName.replace(/\s+/g,'').substring(0,6).toUpperCase()}`;
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sticker ${i+1}</title><style>
          @page{size:50mm 25mm;margin:2mm;}
          *{margin:0;padding:0;box-sizing:border-box;}
          body{font-family:Arial,sans-serif;width:50mm;height:25mm;overflow:hidden;border:1px dashed #999;padding:2mm;position:relative;}
          .logo{height:5mm;max-width:15mm;object-fit:contain;position:absolute;top:2mm;left:2mm;}
          .hname{font-size:5pt;font-weight:800;color:#0c2340;position:absolute;top:2mm;left:18mm;max-width:30mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
          .pid{font-size:5.5pt;font-weight:700;color:#2563eb;font-family:monospace;position:absolute;top:7mm;left:2mm;}
          .pname{font-size:5pt;font-weight:600;position:absolute;top:7mm;left:20mm;max-width:26mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
          .testname{font-size:8pt;font-weight:900;color:#0c2340;text-align:center;position:absolute;top:12mm;left:2mm;right:2mm;background:#f0f4ff;border-radius:1mm;padding:1mm 0;}
          .sample{font-size:4.5pt;color:#64748b;position:absolute;top:17mm;left:2mm;}
          .date{font-size:4.5pt;color:#64748b;position:absolute;top:17mm;right:2mm;}
          .barcode{font-size:5pt;font-family:monospace;color:#334155;background:#f8fafc;border:0.3mm solid #e2e8f0;border-radius:0.5mm;padding:0.5mm 1mm;text-align:center;position:absolute;bottom:2mm;left:2mm;right:2mm;letter-spacing:1px;}
          .urgency{position:absolute;top:2mm;right:2mm;font-size:4pt;font-weight:800;padding:0.3mm 1.5mm;border-radius:1mm;}
          .stat{background:#dc2626;color:#fff;} .urgent{background:#f59e0b;color:#fff;} .routine{background:#e2e8f0;color:#475569;}
        </style></head><body>
          ${printData.hospitalLogo ? `<img class="logo" src="${printData.hospitalLogo}" alt="" />` : ''}
          <div class="hname">${printData.hospitalName}</div>
          <div class="pid">${order.patientNo}</div>
          <div class="pname">${order.patientName} (${order.gender}/${order.age})</div>
          <div class="testname">${t.testName}</div>
          <div class="sample">${order.sampleType}</div>
          <div class="date">${order.date} ${order.time}</div>
          <div class="barcode">${barcode}</div>
          <span class="urgency ${order.urgency}">${order.urgency.toUpperCase()}</span>
        </body></html>`;
      });

      // Print each sticker in a separate window (one per test)
      for (let i = 0; i < stickerTemplates.length; i++) {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(stickerTemplates[i]);
          w.document.close();
          const delay = i === 0 ? 500 : 2000;
          setTimeout(() => { w.print(); setTimeout(() => w.close(), 500); }, delay);
        }
      }
    } catch (err) {
      console.error('Failed to print stickers:', err);
    }
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
                        <button onClick={() => printStickers(o)} className="btn btn-outline btn-sm">Print Stickers ({o.tests.length})</button>
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
