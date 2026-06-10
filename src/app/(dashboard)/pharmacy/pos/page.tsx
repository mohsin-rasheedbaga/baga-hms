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

  // Direct add to cart (for product grid)
  const directAddToCart = (med: MedicineItem) => {
    const existingInCart = cart.find(c => c.medicineId === med.id);
    if (existingInCart) {
      updateCartQty(med.id, existingInCart.quantity + 1);
      showToast(`Added another ${med.name} to cart`, 'success');
    } else {
      setCart([...cart, {
        medicineId: med.id, name: med.name, genericName: med.genericName,
        form: med.form, strength: med.strength, packing: med.packing,
        price: med.price, quantity: 1, total: med.price,
        days: 7, dosage: '1 tablet', frequency: 'TID (3 times a day)',
      }]);
      showToast(`${med.name} added to cart`, 'success');
    }
  };

  /* ==================== RENDER ==================== */
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full"></div></div>;

  return (
    <div>
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Sale Bill Modal - UNCHANGED */}
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

      {/* ==================== TWO-COLUMN LAYOUT ==================== */}
      <div className="flex gap-5 min-h-[calc(100vh-120px)]">

        {/* ==================== LEFT COLUMN ==================== */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* TOP BAR: Stats + Toggle + Alerts */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Stats Cards */}
            <div className="flex gap-3 flex-1">
              <div className="stat-card card-hover border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3 min-w-0">
                <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Today&apos;s Sales</p>
                <p className="text-lg font-bold text-emerald-700 truncate">{currency} {todayTotal.toLocaleString()}</p>
              </div>
              <div className="stat-card card-hover border border-blue-200 bg-blue-50 rounded-xl px-4 py-3 min-w-0">
                <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Total Sales</p>
                <p className="text-lg font-bold text-blue-700">{todaySales.length}</p>
              </div>
            </div>

            {/* Indoor/Outdoor Toggle - Pill Buttons */}
            <div className="flex bg-slate-100 rounded-xl p-1 shrink-0">
              <button
                onClick={() => { setPatientMode('Indoor'); clearPatient(); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${patientMode === 'Indoor' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-blue-600'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                Indoor
              </button>
              <button
                onClick={() => { setPatientMode('Outdoor'); clearPatient(); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${patientMode === 'Outdoor' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:text-amber-600'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Outdoor
              </button>
            </div>

            {/* Alerts Badge */}
            {showAlerts && alerts.medicines.length > 0 && (
              <button
                onClick={() => setShowAlerts(false)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all hover:opacity-80 ${alerts.type === 'expired' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}
                title={alerts.medicines.join(', ')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                {alerts.type === 'expired' ? 'Expired' : 'Low Stock'} ({alerts.medicines.length})
              </button>
            )}
          </div>

          {/* PATIENT SELECTION AREA */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            {patientMode === 'Indoor' && (
              <>
                {!selectedPatient ? (
                  <div className="relative">
                    <div className="relative">
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
                    {patientResults.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 border border-slate-200 rounded-xl bg-white shadow-lg max-h-64 overflow-y-auto">
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
                      <div className="mt-2 text-center py-4 text-sm text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                        No patients found matching &ldquo;{patientQuery}&rdquo;
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
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

            {/* Outdoor Patient Form - Compact Horizontal */}
            {patientMode === 'Outdoor' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-sm">#</div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Walk-in Patient</p>
                    <p className="text-xs text-amber-600">Patient No: <span className="font-mono font-bold">{outdoorNo}</span></p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="form-label">Full Name *</label>
                    <input ref={outdoorNameRef} type="text" className="form-input" placeholder="Patient name" value={outdoorName} onChange={e => setOutdoorName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleOutdoorFieldEnter('name'); } }} />
                  </div>
                  <div>
                    <label className="form-label">Mobile Number</label>
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

          {/* MEDICINE SEARCH BAR */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <svg className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  ref={medSearchRef}
                  type="text"
                  className="w-full h-12 pl-12 pr-4 rounded-2xl border-2 border-slate-200 text-base font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-all shadow-sm"
                  placeholder="Search medicine by name, generic, or category..."
                  value={medQuery}
                  onChange={e => handleMedSearch(e.target.value)}
                  onFocus={() => { if (medResults.length > 0) setShowMedDropdown(true); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleMedSearchEnter(); } }}
                />
              </div>
              <button
                onClick={handleBarcodeScan}
                className="h-12 px-5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 flex items-center gap-2 text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                title="Scan Barcode"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Scan
              </button>
            </div>
            {/* Search Results Dropdown */}
            {showMedDropdown && medResults.length > 0 && (
              <div className="absolute z-30 w-full mt-1 border border-slate-200 rounded-2xl bg-white shadow-xl max-h-72 overflow-y-auto">
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
                        <p className="text-xs text-emerald-600 mt-1 font-medium">+ Add to Code</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {medQuery.length >= 1 && showMedDropdown && medResults.length === 0 && (
              <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 text-center text-sm text-slate-400">
                No medicines found matching &ldquo;{medQuery}&rdquo;
              </div>
            )}
          </div>

          {/* PRESCRIPTION CODE BUILDER */}
          {codeItems.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-300 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2zm-6 4h3m-3 4h3" /></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-800 text-sm">Prescription Code</h3>
                    <p className="text-xs text-emerald-600">{codeItems.length} medicine{codeItems.length > 1 ? 's' : ''} &middot; {currency} {codeTotal.toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={() => setCodeItems([])} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">Clear All</button>
              </div>

              <div className="space-y-2">
                {codeItems.map((ci, idx) => (
                  <div key={ci.medicineId} className="bg-white border border-emerald-200 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded">{idx + 1}</span>
                          <span className="font-bold text-slate-800 text-sm truncate">{ci.name}</span>
                          <span className="text-xs text-slate-400 truncate">({ci.genericName})</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                          <span className="badge badge-blue text-[10px]">{ci.form}</span>
                          <span>{ci.strength}</span>
                          <span className="font-bold text-emerald-700">{currency} {ci.price.toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 font-medium">Days</label>
                            <select
                              className="form-input h-7 text-xs py-0"
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
                            <label className="text-[10px] text-slate-400 font-medium">Dosage</label>
                            <select
                              className="form-input h-7 text-xs py-0"
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
                            <label className="text-[10px] text-slate-400 font-medium">Frequency</label>
                            <select
                              className="form-input h-7 text-xs py-0"
                              value={ci.frequency}
                              onChange={e => updateCodeItemFrequency(ci.medicineId, e.target.value)}
                            >
                              <option value="OD (once a day)">OD</option>
                              <option value="BID (twice a day)">BID</option>
                              <option value="TID (3 times a day)">TID</option>
                              <option value="QID (4 times a day)">QID</option>
                              <option value="SOS (as needed)">SOS</option>
                              <option value="At bedtime">Bedtime</option>
                              <option value="Empty stomach">Empty stomach</option>
                              <option value="After meal">After meal</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => removeFromCode(ci.medicineId)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 shrink-0 transition-colors" title="Remove">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addAllToCart} className="w-full h-11 bg-emerald-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-[0.99]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Add {codeItems.length} Medicine{codeItems.length > 1 ? 's' : ''} to Cart
              </button>
            </div>
          )}

          {/* PRODUCT GRID - All Medicines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                All Medicines
                <span className="text-xs text-slate-400 font-normal">({medicines.length})</span>
              </h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {medicines.map(med => {
                const inCart = cart.find(c => c.medicineId === med.id);
                const inCode = codeItems.find(c => c.medicineId === med.id);
                return (
                  <div
                    key={med.id}
                    className={`relative bg-white rounded-2xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-all group ${med.stock === 0 ? 'opacity-60' : 'hover:border-emerald-200 cursor-pointer'}`}
                  >
                    {med.stock === 0 && (
                      <div className="absolute inset-0 bg-white/80 rounded-2xl z-10 flex items-center justify-center">
                        <span className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">Out of Stock</span>
                      </div>
                    )}
                    <div className="mb-2">
                      <p className="font-bold text-slate-800 text-sm leading-tight truncate">{med.name}</p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{med.genericName} &middot; {med.strength}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="badge badge-blue text-[10px]">{med.form}</span>
                      <span className="text-[10px] text-slate-400">Stock: {med.stock}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-600 text-sm">{currency} {med.price.toLocaleString()}</span>
                      {med.stock > 0 && (
                        <button
                          onClick={() => inCode ? addToCode(med) : directAddToCart(med)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                            inCart
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                          }`}
                          title={inCart ? 'Add more' : 'Add to cart'}
                        >
                          {inCart ? (
                            <span className="text-xs font-bold">+{inCart.quantity}</span>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ==================== RIGHT COLUMN - CART SIDEBAR ==================== */}
        <div className="w-[380px] shrink-0 sticky top-0 self-start max-h-[calc(100vh-80px)] flex flex-col">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col max-h-[calc(100vh-80px)]">

            {/* Cart Header - Green Gradient */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg leading-tight">Cart</h2>
                    {cart.length > 0 && (
                      <span className="text-emerald-100 text-xs">{cart.length} item{cart.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                {cart.length > 0 && (
                  <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-lg">{cart.length}</span>
                )}
              </div>
            </div>

            {/* Patient Quick Info */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                {patientMode === 'Indoor'
                  ? (selectedPatient
                    ? <span className="text-sm font-medium text-slate-700 truncate">{selectedPatient.patientNo} &middot; {selectedPatient.name}</span>
                    : <span className="text-sm text-slate-400">No patient selected</span>)
                  : (outdoorName
                    ? <span className="text-sm font-medium text-slate-700 truncate">{outdoorNo} &middot; {outdoorName}</span>
                    : <span className="text-sm text-slate-400">No patient selected</span>)
                }
              </div>
            </div>

            {/* Discount Section */}
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setDiscountMode('percentage')}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${discountMode === 'percentage' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-400'}`}
                  >%</button>
                  <button
                    onClick={() => setDiscountMode('amount')}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${discountMode === 'amount' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-400'}`}
                  >Flat</button>
                </div>
                <input
                  type="number"
                  min={0}
                  value={billDiscount}
                  onChange={e => {
                    const v = Number(e.target.value) || 0;
                    if (discountMode === 'percentage') {
                      setBillDiscount(Math.min(100, Math.max(0, v)));
                    } else {
                      setBillDiscount(Math.max(0, v));
                    }
                  }}
                  className="flex-1 h-8 text-right text-sm font-semibold border border-slate-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-emerald-300 focus:border-emerald-400"
                  placeholder={discountMode === 'percentage' ? '0%' : '0'}
                />
                <span className="text-[10px] text-slate-400 uppercase font-medium w-16 text-right">Discount</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
              <div className="flex gap-1.5">
                {(['Cash', 'Card', 'Online'] as const).map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      paymentMethod === method
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Cart Items List - Scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {cart.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-14 h-14 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                  <p className="text-slate-400 text-sm font-medium">Cart is empty</p>
                  <p className="text-slate-300 text-xs mt-1">Search or click medicines to add</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cart.map(item => (
                    <div key={item.medicineId} className="px-4 py-3 group hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm leading-tight truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{item.genericName}</p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.medicineId)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          title="Remove"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      {/* Qty Controls + Price - inline */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => updateCartQty(item.medicineId, item.quantity - 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors text-sm font-bold"
                          >-</button>
                          <span className="w-8 h-7 flex items-center justify-center text-sm font-bold text-slate-800 border-y border-slate-200">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQty(item.medicineId, item.quantity + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-colors text-sm font-bold"
                          >+</button>
                          <span className="text-[10px] text-slate-400 ml-1.5">@ {currency} {item.price.toLocaleString()}</span>
                        </div>
                        <span className="font-bold text-emerald-700 text-sm">{currency} {item.total.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Footer - Always Visible */}
            <div className="border-t-2 border-slate-200 bg-white p-4 space-y-3 shrink-0">
              {/* Subtotal */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold text-slate-700">{currency} {cartTotal.toLocaleString()}</span>
              </div>
              {/* Discount */}
              {billDiscount > 0 && cartTotal > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-500">
                    Discount {discountMode === 'percentage' ? `(${billDiscount}%)` : ''}
                  </span>
                  <span className="font-semibold text-red-500">
                    -{currency} {(discountMode === 'percentage' ? Math.round(cartTotal * billDiscount / 100) : Math.min(billDiscount, cartTotal)).toLocaleString()}
                  </span>
                </div>
              )}
              {/* Grand Total */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-base font-bold text-slate-800">Grand Total</span>
                <span className="text-xl font-black text-emerald-600">
                  {currency} {(cartTotal - (billDiscount > 0 && cartTotal > 0 ? (discountMode === 'percentage' ? Math.round(cartTotal * billDiscount / 100) : Math.min(billDiscount, cartTotal)) : 0)).toLocaleString()}
                </span>
              </div>
              {/* Complete Sale Button */}
              <button
                onClick={completeSale}
                className={`w-full h-12 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  cart.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-teal-700'
                }`}
                disabled={cart.length === 0}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Complete Sale
              </button>
              {/* Clear Cart */}
              {cart.length > 0 && (
                <button onClick={clearCart} className="w-full text-center text-xs text-slate-400 hover:text-red-500 font-medium transition-colors py-1">
                  Clear Cart
                </button>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}