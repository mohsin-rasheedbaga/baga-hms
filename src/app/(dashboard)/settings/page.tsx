'use client';
import { useState, useEffect } from 'react';
import {
  getHospital, setHospital, getHospitalSettings, setHospitalSettings,
  getRoomTypes, addRoomType, updateRoomType, deleteRoomType, todayStr, genId,
} from '@/lib/store';
import type { Hospital, HospitalSettings, RoomType } from '@/lib/types';

/* ========== TOGGLE SWITCH ========== */
function Toggle({ checked, onChange, color }: { checked: boolean; onChange: (v: boolean) => void; color: string }) {
  const colorMap: Record<string, string> = {
    amber: 'peer-checked:bg-amber-500 peer-focus:ring-amber-300',
    green: 'peer-checked:bg-green-500 peer-focus:ring-green-300',
    red: 'peer-checked:bg-red-500 peer-focus:ring-red-300',
    purple: 'peer-checked:bg-purple-500 peer-focus:ring-purple-300',
  };
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className={`w-12 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${colorMap[color] || colorMap.amber}`} />
    </label>
  );
}

/* ========== MAIN COMPONENT ========== */
export default function SettingsPage() {
  const [hospital, setHospitalState] = useState<Hospital>({ name: '', address: '', phone: '', email: '', licenseNo: '' });
  const [settings, setSettingsState] = useState<HospitalSettings>({
    receptionCanCollectPharmacy: true, receptionCanCollectLab: true,
    receptionCanCollectXray: true, receptionCanCollectUltrasound: true,
    currency: 'Rs.', receiptFooter: '', roomChargesPerNight: 1500,
    wardChargesPerDay: 1000, hospitalCutRatio: 40, admissionFee: 2000,
    printerName: 'Default Printer', printerIP: '127.0.0.1', printerPort: 9100,
    receiptSize: 'A4', labInChargeDoctor: '',
    stickerWidth: 80, stickerHeight: 40,
    stickerShowHospital: true, stickerShowPatientAge: true, stickerShowTests: true,
  });
  const [roomTypes, setRoomTypesState] = useState<RoomType[]>([]);
  const [saved, setSaved] = useState(false);

  // Room type modal
  const [roomModal, setRoomModal] = useState(false);
  const [roomEditId, setRoomEditId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomCharges, setRoomCharges] = useState(0);

  useEffect(() => {
    setHospitalState(getHospital());
    setSettingsState(getHospitalSettings());
    setRoomTypesState(getRoomTypes());
  }, []);

  const showToast = (msg: string) => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    return msg;
  };

  // ---- Hospital ----
  const handleSaveHospital = () => { setHospital(hospital); showToast('saved'); };
  // ---- Settings ----
  const handleSaveSettings = () => { setHospitalSettings(settings); showToast('saved'); };
  const updateSetting = (key: keyof HospitalSettings, value: boolean | string | number) => {
    setSettingsState(prev => ({ ...prev, [key]: value }));
  };

  // ---- Room & Ward Charges ----
  const handleSaveCharges = () => { setHospitalSettings(settings); showToast('saved'); };

  // ---- Room Types CRUD ----
  const openAddRoom = () => { setRoomEditId(null); setRoomName(''); setRoomCharges(0); setRoomModal(true); };
  const openEditRoom = (rt: RoomType) => { setRoomEditId(rt.id); setRoomName(rt.name); setRoomCharges(rt.chargesPerNight); setRoomModal(true); };
  const handleSaveRoom = () => {
    if (!roomName.trim()) return;
    if (roomEditId) {
      updateRoomType(roomEditId, { name: roomName.trim(), chargesPerNight: roomCharges });
    } else {
      addRoomType({ id: genId(), name: roomName.trim(), chargesPerNight: roomCharges, active: true });
    }
    setRoomTypesState(getRoomTypes());
    setRoomModal(false);
    showToast('saved');
  };
  const handleToggleRoom = (id: string, active: boolean) => {
    updateRoomType(id, { active });
    setRoomTypesState(getRoomTypes());
  };
  const handleDeleteRoom = (id: string) => {
    if (!confirm('Are you sure you want to delete this room type?')) return;
    deleteRoomType(id);
    setRoomTypesState(getRoomTypes());
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {saved && <div className="toast toast-success">Settings saved successfully!</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">System Settings</h2>
      </div>

      {/* ==================== SECTION 1: Hospital Information ==================== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          Hospital Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Hospital Name</label>
            <input className="form-input" value={hospital.name} onChange={e => setHospitalState({ ...hospital, name: e.target.value })} />
          </div>
          <div>
            <label className="form-label">License Number</label>
            <input className="form-input" value={hospital.licenseNo} onChange={e => setHospitalState({ ...hospital, licenseNo: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Phone Number</label>
            <input className="form-input" value={hospital.phone} onChange={e => setHospitalState({ ...hospital, phone: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="form-input" value={hospital.email} onChange={e => setHospitalState({ ...hospital, email: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Address</label>
            <input className="form-input" value={hospital.address} onChange={e => setHospitalState({ ...hospital, address: e.target.value })} />
          </div>
        </div>
        <button onClick={handleSaveHospital} className="btn btn-primary mt-4">Save Hospital Info</button>
      </div>

      {/* ==================== SECTION 2: Reception Payment Controls ==================== */}
      <div className="bg-white rounded-xl border-2 border-amber-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          Reception Payment Controls
        </h3>
        <p className="text-sm text-slate-500 mb-4">Control which payments the reception staff can collect. If OFF, patients pay directly at the respective department.</p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-amber-100 rounded-lg bg-amber-50">
            <div>
              <p className="font-semibold text-slate-800">Pharmacy Payment at Reception</p>
              <p className="text-xs text-slate-500 mt-1">If ON: Reception collects medicine payment. If OFF: Patients pay at Pharmacy counter.</p>
            </div>
            <Toggle checked={settings.receptionCanCollectPharmacy} onChange={v => updateSetting('receptionCanCollectPharmacy', v)} color="amber" />
          </div>

          <div className="flex items-center justify-between p-4 border border-green-100 rounded-lg bg-green-50">
            <div>
              <p className="font-semibold text-slate-800">Lab Payment at Reception</p>
              <p className="text-xs text-slate-500 mt-1">If ON: Reception collects lab test payment. If OFF: Patients pay at Lab counter.</p>
            </div>
            <Toggle checked={settings.receptionCanCollectLab} onChange={v => updateSetting('receptionCanCollectLab', v)} color="green" />
          </div>

          <div className="flex items-center justify-between p-4 border border-red-100 rounded-lg bg-red-50">
            <div>
              <p className="font-semibold text-slate-800">X-Ray Payment at Reception</p>
              <p className="text-xs text-slate-500 mt-1">If ON: Reception collects X-ray payment. If OFF: Patients pay at X-Ray department.</p>
            </div>
            <Toggle checked={settings.receptionCanCollectXray} onChange={v => updateSetting('receptionCanCollectXray', v)} color="red" />
          </div>

          <div className="flex items-center justify-between p-4 border border-purple-100 rounded-lg bg-purple-50">
            <div>
              <p className="font-semibold text-slate-800">Ultrasound Payment at Reception</p>
              <p className="text-xs text-slate-500 mt-1">If ON: Reception collects ultrasound payment. If OFF: Patients pay at Ultrasound department.</p>
            </div>
            <Toggle checked={settings.receptionCanCollectUltrasound} onChange={v => updateSetting('receptionCanCollectUltrasound', v)} color="purple" />
          </div>
        </div>

        <button onClick={handleSaveSettings} className="btn btn-primary mt-5">Save Permission Settings</button>
      </div>

      {/* ==================== SECTION 3: Room & Ward Charges ==================== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          Room & Ward Charges
        </h3>
        <p className="text-sm text-slate-500 mb-4">Configure default charges for room, ward, hospital cut ratio, and admission fee.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Room Charges Per Night</label>
            <input type="number" className="form-input" value={settings.roomChargesPerNight} onChange={e => updateSetting('roomChargesPerNight', Number(e.target.value))} min={0} />
            <p className="text-xs text-slate-400 mt-1">Default room charge applied per night stay</p>
          </div>
          <div>
            <label className="form-label">Ward Charges Per Day</label>
            <input type="number" className="form-input" value={settings.wardChargesPerDay} onChange={e => updateSetting('wardChargesPerDay', Number(e.target.value))} min={0} />
            <p className="text-xs text-slate-400 mt-1">Default ward charge applied per day stay</p>
          </div>
          <div>
            <label className="form-label">Hospital Cut Ratio (%)</label>
            <input type="number" className="form-input" value={settings.hospitalCutRatio} onChange={e => updateSetting('hospitalCutRatio', Number(e.target.value))} min={0} max={100} />
            <p className="text-xs text-slate-400 mt-1">Percentage of room charges that goes to hospital (e.g. 40 means 40%)</p>
          </div>
          <div>
            <label className="form-label">Default Admission Fee</label>
            <input type="number" className="form-input" value={settings.admissionFee} onChange={e => updateSetting('admissionFee', Number(e.target.value))} min={0} />
            <p className="text-xs text-slate-400 mt-1">One-time admission processing fee</p>
          </div>
        </div>
        <button onClick={handleSaveCharges} className="btn btn-primary mt-4">Save Room & Ward Charges</button>
      </div>

      {/* ==================== SECTION 4: Receipt Settings ==================== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Receipt Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Currency Symbol</label>
            <input className="form-input" value={settings.currency} onChange={e => updateSetting('currency', e.target.value)} placeholder="Rs." />
          </div>
          <div>
            <label className="form-label">Receipt Footer Text</label>
            <input className="form-input" value={settings.receiptFooter} onChange={e => updateSetting('receiptFooter', e.target.value)} placeholder="Thank you message..." />
          </div>
        </div>
        <button onClick={handleSaveSettings} className="btn btn-primary mt-4">Save Receipt Settings</button>
      </div>

      {/* ==================== SECTION 5: Room Types Management ==================== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
            Room Types Management
          </h3>
          <button onClick={openAddRoom} className="btn btn-primary btn-sm">+ Add Room Type</button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Manage room types and their per-night charges. These are used when admitting patients.</p>

        {roomTypes.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="text-3xl mb-2">&#127968;</p>
            <p className="font-semibold">No room types configured</p>
            <p className="text-sm">Click &quot;Add Room Type&quot; to create one</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Room Type Name</th>
                  <th>Charges Per Night</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roomTypes.map((rt, i) => (
                  <tr key={rt.id}>
                    <td className="font-semibold">{i + 1}</td>
                    <td className="font-semibold">{rt.name}</td>
                    <td>
                      <span className="font-mono font-bold text-emerald-700">{settings.currency} {rt.chargesPerNight.toLocaleString()}</span>
                    </td>
                    <td>
                      <Toggle checked={rt.active} onChange={v => handleToggleRoom(rt.id, v)} color={rt.active ? 'green' : 'red'} />
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => openEditRoom(rt)} className="btn btn-outline btn-sm">Edit</button>
                        <button onClick={() => handleDeleteRoom(rt.id)} className="btn btn-danger btn-sm">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Room Type Modal */}
      {roomModal && (
        <div className="modal-overlay" onClick={() => setRoomModal(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{roomEditId ? 'Edit Room Type' : 'Add New Room Type'}</h3>
            <div className="space-y-4">
              <div>
                <label className="form-label">Room Type Name *</label>
                <input
                  className="form-input"
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  placeholder="e.g. Private Room, ICU, General Ward"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveRoom()}
                />
              </div>
              <div>
                <label className="form-label">Charges Per Night *</label>
                <input
                  type="number"
                  className="form-input"
                  value={roomCharges}
                  onChange={e => setRoomCharges(Number(e.target.value))}
                  min={0}
                  placeholder="e.g. 5000"
                  onKeyDown={e => e.key === 'Enter' && handleSaveRoom()}
                />
                <p className="text-xs text-slate-400 mt-1">Per night charge for this room type</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setRoomModal(false)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={handleSaveRoom} className="btn btn-primary flex-1">{roomEditId ? 'Update' : 'Add'} Room Type</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SECTION 6: System Info ==================== */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">System Information</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Version</span>
            <span className="font-medium">2.0.0</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">System Name</span>
            <span className="font-medium">BAGA Hospital Management System</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Mode</span>
            <span className="badge badge-blue">Offline Mode</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Database</span>
            <span className="badge badge-green">Local Storage (Offline)</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">Last Updated</span>
            <span className="font-medium">{todayStr()}</span>
          </div>
        </div>
      </div>

      {/* ==================== SECTION 7: Print Settings ==================== */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Print Settings
        </h3>
        <p className="text-sm text-slate-500 mb-4">Configure printer settings for receipts, reports, and stickers across all departments.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Printer Name</label>
            <input className="form-input" value={settings.printerName} onChange={e => updateSetting('printerName', e.target.value)} placeholder="e.g. HP LaserJet" />
            <p className="text-xs text-slate-400 mt-1">Name of the default printer used in the system</p>
          </div>
          <div>
            <label className="form-label">Receipt / Print Size</label>
            <select className="form-input" value={settings.receiptSize} onChange={e => updateSetting('receiptSize', e.target.value)}>
              <option value="A4">A4 (Full Page)</option>
              <option value="a5">A5 (Half Page)</option>
              <option value="thermal">Thermal / Small Receipt</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">A4 for full reports, Thermal for small receipts</p>
          </div>
          <div>
            <label className="form-label">Printer IP Address</label>
            <input className="form-input" value={settings.printerIP} onChange={e => updateSetting('printerIP', e.target.value)} placeholder="e.g. 192.168.1.100" />
            <p className="text-xs text-slate-400 mt-1">Network printer IP address (if applicable)</p>
          </div>
          <div>
            <label className="form-label">Printer Port</label>
            <input type="number" className="form-input" value={settings.printerPort} onChange={e => updateSetting('printerPort', Number(e.target.value))} placeholder="9100" />
            <p className="text-xs text-slate-400 mt-1">Network printer port (default: 9100)</p>
          </div>
        </div>
        <button onClick={handleSaveSettings} className="btn btn-primary mt-4">Save Print Settings</button>
      </div>

      {/* ==================== SECTION 8: Lab Report Settings ==================== */}
      <div className="bg-white rounded-xl border-2 border-teal-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          Lab Report & Sticker Settings
        </h3>
        <p className="text-sm text-slate-500 mb-4">Configure Lab In-Charge Doctor name (appears on reports) and sticker design settings.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Lab In-Charge Doctor Name</label>
            <input className="form-input" value={settings.labInChargeDoctor} onChange={e => updateSetting('labInChargeDoctor', e.target.value)} placeholder="e.g. Dr. Muhammad Ali" />
            <p className="text-xs text-slate-400 mt-1">This name will appear on all printed lab reports</p>
          </div>
          <div>
            <label className="form-label">Sticker Width (mm)</label>
            <input type="number" className="form-input" value={settings.stickerWidth} onChange={e => updateSetting('stickerWidth', Number(e.target.value))} min={30} max={200} />
            <p className="text-xs text-slate-400 mt-1">Width of lab sample sticker in millimeters</p>
          </div>
          <div>
            <label className="form-label">Sticker Height (mm)</label>
            <input type="number" className="form-input" value={settings.stickerHeight} onChange={e => updateSetting('stickerHeight', Number(e.target.value))} min={20} max={100} />
            <p className="text-xs text-slate-400 mt-1">Height of lab sample sticker in millimeters</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border border-teal-100 rounded-lg bg-teal-50">
              <div>
                <p className="font-semibold text-slate-800 text-sm">Show Hospital Name on Sticker</p>
              </div>
              <Toggle checked={settings.stickerShowHospital} onChange={v => updateSetting('stickerShowHospital', v)} color="green" />
            </div>
            <div className="flex items-center justify-between p-3 border border-teal-100 rounded-lg bg-teal-50">
              <div>
                <p className="font-semibold text-slate-800 text-sm">Show Patient Age on Sticker</p>
              </div>
              <Toggle checked={settings.stickerShowPatientAge} onChange={v => updateSetting('stickerShowPatientAge', v)} color="green" />
            </div>
            <div className="flex items-center justify-between p-3 border border-teal-100 rounded-lg bg-teal-50">
              <div>
                <p className="font-semibold text-slate-800 text-sm">Show Test Names on Sticker</p>
              </div>
              <Toggle checked={settings.stickerShowTests} onChange={v => updateSetting('stickerShowTests', v)} color="green" />
            </div>
          </div>
        </div>
        <button onClick={handleSaveSettings} className="btn btn-primary mt-4">Save Lab Settings</button>
      </div>

      {/* Active Modules */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Active Modules</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { name: 'Reception', status: 'Active' },
            { name: 'Patients', status: 'Active' },
            { name: 'Doctors', status: 'Active' },
            { name: 'Pharmacy', status: 'Active' },
            { name: 'Laboratory', status: 'Active' },
            { name: 'X-Ray', status: 'Active' },
            { name: 'Ultrasound', status: 'Active' },
            { name: 'Admission', status: 'Active' },
            { name: 'Accounts', status: 'Active' },
            { name: 'Settings', status: 'Active' },
          ].map((mod, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-3 text-center">
              <p className="font-medium text-sm text-slate-700">{mod.name}</p>
              <span className={`badge mt-1 ${mod.status === 'Active' ? 'badge-green' : 'badge-amber'}`}>{mod.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
