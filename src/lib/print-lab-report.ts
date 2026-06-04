import { getHospitalSettingsData, getSession, dbGetAll } from '@/lib/db-bridge';

/**
 * Professional Lab Report Print Template
 * Navy-blue themed, A4 optimized design
 * Used across all lab report printing locations
 */

interface PrintLabReportParams {
  patientName: string;
  patientNo: string;
  age: string;
  gender: string;
  sampleType: string;
  orderedBy: string;
  date: string;
  time: string;
  orderId: string;
  collectedAt?: string;
  completedAt?: string;
  results: { testName: string; parameter: string; value: string; unit: string; refRange: string; flag: string }[];
  techName: string;
  reportDocHtml: string;
  hospitalName: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  hospitalEmail?: string;
  hospitalMobile?: string;
  hospitalLogo?: string;
}

export function generateProfessionalLabReportHtml(params: PrintLabReportParams): string {
  const {
    patientName, patientNo, age, gender, sampleType, orderedBy,
    date, time, orderId, collectedAt, completedAt,
    results, techName, reportDocHtml, hospitalName,
    hospitalAddress = '', hospitalPhone = '',
    hospitalEmail = '', hospitalMobile = '', hospitalLogo = ''
  } = params;

  const abnormal = results.filter(r => r.flag !== 'Normal');
  const groupedTests = [...new Set(results.map(r => r.testName))];
  const totalParams = results.length;

  // Count per test
  const testRowsHtml = groupedTests.map((testName, idx) => {
    const testResults = results.filter(r => r.testName === testName);
    const rows = testResults.map((r, ri) => {
      const flagClass = r.flag === 'Critical' ? 'fc' : r.flag === 'High' ? 'fh' : r.flag === 'Low' ? 'fl' : 'fn';
      const altClass = ri % 2 === 0 ? 'row-even' : 'row-odd';
      const flagColor = r.flag === 'Critical' ? '#fff' : r.flag === 'High' ? '#b91c1c' : r.flag === 'Low' ? '#b45309' : '#15803d';
      const flagBg = r.flag === 'Critical' ? '#dc2626' : r.flag === 'High' ? '#fee2e2' : r.flag === 'Low' ? '#fef3c7' : '#dcfce7';
      return `<tr class="${altClass} ${flagClass}">
        <td class="param-name">${r.parameter}</td>
        <td class="param-value">${r.value}</td>
        <td class="param-unit">${r.unit || '-'}</td>
        <td class="param-ref">${r.refRange || '-'}</td>
        <td class="param-flag" style="color:${flagColor};background:${flagBg};">${r.flag || 'Normal'}</td>
      </tr>`;
    }).join('');

    return `
      <div class="test-section">
        <div class="test-header">
          <span class="test-num">${idx + 1}</span>
          <span class="test-name">${testName}</span>
          <span class="test-count">${testResults.length} parameter${testResults.length !== 1 ? 's' : ''}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:32%">Parameter</th>
              <th style="width:13%">Result</th>
              <th style="width:10%">Unit</th>
              <th style="width:30%">Reference Range</th>
              <th style="width:15%">Flag</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lab Report - ${patientName}</title><style>
    @page{size:A4;margin:8mm 12mm;}
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1e293b;background:#fff;font-size:10.5px;line-height:1.4;}
    
    /* ===== REPORT WRAPPER ===== */
    .report{width:100%;max-width:210mm;margin:0 auto;border:1.5px solid #c8d6e5;border-radius:6px;overflow:hidden;}
    
    /* ===== HEADER BANNER ===== */
    .header-banner{
      background:linear-gradient(135deg,#0c2340 0%,#1a3a5c 40%,#1e4d7b 100%);
      color:#fff;padding:14px 22px;display:flex;justify-content:space-between;align-items:center;
      position:relative;overflow:hidden;
    }
    .header-banner::after{
      content:'';position:absolute;bottom:0;left:0;right:0;height:3px;
      background:linear-gradient(90deg,#f59e0b,#ef4444,#3b82f6,#10b981,#f59e0b);
    }
    .header-left{display:flex;align-items:center;gap:14px;}
    .hospital-logo{width:48px;height:48px;border-radius:6px;object-fit:contain;background:#fff;padding:2px;}
    .hospital-info{flex:1;}
    .hospital-name{font-size:18px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-shadow:0 1px 3px rgba(0,0,0,0.3);}
    .hospital-sub{font-size:9px;letter-spacing:1.5px;opacity:0.85;margin-top:2px;text-transform:uppercase;}
    .report-meta{text-align:right;font-size:8.5px;line-height:1.5;opacity:0.9;}
    .report-meta .rid{font-weight:700;font-size:10px;letter-spacing:0.5px;}
    
    /* ===== CONTACT STRIP ===== */
    .contact-strip{
      background:#eef2f7;padding:5px 22px;display:flex;justify-content:space-between;
      font-size:8px;color:#475569;letter-spacing:0.3px;border-bottom:1px solid #d1d9e6;
    }
    
    /* ===== PATIENT INFO BAR ===== */
    .patient-section{padding:10px 22px 8px;border-bottom:1px solid #e2e8f0;}
    .section-label{
      font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;
      color:#0c2340;margin-bottom:5px;display:flex;align-items:center;gap:6px;
    }
    .section-label::before{content:'';width:3px;height:12px;background:#0c2340;border-radius:2px;}
    .patient-grid{
      display:grid;grid-template-columns:repeat(3,1fr);gap:4px 16px;
      background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:8px 12px;
    }
    .patient-item{display:flex;gap:4px;font-size:10px;}
    .patient-item .label{color:#64748b;font-weight:600;min-width:55px;}
    .patient-item .value{color:#1e293b;font-weight:500;}
    
    /* ===== TEST SECTIONS ===== */
    .tests-area{padding:8px 22px;}
    .test-section{margin-bottom:8px;page-break-inside:avoid;}
    .test-header{
      background:linear-gradient(90deg,#0c2340,#1a3a5c);
      color:#fff;padding:5px 12px;display:flex;align-items:center;gap:8px;
      border-radius:4px 4px 0 0;font-size:11px;font-weight:700;
    }
    .test-num{
      background:rgba(255,255,255,0.2);width:22px;height:22px;display:flex;align-items:center;
      justify-content:center;border-radius:50%;font-size:10px;font-weight:800;
    }
    .test-name{flex:1;letter-spacing:0.3px;}
    .test-count{font-size:8px;opacity:0.7;background:rgba(255,255,255,0.15);padding:2px 8px;border-radius:10px;}
    
    /* ===== DATA TABLE ===== */
    table{width:100%;border-collapse:collapse;font-size:10px;}
    thead tr{background:#eef2f7;}
    th{
      padding:5px 8px;text-align:left;font-size:8.5px;font-weight:700;
      text-transform:uppercase;letter-spacing:0.8px;color:#0c2340;
      border-bottom:2px solid #0c2340;
    }
    td{padding:4px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;}
    .row-even{background:#fff;}
    .row-odd{background:#f8fafc;}
    .param-name{font-weight:600;color:#334155;}
    .param-value{font-weight:800;font-size:11px;color:#0f172a;letter-spacing:0.3px;}
    .param-unit{color:#64748b;font-size:9px;}
    .param-ref{color:#475569;font-size:9.5px;font-style:italic;}
    .param-flag{
      text-align:center;font-weight:800;font-size:8.5px;border-radius:3px;
      padding:2px 6px;text-transform:uppercase;letter-spacing:0.5px;
    }
    
    /* Flag row backgrounds */
    .fn{background:#fff;} .fl{background:#fffbeb;} .fh{background:#fef2f2;} .fc{background:#fee2e2;}
    
    /* ===== SUMMARY ===== */
    .summary-section{
      margin:6px 22px;padding:8px 14px;
      background:linear-gradient(135deg,#f0fdf4,#ecfdf5);
      border:1px solid #bbf7d0;border-radius:6px;
      display:flex;justify-content:space-between;align-items:center;
    }
    .summary-section.has-abnormal{
      background:linear-gradient(135deg,#fef2f2,#fee2e2);
      border-color:#fecaca;
    }
    .summary-left{font-size:10px;font-weight:600;}
    .summary-left b{color:#0c2340;}
    .summary-right{font-size:9px;color:#475569;font-weight:500;}
    .abnormal-list{color:#dc2626;font-weight:700;font-size:9px;}
    
    /* ===== SIGNATURES ===== */
    .sig-section{padding:14px 22px 8px;}
    .sig-grid{display:flex;justify-content:space-around;flex-wrap:wrap;gap:12px;}
    .sig-box{text-align:center;min-width:120px;flex:1;max-width:200px;}
    .sig-space{height:42px;margin-bottom:2px;}
    .sig-line{border-top:2px solid #334155;padding-top:4px;}
    .sig-name{font-size:10px;font-weight:800;color:#0c2340;letter-spacing:0.3px;}
    .sig-title{font-size:8px;color:#64748b;margin-top:1px;}
    .sig-qual{font-size:7px;color:#94a3b8;margin-top:1px;letter-spacing:0.3px;}
    
    /* ===== FOOTER ===== */
    .footer{
      background:#f1f5f9;border-top:2px solid #0c2340;
      padding:6px 22px;display:flex;justify-content:space-between;align-items:center;
      font-size:7.5px;color:#64748b;
    }
    .footer-hospital{font-weight:700;color:#0c2340;letter-spacing:0.5px;}
    .footer-note{font-style:italic;opacity:0.7;}
    
    /* ===== PRINT BUTTON ===== */
    .print-btn{
      position:fixed;top:12px;right:12px;padding:10px 24px;
      background:linear-gradient(135deg,#0c2340,#1e4d7b);
      color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;
      cursor:pointer;box-shadow:0 4px 12px rgba(12,35,64,0.4);z-index:999;
      letter-spacing:0.5px;transition:all 0.2s;
    }
    .print-btn:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(12,35,64,0.5);}
    
    @media print{
      .print-btn{display:none!important;}
      body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    }
  </style></head><body>
    <button class="print-btn" onclick="window.print()">Print Report</button>
    <div class="report">
      <!-- Header Banner -->
      <div class="header-banner">
        <div class="header-left">
          ${hospitalLogo ? `<img class="hospital-logo" src="${hospitalLogo}" alt="" />` : ''}
          <div class="hospital-info">
            <div class="hospital-name">${hospitalName}</div>
            <div class="hospital-sub">Pathology & Diagnostic Laboratory</div>
          </div>
        </div>
        <div class="report-meta">
          <div class="rid">Report #${orderId.slice(-6).toUpperCase()}</div>
          <div>Date: ${date}</div>
          <div>Time: ${time || '-'}</div>
        </div>
      </div>
      
      <!-- Contact Strip -->
      <div class="contact-strip">
        <span>${hospitalAddress || 'Comprehensive Healthcare Services'}</span>
        <span>${hospitalPhone ? 'Tel: ' + hospitalPhone : ''}${hospitalMobile ? ' | Mob: ' + hospitalMobile : ''}</span>
        <span>${hospitalEmail ? 'Email: ' + hospitalEmail : 'Computer Generated Report'}</span>
      </div>
      
      <!-- Patient Info -->
      <div class="patient-section">
        <div class="section-label">Patient Information</div>
        <div class="patient-grid">
          <div class="patient-item"><span class="label">Patient:</span><span class="value">${patientName}</span></div>
          <div class="patient-item"><span class="label">Patient ID:</span><span class="value">${patientNo}</span></div>
          <div class="patient-item"><span class="label">Age / Gender:</span><span class="value">${age} / ${gender}</span></div>
          <div class="patient-item"><span class="label">Referred By:</span><span class="value">${orderedBy}</span></div>
          <div class="patient-item"><span class="label">Sample:</span><span class="value">${sampleType}</span></div>
          <div class="patient-item"><span class="label">Collected:</span><span class="value">${collectedAt || '-'}</span></div>
        </div>
      </div>
      
      <!-- Test Results -->
      <div class="tests-area">
        ${testRowsHtml}
      </div>
      
      <!-- Summary -->
      <div class="summary-section${abnormal.length > 0 ? ' has-abnormal' : ''}">
        <div class="summary-left">
          <b>${totalParams}</b> Parameters Tested | <b>${abnormal.length}</b> ${abnormal.length === 1 ? 'Abnormal' : 'Abnormal'}
        </div>
        <div class="summary-right">
          ${abnormal.length > 0
            ? `<span class="abnormal-list">Abnormal: ${abnormal.map(a => `${a.parameter} (${a.flag})`).join(', ')}</span>`
            : '<span style="color:#15803d;">All results are within normal limits.</span>'}
        </div>
      </div>
      
      <!-- Signatures -->
      <div class="sig-section">
        <div class="sig-grid">
          <div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">
              <div class="sig-name">${techName}</div>
              <div class="sig-title">Lab Technician</div>
            </div>
          </div>
          ${reportDocHtml}
        </div>
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <span class="footer-hospital">${hospitalName}</span>
        <span>Completed: ${completedAt || '-'}</span>
        <span class="footer-note">This is a computer-generated report.</span>
      </div>
    </div>
  </body></html>`;

  return html;
}

/** Helper: read hospital settings, logo, and lab doctors (sync version) */
export function getLabPrintData(): {
  hospitalName: string;
  hospitalAddress: string;
  hospitalPhone: string;
  hospitalMobile: string;
  hospitalEmail: string;
  techName: string;
  reportDocHtml: string;
  hospitalLogo: string;
} {
  let hospitalName = 'BAGA HOSPITAL';
  let hospitalAddress = '';
  let hospitalPhone = '';
  let hospitalMobile = '';
  let hospitalEmail = '';
  let techName = 'Lab Technician';
  let reportDocHtml = '';
  let hospitalLogo = '';

  try {
    const hs = getHospitalSettingsData();
    if (hs && hs.name) hospitalName = hs.name;
    if (hs && hs.address) hospitalAddress = hs.address;
    if (hs && hs.phone) hospitalPhone = hs.phone;
  } catch {}

  try {
    const s = getSession() || {};
    if (s.name) techName = s.name;
  } catch {}

  try {
    let docs: any[] = [];
    const dbDocs = dbGetAll('lab_doctors');
    if (dbDocs && dbDocs.length > 0) { docs = dbDocs; }
    else {
      const raw = localStorage.getItem('baga_lab_doctors');
      if (raw) docs = JSON.parse(raw);
    }
    if (docs.length > 0) {
      const active = docs.filter((d: any) => d.active && d.showOnReport);
      if (active.length > 0) {
        reportDocHtml = active.map((d: any) =>
          '<div class="sig-box"><div class="sig-space"></div><div class="sig-line"><div class="sig-name">' + d.name + '</div><div class="sig-title">' + d.designation + '</div><div class="sig-qual">' + (d.qualification || '') + '</div></div></div>'
        ).join('');
      }
    }
  } catch {}

  return { hospitalName, hospitalAddress, hospitalPhone, hospitalMobile, hospitalEmail, techName, reportDocHtml, hospitalLogo };
}

/** Helper: read hospital settings, logo, and lab doctors */
export async function getLabPrintDataAsync(): Promise<{
  hospitalName: string;
  hospitalAddress: string;
  hospitalPhone: string;
  hospitalMobile: string;
  hospitalEmail: string;
  techName: string;
  reportDocHtml: string;
  hospitalLogo: string;
}> {
  let hospitalName = 'BAGA HOSPITAL';
  let hospitalAddress = '';
  let hospitalPhone = '';
  let hospitalMobile = '';
  let hospitalEmail = '';
  let techName = 'Lab Technician';
  let reportDocHtml = '';
  let hospitalLogo = '';

  try {
    // Try to get logo from Electron first
    const isEl = typeof window !== 'undefined' && !!(window as any).bagaAPI;
    if (isEl) {
      try {
        const logoResult = await (window as any).bagaAPI.getLogoBase64();
        if (logoResult.success) hospitalLogo = logoResult.data;
      } catch (e) {}
      try {
        const licenseInfo = await (window as any).bagaAPI.getFullLicenseInfo();
        if (licenseInfo && licenseInfo.hospitalName) hospitalName = licenseInfo.hospitalName;
        if (licenseInfo && licenseInfo.hospitalAddress) hospitalAddress = licenseInfo.hospitalAddress;
        if (licenseInfo && licenseInfo.hospitalPhone) hospitalPhone = licenseInfo.hospitalPhone;
        if (licenseInfo && licenseInfo.hospitalMobile) hospitalMobile = licenseInfo.hospitalMobile;
        if (licenseInfo && licenseInfo.hospitalEmail) hospitalEmail = licenseInfo.hospitalEmail;
      } catch (e) {}
    }
    
    // Fallback to localStorage settings
    const hs = getHospitalSettingsData();
    if (hs && hs.name) hospitalName = hs.name;
    if (hs && hs.address) hospitalAddress = hs.address;
    if (hs && hs.phone) hospitalPhone = hs.phone;
  } catch {}

  try {
    const s = getSession() || {};
    if (s.name) techName = s.name;
  } catch {}

  try {
    let docs: any[] = [];
    const dbDocs = dbGetAll('lab_doctors');
    if (dbDocs && dbDocs.length > 0) {
      docs = dbDocs;
    } else {
      const raw = localStorage.getItem('baga_lab_doctors');
      if (raw) docs = JSON.parse(raw);
    }
    if (docs.length > 0) {
      const active = docs.filter((d: any) => d.active && d.showOnReport);
      if (active.length > 0) {
        reportDocHtml = active.map((d: any) =>
          `<div class="sig-box">
            <div class="sig-space"></div>
            <div class="sig-line">
              <div class="sig-name">${d.name}</div>
              <div class="sig-title">${d.designation}</div>
              <div class="sig-qual">${d.qualification || ''}</div>
            </div>
          </div>`
        ).join('');
      }
    }
  } catch {}

  return { hospitalName, hospitalAddress, hospitalPhone, hospitalMobile, hospitalEmail, techName, reportDocHtml, hospitalLogo };
}

/** Helper: open print window - uses Electron native print if available */
export function openPrintWindow(html: string, autoPrint = true): void {
  const isEl = typeof window !== 'undefined' && !!(window as any).bagaAPI?.printHtml;
  if (isEl) {
    // Electron: use native print dialog via IPC
    (window as any).bagaAPI.printHtml(html).then((result: any) => {
      if (!result.success) {
        const isRealError = result.reason && !result.reason.includes('shown');
        console.error('Print failed:', result.reason);
        if (isRealError) {
          alert('Print failed: ' + (result.reason || 'Unknown error'));
        }
      }
    }).catch((err: any) => {
      console.error('Print IPC error:', err);
 });
  } else {
    // Browser fallback: open new window
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      if (autoPrint) setTimeout(() => w.print(), 500);
    }
  }
}
