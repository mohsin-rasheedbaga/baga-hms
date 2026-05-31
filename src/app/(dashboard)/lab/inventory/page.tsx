'use client';
import { useState, useEffect } from 'react';
import { initLabData, getLabInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, getLowStockItems, getExpiringItems, getInventoryCategories, genId, type LabInventoryItem } from '@/lib/lab-store';

export default function InventoryPage() {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [inventory, setInventory] = useState<LabInventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ id: string; stock: number } | null>(null);

  // Form state
  const [form, setForm] = useState({ name: '', category: '', unit: '', stock: '', minStock: '', costPrice: '', sellingPrice: '', expiryDate: '', supplier: '', batchNo: '' });

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadData = () => { setInventory(getLabInventory()); };

  useEffect(() => { initLabData(); loadData(); setMounted(true); }, []);

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>;

  const lowStock = getLowStockItems();
  const expiring = getExpiringItems(90);
  const categories = getInventoryCategories();
  const totalValue = inventory.reduce((s, i) => s + (i.stock * i.costPrice), 0);

  const filtered = inventory.filter(i => {
    const matchCat = catFilter === 'All' || i.category === catFilter;
    const matchSearch = search === '' || i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const openAddModal = () => {
    setEditingId(null);
    setForm({ name: '', category: '', unit: '', stock: '', minStock: '', costPrice: '', sellingPrice: '', expiryDate: '', supplier: '', batchNo: '' });
    setShowModal(true);
  };

  const openEditModal = (item: LabInventoryItem) => {
    setEditingId(item.id);
    setForm({ name: item.name, category: item.category, unit: item.unit, stock: String(item.stock), minStock: String(item.minStock), costPrice: String(item.costPrice), sellingPrice: String(item.sellingPrice), expiryDate: item.expiryDate, supplier: item.supplier, batchNo: item.batchNo });
    setShowModal(true);
  };

  const saveItem = () => {
    if (!form.name.trim() || !form.category.trim()) { showToast('Name and category required', 'error'); return; }
    const data = {
      name: form.name.trim(),
      category: form.category.trim(),
      unit: form.unit.trim() || 'Piece',
      stock: parseInt(form.stock) || 0,
      minStock: parseInt(form.minStock) || 5,
      costPrice: parseFloat(form.costPrice) || 0,
      sellingPrice: parseFloat(form.sellingPrice) || 0,
      expiryDate: form.expiryDate || '2028-12-31',
      supplier: form.supplier.trim(),
      batchNo: form.batchNo.trim(),
    };
    if (editingId) {
      updateInventoryItem(editingId, data);
      showToast('Item updated', 'success');
    } else {
      addInventoryItem({ id: genId(), ...data });
      showToast('Item added', 'success');
    }
    setShowModal(false);
    loadData();
  };

  const removeItem = (id: string) => {
    if (confirm('Delete this inventory item?')) {
      deleteInventoryItem(id);
      loadData();
      showToast('Item deleted', 'success');
    }
  };

  const handleInlineStockSave = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inlineEdit) {
      updateInventoryItem(inlineEdit.id, { stock: inlineEdit.stock });
      showToast('Stock updated', 'success');
      setInlineEdit(null);
      loadData();
    }
  };

  const isLow = (item: LabInventoryItem) => item.stock <= item.minStock;
  const isExpiring = (item: LabInventoryItem) => item.expiryDate <= new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Inventory</h2>
          <p className="text-sm text-slate-500">Manage lab supplies and reagents</p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary">+ Add Item</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Items</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{inventory.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <p className="text-xs text-red-500 uppercase tracking-wide font-semibold">Low Stock Alerts</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{lowStock.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-amber-500 uppercase tracking-wide font-semibold">Expiring Soon</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{expiring.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Value</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">Rs. {totalValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <h3 className="font-bold text-red-800 mb-3">⚠️ Low Stock Alert ({lowStock.length} items)</h3>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(item => (
              <div key={item.id} className="bg-white border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="font-medium text-red-800 text-sm">{item.name}</span>
                <span className="text-xs text-red-500">Stock: {item.stock} (Min: {item.minStock})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <input type="text" className="form-input pl-10" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCatFilter('All')} className={`btn btn-sm ${catFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}>All</button>
          {categories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={`btn btn-sm ${catFilter === c ? 'btn-primary' : 'btn-outline'}`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Category</th><th>Unit</th><th>Stock</th><th>Min Stock</th><th>Cost</th><th>Expiry</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className={isLow(item) ? 'bg-red-50' : isExpiring(item) ? 'bg-amber-50' : ''}>
                  <td>
                    <span className="font-medium">{item.name}</span>
                    {isLow(item) && <span className="ml-1 badge badge-rose text-xs">LOW</span>}
                    {isExpiring(item) && !isLow(item) && <span className="ml-1 badge badge-amber text-xs">EXPIRING</span>}
                  </td>
                  <td><span className="badge badge-slate">{item.category}</span></td>
                  <td className="text-sm">{item.unit}</td>
                  <td>
                    {inlineEdit?.id === item.id ? (
                      <input
                        type="number"
                        className="form-input py-1 px-2 w-20"
                        value={inlineEdit.stock}
                        onChange={e => setInlineEdit({ id: item.id, stock: parseInt(e.target.value) || 0 })}
                        onKeyDown={handleInlineStockSave}
                        autoFocus
                      />
                    ) : (
                      <button onClick={() => setInlineEdit({ id: item.id, stock: item.stock })} className={`font-bold ${isLow(item) ? 'text-red-600' : 'text-slate-800'}`}>
                        {item.stock}
                      </button>
                    )}
                  </td>
                  <td className="text-sm">{item.minStock}</td>
                  <td className="text-sm">Rs. {item.costPrice.toLocaleString()}</td>
                  <td className="text-sm">{item.expiryDate}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEditModal(item)} className="btn btn-outline btn-sm">Edit</button>
                      <button onClick={() => removeItem(item.id)} className="btn btn-danger btn-sm">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">No items found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editingId ? 'Edit Item' : 'Add New Item'}</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-outline btn-sm">Close</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Item name" /></div>
              <div><label className="form-label">Category *</label><input className="form-input" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} placeholder="e.g. Reagents" /></div>
              <div><label className="form-label">Unit</label><input className="form-input" value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))} placeholder="e.g. Box (100)" /></div>
              <div><label className="form-label">Stock</label><input type="number" className="form-input" value={form.stock} onChange={e => setForm(f => ({...f, stock: e.target.value}))} /></div>
              <div><label className="form-label">Min Stock</label><input type="number" className="form-input" value={form.minStock} onChange={e => setForm(f => ({...f, minStock: e.target.value}))} /></div>
              <div><label className="form-label">Expiry Date</label><input type="date" className="form-input" value={form.expiryDate} onChange={e => setForm(f => ({...f, expiryDate: e.target.value}))} /></div>
              <div><label className="form-label">Cost Price (Rs.)</label><input type="number" className="form-input" value={form.costPrice} onChange={e => setForm(f => ({...f, costPrice: e.target.value}))} /></div>
              <div><label className="form-label">Selling Price (Rs.)</label><input type="number" className="form-input" value={form.sellingPrice} onChange={e => setForm(f => ({...f, sellingPrice: e.target.value}))} /></div>
              <div><label className="form-label">Supplier</label><input className="form-input" value={form.supplier} onChange={e => setForm(f => ({...f, supplier: e.target.value}))} /></div>
              <div><label className="form-label">Batch No</label><input className="form-input" value={form.batchNo} onChange={e => setForm(f => ({...f, batchNo: e.target.value}))} /></div>
            </div>
            <button onClick={saveItem} className="btn btn-success btn-lg w-full mt-4">{editingId ? 'Update Item' : 'Add Item'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
