'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initLabData, getLabOrders, addLabOrder, updateLabOrder, getActiveLabTests, genId, nowTime, todayStr, type LabOrderItem } from '@/lib/lab-store';

export default function TestOrdersPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<LabOrderItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [catalog, setCatalog] = useState(getActiveLabTests());

  // New order form
  const [formPatient, setFormPatient] = useState({ name: '', no: '', mobile: '', gender: 'Male', age: '' });
  const [formTests, setFormTests] = useState<{ testId: string; name: string; price: number; selected: boolean }[]>([]);
  const [formUrgency, setFormUrgency] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [formDoctor, setFormDoctor] = useState('');
  const [formSampleType, setFormSampleType] = useState('Blood');

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadData = () => {
    setOrders(getLabOrders());
    setCatalog(getActiveLabTests());
  };

  useEffect(() => { initLabData(); loadData(); setMounted(true); }, []);

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>;

  const filteredOrders = orders.filter(o => {
    const matchTab = tab === 'all' || o.status === tab;
    const matchSearch = search === '' || o.patientName.toLowerCase().includes(search.toLowerCase()) || o.patientNo.toLowerCase().includes(search.toLowerCase()) || o.patientId.includes(search);
    return matchTab && matchSearch;
  });

  const counts = {
    all: orders.length,
    ordered: orders.filter(o => o.status === 'ordered').length,
    collected: orders.filter(o => o.status === 'collected').length,
    processing: orders.filter(o => o.status === 'processing').length,
    completed: orders.filter(o => o.status === 'completed').length,
  };

  const openNewOrder = () => {
    setFormPatient({ name: '', no: '', mobile: '', gender: 'Male', age: '' });
    setFormTests(catalog.map(t => ({ testId: t.id, name: t.name, price: t.price, selected: false })));
    setFormUrgency('routine');
    setFormDoctor('');
    setFormSampleType('Blood');
    setShowModal(true);
  };

  const toggleTestSelection = (idx: number) => {
    const updated = [...formTests];
    updated[idx].selected = !updated[idx].selected;
    setFormTests(updated);
  };

  const createOrder = () => {
    if (!formPatient.name.trim() || !formPatient.no.trim()) { showToast('Patient name and ID required', 'error'); return; }
    const selectedTests = formTests.filter(t => t.selected);
    if (selectedTests.length === 0) { showToast('Select at least one test', 'error'); return; }
    if (!formDoctor.trim()) { showToast('Ordering doctor required', 'error'); return; }

    const totalAmount = selectedTests.reduce((s, t) => s + t.price, 0);
    const order: LabOrderItem = {
      id: genId(),
      visitId: '',
      patientId: genId(),
      patientNo: formPatient.no,
      patientName: formPatient.name,
      gender: formPatient.gender,
      age: formPatient.age,
      tests: selectedTests.map(t => ({ testName: t.name, testId: t.testId, price: t.price })),
      orderedBy: formDoctor,
      urgency: formUrgency,
      sampleType: formSampleType,
      status: 'ordered',
      date: todayStr(),
      time: nowTime(),
      results: [],
      totalAmount,
      paidAmount: 0,
      paymentStatus: 'unpaid',
    };
    addLabOrder(order);
    setShowModal(false);
    loadData();
    showToast('Order created successfully', 'success');
  };

  const collectSample = (order: LabOrderItem) => {
    updateLabOrder(order.id, { status: 'collected', collectedAt: nowTime(), collectedBy: 'Lab Tech' });
    loadData();
    showToast(`Sample collected for ${order.patientName}`, 'success');
  };

  const statusColor = (s: string) => s === 'ordered' ? 'badge-amber' : s === 'collected' ? 'badge-blue' : s === 'processing' ? 'badge-purple' : 'badge-green';
  const urgencyColor = (u: string) => u === 'stat' ? 'badge-rose' : u === 'urgent' ? 'badge-amber' : 'badge-slate';

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Test Orders</h2>
          <p className="text-sm text-slate-500">Manage and create lab test orders</p>
        </div>
        <button onClick={openNewOrder} className="btn btn-primary">+ New Order</button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'ordered', 'collected', 'processing', 'completed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-outline'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <input type="text" className="form-input pl-10" placeholder="Search by patient name, ID, mobile..." value={search} onChange={e => setSearch(e.target.value)} />
        <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Patient</th><th>Tests</th><th>Doctor</th><th>Urgency</th><th>Payment</th><th>Status</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filteredOrders.map(o => (
                <tr key={o.id}>
                  <td>
                    <span className="font-mono font-bold text-blue-600 text-xs">{o.patientNo}</span>
                    <div className="font-medium">{o.patientName}</div>
                    <div className="text-xs text-slate-400">{o.gender} / {o.age}</div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">{o.tests.map((t,i) => <span key={i} className="badge badge-blue text-xs">{t.testName}</span>)}</div>
                    <div className="text-xs text-slate-500 mt-1 font-semibold">Rs. {o.totalAmount.toLocaleString()}</div>
                  </td>
                  <td className="text-sm">{o.orderedBy}</td>
                  <td><span className={`badge ${urgencyColor(o.urgency)}`}>{o.urgency.toUpperCase()}</span></td>
                  <td><span className={`badge ${o.paymentStatus === 'paid' ? 'badge-green' : o.paymentStatus === 'partial' ? 'badge-amber' : 'badge-rose'}`}>{o.paymentStatus.toUpperCase()}</span></td>
                  <td><span className={`badge ${statusColor(o.status)}`}>{o.status.charAt(0).toUpperCase() + o.status.slice(1)}</span></td>
                  <td className="text-sm text-slate-500">{o.date}<br />{o.time}</td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {o.status === 'ordered' && <button onClick={() => collectSample(o)} className="btn btn-primary btn-sm">Collect</button>}
                      {o.status === 'collected' && <button onClick={() => { updateLabOrder(o.id, { status: 'processing' }); loadData(); showToast('Sent to processing', 'success'); }} className="btn btn-primary btn-sm">Process</button>}
                      {o.status === 'completed' && <button onClick={() => router.push('/lab/reports')} className="btn btn-outline btn-sm">View</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">No orders found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Order Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">New Test Order</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-outline btn-sm">Close</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label">Patient Name *</label><input className="form-input" value={formPatient.name} onChange={e => setFormPatient(p => ({...p, name: e.target.value}))} placeholder="Full Name" /></div>
                <div><label className="form-label">Patient No *</label><input className="form-input" value={formPatient.no} onChange={e => setFormPatient(p => ({...p, no: e.target.value}))} placeholder="e.g. BAGA-0001" /></div>
                <div><label className="form-label">Mobile</label><input className="form-input" value={formPatient.mobile} onChange={e => setFormPatient(p => ({...p, mobile: e.target.value}))} placeholder="03xx-xxxxxxx" /></div>
                <div><label className="form-label">Age</label><input className="form-input" value={formPatient.age} onChange={e => setFormPatient(p => ({...p, age: e.target.value}))} placeholder="e.g. 35" /></div>
                <div>
                  <label className="form-label">Gender</label>
                  <select className="form-input" value={formPatient.gender} onChange={e => setFormPatient(p => ({...p, gender: e.target.value}))}>
                    <option>Male</option><option>Female</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Ordered By *</label>
                  <input className="form-input" value={formDoctor} onChange={e => setFormDoctor(e.target.value)} placeholder="Doctor name" />
                </div>
                <div>
                  <label className="form-label">Urgency</label>
                  <select className="form-input" value={formUrgency} onChange={e => setFormUrgency(e.target.value as 'routine' | 'urgent' | 'stat')}>
                    <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Sample Type</label>
                  <select className="form-input" value={formSampleType} onChange={e => setFormSampleType(e.target.value)}>
                    <option>Blood</option><option>Urine</option><option>Stool</option><option>Serum</option><option>Plasma</option><option>CSF</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Select Tests *</label>
                <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                  {formTests.map((t, i) => (
                    <label key={i} className={`flex items-center justify-between px-3 py-2 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${t.selected ? 'bg-teal-50' : ''}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={t.selected} onChange={() => toggleTestSelection(i)} />
                        <span className="text-sm font-medium">{t.name}</span>
                      </div>
                      <span className="text-sm text-slate-500">Rs. {t.price}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Total: <span className="font-bold text-emerald-600">Rs. {formTests.filter(t => t.selected).reduce((s, t) => s + t.price, 0).toLocaleString()}</span>
                </div>
              </div>

              <button onClick={createOrder} className="btn btn-success btn-lg w-full">Create Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
