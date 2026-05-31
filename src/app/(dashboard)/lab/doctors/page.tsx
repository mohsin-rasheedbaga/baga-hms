'use client';
import { useState, useEffect } from 'react';
import { initLabData, getLabDoctors, addLabDoctor, updateLabDoctor, deleteLabDoctor, genId, type LabDoctor } from '@/lib/lab-store';

const emptyDoctor: Omit<LabDoctor, 'id'> = {
  name: '',
  designation: 'Pathologist',
  qualification: '',
  phone: '',
  active: true,
  showOnReport: true,
};

export default function LabDoctorsPage() {
  const [doctors, setDoctors] = useState<LabDoctor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<LabDoctor, 'id'>>(emptyDoctor);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const loadData = () => setDoctors(getLabDoctors());

  useEffect(() => { initLabData(); loadData(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyDoctor });
    setShowForm(true);
  };

  const openEdit = (doc: LabDoctor) => {
    setEditId(doc.id);
    setForm({ name: doc.name, designation: doc.designation, qualification: doc.qualification, phone: doc.phone, active: doc.active, showOnReport: doc.showOnReport });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { showToast('Doctor name is required', 'error'); return; }
    if (editId) {
      updateLabDoctor(editId, form);
      showToast('Doctor updated successfully', 'success');
    } else {
      addLabDoctor({ ...form, id: genId() });
      showToast('Doctor added successfully', 'success');
    }
    setShowForm(false);
    loadData();
  };

  const handleDelete = (id: string) => {
    deleteLabDoctor(id);
    setDeleteConfirm(null);
    loadData();
    showToast('Doctor removed', 'success');
  };

  const toggleActive = (doc: LabDoctor) => {
    updateLabDoctor(doc.id, { active: !doc.active });
    loadData();
  };

  const toggleReport = (doc: LabDoctor) => {
    updateLabDoctor(doc.id, { showOnReport: !doc.showOnReport });
    loadData();
  };

  const reportDoctors = doctors.filter(d => d.active && d.showOnReport);

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lab Doctors Management</h2>
          <p className="text-sm text-slate-500">Add Pathologists, Lab In-Charge, Supervisors — names appear on printed reports</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Doctor
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
        <h4 className="font-semibold text-teal-800 text-sm mb-2">How it works:</h4>
        <ul className="text-xs text-teal-700 space-y-1">
          <li>- Add doctor names who authorize/sign lab reports (Pathologist, Lab In-Charge, Supervisor)</li>
          <li>- Toggle <strong>&quot;Show on Report&quot;</strong> to display the doctor name at the bottom of every printed lab report</li>
          <li>- The logged-in technician&apos;s name automatically appears as &quot;Lab Technician&quot; on reports</li>
          <li>- Currently <strong>{reportDoctors.length} doctor(s)</strong> will appear on reports: {reportDoctors.length > 0 ? reportDoctors.map(d => d.name).join(', ') : 'None'}</li>
        </ul>
      </div>

      {/* Report Preview */}
      {reportDoctors.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="font-semibold text-slate-700 text-sm mb-3">Report Footer Preview:</h4>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex justify-between items-end">
              <div className="text-center">
                <div className="border-t border-slate-400 pt-2 mt-8 text-xs text-slate-600">Lab Technician</div>
              </div>
              {reportDoctors.map((d, i) => (
                <div key={d.id} className="text-center">
                  <div className="text-[10px] text-slate-500">{d.qualification}</div>
                  <div className="border-t border-slate-400 pt-2 mt-4 text-xs font-semibold text-slate-700">{d.name}</div>
                  <div className="text-[10px] text-slate-500">{d.designation}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Doctors List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Doctor Name</th>
                <th>Designation</th>
                <th>Qualification</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Show on Report</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map(doc => (
                <tr key={doc.id} className={!doc.active ? 'opacity-50' : ''}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold text-xs">{doc.name.charAt(0)}</div>
                      <span className="font-semibold text-slate-800">{doc.name}</span>
                    </div>
                  </td>
                  <td className="text-slate-600">{doc.designation}</td>
                  <td className="text-sm text-slate-500">{doc.qualification}</td>
                  <td className="text-sm text-slate-500 font-mono">{doc.phone}</td>
                  <td>
                    <button onClick={() => toggleActive(doc)} className={`badge ${doc.active ? 'badge-green' : 'badge-slate'}`}>
                      {doc.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <button onClick={() => toggleReport(doc)} className={`badge ${doc.showOnReport ? 'badge-blue' : 'badge-slate'}`}>
                      {doc.showOnReport ? 'Yes' : 'No'}
                    </button>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(doc)} className="btn btn-outline btn-sm">Edit</button>
                      {deleteConfirm === doc.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(doc.id)} className="btn btn-danger btn-sm">Confirm</button>
                          <button onClick={() => setDeleteConfirm(null)} className="btn btn-outline btn-sm">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(doc.id)} className="btn btn-outline btn-sm text-red-600 border-red-200 hover:bg-red-50">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {doctors.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No doctors added yet. Click &quot;Add Doctor&quot; to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">{editId ? 'Edit Doctor' : 'Add New Doctor'}</h3>
            <div className="space-y-4">
              <div>
                <label className="form-label">Doctor Name *</label>
                <input type="text" className="form-input" placeholder="e.g. Dr. Muhammad Asif" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Designation</label>
                <select className="form-input" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })}>
                  <option value="Pathologist">Pathologist</option>
                  <option value="Lab In-Charge">Lab In-Charge</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Microbiologist">Microbiologist</option>
                  <option value="Biochemist">Biochemist</option>
                  <option value="Hematologist">Hematologist</option>
                  <option value="Lab Director">Lab Director</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="form-label">Qualification</label>
                <input type="text" className="form-input" placeholder="e.g. MBBS, FCPS (Pathology)" value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input type="text" className="form-input" placeholder="e.g. 0300-1234567" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-teal-600" />
                  <span className="text-sm text-slate-700">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.showOnReport} onChange={e => setForm({ ...form, showOnReport: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-teal-600" />
                  <span className="text-sm text-slate-700">Show on Printed Reports</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
              <button onClick={handleSave} className="btn btn-primary">{editId ? 'Update Doctor' : 'Add Doctor'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
