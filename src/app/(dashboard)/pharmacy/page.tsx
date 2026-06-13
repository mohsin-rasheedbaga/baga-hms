'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  searchPatients, searchMedicines, getMedicines, addMedicine, updateMedicine, deleteMedicine,
  getMedicineCategories, getActivePrescriptions, updatePrescription, addDispense,
  getPatientCounter, setPatientCounter, addPatient, genId, todayStr, timeStr, getHospitalSettings,
  getExpiredMedicines, getLowStockMedicines,
} from '@/lib/store';
import type { Patient, Prescription, MedicineItem } from '@/lib/types';
import { triggerPrint } from '@/lib/print-utils';

/* ==================== LOCAL TYPES ==================== */
interface MedicineReturn {
  id: string;
  medicineId: string;
  medicineName: string;
  quantity: number;
  returnPrice: number;
  reason: string;
  returnedBy: string;
  date: string;
  time: string;
}

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
  discountPercent?: number;
  discountAmount?: number;
  discountType?: 'patient' | 'prescriber';
}

/* ==================== LOCAL STORAGE HELPERS ==================== */
function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}
function lsSet<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

const SALES_KEY = 'baga_pharmacy_sales';
const OUTDOOR_COUNTER_KEY = 'baga_outdoor_counter';
const RETURNS_KEY = 'baga_pharmacy_returns';

function getPharmacySales(): PharmacySale[] { return lsGet<PharmacySale[]>(SALES_KEY, []); }
function addPharmacySale(s: PharmacySale): void { const all = getPharmacySales(); all.push(s); lsSet(SALES_KEY, all); }
function getOutdoorCounter(): number { return lsGet<number>(OUTDOOR_COUNTER_KEY, 1); }
function setOutdoorCounter(n: number): void { lsSet(OUTDOOR_COUNTER_KEY, n); }
function getPharmacyReturns(): MedicineReturn[] { return lsGet<MedicineReturn[]>(RETURNS_KEY, []); }
function addPharmacyReturn(r: MedicineReturn): void { const all = getPharmacyReturns(); all.push(r); lsSet(RETURNS_KEY, all); }

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

export default function PharmacyPage() {
  const [initialTab, setInitialTab] = useState<'pos' | 'prescriptions' | 'inventory' | 'reports'>('pos');
  const [mainTab, setMainTab] = useState<'pos' | 'prescriptions' | 'inventory' | 'reports'>('pos');
  const [licenseType, setLicenseType] = useState<string>('');

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('baga_session') || '{}');
      setLicenseType(s.licenseType || '');
      if (s.licenseType === 'pharmacy') {
        setPatientMode('Outdoor');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'inventory') setInitialTab('inventory');
      else if (tab === 'reports') setInitialTab('reports');
      else if (tab === 'prescriptions') setInitialTab('prescriptions');
      else setInitialTab('pos');
    }
  }, []);
  useEffect(() => { setMainTab(initialTab); }, [initialTab]);

  /* ==================== SHARED ==================== */
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
  const [discountType, setDiscountType] = useState<'patient' | 'prescriber'>('patient');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Online'>('Cash');
  const [receiptHeader, setReceiptHeader] = useState<{ hospitalName: string; hospitalLogo: string; hospitalAddress: string; hospitalPhone: string } | null>(null);

  useEffect(() => {
    if (saleBill) {
      getPrintHeader().then(setReceiptHeader);
    }
  }, [saleBill]);

  // Code (Prescription Builder)
  const [codeItems, setCodeItems] = useState<CodeItem[]>([]);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Return medicine state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReturnPwdModal, setShowReturnPwdModal] = useState(false);
  const [returnPwd, setReturnPwd] = useState('');
  const [returnPwdError, setReturnPwdError] = useState('');
  const [returnMedId, setReturnMedId] = useState('');
  const [returnMedName, setReturnMedName] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');
  const [returnMedResults, setReturnMedResults] = useState<MedicineItem[]>([]);
  const [showReturnMedDropdown, setShowReturnMedDropdown] = useState(false);
  const [returnMedQuery, setReturnMedQuery] = useState('');

  const handleReturnMedSearch = (q: string) => {
    setReturnMedQuery(q);
    if (q.length < 1) { setReturnMedResults([]); setShowReturnMedDropdown(false); return; }
    setReturnMedResults(searchMedicines(q));
    setShowReturnMedDropdown(true);
  };

  const selectReturnMed = (m: MedicineItem) => {
    setReturnMedId(m.id);
    setReturnMedName(m.name);
    setReturnMedQuery(m.name);
    setReturnMedResults([]);
    setShowReturnMedDropdown(false);
  };

  const processReturn = () => {
    if (!returnMedId || !returnReason.trim()) { showToast('Select medicine and enter reason', 'error'); return; }
    if (returnQty < 1) { showToast('Enter valid quantity', 'error'); return; }
    const meds = getMedicines();
    const med = meds.find(m => m.id === returnMedId);
    if (!med) { showToast('Medicine not found', 'error'); return; }
    // Add stock back
    updateMedicine(med.id, { stock: med.stock + returnQty });
    // Save return record
    const sessionData = JSON.parse(localStorage.getItem('baga_session') || '{}');
    addPharmacyReturn({
      id: genId(),
      medicineId: returnMedId,
      medicineName: returnMedName,
      quantity: returnQty,
      returnPrice: med.price * returnQty,
      reason: returnReason.trim(),
      returnedBy: sessionData.name || 'Pharmacist',
      date: todayStr(),
      time: timeStr(),
    });
    loadInventory();
    showToast(`Returned ${returnQty} x ${returnMedName} to stock`, 'success');
    setShowReturnModal(false);
    setReturnMedId('');
    setReturnMedName('');
    setReturnQty(1);
    setReturnReason('');
    setReturnMedQuery('');
  };

  // Sale history (for stats)
  const [sales, setSales] = useState<PharmacySale[]>([]);
  const loadSales = useCallback(() => setSales(getPharmacySales()), []);

  useEffect(() => { loadSales(); }, [loadSales]);
  useEffect(() => { setOutdoorNo(`OUT-${String(getOutdoorCounter()).padStart(4, '0')}`); }, []);

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

    const discountAmt = Math.round(cartTotal * billDiscount / 100);
    const grandTotal = cartTotal - discountAmt;

    const sale: PharmacySale = {
      id: genId(),
      patientNo,
      patientName,
      patientMobile,
      type: patientMode,
      items: [...cart],
      totalAmount: grandTotal,
      date: todayStr(),
      time: timeStr(),
      servedBy: (typeof window !== 'undefined' && localStorage.getItem('baga_session')) ? JSON.parse(localStorage.getItem('baga_session')!).name || 'Pharmacist' : 'Pharmacist',
      paymentMethod,
      discountPercent: billDiscount > 0 ? billDiscount : undefined,
      discountAmount: discountAmt > 0 ? discountAmt : undefined,
      discountType: billDiscount > 0 ? discountType : undefined,
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
    showToast(`Sale completed! ${currency} ${grandTotal.toLocaleString()}`, 'success');
    setSaleBill(sale);
    // Auto-print after a small delay, but keep the modal open so user can see & re-print
    setTimeout(() => { printBillSlip(); }, 500);
    setBillDiscount(0);
    setDiscountType('patient');
    loadSales();
  };

  const closeBill = () => {
    setSaleBill(null);
    setBillDiscount(0);
    setDiscountType('patient');
    setPaymentMethod('Cash');
    resetSale();
  };

  const printBillSlip = async () => {
    if (!saleBill) return;
    try {
      const subtotal = saleBill.items.reduce((a, c) => a + c.total, 0);
      const discountPct = saleBill.discountPercent ?? billDiscount;
      const discountAmt = saleBill.discountAmount ?? Math.round(subtotal * discountPct / 100);
      const dType = saleBill.discountType ?? discountType;
      const grandTotal = saleBill.totalAmount;
      const { hospitalName, hospitalLogo, hospitalAddress, hospitalPhone } = await getPrintHeader();
      const cur = currency;
      const itemRows = saleBill.items.map((it, i) => {
        const alt = i % 2 === 0 ? '#fff' : '#f8fafc';
        return `<tr style="background:${alt};">
          <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
          <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;font-weight:600;">${it.name}</td>
          <td style="padding:3px 6px;font-size:9px;border-bottom:1px solid #e2e8f0;">${it.form}</td>
          <td style="padding:3px 6px;font-size:9px;border-bottom:1px solid #e2e8f0;">${it.strength}</td>
          <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;text-align:right;">${cur} ${it.price.toLocaleString()}</td>
          <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;text-align:center;">${it.quantity}</td>
          <td style="padding:3px 6px;font-size:10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${cur} ${it.total.toLocaleString()}</td>
        </tr>`;
      }).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pharmacy Bill</title><style>
        @page{size:80mm auto;margin:3mm;}
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#fff;font-size:11px;width:80mm;margin:0 auto;}
        .header{text-align:center;padding:6px 0;border-bottom:2px dashed #cbd5e1;}
        .logo{width:48px;height:48px;object-fit:contain;}
        .hname{font-size:14px;font-weight:800;color:#0c2340;letter-spacing:1px;}
        .hsub{font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;}
        .haddr{font-size:8px;color:#64748b;margin-top:1px;}
        .hphone{font-size:8px;color:#64748b;}
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
          ${hospitalAddress ? `<div class="haddr">${hospitalAddress}</div>` : ''}
          ${hospitalPhone ? `<div class="hphone">${hospitalPhone}</div>` : ''}
          <div class="hsub">Pharmacy Department</div>
        </div>
        <div class="info">
          <div class="info-row"><span class="label">Bill No:</span><span class="value">${saleBill.id.slice(-6).toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Patient:</span><span class="value">${saleBill.patientName}</span></div>
          <div class="info-row"><span class="label">ID:</span><span class="value">${saleBill.patientNo}</span></div>
          <div class="info-row"><span class="label">Mobile:</span><span class="value">${saleBill.patientMobile || '-'}</span></div>
          <div class="info-row"><span class="label">Date:</span><span class="value">${saleBill.date} ${saleBill.time}</span></div>
          <div class="info-row"><span class="label">Served By:</span><span class="value">${saleBill.servedBy}</span></div>
          <div class="info-row"><span class="label">Payment:</span><span class="value">${saleBill.paymentMethod}</span></div>
        </div>
        <div class="title-bar"><h3>Medicine Bill / Slip</h3></div>
        <table>
          <thead><tr><th>#</th><th>Medicine</th><th>Form</th><th>Str</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="totals">
          <div class="total-row"><span>Subtotal (${saleBill.items.length} items)</span><span>${cur} ${subtotal.toLocaleString()}</span></div>
          ${discountPct > 0 ? `<div class="total-row discount"><span>Discount (${discountPct}% ${dType === 'patient' ? '- Patient' : '- Prescriber'})</span><span>-${cur} ${discountAmt.toLocaleString()}</span></div>` : ''}
          <div class="grand-total"><span>GRAND TOTAL</span><span>${cur} ${grandTotal.toLocaleString()}</span></div>
        </div>
        <div class="footer">
          <div class="ty">Thank you for visiting ${hospitalName}!</div>
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

  /* ==================== PRESCRIPTIONS ==================== */
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [dispenseRx, setDispenseRx] = useState<Prescription | null>(null);

  const loadRxs = useCallback(() => { setPrescriptions(getActivePrescriptions()); }, []);
  useEffect(() => { loadRxs(); }, [loadRxs]);

  const confirmDispense = () => {
    if (!dispenseRx) return;
    updatePrescription(dispenseRx.id, { status: 'Dispensed' });
    addDispense({
      id: genId(), prescriptionId: dispenseRx.id, patientNo: dispenseRx.patientNo,
      patientName: dispenseRx.patientName,
      medicines: dispenseRx.medicines.map(m => m.name),
      dispensedBy: 'Pharmacist', date: todayStr(), time: timeStr(),
    });
    setDispenseRx(null);
    loadRxs();
    showToast('Medicines dispensed successfully!', 'success');
  };

  /* ==================== MEDICINE INVENTORY ==================== */
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [catFilter, setCatFilter] = useState('All');
  const [invSearch, setInvSearch] = useState('');
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicineItem | null>(null);
  const [editPriceMed, setEditPriceMed] = useState<MedicineItem | null>(null);
  const [editPriceVal, setEditPriceVal] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<MedicineItem | null>(null);
  const [expiredMeds, setExpiredMeds] = useState<MedicineItem[]>([]);
  const [lowStockMeds, setLowStockMeds] = useState<MedicineItem[]>([]);

  useEffect(() => {
    if (mainTab === 'inventory') {
      setExpiredMeds(getExpiredMedicines());
      setLowStockMeds(getLowStockMedicines());
    }
  }, [mainTab, medicines]);

  // Medicine form
  const [fName, setFName] = useState('');
  const [fGeneric, setFGeneric] = useState('');
  const [fForm, setFForm] = useState('Tablet');
  const [fStrength, setFStrength] = useState('');
  const [fPacking, setFPacking] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fNewCategory, setFNewCategory] = useState('');

  const loadInventory = useCallback(() => {
    setMedicines(getMedicines());
    setCategories(getMedicineCategories());
  }, []);
  useEffect(() => { loadInventory(); }, [loadInventory]);

  const filteredMedicines = medicines.filter(m => {
    const matchCat = catFilter === 'All' || m.category === catFilter;
    const matchSearch = !invSearch ||
      m.name.toLowerCase().includes(invSearch.toLowerCase()) ||
      m.genericName.toLowerCase().includes(invSearch.toLowerCase()) ||
      m.strength.toLowerCase().includes(invSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const openAddMed = () => {
    setEditingMed(null);
    setFName(''); setFGeneric(''); setFForm('Tablet'); setFStrength('');
    setFPacking(''); setFPrice(''); setFCategory(categories[0] || ''); setFNewCategory('');
    setShowMedModal(true);
  };

  const openEditMed = (m: MedicineItem) => {
    setEditingMed(m);
    setFName(m.name); setFGeneric(m.genericName); setFForm(m.form); setFStrength(m.strength);
    setFPacking(m.packing); setFPrice(String(m.price)); setFCategory(m.category); setFNewCategory('');
    setShowMedModal(true);
  };

  const saveMed = () => {
    const cat = fCategory === '__new__' ? fNewCategory.trim() : fCategory.trim();
    if (!fName.trim() || !fForm || !fStrength.trim() || !fPacking.trim() || !fPrice.trim() || !cat) {
      showToast('All fields are required', 'error'); return;
    }
    if (editingMed) {
      updateMedicine(editingMed.id, {
        name: fName.trim(), genericName: fGeneric.trim(), form: fForm as MedicineItem['form'],
        strength: fStrength.trim(), packing: fPacking.trim(), price: Number(fPrice), category: cat,
      });
      showToast('Medicine updated successfully', 'success');
    } else {
      addMedicine({
        id: genId(), name: fName.trim(), genericName: fGeneric.trim(), form: fForm as MedicineItem['form'],
        strength: fStrength.trim(), packing: fPacking.trim(), price: Number(fPrice), category: cat, active: true,
        stock: 0, expiryDate: '', minStock: 10,
      });
      showToast('New medicine added successfully', 'success');
    }
    setShowMedModal(false);
    loadInventory();
  };

  const savePrice = () => {
    if (!editPriceMed || !editPriceVal) { showToast('Enter a valid price', 'error'); return; }
    updateMedicine(editPriceMed.id, { price: Number(editPriceVal) });
    showToast(`Price updated to ${currency} ${Number(editPriceVal).toLocaleString()}`, 'success');
    setEditPriceMed(null);
    setEditPriceVal('');
    loadInventory();
  };

  const toggleMedStatus = (m: MedicineItem) => {
    updateMedicine(m.id, { active: !m.active });
    showToast(`${m.name} ${m.active ? 'deactivated' : 'activated'}`, 'success');
    loadInventory();
  };

  const confirmDelete = (m: MedicineItem) => {
    deleteMedicine(m.id);
    showToast(`${m.name} deleted`, 'success');
    setDeleteConfirm(null);
    loadInventory();
  };

  /* ==================== RENDER ==================== */
  return (
    <div className="space-y-5">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      {/* Sale Bill Modal — Receipt Preview */}
      {saleBill && (() => {
        const subtotal = saleBill.items.reduce((a, c) => a + c.total, 0);
        const discPct = saleBill.discountPercent ?? 0;
        const discAmt = saleBill.discountAmount ?? 0;
        const discTypeLabel = (saleBill.discountType ?? 'patient') === 'patient' ? 'Patient' : 'Prescriber';
        const hdr = receiptHeader;
        return (
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeBill}>
            <div onClick={e => e.stopPropagation()} style={{
              maxWidth: 320, width: '100%', maxHeight: '90vh', overflowY: 'auto',
              background: '#fff', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
              padding: '16px 12px', fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 11, color: '#1e293b',
            }}>
              {/* Header */}
              <div style={{ textAlign: 'center', paddingBottom: 8, borderBottom: '2px dashed #cbd5e1' }}>
                {hdr?.hospitalLogo && <img src={hdr.hospitalLogo} alt="" style={{ width: 40, height: 40, objectFit: 'contain', display: 'block', margin: '0 auto 4px' }} />}
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0c2340', letterSpacing: 1 }}>{hdr?.hospitalName || 'BAGA HOSPITAL'}</div>
                {hdr?.hospitalAddress && <div style={{ fontSize: 8, color: '#64748b', marginTop: 1 }}>{hdr.hospitalAddress}</div>}
                {hdr?.hospitalPhone && <div style={{ fontSize: 8, color: '#64748b' }}>{hdr.hospitalPhone}</div>}
                <div style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Pharmacy Department</div>
              </div>

              {/* Bill Info */}
              <div style={{ padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                {[
                  ['Bill No', saleBill.id.slice(-6).toUpperCase()],
                  ['Patient', saleBill.patientName],
                  ['ID', saleBill.patientNo],
                  ['Mobile', saleBill.patientMobile || '-'],
                  ['Date', `${saleBill.date} ${saleBill.time}`],
                  ['Served By', saleBill.servedBy],
                  ['Payment', saleBill.paymentMethod],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>{label}:</span>
                    <span style={{ color: '#1e293b', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Title */}
              <div style={{ textAlign: 'center', padding: '4px 0', borderBottom: '1px dashed #e2e8f0', borderTop: '1px dashed #e2e8f0' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0c2340', letterSpacing: 1 }}>Medicine Bill / Slip</span>
              </div>

              {/* Items Table — compact */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
                <thead>
                  <tr>
                    {['#', 'Name', 'Qty', 'Total'].map(h => (
                      <th key={h} style={{
                        padding: '2px 4px', fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: 0.5, color: '#0c2340', background: '#f1f5f9',
                        borderBottom: '2px solid #0c2340', textAlign: h === 'Total' ? 'right' : h === 'Qty' ? 'center' : 'left',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {saleBill.items.map((it, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '2px 4px', fontSize: 10, borderBottom: '1px solid #f1f5f9' }}>{i + 1}</td>
                      <td style={{ padding: '2px 4px', fontSize: 10, borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{it.name}</td>
                      <td style={{ padding: '2px 4px', fontSize: 10, borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>{it.quantity}</td>
                      <td style={{ padding: '2px 4px', fontSize: 10, borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 700 }}>{currency} {it.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ padding: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                  <span>Subtotal ({saleBill.items.length} items)</span>
                  <span>{currency} {subtotal.toLocaleString()}</span>
                </div>
                {discPct > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', color: '#dc2626' }}>
                    <span>Discount ({discPct}% - {discTypeLabel})</span>
                    <span>-{currency} {discAmt.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, color: '#0c2340', padding: '4px 0', borderTop: '2px solid #0c2340', borderBottom: '2px solid #0c2340', marginTop: 4 }}>
                  <span>GRAND TOTAL</span>
                  <span>{currency} {saleBill.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: 'center', padding: '6px 0', marginTop: 4, borderTop: '2px dashed #cbd5e1' }}>
                <div style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic' }}>Thank you for visiting {hdr?.hospitalName || 'BAGA HOSPITAL'}!</div>
                <div style={{ fontSize: 7, color: '#94a3b8' }}>Computer Generated Bill | {saleBill.date} {saleBill.time}</div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={printBillSlip} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '8px 0', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Re-Print
                </button>
                <button onClick={closeBill} style={{
                  flex: 1, padding: '8px 0', background: '#fff', color: '#475569', border: '1px solid #cbd5e1',
                  borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Pharmacy</h2>
        <p className="text-sm text-slate-500">Medicine sales, prescriptions, and inventory management</p>
      </div>

      {/* ==================== POINT OF SALE TAB ==================== */}
      {mainTab === 'pos' && (
        <>
          {/* Stats Row */}
          <div className={`grid gap-3 ${licenseType === 'pharmacy' ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
            <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
              <p className="text-xs text-emerald-600 font-medium">Today&apos;s Sales</p>
              <p className="text-2xl font-bold text-emerald-700">{currency} {todayTotal.toLocaleString()}</p>
            </div>
            <div className="stat-card card-hover border border-blue-200 bg-blue-50">
              <p className="text-xs text-blue-600 font-medium">Total Sales Today</p>
              <p className="text-2xl font-bold text-blue-700">{todaySales.length}</p>
            </div>
            {licenseType !== 'pharmacy' && (
              <>
                <div className="stat-card card-hover border border-purple-200 bg-purple-50">
                  <p className="text-xs text-purple-600 font-medium">Indoor Patients</p>
                  <p className="text-2xl font-bold text-purple-700">{todayIndoor}</p>
                </div>
                <div className="stat-card card-hover border border-amber-200 bg-amber-50">
                  <p className="text-xs text-amber-600 font-medium">Outdoor Patients</p>
                  <p className="text-2xl font-bold text-amber-700">{todayOutdoor}</p>
                </div>
              </>
            )}
          </div>

          {/* Patient Mode Toggle + Selection */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            {/* Mode Toggle - hidden for pharmacy license */}
            {licenseType !== 'pharmacy' && (
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
            )}

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
                    <p className="font-bold text-slate-800 text-sm">Walk-in Patient — <span className="font-mono font-bold text-amber-700">{outdoorNo}</span></p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

          {/* Return Medicine Button */}
          <div className="flex items-center gap-3">
            <button onClick={() => { setReturnPwd(''); setReturnPwdError(''); setShowReturnPwdModal(true); }} className="btn btn-outline border-amber-300 text-amber-700 hover:bg-amber-50 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              Return Medicine
            </button>
          </div>

          {/* Return Medicine Password Modal */}
          {showReturnPwdModal && (
            <div className="modal-overlay" onClick={() => { setShowReturnPwdModal(false); setReturnPwd(''); setReturnPwdError(''); }}>
              <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800">Return Medicine — Verify</h3>
                  <button onClick={() => { setShowReturnPwdModal(false); setReturnPwd(''); setReturnPwdError(''); }} className="btn btn-outline btn-sm">Close</button>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">Enter the password to access medicine return. This password is set by the admin in Settings.</p>
                  <div>
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      value={returnPwd}
                      onChange={e => setReturnPwd(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const stored = localStorage.getItem('baga_profit_password');
                          if (returnPwd === stored) {
                            setShowReturnPwdModal(false);
                            setShowReturnModal(true);
                            setReturnPwd('');
                            setReturnPwdError('');
                          } else {
                            setReturnPwdError('Incorrect password');
                          }
                        }
                      }}
                      placeholder="Enter password"
                      autoFocus
                    />
                    {returnPwdError && <p className="text-red-500 text-xs mt-1">{returnPwdError}</p>}
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => { setShowReturnPwdModal(false); setReturnPwd(''); setReturnPwdError(''); }} className="btn btn-outline">Cancel</button>
                    <button onClick={() => {
                      const stored = localStorage.getItem('baga_profit_password');
                      if (returnPwd === stored) {
                        setShowReturnPwdModal(false);
                        setShowReturnModal(true);
                        setReturnPwd('');
                        setReturnPwdError('');
                      } else {
                        setReturnPwdError('Incorrect password');
                      }
                    }} className="btn btn-primary">Verify & Continue</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Return Medicine Modal */}
          {showReturnModal && (
            <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
              <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800">Return Medicine to Stock</h3>
                  <button onClick={() => setShowReturnModal(false)} className="btn btn-outline btn-sm">Close</button>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <label className="form-label">Medicine *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search medicine..."
                      value={returnMedQuery}
                      onChange={e => handleReturnMedSearch(e.target.value)}
                    />
                    {showReturnMedDropdown && returnMedResults.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                        {returnMedResults.map(m => (
                          <button key={m.id} onClick={() => selectReturnMed(m)} className="w-full text-left px-4 py-2 hover:bg-emerald-50 border-b border-slate-100 last:border-0 text-sm">
                            <span className="font-semibold">{m.name}</span>
                            <span className="text-xs text-slate-400 ml-2">({m.form}, {m.strength})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="form-label">Quantity *</label>
                    <input type="number" className="form-input" min={1} value={returnQty} onChange={e => setReturnQty(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                  <div>
                    <label className="form-label">Return Reason *</label>
                    <textarea className="form-input" rows={2} value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="e.g. Wrong purchase, damaged, expired..." />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowReturnModal(false)} className="btn btn-outline flex-1">Cancel</button>
                    <button onClick={processReturn} className="btn btn-primary flex-1">Process Return</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== PRESCRIPTIONS TAB ==================== */}
      {mainTab === 'prescriptions' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <h3 className="font-semibold text-slate-700">
                Active Prescriptions
                {prescriptions.length > 0 && <span className="ml-2 badge badge-amber">{prescriptions.length} pending</span>}
              </h3>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient No</th>
                    <th>Patient Name</th>
                    <th>Medicines</th>
                    <th>Prescribed By</th>
                    <th>Date</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map(rx => (
                    <tr key={rx.id}>
                      <td className="font-mono font-bold text-blue-600">{rx.patientNo}</td>
                      <td className="font-medium">{rx.patientName}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {rx.medicines.map((m, i) => (
                            <span key={i} className="badge badge-amber">{m.name} - {m.dosage || m.strength} - {m.duration}</span>
                          ))}
                        </div>
                      </td>
                      <td className="text-sm">{rx.prescribedBy}</td>
                      <td>{rx.date}</td>
                      <td className="text-sm text-slate-500 max-w-[150px] truncate">{rx.notes || '-'}</td>
                      <td><span className="badge badge-blue">{rx.status}</span></td>
                      <td><button onClick={() => setDispenseRx(rx)} className="btn btn-success btn-sm">Dispense</button></td>
                    </tr>
                  ))}
                  {prescriptions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        No active prescriptions. Prescriptions will appear when doctors prescribe medicines.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dispense Confirm Modal */}
          {dispenseRx && (
            <div className="modal-overlay" onClick={() => setDispenseRx(null)}>
              <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-2">Confirm Dispense</h3>
                <p className="text-sm text-blue-600 mb-4">{dispenseRx.patientNo} - {dispenseRx.patientName}</p>
                <div className="space-y-2 mb-4">
                  {dispenseRx.medicines.map((m, i) => (
                    <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="font-semibold text-sm">{m.name} <span className="text-slate-400 font-normal">({m.form}, {m.strength})</span></p>
                      <p className="text-xs text-slate-600">{m.dosage} | {m.duration} | {m.frequency}{m.instructions ? ` | ${m.instructions}` : ''}</p>
                    </div>
                  ))}
                </div>
                {dispenseRx.notes && (
                  <p className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-600">Notes:</span> {dispenseRx.notes}
                  </p>
                )}
                <div className="flex gap-3">
                  <button onClick={confirmDispense} className="btn btn-success btn-lg flex-1">Confirm Dispense</button>
                  <button onClick={() => setDispenseRx(null)} className="btn btn-outline btn-lg">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== REPORTS TAB ==================== */}
      {mainTab === 'reports' && (
        <>
          {/* Report Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
              <p className="text-xs text-emerald-600 font-medium">Today&apos;s Sales</p>
              <p className="text-2xl font-bold text-emerald-700">{currency} {todayTotal.toLocaleString()}</p>
            </div>
            <div className="stat-card card-hover border border-blue-200 bg-blue-50">
              <p className="text-xs text-blue-600 font-medium">Indoor Sales</p>
              <p className="text-2xl font-bold text-blue-700">{currency} {todaySales.filter(s => s.type === 'Indoor').reduce((a, s) => a + s.totalAmount, 0).toLocaleString()}</p>
            </div>
            <div className="stat-card card-hover border border-amber-200 bg-amber-50">
              <p className="text-xs text-amber-600 font-medium">Outdoor Sales</p>
              <p className="text-2xl font-bold text-amber-700">{currency} {todaySales.filter(s => s.type === 'Outdoor').reduce((a, s) => a + s.totalAmount, 0).toLocaleString()}</p>
            </div>
            <div className="stat-card card-hover border border-purple-200 bg-purple-50">
              <p className="text-xs text-purple-600 font-medium">Total Transactions</p>
              <p className="text-2xl font-bold text-purple-700">{todaySales.length}</p>
            </div>
          </div>

          {/* Medicine-wise Sales Summary */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Medicine-wise Sales Summary (Today)</h3>
              <p className="text-xs text-slate-400 mt-1">Breakdown of all medicines sold today</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Medicine Name</th>
                    <th>Form</th>
                    <th>Strength</th>
                    <th>Total Qty Sold</th>
                    <th>Unit Price</th>
                    <th className="text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const medMap: Record<string, { name: string; form: string; strength: string; price: number; qty: number; total: number }> = {};
                    todaySales.forEach(sale => {
                      sale.items.forEach(item => {
                        const key = item.medicineId;
                        if (!medMap[key]) {
                          medMap[key] = { name: item.name, form: item.form, strength: item.strength, price: item.price, qty: 0, total: 0 };
                        }
                        medMap[key].qty += item.quantity;
                        medMap[key].total += item.total;
                      });
                    });
                    const sorted = Object.values(medMap).sort((a, b) => b.total - a.total);
                    return sorted.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-slate-400">No sales today</td></tr>
                    ) : sorted.map((m, i) => (
                      <tr key={i}>
                        <td className="text-slate-400 font-medium">{i + 1}</td>
                        <td className="font-semibold">{m.name}</td>
                        <td><span className="badge badge-blue">{m.form}</span></td>
                        <td className="text-sm">{m.strength}</td>
                        <td className="font-bold text-center">{m.qty}</td>
                        <td className="text-sm">{currency} {m.price.toLocaleString()}</td>
                        <td className="text-right font-bold text-emerald-700">{currency} {m.total.toLocaleString()}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                    <td colSpan={6} className="px-4 py-3 text-right font-bold text-emerald-800">Grand Total:</td>
                    <td className="px-4 py-3 text-right font-extrabold text-emerald-700 text-lg">{currency} {todayTotal.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Sales by Patient Type */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-800 mb-3">Indoor Patient Sales ({todayIndoor})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {todaySales.filter(s => s.type === 'Indoor').length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No indoor sales today</p>
                ) : todaySales.filter(s => s.type === 'Indoor').sort((a, b) => b.time.localeCompare(a.time)).map(s => (
                  <div key={s.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{s.patientName}</p>
                      <p className="text-xs text-slate-400">{s.patientNo} | {s.time}</p>
                    </div>
                    <p className="font-bold text-blue-700">{currency} {s.totalAmount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-800 mb-3">Outdoor Patient Sales ({todayOutdoor})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {todaySales.filter(s => s.type === 'Outdoor').length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No outdoor sales today</p>
                ) : todaySales.filter(s => s.type === 'Outdoor').sort((a, b) => b.time.localeCompare(a.time)).map(s => (
                  <div key={s.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{s.patientName}</p>
                      <p className="text-xs text-slate-400">{s.patientNo} | {s.time}</p>
                    </div>
                    <p className="font-bold text-amber-700">{currency} {s.totalAmount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* All Sales History */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">All Sales Records (Today)</h3>
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
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
                  {todaySales.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">No sales today</td></tr>
                  ) : todaySales.sort((a, b) => b.time.localeCompare(a.time)).map(s => (
                    <tr key={s.id}>
                      <td className="text-sm text-slate-500">{s.time}</td>
                      <td className="font-mono font-bold text-blue-600 text-sm">{s.patientNo}</td>
                      <td className="font-medium text-sm">{s.patientName}</td>
                      <td><span className={`badge ${s.type === 'Indoor' ? 'badge-blue' : 'badge-amber'}`}>{s.type}</span></td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {s.items.slice(0, 3).map((it, i) => (
                            <span key={i} className="badge text-xs">{it.name} x{it.quantity}</span>
                          ))}
                          {s.items.length > 3 && <span className="badge badge-amber text-xs">+{s.items.length - 3}</span>}
                        </div>
                      </td>
                      <td className="text-right font-bold text-emerald-700">{currency} {s.totalAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ==================== MEDICINE INVENTORY TAB ==================== */}
      {mainTab === 'inventory' && (
        <>
          {/* Search + Add */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex-1 relative w-full sm:max-w-md">
              <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                className="form-input pl-10"
                placeholder="Search medicines by name, generic name, or strength..."
                value={invSearch}
                onChange={e => setInvSearch(e.target.value)}
              />
            </div>
            <button onClick={openAddMed} className="btn btn-primary">
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add New Medicine
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setCatFilter('All')} className={`btn btn-sm ${catFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}>
              All ({medicines.length})
            </button>
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c)} className={`btn btn-sm ${catFilter === c ? 'btn-primary' : 'btn-outline'}`}>
                {c} ({medicines.filter(m => m.category === c).length})
              </button>
            ))}
          </div>

          {/* Inventory Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="stat-card card-hover border border-blue-200 bg-blue-50">
              <p className="text-xs text-blue-600 font-medium">Total Medicines</p>
              <p className="text-2xl font-bold text-blue-700">{medicines.length}</p>
            </div>
            <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
              <p className="text-xs text-emerald-600 font-medium">Active</p>
              <p className="text-2xl font-bold text-emerald-700">{medicines.filter(m => m.active).length}</p>
            </div>
            <div className="stat-card card-hover border border-red-200 bg-red-50">
              <p className="text-xs text-red-600 font-medium">Inactive</p>
              <p className="text-2xl font-bold text-red-700">{medicines.filter(m => !m.active).length}</p>
            </div>
            <div className="stat-card card-hover border border-purple-200 bg-purple-50">
              <p className="text-xs text-purple-600 font-medium">Categories</p>
              <p className="text-2xl font-bold text-purple-700">{categories.length}</p>
            </div>
          </div>

          {/* Medicine Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              <table className="data-table">
                <thead className="sticky top-0 bg-white z-10">
                  <tr>
                    <th>Medicine Name</th>
                    <th>Generic Name</th>
                    <th>Form</th>
                    <th>Strength</th>
                    <th>Packing</th>
                    <th>Category</th>
                    <th className="text-right">Price</th>
                    <th>Stock</th>
                    <th>Expiry</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map(m => (
                    <tr key={m.id} className={!m.active ? 'opacity-50' : ''}>
                      <td className="font-semibold text-slate-800">{m.name}</td>
                      <td className="text-sm text-slate-500">{m.genericName}</td>
                      <td><span className="badge badge-blue">{m.form}</span></td>
                      <td className="text-sm text-slate-600">{m.strength}</td>
                      <td className="text-sm text-slate-500">{m.packing}</td>
                      <td><span className="badge badge-amber">{m.category}</span></td>
                      <td className="text-right">
                        <button
                          onClick={() => { setEditPriceMed(m); setEditPriceVal(String(m.price)); }}
                          className="font-bold text-emerald-700 hover:text-emerald-600 hover:underline cursor-pointer"
                          title="Click to edit price"
                        >
                          {currency} {m.price.toLocaleString()}
                          <svg className="w-3 h-3 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      </td>
                      <td>
                        <span className={`font-semibold ${m.stock <= 0 ? 'text-red-600' : m.stock <= (m.minStock || 10) ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {m.stock}
                        </span>
                        {m.stock <= 0 && <span className="badge badge-rose text-xs ml-1">OUT</span>}
                        {m.stock > 0 && m.stock <= (m.minStock || 10) && <span className="badge badge-amber text-xs ml-1">LOW</span>}
                      </td>
                      <td>
                        {m.expiryDate ? (
                          <span className={`text-sm ${m.expiryDate < todayStr() ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                            {m.expiryDate}
                            {m.expiryDate < todayStr() && <span className="badge badge-rose text-xs ml-1">EXPIRED</span>}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">Not set</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${m.active ? 'badge-green' : 'badge-rose'}`}>
                          {m.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          <button onClick={() => openEditMed(m)} className="btn btn-outline btn-sm">Edit</button>
                          <button
                            onClick={() => toggleMedStatus(m)}
                            className={`btn btn-sm ${m.active ? 'btn-danger' : 'btn-success'}`}
                          >
                            {m.active ? 'Disable' : 'Enable'}
                          </button>
                          <button onClick={() => setDeleteConfirm(m)} className="btn btn-sm btn-danger">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredMedicines.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-slate-400">
                        No medicines found matching your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expiry & Stock Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Expired Medicines */}
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  <h3 className="font-bold text-red-800">Expired Medicines ({expiredMeds.length})</h3>
                </div>
                {expiredMeds.length > 0 && (
                  <button onClick={async () => {
                    const { hospitalName, hospitalLogo, hospitalAddress, hospitalPhone } = await getPrintHeader();
                    const rows = expiredMeds.map((m, i) => `<tr style="background:${i%2===0?'#fff':'#fef2f2'}"><td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #fecaca;">${i+1}</td><td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #fecaca;font-weight:600;">${m.name}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fecaca;">${m.genericName}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fecaca;">${m.form}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fecaca;">${m.strength}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fecaca;">${m.packing||'-'}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fecaca;">${m.expiryDate}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fecaca;">${m.stock}</td></tr>`).join('');
                    triggerPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Expired Medicines</title><style>@page{size:A4;margin:10mm;}*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;font-size:11px;}.header{text-align:center;padding:10px 0;border-bottom:2px solid #dc2626;}.logo{width:48px;height:48px;object-fit:contain;}.hname{font-size:18px;font-weight:800;color:#991b1b;}.haddr,.hphone{font-size:10px;color:#64748b;}.title{text-align:center;padding:8px;font-size:14px;font-weight:700;color:#991b1b;}table{width:100%;border-collapse:collapse;margin-top:8px;}th{padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#fff;background:#dc2626;border-bottom:2px solid #991b1b;text-align:left;}td{padding:4px 8px;font-size:10px;border-bottom:1px solid #fecaca;}.footer{text-align:center;padding:10px;font-size:9px;color:#94a3b8;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><div class="header">${hospitalLogo?`<img class="logo" src="${hospitalLogo}" />`:''}<div class="hname">${hospitalName}</div>${hospitalAddress?`<div class="haddr">${hospitalAddress}</div>`:''}${hospitalPhone?`<div class="hphone">${hospitalPhone}</div>`:''}</div><div class="title">Expired Medicines Report — ${todayStr()}</div><table><thead><tr><th>#</th><th>Medicine Name</th><th>Generic</th><th>Form</th><th>Strength</th><th>Batch/Packing</th><th>Expiry Date</th><th>Stock</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Total Expired: ${expiredMeds.length} | Generated: ${todayStr()} ${timeStr()}</div></body></html>`);
                  }} className="btn btn-outline btn-sm border-red-300 text-red-700 hover:bg-red-50">
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print
                  </button>
                )}
              </div>
              {expiredMeds.length === 0 ? (
                <p className="text-red-400 text-sm text-center py-3">No expired medicines</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {expiredMeds.map(m => (
                    <div key={m.id} className="bg-white border border-red-200 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-red-800 text-sm">{m.name} ({m.strength})</p>
                        <p className="text-xs text-red-500">{m.form} | {m.packing} | Stock: {m.stock}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-red-600">Expired: {m.expiryDate}</p>
                        <span className="badge badge-rose text-xs">EXPIRED</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low Stock Medicines */}
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  <h3 className="font-bold text-amber-800">Low Stock ({lowStockMeds.filter(m => !expiredMeds.find(em => em.id === m.id)).length})</h3>
                </div>
                {lowStockMeds.filter(m => !expiredMeds.find(em => em.id === m.id)).length > 0 && (
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      const { hospitalName, hospitalLogo, hospitalAddress, hospitalPhone } = await getPrintHeader();
                      const filtered = lowStockMeds.filter(m => !expiredMeds.find(em => em.id === m.id));
                      const rows = filtered.map((m, i) => `<tr style="background:${i%2===0?'#fff':'#fffbeb'}"><td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #fde68a;">${i+1}</td><td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #fde68a;font-weight:600;">${m.name}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fde68a;">${m.category}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fde68a;">${m.stock}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fde68a;">${m.minStock}</td></tr>`).join('');
                      triggerPrint(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Low Stock</title><style>@page{size:A4;margin:10mm;}*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;font-size:11px;}.header{text-align:center;padding:10px 0;border-bottom:2px solid #d97706;}.logo{width:48px;height:48px;object-fit:contain;}.hname{font-size:18px;font-weight:800;color:#92400e;}.haddr,.hphone{font-size:10px;color:#64748b;}.title{text-align:center;padding:8px;font-size:14px;font-weight:700;color:#92400e;}table{width:100%;border-collapse:collapse;margin-top:8px;}th{padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#fff;background:#d97706;border-bottom:2px solid #92400e;text-align:left;}td{padding:4px 8px;font-size:10px;border-bottom:1px solid #fde68a;}.footer{text-align:center;padding:10px;font-size:9px;color:#94a3b8;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><div class="header">${hospitalLogo?`<img class="logo" src="${hospitalLogo}" />`:''}<div class="hname">${hospitalName}</div>${hospitalAddress?`<div class="haddr">${hospitalAddress}</div>`:''}${hospitalPhone?`<div class="hphone">${hospitalPhone}</div>`:''}</div><div class="title">Low Stock Report — ${todayStr()}</div><table><thead><tr><th>#</th><th>Medicine Name</th><th>Category</th><th>Current Stock</th><th>Min Stock</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Total Low Stock: ${filtered.length} | Generated: ${todayStr()} ${timeStr()}</div></body></html>`);
                    }} className="btn btn-outline btn-sm border-amber-300 text-amber-700 hover:bg-amber-50">
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Print
                    </button>
                    <button onClick={async () => {
                      const { hospitalName, hospitalLogo, hospitalAddress, hospitalPhone } = await getPrintHeader();
                      const filtered = lowStockMeds.filter(m => !expiredMeds.find(em => em.id === m.id));
                      const rows = filtered.map((m, i) => `<tr style="background:${i%2===0?'#fff':'#fffbeb'}"><td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #fde68a;">${i+1}</td><td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #fde68a;font-weight:600;">${m.name}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fde68a;">${m.category}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fde68a;">${m.stock}</td><td style="padding:4px 8px;font-size:9px;border-bottom:1px solid #fde68a;">${m.minStock}</td></tr>`).join('');
                      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Low Stock</title><style>@page{size:A4;margin:10mm;}*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;font-size:11px;}.header{text-align:center;padding:10px 0;border-bottom:2px solid #d97706;}.logo{width:48px;height:48px;object-fit:contain;}.hname{font-size:18px;font-weight:800;color:#92400e;}.haddr,.hphone{font-size:10px;color:#64748b;}.title{text-align:center;padding:8px;font-size:14px;font-weight:700;color:#92400e;}table{width:100%;border-collapse:collapse;margin-top:8px;}th{padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#fff;background:#d97706;border-bottom:2px solid #92400e;text-align:left;}td{padding:4px 8px;font-size:10px;border-bottom:1px solid #fde68a;}.footer{text-align:center;padding:10px;font-size:9px;color:#94a3b8;}</style></head><body><div class="header">${hospitalLogo?`<img class="logo" src="${hospitalLogo}" />`:''}<div class="hname">${hospitalName}</div>${hospitalAddress?`<div class="haddr">${hospitalAddress}</div>`:''}${hospitalPhone?`<div class="hphone">${hospitalPhone}</div>`:''}</div><div class="title">Low Stock Report — ${todayStr()}</div><table><thead><tr><th>#</th><th>Medicine Name</th><th>Category</th><th>Current Stock</th><th>Min Stock</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Total Low Stock: ${filtered.length} | Generated: ${todayStr()} ${timeStr()}</div></body></html>`;
                      const blob = new Blob([html], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `low-stock-report-${todayStr()}.html`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }} className="btn btn-outline btn-sm border-amber-300 text-amber-700 hover:bg-amber-50">
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                      Share
                    </button>
                  </div>
                )}
              </div>
              {lowStockMeds.length === 0 ? (
                <p className="text-amber-400 text-sm text-center py-3">All medicines are well stocked</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {lowStockMeds.filter(m => !expiredMeds.find(em => em.id === m.id)).map(m => (
                    <div key={m.id} className="bg-white border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-amber-800 text-sm">{m.name} ({m.strength})</p>
                        <p className="text-xs text-amber-500">{m.form} | {m.packing}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-amber-700">Stock: {m.stock}</p>
                        <p className="text-xs text-amber-500">Min: {m.minStock}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Add/Edit Medicine Modal */}
          {showMedModal && (
            <div className="modal-overlay" onClick={() => setShowMedModal(false)}>
              <div className="modal-content" style={{ maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">{editingMed ? 'Edit Medicine' : 'Add New Medicine'}</h3>
                  <button onClick={() => setShowMedModal(false)} className="btn btn-outline btn-sm">Close</button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Medicine Name *</label>
                      <input type="text" className="form-input" placeholder="e.g. Paracetamol" value={fName} onChange={e => setFName(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Generic Name</label>
                      <input type="text" className="form-input" placeholder="e.g. Acetaminophen" value={fGeneric} onChange={e => setFGeneric(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Form *</label>
                      <select className="form-input" value={fForm} onChange={e => setFForm(e.target.value)}>
                        <option value="Tablet">Tablet</option>
                        <option value="Capsule">Capsule</option>
                        <option value="Syrup">Syrup</option>
                        <option value="Injection">Injection</option>
                        <option value="Cream">Cream</option>
                        <option value="Drops">Drops</option>
                        <option value="Inhaler">Inhaler</option>
                        <option value="Powder">Powder</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Strength *</label>
                      <input type="text" className="form-input" placeholder="e.g. 500mg" value={fStrength} onChange={e => setFStrength(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Packing *</label>
                      <input type="text" className="form-input" placeholder="e.g. 10 tablets" value={fPacking} onChange={e => setFPacking(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Price ({currency}) *</label>
                      <input type="number" className="form-input" placeholder="e.g. 50" value={fPrice} onChange={e => setFPrice(e.target.value)} min={0} />
                    </div>
                    <div>
                      <label className="form-label">Category *</label>
                      <select
                        className="form-input"
                        value={fCategory === '__new__' ? '__new__' : fCategory}
                        onChange={e => setFCategory(e.target.value)}
                      >
                        <option value="">Select category...</option>
                        {categories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value="__new__">+ New Category</option>
                      </select>
                    </div>
                  </div>
                  {fCategory === '__new__' && (
                    <div>
                      <label className="form-label">New Category Name *</label>
                      <input type="text" className="form-input" placeholder="Enter new category name" value={fNewCategory} onChange={e => setFNewCategory(e.target.value)} />
                    </div>
                  )}
                  <button onClick={saveMed} className="btn btn-success btn-lg w-full">
                    {editingMed ? 'Update Medicine' : 'Add Medicine'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Price Edit Modal */}
          {editPriceMed && (
            <div className="modal-overlay" onClick={() => setEditPriceMed(null)}>
              <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-1">Edit Price</h3>
                <p className="text-sm text-slate-500 mb-4">
                  {editPriceMed.name} <span className="text-slate-400">({editPriceMed.form}, {editPriceMed.strength})</span>
                </p>
                <div className="mb-4">
                  <label className="form-label">New Price ({currency})</label>
                  <input
                    type="number"
                    className="form-input text-lg font-bold"
                    value={editPriceVal}
                    onChange={e => setEditPriceVal(e.target.value)}
                    min={0}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') savePrice(); }}
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditPriceMed(null)} className="btn btn-outline flex-1">Cancel</button>
                  <button onClick={savePrice} className="btn btn-success flex-1">Save Price</button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirm Modal */}
          {deleteConfirm && (
            <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
              <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                <div className="text-center">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-red-700 mb-2">Delete Medicine</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Are you sure you want to delete <span className="font-bold text-slate-700">{deleteConfirm.name}</span> ({deleteConfirm.strength})? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeleteConfirm(null)} className="btn btn-outline flex-1">Cancel</button>
                    <button onClick={() => confirmDelete(deleteConfirm)} className="btn btn-danger flex-1">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
