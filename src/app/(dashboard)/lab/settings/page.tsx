'use client';
import { useState, useEffect } from 'react';
import { initLabData, getLabTests, addLabTest, updateLabTest, deleteLabTest, getLabTestCategories, genId, type LabTestDefinition, type LabParameter } from '@/lib/lab-store';

export default function TestCatalogPage() {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [tests, setTests] = useState<LabTestDefinition[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({ name: '', category: '', price: '', turnaroundTime: '', sampleType: '', active: true });
  const [params, setParams] = useState<LabParameter[]>([]);

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadData = () => { setTests(getLabTests()); };

  useEffect(() => { initLabData(); loadData(); setMounted(true); }, []);

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>;

  const categories = getLabTestCategories();
  const activeTests = tests.filter(t => t.active);
  const totalParams = tests.reduce((s, t) => s + t.parameters.length, 0);

  const filtered = tests.filter(t => {
    const matchCat = catFilter === 'All' || t.category === catFilter;
    const matchSearch = search === '' || t.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const openAddModal = () => {
    setEditingId(null);
    setForm({ name: '', category: '', price: '', turnaroundTime: '', sampleType: '', active: true });
    setParams([]);
    setShowModal(true);
  };

  const openEditModal = (test: LabTestDefinition) => {
    setEditingId(test.id);
    setForm({ name: test.name, category: test.category, price: String(test.price), turnaroundTime: test.turnaroundTime, sampleType: test.sampleType, active: test.active });
    setParams([...test.parameters]);
    setShowModal(true);
  };

  const addParam = () => {
    setParams([...params, { name: '', unit: '', refRange: '', refMale: '', refFemale: '', criticalLow: 0, criticalHigh: 0, normalLow: 0, normalHigh: 0 }]);
  };

  const removeParam = (idx: number) => {
    setParams(params.filter((_, i) => i !== idx));
  };

  const updateParam = (idx: number, data: Partial<LabParameter>) => {
    const updated = [...params];
    updated[idx] = { ...updated[idx], ...data };
    setParams(updated);
  };

  const saveTest = () => {
    if (!form.name.trim()) { showToast('Test name required', 'error'); return; }
    if (!form.category.trim()) { showToast('Category required', 'error'); return; }
    const data: LabTestDefinition = {
      id: editingId || genId(),
      name: form.name.trim(),
      category: form.category.trim(),
      price: parseFloat(form.price) || 0,
      turnaroundTime: form.turnaroundTime.trim() || '2 hours',
      sampleType: form.sampleType.trim() || 'Blood',
      active: form.active,
      parameters: params.filter(p => p.name.trim() !== ''),
    };
    if (editingId) {
      updateLabTest(editingId, data);
      showToast('Test updated', 'success');
    } else {
      addLabTest(data);
      showToast('Test added', 'success');
    }
    setShowModal(false);
    loadData();
  };

  const toggleActive = (test: LabTestDefinition) => {
    updateLabTest(test.id, { active: !test.active });
    showToast(`${test.name} ${test.active ? 'deactivated' : 'activated'}`, 'success');
    loadData();
  };

  const removeTest = (id: string) => {
    if (confirm('Delete this test? This cannot be undone.')) {
      deleteLabTest(id);
      loadData();
      showToast('Test deleted', 'success');
    }
  };

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Test Catalog</h2>
          <p className="text-sm text-slate-500">Configure lab tests with parameters and reference ranges</p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary">+ Add Test</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Tests</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{tests.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activeTests.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Categories</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{categories.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Parameters</p>
          <p className="text-2xl font-bold text-cyan-600 mt-1">{totalParams}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <input type="text" className="form-input pl-10" placeholder="Search tests..." value={search} onChange={e => setSearch(e.target.value)} />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCatFilter('All')} className={`btn btn-sm ${catFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}>All</button>
          {categories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={`btn btn-sm ${catFilter === c ? 'btn-primary' : 'btn-outline'}`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Tests Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Test Name</th><th>Category</th><th>Price</th><th>Sample</th><th>Turnaround</th><th>Parameters</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className={!t.active ? 'opacity-50' : ''}>
                  <td className="font-medium">{t.name}</td>
                  <td><span className="badge badge-slate">{t.category}</span></td>
                  <td className="font-semibold">Rs. {t.price.toLocaleString()}</td>
                  <td className="text-sm">{t.sampleType}</td>
                  <td className="text-sm">{t.turnaroundTime}</td>
                  <td className="text-sm">{t.parameters.length} params</td>
                  <td><span className={`badge ${t.active ? 'badge-green' : 'badge-rose'}`}>{t.active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEditModal(t)} className="btn btn-outline btn-sm">Edit</button>
                      <button onClick={() => toggleActive(t)} className={`btn btn-sm ${t.active ? 'btn-danger' : 'btn-success'}`}>
                        {t.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => removeTest(t.id)} className="btn btn-danger btn-sm">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">No tests found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editingId ? 'Edit Test' : 'Add New Test'}</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-outline btn-sm">Close</button>
            </div>

            {/* Test Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <div className="sm:col-span-2">
                <label className="form-label">Test Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. CBC (Complete Blood Count)" />
              </div>
              <div>
                <label className="form-label">Category *</label>
                <input className="form-input" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} placeholder="e.g. Hematology" />
              </div>
              <div>
                <label className="form-label">Price (Rs.)</label>
                <input type="number" className="form-input" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} placeholder="800" />
              </div>
              <div>
                <label className="form-label">Turnaround Time</label>
                <input className="form-input" value={form.turnaroundTime} onChange={e => setForm(f => ({...f, turnaroundTime: e.target.value}))} placeholder="2 hours" />
              </div>
              <div>
                <label className="form-label">Sample Type</label>
                <select className="form-input" value={form.sampleType} onChange={e => setForm(f => ({...f, sampleType: e.target.value}))}>
                  <option>Blood</option><option>Blood (EDTA)</option><option>Blood (Serum)</option><option>Blood (Citrate)</option><option>Blood (Fasting)</option><option>Blood (Fluoride)</option><option>Urine</option><option>Stool</option><option>CSF</option><option>Serum</option><option>Plasma</option>
                </select>
              </div>
            </div>

            {/* Parameters Builder */}
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-800">Parameters ({params.length})</h4>
                <button onClick={addParam} className="btn btn-primary btn-sm">+ Add Parameter</button>
              </div>

              {params.length === 0 && (
                <p className="text-slate-400 text-center py-4">No parameters added. Click &quot;+ Add Parameter&quot; to define test parameters.</p>
              )}

              {params.map((p, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-3 mb-3 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Parameter {idx + 1}</span>
                    <button onClick={() => removeParam(idx)} className="text-red-500 hover:text-red-700 text-xs font-bold">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-slate-500">Name</label>
                      <input className="form-input py-1 text-sm" value={p.name} onChange={e => updateParam(idx, { name: e.target.value })} placeholder="e.g. Hemoglobin" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Unit</label>
                      <input className="form-input py-1 text-sm" value={p.unit} onChange={e => updateParam(idx, { unit: e.target.value })} placeholder="e.g. g/dL" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Male Range</label>
                      <input className="form-input py-1 text-sm" value={p.refMale} onChange={e => updateParam(idx, { refMale: e.target.value })} placeholder="13.5-17.5" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Female Range</label>
                      <input className="form-input py-1 text-sm" value={p.refFemale} onChange={e => updateParam(idx, { refFemale: e.target.value })} placeholder="12-16" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Critical Low</label>
                      <input type="number" className="form-input py-1 text-sm" value={p.criticalLow || ''} onChange={e => updateParam(idx, { criticalLow: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Critical High</label>
                      <input type="number" className="form-input py-1 text-sm" value={p.criticalHigh || ''} onChange={e => updateParam(idx, { criticalHigh: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Normal Low</label>
                      <input type="number" className="form-input py-1 text-sm" value={p.normalLow || ''} onChange={e => updateParam(idx, { normalLow: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Normal High</label>
                      <input type="number" className="form-input py-1 text-sm" value={p.normalHigh || ''} onChange={e => updateParam(idx, { normalHigh: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={saveTest} className="btn btn-success btn-lg w-full mt-4">
              {editingId ? 'Update Test' : 'Add Test'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
