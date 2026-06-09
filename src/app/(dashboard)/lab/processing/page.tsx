'use client';
import { useState, useEffect, useRef } from 'react';
import { initLabData, getLabOrders, getLabTestById, updateLabOrder, analyzeResult, getRefRange, nowTime, todayStr, genId, type LabOrderItem, type LabResultEntry, type LabParameter } from '@/lib/lab-store';
import { generateProfessionalLabReportHtml, getLabPrintData, openPrintWindow } from '@/lib/print-lab-report';

export default function ResultEntryPage() {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [orders, setOrders] = useState<LabOrderItem[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeTestIdx, setActiveTestIdx] = useState(0);
  const [results, setResults] = useState<LabResultEntry[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const loadData = () => { setOrders(getLabOrders()); };

  useEffect(() => { initLabData(); loadData(); setMounted(true); }, []);

  if (!mounted) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>;

  const readyOrders = orders.filter(o => o.status === 'collected' || o.status === 'processing');
  const processingOrders = orders.filter(o => o.status === 'processing');

  const activeOrder = orders.find(o => o.id === activeOrderId);

  const startProcessing = (order: LabOrderItem) => {
    updateLabOrder(order.id, { status: 'processing' });
    setActiveOrderId(order.id);
    setActiveTestIdx(0);
    // Build empty results for all parameters of all tests
    const allResults: LabResultEntry[] = [];
    order.tests.forEach(t => {
      const testDef = getLabTestById(t.testId);
      if (testDef) {
        testDef.parameters.forEach(p => {
          allResults.push({
            testId: testDef.id,
            testName: testDef.name,
            parameter: p.name,
            value: '',
            unit: p.unit,
            refRange: getRefRange(p, order.gender),
            flag: 'Normal',
          });
        });
      }
    });
    setResults(allResults);
    loadData();
  };

  const updateResultValue = (idx: number, value: string) => {
    if (!activeOrder) return;
    const updated = [...results];
    updated[idx].value = value;
    // Auto-analyze
    const testDef = getLabTestById(updated[idx].testId);
    if (testDef) {
      const param = testDef.parameters.find(p => p.name === updated[idx].parameter);
      updated[idx].flag = analyzeResult(value, param, activeOrder.gender);
      updated[idx].refRange = getRefRange(param!, activeOrder.gender);
    }
    setResults(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Check if all results are filled
      const allFilled = results.every(r => r.value.trim() !== '');
      if (idx === results.length - 1 && allFilled) {
        // Last field, all filled — auto-complete report
        completeReport();
        return;
      }
      if (idx < results.length - 1) {
        const nextInput = inputRefs.current[idx + 1];
        if (nextInput) { nextInput.focus(); nextInput.select(); }
        // Auto-switch test tab when moving to a different test
        if (results[idx + 1].testId !== results[idx].testId) {
          const nextTestIdx = activeOrder!.tests.findIndex(t => t.testId === results[idx + 1].testId);
          if (nextTestIdx >= 0) setActiveTestIdx(nextTestIdx);
        }
      }
    }
  };

  const completeReport = () => {
    if (!activeOrder) return;
    const filled = results.filter(r => r.value.trim() !== '');
    if (filled.length === 0) { showToast('Enter at least one result value', 'error'); return; }
    // Check that all parameters have values
    const empty = results.filter(r => r.value.trim() === '');
    if (empty.length > 0) { showToast(`${empty.length} parameter(s) still empty. Fill all or remove incomplete tests.`, 'error'); return; }

    updateLabOrder(activeOrder.id, {
      status: 'completed',
      results: results,
      completedAt: nowTime(),
      completedBy: (() => { try { const s = JSON.parse(localStorage.getItem('baga_session') || '{}'); return s.name || 'Lab Tech'; } catch { return 'Lab Tech'; } })(),
      paidAmount: activeOrder.totalAmount,
      paymentStatus: 'paid',
    });
    setActiveOrderId(null);
    setResults([]);
    loadData();
    showToast('Report completed successfully!', 'success');
  };

  const printPreview = () => {
    if (!activeOrder) return;
    const printData = getLabPrintData();
    const html = generateProfessionalLabReportHtml({
      patientName: activeOrder.patientName,
      patientNo: activeOrder.patientNo,
      age: activeOrder.age,
      gender: activeOrder.gender,
      sampleType: activeOrder.sampleType,
      orderedBy: activeOrder.orderedBy,
      date: activeOrder.date,
      time: activeOrder.time || '',
      orderId: activeOrder.id,
      collectedAt: activeOrder.collectedAt,
      completedAt: activeOrder.completedAt,
      results: results,
      techName: printData.techName,
      reportDocHtml: printData.reportDocHtml,
      hospitalName: printData.hospitalName,
      hospitalAddress: printData.hospitalAddress,
      hospitalPhone: printData.hospitalPhone,
    });
    openPrintWindow(html);
  };

  // Get test results for active tab
  const activeTest = activeOrder?.tests[activeTestIdx];
  const activeTestResults = activeTest ? results.filter(r => r.testId === activeTest.testId) : [];

  const getTestDefParams = (testId: string): LabParameter[] => {
    const def = getLabTestById(testId);
    return def ? def.parameters : [];
  };

  const flagClass = (flag: string) => flag === 'Normal' ? 'border-green-300 bg-green-50' : flag === 'Low' ? 'border-amber-300 bg-amber-50' : flag === 'High' ? 'border-orange-300 bg-orange-50' : 'border-red-500 bg-red-50';

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      <div>
        <h2 className="text-xl font-bold text-slate-800">Result Entry</h2>
        <p className="text-sm text-slate-500">Enter test results and complete reports</p>
      </div>

      {!activeOrder ? (
        <>
          {/* Ready to Process */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Ready to Process ({readyOrders.length})
            </h3>
            {readyOrders.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No orders ready for processing</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Patient</th><th>Tests</th><th>Sample</th><th>Urgency</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {readyOrders.map(o => (
                      <tr key={o.id}>
                        <td>
                          <span className="font-mono font-bold text-blue-600 text-xs">{o.patientNo}</span>
                          <div className="font-medium">{o.patientName}</div>
                          <div className="text-xs text-slate-400">{o.gender} / {o.age}</div>
                        </td>
                        <td><div className="flex flex-wrap gap-1">{o.tests.map((t,i) => <span key={i} className="badge badge-blue text-xs">{t.testName}</span>)}</div></td>
                        <td className="text-sm">{o.sampleType}</td>
                        <td><span className={`badge ${o.urgency === 'stat' ? 'badge-rose' : o.urgency === 'urgent' ? 'badge-amber' : 'badge-slate'}`}>{o.urgency.toUpperCase()}</span></td>
                        <td><span className={`badge ${o.status === 'processing' ? 'badge-purple' : 'badge-blue'}`}>{o.status.charAt(0).toUpperCase() + o.status.slice(1)}</span></td>
                        <td><button onClick={() => startProcessing(o)} className="btn btn-primary btn-sm">{o.status === 'processing' ? 'Continue' : 'Start Processing'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Result Entry Mode */
        <div className="space-y-5">
          {/* Patient Info Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold">
                  {activeOrder.patientName.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{activeOrder.patientName} <span className="font-mono text-blue-600">({activeOrder.patientNo})</span></p>
                  <p className="text-sm text-slate-500">{activeOrder.gender} / {activeOrder.age} | Ordered by {activeOrder.orderedBy} | {activeOrder.date}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={printPreview} className="btn btn-outline btn-sm">Print Preview</button>
                <button onClick={() => { setActiveOrderId(null); setResults([]); }} className="btn btn-outline btn-sm">Back</button>
              </div>
            </div>
          </div>

          {/* Test Tabs */}
          <div className="flex flex-wrap gap-2">
            {activeOrder.tests.map((t, i) => {
              const testResults = results.filter(r => r.testId === t.testId);
              const hasAllValues = testResults.every(r => r.value.trim() !== '');
              const hasAbnormal = testResults.some(r => r.flag !== 'Normal');
              return (
                <button
                  key={i}
                  onClick={() => setActiveTestIdx(i)}
                  className={`btn btn-sm ${activeTestIdx === i ? 'btn-primary' : 'btn-outline'} ${hasAbnormal ? 'ring-2 ring-red-300' : ''}`}
                >
                  {t.testName}
                  {hasAllValues && <span className="ml-1 text-green-500">✓</span>}
                </button>
              );
            })}
          </div>

          {/* Parameters Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800">{activeTest?.testName}</h3>
              <p className="text-xs text-slate-500">Press ENTER to move to next field. Values are auto-analyzed.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{width: '30%'}}>Parameter</th>
                    <th style={{width: '20%'}}>Result</th>
                    <th>Unit</th>
                    <th>Reference Range</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTestResults.map((r, idx) => {
                    const globalIdx = results.indexOf(r);
                    const paramDef = getTestDefParams(r.testId).find(p => p.name === r.parameter);
                    return (
                      <tr key={idx} className={r.value ? flagClass(r.flag) : ''}>
                        <td className="font-medium">{r.parameter}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <input
                              ref={el => { inputRefs.current[globalIdx] = el; }}
                              type="text"
                              className={`form-input text-sm ${r.value ? flagClass(r.flag) : ''} ${r.flag === 'Critical' ? 'border-2 !border-red-500 bg-red-50' : r.flag === 'High' ? 'border-amber-400' : r.flag === 'Low' ? 'border-blue-400' : ''}`}
                              value={r.value}
                              onChange={e => updateResultValue(globalIdx, e.target.value)}
                              onKeyDown={e => handleKeyDown(e, globalIdx)}
                              placeholder="—"
                              style={{minWidth: '100px'}}
                            />
                            {r.flag === 'Critical' && <span className="text-red-600 text-xs font-bold ml-1">CRITICAL</span>}
                          </div>
                        </td>
                        <td className="text-sm text-slate-500">{r.unit || '—'}</td>
                        <td className="text-sm text-slate-500">{r.refRange || '—'}</td>
                        <td>
                          <span className={`badge ${r.flag === 'Normal' ? 'badge-green' : r.flag === 'Low' ? 'badge-amber' : r.flag === 'High' ? 'badge-rose' : 'badge-red'}`}>
                            {r.flag}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button onClick={completeReport} className="btn btn-success btn-lg flex-1">Complete Report</button>
            <button onClick={printPreview} className="btn btn-outline btn-lg">Print Preview</button>
          </div>

          {/* Result Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h4 className="font-semibold text-sm mb-2">Result Summary</h4>
            <div className="flex gap-4 text-sm">
              <span>Total Parameters: <strong>{results.length}</strong></span>
              <span>Filled: <strong className="text-green-600">{results.filter(r => r.value.trim() !== '').length}</strong></span>
              <span>Empty: <strong className="text-amber-600">{results.filter(r => r.value.trim() === '').length}</strong></span>
              <span>Abnormal: <strong className="text-red-600">{results.filter(r => r.flag !== 'Normal' && r.value.trim() !== '').length}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
