'use client';
import { useState, useEffect } from 'react';
import {
  getUltrasoundOrders, updateUltrasoundOrder, searchPatients
} from '@/lib/store';
import type { UltrasoundOrder, Patient } from '@/lib/types';

export default function UltrasoundPage() {
  const [tab, setTab] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [orders, setOrders] = useState<UltrasoundOrder[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Report modals
  const [reportOrder, setReportOrder] = useState<UltrasoundOrder | null>(null);
  const [reportText, setReportText] = useState('');
  const [viewReportOrder, setViewReportOrder] = useState<UltrasoundOrder | null>(null);

  // Patient search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientOrders, setPatientOrders] = useState<UltrasoundOrder[]>([]);

  // Stats
  const [pendingCount, setPendingCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadStats = () => {
    const all = getUltrasoundOrders();
    setPendingCount(all.filter(o => o.status === 'Pending').length);
    setInProgressCount(all.filter(o => o.status === 'In Progress').length);
    setCompletedCount(all.filter(o => o.status === 'Completed').length);
  };

  const loadOrders = () => {
    const all = getUltrasoundOrders();
    let filtered: UltrasoundOrder[];
    if (tab === 'pending') filtered = all.filter(o => o.status === 'Pending');
    else if (tab === 'in-progress') filtered = all.filter(o => o.status === 'In Progress');
    else filtered = all.filter(o => o.status === 'Completed');
    setOrders(filtered);
  };

  useEffect(() => { loadOrders(); loadStats(); }, []);
  useEffect(() => { loadOrders(); loadStats(); }, [tab]);

  // Patient search
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    setSearchResults(searchPatients(q));
  };

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    const all = getUltrasoundOrders().filter(o => o.patientId === p.id);
    setPatientOrders(all);
  };

  const clearPatientSearch = () => {
    setSelectedPatient(null);
    setPatientOrders([]);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Status workflow
  const markInProgress = (order: UltrasoundOrder) => {
    updateUltrasoundOrder(order.id, { status: 'In Progress' });
    showToast(`${order.patientNo} - Ultrasound marked In Progress`, 'success');
    loadOrders(); loadStats();
    if (selectedPatient) setPatientOrders(getUltrasoundOrders().filter(o => o.patientId === selectedPatient.id));
  };

  const openReportEntry = (order: UltrasoundOrder) => {
    setReportOrder(order);
    setReportText(order.report || '');
  };

  const saveReport = () => {
    if (!reportOrder) return;
    if (!reportText.trim()) { showToast('Please enter the ultrasound report', 'error'); return; }
    updateUltrasoundOrder(reportOrder.id, { status: 'Completed', report: reportText.trim() });
    showToast('Ultrasound report saved and marked completed', 'success');
    setReportOrder(null);
    setReportText('');
    loadOrders(); loadStats();
    if (selectedPatient) setPatientOrders(getUltrasoundOrders().filter(o => o.patientId === selectedPatient.id));
  };

  const statusBadge = (status: string) => {
    if (status === 'Pending') return 'badge-amber';
    if (status === 'In Progress') return 'badge-teal';
    return 'badge-green';
  };

  const renderOrderRow = (o: UltrasoundOrder) => (
    <tr key={o.id}>
      <td className="font-mono font-bold text-blue-600">{o.patientNo}</td>
      <td className="font-medium">{o.patientName}</td>
      <td>{o.usgType}</td>
      <td className="font-semibold">Rs. {o.price.toLocaleString()}</td>
      <td className="text-sm">{o.orderedBy}</td>
      <td>{o.date}</td>
      <td>
        <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
      </td>
      <td>
        <div className="flex gap-1">
          {o.status === 'Pending' && (
            <button onClick={() => markInProgress(o)} className="btn btn-primary btn-sm">Start</button>
          )}
          {o.status === 'In Progress' && (
            <button onClick={() => openReportEntry(o)} className="btn btn-success btn-sm">Enter Report</button>
          )}
          {o.status === 'Completed' && o.report && (
            <button onClick={() => setViewReportOrder(o)} className="btn btn-outline btn-sm">View Report</button>
          )}
        </div>
      </td>
    </tr>
  );

  const renderPatientOrder = (o: UltrasoundOrder) => (
    <div key={o.id} className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{o.date}</span>
          <span className="text-sm text-slate-400">by {o.orderedBy}</span>
        </div>
        <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-medium text-slate-700">{o.usgType}</span>
          <span className="ml-2 text-sm font-semibold text-slate-600">Rs. {o.price.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex gap-2">
        {o.status === 'Pending' && (
          <button onClick={() => markInProgress(o)} className="btn btn-primary btn-sm">Start Processing</button>
        )}
        {o.status === 'In Progress' && (
          <button onClick={() => openReportEntry(o)} className="btn btn-success btn-sm">Enter Report</button>
        )}
        {o.status === 'Completed' && o.report && (
          <button onClick={() => setViewReportOrder(o)} className="btn btn-outline btn-sm">View Report</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Ultrasound Department</h2>
          <p className="text-sm text-slate-500">Doctor-ordered ultrasound examinations. Search patient or browse orders.</p>
        </div>
        <button onClick={() => setShowSearch(!showSearch)} className="btn btn-primary">
          {showSearch ? 'Hide Search' : 'Search Patient'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Pending</p>
          <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
        </div>
        <div className="stat-card card-hover border border-teal-200 bg-teal-50">
          <p className="text-xs text-teal-600 font-medium">In Progress</p>
          <p className="text-2xl font-bold text-teal-700">{inProgressCount}</p>
        </div>
        <div className="stat-card card-hover border border-green-200 bg-green-50">
          <p className="text-xs text-green-600 font-medium">Completed</p>
          <p className="text-2xl font-bold text-green-700">{completedCount}</p>
        </div>
      </div>

      {/* Patient Search */}
      {showSearch && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                className="form-input pl-10"
                placeholder="Enter Patient No, Name, or Mobile..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                autoFocus
              />
              <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {selectedPatient && (
              <button onClick={clearPatientSearch} className="btn btn-outline btn-sm">Clear</button>
            )}
          </div>

          {searchResults.length > 0 && !selectedPatient && (
            <div className="mt-2 border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectPatient(p)}
                  className="w-full text-left px-4 py-3 hover:bg-teal-50 border-b border-slate-100 last:border-0 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-blue-600">{p.patientNo}</span>
                      <span className="ml-3 font-medium text-slate-700">{p.name}</span>
                      <span className="ml-3 text-sm text-slate-400">S/O {p.fatherName}</span>
                    </div>
                    <span className="text-sm text-slate-400">{p.mobile}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedPatient && (
            <div className="mt-3 bg-teal-50 border border-teal-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{selectedPatient.name}</p>
                    <p className="text-sm text-slate-500">
                      <span className="font-mono text-blue-600">{selectedPatient.patientNo}</span> | {selectedPatient.gender} | {selectedPatient.age} yrs | {selectedPatient.mobile}
                    </p>
                  </div>
                </div>
                <button onClick={clearPatientSearch} className="btn btn-outline btn-sm">Close</button>
              </div>

              {patientOrders.length > 0 ? (
                <div className="mt-4">
                  <h4 className="font-semibold text-sm text-slate-700 mb-2">Ultrasound Orders ({patientOrders.length})</h4>
                  <div className="space-y-2">
                    {patientOrders.map(renderPatientOrder)}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-center py-4 text-slate-400">
                  Is patient ke liye koi Ultrasound order nahi mila.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Buttons */}
      <div className="flex gap-2">
        <button onClick={() => setTab('pending')} className={`btn ${tab === 'pending' ? 'btn-primary' : 'btn-outline'}`}>
          Pending ({pendingCount})
        </button>
        <button onClick={() => setTab('in-progress')} className={`btn ${tab === 'in-progress' ? 'btn-primary' : 'btn-outline'}`}>
          In Progress ({inProgressCount})
        </button>
        <button onClick={() => setTab('completed')} className={`btn ${tab === 'completed' ? 'btn-primary' : 'btn-outline'}`}>
          Completed ({completedCount})
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient No</th>
                <th>Patient Name</th>
                <th>Ultrasound Type</th>
                <th>Price</th>
                <th>Ordered By</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(renderOrderRow)}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    {tab === 'pending' ? 'Koi pending Ultrasound order nahi' : tab === 'in-progress' ? 'Koi in-progress Ultrasound nahi' : 'Koi completed Ultrasound nahi'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enter Report Modal */}
      {reportOrder && (
        <div className="modal-overlay" onClick={() => { setReportOrder(null); setReportText(''); }}>
          <div className="modal-content" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Enter Ultrasound Report</h3>
                <p className="text-sm text-teal-600">{reportOrder.patientNo} - {reportOrder.patientName}</p>
                <p className="text-xs text-slate-400">
                  {reportOrder.usgType} | Rs. {reportOrder.price.toLocaleString()} | Ordered by {reportOrder.orderedBy} on {reportOrder.date}
                </p>
              </div>
              <button onClick={() => { setReportOrder(null); setReportText(''); }} className="btn btn-outline btn-sm">Close</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label">Ultrasound Report</label>
                <textarea
                  className="form-input"
                  rows={10}
                  placeholder="Enter the ultrasound findings and interpretation here..."
                  value={reportText}
                  onChange={e => setReportText(e.target.value)}
                />
              </div>
              <button onClick={saveReport} className="btn btn-success btn-lg w-full">
                Save Report & Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Report Modal */}
      {viewReportOrder && (
        <div className="modal-overlay" onClick={() => setViewReportOrder(null)}>
          <div className="modal-content" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Ultrasound Report</h3>
                <p className="text-sm text-teal-600">{viewReportOrder.patientNo} - {viewReportOrder.patientName}</p>
                <p className="text-xs text-slate-400">
                  {viewReportOrder.usgType} | Ordered by {viewReportOrder.orderedBy} on {viewReportOrder.date}
                </p>
              </div>
              <button onClick={() => setViewReportOrder(null)} className="btn btn-outline btn-sm">Close</button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewReportOrder.report}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
