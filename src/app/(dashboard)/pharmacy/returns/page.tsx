'use client';
import { useState, useEffect } from 'react';
import { todayStr } from '@/lib/store';
import { triggerPrint } from '@/lib/print-utils';

interface MedicineReturn {
  id: string;
  medicineId: string;
  medicineName: string;
  quantity: number;
  returnPrice: number;
  reason: string;
  returnedBy: string;
  date: string;
  time: string;
}

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}

const RETURNS_KEY = 'baga_pharmacy_returns';

async function getPrintHeader() {
  let hospitalName = 'BAGA HOSPITAL';
  let hospitalLogo = '';
  let hospitalAddress = '';
  let hospitalPhone = '';
  const isEl = typeof window !== 'undefined' && !!(window as any).bagaAPI;
  if (isEl) {
    try {
      const li = await (window as any).bagaAPI.getFullLicenseInfo();
      if (li) {
        if (li.hospitalName) hospitalName = li.hospitalName;
        if (li.hospitalAddress) hospitalAddress = li.hospitalAddress;
        if (li.phone || li.hospitalPhone) hospitalPhone = li.phone || li.hospitalPhone;
      }
    } catch (e) {}
    try {
      const logoResult = await (window as any).bagaAPI.getLogoBase64();
      if (logoResult.success) hospitalLogo = logoResult.data;
    } catch (e) {}
  }
  return { hospitalName, hospitalLogo, hospitalAddress, hospitalPhone };
}

export default function PharmacyReturnsPage() {
  const [returns, setReturns] = useState<MedicineReturn[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [medId, setMedId] = useState('');
  const [medName, setMedName] = useState('');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const [medQuery, setMedQuery] = useState('');
  const [medResults, setMedResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => { setReturns(lsGet<MedicineReturn[]>(RETURNS_KEY, [])); }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleMedSearch = (q: string) => {
    setMedQuery(q);
    if (q.length < 1) { setMedResults([]); setShowDropdown(false); return; }
    try {
      const meds = JSON.parse(localStorage.getItem('baga_medicines') || '[]') as any[];
      const lq = q.toLowerCase();
      setMedResults(meds.filter((m: any) =>
        m.name.toLowerCase().includes(lq) || m.genericName.toLowerCase().includes(lq)
      ).slice(0, 20));
      setShowDropdown(true);
    } catch { setMedResults([]); }
  };

  const selectMed = (m: any) => {
    setMedId(m.id);
    setMedName(m.name);
    setMedQuery(m.name);
    setMedResults([]);
    setShowDropdown(false);
  };

  const processReturn = () => {
    if (!medId || !reason.trim()) { showToast('Select medicine and enter reason', 'error'); return; }
    if (qty < 1) { showToast('Enter valid quantity', 'error'); return; }
    try {
      // Add stock back
      const medsRaw = localStorage.getItem('baga_medicines');
      if (medsRaw) {
        const meds = JSON.parse(medsRaw) as any[];
        const med = meds.find((m: any) => m.id === medId);
        if (med) {
          med.stock = (med.stock || 0) + qty;
          localStorage.setItem('baga_medicines', JSON.stringify(meds));
        }
      }
      // Save return
      const sessionData = JSON.parse(localStorage.getItem('baga_session') || '{}');
      const newReturn: MedicineReturn = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
        medicineId: medId,
        medicineName: medName,
        quantity: qty,
        returnPrice: 0,
        reason: reason.trim(),
        returnedBy: sessionData.name || 'Pharmacist',
        date: todayStr(),
        time: new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }),
      };
      const all = lsGet<MedicineReturn[]>(RETURNS_KEY, []);
      all.push(newReturn);
      localStorage.setItem(RETURNS_KEY, JSON.stringify(all));
      setReturns(all);
      showToast(`Returned ${qty} x ${medName} to stock`, 'success');
      setShowModal(false);
      setMedId(''); setMedName(''); setQty(1); setReason(''); setMedQuery('');
    } catch (e) {
      showToast('Failed to process return', 'error');
    }
  };

  const printReturns = async () => {
    if (returns.length === 0) return;
    const { hospitalName, hospitalLogo, hospitalAddress, hospitalPhone } = await getPrintHeader();
    const rows = returns.sort((a, b) => b.date.localeCompare(a.date)).map((r, i) => `<tr style="background:${i%2===0?'#fff':'#f0fdf4'}"><td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #d1d5db;">${i+1}</td><td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #d1d5db;font-weight:600;">${r.medicineName}</td><td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #d1d5db;text-align:center;">${r.quantity}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #d1d5db;">${r.reason}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #d1d5db;">${r.returnedBy}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #d1d5db;">${r.date} ${r.time}</td></tr>`).join('');
    triggerPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Returns</title><style>@page{size:A4;margin:10mm;}*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;font-size:11px;}.header{text-align:center;padding:10px 0;border-bottom:2px solid #059669;}.logo{width:48px;height:48px;object-fit:contain;}.hname{font-size:18px;font-weight:800;color:#065f46;}.haddr,.hphone{font-size:10px;color:#64748b;}.title{text-align:center;padding:8px;font-size:14px;font-weight:700;color:#065f46;}table{width:100%;border-collapse:collapse;margin-top:8px;}th{padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#fff;background:#059669;border-bottom:2px solid #065f46;text-align:left;}td{padding:4px 8px;font-size:10px;border-bottom:1px solid #d1d5db;}.footer{text-align:center;padding:10px;font-size:9px;color:#94a3b8;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><div class="header">${hospitalLogo?`<img class="logo" src="${hospitalLogo}" />`:''}<div class="hname">${hospitalName}</div>${hospitalAddress?`<div class="haddr">${hospitalAddress}</div>`:''}${hospitalPhone?`<div class="hphone">${hospitalPhone}</div>`:''}</div><div class="title">Medicine Returns Report</div><table><thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Reason</th><th>Returned By</th><th>Date/Time</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Total Returns: ${returns.length} | Generated: ${todayStr()}</div></body></html>`);
  };

  const totalReturned = returns.length;

  return (
    <div className="space-y-5">
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium ${toastType === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Return Medicine</h2>
          <p className="text-sm text-slate-500">View and process medicine returns</p>
        </div>
        <div className="flex gap-2">
          {returns.length > 0 && (
            <button onClick={printReturns} className="btn btn-outline">
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print
            </button>
          )}
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Return
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Total Returns</p>
          <p className="text-2xl font-bold text-blue-700">{totalReturned}</p>
        </div>
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Today&apos;s Returns</p>
          <p className="text-2xl font-bold text-emerald-700">{returns.filter(r => r.date === todayStr()).length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Return History</h3>
          <span className="badge badge-amber">{totalReturned} returns</span>
        </div>
        {returns.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            <p className="text-slate-400 font-medium">No returns recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Medicine</th>
                  <th className="text-center">Qty</th>
                  <th>Reason</th>
                  <th>Returned By</th>
                </tr>
              </thead>
              <tbody>
                {returns.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="text-slate-400 text-sm">{i + 1}</td>
                    <td className="font-medium text-slate-700">{r.date}</td>
                    <td className="text-slate-500">{r.time}</td>
                    <td className="font-semibold text-slate-800">{r.medicineName}</td>
                    <td className="text-center"><span className="badge badge-amber">{r.quantity}</span></td>
                    <td className="text-sm text-slate-600 max-w-[200px] truncate">{r.reason}</td>
                    <td className="text-sm text-slate-500">{r.returnedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Return Medicine to Stock</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-outline btn-sm">Close</button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <label className="form-label">Medicine *</label>
                <input type="text" className="form-input" placeholder="Search medicine..." value={medQuery} onChange={e => handleMedSearch(e.target.value)} />
                {showDropdown && medResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                    {medResults.map((m: any) => (
                      <button key={m.id} onClick={() => selectMed(m)} className="w-full text-left px-4 py-2 hover:bg-emerald-50 border-b border-slate-100 last:border-0 text-sm">
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-xs text-slate-400 ml-2">({m.form}, {m.strength})</span>
                        <span className="text-xs text-slate-400 ml-1">Stock: {m.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">Quantity *</label>
                <input type="number" className="form-input" min={1} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div>
                <label className="form-label">Return Reason *</label>
                <textarea className="form-input" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Wrong purchase, damaged, expired..." />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="btn btn-outline flex-1">Cancel</button>
                <button onClick={processReturn} className="btn btn-primary flex-1">Process Return</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}