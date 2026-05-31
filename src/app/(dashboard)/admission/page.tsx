'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getAdmissions, updateAdmission, getActiveAdmissions, todayStr, timeStr, genId,
  addBill, getBillsByPatient, getRoomTypes, getRoomTypeById, getActiveRoomTypes,
  getHospitalSettings, getVisits, getVisitsByPatient, getHospital,
} from '@/lib/store';
import type { Admission, RoomType, Bill, BillItem } from '@/lib/types';

/* ========== HELPERS ========== */
function calcDays(admittedAt: string, dischargedAt?: string): number {
  const start = new Date(admittedAt);
  const end = dischargedAt ? new Date(dischargedAt) : new Date();
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

/* ========== MAIN COMPONENT ========== */
export default function AdmissionPage() {
  const [approvedAdmissions, setApprovedAdmissions] = useState<Admission[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<Admission[]>([]);
  const [dischargedAdmissions, setDischargedAdmissions] = useState<Admission[]>([]);
  const [tab, setTab] = useState<'approved' | 'admitted' | 'discharged'>('approved');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [printContent, setPrintContent] = useState<string | null>(null);
  const [settings, setSettings] = useState({ currency: 'Rs.', admissionFee: 2000 });
  const [activeRoomTypes, setActiveRoomTypes] = useState<RoomType[]>([]);

  // Process Admission Modal
  const [processAdmission, setProcessAdmission] = useState<Admission | null>(null);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [selectedDoctorFee, setSelectedDoctorFee] = useState(0);

  // Discharge Modal
  const [dischargeAdmission, setDischargeAdmission] = useState<Admission | null>(null);
  const [pendingBills, setPendingBills] = useState<Bill[]>([]);
  const [canDischarge, setCanDischarge] = useState(false);

  // View admission file
  const [viewAdmission, setViewAdmission] = useState<Admission | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshData = useCallback(() => {
    const all = getAdmissions();
    setApprovedAdmissions(all.filter(a => a.status === 'Approved'));
    setActiveAdmissions(all.filter(a => a.status === 'Admitted'));
    setDischargedAdmissions(all.filter(a => a.status === 'Discharged'));
    setSettings(getHospitalSettings());
    setActiveRoomTypes(getActiveRoomTypes());
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  /* ========= GET DOCTOR FEE FOR ADMISSION ========= */
  const getDoctorFee = (admission: Admission): number => {
    if (admission.doctorFee) return admission.doctorFee;
    const visits = getVisitsByPatient(admission.patientId);
    const matchingVisit = visits.find(v => v.doctor === admission.doctor);
    return matchingVisit?.doctorFee || 0;
  };

  /* ========= OPEN PROCESS ADMISSION MODAL ========= */
  const openProcessModal = (admission: Admission) => {
    setProcessAdmission(admission);
    setSelectedRoomTypeId('');
    setRoomInput('');
    setSelectedDoctorFee(getDoctorFee(admission));
  };

  /* ========= CALCULATE TOTALS ========= */
  const getRoomCharges = (): number => {
    if (!selectedRoomTypeId) return 0;
    const rt = getRoomTypeById(selectedRoomTypeId);
    return rt?.chargesPerNight || 0;
  };

  const getTotal = (): number => {
    return settings.admissionFee + getRoomCharges();
  };

  /* ========= PROCESS ADMISSION ========= */
  const handleCollectAndAdmit = () => {
    if (!processAdmission) return;
    if (!selectedRoomTypeId) { showToast('Please select a room type', 'error'); return; }
    if (!roomInput.trim()) { showToast('Please enter room number', 'error'); return; }

    const roomType = getRoomTypeById(selectedRoomTypeId);
    if (!roomType) return;

    // Create admission bill
    const billItems: BillItem[] = [
      { description: `Admission Fee`, amount: settings.admissionFee, type: 'Admission', selected: true, quantity: 1 },
      { description: `${roomType.name} - Room Charges (Advance)`, amount: roomType.chargesPerNight, type: 'Admission', selected: true, quantity: 1 },
    ];

    if (selectedDoctorFee > 0) {
      billItems.push({ description: `Doctor Fee - ${processAdmission.doctor}`, amount: selectedDoctorFee, type: 'Consultation', selected: true, quantity: 1 });
    }

    const totalAmount = billItems.reduce((sum, item) => sum + item.amount, 0);

    const bill: Bill = {
      id: genId(),
      patientId: processAdmission.patientId,
      patientNo: processAdmission.patientNo,
      patientName: processAdmission.patientName,
      visitId: '',
      items: billItems,
      totalAmount,
      paidAmount: totalAmount,
      status: 'Paid',
      paymentMethod: 'Cash',
      date: todayStr(),
      time: timeStr(),
      receivedBy: 'Reception',
    };
    addBill(bill);

    // Update admission to Admitted
    updateAdmission(processAdmission.id, {
      status: 'Admitted',
      roomNo: roomInput.trim(),
      roomTypeId: selectedRoomTypeId,
      roomChargesPerNight: roomType.chargesPerNight,
      admittedAt: todayStr(),
      doctorFee: selectedDoctorFee,
    });

    showToast(`${processAdmission.patientName} admitted to ${roomInput.trim()} successfully!`);
    setProcessAdmission(null);
    refreshData();
  };

  /* ========= OPEN DISCHARGE MODAL ========= */
  const openDischargeModal = (admission: Admission) => {
    setDischargeAdmission(admission);
    const bills = getBillsByPatient(admission.patientId);
    const pending = bills.filter(b => b.status !== 'Paid');
    setPendingBills(pending);
    setCanDischarge(pending.length === 0);
  };

  /* ========= DISCHARGE ========= */
  const handleConfirmDischarge = () => {
    if (!dischargeAdmission || !canDischarge) return;

    const totalDays = calcDays(dischargeAdmission.admittedAt || dischargeAdmission.admissionDate);
    const roomChargesTotal = (dischargeAdmission.roomChargesPerNight || 0) * totalDays;

    // Create final bill for room charges
    if (roomChargesTotal > 0) {
      const roomType = dischargeAdmission.roomTypeId ? getRoomTypeById(dischargeAdmission.roomTypeId) : null;
      const finalBill: Bill = {
        id: genId(),
        patientId: dischargeAdmission.patientId,
        patientNo: dischargeAdmission.patientNo,
        patientName: dischargeAdmission.patientName,
        visitId: '',
        items: [
          {
            description: `${roomType?.name || 'Room'} - ${totalDays} Night(s) Room Charges`,
            amount: roomChargesTotal,
            type: 'Admission',
            selected: true,
            quantity: totalDays,
          },
        ],
        totalAmount: roomChargesTotal,
        paidAmount: 0,
        status: 'Unpaid',
        paymentMethod: 'Pending',
        date: todayStr(),
        time: timeStr(),
        receivedBy: 'Reception',
      };
      addBill(finalBill);
    }

    updateAdmission(dischargeAdmission.id, {
      status: 'Discharged',
      dischargedAt: todayStr(),
    });

    showToast(`${dischargeAdmission.patientName} discharged successfully!`);
    setDischargeAdmission(null);
    refreshData();
  };

  /* ========= PRINT ADMISSION FILE ========= */
  const handlePrintSlip = (admission: Admission) => {
    const hospital = getHospital();
    const totalDays = admission.admittedAt ? calcDays(admission.admittedAt, admission.dischargedAt) : 0;
    const roomChargesTotal = (admission.roomChargesPerNight || 0) * totalDays;
    const roomType = admission.roomTypeId ? getRoomTypeById(admission.roomTypeId) : null;
    const st = getHospitalSettings();

    const slipHtml = `
      <html><head><title>Admission File - ${admission.patientNo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; }
        .file { border: 3px double #1e293b; border-radius: 8px; padding: 24px; max-width: 550px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { color: #1e293b; font-size: 22px; }
        .header p { color: #64748b; font-size: 11px; margin-top: 2px; }
        .file-title { text-align: center; font-size: 16px; font-weight: 700; color: #dc2626; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 2px; }
        .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
        .section h3 { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #cbd5e1; }
        .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .row .label { color: #64748b; }
        .row .value { color: #1e293b; font-weight: 600; }
        .total-row { background: #ecfdf5; padding: 8px 12px; border-radius: 6px; margin-top: 8px; }
        .total-row .row { font-size: 14px; }
        .footer { text-align: center; margin-top: 16px; padding-top: 12px; border-top: 2px solid #1e293b; }
        .footer p { font-size: 10px; color: #94a3b8; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>
        <div class="file">
          <div class="header">
            <h1>${hospital.name}</h1>
            <p>${hospital.address} | ${hospital.phone}</p>
          </div>
          <div class="file-title">Admission File</div>

          <div class="section">
            <h3>Patient Information</h3>
            <div class="row"><span class="label">Patient No:</span><span class="value">${admission.patientNo}</span></div>
            <div class="row"><span class="label">Patient Name:</span><span class="value">${admission.patientName}</span></div>
          </div>

          <div class="section">
            <h3>Admission Details</h3>
            <div class="row"><span class="label">Department:</span><span class="value">${admission.department}</span></div>
            <div class="row"><span class="label">Doctor:</span><span class="value">${admission.doctor}</span></div>
            <div class="row"><span class="label">Admission Date:</span><span class="value">${admission.admissionDate}</span></div>
            ${admission.admittedAt ? `<div class="row"><span class="label">Admitted On:</span><span class="value">${admission.admittedAt}</span></div>` : ''}
            ${admission.dischargedAt ? `<div class="row"><span class="label">Discharged On:</span><span class="value">${admission.dischargedAt}</span></div>` : ''}
            <div class="row"><span class="label">Purpose:</span><span class="value">${admission.purpose}</span></div>
            <div class="row"><span class="label">Room No:</span><span class="value">${admission.roomNo || 'Pending'}</span></div>
            ${roomType ? `<div class="row"><span class="label">Room Type:</span><span class="value">${roomType.name}</span></div>` : ''}
            <div class="row"><span class="label">Status:</span><span class="value">${admission.status}</span></div>
          </div>

          ${admission.admittedAt ? `
          <div class="section">
            <h3>Stay & Charges Summary</h3>
            <div class="row"><span class="label">Total Days:</span><span class="value">${totalDays} Night(s)</span></div>
            <div class="row"><span class="label">Room Charges/Night:</span><span class="value">${st.currency} ${(admission.roomChargesPerNight || 0).toLocaleString()}</span></div>
            <div class="total-row">
              <div class="row"><span class="label">Total Room Charges:</span><span class="value">${st.currency} ${roomChargesTotal.toLocaleString()}</span></div>
            </div>
          </div>` : ''}

          <div class="section">
            <h3>Approval</h3>
            <div class="row"><span class="label">Approved By:</span><span class="value">${admission.approvedBy || admission.doctor}</span></div>
            <div class="row"><span class="label">Created:</span><span class="value">${admission.createdAt}</span></div>
          </div>

          ${admission.notes ? `
          <div class="section">
            <h3>Doctor Notes</h3>
            <p style="font-size:12px;color:#475569;">${admission.notes}</p>
          </div>` : ''}

          <div class="footer">
            <p>${hospital.name} - Admission File</p>
            <p>Printed: ${todayStr()} ${timeStr()}</p>
          </div>
        </div>
        <script>window.onload=function(){window.print();}</script>
      </body></html>
    `;
    setPrintContent(slipHtml);
  };

  /* ========= STATUS BADGE ========= */
  const statusBadge = (status: string) => {
    if (status === 'Approved') return <span className="badge badge-amber">{status}</span>;
    if (status === 'Admitted') return <span className="badge badge-green">{status}</span>;
    if (status === 'Discharged') return <span className="badge badge-blue">{status}</span>;
    return <span className="badge">{status}</span>;
  };

  const purposeBadge = (purpose: string) => {
    switch (purpose) {
      case 'Surgery': case 'Emergency': case 'ICU':
        return <span className="badge badge-rose">{purpose}</span>;
      case 'Delivery':
        return <span className="badge" style={{ background: '#faf5ff', color: '#9333ea', border: '1px solid #e9d5ff' }}>{purpose}</span>;
      case 'Checkup':
        return <span className="badge badge-blue">{purpose}</span>;
      case 'Observation':
        return <span className="badge badge-amber">{purpose}</span>;
      default:
        return <span className="badge badge-green">{purpose}</span>;
    }
  };

  const currency = settings.currency;

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.msg}
        </div>
      )}

      {/* Print Slip Modal */}
      {printContent && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Admission File</h3>
              <button onClick={() => setPrintContent(null)} className="btn btn-outline btn-sm">Close</button>
            </div>
            <iframe srcDoc={printContent} style={{ width: '100%', height: '650px', border: 'none' }} title="Admission Slip" />
          </div>
        </div>
      )}

      {/* ==================== PROCESS ADMISSION MODAL ==================== */}
      {processAdmission && (
        <div className="modal-overlay" onClick={() => setProcessAdmission(null)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Process Admission</h3>
            <p className="text-sm text-slate-500 mb-4">Collect payment and admit the patient to a room.</p>

            {/* Patient Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-blue-500">Patient:</span> <span className="font-bold text-blue-800">{processAdmission.patientName}</span></div>
                <div><span className="text-blue-500">No:</span> <span className="font-mono font-bold text-blue-800">{processAdmission.patientNo}</span></div>
                <div><span className="text-blue-500">Doctor:</span> <span className="font-bold text-blue-800">{processAdmission.doctor}</span></div>
                <div><span className="text-blue-500">Dept:</span> <span className="font-bold text-blue-800">{processAdmission.department}</span></div>
                <div><span className="text-blue-500">Date:</span> <span className="font-bold text-blue-800">{processAdmission.admissionDate}</span></div>
                <div><span className="text-blue-500">Purpose:</span> {purposeBadge(processAdmission.purpose)}</div>
              </div>
            </div>

            {/* Room Type Selection */}
            <div className="mb-4">
              <label className="form-label">Room Type *</label>
              <select
                className="form-input"
                value={selectedRoomTypeId}
                onChange={e => setSelectedRoomTypeId(e.target.value)}
              >
                <option value="">-- Select Room Type --</option>
                {activeRoomTypes.map(rt => (
                  <option key={rt.id} value={rt.id}>{rt.name} ({currency} {rt.chargesPerNight.toLocaleString()}/night)</option>
                ))}
              </select>
            </div>

            {/* Room Number */}
            <div className="mb-4">
              <label className="form-label">Room Number *</label>
              <input
                className="form-input"
                placeholder="e.g. 101, ICU-2, Ward-3"
                value={roomInput}
                onChange={e => setRoomInput(e.target.value)}
                autoFocus
              />
            </div>

            {/* Cost Breakdown */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-sm text-emerald-800 mb-2">Cost Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-emerald-600">Admission Fee:</span>
                  <span className="font-bold text-emerald-800">{currency} {settings.admissionFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-600">Room Charges (1st Night):</span>
                  <span className="font-bold text-emerald-800">{currency} {getRoomCharges().toLocaleString()}</span>
                </div>
                {selectedDoctorFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-emerald-600">Doctor Fee:</span>
                    <span className="font-bold text-emerald-800">{currency} {selectedDoctorFee.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-emerald-300 pt-2 text-base">
                  <span className="font-bold text-emerald-800">Total:</span>
                  <span className="font-bold text-emerald-900">
                    {currency} {(getTotal() + selectedDoctorFee).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setProcessAdmission(null)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={handleCollectAndAdmit} className="btn btn-success btn-lg flex-1">Collect Payment & Admit</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DISCHARGE MODAL ==================== */}
      {dischargeAdmission && (
        <div className="modal-overlay" onClick={() => setDischargeAdmission(null)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Discharge Patient</h3>
            <p className="text-sm text-slate-500 mb-4">Review charges and confirm discharge.</p>

            {/* Patient Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-blue-500">Patient:</span> <span className="font-bold text-blue-800">{dischargeAdmission.patientName}</span></div>
                <div><span className="text-blue-500">Room:</span> <span className="font-mono font-bold text-blue-800">{dischargeAdmission.roomNo}</span></div>
                <div><span className="text-blue-500">Doctor:</span> <span className="font-bold text-blue-800">{dischargeAdmission.doctor}</span></div>
                <div><span className="text-blue-500">Admitted:</span> <span className="font-bold text-blue-800">{dischargeAdmission.admittedAt || dischargeAdmission.admissionDate}</span></div>
              </div>
            </div>

            {/* Stay Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-sm text-slate-800 mb-2">Stay Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Days Stayed:</span>
                  <span className="font-bold text-slate-800">{calcDays(dischargeAdmission.admittedAt || dischargeAdmission.admissionDate)} Night(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Room Charges/Night:</span>
                  <span className="font-bold text-slate-800">{currency} {(dischargeAdmission.roomChargesPerNight || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Room Charges:</span>
                  <span className="font-bold text-emerald-700">{currency} {((dischargeAdmission.roomChargesPerNight || 0) * calcDays(dischargeAdmission.admittedAt || dischargeAdmission.admissionDate)).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Pending Bills Check */}
            {pendingBills.length > 0 ? (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
                <h4 className="font-bold text-red-800 flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  Clear Pending Payments First
                </h4>
                <p className="text-sm text-red-700 mb-2">This patient has {pendingBills.length} unpaid bill(s). Please clear all payments before discharge.</p>
                <div className="space-y-2">
                  {pendingBills.map(bill => (
                    <div key={bill.id} className="flex justify-between items-center bg-white border border-red-200 rounded px-3 py-2 text-sm">
                      <div>
                        <span className="font-mono text-red-600">Bill #{bill.id.slice(-5)}</span>
                        <span className="text-slate-400 ml-2">{bill.date}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-red-800">{currency} {bill.totalAmount.toLocaleString()}</span>
                        <span className={`badge ml-2 ${bill.status === 'Unpaid' ? 'badge-rose' : 'badge-amber'}`}>{bill.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 className="font-bold text-green-800 flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  All Clear - Ready for Discharge
                </h4>
                <p className="text-sm text-green-700">No pending bills. This patient can be safely discharged.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setDischargeAdmission(null)} className="btn btn-outline flex-1">Cancel</button>
              {canDischarge ? (
                <button onClick={handleConfirmDischarge} className="btn btn-danger btn-lg flex-1">Confirm Discharge</button>
              ) : (
                <button className="btn flex-1 opacity-50 cursor-not-allowed bg-slate-300 text-white" disabled>Block - Clear Bills First</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== VIEW ADMISSION FILE MODAL ==================== */}
      {viewAdmission && (
        <div className="modal-overlay" onClick={() => setViewAdmission(null)}>
          <div className="modal-content" style={{ maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Admission File - {viewAdmission.patientNo}</h3>
              <button onClick={() => setViewAdmission(null)} className="btn btn-outline btn-sm">Close</button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-slate-600 mb-2">Patient Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-slate-400">No:</span> <span className="font-mono font-bold">{viewAdmission.patientNo}</span></div>
                  <div><span className="text-slate-400">Name:</span> <span className="font-bold">{viewAdmission.patientName}</span></div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-slate-600 mb-2">Admission Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Department:</span><span className="font-semibold">{viewAdmission.department}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Doctor:</span><span className="font-semibold">{viewAdmission.doctor}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Admission Date:</span><span className="font-semibold">{viewAdmission.admissionDate}</span></div>
                  {viewAdmission.admittedAt && (
                    <div className="flex justify-between"><span className="text-slate-400">Admitted On:</span><span className="font-semibold">{viewAdmission.admittedAt}</span></div>
                  )}
                  {viewAdmission.dischargedAt && (
                    <div className="flex justify-between"><span className="text-slate-400">Discharged On:</span><span className="font-semibold">{viewAdmission.dischargedAt}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-slate-400">Purpose:</span>{purposeBadge(viewAdmission.purpose)}</div>
                  <div className="flex justify-between"><span className="text-slate-400">Room:</span><span className="font-semibold">{viewAdmission.roomNo || 'Pending'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Status:</span>{statusBadge(viewAdmission.status)}</div>
                  {viewAdmission.admittedAt && (
                    <>
                      <div className="flex justify-between border-t border-slate-200 pt-2 mt-2"><span className="text-slate-400">Total Days:</span><span className="font-semibold">{calcDays(viewAdmission.admittedAt, viewAdmission.dischargedAt)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Room Charges/Night:</span><span className="font-semibold">{currency} {(viewAdmission.roomChargesPerNight || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Total Room Charges:</span><span className="font-bold text-emerald-700">{currency} {((viewAdmission.roomChargesPerNight || 0) * calcDays(viewAdmission.admittedAt, viewAdmission.dischargedAt)).toLocaleString()}</span></div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-amber-700 mb-2">Doctor Approval</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-amber-500">Approved By:</span><span className="font-semibold text-amber-800">{viewAdmission.approvedBy || viewAdmission.doctor}</span></div>
                  <div className="flex justify-between"><span className="text-amber-500">Created:</span><span className="font-semibold text-amber-800">{viewAdmission.createdAt}</span></div>
                </div>
              </div>

              {viewAdmission.notes && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-purple-700 mb-2">Doctor Notes</h4>
                  <p className="text-sm text-purple-800">{viewAdmission.notes}</p>
                </div>
              )}

              <div className="flex gap-3">
                {viewAdmission.status === 'Approved' && (
                  <button onClick={() => { setViewAdmission(null); openProcessModal(viewAdmission); }} className="btn btn-success flex-1">Process Admission</button>
                )}
                <button onClick={() => handlePrintSlip(viewAdmission)} className="btn btn-primary flex-1">Print File</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== HEADER ==================== */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Admission Management</h2>
          <p className="text-sm text-slate-500">Manage patient admissions, room assignment, and discharges</p>
        </div>
      </div>

      {/* ==================== STATS CARDS ==================== */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`stat-card card-hover border ${tab === 'approved' ? 'border-amber-400 bg-amber-50' : 'bg-amber-50 border-amber-200'} cursor-pointer`} onClick={() => setTab('approved')}>
          <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Doctor Approved</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{approvedAdmissions.length}</p>
          <p className="text-xs text-amber-500 mt-1">Pending admission</p>
        </div>
        <div className={`stat-card card-hover border ${tab === 'admitted' ? 'border-green-400 bg-green-50' : 'bg-green-50 border-green-200'} cursor-pointer`} onClick={() => setTab('admitted')}>
          <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Currently Admitted</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{activeAdmissions.length}</p>
          <p className="text-xs text-green-500 mt-1">Active inpatients</p>
        </div>
        <div className={`stat-card card-hover border ${tab === 'discharged' ? 'border-blue-400 bg-blue-50' : 'bg-blue-50 border-blue-200'} cursor-pointer`} onClick={() => setTab('discharged')}>
          <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Discharged</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{dischargedAdmissions.length}</p>
          <p className="text-xs text-blue-500 mt-1">Past discharges</p>
        </div>
      </div>

      {/* ==================== APPROVED TAB ==================== */}
      {tab === 'approved' && (
        <div className="bg-white rounded-xl border-2 border-amber-200 overflow-hidden">
          <div className="bg-amber-50 px-5 py-3 border-b border-amber-200">
            <h3 className="font-bold text-amber-800">Doctor Approved Admissions ({approvedAdmissions.length})</h3>
            <p className="text-xs text-amber-600">Review doctor-approved admissions and process with room assignment</p>
          </div>
          {approvedAdmissions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="font-semibold">No Pending Approvals</p>
              <p className="text-sm mt-1">When a doctor approves an admission, it will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Patient No</th>
                    <th>Patient Name</th>
                    <th>Department</th>
                    <th>Doctor</th>
                    <th>Purpose</th>
                    <th>Admission Date</th>
                    <th>Doctor Fee</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedAdmissions.map((a, i) => (
                    <tr key={a.id} className="bg-amber-50/50">
                      <td className="font-semibold">{i + 1}</td>
                      <td><span className="font-mono font-bold text-blue-600">{a.patientNo}</span></td>
                      <td className="font-semibold">{a.patientName}</td>
                      <td>{a.department}</td>
                      <td className="text-sm">{a.doctor}</td>
                      <td>{purposeBadge(a.purpose)}</td>
                      <td>{a.admissionDate}</td>
                      <td><span className="font-mono font-bold">{currency} {getDoctorFee(a).toLocaleString()}</span></td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => openProcessModal(a)} className="btn btn-success btn-sm whitespace-nowrap">Process Admission</button>
                          <button onClick={() => setViewAdmission(a)} className="btn btn-outline btn-sm">View</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== ADMITTED TAB ==================== */}
      {tab === 'admitted' && (
        <div className="bg-white rounded-xl border border-green-200 overflow-hidden">
          <div className="bg-green-50 px-5 py-3 border-b border-green-200">
            <h3 className="font-bold text-green-800">Currently Admitted ({activeAdmissions.length})</h3>
          </div>
          {activeAdmissions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <p className="font-semibold">No Admitted Patients</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Room</th>
                    <th>Patient No</th>
                    <th>Patient Name</th>
                    <th>Department</th>
                    <th>Doctor</th>
                    <th>Purpose</th>
                    <th>Admitted On</th>
                    <th>Total Days</th>
                    <th>Room Charges</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAdmissions.map((a, i) => {
                    const days = calcDays(a.admittedAt || a.admissionDate);
                    const rcTotal = (a.roomChargesPerNight || 0) * days;
                    return (
                      <tr key={a.id}>
                        <td className="font-semibold">{i + 1}</td>
                        <td><span className="badge badge-green font-mono">{a.roomNo || '-'}</span></td>
                        <td><span className="font-mono font-bold text-blue-600">{a.patientNo}</span></td>
                        <td className="font-semibold">{a.patientName}</td>
                        <td>{a.department}</td>
                        <td className="text-sm">{a.doctor}</td>
                        <td>{purposeBadge(a.purpose)}</td>
                        <td>{a.admittedAt || a.admissionDate}</td>
                        <td><span className="font-bold text-amber-700">{days}</span></td>
                        <td><span className="font-mono font-bold text-emerald-700">{currency} {rcTotal.toLocaleString()}</span></td>
                        <td>
                          <div className="flex gap-2">
                            <button onClick={() => openDischargeModal(a)} className="btn btn-danger btn-sm whitespace-nowrap">Discharge</button>
                            <button onClick={() => setViewAdmission(a)} className="btn btn-outline btn-sm">File</button>
                            <button onClick={() => handlePrintSlip(a)} className="btn btn-outline btn-sm">Print</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== DISCHARGED TAB ==================== */}
      {tab === 'discharged' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
            <h3 className="font-bold text-slate-700">Discharged Patients ({dischargedAdmissions.length})</h3>
          </div>
          {dischargedAdmissions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              <p className="font-semibold">No Discharge History</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Patient No</th>
                    <th>Patient Name</th>
                    <th>Room</th>
                    <th>Department</th>
                    <th>Doctor</th>
                    <th>Purpose</th>
                    <th>Admitted On</th>
                    <th>Discharged On</th>
                    <th>Total Days</th>
                    <th>Room Charges</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dischargedAdmissions].reverse().map((a, i) => {
                    const days = calcDays(a.admittedAt || a.admissionDate, a.dischargedAt);
                    const rcTotal = (a.roomChargesPerNight || 0) * days;
                    return (
                      <tr key={a.id}>
                        <td className="font-semibold">{i + 1}</td>
                        <td><span className="font-mono font-bold text-blue-600">{a.patientNo}</span></td>
                        <td className="font-semibold">{a.patientName}</td>
                        <td><span className="badge badge-blue font-mono">{a.roomNo || '-'}</span></td>
                        <td>{a.department}</td>
                        <td className="text-sm">{a.doctor}</td>
                        <td>{purposeBadge(a.purpose)}</td>
                        <td>{a.admittedAt || a.admissionDate}</td>
                        <td>{a.dischargedAt || '-'}</td>
                        <td><span className="font-bold text-slate-700">{days}</span></td>
                        <td><span className="font-mono font-bold text-emerald-700">{currency} {rcTotal.toLocaleString()}</span></td>
                        <td>
                          <div className="flex gap-2">
                            <button onClick={() => setViewAdmission(a)} className="btn btn-outline btn-sm">View</button>
                            <button onClick={() => handlePrintSlip(a)} className="btn btn-outline btn-sm">Print</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
