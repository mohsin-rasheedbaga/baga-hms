'use client';
import { useState, useEffect, useCallback } from 'react';
import { getEmployees, getAttendanceRecords, setAttendanceRecords, addAttendanceRecord, updateAttendanceRecord, genId, todayStr } from '@/lib/store';
import type { AttendanceRecord } from '@/lib/types';

type AttStatus = AttendanceRecord['status'];

interface BiometricConfig {
  enabled: boolean;
  deviceName: string;
  deviceId: string;
  connectionType: 'USB' | 'Network' | 'WiFi' | 'Cloud API';
  ipAddress: string;
  port: string;
  apiKey: string;
  autoSync: boolean;
  syncInterval: number; // minutes
  lastSync: string;
}

const defaultBiometric: BiometricConfig = {
  enabled: false,
  deviceName: '',
  deviceId: '',
  connectionType: 'USB',
  ipAddress: '',
  port: '',
  apiKey: '',
  autoSync: false,
  syncInterval: 30,
  lastSync: '',
};

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [showBiometricSettings, setShowBiometricSettings] = useState(false);
  const [biometricConfig, setBiometricConfig] = useState<BiometricConfig>(defaultBiometric);
  const [showBiometricImport, setShowBiometricImport] = useState(false);
  const [biometricImportData, setBiometricImportData] = useState('');

  const loadData = useCallback(() => {
    const recs = getAttendanceRecords().filter(a => a.date === selectedDate);
    if (recs.length === 0) {
      // Auto-populate active employees
      const activeEmps = getEmployees().filter(e => e.status === 'Active');
      const newRecs: AttendanceRecord[] = activeEmps.map(emp => ({
        id: genId(),
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: emp.name,
        date: selectedDate,
        checkIn: '',
        checkOut: '',
        status: 'Present' as AttStatus,
        notes: '',
      }));
      setRecords(newRecs);
    } else {
      setRecords(recs);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
    // Load biometric config from localStorage
    try {
      const saved = localStorage.getItem('baga_biometric_config');
      if (saved) setBiometricConfig(JSON.parse(saved));
    } catch {}
  }, [loadData]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveRecords = () => {
    const existing = getAttendanceRecords().filter(a => a.date !== selectedDate);
    setAttendanceRecords([...existing, ...records]);
    showToast(`Attendance saved for ${selectedDate}`, 'success');
  };

  const markAllPresent = () => {
    setRecords(prev => prev.map(r => ({ ...r, status: 'Present' as AttStatus, checkIn: r.checkIn || '09:00', checkOut: r.checkOut || '17:00' })));
    showToast('All marked as Present', 'success');
  };

  const updateStatus = (id: string, status: AttStatus) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const updateField = (id: string, field: string, value: string) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleEdit = (record: AttendanceRecord) => {
    setEditRecord({ ...record });
  };

  const handleSaveEdit = () => {
    if (!editRecord) return;
    const existing = getAttendanceRecords();
    const idx = existing.findIndex(a => a.id === editRecord.id);
    if (idx >= 0) {
      existing[idx] = editRecord;
      setAttendanceRecords(existing);
    }
    setEditRecord(null);
    showToast('Record updated', 'success');
    loadData();
  };

  // Biometric settings
  const saveBiometricConfig = () => {
    localStorage.setItem('baga_biometric_config', JSON.stringify(biometricConfig));
    setShowBiometricSettings(false);
    showToast('Biometric settings saved', 'success');
  };

  const simulateBiometricSync = () => {
    // Simulate biometric data import
    const activeEmps = getEmployees().filter(e => e.status === 'Active');
    const simulatedRecords: AttendanceRecord[] = activeEmps.map(emp => {
      const rand = Math.random();
      let status: AttStatus = 'Present';
      let checkIn = '08:' + String(Math.floor(Math.random() * 30)).padStart(2, '0');
      let checkOut = '17:' + String(Math.floor(Math.random() * 30)).padStart(2, '0');
      if (rand < 0.05) { status = 'Absent'; checkIn = ''; checkOut = ''; }
      else if (rand < 0.12) { status = 'Half Day'; checkIn = checkIn; checkOut = '12:30'; }
      else if (rand < 0.18) { status = 'Leave'; checkIn = ''; checkOut = ''; }
      return {
        id: genId(),
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: emp.name,
        date: selectedDate,
        checkIn, checkOut, status, notes: 'Biometric',
      };
    });
    setRecords(simulatedRecords);
    const config = { ...biometricConfig, lastSync: new Date().toISOString() };
    setBiometricConfig(config);
    localStorage.setItem('baga_biometric_config', JSON.stringify(config));
    setShowBiometricImport(false);
    showToast(`Biometric data synced for ${simulatedRecords.length} employees`, 'success');
  };

  const handleBiometricCSVImport = () => {
    if (!biometricImportData.trim()) {
      showToast('Please paste CSV data', 'error');
      return;
    }
    try {
      const lines = biometricImportData.trim().split('\n');
      const importedRecords: AttendanceRecord[] = [];
      // Expected format: EmployeeCode,CheckIn,CheckOut,Status
      for (let i = 1; i < lines.length; i++) { // Skip header
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length >= 4) {
          const empCode = cols[0];
          const emp = getEmployees().find(e => e.employeeCode === empCode);
          if (emp) {
            importedRecords.push({
              id: genId(),
              employeeId: emp.id,
              employeeCode: empCode,
              employeeName: emp.name,
              date: selectedDate,
              checkIn: cols[1] || '',
              checkOut: cols[2] || '',
              status: (cols[3] as AttStatus) || 'Present',
              notes: 'Biometric Import',
            });
          }
        }
      }
      if (importedRecords.length > 0) {
        setRecords(importedRecords);
        const config = { ...biometricConfig, lastSync: new Date().toISOString() };
        setBiometricConfig(config);
        localStorage.setItem('baga_biometric_config', JSON.stringify(config));
        setShowBiometricImport(false);
        setBiometricImportData('');
        showToast(`Imported ${importedRecords.length} records from biometric data`, 'success');
      } else {
        showToast('No matching employee codes found in data', 'error');
      }
    } catch {
      showToast('Error parsing data. Check format.', 'error');
    }
  };

  const presentCount = records.filter(r => r.status === 'Present').length;
  const absentCount = records.filter(r => r.status === 'Absent').length;
  const halfDayCount = records.filter(r => r.status === 'Half Day').length;
  const leaveCount = records.filter(r => r.status === 'Leave').length;
  const holidayCount = records.filter(r => r.status === 'Holiday').length;

  return (
    <div className="space-y-6">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance Management</h2>
          <p className="text-sm text-slate-500">Mark and manage daily attendance</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowBiometricImport(true)} className="btn btn-outline" style={{color:'#0d9488',borderColor:'#0d9488'}}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
            Biometric Import
          </button>
          <button onClick={() => setShowBiometricSettings(true)} className="btn btn-outline">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Biometric Settings
          </button>
          <button onClick={markAllPresent} className="btn btn-success">Mark All Present</button>
          <button onClick={saveRecords} className="btn btn-primary">Save Attendance</button>
        </div>
      </div>

      {/* Date Picker & Summary */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="form-label">Select Date</label>
          <input type="date" className="form-input w-48" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-emerald-700">{presentCount}</p>
            <p className="text-xs text-emerald-600">Present</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-red-700">{absentCount}</p>
            <p className="text-xs text-red-600">Absent</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-amber-700">{halfDayCount}</p>
            <p className="text-xs text-amber-600">Half Day</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-blue-700">{leaveCount}</p>
            <p className="text-xs text-blue-600">Leave</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-purple-700">{holidayCount}</p>
            <p className="text-xs text-purple-600">Holiday</p>
          </div>
        </div>
        {biometricConfig.lastSync && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
            <p className="text-xs text-teal-600">Last Biometric Sync: <span className="font-mono">{new Date(biometricConfig.lastSync).toLocaleString()}</span></p>
          </div>
        )}
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="data-table">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th>#</th><th>Employee Code</th><th>Employee</th><th>Department</th><th>Check In</th><th>Check Out</th><th>Status</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-8">No active employees found</td></tr>}
              {records.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td><span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{r.employeeCode}</span></td>
                  <td className="font-medium">{r.employeeName}</td>
                  <td><span className="badge badge-blue">{(getEmployees().find(e => e.id === r.employeeId))?.department || '-'}</span></td>
                  <td>
                    <input type="time" className="form-input !w-28 !py-1 !text-xs" value={r.checkIn} onChange={e => updateField(r.id, 'checkIn', e.target.value)} />
                  </td>
                  <td>
                    <input type="time" className="form-input !w-28 !py-1 !text-xs" value={r.checkOut} onChange={e => updateField(r.id, 'checkOut', e.target.value)} />
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {(['Present', 'Absent', 'Half Day', 'Leave', 'Holiday'] as AttStatus[]).map(s => (
                        <button key={s} onClick={() => updateStatus(r.id, s)}
                          className={`text-[10px] px-2 py-1 rounded font-medium border cursor-pointer transition-colors ${
                            r.status === s
                              ? s === 'Present' ? 'bg-emerald-500 text-white border-emerald-500'
                                : s === 'Absent' ? 'bg-red-500 text-white border-red-500'
                                : s === 'Half Day' ? 'bg-amber-500 text-white border-amber-500'
                                : s === 'Leave' ? 'bg-blue-500 text-white border-blue-500'
                                : 'bg-purple-500 text-white border-purple-500'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <input className="form-input !w-32 !py-1 !text-xs" value={r.notes} onChange={e => updateField(r.id, 'notes', e.target.value)} placeholder="Notes" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Biometric Settings Modal */}
      {showBiometricSettings && (
        <div className="modal-overlay" onClick={() => setShowBiometricSettings(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Biometric Machine Settings</h3>
                <p className="text-xs text-slate-400">Configure biometric device for attendance tracking</p>
              </div>
              <button onClick={() => setShowBiometricSettings(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Biometric device illustration */}
            <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl p-4 mb-4 border border-teal-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                </div>
                <div>
                  <p className="font-semibold text-teal-700">Biometric Integration</p>
                  <p className="text-xs text-teal-600">Connect your biometric fingerprint/face device to automatically track employee attendance via their Employee Code</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm text-slate-700">Enable Biometric</p>
                  <p className="text-xs text-slate-400">Turn on biometric attendance tracking</p>
                </div>
                <button onClick={() => setBiometricConfig(p => ({ ...p, enabled: !p.enabled }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${biometricConfig.enabled ? 'bg-teal-500' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${biometricConfig.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">Device Name</label><input className="form-input" value={biometricConfig.deviceName} onChange={e => setBiometricConfig(p => ({ ...p, deviceName: e.target.value }))} placeholder="e.g. ZKTeco BioTime" /></div>
                <div><label className="form-label">Device ID</label><input className="form-input" value={biometricConfig.deviceId} onChange={e => setBiometricConfig(p => ({ ...p, deviceId: e.target.value }))} placeholder="e.g. BM-001" /></div>
                <div><label className="form-label">Connection Type</label>
                  <select className="form-input" value={biometricConfig.connectionType} onChange={e => setBiometricConfig(p => ({ ...p, connectionType: e.target.value as BiometricConfig['connectionType'] }))}>
                    <option value="USB">USB</option><option value="Network">Network (LAN)</option><option value="WiFi">WiFi</option><option value="Cloud API">Cloud API</option>
                  </select>
                </div>
                <div><label className="form-label">Sync Interval (min)</label><input type="number" className="form-input" value={biometricConfig.syncInterval} onChange={e => setBiometricConfig(p => ({ ...p, syncInterval: Number(e.target.value) }))} min={5} /></div>
              </div>

              {(biometricConfig.connectionType === 'Network' || biometricConfig.connectionType === 'WiFi' || biometricConfig.connectionType === 'Cloud API') && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="form-label">IP Address</label><input className="form-input" value={biometricConfig.ipAddress} onChange={e => setBiometricConfig(p => ({ ...p, ipAddress: e.target.value }))} placeholder="192.168.1.100" /></div>
                  <div><label className="form-label">Port</label><input className="form-input" value={biometricConfig.port} onChange={e => setBiometricConfig(p => ({ ...p, port: e.target.value }))} placeholder="4370" /></div>
                </div>
              )}

              {biometricConfig.connectionType === 'Cloud API' && (
                <div><label className="form-label">API Key</label><input className="form-input" type="password" value={biometricConfig.apiKey} onChange={e => setBiometricConfig(p => ({ ...p, apiKey: e.target.value }))} placeholder="Enter API key" /></div>
              )}

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm text-slate-700">Auto Sync</p>
                  <p className="text-xs text-slate-400">Automatically sync every {biometricConfig.syncInterval} minutes</p>
                </div>
                <button onClick={() => setBiometricConfig(p => ({ ...p, autoSync: !p.autoSync }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${biometricConfig.autoSync ? 'bg-teal-500' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${biometricConfig.autoSync ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Employee Code Mapping Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">How it works:</p>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>1. Register employees on biometric device using their Employee Code</li>
                  <li>2. Employee punches in/out on the biometric machine</li>
                  <li>3. System matches Employee Code from biometric data</li>
                  <li>4. Attendance is auto-populated with Check In/Out times</li>
                  <li>5. Absences are auto-deducted in salary calculation</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowBiometricSettings(false)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={saveBiometricConfig} className="btn btn-primary flex-1">Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Biometric Import Modal */}
      {showBiometricImport && (
        <div className="modal-overlay" onClick={() => setShowBiometricImport(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Import Biometric Data</h3>
                <p className="text-xs text-slate-400">Import attendance from biometric machine</p>
              </div>
              <button onClick={() => setShowBiometricImport(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Quick Sync Button */}
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-teal-700">Quick Sync from Device</p>
                    <p className="text-xs text-teal-600">Connect to biometric device and import today&apos;s attendance</p>
                    {biometricConfig.deviceName && <p className="text-xs text-teal-500 mt-1">Device: {biometricConfig.deviceName} ({biometricConfig.connectionType})</p>}
                  </div>
                  <button onClick={simulateBiometricSync} className="btn btn-primary btn-sm" style={{background:'#0d9488'}}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Sync Now
                  </button>
                </div>
              </div>

              {/* CSV Import */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm text-slate-700">Or Paste CSV Data</h4>
                  <span className="text-xs text-slate-400">Format: EmployeeCode, CheckIn, CheckOut, Status</span>
                </div>
                <textarea
                  className="form-input !h-32 font-mono text-xs"
                  value={biometricImportData}
                  onChange={e => setBiometricImportData(e.target.value)}
                  placeholder={"EmployeeCode,CheckIn,CheckOut,Status\n0001,08:15,17:30,Present\n0002,08:45,12:30,Half Day\n0003,,,Absent"}
                />
                <button onClick={handleBiometricCSVImport} className="btn btn-primary btn-sm mt-2" style={{background:'#0d9488'}}>
                  Import CSV Data
                </button>
              </div>
            </div>

            <button onClick={() => setShowBiometricImport(false)} className="btn btn-outline w-full mt-4">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
