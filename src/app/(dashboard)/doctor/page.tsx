'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { searchPatients, getPatientByNo, getVisitsByPatient, getActiveVisitByPatient, addLabOrder, addPrescription, addXRayOrder, addUltrasoundOrder, updateVisit, updatePatient, getPrescriptionsByPatient, getLabOrdersByPatient, searchMedicines, genId, todayStr, timeStr, addAdmission, getAdmissionsByPatient, updateAdmission, getHospitalSettings, getXRayOrders, getUltrasoundOrders } from '@/lib/store';
import type { Patient, Visit, LabOrder, Prescription, Admission, MedicineItem, XRayOrder, UltrasoundOrder } from '@/lib/types';
import { initLabData, getLabOrders as getLisLabOrders, addLabOrder as addLisLabOrder, type LabOrderItem } from '@/lib/lab-store';
import { generateProfessionalLabReportHtml, getLabPrintData, openPrintWindow } from '@/lib/print-lab-report';

const LAB_TESTS = ['CBC', 'Blood Sugar (Fasting)', 'Blood Sugar (Random)', 'Liver Function Test (LFT)', 'Kidney Function Test (KFT)', 'Urine Routine', 'Urine Culture', 'Thyroid Panel (T3,T4,TSH)', 'Lipid Profile', 'HbA1c', 'ESR', 'CRP', 'HIV', 'Hepatitis B', 'Hepatitis C', 'Dengue NS1', 'Electrolytes', 'Vitamin D', 'Iron Studies', 'Blood Group', 'PT/INR'];
const TIMING_OPTIONS = ['Before Breakfast','After Breakfast','Before Lunch','After Lunch','Before Dinner','After Dinner','At Bedtime','Every 6 Hours','Every 8 Hours','SOS','After Meal','Before Meal','Empty Stomach'];
const DURATION_OPTIONS = ['3 days','5 days','7 days','10 days','15 days','30 days','As needed'];

export default function DoctorPage() {
  // Session
  const [session, setSession] = useState<{ userId: string; name: string; role: string; department: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [tab, setTab] = useState('info');
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);

  // Read tab from URL params on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab === 'admission') setTab('admission');
      else if (urlTab === 'discharge') setTab('info');
    }
  }, []);
  const [vitals, setVitals] = useState({bp:'',pulse:'',temp:'',weight:''});
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [rxMeds, setRxMeds] = useState<{name:string;form:string;strength:string;qtyPerDay:string;timing:string;duration:string;instructions:string;price:number;selected:boolean}[]>([]);
  const [medSearchQuery, setMedSearchQuery] = useState('');
  const [medSearchResults, setMedSearchResults] = useState<MedicineItem[]>([]);
  const [rxNotes, setRxNotes] = useState('');
  const [xrayType, setXrayType] = useState('');
  const [usgType, setUsgType] = useState('');
  const [pLabOrders, setPLabOrders] = useState<LabOrder[]>([]);
  const [pPrescriptions, setPPrescriptions] = useState<Prescription[]>([]);
  const [pXRayOrders, setPXRayOrders] = useState<XRayOrder[]>([]);
  const [pUltrasoundOrders, setPUltrasoundOrders] = useState<UltrasoundOrder[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [labRefreshKey, setLabRefreshKey] = useState(0); // force re-render for lab data

  // Admission fields (doctor chooses date + purpose + fee)
  const [admissionPurpose, setAdmissionPurpose] = useState('');
  const [admissionDate, setAdmissionDate] = useState('');
  const [admissionNotes, setAdmissionNotes] = useState('');
  const [admissionFee, setAdmissionFee] = useState('');

  // X-Ray Image Viewer state
  const [xrayViewer, setXrayViewer] = useState<{open:boolean;order:XRayOrder|null}>({open:false,order:null});
  const [xrayZoom, setXrayZoom] = useState(1);
  const [xrayRotation, setXrayRotation] = useState(0);
  const [xrayBrightness, setXrayBrightness] = useState(100);
  const [xrayContrast, setXrayContrast] = useState(100);
  const [xrayInvert, setXrayInvert] = useState(false);
  const [xrayPanX, setXrayPanX] = useState(0);
  const [xrayPanY, setXrayPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{x:number;y:number}>({x:0,y:0});
  const panStart = useRef<{x:number;y:number}>({x:0,y:0});

  // Scroll wheel zoom for X-Ray viewer
  const handleXrayWheelZoom = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setXrayZoom(prev => Math.min(Math.max(prev - e.deltaY * 0.005, 0.1), 10));
  }, []);

  // Mouse drag handlers for X-Ray panning
  const handleXrayMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { x: xrayPanX, y: xrayPanY };
  }, [xrayPanX, xrayPanY]);

  const handleXrayMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setXrayPanX(panStart.current.x + dx);
    setXrayPanY(panStart.current.y + dy);
  }, [isDragging]);

  const handleXrayMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetXrayViewer = () => {
    setXrayZoom(1); setXrayRotation(0); setXrayBrightness(100); setXrayContrast(100); setXrayInvert(false);
    setXrayPanX(0); setXrayPanY(0);
  };

  const showToast = (msg:string,type:'success'|'error')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000)};

  useEffect(() => {
    try {
      const s = localStorage.getItem('baga_session');
      if (s) setSession(JSON.parse(s));
    } catch {}

    // Auto-refresh when lab data changes
    const handleLabUpdate = () => {
      initLabData();
      setLabRefreshKey(k => k + 1); // force re-render
    };
    window.addEventListener('baga_lab_update', handleLabUpdate);
    window.addEventListener('storage', handleLabUpdate);
    const interval = setInterval(handleLabUpdate, 3000);

    return () => {
      window.removeEventListener('baga_lab_update', handleLabUpdate);
      window.removeEventListener('storage', handleLabUpdate);
      clearInterval(interval);
    };
  }, []);

  // Refresh data when switching to reports or history tabs
  useEffect(() => {
    if (!selectedPatient) return;
    if (tab === 'reports' || tab === 'history') {
      initLabData();
      setPXRayOrders(getXRayOrders().filter(o => o.patientId === selectedPatient.id));
      setPUltrasoundOrders(getUltrasoundOrders().filter(o => o.patientId === selectedPatient.id));
      setPPrescriptions(getPrescriptionsByPatient(selectedPatient.id));
      setPLabOrders(getLabOrdersByPatient(selectedPatient.id));
      setLabRefreshKey(k => k + 1);
    }
  }, [tab]);

  const handleSearch=()=>{
    if(!searchQuery.trim())return;
    const r=searchPatients(searchQuery.trim());
    const byNo=getPatientByNo(searchQuery.trim());
    if(byNo&&!r.find(x=>x.id===byNo.id))r.unshift(byNo);
    setSearchResults(r);
  };

  const selectPatient=(p:Patient)=>{
    setSelectedPatient(p);setSearchResults([]);
    setDiagnosis('');setNotes('');setSelectedTests([]);setRxMeds([]);setRxNotes('');setXrayType('');setUsgType('');
    setVitals({bp:'',pulse:'',temp:'',weight:''});
    setAdmissionPurpose('');setAdmissionDate('');setAdmissionNotes('');setAdmissionFee('');
    const ev=getActiveVisitByPatient(p.id);
    if(ev){setActiveVisit(ev);setDiagnosis(ev.diagnosis||'');setNotes(ev.notes||'');setVitals(ev.vitals||{bp:'',pulse:'',temp:'',weight:''});}
    else{
      const dept = session?.department || 'General';
      const docName = session?.name || 'Current Doctor';
      const nv:Visit={id:genId(),patientId:p.id,patientNo:p.patientNo,patientName:p.name,department:dept,doctor:docName,doctorFee:0,date:todayStr(),time:timeStr(),tokenNo:0,status:'Active',diagnosis:'',notes:'',vitals:{bp:'',pulse:'',temp:'',weight:''}};
      setActiveVisit(nv);
    }
    setPLabOrders(getLabOrdersByPatient(p.id));
    // Also refresh from LIS store to get latest statuses from Lab
    initLabData();
    setPPrescriptions(getPrescriptionsByPatient(p.id));
    setPXRayOrders(getXRayOrders().filter(o => o.patientId === p.id));
    setPUltrasoundOrders(getUltrasoundOrders().filter(o => o.patientId === p.id));
    setAdmissions(getAdmissionsByPatient(p.id));
    setTab('info');
  };

  const saveVitals=()=>{if(!activeVisit)return;updateVisit(activeVisit.id,{vitals});showToast('Vitals saved!','success')};
  const saveDiagnosis=()=>{if(!activeVisit)return;updateVisit(activeVisit.id,{diagnosis,notes});showToast('Diagnosis saved!','success')};

  // Mark patient as Checked (visit completed)
  const checkPatient=()=>{
    if(!activeVisit||!selectedPatient)return;
    if(activeVisit.status==='Completed'){showToast('Patient already checked!','error');return;}
    if(!confirm(`Mark ${selectedPatient.name} as Checked?\n\nThis means the patient has been examined and the visit is complete.`))return;
    updateVisit(activeVisit.id,{status:'Completed',diagnosis,notes,vitals});
    setActiveVisit({...activeVisit,status:'Completed'});
    updatePatient(selectedPatient.id,{lastVisit:todayStr(),totalVisits:selectedPatient.totalVisits+1});
    showToast(`${selectedPatient.name} marked as Checked!`,'success');
  };

  const orderLabTests=()=>{
    if(!activeVisit||selectedTests.length===0){showToast('Select tests','error');return}
    const docName = session?.name || 'Current Doctor';
    const orderId = genId();
    const labData = {id:orderId,visitId:activeVisit.id,patientId:selectedPatient!.id,patientNo:selectedPatient!.patientNo,patientName:selectedPatient!.name,tests:selectedTests.map(t=>({testName:t,price:0,selected:true})),orderedBy:docName,date:todayStr(),time:timeStr(),status:'Pending' as const,results:[]};
    // Write to BOTH main store AND LIS store so Lab Tech sees it immediately
    addLabOrder(labData);
    initLabData(); // sync LIS store
    addLisLabOrder({
      id: orderId, visitId: activeVisit.id, patientId: selectedPatient!.id,
      patientNo: selectedPatient!.patientNo, patientName: selectedPatient!.name,
      gender: selectedPatient!.gender || 'Unknown', age: selectedPatient!.age || '',
      tests: selectedTests.map(t => ({testName: t, testId: t, price: 0})),
      orderedBy: docName, urgency: 'routine', sampleType: 'Blood',
      status: 'ordered', date: todayStr(), time: timeStr(), results: [],
      totalAmount: 0, paidAmount: 0, paymentStatus: 'unpaid',
    });
    setSelectedTests([]);setPLabOrders(getLabOrdersByPatient(selectedPatient!.id));
    showToast(`${selectedTests.length} test(s) ordered!`,'success');
  };

  const addMedFromSearch=(med:MedicineItem)=>{
    setRxMeds([...rxMeds,{name:med.name,form:med.form,strength:med.strength,qtyPerDay:'1',timing:'',duration:'',instructions:'',price:med.price,selected:true}]);
    setMedSearchQuery('');setMedSearchResults([]);
  };
  const updateRxMed=(idx:number,field:string,value:string)=>{const u=[...rxMeds];u[idx]={...u[idx],[field]:value};setRxMeds(u);};

  const saveRx=()=>{
    if(!activeVisit||rxMeds.length===0){showToast('Add medicines','error');return}
    const docName = session?.name || 'Current Doctor';
    addPrescription({id:genId(),visitId:activeVisit.id,patientId:selectedPatient!.id,patientNo:selectedPatient!.patientNo,patientName:selectedPatient!.name,medicines:rxMeds.map(m=>({...m,dosage:`${m.qtyPerDay} ${m.form.toLowerCase()}(s)`,frequency:m.timing})),prescribedBy:docName,date:todayStr(),time:timeStr(),status:'Active',notes:rxNotes});
    setRxMeds([]);setRxNotes('');setPPrescriptions(getPrescriptionsByPatient(selectedPatient!.id));
    showToast('Prescription saved!','success');
  };

  const orderXR=()=>{
    if(!activeVisit||!xrayType){showToast('Select type','error');return}
    const docName = session?.name || 'Current Doctor';
    addXRayOrder({id:genId(),visitId:activeVisit.id,patientId:selectedPatient!.id,patientNo:selectedPatient!.patientNo,patientName:selectedPatient!.name,xrayType,price:0,selected:true,orderedBy:docName,date:todayStr(),status:'Pending'});
    setXrayType('');setPXRayOrders(getXRayOrders().filter(o => o.patientId === selectedPatient!.id));showToast('X-Ray ordered!','success');
  };

  const orderUSG=()=>{
    if(!activeVisit||!usgType){showToast('Select type','error');return}
    const docName = session?.name || 'Current Doctor';
    addUltrasoundOrder({id:genId(),visitId:activeVisit.id,patientId:selectedPatient!.id,patientNo:selectedPatient!.patientNo,patientName:selectedPatient!.name,usgType,price:0,selected:true,orderedBy:docName,date:todayStr(),status:'Pending'});
    setUsgType('');setPUltrasoundOrders(getUltrasoundOrders().filter(o => o.patientId === selectedPatient!.id));showToast('Ultrasound ordered!','success');
  };

  // Doctor approves admission - department & doctor auto from session
  const handleAdmission = () => {
    if (!selectedPatient || !admissionPurpose) { showToast('Please select admission purpose', 'error'); return; }
    const dept = session?.department || 'General';
    const docName = session?.name || 'Current Doctor';
    const fee = parseFloat(admissionFee) || 0;
    addAdmission({
      id: genId(),
      patientId: selectedPatient.id,
      patientNo: selectedPatient.patientNo,
      patientName: selectedPatient.name,
      department: dept,
      doctor: docName,
      doctorFee: fee,
      admissionDate: admissionDate || todayStr(),
      admittedAt: '',
      dischargedAt: '',
      purpose: admissionPurpose,
      roomNo: '',
      roomTypeId: '',
      roomChargesPerNight: 0,
      status: 'Approved',
      notes: admissionNotes,
      createdAt: todayStr(),
      approvedBy: docName,
    });
    setAdmissions(getAdmissionsByPatient(selectedPatient.id));
    setAdmissionPurpose('');setAdmissionDate('');setAdmissionNotes('');setAdmissionFee('');
    showToast('Admission Approved! Reception has been notified.', 'success');
  };

  // Print Lab Report (opens in new window - same format as Lab Reports page)
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
    openPrintWindow(html);
  };

  // Print X-Ray Report (opens in new window)
  const printXRayReport = (o: XRayOrder) => {
    if (!selectedPatient) return;
    const html = `<!DOCTYPE html><html><head><title>X-Ray Report - ${selectedPatient.name}</title><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;}
      @page{size:A4;margin:15mm;}
      .report{width:100%;max-width:700px;margin:0 auto;padding:2px;}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px double #000;padding-bottom:6px;margin-bottom:8px;}
      .header h1{font-size:16px;letter-spacing:1px;margin:0;color:#000;}
      .header .sub{font-size:9px;color:#000;}
      .header .rid{font-size:9px;color:#000;text-align:right;}
      .patient-bar{display:flex;justify-content:space-between;background:#fff;padding:5px 8px;border:1px solid #000;border-radius:3px;margin-bottom:10px;font-size:11px;flex-wrap:wrap;gap:2px;}
      .patient-bar span{white-space:nowrap;} .patient-bar b{color:#000;}
      .report-text{background:#fff;border:1px solid #000;border-radius:4px;padding:12px 15px;margin:10px 0;white-space:pre-wrap;line-height:1.8;font-size:12px;min-height:120px;}
      .footer{margin-top:20px;padding-top:6px;border-top:1px solid #000;display:flex;justify-content:space-between;font-size:9px;color:#000;}
      .sig-area{margin-top:25px;display:flex;justify-content:space-between;}
      .sig-box{text-align:center;width:180px;}
      .sig-line{border-top:1px solid #000;margin-top:50px;padding-top:3px;font-size:10px;}
      .print-btn{position:fixed;top:10px;right:10px;padding:8px 20px;background:#fff;color:#000;border:none;border-radius:4px;font-size:13px;font-weight:bold;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:999;}
      .print-btn:hover{background:#fff;}
      @media print{.print-btn{display:none!important;}body{background:#fff;}@page{margin:10mm;}}
    </style></head><body>
      <button class="print-btn" onclick="window.print()">Print Report</button>
      <div class="report">
        <div class="header">
          <div><h1>BAGA HOSPITAL</h1><div class="sub">RADIOLOGY DEPARTMENT - X-RAY REPORT</div></div>
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
          <span>BAGA Hospital - Radiology Department</span>
          <span>This is a computer-generated report</span>
        </div>
      </div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  // Print USG Report (opens in new window)
  const printUSGReport = (o: UltrasoundOrder) => {
    if (!selectedPatient) return;
    const html = `<!DOCTYPE html><html><head><title>Ultrasound Report - ${selectedPatient.name}</title><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;}
      @page{size:A4;margin:15mm;}
      .report{width:100%;max-width:700px;margin:0 auto;padding:2px;}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px double #000;padding-bottom:6px;margin-bottom:8px;}
      .header h1{font-size:16px;letter-spacing:1px;margin:0;color:#000;}
      .header .sub{font-size:9px;color:#000;}
      .header .rid{font-size:9px;color:#000;text-align:right;}
      .patient-bar{display:flex;justify-content:space-between;background:#fff;padding:5px 8px;border:1px solid #000;border-radius:3px;margin-bottom:10px;font-size:11px;flex-wrap:wrap;gap:2px;}
      .patient-bar span{white-space:nowrap;} .patient-bar b{color:#000;}
      .report-text{background:#fff;border:1px solid #000;border-radius:4px;padding:12px 15px;margin:10px 0;white-space:pre-wrap;line-height:1.8;font-size:12px;min-height:120px;}
      .footer{margin-top:20px;padding-top:6px;border-top:1px solid #000;display:flex;justify-content:space-between;font-size:9px;color:#000;}
      .sig-area{margin-top:25px;display:flex;justify-content:space-between;}
      .sig-box{text-align:center;width:180px;}
      .sig-line{border-top:1px solid #000;margin-top:50px;padding-top:3px;font-size:10px;}
      .print-btn{position:fixed;top:10px;right:10px;padding:8px 20px;background:#fff;color:#000;border:none;border-radius:4px;font-size:13px;font-weight:bold;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:999;}
      .print-btn:hover{background:#fff;}
      @media print{.print-btn{display:none!important;}body{background:#fff;}@page{margin:10mm;}}
    </style></head><body>
      <button class="print-btn" onclick="window.print()">Print Report</button>
      <div class="report">
        <div class="header">
          <div><h1>BAGA HOSPITAL</h1><div class="sub">RADIOLOGY DEPARTMENT - ULTRASOUND REPORT</div></div>
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
          <span>BAGA Hospital - Radiology Department</span>
          <span>This is a computer-generated report</span>
        </div>
      </div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  // Get all visits for history
  const allPatientVisits = selectedPatient ? getVisitsByPatient(selectedPatient.id) : [];

  const XRAY_TYPES = ['Chest X-Ray','Abdomen X-Ray','Skull X-Ray','Spine X-Ray (Cervical)','Spine X-Ray (Lumbar)','Pelvis X-Ray','Shoulder X-Ray','Arm X-Ray','Forearm X-Ray','Hand X-Ray','Knee X-Ray','Leg X-Ray','Ankle X-Ray','Foot X-Ray','Ribs X-Ray','Clavicle X-Ray','Wrist X-Ray','Elbow X-Ray','Hip X-Ray','Femur X-Ray','Tibia/Fibula X-Ray','Sinuses X-Ray','Mastoid X-Ray','Mandible X-Ray','Neck AP/Lateral'];
  const USG_TYPES = ['Abdomen Complete','Abdomen (Liver/Gallbladder)','Pelvis','Obstetric (Pregnancy)','Obstetric - Dating Scan','Obstetric - Anomaly Scan','Obstetric - Growth Scan','Obstetric - Doppler','Transvaginal Scan','Transrectal Scan','Thyroid','Breast','Scrotum','Testicular Doppler','Renal / KUB','Renal Doppler','Carotid Doppler','Peripheral Venous Doppler','Peripheral Arterial Doppler','Echocardiography (Echo)','Fetal Echocardiography','Musculoskeletal','Joint (Knee/Shoulder etc)','Soft Tissue / Lump','Whole Abdomen + Pelvis','Paediatric Abdomen','Paediatric Brain (Fontanelle)','Cranial (Neonatal)'];
  const tabs=[{key:'info',label:'Info'},{key:'vitals',label:'Vitals'},{key:'prescribe',label:'Medication'},{key:'orders',label:'Lab / X-Ray / USG'},{key:'admission',label:'Admission'},{key:'notes',label:'Diagnosis'},{key:'reports',label:'Reports'},{key:'history',label:'History'}];

  const doctorName = session?.name || 'Doctor';
  const doctorDept = session?.department || 'General';
  const currency = getHospitalSettings().currency;

  return (
    <div className="space-y-5">
      {toast&&<div className={`toast ${toast.type==='success'?'toast-success':'toast-error'}`}>{toast.msg}</div>}

      {/* Doctor Info Banner */}
      {session && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">{doctorName.charAt(0)}</div>
          <div>
            <p className="font-semibold text-purple-800 text-sm">{doctorName}</p>
            <p className="text-xs text-purple-500">Department: {doctorDept}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border-2 border-purple-200 p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-3">Search Patient - Card Number / Mobile</h2>
        <div className="flex gap-3">
          <input className="form-input flex-1 text-lg" placeholder="Enter card number (BAGA-0001) or mobile number..."
            value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()} />
          <button onClick={handleSearch} className="btn btn-primary btn-lg">Search</button>
        </div>
        {searchResults.length>0&&<div className="mt-3 space-y-2">
          {searchResults.map(p=>(
            <button key={p.id} onClick={()=>selectPatient(p)} className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-purple-50 transition-colors text-left">
              <div><span className="font-mono font-bold text-purple-600">{p.patientNo}</span><span className="font-semibold text-slate-800 ml-3">{p.name}</span><span className="text-sm text-slate-500 ml-2">({p.gender}, {p.age})</span></div>
              <span className="text-sm text-slate-500">{p.mobile}</span>
            </button>
          ))}
        </div>}
      </div>

      {/* Patient Panel */}
      {selectedPatient&&activeVisit&&(
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-purple-600 text-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3"><span className="font-mono font-bold text-lg">{selectedPatient.patientNo}</span><span className="text-purple-200">{selectedPatient.name}</span></div>
                <div className="flex gap-4 mt-1 text-sm text-purple-200"><span>Father: {selectedPatient.fatherName}</span><span>Mobile: {selectedPatient.mobile}</span><span>Age: {selectedPatient.age}/{selectedPatient.gender}</span><span>Visits: {selectedPatient.totalVisits}</span></div>
              </div>
              <div className="flex items-center gap-2">
                {activeVisit.status==='Active'&&<span className="badge badge-green">Active Visit</span>}
                {activeVisit.status==='Completed'&&<span className="badge badge-blue">Checked</span>}
                {activeVisit.status==='Active'&&(
                  <button onClick={checkPatient} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    Check Patient
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 px-4 overflow-x-auto"><div className="flex gap-1">
            {tabs.map(t=>(<button key={t.key} onClick={()=>setTab(t.key)} className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab===t.key?'border-purple-600 text-purple-600':'border-transparent text-slate-500 hover:text-slate-700'}`}>{t.label}</button>))}
          </div></div>

          <div className="p-5">
            {tab==='info'&&(
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[{l:'Patient No',v:selectedPatient.patientNo},{l:'Name',v:selectedPatient.name},{l:'Father/Husband',v:selectedPatient.fatherName},{l:'Mobile',v:selectedPatient.mobile},{l:'Age/Gender',v:`${selectedPatient.age} / ${selectedPatient.gender}`},{l:'Address',v:selectedPatient.address},{l:'Card Status',v:selectedPatient.cardStatus},{l:'Card Expiry',v:selectedPatient.cardExpiry},{l:'Total Visits',v:String(selectedPatient.totalVisits)},{l:'Last Visit',v:selectedPatient.lastVisit}].map((item,i)=>(
                  <div key={i} className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">{item.l}</p><p className="font-semibold text-slate-800">{item.v}</p></div>
                ))}
              </div>
            )}

            {tab==='vitals'&&(
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="form-label">Blood Pressure</label><input className="form-input" placeholder="120/80" value={vitals.bp} onChange={e=>setVitals({...vitals,bp:e.target.value})}/></div>
                  <div><label className="form-label">Pulse</label><input className="form-input" placeholder="72 bpm" value={vitals.pulse} onChange={e=>setVitals({...vitals,pulse:e.target.value})}/></div>
                  <div><label className="form-label">Temperature</label><input className="form-input" placeholder="98.6 F" value={vitals.temp} onChange={e=>setVitals({...vitals,temp:e.target.value})}/></div>
                  <div><label className="form-label">Weight</label><input className="form-input" placeholder="70 kg" value={vitals.weight} onChange={e=>setVitals({...vitals,weight:e.target.value})}/></div>
                </div>
                <button onClick={saveVitals} className="btn btn-primary">Save Vitals</button>
              </div>
            )}

            {tab==='prescribe'&&(
              <div className="space-y-4">
                {/* Medicine Search from Pharmacy */}
                <div className="relative">
                  <label className="form-label">Search & Add Medicine from Pharmacy</label>
                  <div className="flex items-center gap-2 border-2 border-purple-200 rounded-lg px-3 py-2 bg-white focus-within:border-purple-500 transition-colors">
                    <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                      className="flex-1 outline-none text-sm bg-transparent placeholder:text-slate-400"
                      placeholder="Type medicine name, generic name, or category..."
                      value={medSearchQuery}
                      onChange={e=>{const q=e.target.value;setMedSearchQuery(q);if(q.trim().length>1){setMedSearchResults(searchMedicines(q.trim()))}else{setMedSearchResults([])}}}
                      onFocus={()=>{if(medSearchQuery.trim().length>1)setMedSearchResults(searchMedicines(medSearchQuery.trim()))}}
                      onBlur={()=>setTimeout(()=>setMedSearchResults([]),200)}
                    />
                    {medSearchQuery&&(
                      <button onClick={()=>{setMedSearchQuery('');setMedSearchResults([])}} className="text-slate-400 hover:text-slate-600 shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                  {/* Search Results Dropdown */}
                  {medSearchResults.length>0&&(
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                      {medSearchResults.map(med=>(
                        <button
                          key={med.id}
                          onClick={()=>addMedFromSearch(med)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-50 border-b border-slate-100 last:border-b-0 transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 text-sm truncate">{med.name} <span className="text-slate-400 font-normal">{med.genericName!==med.name?`(${med.genericName})`:''}</span></p>
                            <p className="text-xs text-slate-500 mt-0.5">{med.form} &middot; {med.strength} &middot; {med.packing}</p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="font-bold text-purple-700">{currency}{med.price}</p>
                            <span className="badge badge-blue text-xs">{med.category}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {medSearchQuery.trim().length>1&&medSearchResults.length===0&&(
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-4 text-center text-slate-400 text-sm">
                      No medicines found matching &ldquo;{medSearchQuery}&rdquo;
                    </div>
                  )}
                </div>

                {/* Prescription Table */}
                {rxMeds.length>0&&(
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wide">
                          <th className="px-3 py-2.5 text-left font-semibold w-8">#</th>
                          <th className="px-3 py-2.5 text-left font-semibold">Medicine</th>
                          <th className="px-3 py-2.5 text-left font-semibold">Form</th>
                          <th className="px-3 py-2.5 text-left font-semibold">Strength</th>
                          <th className="px-3 py-2.5 text-left font-semibold w-20">Qty/Day</th>
                          <th className="px-3 py-2.5 text-left font-semibold min-w-[170px]">Timing</th>
                          <th className="px-3 py-2.5 text-left font-semibold min-w-[120px]">Duration</th>
                          <th className="px-3 py-2.5 text-left font-semibold min-w-[150px]">Instructions</th>
                          <th className="px-3 py-2.5 text-left font-semibold w-20">Price</th>
                          <th className="px-3 py-2.5 text-center font-semibold w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rxMeds.map((med,idx)=>(
                          <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2 text-slate-400 font-medium text-xs">{idx+1}</td>
                            <td className="px-3 py-2">
                              <span className="font-semibold text-slate-800">{med.name}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{med.form}</td>
                            <td className="px-3 py-2 text-slate-600 font-mono text-xs">{med.strength}</td>
                            <td className="px-3 py-2">
                              <input className="form-input py-1 text-sm text-center" type="number" min="1" max="10" value={med.qtyPerDay} onChange={e=>updateRxMed(idx,'qtyPerDay',e.target.value)} />
                            </td>
                            <td className="px-3 py-2">
                              <select className="form-input py-1 text-sm" value={med.timing} onChange={e=>updateRxMed(idx,'timing',e.target.value)}>
                                <option value="">-- Select --</option>
                                {TIMING_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select className="form-input py-1 text-sm" value={med.duration} onChange={e=>updateRxMed(idx,'duration',e.target.value)}>
                                <option value="">-- Select --</option>
                                {DURATION_OPTIONS.map(d=><option key={d} value={d}>{d}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input className="form-input py-1 text-sm" placeholder="e.g. Take with water" value={med.instructions} onChange={e=>updateRxMed(idx,'instructions',e.target.value)} />
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{currency}{med.price}</td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={()=>setRxMeds(rxMeds.filter((_,i)=>i!==idx))} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded p-1.5 transition-colors" title="Remove medicine">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                          <td colSpan={8} className="px-3 py-2.5 text-right font-bold text-slate-700">Total:</td>
                          <td className="px-3 py-2.5 font-extrabold text-purple-700">{currency}{rxMeds.reduce((s,m)=>s+m.price,0)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {rxMeds.length===0&&(
                  <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                    <svg className="w-12 h-12 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    <p className="font-medium">Search and add medicines from the pharmacy above</p>
                    <p className="text-xs mt-1">Type at least 2 characters to search</p>
                  </div>
                )}

                {/* Notes & Save */}
                <div>
                  <label className="form-label">Prescription Notes</label>
                  <textarea className="form-input" rows={2} value={rxNotes} onChange={e=>setRxNotes(e.target.value)} placeholder="Additional instructions for patient..." />
                </div>
                <button onClick={saveRx} className="btn btn-success btn-lg w-full" disabled={rxMeds.length===0}>
                  💊 Save Prescription ({rxMeds.length} medicine{rxMeds.length!==1?'s':''})
                </button>

                {/* Previous Prescriptions */}
                {pPrescriptions.length>0&&(
                  <div className="mt-6 border-t pt-4">
                    <h4 className="font-semibold text-sm mb-3 text-slate-700">📋 Previous Prescriptions</h4>
                    {pPrescriptions.map(rx=>(
                      <div key={rx.id} className="border border-slate-200 rounded-lg p-3 mb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500">{rx.date} {rx.time} — {rx.prescribedBy}</span>
                          <span className={`badge ${rx.status==='Active'?'badge-blue':'badge-green'}`}>{rx.status}</span>
                        </div>
                        {rx.notes&&<p className="text-xs text-slate-400 mt-1 italic">{rx.notes}</p>}
                        <div className="overflow-x-auto mt-2">
                          <table className="data-table">
                            <thead><tr><th>#</th><th>Medicine</th><th>Form</th><th>Strength</th><th>Qty</th><th>Timing</th><th>Duration</th></tr></thead>
                            <tbody>
                              {rx.medicines.map((m,i)=>(
                                <tr key={i}>
                                  <td className="text-slate-400 text-xs">{i+1}</td>
                                  <td className="font-medium">{m.name}</td>
                                  <td>{m.form||'-'}</td>
                                  <td className="font-mono text-xs">{m.strength||'-'}</td>
                                  <td>{m.qtyPerDay||m.dosage||'-'}</td>
                                  <td>{m.timing||m.frequency||'-'}</td>
                                  <td>{m.duration}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab==='orders'&&(
              <div className="space-y-6">
                {/* Lab Test Ordering */}
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <h3 className="font-semibold text-teal-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    Order Lab Tests
                  </h3>
                  <p className="text-xs text-teal-600 mb-3">Select tests below and click Order to send to Lab department</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {LAB_TESTS.map(t=>(
                      <label key={t} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${selectedTests.includes(t)?'bg-teal-600 text-white border-teal-600':'bg-white border-slate-200 hover:border-teal-400 hover:bg-teal-50'}`}>
                        <input type="checkbox" checked={selectedTests.includes(t)} onChange={e=>{if(e.target.checked){setSelectedTests([...selectedTests,t])}else{setSelectedTests(selectedTests.filter(x=>x!==t))}}} className="sr-only" />
                        <span>{selectedTests.includes(t)?'\u2713 ':''}{t}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm text-slate-500">{selectedTests.length} test(s) selected</span>
                    <button onClick={orderLabTests} disabled={selectedTests.length===0} className="btn btn-primary btn-sm bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed">Order Lab Tests</button>
                  </div>
                </div>

                {/* X-Ray Ordering */}
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                  <h3 className="font-semibold text-rose-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Order X-Ray
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select value={xrayType} onChange={e=>setXrayType(e.target.value)} className="form-input flex-1">
                      <option value="">-- Select X-Ray Type --</option>
                      {XRAY_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                    <button onClick={orderXR} disabled={!xrayType} className="btn btn-primary btn-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed">Order X-Ray</button>
                  </div>
                </div>

                {/* Ultrasound Ordering */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h3 className="font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Order Ultrasound
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select value={usgType} onChange={e=>setUsgType(e.target.value)} className="form-input flex-1">
                      <option value="">-- Select Ultrasound Type --</option>
                      {USG_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                    <button onClick={orderUSG} disabled={!usgType} className="btn btn-primary btn-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Order Ultrasound</button>
                  </div>
                </div>
              </div>
            )}

            {tab==='admission'&&(
              <div className="space-y-4">
                {/* Doctor Admission - Department & Doctor AUTO from session */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <h3 className="font-bold text-amber-800 text-sm uppercase tracking-wide">Patient Admission - Doctor Approval</h3>
                  <p className="text-xs text-amber-600 mt-1">Doctor approves admission. Department and doctor name are auto-filled from your profile.</p>
                </div>

                {/* Auto Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Department (Auto)</p>
                    <p className="font-bold text-purple-700">{doctorDept}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Doctor Name (Auto)</p>
                    <p className="font-bold text-purple-700">{doctorName}</p>
                  </div>
                </div>

                {/* Patient Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-500">Patient</p>
                  <p className="font-bold text-blue-800">{selectedPatient.patientNo} - {selectedPatient.name}</p>
                </div>

                {/* Doctor selects: Date, Purpose & Fee */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Admission Date *</label>
                    <input className="form-input" type="date" value={admissionDate} onChange={e=>setAdmissionDate(e.target.value)} />
                    <p className="text-xs text-slate-400 mt-1">Select the admission date</p>
                  </div>
                  <div>
                    <label className="form-label">Purpose *</label>
                    <select className="form-input" value={admissionPurpose} onChange={e=>setAdmissionPurpose(e.target.value)}>
                      <option value="">-- Select Purpose --</option>
                      <option>Surgery</option>
                      <option>Checkup</option>
                      <option>Delivery</option>
                      <option>Emergency</option>
                      <option>Observation</option>
                      <option>ICU</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Doctor Fee ({currency})</label>
                    <input className="form-input" type="number" min="0" placeholder="e.g. 5000" value={admissionFee} onChange={e=>setAdmissionFee(e.target.value)} />
                    <p className="text-xs text-slate-400 mt-1">Admission / surgery fee amount</p>
                  </div>
                </div>

                <div>
                  <label className="form-label">Doctor Notes</label>
                  <textarea className="form-input" rows={3} value={admissionNotes} onChange={e=>setAdmissionNotes(e.target.value)} placeholder="Enter admission notes... e.g. type of surgery, reason for admission, etc."/>
                </div>

                <button onClick={handleAdmission} className="btn btn-success btn-lg w-full">
                  Approve Admission
                </button>
                <p className="text-xs text-center text-slate-400">After approval, reception will be notified to process the admission</p>

                {/* Previous Admissions */}
                {admissions.length > 0 && (
                  <div className="mt-6 border-t pt-4">
                    <h4 className="font-semibold text-sm mb-2">Patient Admission History</h4>
                    {admissions.map(a => (
                      <div key={a.id} className={`border rounded-lg p-3 mb-2 ${a.status === 'Approved' ? 'border-amber-200 bg-amber-50' : a.status === 'Admitted' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`}>
                        <div className="flex justify-between">
                          <span className="font-medium">{a.purpose}</span>
                          <span className={`badge ${a.status === 'Approved' ? 'badge-amber' : a.status === 'Admitted' ? 'badge-blue' : 'badge-green'}`}>
                            {a.status}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          Date: {a.admissionDate} | Dept: {a.department} | Doctor: {a.doctor}
                          {a.roomNo && ` | Room: ${a.roomNo}`}
                          {a.doctorFee > 0 && ` | Fee: ${currency}${a.doctorFee}`}
                        </div>
                        {a.notes && <div className="text-sm text-slate-500 mt-1">Notes: {a.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab==='notes'&&(
              <div className="space-y-4">
                <div><label className="form-label">Diagnosis</label><textarea className="form-input" rows={3} value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} placeholder="Enter diagnosis..."/></div>
                <div><label className="form-label">Doctor Notes</label><textarea className="form-input" rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Additional notes..."/></div>
                <button onClick={saveDiagnosis} className="btn btn-primary btn-lg">Save Diagnosis</button>
              </div>
            )}

            {tab==='reports'&&(
              <div className="space-y-6">
                {/* Lab Reports Section */}
                <div key={`lab-${labRefreshKey}`}>
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Lab Reports
                  </h3>
                  {getLisLabOrders().filter(o=>o.patientId===selectedPatient!.id).length===0&&<p className="text-slate-400 text-center py-4">No lab reports yet</p>}
                  {getLisLabOrders().filter(o=>o.patientId===selectedPatient!.id).map(o=>{
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
                          <>
                            <button onClick={()=>printLabReport(o)} className="btn btn-primary btn-sm">View / Print Report</button>
                          </>
                        )}
                        {o.status!=='completed'&&(
                          <span className="text-xs text-slate-400 italic py-1">Awaiting results from lab...</span>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* X-Ray Reports Section */}
                <div>
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    X-Ray Reports
                  </h3>
                  {pXRayOrders.length===0&&<p className="text-slate-400 text-center py-4">No X-Ray reports yet</p>}
                  {pXRayOrders.map(o=>(
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
                        {o.status==='Completed'&&o.xrayImage&&(
                          <button onClick={()=>{resetXrayViewer();setXrayViewer({open:true,order:o})}} className="btn btn-outline btn-sm flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                            View X-Ray Image
                          </button>
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

                {/* X-Ray Image Viewer - Fullscreen with drag & scroll zoom */}
                {xrayViewer.open&&xrayViewer.order&&xrayViewer.order.xrayImage&&(
                  <div
                    className="fixed inset-0 bg-black z-[200] flex flex-col"
                    onWheel={handleXrayWheelZoom}
                    onMouseDown={handleXrayMouseDown}
                    onMouseMove={handleXrayMouseMove}
                    onMouseUp={handleXrayMouseUp}
                    onMouseLeave={handleXrayMouseUp}
                  >
                    {/* Top Bar */}
                    <div className="flex items-center justify-between p-3 bg-slate-900 text-white shrink-0">
                      <div>
                        <h3 className="font-bold">X-Ray Viewer — {xrayViewer.order.patientName}</h3>
                        <p className="text-xs text-slate-400">{xrayViewer.order.xrayType} | {xrayViewer.order.date} | {xrayViewer.order.orderedBy}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-slate-700 px-2 py-1 rounded">{Math.round(xrayZoom * 100)}%</span>
                        <button onClick={()=>setXrayViewer({open:false,order:null})} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm font-medium">Close</button>
                      </div>
                    </div>

                    {/* Image Area */}
                    <div className="flex-1 overflow-hidden flex items-center justify-center bg-black relative" style={{minHeight:0}}>
                      <img
                        src={xrayViewer.order.xrayImage}
                        alt="X-Ray"
                        className="max-w-full max-h-full object-contain select-none"
                        style={{
                          transform: `translate(${xrayPanX}px, ${xrayPanY}px) scale(${xrayZoom}) rotate(${xrayRotation}deg)`,
                          filter: `brightness(${xrayBrightness}%) contrast(${xrayContrast}%) ${xrayInvert ? 'invert(1)' : ''}`,
                          transition: isDragging ? 'none' : 'transform 0.1s ease',
                          cursor: isDragging ? 'grabbing' : 'grab',
                        }}
                        draggable={false}
                      />
                    </div>

                    {/* Controls Bar */}
                    <div className="bg-slate-900 text-white p-3 border-t border-slate-700 shrink-0">
                      <div className="flex flex-wrap items-center gap-3 max-w-5xl mx-auto">
                        {/* Zoom */}
                        <div className="flex items-center gap-1">
                          <button onClick={()=>setXrayZoom(z=>Math.min(z+0.25,10))} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm font-bold">+</button>
                          <button onClick={()=>setXrayZoom(z=>Math.max(z-0.25,0.1))} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm font-bold">-</button>
                          <button onClick={resetXrayViewer} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">Reset</button>
                          <button onClick={()=>{setXrayZoom(1);setXrayPanX(0);setXrayPanY(0)}} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">Fit</button>
                        </div>
                        <div className="w-px h-6 bg-slate-600" />
                        {/* Rotate */}
                        <div className="flex items-center gap-1">
                          <button onClick={()=>setXrayRotation(r=>r-90)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm" title="Rotate Left">&#8634;</button>
                          <button onClick={()=>setXrayRotation(r=>r+90)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm" title="Rotate Right">&#8635;</button>
                        </div>
                        <div className="w-px h-6 bg-slate-600" />
                        {/* Brightness */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400">Brightness</label>
                          <input type="range" min="20" max="300" value={xrayBrightness} onChange={e=>setXrayBrightness(Number(e.target.value))} className="w-20 accent-slate-300" />
                          <span className="text-xs w-8">{xrayBrightness}%</span>
                        </div>
                        {/* Contrast */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400">Contrast</label>
                          <input type="range" min="20" max="300" value={xrayContrast} onChange={e=>setXrayContrast(Number(e.target.value))} className="w-20 accent-slate-300" />
                          <span className="text-xs w-8">{xrayContrast}%</span>
                        </div>
                        <div className="w-px h-6 bg-slate-600" />
                        {/* Invert */}
                        <button onClick={()=>setXrayInvert(v=>!v)} className={`px-2 py-1 rounded text-sm font-medium ${xrayInvert ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
                          Invert {xrayInvert ? 'ON' : 'OFF'}
                        </button>
                        <div className="w-px h-6 bg-slate-600" />
                        <span className="text-xs text-slate-500">Scroll to zoom | Click+Drag to pan</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ultrasound Reports Section */}
                <div>
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Ultrasound Reports
                  </h3>
                  {pUltrasoundOrders.length===0&&<p className="text-slate-400 text-center py-4">No ultrasound reports yet</p>}
                  {pUltrasoundOrders.map(o=>(
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

                {/* Prescriptions Section */}
                <div>
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Prescriptions
                  </h3>
                  {pPrescriptions.length===0&&<p className="text-slate-400 text-center py-4">No prescriptions yet</p>}
                  {pPrescriptions.map(rx=>(
                    <div key={rx.id} className="border border-slate-200 rounded-lg p-4 mb-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">{rx.date} {rx.time} — {rx.prescribedBy}</span>
                        <span className={`badge ${rx.status==='Active'?'badge-blue':'badge-green'}`}>{rx.status}</span>
                      </div>
                      <table className="data-table mt-2"><thead><tr><th>Medicine</th><th>Form</th><th>Strength</th><th>Qty</th><th>Timing</th><th>Duration</th></tr></thead><tbody>{rx.medicines.map((m,i)=><tr key={i}><td className="font-medium">{m.name}</td><td>{m.form||'-'}</td><td>{m.strength||'-'}</td><td>{m.qtyPerDay||m.dosage||'-'}</td><td>{m.timing||m.frequency||'-'}</td><td>{m.duration}</td></tr>)}</tbody></table>
                      {rx.notes&&<p className="text-xs text-slate-400 mt-2 italic">Notes: {rx.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab==='history'&&(
              <div className="space-y-6">
                {allPatientVisits.length===0?(
                  <div className="text-center py-10 text-slate-400">
                    <svg className="w-16 h-16 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="font-medium">No previous visits found</p>
                    <p className="text-xs mt-1">Visit history will appear here after consultations</p>
                  </div>
                ):(
                  allPatientVisits.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)).map(visit=>{
                    const visitRx = pPrescriptions.filter(rx=>rx.visitId===visit.id);
                    const visitLab = getLabOrdersByPatient(selectedPatient!.id).filter(l=>l.visitId===visit.id);
                    const visitXray = pXRayOrders.filter(x=>x.visitId===visit.id);
                    const visitUsg = pUltrasoundOrders.filter(u=>u.visitId===visit.id);
                    const visitLisLab = getLisLabOrders().filter(l=>l.patientId===selectedPatient!.id && l.visitId===visit.id);
                    return (
                      <div key={visit.id} className="border border-slate-200 rounded-xl overflow-hidden">
                        {/* Visit Header */}
                        <div className={`px-4 py-3 flex items-center justify-between ${visit.status==='Active'?'bg-blue-50 border-b border-blue-200':'bg-slate-50 border-b border-slate-200'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${visit.status==='Active'?'bg-blue-500':visit.status==='Discharged'?'bg-green-500':'bg-slate-400'}`}>
                              {visit.date.split('-')[2]}<br/><span className="text-[8px] font-normal">{visit.date.split('-')[1]}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{visit.date} at {visit.time}</p>
                              <p className="text-xs text-slate-500">Doctor: {visit.doctor} | Dept: {visit.department}</p>
                            </div>
                          </div>
                          <span className={`badge ${visit.status==='Active'?'badge-blue':visit.status==='Discharged'?'badge-green':'badge-amber'}`}>{visit.status}</span>
                        </div>
                        <div className="p-4 space-y-3">
                          {/* Vitals */}
                          {visit.vitals&&(visit.vitals.bp||visit.vitals.pulse||visit.vitals.temp||visit.vitals.weight)&&(
                            <div className="flex flex-wrap gap-2">
                              {visit.vitals.bp&&<span className="badge badge-slate">BP: {visit.vitals.bp}</span>}
                              {visit.vitals.pulse&&<span className="badge badge-slate">Pulse: {visit.vitals.pulse}</span>}
                              {visit.vitals.temp&&<span className="badge badge-slate">Temp: {visit.vitals.temp}</span>}
                              {visit.vitals.weight&&<span className="badge badge-slate">Weight: {visit.vitals.weight}</span>}
                            </div>
                          )}
                          {/* Diagnosis */}
                          {visit.diagnosis&&(
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                              <p className="text-xs font-semibold text-amber-700 mb-1">Diagnosis</p>
                              <p className="text-sm text-slate-700">{visit.diagnosis}</p>
                            </div>
                          )}
                          {/* Notes */}
                          {visit.notes&&(
                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                              <p className="text-xs font-semibold text-slate-600 mb-1">Doctor Notes</p>
                              <p className="text-sm text-slate-700">{visit.notes}</p>
                            </div>
                          )}
                          {/* Prescriptions */}
                          {visitRx.length>0&&(
                            <div>
                              <p className="text-xs font-semibold text-purple-700 mb-2">Prescriptions ({visitRx.length})</p>
                              {visitRx.map(rx=>(
                                <div key={rx.id} className="border border-purple-100 rounded-lg p-2 mb-1 bg-purple-50/50">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-slate-500">{rx.prescribedBy} — {rx.date}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {rx.medicines.map((m,i)=><span key={i} className="badge badge-purple text-xs">{m.name} {m.strength||''} - {m.timing||m.frequency||''} - {m.duration||''}</span>)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Lab Orders */}
                          {visitLab.length>0&&(
                            <div>
                              <p className="text-xs font-semibold text-teal-700 mb-2">Lab Tests ({visitLab.length})</p>
                              <div className="flex flex-wrap gap-1">
                                {visitLab.map(l=>(
                                  <span key={l.id} className={`badge text-xs ${l.status==='Completed'?'badge-green':l.status==='In Progress'?'badge-blue':'badge-amber'}`}>{l.tests.map(t=>t.testName).join(', ')} - {l.status}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* LIS Lab Results */}
                          {visitLisLab.length>0&&visitLisLab.some(l=>l.status==='completed'&&l.results.length>0)&&(
                            <div>
                              <p className="text-xs font-semibold text-teal-700 mb-2">Lab Results</p>
                              {visitLisLab.filter(l=>l.status==='completed'&&l.results.length>0).map(l=>(
                                <div key={l.id} className="border border-teal-100 rounded-lg p-2 mb-1">
                                  <div className="overflow-x-auto">
                                    <table className="text-xs w-full">
                                      <thead><tr className="bg-teal-50"><th className="px-2 py-1 text-left">Test</th><th className="px-2 py-1">Result</th><th className="px-2 py-1">Unit</th><th className="px-2 py-1">Ref</th><th className="px-2 py-1">Flag</th></tr></thead>
                                      <tbody>{l.results.map((r,i)=><tr key={i} className={r.flag!=='Normal'?'bg-red-50':''}><td className="px-2 py-0.5">{r.parameter}</td><td className="px-2 py-0.5 text-center font-bold">{r.value}</td><td className="px-2 py-0.5 text-center">{r.unit||''}</td><td className="px-2 py-0.5 text-center text-slate-400">{r.refRange||''}</td><td className="px-2 py-0.5 text-center"><span className={`badge text-[10px] ${r.flag==='Normal'?'badge-green':'badge-rose'}`}>{r.flag}</span></td></tr>)}</tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* X-Ray */}
                          {visitXray.length>0&&(
                            <div>
                              <p className="text-xs font-semibold text-rose-700 mb-2">X-Ray ({visitXray.length})</p>
                              {visitXray.map(x=>(
                                <div key={x.id} className="flex items-center justify-between border border-rose-100 rounded-lg p-2 mb-1 bg-rose-50/50">
                                  <div>
                                    <span className="font-medium text-sm">{x.xrayType}</span>
                                    <span className="text-xs text-slate-500 ml-2">{x.date}</span>
                                  </div>
                                  <div className="flex gap-1 items-center">
                                    <span className={`badge text-xs ${x.status==='Completed'?'badge-green':'badge-amber'}`}>{x.status}</span>
                                    {x.status==='Completed'&&x.xrayImage&&<button onClick={()=>{setXrayZoom(1);setXrayRotation(0);setXrayBrightness(100);setXrayContrast(100);setXrayInvert(false);setXrayViewer({open:true,order:x})}} className="btn btn-outline btn-xs">View Image</button>}
                                    {x.status==='Completed'&&x.report&&<button onClick={()=>printXRayReport(x)} className="btn btn-outline btn-xs">View Report</button>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Ultrasound */}
                          {visitUsg.length>0&&(
                            <div>
                              <p className="text-xs font-semibold text-indigo-700 mb-2">Ultrasound ({visitUsg.length})</p>
                              {visitUsg.map(u=>(
                                <div key={u.id} className="flex items-center justify-between border border-indigo-100 rounded-lg p-2 mb-1 bg-indigo-50/50">
                                  <div>
                                    <span className="font-medium text-sm">{u.usgType}</span>
                                    <span className="text-xs text-slate-500 ml-2">{u.date}</span>
                                  </div>
                                  <div className="flex gap-1 items-center">
                                    <span className={`badge text-xs ${u.status==='Completed'?'badge-green':'badge-amber'}`}>{u.status}</span>
                                    {u.status==='Completed'&&u.report&&<button onClick={()=>printUSGReport(u)} className="btn btn-outline btn-xs">View Report</button>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Admissions */}
                          {admissions.filter(a=>a.patientId===visit.patientId).length>0&&(
                            <div>
                              <p className="text-xs font-semibold text-amber-700 mb-2">Admissions</p>
                              {admissions.filter(a=>a.patientId===visit.patientId).map(a=>(
                                <div key={a.id} className="border border-amber-100 rounded-lg p-2 mb-1 bg-amber-50/50">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">{a.purpose} — {a.department}</span>
                                    <span className={`badge text-xs ${a.status==='Admitted'?'badge-blue':a.status==='Discharged'?'badge-green':'badge-amber'}`}>{a.status}</span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1">Admitted: {a.admissionDate} | Doctor: {a.doctor} {a.dischargedAt?`| Discharged: ${a.dischargedAt}`:''}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedPatient&&(
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-6xl mb-4">&#128137;</p>
          <h3 className="text-lg font-semibold text-slate-600">Search Patient to Start Consultation</h3>
          <p className="text-sm text-slate-400 mt-2">Enter card number (BAGA-0001) or mobile to search</p>
        </div>
      )}
    </div>
  );
}
