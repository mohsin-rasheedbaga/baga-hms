'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  searchPatients, searchMedicines, getMedicines, updateMedicine,
  addPatient, genId, todayStr, timeStr, getHospitalSettings,
  getExpiredMedicines, getLowStockMedicines,
  getPharmacySales, addPharmacySale, getOutdoorCounter, setOutdoorCounter,
} from '@/lib/store';
import type { Patient, MedicineItem } from '@/lib/types';
import { triggerPrint } from '@/lib/print-utils';

/* ==================== LOCAL TYPES ==================== */
interface CodeItem {
  medicineId: string;
  name: string;
  genericName: string;
  form: string;
  strength: string;
  packing: string;
  price: number;
  days: number;
  dosage: string;
  frequency: string;
  instructions: string;
}

interface CartItem {
  medicineId: string;
  name: string;
  genericName: string;
  form: string;
  strength: string;
  packing: string;
  price: number;
  quantity: number;
  total: number;
  days: number;
  dosage: string;
  frequency: string;
}

interface PharmacySale {
  id: string;
  patientNo: string;
  patientName: string;
  patientMobile: string;
  type: 'Indoor' | 'Outdoor';
  items: CartItem[];
  totalAmount: number;
  date: string;
  time: string;
  servedBy: string;
  paymentMethod: 'Cash' | 'Card' | 'Online';
}

export default function PharmacyPOSPage() {
  /* ==================== SHARED ==================== */
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [currency, setCurrency] = useState('Rs.');
  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const s = getHospitalSettings();
    setCurrency(s.currency);
  }, []);

  /* ==================== POINT OF SALE ==================== */
  const [patientMode, setPatientMode] = useState<'Indoor' | 'Outdoor'>('Indoor');

  // Indoor patient search
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Outdoor patient form
  const [outdoorName, setOutdoorName] = useState('');
  const [outdoorMobile, setOutdoorMobile] = useState('');
  const [outdoorAge, setOutdoorAge] = useState('');
  const [outdoorGender, setOutdoorGender] = useState('Male');
  const [outdoorNo, setOutdoorNo] = useState('');

  // Medicine search
  const [medQuery, setMedQuery] = useState('');
  const [medResults, setMedResults] = useState<MedicineItem[]>([]);
  const [showMedDropdown, setShowMedDropdown] = useState(false);
  const medSearchRef = useRef<HTMLInputElement>(null);
  const outdoorNameRef = useRef<HTMLInputElement>(null);
  const outdoorMobileRef = useRef<HTMLInputElement>(null);
  const outdoorAgeRef = useRef<HTMLInputElement>(null);

  // Bill modal
  const [saleBill, setSaleBill] = useState<PharmacySale | null>(null);
  const [billDiscount, setBillDiscount] = useState(0);
  const [discountMode, setDiscountMode] = useState<'percentage' | 'amount'>('percentage');
  const [discountType, setDiscountType] = useState<'patient' | 'prescriber'>('patient');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Online'>('Cash');

  // Code (Prescription Builder)
  const [codeItems, setCodeItems] = useState<CodeItem[]>([]);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Sale history (for stats)
  const [sales, setSales] = useState<PharmacySale[]>([]);
  const loadSales = useCallback(() => setSales(getPharmacySales()), []);

  // Inventory (for alerts & stock deduction)
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [showAlerts, setShowAlerts] = useState(true);
  const [alerts, setAlerts] = useState<{type: 'expired' | 'low'; medicines: string[]}>({type:'expired', medicines:[]});

  const loadInventory = useCallback(() => {
    setMedicines(getMedicines());
  }, []);

  useEffect(() => { loadSales(); loadInventory(); setLoading(false); }, [loadSales, loadInventory]);
  useEffect(() => { setOutdoorNo(`OUT-${String(getOutdoorCounter()).padStart(4, '0')}`); }, []);

  // POS Alerts
  useEffect(() => {
    const expired = getExpiredMedicines();
    const lowStock = getLowStockMedicines();
    const expiredNames = expired.map(m => m.name);
    const lowNames = lowStock.map(m => `${m.name} (${m.stock} left)`);
    if (expiredNames.length > 0 || lowNames.length > 0) {
      setAlerts({
        type: expiredNames.length > 0 ? 'expired' : 'low',
        medicines: [...expiredNames, ...lowNames]
      });
    } else {
      setAlerts({type:'expired', medicines:[]});
    }
  }, [medicines]);

  // Stats
  const todaySales = sales.filter(s => s.date === todayStr());
  const todayTotal = todaySales.reduce((a, s) => a + s.totalAmount, 0);
  const todayIndoor = todaySales.filter(s => s.type === 'Indoor').length;
  const todayOutdoor = todaySales.filter(s => s.type === 'Outdoor').length;

  // Patient search handler
  const handlePatientSearch = (q: string) => {
    setPatientQuery(q);
    if (q.length < 1) { setPatientResults([]); return; }
    setPatientResults(searchPatients(q));
  };

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setPatientQuery('');
    setPatientResults([]);
  };

  const clearPatient = () => {
    setSelectedPatient(null);
    setPatientQuery('');
    setPatientResults([]);
  };

  // Medicine search handler
  const handleMedSearch = (q: string) => {
    setMedQuery(q);
    if (q.length < 1) { setMedResults([]); setShowMedDropdown(false); return; }
    setMedResults(searchMedicines(q));
    setShowMedDropdown(true);
  };

  // Barcode scan handler
  const handleBarcodeScan = async () => {
    try {
      const isEl = typeof window !== 'undefined' && !!(window as any).bagaAPI;
      if (isEl) {
        const result = await (window as any).bagaAPI.scanBarcode();
        if (result.success && result.data) {
          setMedQuery(result.data);
          const found = searchMedicines(result.data);
          if (found.length > 0) {
            addToCode(found[0]);
          } else {
            showToast(`No medicine found for barcode: ${result.data}`, 'error');
          }
        }
      } else {
        // Browser fallback - prompt for barcode
        const barcode = prompt('Enter/Scan barcode:');
        if (barcode) {
          setMedQuery(barcode);
          const found = searchMedicines(barcode);
          if (found.length > 0) {
            addToCode(found[0]);
          } else {
            showToast(`No medicine found for barcode: ${barcode}`, 'error');
          }
        }
      }
    } catch (e) {
      showToast('Barcode scan failed', 'error');
    }
  };

  const addToCode = (med: MedicineItem) => {
    const existing = codeItems.find(c => c.medicineId === med.id);
    if (existing) {
      // Already in code - show toast
      showToast('Medicine already in code. Use +/- quantity or change days.', 'error');
    } else {
      setCodeItems([...codeItems, {
        medicineId: med.id, name: med.name, genericName: med.genericName,
        form: med.form, strength: med.strength, packing: med.packing,
        price: med.price, days: 7, dosage: '1 tablet', frequency: 'TID (3 times a day)', instructions: '',
      }]);
    }
    setMedQuery('');
    setMedResults([]);
    setShowMedDropdown(false);
    setTimeout(() => medSearchRef.current?.focus(), 50);
  };

  const updateCodeItemDays = (medId: string, days: number) => {
    setCodeItems(codeItems.map(c => c.medicineId === medId ? { ...c, days: Math.max(1, days) } : c));
  };
  const updateCodeItemDosage = (medId: string, dosage: string) => {
    setCodeItems(codeItems.map(c => c.medicineId === medId ? { ...c, dosage } : c));
  };
  const updateCodeItemFrequency = (medId: string, frequency: string) => {
    setCodeItems(codeItems.map(c => c.medicineId === medId ? { ...c, frequency } : c));
  };
  const removeFromCode = (medId: string) => {
    setCodeItems(codeItems.filter(c => c.medicineId !== medId));
  };

  const addAllToCart = () => {
    if (codeItems.length === 0) return;
    const count = codeItems.length;
    setCart(prevCart => {
      let newCart = [...prevCart];
      for (const ci of codeItems) {
        const existing = newCart.find(c => c.medicineId === ci.medicineId);
        if (existing) {
          newCart = newCart.map(c =>
            c.medicineId === ci.medicineId
              ? { ...c, days: ci.days, dosage: ci.dosage, frequency: ci.frequency, quantity: c.quantity + 1, total: (c.quantity + 1) * c.price }
              : c
          );
        } else {
          newCart.push({
            medicineId: ci.medicineId, name: ci.name, genericName: ci.genericName,
            form: ci.form, strength: ci.strength, packing: ci.packing,
            price: ci.price, quantity: 1, total: ci.price,
            days: ci.days, dosage: ci.dosage, frequency: ci.frequency,
          });
        }
      }
      return newCart;
    });
    setCodeItems([]);
    showToast(`${count} medicine(s) added to cart`, 'success');
  };

  const codeTotal = codeItems.reduce((a, c) => a + c.price, 0);

  const updateCartQty = (medId: string, qty: number) => {
    if (qty < 1) {
      setCart(cart.filter(c => c.medicineId !== medId));
    } else {
      setCart(cart.map(c => c.medicineId === medId ? { ...c, quantity: qty, total: qty * c.price } : c));
    }
  };

  const removeFromCart = (medId: string) => {
    setCart(cart.filter(c => c.medicineId !== medId));
  };

  const cartTotal = cart.reduce((a, c) => a + c.total, 0);

  const clearCart = () => {
    setCart([]);
  };

  const resetSale = () => {
    clearCart();
    setCodeItems([]);
    setSelectedPatient(null);
    setPatientQuery('');
    setPatientResults([]);
    setOutdoorName('');
    setOutdoorMobile('');
    setOutdoorAge('');
    setOutdoorGender('Male');
  };

  // Computed discount amount
  const getDiscountAmount = () => {
    if (!saleBill) return 0;
    if (discountMode === 'percentage') {
      return Math.round(saleBill.totalAmount * billDiscount / 100);
    } else {
      return Math.min(billDiscount, saleBill.totalAmount);
    }
  };

  const completeSale = () => {
    if (cart.length === 0) { showToast('Add at least one medicine to the cart', 'error'); return; }

    let patientNo = '';
    let patientName = '';
    let patientMobile = '';

    if (patientMode === 'Indoor') {
      if (!selectedPatient) { showToast('Select a patient first', 'error'); return; }
      patientNo = selectedPatient.patientNo;
      patientName = selectedPatient.name;
      patientMobile = selectedPatient.mobile;
    } else {
      if (!outdoorName.trim()) { showToast('Enter patient name', 'error'); return; }
      if (!outdoorMobile.trim()) { showToast('Enter patient mobile number', 'error'); return; }
      const counter = getOutdoorCounter();
      patientNo = `OUT-${String(counter).padStart(4, '0')}`;
      patientName = outdoorName.trim();
      patientMobile = outdoorMobile.trim();

      // Create a minimal patient record
      addPatient({
        id: genId(),
        patientNo,
        name: patientName,
        fatherName: '',
        mobile: patientMobile,
        age: outdoorAge || '-',
        gender: outdoorGender,
        address: '',
        cardStatus: 'Expired',
        cardExpiry: '-',
        totalVisits: 1,
        lastVisit: todayStr(),
        regDate: todayStr(),
      });
      setOutdoorCounter(counter + 1);
      setOutdoorNo(`OUT-${String(counter + 1).padStart(4, '0')}`);
    }

    const sale: PharmacySale = {
      id: genId(),
      patientNo,
      patientName,
      patientMobile,
      type: patientMode,
      items: [...cart],
      totalAmount: cartTotal,
      date: todayStr(),
      time: timeStr(),
      servedBy: (typeof window !== 'undefined' && localStorage.getItem('baga_session')) ? JSON.parse(localStorage.getItem('baga_session')!).name || 'Pharmacist' : 'Pharmacist',
      paymentMethod,
    };

    addPharmacySale(sale);
    // Deduct stock for sold medicines
    for (const item of cart) {
      const meds = getMedicines();
      const med = meds.find(m => m.id === item.medicineId);
      if (med) {
        updateMedicine(med.id, { stock: Math.max(0, med.stock - item.quantity) });
      }
    }
    loadInventory();
    showToast(`Sale completed! ${currency} ${cartTotal.toLocaleString()}`, 'success');
    setSaleBill(sale);
    setBillDiscount(0);
    setDiscountMode('percentage');
    setDiscountType('patient');
    loadSales();
    // FIX: Auto-print bill slip after sale
    setTimeout(() => {
      printBillSlip();
    }, 500);
  };

  const closeBill = () => {
    setSaleBill(null);
    setBillDiscount(0);
    setDiscountMode('percentage');
    setDiscountType('patient');
    setPaymentMethod('Cash');
    resetSale();
  };

  const printBillSlip = async () => {
    if (!saleBill) return;
    try {
      const discountAmt = getDiscountAmount();
      const grandTotal = saleBill.totalAmount - discountAmt;
      let hospitalName = 'BAGA HOSPITAL';
      let hospitalLogo = '';
      let hospitalAddress = '';
      let hospitalPhone = '';
      let receiptFooter = '';
      const isEl = typeof window !== 'undefined' && !!(window as any).bagaAPI;
      if (isEl) {
        try {
          const licenseInfo = await (window as any).bagaAPI.getFullLicenseInfo();
          if (licenseInfo && licenseInfo.hospitalName) hospitalName = licenseInfo.hospitalName;
          if (licenseInfo && licenseInfo.hospitalAddress) hospitalAddress = licenseInfo.hospitalAddress;
          if (licenseInfo && licenseInfo.hospitalPhone) hospitalPhone = licenseInfo.hospitalPhone;
        } catch (e) {}
        try {
          const logoResult = await (window as any).bagaAPI.getLogoBase64();
          if (logoResult.success) hospitalLogo = logoResult.data;
        } catch (e) {}
      }
      // Fallback to hospital settings for address/phone
      try {
        const hs = getHospitalSettings() as any;
        if (!hospitalAddress && hs.address) hospitalAddress = hs.address;
        if (!hospitalPhone && hs.phone) hospitalPhone = hs.phone;
        if (hs.receiptFooter) receiptFooter = hs.receiptFooter;
      } catch {}
      const cur = currency;
      const discountLabel = discountMode === 'percentage'
        ? `${billDiscount}%`
        : `${cur} ${billDiscount.toLocaleString()}`;
      const itemRows = saleBill.items.map((it, i) => {
        const alt = i % 2 === 0 ? '#fff' : '#f8fafc';
        return `<tr style="background:${alt};">
          <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
          <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;font-weight:600;">${it.name}</td>
          <td style="padding:3px 6px;font-size:9px;border-bottom:1px solid #e2e8f0;">${it.form}</td>
          <td style="padding:3px 6px;font-size:9px;border-bottom:1px solid #e2e8f0;">${it.strength}</td>
          <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;text-align:right;">${cur} ${it.price.toLocaleString()}</td>
          <td style="padding:3px 6px;font-size:9px;border-bottom:1px solid #e2e8f0;text-align:center;">${it.days || '-'}</td>
          <td style="padding:3px 6px;font-size:9px;border-bottom:1px solid #e2e8f0;text-align:center;">${it.dosage || '-'}</td>
          <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;text-align:center;">${it.quantity}</td>
          <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${cur} ${it.total.toLocaleString()}</td>
        </tr>`;
      }).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pharmacy Bill</title><style>
        @page{size:80mm auto;margin:3mm;}
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;font-size:11px;width:80mm;margin:0 auto;}
        .header{text-align:center;padding:6px 0;border-bottom:2px dashed #cbd5e1;}
        .logo{width:32px;height:32px;object-fit:contain;}
        .hname{font-size:14px;font-weight:800;color:#0c2340;letter-spacing:1px;}
        .hsub{font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;}
        .info{padding:4px 0;border-bottom:1px dashed #e2e8f0;}
        .info-row{display:flex;justify-content:space-between;font-size:10px;padding:1px 0;}
        .info-row .label{color:#64748b;font-weight:600;}
        .info-row .value{color:#1e293b;font-weight:500;}
        .title-bar{text-align:center;padding:4px 0;border-bottom:1px dashed #e2e8f0;border-top:1px dashed #e2e8f0;}
        .title-bar h3{font-size:12px;font-weight:800;color:#0c2340;letter-spacing:1px;}
        table{width:100%;border-collapse:collapse;}
        th{padding:3px 6px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0c2340;background:#f1f5f9;border-bottom:2px solid #0c2340;text-align:left;}
        td{padding:3px 6px;font-size:10px;border-bottom:1px solid #f1f5f9;}
        .totals{padding:4px 0;}
        .total-row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0;}
        .total-row.discount{color:#dc2626;}
        .grand-total{display:flex;justify-content:space-between;font-size:14px;font-weight:900;color:#0c2340;padding:4px 0;border-top:2px solid #0c2340;border-bottom:2px solid #0c2340;margin-top:4px;}
        .footer{text-align:center;padding:6px 0;margin-top:4px;border-top:2px dashed #cbd5e1;}
        .footer .ty{font-size:9px;color:#64748b;font-style:italic;}
        .footer .info{font-size:7px;color:#94a3b8;}
        @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
      </style></head><body>
        <div class="header">
          ${hospitalLogo ? `<img class="logo" src="${hospitalLogo}" alt="" />` : ''}
          <div class="hname">${hospitalName}</div>
          <div class="hsub">${hospitalAddress}${hospitalPhone ? ' | ' + hospitalPhone : ''}</div>
          <div class="hsub">Pharmacy Department</div>
        </div>
        <div class="info">
          <div class="info-row"><span class="label">Bill No:</span><span class="value">${saleBill.id.slice(-6).toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Patient:</span><span class="value">${saleBill.patientName}</span></div>
          <div class="info-row"><span class="label">ID:</span><span class="value">${saleBill.patientNo}</span></div>
          <div class="info-row"><span class="label">Mobile:</span><span class="value">${saleBill.patientMobile}</span></div>
          <div class="info-row"><span class="label">Type:</span><span class="value">${saleBill.type}</span></div>
          <div class="info-row"><span class="label">Date:</span><span class="value">${saleBill.date} ${saleBill.time}</span></div>
          <div class="info-row"><span class="label">Served By:</span><span class="value">${saleBill.servedBy}</span></div>
          <div class="info-row"><span class="label">Payment:</span><span class="value">${saleBill.paymentMethod}</span></div>
        </div>
        <div class="title-bar"><h3>Medicine Bill / Slip</h3></div>
        <table>
          <thead><tr><th>#</th><th>Medicine</th><th>Form</th><th>Str</th><th>Price</th><th>Days</th><th>Dosage</th><th>Qty</th><th>Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="totals">
          <div class="total-row"><span>Subtotal (${saleBill.items.length} items)</span><span>${cur} ${saleBill.totalAmount.toLocaleString()}</span></div>
          ${discountAmt > 0 ? `<div class="total-row discount"><span>Discount (${discountLabel} - ${discountType === 'patient' ? 'Patient' : 'Prescriber'})</span><span>-${cur} ${discountAmt.toLocaleString()}</span></div>` : ''}
          <div class="grand-total"><span>GRAND TOTAL</span><span>${cur} ${grandTotal.toLocaleString()}</span></div>
        </div>
        <div class="footer">
          <div class="ty">${receiptFooter || 'Thank you for visiting ' + hospitalName + '!'}</div>
          <div class="info">Computer Generated Bill | ${saleBill.date} ${saleBill.time}</div>
        </div>
      </body></html>`;
      triggerPrint(html);
    } catch (err) {
      console.error('Failed to print bill slip:', err);
    }
  };

  const handleMedSearchEnter = () => {
    if (medResults.length >= 1) {
      addToCode(medResults[0]);
      setTimeout(() => medSearchRef.current?.focus(), 50);
    }
  };

  const handleOutdoorFieldEnter = (field: 'name' | 'mobile' | 'age') => {
    if (field === 'name') outdoorMobileRef.current?.focus();
    else if (field === 'mobile') outdoorAgeRef.current?.focus();
    else if (field === 'age') {
      setTimeout(() => medSearchRef.current?.focus(), 50);
    }
  };

  /* ==================== RENDER ==================== */
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Sale Bill Modal */}
      {saleBill && (
        <div className="modal-overlay" onClick={closeBill}>
          <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Sale Bill</h3>
              <button onClick={closeBill} className="btn btn-outline btn-sm">Close</button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500">Patient ID:</span> <span className="font-mono font-bold text-blue-600">{saleBill.patientNo}</span></div>
                <div><span className="text-slate-500">Name:</span> <span className="font-semibold">{saleBill.patientName}</span></div>
                <div><span className="text-slate-500">Mobile:</span> <span>{saleBill.patientMobile}</span></div>
                <div><span className="text-slate-500">Type:</span> <span className={`badge ${saleBill.type === 'Indoor' ? 'badge-blue' : 'badge-amber'}`}>{saleBill.type}</span></div>
                <div><span className="text-slate-500">Date:</span> <span>{saleBill.date} {saleBill.time}</span></div>
                <div><span className="text-slate-500">Served By:</span> <span>{saleBill.servedBy}</span></div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
              <table className="data-table">
                <thead><tr><th>#</th><th>Medicine</th><th>Form</th><th>Strength</th><th className="text-right">Price</th><th className="text-center">Qty</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {saleBill.items.map((it, i) => (
                    <tr key={i}>
                      <td className="text-sm text-slate-400">{i + 1}</td>
                      <td><p className="font-semibold text-sm">{it.name}</p><p className="text-xs text-slate-400">{it.genericName}</p></td>
                      <td><span className="badge badge-blue text-xs">{it.form}</span></td>
                      <td className="text-sm">{it.strength}</td>
                      <td className="text-right text-sm">{currency} {it.price.toLocaleString()}</td>
                      <td className="text-center">
                        <span className="badge badge-amber text-xs">{it.days || '-'}</span>
                        <p className="text-xs text-slate-400">{it.dosage || '-'}</p>
                      </td>
                      <td className="text-center text-sm font-semibold">{it.quantity}</td>
                      <td className="text-right text-sm font-bold">{currency} {it.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Subtotal ({saleBill.items.length} items)</span>
                <span className="font-semibold">{currency} {saleBill.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">Discount Type</span>
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setDiscountType('patient')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${discountType === 'patient' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Patient
                  </button>
                  <button
                    onClick={() => setDiscountType('prescriber')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${discountType === 'prescriber' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Prescriber
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">Payment Method</span>
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  {(['Cash', 'Card', 'Online'] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${paymentMethod === method ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">Discount</span>
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button
                      onClick={() => { setDiscountMode('percentage'); setBillDiscount(0); }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${discountMode === 'percentage' ? 'bg-white shadow-sm text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      % Percentage
                    </button>
                    <button
                      onClick={() => { setDiscountMode('amount'); setBillDiscount(0); }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${discountMode === 'amount' ? 'bg-white shadow-sm text-orange-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {currency} Amount
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={discountMode === 'percentage' ? 100 : saleBill.totalAmount}
                    value={billDiscount}
                    onChange={e => {
                      const v = Number(e.target.value) || 0;
                      setBillDiscount(discountMode === 'percentage' ? Math.min(100, Math.max(0, v)) : Math.min(saleBill.totalAmount, Math.max(0, v)));
                    }}
                    className="w-24 h-9 text-right border border-slate-300 rounded-lg px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                    placeholder={discountMode === 'percentage' ? '0%' : '0'}
                  />
                </div>
              </div>
              {billDiscount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-500">
                    Discount ({discountMode === 'percentage' ? `${billDiscount}%` : `${currency} ${billDiscount.toLocaleString()}`} - {discountType === 'patient' ? 'Patient' : 'Prescriber'})
                  </span>
                  <span className="font-semibold text-red-500">-{currency} {getDiscountAmount().toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-3 border-t-2 border-slate-300">
                <span className="text-lg font-bold text-slate-800">Grand Total</span>
                <span className="text-2xl font-black text-emerald-700">{currency} {(saleBill.totalAmount - getDiscountAmount()).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={printBillSlip} className="btn btn-primary flex-1">
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print Slip
              </button>
              <button onClick={closeBill} className="btn btn-outline flex-1">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Pharmacy POS</h2>
        <p className="text-sm text-slate-500">Point of Sale - Medicine billing and sales</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Today&apos;s Sales</p>
          <p className="text-2xl font-bold text-emerald-700">{currency} {todayTotal.toLocaleString()}</p>
        </div>
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Total Sales Today</p>
          <p className="text-2xl font-bold text-blue-700">{todaySales.length}</p>
        </div>
        <div className="stat-card card-hover border border-purple-200 bg-purple-50">
          <p className="text-xs text-purple-600 font-medium">Indoor Patients</p>
          <p className="text-2xl font-bold text-purple-700">{todayIndoor}</p>
        </div>
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Outdoor Patients</p>
          <p className="text-2xl font-bold text-amber-700">{todayOutdoor}</p>
        </div>
      </div>

      {/* Expiry & Low Stock Alerts */}
      {showAlerts && alerts.medicines.length > 0 && (
        <div className={`border rounded-lg p-3 ${alerts.type === 'expired' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={alerts.type === 'expired' ? 'text-red-600' : 'text-amber-600'}>
                {alerts.type === 'expired' ? 'Expired' : 'Low Stock'} Alert
              </span>
              <span className="text-sm text-slate-600">{alerts.medicines.slice(0, 5).join(', ')}{alerts.medicines.length > 5 ? ` +${alerts.medicines.length - 5} more` : ''}</span>
            </div>
            <button onClick={() => setShowAlerts(false)} className="text-slate-400 hover:text-slate-600 text-sm">Dismiss</button>
          </div>
        </div>
      )}

      {/* Patient Mode Toggle + Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        {/* Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="font-semibold text-slate-700">Patient</span>
          </div>
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => { setPatientMode('Indoor'); clearPatient(); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${patientMode === 'Indoor' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              Indoor Patient (Card Holder)
            </button>
            <button
              onClick={() => { setPatientMode('Outdoor'); clearPatient(); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${patientMode === 'Outdoor' ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Outdoor Patient (Walk-in)
            </button>
          </div>
        </div>

        {/* Indoor Patient Search */}
        {patientMode === 'Indoor' && (
          <>
            {!selectedPatient ? (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                      type="text"
                      className="form-input pl-10"
                      placeholder="Search by card number (BAGA-0001) or mobile number..."
                      value={patientQuery}
                      onChange={e => handlePatientSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                {patientResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-64 overflow-y-auto">
                    {patientResults.map(p => (
                      <button
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-blue-600">{p.patientNo}</span>
                            <span className="ml-3 font-medium text-slate-700">{p.name}</span>
                            <span className="ml-2 text-xs text-slate-400">{p.gender} | {p.age} yrs</span>
                          </div>
                          <span className="text-sm text-slate-400">{p.mobile}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {patientQuery.length >= 1 && patientResults.length === 0 && (
                  <div className="mt-2 text-center py-4 text-sm text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
                    No patients found matching &ldquo;{patientQuery}&rdquo;
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {selectedPatient.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{selectedPatient.name}</p>
                      <p className="text-sm text-slate-500">
                        <span className="font-mono text-blue-600 font-semibold">{selectedPatient.patientNo}</span>
                        <span className="mx-2 text-slate-300">|</span>
                        {selectedPatient.gender}
                        <span className="mx-2 text-slate-300">|</span>
                        {selectedPatient.age} yrs
                        <span className="mx-2 text-slate-300">|</span>
                        {selectedPatient.mobile}
                      </p>
                      <p className="text-xs text-slate-400">
                        <span className={`badge ${selectedPatient.cardStatus === 'Active' ? 'badge-green' : 'badge-rose'} text-xs`}>{selectedPatient.cardStatus}</span>
                        <span className="ml-2">Visits: {selectedPatient.totalVisits}</span>
                      </p>
                    </div>
                  </div>
                  <button onClick={clearPatient} className="btn btn-outline btn-sm">Change Patient</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Outdoor Patient Form */}
        {patientMode === 'Outdoor' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                #
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">Walk-in Patient</p>
                <p className="text-xs text-amber-600">Patient No: <span className="font-mono font-bold">{outdoorNo}</span> (auto-generated)</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="form-label">Full Name *</label>
                <input ref={outdoorNameRef} type="text" className="form-input" placeholder="Patient name" value={outdoorName} onChange={e => setOutdoorName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleOutdoorFieldEnter('name'); } }} />
              </div>
              <div>
                <label className="form-label">Mobile Number *</label>
                <input ref={outdoorMobileRef} type="text" className="form-input" maxLength={11} inputMode="numeric" placeholder="03XX-XXXXXXX" value={outdoorMobile.replace(/[^0-9]/g,'')} onChange={e => setOutdoorMobile(e.target.value.replace(/[^0-9]/g,''))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleOutdoorFieldEnter('mobile'); } }} />
              </div>
              <div>
                <label className="form-label">Age</label>
                <input ref={outdoorAgeRef} type="text" className="form-input" maxLength={2} inputMode="numeric" placeholder="e.g. 35" value={outdoorAge.replace(/[^0-9]/g,'')} onChange={e => setOutdoorAge(e.target.value.replace(/[^0-9]/g,''))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleOutdoorFieldEnter('age'); } }} />
              </div>
              <div>
                <label className="form-label">Gender</label>
                <select className="form-input" value={outdoorGender} onChange={e => setOutdoorGender(e.target.value)}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Medicine Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            <span className="font-semibold text-slate-700">Add Medicine to Cart</span>
          </div>
          <span className="text-sm text-slate-400">Search by medicine name, generic name, or category</span>
        </div>
        <div className="relative">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                ref={medSearchRef}
                type="text"
                className="form-input pl-10 text-base"
                placeholder="Search medicine... e.g. Paracetamol, Amoxicillin, Vitamin C"
                value={medQuery}
                onChange={e => handleMedSearch(e.target.value)}
                onFocus={() => { if (medResults.length > 0) setShowMedDropdown(true); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleMedSearchEnter(); } }}
              />
            </div>
            <button
              onClick={handleBarcodeScan}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Scan
            </button>
            {showMedDropdown && (
              <button onClick={() => { setShowMedDropdown(false); setMedResults([]); }} className="btn btn-outline btn-sm">
                Close
              </button>
            )}
          </div>
          {showMedDropdown && medResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-72 overflow-y-auto">
              {medResults.map(m => (
                <button
                  key={m.id}
                  onClick={() => addToCode(m)}
                  className="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b border-slate-100 last:border-0 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 group-hover:text-emerald-700">{m.name}</span>
                      <span className="text-xs text-slate-400 ml-2">({m.genericName})</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="badge badge-blue text-xs">{m.form}</span>
                        <span className="text-xs text-slate-500">{m.strength}</span>
                        <span className="text-xs text-slate-400">{m.packing}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-700">{currency} {m.price.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">{m.category}</p>
                      <p className="text-xs text-emerald-600 mt-1 font-medium">+ Add to Code</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {medQuery.length >= 1 && showMedDropdown && medResults.length === 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-sm text-slate-400">
              No medicines found matching &ldquo;{medQuery}&rdquo;
            </div>
          )}
        </div>
      </div>

      {/* ========= PRESCRIPTION CODE PANEL ========= */}
      {codeItems.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-300 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2zm-6 4h3m-3 4h3" /></svg>
              <h3 className="font-bold text-blue-800">Prescription Code ({codeItems.length} medicine{codeItems.length > 1 ? 's' : ''})</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-blue-700">{currency} {codeTotal.toLocaleString()}</span>
              <button onClick={() => setCodeItems([])} className="btn btn-outline btn-sm text-red-500 border-red-200 hover:bg-red-50">Clear Code</button>
            </div>
          </div>

          <div className="space-y-2">
            {codeItems.map((ci, idx) => (
              <div key={ci.medicineId} className="bg-white border border-blue-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded">{idx + 1}</span>
                      <span className="font-bold text-slate-800">{ci.name}</span>
                      <span className="text-xs text-slate-400">({ci.genericName})</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="badge badge-blue">{ci.form}</span>
                      <span>{ci.strength}</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-bold text-emerald-700">{currency} {ci.price.toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => removeFromCode(ci.medicineId)} className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 shrink-0" title="Remove">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Days *</label>
                    <select
                      className="form-input h-8 text-xs"
                      value={ci.days}
                      onChange={e => updateCodeItemDays(ci.medicineId, Number(e.target.value))}
                    >
                      <option value={1}>1 day</option>
                      <option value={3}>3 days</option>
                      <option value={5}>5 days</option>
                      <option value={7}>7 days</option>
                      <option value={10}>10 days</option>
                      <option value={14}>14 days</option>
                      <option value={15}>15 days</option>
                      <option value={21}>21 days</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Dosage</label>
                    <select
                      className="form-input h-8 text-xs"
                      value={ci.dosage}
                      onChange={e => updateCodeItemDosage(ci.medicineId, e.target.value)}
                    >
                      <option value="1 tablet">1 tablet</option>
                      <option value="0.5 tablet">0.5 tablet</option>
                      <option value="2 tablets">2 tablets</option>
                      <option value="1 capsule">1 capsule</option>
                      <option value="1 spoon">1 spoon (5ml)</option>
                      <option value="2 spoons">2 spoons (10ml)</option>
                      <option value="1 injection">1 injection</option>
                      <option value="as prescribed">As prescribed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">Frequency</label>
                    <select
                      className="form-input h-8 text-xs"
                      value={ci.frequency}
                      onChange={e => updateCodeItemFrequency(ci.medicineId, e.target.value)}
                    >
                      <option value="OD (once a day)">OD (Once a day)</option>
                      <option value="BID (twice a day)">BID (Twice a day)</option>
                      <option value="TID (3 times a day)">TID (3 times a day)</option>
                      <option value="QID (4 times a day)">QID (4 times a day)</option>
                      <option value="SOS (as needed)">SOS (As needed)</option>
                      <option value="At bedtime">At bedtime</option>
                      <option value="Empty stomach">Empty stomach</option>
                      <option value="After meal">After meal</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={addAllToCart} className="btn btn-primary btn-lg w-full flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Add {codeItems.length} Medicine{codeItems.length > 1 ? 's' : ''} to Cart
          </button>
        </div>
      )}

      {/* Cart / Sale Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            <h3 className="font-bold text-slate-800">
              Medicine Cart
              {cart.length > 0 && <span className="ml-2 badge badge-amber">{cart.length} item{cart.length > 1 ? 's' : ''}</span>}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              Patient: {patientMode === 'Indoor'
                ? (selectedPatient ? <span className="font-mono font-bold text-blue-600">{selectedPatient.patientNo} - {selectedPatient.name}</span> : <span className="text-red-400">Not selected</span>)
                : (outdoorName ? <span className="font-mono font-bold text-amber-600">{outdoorNo} - {outdoorName}</span> : <span className="text-red-400">Not entered</span>)
              }
            </span>
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
            <p className="text-slate-400 text-lg font-medium">Cart is empty</p>
            <p className="text-slate-300 text-sm mt-1">Search medicines above and add them to the cart</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th>Medicine</th>
                    <th>Form</th>
                    <th>Strength</th>
                    <th>Packing</th>
                    <th className="text-center">Days</th>
                    <th className="text-right">Price</th>
                    <th className="text-center w-32">Qty</th>
                    <th className="text-right">Total</th>
                    <th className="w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={item.medicineId} className="hover:bg-slate-50">
                      <td className="text-slate-400 text-sm font-medium">{idx + 1}</td>
                      <td>
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.genericName}</p>
                      </td>
                      <td><span className="badge badge-blue">{item.form}</span></td>
                      <td className="text-sm text-slate-600">{item.strength}</td>
                      <td className="text-sm text-slate-500">{item.packing}</td>
                      <td className="text-center">
                        <span className="badge badge-amber text-xs">{item.days} days</span>
                      </td>
                      <td className="text-right font-medium text-slate-700">{currency} {item.price.toLocaleString()}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => updateCartQty(item.medicineId, item.quantity - 1)}
                            className="w-8 h-8 rounded-md border border-slate-300 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors font-bold"
                          >-</button>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => {
                              const v = parseInt(e.target.value) || 1;
                              updateCartQty(item.medicineId, v > 0 ? v : 1);
                            }}
                            className="w-14 h-8 text-center border border-slate-300 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                          />
                          <button
                            onClick={() => updateCartQty(item.medicineId, item.quantity + 1)}
                            className="w-8 h-8 rounded-md border border-slate-300 flex items-center justify-center text-slate-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-colors font-bold"
                          >+</button>
                        </div>
                      </td>
                      <td className="text-right font-bold text-emerald-700">{currency} {item.total.toLocaleString()}</td>
                      <td>
                        <button
                          onClick={() => removeFromCart(item.medicineId)}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Remove from cart"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cart Footer - Total + Actions */}
            <div className="border-t-2 border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                    <p className="text-xs text-slate-400">Items</p>
                    <p className="text-lg font-bold text-slate-700">{cart.length}</p>
                  </div>
                  <div className="bg-white border border-2 border-emerald-200 rounded-lg px-6 py-3">
                    <p className="text-xs text-emerald-500 font-medium">Grand Total</p>
                    <p className="text-2xl font-bold text-emerald-700">{currency} {cartTotal.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={clearCart} className="btn btn-outline flex-1 sm:flex-none">
                    Clear Cart
                  </button>
                  <button onClick={completeSale} className="btn btn-success btn-lg flex-1 sm:flex-none px-8">
                    <svg className="w-5 h-5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Complete Sale
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Sales */}
      {todaySales.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <h3 className="font-bold text-slate-800">Today&apos;s Sales ({todaySales.length})</h3>
            </div>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="data-table">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th>Time</th>
                  <th>Patient No</th>
                  <th>Patient Name</th>
                  <th>Type</th>
                  <th>Medicines</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {todaySales.sort((a, b) => b.time.localeCompare(a.time)).map(s => (
                  <tr key={s.id}>
                    <td className="text-sm text-slate-500 whitespace-nowrap">{s.time}</td>
                    <td className="font-mono font-bold text-blue-600 text-sm">{s.patientNo}</td>
                    <td className="font-medium text-sm">{s.patientName}</td>
                    <td>
                      <span className={`badge ${s.type === 'Indoor' ? 'badge-blue' : 'badge-amber'}`}>
                        {s.type}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {s.items.slice(0, 3).map((it, i) => (
                          <span key={i} className="badge text-xs">{it.name} x{it.quantity}</span>
                        ))}
                        {s.items.length > 3 && (
                          <span className="badge text-xs badge-amber">+{s.items.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td className="text-right font-bold text-emerald-700">{currency} {s.totalAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
