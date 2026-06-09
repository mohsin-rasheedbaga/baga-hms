'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getActivePrescriptions, updatePrescription, addDispense,
  getMedicines, updateMedicine, triggerPrint, getHospitalSettings,
  genId, todayStr, timeStr,
} from '@/lib/store';
import type { Prescription } from '@/lib/types';

export default function PrescriptionsPage() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [dispenseRx, setDispenseRx] = useState<Prescription | null>(null);
  const [currency, setCurrency] = useState('Rs.');
  const [dispenseReceiptHtml, setDispenseReceiptHtml] = useState('');
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  const loadRxs = useCallback(() => {
    setPrescriptions(getActivePrescriptions());
  }, []);
  useEffect(() => {
    const s = getHospitalSettings();
    setCurrency(s.currency);
  }, []);
  useEffect(() => { loadRxs(); }, [loadRxs]);

  const confirmDispense = () => {
    if (!dispenseRx) return;

    // Check stock for each medicine before dispensing
    const allMeds = getMedicines();
    let hasStockIssue = false;
    for (const m of dispenseRx.medicines) {
      const found = allMeds.find(med => med.name === m.name);
      if (found && found.stock <= 0) {
        hasStockIssue = true;
        showToast(`Warning: ${m.name} is out of stock!`, 'error');
      }
    }
    if (hasStockIssue) return;

    // Reduce stock for each found medicine by 1
    for (const m of dispenseRx.medicines) {
      const found = allMeds.find(med => med.name === m.name);
      if (found) {
        updateMedicine(found.id, { stock: Math.max(0, found.stock - 1) });
      }
    }

    updatePrescription(dispenseRx.id, { status: 'Dispensed' });
    addDispense({
      id: genId(), prescriptionId: dispenseRx.id, patientNo: dispenseRx.patientNo,
      patientName: dispenseRx.patientName,
      medicines: dispenseRx.medicines.map(m => m.name),
      dispensedBy: 'Pharmacist', date: todayStr(), time: timeStr(),
    });

    // Generate dispense receipt HTML
    const hospital = (() => { try { return JSON.parse(localStorage.getItem('baga_hospital') || '{}'); } catch { return {}; } })();
    const hospitalSettings = getHospitalSettings();
    const hospitalName = hospital.name || 'BAGA Hospital';
    const hospitalAddress = hospital.address || '';
    const hospitalPhone = hospital.phone || '';
    const receiptFooter = hospitalSettings.receiptFooter || 'Thank you for visiting!';
    const now = new Date();
    const dispensedBy = (() => { try { const s = JSON.parse(localStorage.getItem('baga_session') || '{}'); return s.name || 'Pharmacist'; } catch { return 'Pharmacist'; } })();

    const medRows = dispenseRx.medicines.map((m, i) => {
      const alt = i % 2 === 0 ? '#fff' : '#f8fafc';
      return `<tr style="background:${alt};">
        <td style="padding:4px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
        <td style="padding:4px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;font-weight:600;">${m.name}</td>
        <td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #e2e8f0;">${m.form}, ${m.strength}</td>
        <td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #e2e8f0;">${m.dosage || '-'}</td>
        <td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #e2e8f0;">${m.duration}</td>
        <td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #e2e8f0;">${m.frequency || '-'}</td>
      </tr>`;
    }).join('');

    const receiptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dispense Receipt</title><style>
      @page{size:80mm auto;margin:3mm;}
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;font-size:11px;width:80mm;margin:0 auto;}
      .header{text-align:center;padding:6px 0;border-bottom:2px dashed #cbd5e1;}
      .hname{font-size:14px;font-weight:800;color:#0c2340;letter-spacing:1px;}
      .hsub{font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;}
      .info{padding:4px 0;border-bottom:1px dashed #e2e8f0;}
      .info-row{display:flex;justify-content:space-between;font-size:10px;padding:1px 0;}
      .info-row .label{color:#64748b;font-weight:600;}
      .info-row .value{color:#1e293b;font-weight:500;}
      .title-bar{text-align:center;padding:4px 0;border-bottom:1px dashed #e2e8f0;border-top:1px dashed #e2e8f0;}
      .title-bar h3{font-size:12px;font-weight:800;color:#0c2340;letter-spacing:1px;}
      table{width:100%;border-collapse:collapse;}
      th{padding:3px 6px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0c2340;background:#f1f5f9;border-bottom:2px solid #0c2340;text-align:left;}
      .footer{text-align:center;padding:6px 0;margin-top:4px;border-top:2px dashed #cbd5e1;}
      .footer .ty{font-size:9px;color:#64748b;font-style:italic;}
      @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
    </style></head><body>
      <div class="header">
        <div class="hname">${hospitalName}</div>
        <div class="hsub">${hospitalAddress}${hospitalPhone ? ' | ' + hospitalPhone : ''}</div>
        <div class="hsub">Pharmacy Department - Dispense Receipt</div>
      </div>
      <div class="info">
        <div class="info-row"><span class="label">Patient:</span><span class="value">${dispenseRx.patientName}</span></div>
        <div class="info-row"><span class="label">ID:</span><span class="value">${dispenseRx.patientNo}</span></div>
        <div class="info-row"><span class="label">Prescribed By:</span><span class="value">${dispenseRx.prescribedBy}</span></div>
        <div class="info-row"><span class="label">Prescribed Date:</span><span class="value">${dispenseRx.date}</span></div>
        <div class="info-row"><span class="label">Dispensed By:</span><span class="value">${dispensedBy}</span></div>
        <div class="info-row"><span class="label">Date/Time:</span><span class="value">${todayStr()} ${timeStr()}</span></div>
      </div>
      <div class="title-bar"><h3>Dispensed Medicines</h3></div>
      <table>
        <thead><tr><th>#</th><th>Medicine</th><th>Form/Str</th><th>Dosage</th><th>Duration</th><th>Frequency</th></tr></thead>
        <tbody>${medRows}</tbody>
      </table>
      ${dispenseRx.notes ? `<div style="padding:4px 0;margin-top:4px;"><p style="font-size:10px;color:#475569;"><strong>Notes:</strong> ${dispenseRx.notes}</p></div>` : ''}
      <div class="footer">
        <div class="ty">${receiptFooter}</div>
      </div>
    </body></html>`;

    setDispenseReceiptHtml(receiptHtml);
    setShowReceiptPreview(true);
    setDispenseRx(null);
    loadRxs();
    showToast('Medicines dispensed successfully!', 'success');
  };

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Prescriptions</h2>
        <p className="text-sm text-slate-500">Manage active prescriptions from doctors and dispense medicines</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Active Prescriptions</p>
          <p className="text-2xl font-bold text-amber-700">{prescriptions.length}</p>
        </div>
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Total Medicines</p>
          <p className="text-2xl font-bold text-emerald-700">{prescriptions.reduce((a, rx) => a + rx.medicines.length, 0)}</p>
        </div>
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Unique Patients</p>
          <p className="text-2xl font-bold text-blue-700">{new Set(prescriptions.map(rx => rx.patientNo)).size}</p>
        </div>
      </div>

      {/* Active Prescriptions Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="font-bold text-slate-800">
              Active Prescriptions
              {prescriptions.length > 0 && <span className="ml-2 badge badge-amber">{prescriptions.length} pending</span>}
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient No</th>
                <th>Patient Name</th>
                <th>Medicines</th>
                <th>Prescribed By</th>
                <th>Date</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map(rx => (
                <tr key={rx.id}>
                  <td className="font-mono font-bold text-blue-600">{rx.patientNo}</td>
                  <td className="font-medium">{rx.patientName}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {rx.medicines.map((m, i) => (
                        <span key={i} className="badge badge-amber">{m.name} - {m.dosage || m.strength} - {m.duration}</span>
                      ))}
                    </div>
                  </td>
                  <td className="text-sm">{rx.prescribedBy}</td>
                  <td>{rx.date}</td>
                  <td className="text-sm text-slate-500 max-w-[150px] truncate">{rx.notes || '-'}</td>
                  <td><span className="badge badge-blue">{rx.status}</span></td>
                  <td><button onClick={() => setDispenseRx(rx)} className="btn btn-success btn-sm">Dispense</button></td>
                </tr>
              ))}
              {prescriptions.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    No active prescriptions. Prescriptions will appear when doctors prescribe medicines.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispense Receipt Preview Modal */}
      {showReceiptPreview && dispenseReceiptHtml && (
        <div className="modal-overlay" onClick={() => setShowReceiptPreview(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Dispense Receipt</h3>
              <div className="flex gap-2">
                <button onClick={() => { triggerPrint(dispenseReceiptHtml); }} className="btn btn-primary btn-sm">
                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Print Receipt
                </button>
                <button onClick={() => { setShowReceiptPreview(false); setDispenseReceiptHtml(''); }} className="btn btn-outline btn-sm">Close</button>
              </div>
            </div>
            <iframe srcDoc={dispenseReceiptHtml} style={{ width: '100%', height: '500px', border: '1px solid #e2e8f0', borderRadius: '8px' }} title="Dispense Receipt" />
          </div>
        </div>
      )}

      {/* Dispense Confirm Modal */}
      {dispenseRx && (
        <div className="modal-overlay" onClick={() => setDispenseRx(null)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Confirm Dispense</h3>
            <p className="text-sm text-blue-600 mb-4">{dispenseRx.patientNo} - {dispenseRx.patientName}</p>
            <div className="space-y-2 mb-4">
              {dispenseRx.medicines.map((m, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="font-semibold text-sm">{m.name} <span className="text-slate-400 font-normal">({m.form}, {m.strength})</span></p>
                  <p className="text-xs text-slate-600">{m.dosage} | {m.duration} | {m.frequency}{m.instructions ? ` | ${m.instructions}` : ''}</p>
                </div>
              ))}
            </div>
            {dispenseRx.notes && (
              <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-semibold text-slate-600">Notes:</span> {dispenseRx.notes}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={confirmDispense} className="btn btn-success btn-lg flex-1">Confirm Dispense</button>
              <button onClick={() => setDispenseRx(null)} className="btn btn-outline btn-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
