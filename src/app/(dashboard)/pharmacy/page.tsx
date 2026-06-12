'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [mainTab, setMainTab] = useState<'dashboard' | 'pos' | 'prescriptions' | 'inventory' | 'reports'>('pos');
  const [licenseType, setLicenseType] = useState<string>('');

  // React to URL param changes for tab switching
  useEffect(() => {
    if (tabParam === 'dashboard') setMainTab('dashboard');
    else if (tabParam === 'inventory') setMainTab('inventory');
    else if (tabParam === 'reports') setMainTab('reports');
    else if (tabParam === 'prescriptions') setMainTab('prescriptions');
    else setMainTab('pos');
  }, [tabParam]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('baga_session') || '{}');
      setLicenseType(s.licenseType || '');
      if (s.licenseType === 'pharmacy') {
        setPatientMode('Outdoor');
      }
    } catch {}
  }, []);

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
      const discountAmt = Math.round(saleBill.totalAmount * billDiscount / 100);
      const grandTotal = saleBill.totalAmount - discountAmt;
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
          <div class="total-row"><span>Subtotal (${saleBill.items.length} items)</span><span>${cur} ${saleBill.totalAmount.toLocaleString()}</span></div>
          ${billDiscount > 0 ? `<div class="total-row discount"><span>Discount (${billDiscount}% ${discountType === 'patient' ? '- Patient' : '- Prescriber'})</span><span>-${cur} ${discountAmt.toLocaleString()}</span></div>` : ''}
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
        stock: 0, expiryDate: '', minStock: 10, purchasePrice: 0, wholesalePrice: 0, company: '', location: '',
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
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg text-sm">{saleBill.paymentMethod}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">Discount (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={billDiscount}
                  onChange={e => setBillDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-20 h-9 text-right border border-slate-300 rounded-lg px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  placeholder="0"
                />
              </div>
              {billDiscount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-500">Discount Amount ({billDiscount}% - {discountType === 'patient' ? 'Patient' : 'Prescriber'})</span>
                  <span className="font-semibold text-red-500">-{currency} {Math.round(saleBill.totalAmount * billDiscount / 100).toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-3 border-t-2 border-slate-300">
                <span className="text-lg font-bold text-slate-800">Grand Total</span>
                <span className="text-2xl font-black text-emerald-700">{currency} {(saleBill.totalAmount - Math.round(saleBill.totalAmount * billDiscount / 100)).toLocaleString()}</span>
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
        <h2 className="text-xl font-bold text-slate-800">Pharmacy</h2>
        <p className="text-sm text-slate-500">Medicine sales, prescriptions, and inventory management</p>
      </div>

      {/* ==================== DASHBOARD TAB ==================== */}
      {mainTab === 'dashboard' && (
        <>
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
            <div className="absolute right-20 bottom-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-1">Pharmacy Dashboard</h2>
              <p className="text-emerald-100 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Today</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{currency} {todayTotal.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Today&apos;s Sales</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Count</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{todaySales.length}</p>
              <p className="text-xs text-slate-500 mt-1">Total Transactions</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                </div>
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Alert</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{medicines.filter((m: any) => m.stock <= (m.reorderLevel || 10) && m.stock > 0).length}</p>
              <p className="text-xs text-slate-500 mt-1">Low Stock Items</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{medicines.length}</p>
              <p className="text-xs text-slate-500 mt-1">Total Medicines</p>
            </div>
          </div>

          {/* Two Column: Recent Sales + Low Stock */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recent Sales - 2 cols */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  <h3 className="font-bold text-slate-800">Recent Sales</h3>
                  <span className="badge badge-emerald">{todaySales.length} today</span>
                </div>
              </div>
              {todaySales.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-16 h-16 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  <p className="text-slate-400 font-medium">No sales today</p>
                  <p className="text-slate-300 text-xs mt-1">Start selling from Point of Sale</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="data-table">
                    <thead className="sticky top-0 bg-white">
                      <tr>
                        <th>Time</th>
                        <th>Patient</th>
                        <th>Type</th>
                        <th>Items</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todaySales.sort((a: any, b: any) => b.time.localeCompare(a.time)).slice(0, 15).map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="text-sm text-slate-500 whitespace-nowrap">{s.time}</td>
                          <td>
                            <p className="font-medium text-sm">{s.patientName}</p>
                            <p className="text-xs text-slate-400 font-mono">{s.patientNo}</p>
                          </td>
                          <td><span className={`badge text-xs ${s.type === 'Indoor' ? 'badge-blue' : 'badge-amber'}`}>{s.type}</span></td>
                          <td className="text-sm">{s.items.length} items</td>
                          <td className="text-right font-bold text-emerald-700">{currency} {s.totalAmount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Low Stock Alerts - 1 col */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <h3 className="font-bold text-slate-800">Low Stock</h3>
              </div>
              {(() => {
                const lowStock = medicines.filter((m: any) => m.stock <= (m.reorderLevel || 10) && m.stock > 0).sort((a: any, b: any) => a.stock - b.stock).slice(0, 10);
                const outOfStock = medicines.filter((m: any) => m.stock === 0);
                return lowStock.length === 0 && outOfStock.length === 0 ? (
                  <div className="p-8 text-center">
                    <svg className="w-12 h-12 text-emerald-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-slate-400 text-sm font-medium">All medicines in stock</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                    {outOfStock.slice(0, 5).map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between p-2.5 bg-red-50 border border-red-200 rounded-lg">
                        <div>
                          <p className="font-semibold text-sm text-red-800">{m.name}</p>
                          <p className="text-xs text-red-500">{m.form} | {m.strength}</p>
                        </div>
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">Out of Stock</span>
                      </div>
                    ))}
                    {lowStock.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <div>
                          <p className="font-semibold text-sm text-slate-800">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.form} | {m.strength}</p>
                        </div>
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">{m.stock} left</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Top Selling Medicines */}
          {todaySales.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                <h3 className="font-bold text-slate-800">Top Selling Medicines (Today)</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
                {(() => {
                  const medMap: Record<string, { name: string; qty: number; total: number }> = {};
                  todaySales.forEach((s: any) => s.items.forEach((it: any) => {
                    if (!medMap[it.medicineId]) medMap[it.medicineId] = { name: it.name, qty: 0, total: 0 };
                    medMap[it.medicineId].qty += it.quantity;
                    medMap[it.medicineId].total += it.total;
                  }));
                  return Object.values(medMap).sort((a, b) => b.qty - a.qty).slice(0, 5).map((m, i) => (
                    <div key={i} className="text-center p-3 bg-gradient-to-b from-blue-50 to-white border border-blue-100 rounded-xl">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-blue-700 font-bold text-sm">#{i + 1}</span>
                      </div>
                      <p className="font-semibold text-sm text-slate-800 truncate">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.qty} sold</p>
                      <p className="text-sm font-bold text-emerald-700 mt-1">{currency} {m.total.toLocaleString()}</p>
                    </div>
                  ));
                })()}
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
                          if (!stored || returnPwd === stored) {
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
                      if (!stored || returnPwd === stored) {
                        setShowReturnPwdModal(false);
                        setShowReturnModal(true);
                        setReturnPwd('');
                        setReturnPwdError('');
                      } else {
                        setReturnPwdError('Incorrect password');
                      }
                    }} className="btn btn-primary">Verify &amp; Continue</button>
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

      {/* ==================== POINT OF SALE TAB ==================== */}
      {mainTab === 'pos' && (
        <>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* ========== LEFT COLUMN: Medicine Search & Grid ========== */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Search Bar */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="relative">
                  <svg className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    ref={medSearchRef}
                    type="text"
                    className="w-full pl-11 pr-10 py-3 text-base border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 bg-slate-50 transition-colors"
                    placeholder="Search medicine by name, generic name, or category..."
                    value={medQuery}
                    onChange={e => handleMedSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleMedSearchEnter(); } }}
                  />
                  {medQuery.length > 0 && (
                    <button
                      onClick={() => { setMedQuery(''); setMedResults([]); setShowMedDropdown(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                {medQuery.length > 0 && (
                  <p className="mt-2 text-sm text-slate-500">
                    {medResults.length} medicine{medResults.length !== 1 ? 's' : ''} found for &ldquo;{medQuery}&rdquo;
                  </p>
                )}
              </div>

              {/* Medicine Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(medQuery.length > 0 ? medResults : medicines.slice(0, 30)).map(m => (
                  <div
                    key={m.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200 group flex flex-col"
                  >
                    <div className="flex-1 space-y-2">
                      <h4 className="font-bold text-slate-800 text-sm leading-tight">{m.name}</h4>
                      <p className="text-xs text-slate-400">{m.genericName}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">{m.form}</span>
                        <span className="text-xs text-slate-500">{m.strength}</span>
                        <span className="text-xs text-slate-300">&middot;</span>
                        <span className="text-xs text-slate-400">{m.packing}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div>
                          <p className="text-lg font-bold text-emerald-600">{currency} {m.price.toLocaleString()}</p>
                          <p className="text-xs text-slate-400">Stock: {m.stock || 0}</p>
                        </div>
                        <button
                          onClick={() => addToCode(m)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty States */}
              {medQuery.length === 0 && medicines.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                  <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                  <p className="text-slate-400 text-lg font-medium">No medicines in inventory</p>
                  <p className="text-slate-300 text-sm mt-1">Add medicines from the Inventory tab first</p>
                </div>
              )}
              {medQuery.length > 0 && medResults.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                  <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <p className="text-slate-400 text-lg font-medium">No medicines found</p>
                  <p className="text-slate-300 text-sm mt-1">Try a different search term</p>
                </div>
              )}
              {medQuery.length === 0 && medicines.length > 30 && (
                <p className="text-center text-sm text-slate-400">Showing 30 of {medicines.length} medicines. Use search to find more.</p>
              )}
            </div>

            {/* ========== RIGHT COLUMN: Patient + Cart (Sticky) ========== */}
            <div className="w-full lg:w-[400px] shrink-0 lg:sticky lg:top-4 lg:self-start space-y-4">

              {/* Patient Section */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span className="text-sm font-semibold text-slate-700">Patient Details</span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Mode Toggle - hospital license only */}
                  {licenseType !== 'pharmacy' && (
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                      <button
                        onClick={() => { setPatientMode('Indoor'); clearPatient(); }}
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${patientMode === 'Indoor' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Indoor
                      </button>
                      <button
                        onClick={() => { setPatientMode('Outdoor'); clearPatient(); }}
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${patientMode === 'Outdoor' ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Outdoor
                      </button>
                    </div>
                  )}

                  {/* Indoor Patient Search */}
                  {patientMode === 'Indoor' && (
                    selectedPatient ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {selectedPatient.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-sm truncate">{selectedPatient.name}</p>
                              <p className="text-xs text-slate-500 truncate">
                                <span className="font-mono text-emerald-600 font-semibold">{selectedPatient.patientNo}</span>
                                <span className="mx-1 text-slate-300">|</span>
                                {selectedPatient.gender} | {selectedPatient.age} yrs
                              </p>
                            </div>
                          </div>
                          <button onClick={clearPatient} className="text-xs text-slate-400 hover:text-red-500 font-medium shrink-0">Change</button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                          type="text"
                          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                          placeholder="Search card number or mobile..."
                          value={patientQuery}
                          onChange={e => handlePatientSearch(e.target.value)}
                          autoFocus
                        />
                        {patientResults.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                            {patientResults.map(p => (
                              <button
                                key={p.id}
                                onClick={() => selectPatient(p)}
                                className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 border-b border-slate-100 last:border-0 transition-colors text-sm"
                              >
                                <span className="font-mono font-bold text-emerald-600">{p.patientNo}</span>
                                <span className="ml-2 font-medium text-slate-700">{p.name}</span>
                                <span className="ml-1 text-xs text-slate-400">{p.mobile}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {patientQuery.length >= 1 && patientResults.length === 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-center text-xs text-slate-400">
                            No patients found
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* Outdoor Patient Form - Compact */}
                  {patientMode === 'Outdoor' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{outdoorNo}</span>
                        <span className="text-xs text-slate-400">Walk-in Patient</span>
                      </div>
                      <input
                        ref={outdoorNameRef}
                        type="text"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                        placeholder="Patient name *"
                        value={outdoorName}
                        onChange={e => setOutdoorName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleOutdoorFieldEnter('name'); } }}
                      />
                      <input
                        ref={outdoorMobileRef}
                        type="text"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                        placeholder="Mobile number"
                        maxLength={11}
                        inputMode="numeric"
                        value={outdoorMobile.replace(/[^0-9]/g, '')}
                        onChange={e => setOutdoorMobile(e.target.value.replace(/[^0-9]/g, ''))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleOutdoorFieldEnter('mobile'); } }}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          ref={outdoorAgeRef}
                          type="text"
                          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                          placeholder="Age"
                          maxLength={2}
                          inputMode="numeric"
                          value={outdoorAge.replace(/[^0-9]/g, '')}
                          onChange={e => setOutdoorAge(e.target.value.replace(/[^0-9]/g, ''))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleOutdoorFieldEnter('age'); } }}
                        />
                        <select
                          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                          value={outdoorGender}
                          onChange={e => setOutdoorGender(e.target.value)}
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Prescription Code Panel */}
              {codeItems.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2zm-6 4h3m-3 4h3" /></svg>
                      <h3 className="text-sm font-bold text-blue-800">Prescription Code ({codeItems.length})</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-blue-700">{currency} {codeTotal.toLocaleString()}</span>
                      <button onClick={() => setCodeItems([])} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear</button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {codeItems.map((ci, idx) => (
                      <div key={ci.medicineId} className="bg-white border border-blue-200 rounded-lg p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs bg-blue-100 text-blue-700 font-bold w-5 h-5 rounded flex items-center justify-center">{idx + 1}</span>
                              <span className="font-bold text-slate-800 text-sm truncate">{ci.name}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{ci.form} &middot; {ci.strength} &middot; {currency} {ci.price.toLocaleString()}</p>
                          </div>
                          <button onClick={() => removeFromCode(ci.medicineId)} className="text-slate-300 hover:text-red-500 shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div>
                            <label className="text-[10px] text-slate-400 font-medium">Days</label>
                            <select className="w-full h-7 text-xs border border-slate-200 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-200" value={ci.days} onChange={e => updateCodeItemDays(ci.medicineId, Number(e.target.value))}>
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
                            <select className="w-full h-7 text-xs border border-slate-200 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-200" value={ci.dosage} onChange={e => updateCodeItemDosage(ci.medicineId, e.target.value)}>
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
                            <select className="w-full h-7 text-xs border border-slate-200 rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-200" value={ci.frequency} onChange={e => updateCodeItemFrequency(ci.medicineId, e.target.value)}>
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
                    ))}
                  </div>
                  <button onClick={addAllToCart} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Add {codeItems.length} Medicine{codeItems.length > 1 ? 's' : ''} to Cart
                  </button>
                </div>
              )}

              {/* Cart Section */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* Cart Header */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                    <span className="text-sm font-semibold text-slate-700">Cart</span>
                    {cart.length > 0 && (
                      <span className="bg-emerald-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{cart.length}</span>
                    )}
                  </div>
                  {cart.length > 0 && (
                    <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">Clear All</button>
                  )}
                </div>

                {/* Cart Body */}
                {cart.length === 0 ? (
                  <div className="p-8 text-center">
                    <svg className="w-14 h-14 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                    <p className="text-slate-400 text-sm font-medium">Cart is empty</p>
                    <p className="text-slate-300 text-xs mt-1">Add medicines from the grid</p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100">
                      {cart.map(item => (
                        <div key={item.medicineId} className="p-3 flex items-center gap-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                            <p className="text-xs text-slate-400">{item.form} &middot; {item.strength}</p>
                            <p className="text-xs font-bold text-emerald-600 mt-0.5">{currency} {item.price.toLocaleString()} &times; {item.quantity} = {currency} {item.total.toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => updateCartQty(item.medicineId, item.quantity - 1)}
                              className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors text-sm font-bold"
                            >&minus;</button>
                            <span className="w-8 text-center text-sm font-semibold text-slate-700">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQty(item.medicineId, item.quantity + 1)}
                              className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-colors text-sm font-bold"
                            >+</button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.medicineId)}
                            className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Cart Footer */}
                    <div className="border-t border-slate-200 p-4 space-y-2.5 bg-slate-50/50 shrink-0">
                      {/* Subtotal */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Subtotal ({cart.length} items)</span>
                        <span className="font-semibold text-slate-700">{currency} {cartTotal.toLocaleString()}</span>
                      </div>

                      {/* Discount */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-500">Discount (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={billDiscount}
                          onChange={e => setBillDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                          className="w-20 h-8 text-right border border-slate-200 rounded-lg px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 bg-white"
                          placeholder="0"
                        />
                      </div>
                      {billDiscount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-red-500">Discount Amount</span>
                          <span className="text-red-500 font-semibold">-{currency} {Math.round(cartTotal * billDiscount / 100).toLocaleString()}</span>
                        </div>
                      )}

                      {/* Grand Total */}
                      <div className="flex items-center justify-between pt-3 border-t-2 border-slate-300">
                        <span className="text-base font-bold text-slate-800">Grand Total</span>
                        <span className="text-xl font-black text-emerald-700">{currency} {(cartTotal - Math.round(cartTotal * billDiscount / 100)).toLocaleString()}</span>
                      </div>

                      {/* Checkout Button */}
                      <button
                        onClick={completeSale}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Complete Sale
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
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
