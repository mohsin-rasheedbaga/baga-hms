'use client';
import { useState, useEffect } from 'react';
import { getPharmacyExpenses, addPharmacyExpense, updatePharmacyExpense, deletePharmacyExpense, genId, todayStr, getHospitalSettings } from '@/lib/store';
import type { PharmacyExpense } from '@/lib/store';

const CATEGORIES = ['Medicine Purchase', 'Consumables', 'Equipment', 'Maintenance', 'Utilities', 'Salaries', 'Miscellaneous'];
const DATE_FILTERS = ['Today', 'This Week', 'This Month', 'This Year', 'All'] as const;

export default function PharmacyExpensesPage() {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [expenses, setExpenses] = useState<PharmacyExpense[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState<string>('All');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('Rs.');

  const [form, setForm] = useState({ description: '', category: '', amount: '', date: '', notes: '', supplier: '' });

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadData = () => {
    setExpenses(getPharmacyExpenses());
  };

  useEffect(() => {
    loadData();
    const s = getHospitalSettings();
    setCurrency(s.currency);
    setMounted(true);
  }, []);

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" /></div>;

  const categories = [...new Set(expenses.map(e => e.category))];

  const filterByDate = (items: PharmacyExpense[]) => {
    const today = todayStr();
    switch (dateFilter) {
      case 'Today':
        return items.filter(e => e.date === today);
      case 'This Week': {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStr = weekAgo.toISOString().split('T')[0];
        return items.filter(e => e.date >= weekStr);
      }
      case 'This Month':
        return items.filter(e => e.date >= today.substring(0, 7) + '-01');
      case 'This Year':
        return items.filter(e => e.date >= today.substring(0, 4) + '-01-01');
      default:
        return items;
    }
  };

  const dateFiltered = filterByDate(expenses);

  const filtered = dateFiltered.filter(e => {
    const matchCat = catFilter === 'All' || e.category === catFilter;
    const matchSearch = search === '' || e.description.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()) || e.notes.toLowerCase().includes(search.toLowerCase()) || e.supplier.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const totalExpenses = dateFiltered.reduce((s, e) => s + e.amount, 0);
  const thisMonth = expenses.filter(e => e.date >= todayStr().substring(0, 7) + '-01').reduce((s, e) => s + e.amount, 0);
  const catCount = categories.length;
  const avgExpense = dateFiltered.length > 0 ? Math.round(totalExpenses / dateFiltered.length) : 0;

  const openAddModal = () => {
    setEditingId(null);
    setForm({ description: '', category: CATEGORIES[0], amount: '', date: todayStr(), notes: '', supplier: '' });
    setShowModal(true);
  };

  const openEditModal = (item: PharmacyExpense) => {
    setEditingId(item.id);
    setForm({ description: item.description, category: item.category, amount: String(item.amount), date: item.date, notes: item.notes, supplier: item.supplier });
    setShowModal(true);
  };

  const saveExpense = () => {
    if (!form.description.trim() || !form.category.trim() || !form.amount.trim() || !form.date.trim()) {
      showToast('Description, Category, Amount and Date are required', 'error');
      return;
    }
    const data = {
      description: form.description.trim(),
      category: form.category.trim(),
      amount: parseFloat(form.amount) || 0,
      date: form.date,
      notes: form.notes.trim(),
      supplier: form.supplier.trim(),
    };
    if (editingId) {
      updatePharmacyExpense(editingId, data);
      showToast('Expense updated', 'success');
    } else {
      addPharmacyExpense({ id: genId(), ...data });
      showToast('Expense added', 'success');
    }
    setShowModal(false);
    loadData();
  };

  const removeExpense = (id: string) => {
    if (confirm('Delete this expense?')) {
      deletePharmacyExpense(id);
      loadData();
      showToast('Expense deleted', 'success');
    }
  };

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Expenses</h2>
          <p className="text-sm text-slate-500">Track and manage pharmacy expenses</p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary">+ Add Expense</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Total Expenses</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{currency} {totalExpenses.toLocaleString()}</p>
        </div>
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">This Month</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{currency} {thisMonth.toLocaleString()}</p>
        </div>
        <div className="stat-card card-hover border border-teal-200 bg-teal-50">
          <p className="text-xs text-teal-600 uppercase tracking-wide font-semibold">Categories</p>
          <p className="text-2xl font-bold text-teal-700 mt-1">{catCount}</p>
        </div>
        <div className="stat-card card-hover border border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Average</p>
          <p className="text-2xl font-bold text-slate-700 mt-1">{currency} {avgExpense.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <input type="text" className="form-input pl-10" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <div className="flex flex-wrap gap-2">
          {DATE_FILTERS.map(df => (
            <button key={df} onClick={() => setDateFilter(df)} className={`btn btn-sm ${dateFilter === df ? 'btn-primary' : 'btn-outline'}`}>{df}</button>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCatFilter('All')} className={`btn btn-sm ${catFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}>All</button>
        {CATEGORIES.filter(c => categories.includes(c)).map(c => (
          <button key={c} onClick={() => setCatFilter(c)} className={`btn btn-sm ${catFilter === c ? 'btn-primary' : 'btn-outline'}`}>{c}</button>
        ))}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Supplier</th><th>Notes</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr key={item.id}>
                  <td className="text-sm text-slate-500">{idx + 1}</td>
                  <td className="text-sm">{item.date}</td>
                  <td className="font-medium">{item.description}</td>
                  <td><span className="badge badge-amber">{item.category}</span></td>
                  <td className="font-bold text-amber-700">{currency} {item.amount.toLocaleString()}</td>
                  <td className="text-sm text-slate-600">{item.supplier || '—'}</td>
                  <td className="text-sm text-slate-500 max-w-36 truncate">{item.notes || '—'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEditModal(item)} className="btn btn-outline btn-sm">Edit</button>
                      <button onClick={() => removeExpense(item.id)} className="btn btn-danger btn-sm">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">No expenses found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editingId ? 'Edit Expense' : 'Add New Expense'}</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-outline btn-sm">Close</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label">Description *</label>
                <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Monthly medicine stock" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Category *</label>
                  <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Amount ({currency}) *</label>
                  <input type="number" className="form-input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" min={0} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Supplier</label>
                  <input className="form-input" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="e.g. MediPharm Co." />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
              </div>
              <button onClick={saveExpense} className="btn btn-success btn-lg w-full">{editingId ? 'Update Expense' : 'Add Expense'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
