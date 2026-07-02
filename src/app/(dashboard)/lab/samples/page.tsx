'use client';
import { useState, useEffect } from 'react';
import { initLabData, getLabOrders, updateLabOrder, type LabOrderItem } from '@/lib/lab-store';
import { getLabPrintDataAsync, openPrintWindow } from '@/lib/print-lab-report';

export default function SampleCollectionPage() {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [orders, setOrders] = useState<LabOrderItem[]>([]);
  const [stickerPreviewHtml, setStickerPreviewHtml] = useState('');
  const [showStickerPreview, setShowStickerPreview] = useState(false);
  const [allStickerTemplates, setAllStickerTemplates] = useState<string[]>([]);

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
    updateLabOrder(order.id, { status: 'collected', collectedAt: time, collectedBy: (typeof window !== 'undefined' && localStorage.getItem('baga_session')) ? JSON.parse(localStorage.getItem('baga_session')!).name || 'Lab Tech' : 'Lab Tech' });
    loadData();
    showToast(`Sample collected for ${order.patientName}`, 'success');
  };

  const sendToLab = (order: LabOrderItem) => {
    updateLabOrder(order.id, { status: 'processing' });
    loadData();
    showToast(`Sent to lab for processing`, 'success');
  };

  const generateStickerTemplates = async (order: LabOrderItem): Promise<string[]> => {
    const printData = await getLabPrintDataAsync();
    return order.tests.map((t, i) => {
      const barcode = `${order.patientNo}-${t.testName.replace(/\s+/g,'').substring(0,6).toUpperCase()}`;
      // Return just the inner HTML content (no full document)
      // This makes it easy to combine multiple stickers in one page
      return `
        ${printData.hospitalLogo ? `<img style="height:5mm;max-width:15mm;object-fit:contain;display:block;margin:0 auto 1mm;" src="${printData.hospitalLogo}" alt="" />` : ''}
        <div style="font-size:5pt;font-weight:800;color:#0c2340;text-align:center;margin-bottom:0.5mm;">${printData.hospitalName}</div>
        <div style="font-size:5.5pt;font-weight:700;color:#2563eb;font-family:monospace;text-align:center;margin-bottom:0.5mm;">${order.patientNo}</div>
        <div style="font-size:5pt;font-weight:600;text-align:center;margin-bottom:0.5mm;">${order.patientName} (${order.gender}/${order.age})</div>
        <div style="font-size:8pt;font-weight:900;color:#0c2340;text-align:center;background:#f0f4ff;border-radius:1mm;padding:1mm 0;margin-bottom:0.5mm;">${t.testName}</div>
        <div style="font-size:4.5pt;color:#64748b;text-align:center;margin-bottom:0.5mm;">Sample: ${order.sampleType} | ${order.date} ${order.time}</div>
        <div style="font-size:5pt;font-family:monospace;color:#334155;background:#f8fafc;border:0.3mm solid #e2e8f0;border-radius:0.5mm;padding:0.5mm 1mm;text-align:center;letter-spacing:1px;">${barcode}</div>
        <div style="text-align:center;margin-top:0.5mm;">
          <span style="font-size:4pt;font-weight:800;padding:0.3mm 1.5mm;border-radius:1mm;background:${order.urgency === 'stat' ? '#dc2626' : order.urgency === 'urgent' ? '#f59e0b' : '#e2e8f0'};color:${order.urgency === 'routine' ? '#475569' : '#fff'};">${order.urgency.toUpperCase()}</span>
        </div>
      `;
    });
  };

  const printStickers = async (order: LabOrderItem) => {
    try {
      const templates = await generateStickerTemplates(order);
      if (templates.length === 0) return;
      setAllStickerTemplates(templates);
      // Show preview of ALL stickers combined
      const combinedPreview = templates.map((html, idx) => {
        return `<div style="border:1px dashed #999;padding:3mm;margin-bottom:3mm;border-radius:2mm;width:50mm;height:25mm;overflow:hidden;position:relative;display:flex;flex-direction:column;justify-content:center;page-break-after:always;">
          <div style="font-size:4pt;color:#94a3b8;text-align:center;margin-bottom:0.5mm;">Sticker ${idx + 1} of ${templates.length}</div>
          ${html}
        </div>`;
      }).join('');
      setStickerPreviewHtml(combinedPreview);
      setShowStickerPreview(true);
    } catch (err) {
      console.error('Failed to generate sticker preview:', err);
    }
  };

  const printAllStickers = async () => {
    setShowStickerPreview(false);
    // Combine ALL stickers into a single HTML document for printing
    // Each sticker is on its own page (page-break-after: always)
    const combinedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lab Stickers</title><style>
      @page{size:50mm 25mm;margin:2mm;}
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,sans-serif;}
      .sticker-page{width:50mm;height:25mm;page-break-after:always;overflow:hidden;border:1px dashed #999;padding:2mm;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;}
      .sticker-page:last-child{page-break-after:auto;}
      .logo{height:5mm;max-width:15mm;object-fit:contain;margin:0 auto 1mm;}
      .hname{font-size:5pt;font-weight:800;color:#0c2340;margin-bottom:0.5mm;}
      .pid{font-size:5.5pt;font-weight:700;color:#2563eb;font-family:monospace;margin-bottom:0.5mm;}
      .pname{font-size:5pt;font-weight:600;margin-bottom:0.5mm;}
      .testname{font-size:8pt;font-weight:900;color:#0c2340;background:#f0f4ff;border-radius:1mm;padding:1mm 0;margin-bottom:0.5mm;width:100%;}
      .sample-info{font-size:4.5pt;color:#64748b;margin-bottom:0.5mm;}
      .barcode{font-size:5pt;font-family:monospace;color:#334155;background:#f8fafc;border:0.3mm solid #e2e8f0;border-radius:0.5mm;padding:0.5mm 1mm;letter-spacing:1px;width:100%;}
      .urgency{font-size:4pt;font-weight:800;padding:0.3mm 1.5mm;border-radius:1mm;margin-top:0.5mm;display:inline-block;}
      .stat{background:#dc2626;color:#fff;} .urgent{background:#f59e0b;color:#fff;} .routine{background:#e2e8f0;color:#475569;}
      @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
    </style></head><body>
    ${allStickerTemplates.map((html, idx) => {
      return `<div class="sticker-page">${html}</div>`;
    }).join('')}
    </body></html>`;
    openPrintWindow(combinedHtml);
    setAllStickerTemplates([]);
    setStickerPreviewHtml('');
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

      {/* Sticker Preview Modal */}
      {showStickerPreview && (
        <div className="modal-overlay" onClick={() => { setShowStickerPreview(false); setStickerPreviewHtml(''); setAllStickerTemplates([]); }}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Sticker Preview ({allStickerTemplates.length} stickers)</h3>
              <button onClick={() => { setShowStickerPreview(false); setStickerPreviewHtml(''); setAllStickerTemplates([]); }} className="btn btn-outline btn-sm">Close</button>
            </div>
            <iframe srcDoc={stickerPreviewHtml} style={{width:'100%',height:'400px',border:'1px solid #e2e8f0',borderRadius:'8px',marginBottom:'12px'}} />\n            <div className="flex gap-2">
              <button onClick={printAllStickers} className="btn btn-primary flex-1">Print All Stickers ({allStickerTemplates.length})</button>
              <button onClick={() => { setShowStickerPreview(false); setStickerPreviewHtml(''); setAllStickerTemplates([]); }} className="btn btn-outline flex-1">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
