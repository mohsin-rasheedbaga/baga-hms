'use client';
import { useState, useEffect, useCallback } from 'react';
import { todayStr, timeStr, genId, getHospitalSettings, getPharmacySalesDB, addPharmacyReturnDB, getPharmacyReturnsDB, getMedicines, updateMedicine } from '@/lib/store';
import { triggerPrint } from '@/lib/print-utils';

/* ==================== TYPES ==================== */

interface PharmacySaleItem {
  medicineId: string;
  name: string;
  genericName: string;
  form: string;
  strength: string;
  packing: string;
  price: number;
  quantity: number;
  total: number;
}

interface PharmacySale {
  id: string;
  patientNo: string;
  patientName: string;
  patientMobile: string;
  type: 'Indoor' | 'Outdoor';
  items: PharmacySaleItem[];
  totalAmount: number;
  date: string;
  time: string;
  servedBy: string;
  paymentMethod: 'Cash' | 'Card' | 'Online';
  dailyToken?: string;
  billSerial?: string;
  returnCode?: string;
  discountPercent?: number;
  discountAmount?: number;
}

interface ReturnItem {
  medicineId: string;
  name: string;
  quantity: number;
  price: number;
}

interface PharmacyReturn {
  id: string;
  slipId: string;
  slipBillSerial?: string;
  returnCode?: string;
  patientNo: string;
  patientName: string;
  items: ReturnItem[];
  totalRefund: number;
  returnedBy: string;
  date: string;
  time: string;
}

interface ItemReturnState {
  selected: boolean;
  returnQty: number;
}

/* ==================== HELPERS ==================== */

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}

function lsSet<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

const SALES_KEY = 'baga_pharmacy_sales'; // legacy, kept for backward compat
const RETURNS_KEY = 'baga_pharmacy_returns'; // legacy, kept for backward compat

async function getPrintHeader(): Promise<{ hospitalName: string; hospitalLogo: string; hospitalAddress: string; hospitalPhone: string }> {
  let hospitalName = 'BAGA HOSPITAL';
  let hospitalLogo = '';
  let hospitalAddress = '';
  let hospitalPhone = '';
  const isEl = typeof window !== 'undefined' && !!(window as any).bagaAPI;
  if (isEl) {
    try {
      const li = await (window as any).bagaAPI.getFullLicenseInfo();
      if (li) {
        if (li.hospitalName) hospitalName = li.hospitalName;
        if (li.hospitalAddress) hospitalAddress = li.hospitalAddress;
        if (li.phone || li.hospitalPhone) hospitalPhone = li.phone || li.hospitalPhone;
      }
    } catch (e) {}
    try {
      const logoResult = await (window as any).bagaAPI.getLogoBase64();
      if (logoResult.success) hospitalLogo = logoResult.data;
    } catch (e) {}
  }
  return { hospitalName, hospitalLogo, hospitalAddress, hospitalPhone };
}

/* ==================== COMPONENT ==================== */

export default function PharmacyReturnsPage() {
  const [currency, setCurrency] = useState('Rs.');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Password gate
  const [pwdVerified, setPwdVerified] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('baga_profit_password');
    if (!stored) {
      // No password set — allow access
      setPwdVerified(true);
    }
  }, []);

  const verifyPwd = () => {
    const stored = localStorage.getItem('baga_profit_password');
    if (!stored) { setPwdVerified(true); return; }
    if (pwdInput === stored) {
      setPwdVerified(true);
      setPwdError('');
      setPwdInput('');
    } else {
      setPwdError('Incorrect password');
    }
  };

  // Slip search
  const [slipQuery, setSlipQuery] = useState('');
  const [foundSale, setFoundSale] = useState<PharmacySale | null>(null);
  const [searchError, setSearchError] = useState('');

  // Item selection state: { [medicineId]: { selected, returnQty } }
  const [itemStates, setItemStates] = useState<Record<string, ItemReturnState>>({});
  const [allSelected, setAllSelected] = useState(false);

  // Return history
  const [returns, setReturns] = useState<PharmacyReturn[]>([]);

  // Last processed return (for print button)
  const [lastReturn, setLastReturn] = useState<PharmacyReturn | null>(null);

  // Loading
  const [processing, setProcessing] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadReturns = useCallback(() => {
    setReturns(getPharmacyReturnsDB() as PharmacyReturn[]);
  }, []);

  useEffect(() => {
    const s = getHospitalSettings();
    setCurrency(s.currency);
    loadReturns();
  }, [loadReturns]);

  // If not verified, show password screen
  if (!pwdVerified) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Return Medicine — Verify</h3>
          <p className="text-sm text-slate-500 mb-4">Enter the password to access medicine returns</p>
          <input
            type="password"
            className="form-input mb-2"
            placeholder="Enter password"
            value={pwdInput}
            onChange={e => { setPwdInput(e.target.value); if (pwdError) setPwdError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') verifyPwd(); }}
            autoFocus
          />
          {pwdError && <p className="text-red-500 text-xs mb-2">{pwdError}</p>}
          <button onClick={verifyPwd} className="btn btn-primary w-full">Verify & Continue</button>
          <p className="text-xs text-slate-400 mt-3">Password is set by admin in Settings</p>
        </div>
      </div>
    );
  }

  /* ==================== SLIP SEARCH ==================== */

  const searchSlip = () => {
    const q = slipQuery.trim();
    if (!q) {
      setSearchError('Please enter a Serial No');
      setFoundSale(null);
      setItemStates({});
      setAllSelected(false);
      return;
    }
    // Pull sales from SQLite (works for both Electron host and LAN browsers)
    const sales = getPharmacySalesDB() as PharmacySale[];
    if (sales.length === 0) {
      setSearchError('No sales found in database. Make sure the main app is running and has sales.');
      setFoundSale(null);
      setItemStates({});
      setAllSelected(false);
      return;
    }
    // ONLY match by returnCode (the random alphanumeric code printed on the slip).
    // No other identifier works — this is the only way to find a sale for returns.
    // Case-insensitive, ignoring whitespace.
    const normalizedQ = q.replace(/\s/g, '').toLowerCase();
    const sale = sales.find((s) => {
      if (!s.returnCode) return false;
      return s.returnCode.toLowerCase() === normalizedQ;
    });
    if (!sale) {
      setSearchError(`No sale found with Serial No "${q}". Please check the slip and try again.`);
      setFoundSale(null);
      setItemStates({});
      setAllSelected(false);
      return;
    }
    setSearchError('');
    setFoundSale(sale);
    setLastReturn(null);
    // Initialize item states: all selected, full quantity
    const states: Record<string, ItemReturnState> = {};
    for (const item of sale.items) {
      states[item.medicineId] = { selected: true, returnQty: item.quantity };
    }
    setItemStates(states);
    setAllSelected(true);
  };

  const clearSearch = () => {
    setSlipQuery('');
    setFoundSale(null);
    setSearchError('');
    setItemStates({});
    setAllSelected(false);
    setLastReturn(null);
  };

  /* ==================== ITEM SELECTION ==================== */

  const toggleItem = (medicineId: string) => {
    setItemStates((prev) => {
      const current = prev[medicineId];
      const newStates = {
        ...prev,
        [medicineId]: { ...current, selected: !current.selected },
      };
      // Update allSelected
      const allItems = foundSale?.items || [];
      if (allItems.length > 0) {
        setAllSelected(allItems.every((it) => newStates[it.medicineId]?.selected));
      }
      return newStates;
    });
  };

  const toggleSelectAll = () => {
    if (!foundSale) return;
    const newState = !allSelected;
    setAllSelected(newState);
    setItemStates((prev) => {
      const updated = { ...prev };
      for (const item of foundSale.items) {
        updated[item.medicineId] = {
          ...updated[item.medicineId],
          selected: newState,
        };
      }
      return updated;
    });
  };

  const updateReturnQty = (medicineId: string, qty: number) => {
    if (!foundSale) return;
    const item = foundSale.items.find((it) => it.medicineId === medicineId);
    if (!item) return;
    const clampedQty = Math.max(1, Math.min(item.quantity, Math.floor(qty)));
    setItemStates((prev) => ({
      ...prev,
      [medicineId]: { ...prev[medicineId], returnQty: clampedQty },
    }));
  };

  /* ==================== CALCULATIONS ==================== */

  const selectedItems = foundSale
    ? foundSale.items.filter((it) => itemStates[it.medicineId]?.selected)
    : [];

  const totalRefund = selectedItems.reduce((sum, it) => {
    const rQty = itemStates[it.medicineId]?.returnQty || 0;
    return sum + it.price * rQty;
  }, 0);

  /* ==================== PROCESS RETURN ==================== */

  const processReturn = () => {
    if (!foundSale) {
      showToast('No sale selected', 'error');
      return;
    }
    if (selectedItems.length === 0) {
      showToast('Please select at least one item to return', 'error');
      return;
    }

    setProcessing(true);

    try {
      // 1. Add stock back for each selected item (use store.ts helpers so it
      //    syncs across LAN via SQLite, not just localStorage)
      const medicines = getMedicines();
      const returnItems: ReturnItem[] = [];

      for (const item of selectedItems) {
        const rQty = itemStates[item.medicineId]?.returnQty || 0;
        if (rQty <= 0) continue;

        const med = medicines.find((m: any) => m.id === item.medicineId);
        if (med) {
          updateMedicine(med.id, { stock: (med.stock || 0) + rQty });
        }

        returnItems.push({
          medicineId: item.medicineId,
          name: item.name,
          quantity: rQty,
          price: item.price,
        });
      }

      // 2. Save return record
      const sessionData = JSON.parse(
        typeof window !== 'undefined'
          ? localStorage.getItem('baga_session') || '{}'
          : '{}'
      );
      const refund = returnItems.reduce((sum, ri) => sum + ri.price * ri.quantity, 0);

      const returnRecord: PharmacyReturn = {
        id: genId(),
        slipId: foundSale.id,
        slipBillSerial: foundSale.billSerial,
        returnCode: foundSale.returnCode,
        patientNo: foundSale.patientNo,
        patientName: foundSale.patientName,
        items: returnItems,
        totalRefund: refund,
        returnedBy: sessionData.name || 'Pharmacist',
        date: todayStr(),
        time: timeStr(),
      };

      addPharmacyReturnDB(returnRecord);

      // 3. Update UI
      loadReturns();
      setLastReturn(returnRecord);
      showToast(
        `Return processed! ${currency} ${refund.toLocaleString()} refunded for ${returnItems.length} item(s)`,
        'success'
      );

      // Clear the sale view
      setFoundSale(null);
      setItemStates({});
      setAllSelected(false);
      setSlipQuery('');
    } catch (err) {
      console.error('Return processing failed:', err);
      showToast('Failed to process return. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  /* ==================== PRINT RETURN SLIP ==================== */

  const printReturnSlip = async () => {
    if (!lastReturn) return;
    try {
      const { hospitalName, hospitalLogo, hospitalAddress, hospitalPhone } = await getPrintHeader();
      const cur = currency;

      const itemRows = lastReturn.items
        .map((it, i) => {
          const alt = i % 2 === 0 ? '#fff' : '#f8fafc';
          const lineTotal = it.price * it.quantity;
          return `<tr style="background:${alt};">
            <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
            <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;font-weight:600;">${it.name}</td>
            <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;text-align:center;">${it.quantity}</td>
            <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;text-align:right;">${cur} ${it.price.toLocaleString()}</td>
            <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${cur} ${lineTotal.toLocaleString()}</td>
          </tr>`;
        })
        .join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Return Slip</title><style>
        @page{size:80mm auto;margin:3mm;}
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;font-size:11px;width:80mm;margin:0 auto;}
        .header{text-align:center;padding:6px 0;border-bottom:2px dashed #cbd5e1;}
        .logo{width:48px;height:48px;object-fit:contain;}
        .hname{font-size:14px;font-weight:800;color:#0c2340;letter-spacing:1px;}
        .hsub{font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;}
        .haddr{font-size:8px;color:#64748b;margin-top:1px;}
        .hphone{font-size:8px;color:#64748b;}
        .title-bar{text-align:center;padding:5px 0;border-bottom:1px dashed #e2e8f0;border-top:1px dashed #e2e8f0;background:#fef2f2;}
        .title-bar h3{font-size:13px;font-weight:800;color:#991b1b;letter-spacing:1px;}
        .info{padding:4px 0;border-bottom:1px dashed #e2e8f0;}
        .info-row{display:flex;justify-content:space-between;font-size:10px;padding:1px 0;}
        .info-row .label{color:#64748b;font-weight:600;}
        .info-row .value{color:#1e293b;font-weight:500;}
        table{width:100%;border-collapse:collapse;margin-top:4px;}
        th{padding:3px 6px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0c2340;background:#f1f5f9;border-bottom:2px solid #0c2340;text-align:left;}
        td{padding:3px 6px;font-size:10px;border-bottom:1px solid #f1f5f9;}
        .totals{padding:4px 0;}
        .grand-total{display:flex;justify-content:space-between;font-size:14px;font-weight:900;color:#991b1b;padding:6px 0;border-top:2px solid #991b1b;border-bottom:2px solid #991b1b;margin-top:4px;}
        .footer{text-align:center;padding:6px 0;margin-top:4px;border-top:2px dashed #cbd5e1;}
        .footer .ty{font-size:9px;color:#64748b;font-style:italic;}
        .footer .info{font-size:7px;color:#94a3b8;}
        @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
      </style></head><body>
        <div class="header">
          ${hospitalLogo ? `<img class="logo" src="${hospitalLogo}" alt="" />` : ''}
          <div class="hname">${hospitalName}</div>
          ${hospitalAddress ? `<div class="haddr">${hospitalAddress}</div>` : ''}
          ${hospitalPhone ? `<div class="hphone">${hospitalPhone}</div>` : ''}
          <div class="hsub">Pharmacy Department</div>
        </div>
        <div class="title-bar"><h3>MEDICINE RETURN SLIP</h3></div>
        <div class="info">
          <div class="info-row"><span class="label">Return ID:</span><span class="value">${lastReturn.id.slice(-6).toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Original Slip Serial:</span><span class="value">${lastReturn.slipBillSerial || lastReturn.slipId.slice(-6).toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Patient:</span><span class="value">${lastReturn.patientName}</span></div>
          <div class="info-row"><span class="label">Returned By:</span><span class="value">${lastReturn.returnedBy}</span></div>
          <div class="info-row"><span class="label">Date:</span><span class="value">${lastReturn.date} ${lastReturn.time}</span></div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="totals">
          <div class="grand-total"><span>TOTAL REFUND</span><span>${cur} ${lastReturn.totalRefund.toLocaleString()}</span></div>
        </div>
        <div class="footer">
          <div class="ty">Items returned to stock</div>
          <div class="info">Computer Generated | ${lastReturn.date} ${lastReturn.time}</div>
        </div>
      </body></html>`;
      triggerPrint(html);
    } catch (err) {
      console.error('Failed to print return slip:', err);
      showToast('Failed to print return slip', 'error');
    }
  };

  /* ==================== RENDER ==================== */

  const totalReturnsCount = returns.length;
  const todayReturnsCount = returns.filter((r) => r.date === todayStr()).length;
  const totalRefundAmount = returns.reduce((sum, r) => sum + r.totalRefund, 0);
  const todayRefundAmount = returns.filter((r) => r.date === todayStr()).reduce((sum, r) => sum + r.totalRefund, 0);

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Return Medicine</h2>
          <p className="text-sm text-slate-500">Process medicine returns by Serial No</p>
        </div>
        {lastReturn && (
          <button onClick={printReturnSlip} className="btn btn-primary">
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Return Slip
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-rose-200 bg-rose-50">
          <p className="text-xs text-rose-600 font-medium">Total Returns</p>
          <p className="text-2xl font-bold text-rose-700">{totalReturnsCount}</p>
        </div>
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Today&apos;s Returns</p>
          <p className="text-2xl font-bold text-amber-700">{todayReturnsCount}</p>
        </div>
        <div className="stat-card card-hover border border-red-200 bg-red-50">
          <p className="text-xs text-red-600 font-medium">Total Refunded</p>
          <p className="text-lg font-bold text-red-700">{currency} {totalRefundAmount.toLocaleString()}</p>
        </div>
        <div className="stat-card card-hover border border-orange-200 bg-orange-50">
          <p className="text-xs text-orange-600 font-medium">Today&apos;s Refund</p>
          <p className="text-lg font-bold text-orange-700">{currency} {todayRefundAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Slip Serial Search Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search Sale by Serial No
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Enter the Serial No printed on the slip (e.g. 3fgT4et) to find the sale and process return</p>
        </div>
        <div className="p-5">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              <input
                type="text"
                className="form-input pl-10"
                placeholder="Enter Serial No from slip (e.g. 3fgT4et)..."
                value={slipQuery}
                onChange={(e) => {
                  setSlipQuery(e.target.value);
                  if (searchError) setSearchError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') searchSlip();
                }}
                autoFocus
              />
            </div>
            <button onClick={searchSlip} className="btn btn-primary">
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
            {(foundSale || searchError) && (
              <button onClick={clearSearch} className="btn btn-outline">
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            )}
          </div>
          {searchError && (
            <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {searchError}
            </div>
          )}
        </div>
      </div>

      {/* Sale Details (when found) */}
      {foundSale && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Patient Info Header */}
          <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-slate-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Sale Details — Serial No: <span className="font-mono text-red-600 text-base">{foundSale.returnCode || '---------'}</span>
              </h3>
              <span className="badge badge-emerald">{foundSale.type}</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Daily Token:</span>{' '}
                <span className="font-mono font-bold text-slate-700">{foundSale.dailyToken || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500">Name:</span>{' '}
                <span className="font-semibold text-slate-800">{foundSale.patientName}</span>
              </div>
              <div>
                <span className="text-slate-500">Mobile:</span>{' '}
                <span className="text-slate-700">{foundSale.patientMobile || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500">Date:</span>{' '}
                <span className="text-slate-700">{foundSale.date}</span>
              </div>
              <div>
                <span className="text-slate-500">Time:</span>{' '}
                <span className="text-slate-700">{foundSale.time}</span>
              </div>
              <div>
                <span className="text-slate-500">Served By:</span>{' '}
                <span className="text-slate-700">{foundSale.servedBy}</span>
              </div>
            </div>
          </div>

          {/* Medicines Table */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-700 text-sm">
                Medicines ({foundSale.items.length} items)
              </h4>
              <button
                onClick={toggleSelectAll}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
              >
                {allSelected ? (
                  <>
                    <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Deselect All
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Select All
                  </>
                )}
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10 text-center">✓</th>
                    <th>#</th>
                    <th>Medicine Name</th>
                    <th>Form</th>
                    <th>Strength</th>
                    <th className="text-right">Price</th>
                    <th className="text-center">Qty Sold</th>
                    <th className="text-center">Return Qty</th>
                    <th className="text-right">Return Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {foundSale.items.map((item, i) => {
                    const state = itemStates[item.medicineId] || { selected: false, returnQty: item.quantity };
                    const returnAmt = state.selected ? item.price * state.returnQty : 0;
                    return (
                      <tr
                        key={item.medicineId}
                        className={state.selected ? 'bg-emerald-50/50' : 'opacity-60'}
                      >
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={state.selected}
                            onChange={() => toggleItem(item.medicineId)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="text-sm text-slate-400">{i + 1}</td>
                        <td>
                          <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.genericName}</p>
                        </td>
                        <td>
                          <span className="badge badge-blue text-xs">{item.form}</span>
                        </td>
                        <td className="text-sm text-slate-600">{item.strength}</td>
                        <td className="text-right text-sm text-slate-700">
                          {currency} {item.price.toLocaleString()}
                        </td>
                        <td className="text-center">
                          <span className="badge badge-amber text-xs">{item.quantity}</span>
                        </td>
                        <td className="text-center">
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={state.returnQty}
                            onChange={(e) => updateReturnQty(item.medicineId, Number(e.target.value) || 1)}
                            disabled={!state.selected}
                            className="w-16 h-8 text-center border border-slate-300 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="text-right text-sm font-bold text-emerald-700">
                          {state.selected ? `${currency} ${returnAmt.toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary & Process */}
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">{selectedItems.length}</span> of {foundSale.items.length} items selected
                </p>
                {selectedItems.length > 0 && (
                  <p className="text-lg font-bold text-rose-700">
                    Total Refund: {currency} {totalRefund.toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={processReturn}
                disabled={selectedItems.length === 0 || processing}
                className="btn btn-primary"
              >
                {processing ? (
                  <>
                    <svg className="w-4 h-4 inline mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Process Return ({selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Return History</h3>
          <span className="badge badge-amber">{totalReturnsCount} returns</span>
        </div>
        {returns.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <p className="text-slate-400 font-medium">No returns recorded yet</p>
            <p className="text-slate-300 text-sm mt-1">Search a Slip Serial No above to process a return</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Serial No</th>
                  <th>Patient</th>
                  <th className="text-center">Items</th>
                  <th className="text-right">Refund</th>
                  <th>Returned By</th>
                </tr>
              </thead>
              <tbody>
                {returns
                  .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                  .map((r, i) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="text-slate-400 text-sm">{i + 1}</td>
                      <td className="font-medium text-slate-700">{r.date}</td>
                      <td className="text-slate-500">{r.time}</td>
                      <td>
                        <span className="font-mono text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">
                          {r.returnCode || r.slipBillSerial || r.slipId.slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <p className="font-semibold text-slate-800 text-sm">{r.patientName}</p>
                        <p className="text-xs text-slate-400">{r.patientNo}</p>
                      </td>
                      <td className="text-center">
                        <span className="badge badge-blue text-xs">{r.items.length}</span>
                      </td>
                      <td className="text-right font-bold text-rose-600">
                        {currency} {r.totalRefund.toLocaleString()}
                      </td>
                      <td className="text-sm text-slate-500">{r.returnedBy}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}