'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getXRayOrders, updateXRayOrder, searchPatients
} from '@/lib/store';
import type { XRayOrder, Patient } from '@/lib/types';

export default function XrayPage() {
  const [tab, setTab] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [orders, setOrders] = useState<XRayOrder[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Report modals
  const [reportOrder, setReportOrder] = useState<XRayOrder | null>(null);
  const [reportText, setReportText] = useState('');
  const [viewReportOrder, setViewReportOrder] = useState<XRayOrder | null>(null);

  // Patient search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientOrders, setPatientOrders] = useState<XRayOrder[]>([]);

  // Stats
  const [pendingCount, setPendingCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  // Upload & Image Viewer state
  const [uploadOrderId, setUploadOrderId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imageViewerOrder, setImageViewerOrder] = useState<XRayOrder | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageBrightness, setImageBrightness] = useState(100);
  const [imageContrast, setImageContrast] = useState(100);
  const [imageInvert, setImageInvert] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadStats = () => {
    const all = getXRayOrders();
    setPendingCount(all.filter(o => o.status === 'Pending').length);
    setInProgressCount(all.filter(o => o.status === 'In Progress').length);
    setCompletedCount(all.filter(o => o.status === 'Completed').length);
  };

  const loadOrders = () => {
    const all = getXRayOrders();
    let filtered: XRayOrder[];
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
    const all = getXRayOrders().filter(o => o.patientId === p.id);
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
  const markInProgress = (order: XRayOrder) => {
    updateXRayOrder(order.id, { status: 'In Progress' });
    showToast(`${order.patientNo} - X-Ray marked In Progress`, 'success');
    loadOrders(); loadStats();
    if (selectedPatient) setPatientOrders(getXRayOrders().filter(o => o.patientId === selectedPatient.id));
  };

  const openReportEntry = (order: XRayOrder) => {
    setReportOrder(order);
    setReportText(order.report || '');
  };

  const saveReport = () => {
    if (!reportOrder) return;
    if (!reportText.trim()) { showToast('Please enter the radiologist report', 'error'); return; }
    updateXRayOrder(reportOrder.id, { status: 'Completed', report: reportText.trim() });
    showToast('X-Ray report saved and marked completed', 'success');
    setReportOrder(null);
    setReportText('');
    loadOrders(); loadStats();
    if (selectedPatient) setPatientOrders(getXRayOrders().filter(o => o.patientId === selectedPatient.id));
  };

  // Upload handler
  const handleUploadClick = (orderId: string) => {
    setUploadOrderId(orderId);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadOrderId) return;
    if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) {
      showToast('Only JPG, JPEG, PNG files are allowed','error'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('File must be under 5MB','error'); return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      updateXRayOrder(uploadOrderId, { xrayImage: base64 });
      setIsUploading(false);
      setUploadOrderId(null);
      loadOrders(); loadStats();
      showToast('X-Ray image uploaded successfully!','success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Image viewer wheel zoom
  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setImageZoom(prev => Math.min(Math.max(prev - e.deltaY * 0.005, 0.1), 10));
  }, []);

  const resetImageViewer = () => {
    setImageZoom(1); setImageRotation(0); setImageBrightness(100); setImageContrast(100); setImageInvert(false);
  };

  const statusBadge = (status: string) => {
    if (status === 'Pending') return 'badge-amber';
    if (status === 'In Progress') return 'badge-blue';
    return 'badge-green';
  };

  const renderOrderRow = (o: XRayOrder) => (
    <tr key={o.id}>
      <td className="font-mono font-bold text-blue-600">{o.patientNo}</td>
      <td className="font-medium">{o.patientName}</td>
      <td>{o.xrayType}</td>
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
          {o.status === 'In Progress' && (
            <button onClick={() => handleUploadClick(o.id)} className="btn btn-outline btn-sm" disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload X-Ray'}
            </button>
          )}
          {o.status === 'Completed' && o.report && (
            <button onClick={() => setViewReportOrder(o)} className="btn btn-outline btn-sm">View Report</button>
          )}
          {o.status === 'Completed' && o.xrayImage && (
            <button onClick={() => setImageViewerOrder(o)} className="btn btn-outline btn-sm">View X-Ray</button>
          )}
        </div>
      </td>
    </tr>
  );

  const renderPatientOrder = (o: XRayOrder) => (
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
          <span className="font-medium text-slate-700">{o.xrayType}</span>
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
        {o.status === 'In Progress' && (
          <button onClick={() => handleUploadClick(o.id)} className="btn btn-outline btn-sm" disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Upload X-Ray'}
          </button>
        )}
        {o.status === 'Completed' && o.report && (
          <button onClick={() => setViewReportOrder(o)} className="btn btn-outline btn-sm">View Report</button>
        )}
        {o.status === 'Completed' && o.xrayImage && (
          <button onClick={() => setImageViewerOrder(o)} className="btn btn-outline btn-sm">View X-Ray</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}
      <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">X-Ray Department</h2>
          <p className="text-sm text-slate-500">Doctor-ordered X-Ray examinations. Search patient or browse orders.</p>
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
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">In Progress</p>
          <p className="text-2xl font-bold text-blue-700">{inProgressCount}</p>
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
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors"
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
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
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
                  <h4 className="font-semibold text-sm text-slate-700 mb-2">X-Ray Orders ({patientOrders.length})</h4>
                  <div className="space-y-2">
                    {patientOrders.map(renderPatientOrder)}
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-center py-4 text-slate-400">
                  Is patient ke liye koi X-Ray order nahi mila.
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
                <th>X-Ray Type</th>
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
                    {tab === 'pending' ? 'Koi pending X-Ray order nahi' : tab === 'in-progress' ? 'Koi in-progress X-Ray nahi' : 'Koi completed X-Ray nahi'}
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
                <h3 className="text-lg font-bold">Enter X-Ray Report</h3>
                <p className="text-sm text-blue-600">{reportOrder.patientNo} - {reportOrder.patientName}</p>
                <p className="text-xs text-slate-400">
                  {reportOrder.xrayType} | Rs. {reportOrder.price.toLocaleString()} | Ordered by {reportOrder.orderedBy} on {reportOrder.date}
                </p>
              </div>
              <button onClick={() => { setReportOrder(null); setReportText(''); }} className="btn btn-outline btn-sm">Close</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label">Radiologist Report</label>
                <textarea
                  className="form-input"
                  rows={10}
                  placeholder="Enter the radiologist findings and interpretation here..."
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

      {/* Image Viewer Modal */}
      {imageViewerOrder && imageViewerOrder.xrayImage && (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col" onWheel={handleWheelZoom}>
          {/* Top Bar */}
          <div className="flex items-center justify-between p-3 bg-slate-900 text-white">
            <div>
              <h3 className="font-bold">X-Ray Viewer — {imageViewerOrder.patientName}</h3>
              <p className="text-xs text-slate-400">{imageViewerOrder.xrayType} | {imageViewerOrder.date} | {imageViewerOrder.orderedBy}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-slate-700 px-2 py-1 rounded">{Math.round(imageZoom * 100)}%</span>
              <button onClick={() => setImageViewerOrder(null)} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm font-medium">Close</button>
            </div>
          </div>

          {/* Image Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center bg-black p-4 cursor-grab" style={{minHeight:0}}>
            <img
              src={imageViewerOrder.xrayImage}
              alt="X-Ray"
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                filter: `brightness(${imageBrightness}%) contrast(${imageContrast}%) ${imageInvert ? 'invert(1)' : ''}`,
                transition: 'transform 0.1s ease',
              }}
              draggable={false}
            />
          </div>

          {/* Controls Bar */}
          <div className="bg-slate-900 text-white p-3 border-t border-slate-700">
            <div className="flex flex-wrap items-center gap-3 max-w-5xl mx-auto">
              {/* Zoom */}
              <div className="flex items-center gap-1">
                <button onClick={() => setImageZoom(z => Math.min(z + 0.25, 10))} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm font-bold">+</button>
                <button onClick={() => setImageZoom(z => Math.max(z - 0.25, 0.1))} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm font-bold">-</button>
                <button onClick={resetImageViewer} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">Reset</button>
                <button onClick={() => setImageZoom(1)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">Fit</button>
              </div>
              <div className="w-px h-6 bg-slate-600" />
              {/* Rotate */}
              <div className="flex items-center gap-1">
                <button onClick={() => setImageRotation(r => r - 90)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm" title="Rotate Left">↺</button>
                <button onClick={() => setImageRotation(r => r + 90)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm" title="Rotate Right">↻</button>
              </div>
              <div className="w-px h-6 bg-slate-600" />
              {/* Brightness */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Brightness</label>
                <input type="range" min="20" max="300" value={imageBrightness} onChange={e => setImageBrightness(Number(e.target.value))} className="w-20 accent-slate-300" />
                <span className="text-xs w-8">{imageBrightness}%</span>
              </div>
              {/* Contrast */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Contrast</label>
                <input type="range" min="20" max="300" value={imageContrast} onChange={e => setImageContrast(Number(e.target.value))} className="w-20 accent-slate-300" />
                <span className="text-xs w-8">{imageContrast}%</span>
              </div>
              <div className="w-px h-6 bg-slate-600" />
              {/* Invert */}
              <button onClick={() => setImageInvert(v => !v)} className={`px-2 py-1 rounded text-sm font-medium ${imageInvert ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
                Invert {imageInvert ? 'ON' : 'OFF'}
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
                <h3 className="text-lg font-bold">X-Ray Report</h3>
                <p className="text-sm text-blue-600">{viewReportOrder.patientNo} - {viewReportOrder.patientName}</p>
                <p className="text-xs text-slate-400">
                  {viewReportOrder.xrayType} | Ordered by {viewReportOrder.orderedBy} on {viewReportOrder.date}
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
