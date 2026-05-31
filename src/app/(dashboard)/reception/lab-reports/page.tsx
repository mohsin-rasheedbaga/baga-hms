'use client';
import { useState, useEffect } from 'react';
import { searchPatients, getPatientByNo, getXRayOrders, getUltrasoundOrders, getHospital } from '@/lib/store';
import type { Patient, XRayOrder, UltrasoundOrder } from '@/lib/types';
import { initLabData, getLabOrders as getLisLabOrders, type LabOrderItem } from '@/lib/lab-store';
import { generateProfessionalLabReportHtml, getLabPrintData, openPrintWindow } from '@/lib/print-lab-report';

export default function ReceptionLabReportsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [labOrders, setLabOrders] = useState<LabOrderItem[]>([]);
  const [xrayOrders, setXrayOrders] = useState<XRayOrder[]>([]);
  const [usgOrders, setUsgOrders] = useState<UltrasoundOrder[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [hospitalName, setHospitalName] = useState('BAGA Hospital');
  const [session, setSession] = useState<{ userId: string; name: string; role: string; department: string } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    try {
      initLabData();
      const h = getHospital();
      setHospitalName(h.name);
      const s = localStorage.getItem('baga_session');
      if (s) setSession(JSON.parse(s));
    } catch {}

    // Auto-refresh: listen for lab updates from other pages/tabs
    const handleLabUpdate = () => {
      initLabData();
      if (selectedPatient) {
        setLabOrders(getLisLabOrders().filter(o => o.patientId === selectedPatient.id || o.patientNo === selectedPatient.patientNo));
      }
    };
    window.addEventListener('baga_lab_update', handleLabUpdate);
    window.addEventListener('storage', handleLabUpdate);
    const interval = setInterval(handleLabUpdate, 3000);

    return () => {
      window.removeEventListener('baga_lab_update', handleLabUpdate);
      window.removeEventListener('storage', handleLabUpdate);
      clearInterval(interval);
    };
  }, [selectedPatient]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const r = searchPatients(searchQuery.trim());
    const byNo = getPatientByNo(searchQuery.trim());
    if (byNo && !r.find(x => x.id === byNo.id)) r.unshift(byNo);
    setSearchResults(r);
  };

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setSearchResults([]);
    setSearchQuery('');
    initLabData();
    setLabOrders(getLisLabOrders().filter(o => o.patientId === p.id || o.patientNo === p.patientNo));
    setXrayOrders(getXRayOrders().filter(o => o.patientId === p.id));
    setUsgOrders(getUltrasoundOrders().filter(o => o.patientId === p.id));
  };

  const clearPatient = () => {
    setSelectedPatient(null);
    setLabOrders([]);
    setXrayOrders([]);
    setUsgOrders([]);
  };

  // ===== DIRECT PRINT FUNCTIONS (same format as Doctor page) =====

  const printLabReport = (lisOrder: LabOrderItem) => {
    if (!selectedPatient) return;
    const printData = getLabPrintData();
    const html = generateProfessionalLabReportHtml({
      patientName: selectedPatient.name,
      patientNo: selectedPatient.patientNo,
      age: selectedPatient.age,
      gender: selectedPatient.gender,
      sampleType: lisOrder.sampleType,
      orderedBy: lisOrder.orderedBy,
      date: lisOrder.date,
      time: lisOrder.time || '',
      orderId: lisOrder.id,
      collectedAt: lisOrder.collectedAt,
      completedAt: lisOrder.completedAt,
      results: lisOrder.results,
      techName: printData.techName,
      reportDocHtml: printData.reportDocHtml,
      hospitalName: printData.hospitalName,
      hospitalAddress: printData.hospitalAddress,
      hospitalPhone: printData.hospitalPhone,
    });
    openPrintWindow(html, true);
  };

  const printXRayReport = (o: XRayOrder) => {
    if (!selectedPatient) return;
    const html = `<!DOCTYPE html><html><head><title>X-Ray Report - ${selectedPatient.name}</title><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,Helvetica,sans-serif;color:#222;background:#fff;}
      @page{size:A4;margin:15mm;}
      .report{width:100%;max-width:700px;margin:0 auto;padding:2px;}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px double #333;padding-bottom:6px;margin-bottom:8px;}
      .header h1{font-size:16px;letter-spacing:1px;margin:0;color:#111;}
      .header .sub{font-size:9px;color:#555;}
      .header .rid{font-size:9px;color:#888;text-align:right;}
      .patient-bar{display:flex;justify-content:space-between;background:#f0f0f0;padding:5px 8px;border:1px solid #ccc;border-radius:3px;margin-bottom:10px;font-size:11px;flex-wrap:wrap;gap:2px;}
      .patient-bar span{white-space:nowrap;} .patient-bar b{color:#111;}
      .report-text{background:#fafafa;border:1px solid #ddd;border-radius:4px;padding:12px 15px;margin:10px 0;white-space:pre-wrap;line-height:1.8;font-size:12px;min-height:120px;}
      .footer{margin-top:20px;padding-top:6px;border-top:1px solid #999;display:flex;justify-content:space-between;font-size:9px;color:#666;}
      .sig-area{margin-top:25px;display:flex;justify-content:space-between;}
      .sig-box{text-align:center;width:180px;}
      .sig-line{border-top:1px solid #333;margin-top:50px;padding-top:3px;font-size:10px;}
      .print-btn{position:fixed;top:10px;right:10px;padding:8px 20px;background:#1a73e8;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:bold;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:999;}
      .print-btn:hover{background:#1557b0;}
      @media print{.print-btn{display:none!important;}body{background:#fff;}@page{margin:10mm;}}
    </style></head><body>
      <button class="print-btn" onclick="window.print()">Print Report</button>
      <div class="report">
        <div class="header">
          <div><h1>${hospitalName.toUpperCase()}</h1><div class="sub">RADIOLOGY DEPARTMENT - X-RAY REPORT</div></div>
          <div class="rid">Report ID: ${o.id.slice(-6)}<br/>Date: ${o.date}</div>
        </div>
        <div class="patient-bar">
          <span><b>Patient:</b> ${selectedPatient.name}</span>
          <span><b>ID:</b> ${selectedPatient.patientNo}</span>
          <span><b>Age/Gender:</b> ${selectedPatient.age} / ${selectedPatient.gender}</span>
          <span><b>X-Ray Type:</b> ${o.xrayType}</span>
          <span><b>Ordered By:</b> ${o.orderedBy}</span>
        </div>
        <div class="report-text">${o.report || 'No report available'}</div>
        <div class="sig-area">
          <div class="sig-box"><div class="sig-line">Radiologist</div></div>
          <div class="sig-box"><div class="sig-line">Referring Doctor</div></div>
        </div>
        <div class="footer">
          <span>${hospitalName} - Radiology Department</span>
          <span>This is a computer-generated report</span>
        </div>
      </div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const printUSGReport = (o: UltrasoundOrder) => {
    if (!selectedPatient) return;
    const html = `<!DOCTYPE html><html><head><title>Ultrasound Report - ${selectedPatient.name}</title><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,Helvetica,sans-serif;color:#222;background:#fff;}
      @page{size:A4;margin:15mm;}
      .report{width:100%;max-width:700px;margin:0 auto;padding:2px;}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px double #333;padding-bottom:6px;margin-bottom:8px;}
      .header h1{font-size:16px;letter-spacing:1px;margin:0;color:#111;}
      .header .sub{font-size:9px;color:#555;}
      .header .rid{font-size:9px;color:#888;text-align:right;}
      .patient-bar{display:flex;justify-content:space-between;background:#f0f0f0;padding:5px 8px;border:1px solid #ccc;border-radius:3px;margin-bottom:10px;font-size:11px;flex-wrap:wrap;gap:2px;}
      .patient-bar span{white-space:nowrap;} .patient-bar b{color:#111;}
      .report-text{background:#fafafa;border:1px solid #ddd;border-radius:4px;padding:12px 15px;margin:10px 0;white-space:pre-wrap;line-height:1.8;font-size:12px;min-height:120px;}
      .footer{margin-top:20px;padding-top:6px;border-top:1px solid #999;display:flex;justify-content:space-between;font-size:9px;color:#666;}
      .sig-area{margin-top:25px;display:flex;justify-content:space-between;}
      .sig-box{text-align:center;width:180px;}
      .sig-line{border-top:1px solid #333;margin-top:50px;padding-top:3px;font-size:10px;}
      .print-btn{position:fixed;top:10px;right:10px;padding:8px 20px;background:#1a73e8;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:bold;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:999;}
      .print-btn:hover{background:#1557b0;}
      @media print{.print-btn{display:none!important;}body{background:#fff;}@page{margin:10mm;}}
    </style></head><body>
      <button class="print-btn" onclick="window.print()">Print Report</button>
      <div class="report">
        <div class="header">
          <div><h1>${hospitalName.toUpperCase()}</h1><div class="sub">RADIOLOGY DEPARTMENT - ULTRASOUND REPORT</div></div>
          <div class="rid">Report ID: ${o.id.slice(-6)}<br/>Date: ${o.date}</div>
        </div>
        <div class="patient-bar">
          <span><b>Patient:</b> ${selectedPatient.name}</span>
          <span><b>ID:</b> ${selectedPatient.patientNo}</span>
          <span><b>Age/Gender:</b> ${selectedPatient.age} / ${selectedPatient.gender}</span>
          <span><b>USG Type:</b> ${o.usgType}</span>
          <span><b>Ordered By:</b> ${o.orderedBy}</span>
        </div>
        <div class="report-text">${o.report || 'No report available'}</div>
        <div class="sig-area">
          <div class="sig-box"><div class="sig-line">Sonologist</div></div>
          <div class="sig-box"><div class="sig-line">Referring Doctor</div></div>
        </div>
        <div class="footer">
          <span>${hospitalName} - Radiology Department</span>
          <span>This is a computer-generated report</span>
        </div>
      </div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const completedLabCount = labOrders.filter(o => o.status === 'completed').length;
  const processLabCount = labOrders.filter(o => o.status !== 'completed').length;
  const completedXrayCount = xrayOrders.filter(o => o.status === 'Completed').length;
  const processXrayCount = xrayOrders.filter(o => o.status !== 'Completed').length;
  const completedUsgCount = usgOrders.filter(o => o.status === 'Completed').length;
  const processUsgCount = usgOrders.filter(o => o.status !== 'Completed').length;

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Lab Reports</h2>
        <p className="text-sm text-slate-500">Search patient by ID and check report status. Print completed reports.</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-lg font-bold text-slate-800 mb-3">Search Patient - Card Number / Mobile</h3>
        <div className="flex gap-3">
          <input
            className="form-input flex-1 text-lg"
            placeholder="Enter card number (BAGA-0001) or mobile number..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            autoFocus
          />
          <button onClick={handleSearch} className="btn btn-primary btn-lg">Search</button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map(p => (
              <button
                key={p.id}
                onClick={() => selectPatient(p)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-emerald-50 transition-colors text-left"
              >
                <div>
                  <span className="font-mono font-bold text-emerald-600">{p.patientNo}</span>
                  <span className="font-semibold text-slate-800 ml-3">{p.name}</span>
                  <span className="text-sm text-slate-500 ml-2">({p.gender}, {p.age})</span>
                </div>
                <span className="text-sm text-slate-500">{p.mobile}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Patient Selected */}
      {selectedPatient && (
        <>
          {/* Patient Banner */}
          <div className="bg-emerald-600 text-white rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-lg">{selectedPatient.patientNo}</span>
                  <span className="text-emerald-200">{selectedPatient.name}</span>
                </div>
                <div className="flex gap-4 mt-1 text-sm text-emerald-200">
                  <span>Father: {selectedPatient.fatherName}</span>
                  <span>Mobile: {selectedPatient.mobile}</span>
                  <span>Age: {selectedPatient.age}/{selectedPatient.gender}</span>
                  <span>Visits: {selectedPatient.totalVisits}</span>
                </div>
              </div>
              <button onClick={clearPatient} className="btn bg-white/20 hover:bg-white/30 text-white btn-sm">
                Change Patient
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="stat-card card-hover border border-teal-200 bg-teal-50">
              <p className="text-xs text-teal-600 font-medium">Lab Reports Completed</p>
              <p className="text-2xl font-bold text-teal-700">{completedLabCount}</p>
            </div>
            <div className="stat-card card-hover border border-amber-200 bg-amber-50">
              <p className="text-xs text-amber-600 font-medium">Lab Reports Pending</p>
              <p className="text-2xl font-bold text-amber-700">{processLabCount}</p>
            </div>
            <div className="stat-card card-hover border border-blue-200 bg-blue-50">
              <p className="text-xs text-blue-600 font-medium">X-Ray / USG Completed</p>
              <p className="text-2xl font-bold text-blue-700">{completedXrayCount + completedUsgCount}</p>
            </div>
          </div>

          {/* Lab Orders */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <h3 className="font-bold text-slate-800">Lab Reports</h3>
            </div>
            {labOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-2 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p className="font-medium">No lab orders found for this patient</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {labOrders.map(o => {
                  const displayStatus = o.status==='completed'?'Completed':o.status==='processing'?'In Progress':'Pending';
                  return (
                  <div key={o.id} className="border border-slate-200 rounded-lg p-4 mb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm text-slate-500">{o.date} {o.time}</span>
                        <span className="text-xs text-slate-400 ml-2">by {o.orderedBy}</span>
                      </div>
                      <span className={`badge ${o.status==='completed'?'badge-green':o.status==='processing'?'badge-blue':'badge-amber'}`}>{displayStatus}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {o.tests.map((t,i)=><span key={i} className="badge badge-blue">{t.testName}</span>)}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {o.status==='completed'&&o.results&&o.results.length>0&&(
                        <button onClick={()=>printLabReport(o)} className="btn btn-primary btn-sm">View / Print Report</button>
                      )}
                      {o.status!=='completed'&&(
                        <span className="text-xs text-slate-400 italic py-1">Awaiting results from lab...</span>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* X-Ray Reports */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <h3 className="font-bold text-slate-800">X-Ray Reports</h3>
            </div>
            {xrayOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="font-medium">No X-Ray orders found for this patient</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {xrayOrders.map(o=>(
                  <div key={o.id} className="border border-slate-200 rounded-lg p-4 mb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-slate-800">{o.xrayType}</span>
                        <span className="text-sm text-slate-500 ml-2">{o.date}</span>
                      </div>
                      <span className={`badge ${o.status==='Completed'?'badge-green':o.status==='In Progress'?'badge-blue':'badge-amber'}`}>{o.status}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Ordered by: {o.orderedBy}</div>
                    <div className="flex gap-2 mt-2">
                      {o.status==='Completed'&&o.report&&(
                        <button onClick={()=>printXRayReport(o)} className="btn btn-primary btn-sm">View Report</button>
                      )}
                      {o.status==='Completed'&&o.report&&(
                        <button onClick={()=>printXRayReport(o)} className="btn btn-outline btn-sm">Print</button>
                      )}
                      {o.status!=='Completed'&&(
                        <span className="text-xs text-slate-400 italic py-1">X-Ray in progress...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ultrasound Reports */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <h3 className="font-bold text-slate-800">Ultrasound Reports</h3>
            </div>
            {usgOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="font-medium">No ultrasound orders found for this patient</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {usgOrders.map(o=>(
                  <div key={o.id} className="border border-slate-200 rounded-lg p-4 mb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-slate-800">{o.usgType}</span>
                        <span className="text-sm text-slate-500 ml-2">{o.date}</span>
                      </div>
                      <span className={`badge ${o.status==='Completed'?'badge-green':o.status==='In Progress'?'badge-blue':'badge-amber'}`}>{o.status}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Ordered by: {o.orderedBy}</div>
                    <div className="flex gap-2 mt-2">
                      {o.status==='Completed'&&o.report&&(
                        <button onClick={()=>printUSGReport(o)} className="btn btn-primary btn-sm">View Report</button>
                      )}
                      {o.status==='Completed'&&o.report&&(
                        <button onClick={()=>printUSGReport(o)} className="btn btn-outline btn-sm">Print</button>
                      )}
                      {o.status!=='Completed'&&(
                        <span className="text-xs text-slate-400 italic py-1">Ultrasound in progress...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* No Patient Selected State */}
      {!selectedPatient && searchResults.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <p className="text-slate-400 text-lg font-medium">Search for a Patient</p>
          <p className="text-slate-300 text-sm mt-1">Enter card number or mobile number to view lab reports</p>
        </div>
      )}
    </div>
  );
}
