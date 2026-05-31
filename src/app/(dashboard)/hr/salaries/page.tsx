'use client';
import { useState, useEffect, useCallback } from 'react';
import { getEmployees, getSalaryRecords, setSalaryRecords, updateSalaryRecord, genId, getAttendanceRecords } from '@/lib/store';
import type { SalaryRecord } from '@/lib/types';

function getSalaryByMonth(month: string): SalaryRecord[] {
  return getSalaryRecords().filter(s => s.month === month);
}

export default function SalariesPage() {
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editRecord, setEditRecord] = useState<SalaryRecord | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [forwardModal, setForwardModal] = useState<{ record: SalaryRecord } | null>(null);

  const loadData = useCallback(() => {
    const records = getSalaryByMonth(selectedMonth);
    setSalaries(records);
  }, [selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Calculate working days in a month (excluding Sundays)
  const getWorkingDays = (month: string): number => {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(y, m - 1, d).getDay();
      if (day !== 0) workingDays++; // Exclude Sundays
    }
    return workingDays;
  };

  // Get attendance summary for an employee in a month
  const getAttendanceSummary = (employeeId: string, month: string) => {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const allAttendance = getAttendanceRecords().filter(a => {
      if (a.employeeId !== employeeId) return false;
      const [ay, am] = a.date.split('-').map(Number);
      return ay === y && am === m;
    });
    return {
      present: allAttendance.filter(a => a.status === 'Present').length,
      absent: allAttendance.filter(a => a.status === 'Absent').length,
      halfDays: allAttendance.filter(a => a.status === 'Half Day').length,
      leave: allAttendance.filter(a => a.status === 'Leave').length,
      holiday: allAttendance.filter(a => a.status === 'Holiday').length,
    };
  };

  const generateSalaries = () => {
    const existing = getSalaryByMonth(selectedMonth);
    if (existing.length > 0) {
      if (!confirm(`Salary records already exist for ${selectedMonth}. Do you want to regenerate? This will replace existing records.`)) return;
    }
    const activeEmployees = getEmployees().filter(e => e.status === 'Active');
    if (activeEmployees.length === 0) { showToast('No active employees found', 'error'); return; }

    const totalWorkingDays = getWorkingDays(selectedMonth);
    const newRecords: SalaryRecord[] = activeEmployees.map(emp => {
      const att = getAttendanceSummary(emp.id, selectedMonth);
      const perDaySalary = emp.salary / totalWorkingDays;
      const absentDeduction = Math.round(att.absent * perDaySalary);
      const halfDayDeduction = Math.round(att.halfDays * (perDaySalary / 2));
      const totalDeductions = absentDeduction + halfDayDeduction;
      const netSalary = emp.salary + 0 + 0 - totalDeductions; // basic + allowances(0) + overtime(0) - deductions

      return {
        id: genId(),
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: emp.name,
        department: emp.department,
        designation: emp.designation,
        month: selectedMonth,
        basicSalary: emp.salary,
        allowances: 0,
        deductions: totalDeductions,
        absentDeduction,
        halfDayDeduction,
        overtime: 0,
        bonus: 0,
        netSalary: Math.max(0, netSalary),
        presentDays: att.present,
        absentDays: att.absent,
        halfDays: att.halfDays,
        totalWorkingDays,
        status: 'Pending' as const,
        approvedBy: '',
        approvedDate: '',
        paidDate: '',
        forwardedToAccountant: false,
        accountantPaidDate: '',
        notes: att.absent > 0 || att.halfDays > 0 ? `Auto-deduction: ${att.absent} absent, ${att.halfDays} half days` : '',
      };
    });

    // Replace existing records for this month
    const allRecords = getSalaryRecords().filter(s => s.month !== selectedMonth);
    setSalaryRecords([...allRecords, ...newRecords]);
    showToast(`Generated salary for ${newRecords.length} employees (Working days: ${totalWorkingDays})`, 'success');
    loadData();
  };

  const handleEdit = (record: SalaryRecord) => {
    setEditRecord({ ...record });
  };

  const handleSaveEdit = () => {
    if (!editRecord) return;
    const net = editRecord.basicSalary + editRecord.allowances + editRecord.overtime + editRecord.bonus - editRecord.deductions;
    updateSalaryRecord(editRecord.id, { ...editRecord, netSalary: Math.max(0, net) });
    setEditRecord(null);
    showToast('Salary record updated', 'success');
    loadData();
  };

  const handleApprove = (record: SalaryRecord) => {
    if (confirm(`Approve salary for ${record.employeeName}?`)) {
      updateSalaryRecord(record.id, {
        status: 'Approved',
        approvedBy: 'HR Admin',
        approvedDate: new Date().toISOString().split('T')[0],
      });
      showToast(`${record.employeeName} salary approved`, 'success');
      loadData();
    }
  };

  const handleForwardToAccountant = (record: SalaryRecord) => {
    updateSalaryRecord(record.id, { forwardedToAccountant: true });
    showToast(`${record.employeeName} salary forwarded to Accountant`, 'success');
    loadData();
  };

  const handleMarkPaid = (record: SalaryRecord) => {
    updateSalaryRecord(record.id, {
      status: 'Paid',
      paidDate: new Date().toISOString().split('T')[0],
      forwardedToAccountant: true,
      accountantPaidDate: new Date().toISOString().split('T')[0],
    });
    showToast(`${record.employeeName} marked as Paid by Accountant`, 'success');
    loadData();
  };

  const handleMarkPartial = (record: SalaryRecord) => {
    updateSalaryRecord(record.id, {
      status: 'Partial',
      paidDate: new Date().toISOString().split('T')[0],
      forwardedToAccountant: true,
      accountantPaidDate: new Date().toISOString().split('T')[0],
    });
    showToast(`${record.employeeName} marked as Partial`, 'success');
    loadData();

  };

  const handleMarkPending = (record: SalaryRecord) => {
    updateSalaryRecord(record.id, { status: 'Pending', approvedBy: '', approvedDate: '', paidDate: '' });
    showToast(`${record.employeeName} reset to Pending`, 'success');
    loadData();
  };

  const handleForwardAllToAccountant = () => {
    const approvedSalaries = salaries.filter(s => s.status === 'Approved' && !s.forwardedToAccountant);
    if (approvedSalaries.length === 0) {
      showToast('No approved salaries to forward. Approve salaries first.', 'error');
      return;
    }
    if (confirm(`Forward ${approvedSalaries.length} approved salaries to Accountant?`)) {
      approvedSalaries.forEach(s => {
        updateSalaryRecord(s.id, { forwardedToAccountant: true });
      });
      showToast(`${approvedSalaries.length} salaries forwarded to Accountant`, 'success');
      loadData();
    }
  };

  const totalPaid = salaries.filter(s => s.status === 'Paid').reduce((t, s) => t + s.netSalary, 0);
  const totalPending = salaries.filter(s => s.status === 'Pending').reduce((t, s) => t + s.netSalary, 0);
  const totalApproved = salaries.filter(s => s.status === 'Approved').reduce((t, s) => t + s.netSalary, 0);
  const totalAmount = salaries.reduce((t, s) => t + s.netSalary, 0);
  const paidCount = salaries.filter(s => s.status === 'Paid').length;
  const pendingCount = salaries.filter(s => s.status === 'Pending').length;
  const approvedCount = salaries.filter(s => s.status === 'Approved').length;
  const forwardedCount = salaries.filter(s => s.forwardedToAccountant).length;
  const totalWorkingDays = getWorkingDays(selectedMonth);

  // Generate month options
  const monthOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[parseInt(mo) - 1]} ${y}`;
  };

  return (
    <div className="space-y-6">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Salary Management</h2>
          <p className="text-sm text-slate-500">Monthly payroll for {formatMonth(selectedMonth)} | Working Days: {totalWorkingDays}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleForwardAllToAccountant} className="btn btn-outline" style={{color:'#0d9488',borderColor:'#0d9488'}}>
            Forward All to Accountant
          </button>
          <button onClick={generateSalaries} className="btn btn-primary">Generate Salary</button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="form-label">Select Month</label>
          <select className="form-input w-52" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            {monthOptions.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Pending</p>
          <p className="text-lg font-bold text-amber-700">Rs. {totalPending.toLocaleString()}</p>
          <p className="text-xs text-amber-500">{pendingCount} employees</p>
        </div>
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Approved</p>
          <p className="text-lg font-bold text-blue-700">Rs. {totalApproved.toLocaleString()}</p>
          <p className="text-xs text-blue-500">{approvedCount} employees</p>
        </div>
        <div className="stat-card card-hover border border-teal-200 bg-teal-50">
          <p className="text-xs text-teal-600 font-medium">Forwarded to Accountant</p>
          <p className="text-lg font-bold text-teal-700">{forwardedCount}</p>
          <p className="text-xs text-teal-500">of {salaries.length} total</p>
        </div>
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Paid</p>
          <p className="text-lg font-bold text-emerald-700">Rs. {totalPaid.toLocaleString()}</p>
          <p className="text-xs text-emerald-500">{paidCount} employees</p>
        </div>
        <div className="stat-card card-hover border border-purple-200 bg-purple-50">
          <p className="text-xs text-purple-600 font-medium">Total Payroll</p>
          <p className="text-lg font-bold text-purple-700">Rs. {totalAmount.toLocaleString()}</p>
          <p className="text-xs text-purple-500">{salaries.length} employees</p>
        </div>
      </div>

      {/* Workflow Steps Indicator */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-2">SALARY WORKFLOW</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span className="text-xs font-medium text-amber-700">Generate (HR)</span>
          </div>
          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span className="text-xs font-medium text-blue-700">Edit & Approve (HR)</span>
          </div>
          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <div className="flex items-center gap-1 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
            <span className="w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span className="text-xs font-medium text-teal-700">Forward to Accountant</span>
          </div>
          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <span className="text-xs font-medium text-emerald-700">Payment (Accountant)</span>
          </div>
        </div>
      </div>

      {/* Salary Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="data-table">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th>#</th><th>Employee</th><th>Code</th><th>Dept</th><th>Days</th><th>Basic</th><th>Absent Ded.</th><th>HD Ded.</th><th>Allow.</th><th>OT</th><th>Bonus</th><th>Net</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {salaries.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center text-slate-400 py-8">
                    No salary records for {formatMonth(selectedMonth)}. Click &quot;Generate Salary&quot; to create.
                  </td>
                </tr>
              )}
              {salaries.map((s, i) => (
                <tr key={s.id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td className="font-medium">{s.employeeName}</td>
                  <td><span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{s.employeeCode}</span></td>
                  <td><span className="badge badge-blue text-xs">{s.department}</span></td>
                  <td className="text-center">
                    <span className="text-xs">
                      <span className="text-emerald-600 font-bold">{s.presentDays}P</span>
                      {s.absentDays > 0 && <span className="text-red-500 font-bold"> {s.absentDays}A</span>}
                      {s.halfDays > 0 && <span className="text-amber-500 font-bold"> {s.halfDays}H</span>}
                      <span className="text-slate-400">/{s.totalWorkingDays}</span>
                    </span>
                  </td>
                  <td>Rs. {s.basicSalary.toLocaleString()}</td>
                  <td className="text-red-600">{s.absentDeduction > 0 ? `-Rs. ${s.absentDeduction.toLocaleString()}` : '-'}</td>
                  <td className="text-red-500">{s.halfDayDeduction > 0 ? `-Rs. ${s.halfDayDeduction.toLocaleString()}` : '-'}</td>
                  <td className="text-emerald-600">{s.allowances > 0 ? `Rs. ${s.allowances.toLocaleString()}` : '-'}</td>
                  <td className="text-blue-600">{s.overtime > 0 ? `Rs. ${s.overtime.toLocaleString()}` : '-'}</td>
                  <td className="text-purple-600">{s.bonus > 0 ? `Rs. ${s.bonus.toLocaleString()}` : '-'}</td>
                  <td className="font-bold">Rs. {s.netSalary.toLocaleString()}</td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className={`badge ${s.status === 'Paid' ? 'badge-green' : s.status === 'Approved' ? 'badge-blue' : s.status === 'Partial' ? 'badge-amber' : 'badge-red'}`}>
                        {s.status}
                      </span>
                      {s.forwardedToAccountant && s.status !== 'Paid' && s.status !== 'Partial' && (
                        <span className="badge badge-teal text-[9px]">To Accountant</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap" style={{minWidth: '200px'}}>
                      <button onClick={() => handleEdit(s)} className="btn btn-outline btn-sm">Edit</button>
                      {s.status === 'Pending' && (
                        <button onClick={() => handleApprove(s)} className="btn btn-sm" style={{background:'#3b82f6',color:'white',border:'none',cursor:'pointer',padding:'4px 8px',borderRadius:'6px',fontSize:'12px'}}>Approve</button>
                      )}
                      {(s.status === 'Approved' || s.status === 'Pending') && !s.forwardedToAccountant && (
                        <button onClick={() => handleForwardToAccountant(s)} className="btn btn-sm" style={{background:'#0d9488',color:'white',border:'none',cursor:'pointer',padding:'4px 8px',borderRadius:'6px',fontSize:'11px'}}>Forward</button>
                      )}
                      {s.forwardedToAccountant && s.status !== 'Paid' && s.status !== 'Partial' && (
                        <button onClick={() => handleMarkPaid(s)} className="btn btn-success btn-sm">Pay</button>
                      )}
                      {s.forwardedToAccountant && s.status !== 'Paid' && s.status !== 'Partial' && (
                        <button onClick={() => handleMarkPartial(s)} className="btn btn-sm" style={{background:'#d97706',color:'white',border:'none',cursor:'pointer',padding:'4px 8px',borderRadius:'6px',fontSize:'12px'}}>Partial</button>
                      )}
                      {s.status !== 'Pending' && (
                        <button onClick={() => handleMarkPending(s)} className="btn btn-outline btn-sm text-xs">Reset</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {salaries.length > 0 && (
              <tfoot className="sticky bottom-0 bg-white font-bold">
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={4} className="text-right">TOTAL</td>
                  <td></td>
                  <td>Rs. {salaries.reduce((t, s) => t + s.basicSalary, 0).toLocaleString()}</td>
                  <td className="text-red-600">-Rs. {salaries.reduce((t, s) => t + s.absentDeduction, 0).toLocaleString()}</td>
                  <td className="text-red-500">-Rs. {salaries.reduce((t, s) => t + s.halfDayDeduction, 0).toLocaleString()}</td>
                  <td className="text-emerald-600">Rs. {salaries.reduce((t, s) => t + s.allowances, 0).toLocaleString()}</td>
                  <td className="text-blue-600">Rs. {salaries.reduce((t, s) => t + s.overtime, 0).toLocaleString()}</td>
                  <td className="text-purple-600">Rs. {salaries.reduce((t, s) => t + s.bonus, 0).toLocaleString()}</td>
                  <td>Rs. {totalAmount.toLocaleString()}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editRecord && (
        <div className="modal-overlay" onClick={() => setEditRecord(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Edit Salary - {editRecord.employeeName}</h3>
              <button onClick={() => setEditRecord(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-slate-500">
                <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{editRecord.employeeCode}</span> | {editRecord.department} | {editRecord.designation}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Attendance: <span className="text-emerald-600 font-semibold">{editRecord.presentDays} Present</span>
                {editRecord.absentDays > 0 && <span className="text-red-500 font-semibold"> | {editRecord.absentDays} Absent (Deduction: Rs. {editRecord.absentDeduction.toLocaleString()})</span>}
                {editRecord.halfDays > 0 && <span className="text-amber-500 font-semibold"> | {editRecord.halfDays} Half Days (Deduction: Rs. {editRecord.halfDayDeduction.toLocaleString()})</span>}
                <span className="text-slate-400"> | Total Working Days: {editRecord.totalWorkingDays}</span>
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="form-label">Allowances (Rs.)</label>
                <input type="number" className="form-input" value={editRecord.allowances || ''} onChange={e => setEditRecord({ ...editRecord, allowances: Number(e.target.value) })} />
              </div>
              <div>
                <label className="form-label">Additional Deductions (Rs.) - Other deductions</label>
                <input type="number" className="form-input" value={(editRecord.deductions - editRecord.absentDeduction - editRecord.halfDayDeduction) || ''} onChange={e => {
                  const otherDed = Number(e.target.value);
                  setEditRecord({ ...editRecord, deductions: editRecord.absentDeduction + editRecord.halfDayDeduction + otherDed });
                }} />
                <p className="text-xs text-slate-400 mt-1">Absent deduction: Rs. {editRecord.absentDeduction} | Half day deduction: Rs. {editRecord.halfDayDeduction}</p>
              </div>
              <div>
                <label className="form-label">Overtime (Rs.)</label>
                <input type="number" className="form-input" value={editRecord.overtime || ''} onChange={e => setEditRecord({ ...editRecord, overtime: Number(e.target.value) })} />
              </div>
              <div>
                <label className="form-label">Bonus (Rs.)</label>
                <input type="number" className="form-input" value={editRecord.bonus || ''} onChange={e => setEditRecord({ ...editRecord, bonus: Number(e.target.value) })} />
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span>Basic Salary:</span><span className="font-medium">Rs. {editRecord.basicSalary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>+ Allowances:</span><span className="text-emerald-600">Rs. {editRecord.allowances.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>+ Overtime:</span><span className="text-blue-600">Rs. {editRecord.overtime.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>+ Bonus:</span><span className="text-purple-600">Rs. {editRecord.bonus.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>- Absent Deduction:</span><span className="text-red-600">Rs. {editRecord.absentDeduction.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>- Half Day Deduction:</span><span className="text-red-500">Rs. {editRecord.halfDayDeduction.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-1 mt-1">
                  <span>Net Salary:</span><span className="text-blue-700">Rs. {(editRecord.basicSalary + editRecord.allowances + editRecord.overtime + editRecord.bonus - editRecord.deductions).toLocaleString()}</span>
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <input className="form-input" value={editRecord.notes} onChange={e => setEditRecord({ ...editRecord, notes: e.target.value })} placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditRecord(null)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={handleSaveEdit} className="btn btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
