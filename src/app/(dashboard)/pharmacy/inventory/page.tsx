'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getMedicines, addMedicine, updateMedicine, deleteMedicine,
  getMedicineCategories, genId, getHospitalSettings,
  getExpiredMedicines, getLowStockMedicines, todayStr,
} from '@/lib/store';
import type { MedicineItem } from '@/lib/types';

export default function InventoryPage() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [currency, setCurrency] = useState('Rs.');
  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const s = getHospitalSettings();
    setCurrency(s.currency);
  }, []);

  /* ==================== STATE ==================== */
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [catFilter, setCatFilter] = useState('All');
  const [invSearch, setInvSearch] = useState('');
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicineItem | null>(null);
  const [editPriceMed, setEditPriceMed] = useState<MedicineItem | null>(null);
  const [editPriceVal, setEditPriceVal] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<MedicineItem | null>(null);
  const [expiredMeds, setExpiredMeds] = useState<MedicineItem[]>([]);
  const [lowStockMeds, setLowStockMeds] = useState<MedicineItem[]>([]);

  // Medicine form
  const [fName, setFName] = useState('');
  const [fGeneric, setFGeneric] = useState('');
  const [fForm, setFForm] = useState('Tablet');
  const [fStrength, setFStrength] = useState('');
  const [fPacking, setFPacking] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fNewCategory, setFNewCategory] = useState('');

  const loadInventory = useCallback(() => {
    const meds = getMedicines();
    setMedicines(meds);
    setCategories(getMedicineCategories());
    setExpiredMeds(getExpiredMedicines());
    setLowStockMeds(getLowStockMedicines());
  }, []);
  useEffect(() => { loadInventory(); }, [loadInventory]);

  const filteredMedicines = medicines.filter(m => {
    const matchCat = catFilter === 'All' || m.category === catFilter;
    const matchSearch = !invSearch ||
      m.name.toLowerCase().includes(invSearch.toLowerCase()) ||
      m.genericName.toLowerCase().includes(invSearch.toLowerCase()) ||
      m.strength.toLowerCase().includes(invSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const openAddMed = () => {
    setEditingMed(null);
    setFName(''); setFGeneric(''); setFForm('Tablet'); setFStrength('');
    setFPacking(''); setFPrice(''); setFCategory(categories[0] || ''); setFNewCategory('');
    setShowMedModal(true);
  };

  const openEditMed = (m: MedicineItem) => {
    setEditingMed(m);
    setFName(m.name); setFGeneric(m.genericName); setFForm(m.form); setFStrength(m.strength);
    setFPacking(m.packing); setFPrice(String(m.price)); setFCategory(m.category); setFNewCategory('');
    setShowMedModal(true);
  };

  const saveMed = () => {
    const cat = fCategory === '__new__' ? fNewCategory.trim() : fCategory.trim();
    if (!fName.trim() || !fForm || !fStrength.trim() || !fPacking.trim() || !fPrice.trim() || !cat) {
      showToast('All fields are required', 'error'); return;
    }
    if (editingMed) {
      updateMedicine(editingMed.id, {
        name: fName.trim(), genericName: fGeneric.trim(), form: fForm as MedicineItem['form'],
        strength: fStrength.trim(), packing: fPacking.trim(), price: Number(fPrice), category: cat,
      });
      showToast('Medicine updated successfully', 'success');
    } else {
      addMedicine({
        id: genId(), name: fName.trim(), genericName: fGeneric.trim(), form: fForm as MedicineItem['form'],
        strength: fStrength.trim(), packing: fPacking.trim(), price: Number(fPrice), category: cat, active: true,
        stock: 0, expiryDate: '', minStock: 10,
      });
      showToast('New medicine added successfully', 'success');
    }
    setShowMedModal(false);
    loadInventory();
  };

  const savePrice = () => {
    if (!editPriceMed || !editPriceVal) { showToast('Enter a valid price', 'error'); return; }
    updateMedicine(editPriceMed.id, { price: Number(editPriceVal) });
    showToast(`Price updated to ${currency} ${Number(editPriceVal).toLocaleString()}`, 'success');
    setEditPriceMed(null);
    setEditPriceVal('');
    loadInventory();
  };

  const toggleMedStatus = (m: MedicineItem) => {
    updateMedicine(m.id, { active: !m.active });
    showToast(`${m.name} ${m.active ? 'deactivated' : 'activated'}`, 'success');
    loadInventory();
  };

  const confirmDelete = (m: MedicineItem) => {
    deleteMedicine(m.id);
    showToast(`${m.name} deleted`, 'success');
    setDeleteConfirm(null);
    loadInventory();
  };

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Medicine Inventory</h2>
        <p className="text-sm text-slate-500">Manage medicine catalogue, pricing, stock levels, and expiry tracking</p>
      </div>

      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 relative w-full sm:max-w-md">
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            className="form-input pl-10"
            placeholder="Search medicines by name, generic name, or strength..."
            value={invSearch}
            onChange={e => setInvSearch(e.target.value)}
          />
        </div>
        <button onClick={openAddMed} className="btn btn-primary">
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add New Medicine
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCatFilter('All')} className={`btn btn-sm ${catFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}>
          All ({medicines.length})
        </button>
        {categories.map(c => (
          <button key={c} onClick={() => setCatFilter(c)} className={`btn btn-sm ${catFilter === c ? 'btn-primary' : 'btn-outline'}`}>
            {c} ({medicines.filter(m => m.category === c).length})
          </button>
        ))}
      </div>

      {/* Inventory Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Total Medicines</p>
          <p className="text-2xl font-bold text-blue-700">{medicines.length}</p>
        </div>
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Active</p>
          <p className="text-2xl font-bold text-emerald-700">{medicines.filter(m => m.active).length}</p>
        </div>
        <div className="stat-card card-hover border border-red-200 bg-red-50">
          <p className="text-xs text-red-600 font-medium">Inactive</p>
          <p className="text-2xl font-bold text-red-700">{medicines.filter(m => !m.active).length}</p>
        </div>
        <div className="stat-card card-hover border border-purple-200 bg-purple-50">
          <p className="text-xs text-purple-600 font-medium">Categories</p>
          <p className="text-2xl font-bold text-purple-700">{categories.length}</p>
        </div>
      </div>

      {/* Medicine Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="data-table">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th>Medicine Name</th>
                <th>Generic Name</th>
                <th>Form</th>
                <th>Strength</th>
                <th>Packing</th>
                <th>Category</th>
                <th className="text-right">Price</th>
                <th>Stock</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMedicines.map(m => (
                <tr key={m.id} className={!m.active ? 'opacity-50' : ''}>
                  <td className="font-semibold text-slate-800">{m.name}</td>
                  <td className="text-sm text-slate-500">{m.genericName}</td>
                  <td><span className="badge badge-blue">{m.form}</span></td>
                  <td className="text-sm text-slate-600">{m.strength}</td>
                  <td className="text-sm text-slate-500">{m.packing}</td>
                  <td><span className="badge badge-amber">{m.category}</span></td>
                  <td className="text-right">
                    <button
                      onClick={() => { setEditPriceMed(m); setEditPriceVal(String(m.price)); }}
                      className="font-bold text-emerald-700 hover:text-emerald-600 hover:underline cursor-pointer"
                      title="Click to edit price"
                    >
                      {currency} {m.price.toLocaleString()}
                      <svg className="w-3 h-3 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  </td>
                  <td>
                    <span className={`font-semibold ${m.stock <= 0 ? 'text-red-600' : m.stock <= (m.minStock || 10) ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {m.stock}
                    </span>
                    {m.stock <= 0 && <span className="badge badge-rose text-xs ml-1">OUT</span>}
                    {m.stock > 0 && m.stock <= (m.minStock || 10) && <span className="badge badge-amber text-xs ml-1">LOW</span>}
                  </td>
                  <td>
                    {m.expiryDate ? (
                      <span className={`text-sm ${m.expiryDate < todayStr() ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                        {m.expiryDate}
                        {m.expiryDate < todayStr() && <span className="badge badge-rose text-xs ml-1">EXPIRED</span>}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm">Not set</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${m.active ? 'badge-green' : 'badge-rose'}`}>
                      {m.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => openEditMed(m)} className="btn btn-outline btn-sm">Edit</button>
                      <button
                        onClick={() => toggleMedStatus(m)}
                        className={`btn btn-sm ${m.active ? 'btn-danger' : 'btn-success'}`}
                      >
                        {m.active ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => setDeleteConfirm(m)} className="btn btn-sm btn-danger">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMedicines.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-400">
                    No medicines found matching your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expiry & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Expired Medicines */}
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            <h3 className="font-bold text-red-800">Expired Medicines ({expiredMeds.length})</h3>
          </div>
          {expiredMeds.length === 0 ? (
            <p className="text-red-400 text-sm text-center py-3">No expired medicines</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {expiredMeds.map(m => (
                <div key={m.id} className="bg-white border border-red-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-red-800 text-sm">{m.name} ({m.strength})</p>
                    <p className="text-xs text-red-500">{m.form} | {m.packing} | Stock: {m.stock}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-red-600">Expired: {m.expiryDate}</p>
                    <span className="badge badge-rose text-xs">EXPIRED</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Medicines */}
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            <h3 className="font-bold text-amber-800">Low Stock ({lowStockMeds.length})</h3>
          </div>
          {lowStockMeds.length === 0 ? (
            <p className="text-amber-400 text-sm text-center py-3">All medicines are well stocked</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {lowStockMeds.filter(m => !expiredMeds.find(em => em.id === m.id)).map(m => (
                <div key={m.id} className="bg-white border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">{m.name} ({m.strength})</p>
                    <p className="text-xs text-amber-500">{m.form} | {m.packing}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-700">Stock: {m.stock}</p>
                    <p className="text-xs text-amber-500">Min: {m.minStock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Medicine Modal */}
      {showMedModal && (
        <div className="modal-overlay" onClick={() => setShowMedModal(false)}>
          <div className="modal-content" style={{ maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editingMed ? 'Edit Medicine' : 'Add New Medicine'}</h3>
              <button onClick={() => setShowMedModal(false)} className="btn btn-outline btn-sm">Close</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Medicine Name *</label>
                  <input type="text" className="form-input" placeholder="e.g. Paracetamol" value={fName} onChange={e => setFName(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Generic Name</label>
                  <input type="text" className="form-input" placeholder="e.g. Acetaminophen" value={fGeneric} onChange={e => setFGeneric(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Form *</label>
                  <select className="form-input" value={fForm} onChange={e => setFForm(e.target.value)}>
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Cream">Cream</option>
                    <option value="Drops">Drops</option>
                    <option value="Inhaler">Inhaler</option>
                    <option value="Powder">Powder</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Strength *</label>
                  <input type="text" className="form-input" placeholder="e.g. 500mg" value={fStrength} onChange={e => setFStrength(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Packing *</label>
                  <input type="text" className="form-input" placeholder="e.g. 10 tablets" value={fPacking} onChange={e => setFPacking(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Price ({currency}) *</label>
                  <input type="number" className="form-input" placeholder="e.g. 50" value={fPrice} onChange={e => setFPrice(e.target.value)} min={0} />
                </div>
                <div>
                  <label className="form-label">Category *</label>
                  <select
                    className="form-input"
                    value={fCategory === '__new__' ? '__new__' : fCategory}
                    onChange={e => setFCategory(e.target.value)}
                  >
                    <option value="">Select category...</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__new__">+ New Category</option>
                  </select>
                </div>
              </div>
              {fCategory === '__new__' && (
                <div>
                  <label className="form-label">New Category Name *</label>
                  <input type="text" className="form-input" placeholder="Enter new category name" value={fNewCategory} onChange={e => setFNewCategory(e.target.value)} />
                </div>
              )}
              <button onClick={saveMed} className="btn btn-success btn-lg w-full">
                {editingMed ? 'Update Medicine' : 'Add Medicine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Price Edit Modal */}
      {editPriceMed && (
        <div className="modal-overlay" onClick={() => setEditPriceMed(null)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Edit Price</h3>
            <p className="text-sm text-slate-500 mb-4">
              {editPriceMed.name} <span className="text-slate-400">({editPriceMed.form}, {editPriceMed.strength})</span>
            </p>
            <div className="mb-4">
              <label className="form-label">New Price ({currency})</label>
              <input
                type="number"
                className="form-input text-lg font-bold"
                value={editPriceVal}
                onChange={e => setEditPriceVal(e.target.value)}
                min={0}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') savePrice(); }}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditPriceMed(null)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={savePrice} className="btn btn-success flex-1">Save Price</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-red-700 mb-2">Delete Medicine</h3>
              <p className="text-sm text-slate-500 mb-4">
                Are you sure you want to delete <span className="font-bold text-slate-700">{deleteConfirm.name}</span> ({deleteConfirm.strength})? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="btn btn-outline flex-1">Cancel</button>
                <button onClick={() => confirmDelete(deleteConfirm)} className="btn btn-danger flex-1">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
