'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initLabData, getLabOrders, addLabOrder, updateLabOrder, getActiveLabTests, genId, nowTime, todayStr, type LabOrderItem } from '@/lib/lab-store';
import { dbGetCounter, dbSetCounter, getSession } from '@/lib/db-bridge';
import { generateOrderSlipHtml, getLabPrintDataAsync } from '@/lib/print-lab-report';
import { triggerPrint } from '@/lib/print-utils';
import { getHospitalSettings } from '@/lib/store';

export default function TestOrdersPage() {
  const router = useRouter();
  // Permission check helper
  const session = getSession();
  const userPermissions: string[] = session?.permissions || [];
  const hasPermission = (perm: string): boolean => {
    if (userPermissions.includes('all')) return true;
    if (session?.userId === 'baga-master-admin' || session?.userId === 'demo-admin') return true;
    return userPermissions.includes(perm);
  };
  const canEditOrder = hasPermission('edit_lab_order');
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<LabOrderItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editOrder, setEditOrder] = useState<LabOrderItem | null>(null);
  const [editPatientName, setEditPatientName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editGender, setEditGender] = useState('');
  const [orderSummary, setOrderSummary] = useState<LabOrderItem | null>(null);
  const [slipHtml, setSlipHtml] = useState('');
  const [showSlipPreview, setShowSlipPreview] = useState(false);
  const [catalog, setCatalog] = useState(getActiveLabTests());

  // New order form
  const [formPatient, setFormPatient] = useState({ name: '', no: '', mobile: '', gender: 'Male', age: '' });
  const [autoPatientNo, setAutoPatientNo] = useState('');

  const getNextPatientNo = (): string => {
    const counter = dbGetCounter('lab_patient_counter');
    const nextVal = (counter ?? 0) + 1;
    dbSetCounter('lab_patient_counter', nextVal);
    return 'LAB-' + String(nextVal).padStart(4, '0');
  };
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

  const settings = getHospitalSettings(); const curr = settings?.currency || 'Rs.';
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
    const newPatientNo = getNextPatientNo();
    setAutoPatientNo(newPatientNo);
    setFormPatient({ name: '', no: newPatientNo, mobile: '', gender: 'Male', age: '' });
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

  const createOrder = async () => {
    if (!formPatient.name.trim()) { showToast('Patient name required', 'error'); return; }
    const selectedTests = formTests.filter(t => t.selected);
    if (selectedTests.length === 0) { showToast('Select at least one test', 'error'); return; }
    if (!formDoctor.trim()) { showToast('Ordering doctor required', 'error'); return; }

    const totalAmount = selectedTests.reduce((s, t) => s + t.price, 0);
    const order: LabOrderItem = {
      id: genId(),
      visitId: '',
      patientId: genId(),
      patientNo: autoPatientNo || formPatient.no,
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

    // Generate slip HTML for preview
    try {
      const printData = await getLabPrintDataAsync();
      const slipData = {
        patientNo: order.patientNo,
        patientName: order.patientName,
        age: order.age,
        gender: order.gender,
        mobile: formPatient.mobile,
        tests: order.tests.map(t => ({ testName: t.testName, price: t.price })),
        urgency: order.urgency,
        orderedBy: order.orderedBy,
        sampleType: order.sampleType,
        totalAmount: order.totalAmount,
        date: order.date,
        time: order.time,
        hospitalName: printData.hospitalName,
        hospitalAddress: printData.hospitalAddress,
        hospitalPhone: printData.hospitalPhone,
        hospitalMobile: printData.hospitalMobile,
        hospitalEmail: printData.hospitalEmail,
        hospitalLogo: printData.hospitalLogo,
      };
      setSlipHtml(generateOrderSlipHtml(slipData));
      setShowSlipPreview(true);
    } catch (err) {
      console.error('Failed to generate slip preview:', err);
    }

    // Show order summary modal (print on user click, not auto-print)
    setOrderSummary(order);
  };

  const printOrderSlip = async (order: LabOrderItem) => {
    try {
      const printData = await getLabPrintDataAsync();
      const slipHtml = generateOrderSlipHtml({
        patientNo: order.patientNo,
        patientName: order.patientName,
        age: order.age,
        gender: order.gender,
        mobile: formPatient.mobile || '',
        tests: order.tests,
        urgency: order.urgency,
        orderedBy: order.orderedBy,
        sampleType: order.sampleType,
        totalAmount: order.totalAmount,
        date: order.date,
        time: order.time,
        hospitalName: printData.hospitalName,
        hospitalAddress: printData.hospitalAddress,
        hospitalPhone: printData.hospitalPhone,
        hospitalMobile: printData.hospitalMobile,
        hospitalEmail: printData.hospitalEmail,
        hospitalLogo: printData.hospitalLogo,
      });
      triggerPrint(slipHtml);
    } catch (err) {
      console.error('Failed to print order slip:', err);
    }
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
                    <div className="text-xs text-slate-500 mt-1 font-semibold">{curr} {o.totalAmount.toLocaleString()}</div>
                  </td>
                  <td className="text-sm">{o.orderedBy}</td>
                  <td><span className={`badge ${urgencyColor(o.urgency)}`}>{o.urgency.toUpperCase()}</span></td>
                  <td><span className={`badge ${o.paymentStatus === 'paid' ? 'badge-green' : o.paymentStatus === 'partial' ? 'badge-amber' : 'badge-rose'}`}>{o.paymentStatus.toUpperCase()}</span></td>
                  <td><span className={`badge ${statusColor(o.status)}`}>{o.status.charAt(0).toUpperCase() + o.status.slice(1)}</span></td>
                  <td className="text-sm text-slate-500">{o.date}<br />{o.time}</td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {o.status === 'collected' && <button onClick={() => { updateLabOrder(o.id, { status: 'processing' }); loadData(); showToast('Sent to processing', 'success'); }} className="btn btn-primary btn-sm">Process</button>}
                      {o.status === 'completed' && <button onClick={() => router.push('/lab/reports')} className="btn btn-outline btn-sm">View</button>}
                      {canEditOrder && <button onClick={() => { setEditOrder(o); setEditPatientName(o.patientName); setEditMobile(o.mobile || ''); setEditAge(o.age || ''); setEditGender(o.gender || ''); setShowEditModal(true); }} className="btn btn-outline btn-sm" title="Edit patient details">✏️ Edit</button>}
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
                <div>
                  <label className="form-label">Patient No (Auto)</label>
                  <input className="form-input bg-slate-100 text-blue-700 font-bold font-mono cursor-not-allowed" value={autoPatientNo} readOnly tabIndex={-1} />
                </div>
                <div><label className="form-label">Mobile</label><input className="form-input" maxLength={11} inputMode="numeric" pattern="[0-9]{0,11}" value={formPatient.mobile.replace(/[^0-9]/g,'')} onChange={e => setFormPatient(p => ({...p, mobile: e.target.value.replace(/[^0-9]/g,'')}))} placeholder="03xxxxxxxxx" /></div>
                <div><label className="form-label">Age</label><input className="form-input" maxLength={2} inputMode="numeric" value={formPatient.age.replace(/[^0-9]/g,'')} onChange={e => setFormPatient(p => ({...p, age: e.target.value.replace(/[^0-9]/g,'')}))} placeholder="e.g. 35" /></div>
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
                      <span className="text-sm text-slate-500">{curr} {t.price}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Total: <span className="font-bold text-emerald-600">{curr} {formTests.filter(t => t.selected).reduce((s, t) => s + t.price, 0).toLocaleString()}</span>
                </div>
              </div>

              <button onClick={createOrder} className="btn btn-success btn-lg w-full">Create Order</button>
            </div>
          </div>
        </div>
      )}

      {/* Order Summary Modal — shows only the receipt, no duplicate summary */}
      {orderSummary && (
        <div className="modal-overlay" onClick={() => { setShowSlipPreview(false); setSlipHtml(''); setOrderSummary(null); }}>
          <div className="modal-content" style={{ maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Order Created Successfully</h3>
              <button onClick={() => { setShowSlipPreview(false); setSlipHtml(''); setOrderSummary(null); }} className="btn btn-outline btn-sm">Close</button>
            </div>
            {/* Only show the receipt slip — no duplicate summary table */}
            {showSlipPreview && <iframe srcDoc={slipHtml} style={{width:'100%',height:'500px',border:'1px solid #e2e8f0',borderRadius:'8px',marginBottom:'12px'}} />}
            <div className="flex gap-2">
              <button onClick={() => { triggerPrint(slipHtml); }} className="btn btn-primary flex-1">Print Slip</button>
              <button onClick={() => { setShowSlipPreview(false); setSlipHtml(''); setOrderSummary(null); }} className="btn btn-outline flex-1">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {showEditModal && editOrder && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Edit Patient Details</h3>
              <button onClick={() => setShowEditModal(false)} className="btn btn-outline btn-sm">Close</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="form-label">Patient Name</label>
                <input className="form-input" value={editPatientName} onChange={e => setEditPatientName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Mobile</label>
                <input className="form-input" value={editMobile} onChange={e => setEditMobile(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Age</label>
                  <input className="form-input" value={editAge} onChange={e => setEditAge(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select className="form-input" value={editGender} onChange={e => setEditGender(e.target.value)}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <button onClick={() => {
                updateLabOrder(editOrder.id, {
                  patientName: editPatientName.trim(),
                  mobile: editMobile.trim(),
                  age: editAge.trim(),
                  gender: editGender,
                });
                loadData();
                setShowEditModal(false);
                showToast('Order updated successfully', 'success');
              }} className="btn btn-primary w-full">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
