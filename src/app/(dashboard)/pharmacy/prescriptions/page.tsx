'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getActivePrescriptions, updatePrescription, addDispense,
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

  const loadRxs = useCallback(() => {
    setPrescriptions(getActivePrescriptions());
  }, []);
  useEffect(() => { loadRxs(); }, [loadRxs]);

  const confirmDispense = () => {
    if (!dispenseRx) return;
    updatePrescription(dispenseRx.id, { status: 'Dispensed' });
    addDispense({
      id: genId(), prescriptionId: dispenseRx.id, patientNo: dispenseRx.patientNo,
      patientName: dispenseRx.patientName,
      medicines: dispenseRx.medicines.map(m => m.name),
      dispensedBy: 'Pharmacist', date: todayStr(), time: timeStr(),
    });
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
