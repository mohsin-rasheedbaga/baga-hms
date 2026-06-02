'use client';
import { useState, useEffect, useCallback } from 'react';
import { getEmployees, addEmployee, updateEmployee, deleteEmployee, searchEmployees, genId, todayStr, generateEmployeeCode, getAttendanceRecords, getHospital } from '@/lib/store';
import type { Employee, EducationRecord, ExperienceRecord, DocumentRecord, EquipmentRecord, AttendanceRecord } from '@/lib/types';
import { triggerPrint } from '@/lib/print-utils';

const DEPARTMENTS = ['Emergency', 'Cardiology', 'Gynecology', 'Orthopedic', 'Pediatrician', 'ENT', 'General Medicine', 'Skin Specialist', 'Eye Specialist', 'Dental', 'Physiotherapy', 'Surgery', 'Laboratory', 'Pharmacy', 'Radiology', 'Ultrasound', 'Reception', 'Management', 'Administration', 'General Ward', 'ICU', 'Accounts', 'IT', 'Security', 'Housekeeping'];
const DOC_TYPES: DocumentRecord['type'][] = ['CNIC', 'CV', 'Degree', 'Certificate', 'Experience Letter', 'Photo', 'Other'];
const EQUIP_CATEGORIES: EquipmentRecord['category'][] = ['Laptop', 'Mobile', 'Uniform', 'ID Card', 'Badge', 'Vehicle', 'Medical Kit', 'Tools', 'Keys', 'Other'];
const EQUIP_CONDITIONS: EquipmentRecord['condition'][] = ['New', 'Good', 'Fair', 'Damaged'];
const EQUIP_STATUSES: EquipmentRecord['status'][] = ['Issued', 'Returned', 'Lost', 'Damaged'];

interface FormState {
  name: string; fatherName: string; cnic: string; mobile: string; gender: string; age: string; address: string;
  designation: string; department: string; salary: number; joinDate: string; bankAccount: string; emergencyContact: string;
  education: EducationRecord[]; experience: ExperienceRecord[]; documents: DocumentRecord[]; equipment: EquipmentRecord[];
}

const emptyForm: FormState = {
  name: '', fatherName: '', cnic: '', mobile: '', gender: 'Male', age: '', address: '',
  designation: '', department: '', salary: 0, joinDate: todayStr(), bankAccount: '', emergencyContact: '',
  education: [], experience: [], documents: [], equipment: [],
};

const STEPS = ['Personal Info', 'Education & Experience', 'Documents', 'Equipment Issued', 'Review & Submit'];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [step, setStep] = useState(0);
  const [empCode, setEmpCode] = useState('');
  const [empAttendance, setEmpAttendance] = useState<AttendanceRecord[]>([]);
  const [joiningLetter, setJoiningLetter] = useState<Employee | null>(null);

  const loadData = useCallback(() => { setEmployees(getEmployees()); }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const filtered = search ? searchEmployees(search) : employees;
  const displayed = filtered
    .filter(e => filterDept ? e.department === filterDept : true)
    .filter(e => filterStatus ? e.status === filterStatus : true);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const updateField = (field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAdd = () => {
    const code = generateEmployeeCode();
    setEmpCode(code);
    setForm(emptyForm);
    setEditMode(false);
    setEditId('');
    setStep(0);
    setShowModal(true);
  };

  const handleEdit = (emp: Employee) => {
    setEmpCode(emp.employeeCode);
    setForm({
      name: emp.name, fatherName: emp.fatherName, cnic: emp.cnic, mobile: emp.mobile,
      gender: emp.gender, age: emp.age, address: emp.address,
      designation: emp.designation, department: emp.department, salary: emp.salary,
      joinDate: emp.joinDate, bankAccount: emp.bankAccount, emergencyContact: emp.emergencyContact,
      education: [...(emp.education || [])], experience: [...(emp.experience || [])],
      documents: [...(emp.documents || [])], equipment: [...(emp.equipment || [])],
    });
    setEditMode(true);
    setEditId(emp.id);
    setStep(0);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name || !form.cnic || !form.mobile || !form.designation || !form.department) {
      showToast('Please fill all required fields (Name, CNIC, Mobile, Designation, Department)', 'error');
      return;
    }
    const empData: Employee = {
      id: editMode ? editId : genId(),
      employeeCode: empCode,
      name: form.name, fatherName: form.fatherName, cnic: form.cnic, mobile: form.mobile,
      gender: form.gender, age: form.age, address: form.address,
      designation: form.designation, department: form.department, salary: form.salary,
      joinDate: form.joinDate, status: 'Active',
      education: form.education, experience: form.experience, documents: form.documents,
      equipment: form.equipment, bankAccount: form.bankAccount, emergencyContact: form.emergencyContact,
    };
    if (editMode) {
      updateEmployee(editId, { ...empData, status: (employees.find(e => e.id === editId)?.status || 'Active') as Employee['status'] });
      showToast('Employee updated successfully', 'success');
    } else {
      addEmployee(empData);
      showToast('Joining Letter Generated!', 'success');
      setJoiningLetter(empData);
    }
    setShowModal(false);
    loadData();
  };

  const handleTerminate = (emp: Employee) => {
    if (confirm(`Are you sure you want to terminate ${emp.name}?`)) {
      updateEmployee(emp.id, { status: 'Terminated' });
      showToast(`${emp.name} has been terminated`, 'success');
      loadData();
    }
  };

  const handleActivate = (emp: Employee) => {
    updateEmployee(emp.id, { status: 'Active' });
    showToast(`${emp.name} has been activated`, 'success');
    loadData();
  };

  const handleViewEmployee = (emp: Employee) => {
    setViewEmployee(emp);
    // Load attendance for this employee (last 30 days)
    const allAtt = getAttendanceRecords().filter(a => a.employeeId === emp.id);
    allAtt.sort((a, b) => b.date.localeCompare(a.date));
    setEmpAttendance(allAtt.slice(0, 30));
  };

  // Education/Experience helpers
  const addEducation = () => setForm(p => ({ ...p, education: [...p.education, { degree: '', institution: '', year: '', grade: '' }] }));
  const removeEducation = (i: number) => setForm(p => ({ ...p, education: p.education.filter((_, idx) => idx !== i) }));
  const updateEducation = (i: number, field: keyof EducationRecord, value: string) => {
    setForm(p => ({ ...p, education: p.education.map((e, idx) => idx === i ? { ...e, [field]: value } : e) }));
  };

  const addExperience = () => setForm(p => ({ ...p, experience: [...p.experience, { organization: '', position: '', startDate: '', endDate: '', duration: '' }] }));
  const removeExperience = (i: number) => setForm(p => ({ ...p, experience: p.experience.filter((_, idx) => idx !== i) }));
  const updateExperience = (i: number, field: keyof ExperienceRecord, value: string) => {
    setForm(p => ({ ...p, experience: p.experience.map((e, idx) => idx === i ? { ...e, [field]: value } : e) }));
  };

  // Document helpers
  const addDocument = () => setForm(p => ({ ...p, documents: [...p.documents, { id: genId(), name: '', type: 'Other' as DocumentRecord['type'], fileName: '', uploadDate: todayStr() }] }));
  const removeDocument = (i: number) => setForm(p => ({ ...p, documents: p.documents.filter((_, idx) => idx !== i) }));
  const updateDocument = (i: number, field: keyof DocumentRecord, value: string) => {
    setForm(p => ({ ...p, documents: p.documents.map((d, idx) => idx === i ? { ...d, [field]: value } : d) }));
  };

  // Equipment helpers
  const addEquipment = () => setForm(p => ({ ...p, equipment: [...p.equipment, { id: genId(), itemName: '', category: 'Other' as EquipmentRecord['category'], serialNumber: '', issuedDate: todayStr(), returnDate: '', condition: 'New' as EquipmentRecord['condition'], status: 'Issued' as EquipmentRecord['status'], notes: '' }] }));
  const removeEquipment = (i: number) => setForm(p => ({ ...p, equipment: p.equipment.filter((_, idx) => idx !== i) }));
  const updateEquipment = (i: number, field: keyof EquipmentRecord, value: string) => {
    setForm(p => ({ ...p, equipment: p.equipment.map((e, idx) => idx === i ? { ...e, [field]: value } : e) }));
  };

  const handlePrintJoiningLetter = () => {
    const printContent = document.getElementById('joining-letter-content');
    if (!printContent) return;
    const html = `<!DOCTYPE html><html><head><title>Joining Letter - ${joiningLetter!.name}</title>
    <style>
      body { font-family: 'Times New Roman', serif; padding: 40px; color: #1a1a1a; }
      .header { text-align: center; border-bottom: 3px double #1a1a1a; padding-bottom: 15px; margin-bottom: 20px; }
      .hospital-name { font-size: 24px; font-weight: bold; color: #1a1a1a; }
      .hospital-info { font-size: 12px; color: #555; margin-top: 5px; }
      .letter-title { text-align: center; font-size: 20px; font-weight: bold; margin: 20px 0; text-decoration: underline; }
      .ref { font-size: 12px; color: #555; }
      .body { font-size: 14px; line-height: 1.8; }
      .details-table { width: 100%; margin: 15px 0; }
      .details-table td { padding: 4px 0; font-size: 13px; }
      .terms { margin: 15px 0; }
      .terms ol { margin-left: 20px; }
      .terms li { margin-bottom: 5px; font-size: 13px; }
      .signature { margin-top: 40px; text-align: right; }
      .signature-line { border-top: 1px solid #1a1a1a; width: 250px; margin-left: auto; padding-top: 5px; font-size: 13px; }
      hr.double { border: none; border-top: 3px double #1a1a1a; margin: 15px 0; }
    </style></head><body>
    ${printContent.innerHTML}
    </body></html>`;
    triggerPrint(html);
  };

  return (
    <div className="space-y-6">
      {toast && <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>{toast.msg}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Employee Management</h2>
          <p className="text-sm text-slate-500">{displayed.length} employees found</p>
        </div>
        <button onClick={handleAdd} className="btn btn-primary">+ Add Employee</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input className="form-input w-64" placeholder="Search by name, code, department..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-input w-44" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="form-input w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Terminated">Terminated</option>
        </select>
        {(search || filterDept || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterDept(''); setFilterStatus(''); }} className="btn btn-outline btn-sm">Clear Filters</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="data-table">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th>#</th><th>Employee Code</th><th>Name</th><th>Designation</th><th>Department</th><th>Mobile</th><th>Salary</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && <tr><td colSpan={9} className="text-center text-slate-400 py-8">No employees found</td></tr>}
              {displayed.map((emp, i) => (
                <tr key={emp.id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td><span className="font-mono text-sm font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded">{emp.employeeCode}</span></td>
                  <td className="font-medium">{emp.name}</td>
                  <td>{emp.designation}</td>
                  <td><span className="badge badge-blue">{emp.department}</span></td>
                  <td className="font-mono text-sm">{emp.mobile}</td>
                  <td className="font-semibold">Rs. {emp.salary.toLocaleString()}</td>
                  <td><span className={`badge ${emp.status === 'Active' ? 'badge-green' : emp.status === 'Inactive' ? 'badge-amber' : 'badge-red'}`}>{emp.status}</span></td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => handleViewEmployee(emp)} className="btn btn-outline btn-sm">View</button>
                      <button onClick={() => handleEdit(emp)} className="btn btn-primary btn-sm">Edit</button>
                      {emp.status === 'Active' ? (
                        <button onClick={() => handleTerminate(emp)} className="btn btn-danger btn-sm">Terminate</button>
                      ) : (
                        <button onClick={() => handleActivate(emp)} className="btn btn-success btn-sm">Activate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal - Multi-Step (5 steps now) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{editMode ? 'Edit Employee' : 'Add New Employee'}</h3>
                <p className="text-sm text-slate-400">Employee Code: <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{empCode}</span></p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-1 mb-6">
              {STEPS.map((s, i) => (
                <button key={s} onClick={() => i < step ? setStep(i) : null} className="flex-1">
                  <div className={`flex items-center gap-1 p-2 rounded-lg text-xs font-medium transition-colors ${i === step ? 'bg-blue-100 text-blue-700 border border-blue-300' : i < step ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-pointer hover:bg-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-blue-500 text-white' : 'bg-slate-300 text-white'}`}>{i < step ? '\u2713' : i + 1}</span>
                    <span className="hidden sm:inline">{s}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Step 1: Personal Information */}
            {step === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Enter full name" /></div>
                <div><label className="form-label">Father Name *</label><input className="form-input" value={form.fatherName} onChange={e => updateField('fatherName', e.target.value)} placeholder="Enter father name" /></div>
                <div><label className="form-label">CNIC *</label><input className="form-input" value={form.cnic} onChange={e => updateField('cnic', e.target.value)} placeholder="35201-1234567-1" /></div>
                <div><label className="form-label">Mobile *</label><input className="form-input" value={form.mobile} onChange={e => updateField('mobile', e.target.value)} placeholder="0300-1234567" /></div>
                <div><label className="form-label">Gender</label><select className="form-input" value={form.gender} onChange={e => updateField('gender', e.target.value)}><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
                <div><label className="form-label">Age</label><input className="form-input" value={form.age} onChange={e => updateField('age', e.target.value)} placeholder="30" /></div>
                <div className="sm:col-span-2"><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e => updateField('address', e.target.value)} placeholder="Full address" /></div>
                <div><label className="form-label">Designation *</label><input className="form-input" value={form.designation} onChange={e => updateField('designation', e.target.value)} placeholder="e.g. Staff Nurse" /></div>
                <div><label className="form-label">Department *</label><select className="form-input" value={form.department} onChange={e => updateField('department', e.target.value)}><option value="">Select Department</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label className="form-label">Monthly Salary (Rs.)</label><input type="number" className="form-input" value={form.salary || ''} onChange={e => updateField('salary', Number(e.target.value))} placeholder="0" /></div>
                <div><label className="form-label">Join Date</label><input type="date" className="form-input" value={form.joinDate} onChange={e => updateField('joinDate', e.target.value)} /></div>
                <div><label className="form-label">Bank Account (IBAN)</label><input className="form-input" value={form.bankAccount} onChange={e => updateField('bankAccount', e.target.value)} placeholder="IBAN-xxxx" /></div>
                <div><label className="form-label">Emergency Contact</label><input className="form-input" value={form.emergencyContact} onChange={e => updateField('emergencyContact', e.target.value)} placeholder="0300-xxxxxxx" /></div>
              </div>
            )}

            {/* Step 2: Education & Experience */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-700">Education</h4>
                    <button onClick={addEducation} className="btn btn-outline btn-sm">+ Add Education</button>
                  </div>
                  {form.education.length === 0 && <p className="text-sm text-slate-400 text-center py-2">No education records added</p>}
                  {form.education.map((edu, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-3 mb-2 relative">
                      <button onClick={() => removeEducation(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs font-bold">X</button>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="form-label text-xs">Degree</label><input className="form-input" value={edu.degree} onChange={e => updateEducation(i, 'degree', e.target.value)} placeholder="e.g. MBBS" /></div>
                        <div><label className="form-label text-xs">Institution</label><input className="form-input" value={edu.institution} onChange={e => updateEducation(i, 'institution', e.target.value)} placeholder="University name" /></div>
                        <div><label className="form-label text-xs">Year</label><input className="form-input" value={edu.year} onChange={e => updateEducation(i, 'year', e.target.value)} placeholder="2020" /></div>
                        <div><label className="form-label text-xs">Grade</label><input className="form-input" value={edu.grade} onChange={e => updateEducation(i, 'grade', e.target.value)} placeholder="First Class" /></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-700">Work Experience</h4>
                    <button onClick={addExperience} className="btn btn-outline btn-sm">+ Add Experience</button>
                  </div>
                  {form.experience.length === 0 && <p className="text-sm text-slate-400 text-center py-2">No experience records added</p>}
                  {form.experience.map((exp, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-3 mb-2 relative">
                      <button onClick={() => removeExperience(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs font-bold">X</button>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="form-label text-xs">Organization</label><input className="form-input" value={exp.organization} onChange={e => updateExperience(i, 'organization', e.target.value)} placeholder="Hospital name" /></div>
                        <div><label className="form-label text-xs">Position</label><input className="form-input" value={exp.position} onChange={e => updateExperience(i, 'position', e.target.value)} placeholder="Job title" /></div>
                        <div><label className="form-label text-xs">Start Date</label><input type="date" className="form-input" value={exp.startDate} onChange={e => updateExperience(i, 'startDate', e.target.value)} /></div>
                        <div><label className="form-label text-xs">End Date</label><input type="date" className="form-input" value={exp.endDate} onChange={e => updateExperience(i, 'endDate', e.target.value)} /></div>
                        <div className="col-span-2"><label className="form-label text-xs">Duration</label><input className="form-input" value={exp.duration} onChange={e => updateExperience(i, 'duration', e.target.value)} placeholder="e.g. 3 years" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Documents */}
            {step === 2 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-700">Documents</h4>
                  <button onClick={addDocument} className="btn btn-outline btn-sm">+ Add Document</button>
                </div>
                {form.documents.length === 0 && <p className="text-sm text-slate-400 text-center py-2">No documents added</p>}
                {form.documents.map((doc, i) => (
                  <div key={doc.id} className="bg-slate-50 rounded-lg p-3 mb-2 relative">
                    <button onClick={() => removeDocument(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs font-bold">X</button>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="form-label text-xs">Document Name</label><input className="form-input" value={doc.name} onChange={e => updateDocument(i, 'name', e.target.value)} placeholder="e.g. CNIC Copy" /></div>
                      <div><label className="form-label text-xs">Type</label><select className="form-input" value={doc.type} onChange={e => updateDocument(i, 'type', e.target.value)}>{DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                      <div><label className="form-label text-xs">File Name</label><input className="form-input" value={doc.fileName} onChange={e => updateDocument(i, 'fileName', e.target.value)} placeholder="filename.pdf" /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 4: Equipment Issued */}
            {step === 3 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-slate-700">Equipment / Items Issued</h4>
                    <p className="text-xs text-slate-400">Track items given to this employee (laptop, uniform, ID card, etc.)</p>
                  </div>
                  <button onClick={addEquipment} className="btn btn-outline btn-sm">+ Add Equipment</button>
                </div>
                {form.equipment.length === 0 && (
                  <div className="text-center py-6 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <p className="text-sm text-slate-400">No equipment issued yet</p>
                    <p className="text-xs text-slate-300">Click &quot;+ Add Equipment&quot; to add items</p>
                  </div>
                )}
                {form.equipment.map((eq, i) => (
                  <div key={eq.id} className="bg-slate-50 rounded-lg p-3 mb-2 relative">
                    <button onClick={() => removeEquipment(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-xs font-bold">X</button>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div><label className="form-label text-xs">Item Name *</label><input className="form-input" value={eq.itemName} onChange={e => updateEquipment(i, 'itemName', e.target.value)} placeholder="e.g. Dell Laptop" /></div>
                      <div><label className="form-label text-xs">Category</label><select className="form-input" value={eq.category} onChange={e => updateEquipment(i, 'category', e.target.value)}>{EQUIP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                      <div><label className="form-label text-xs">Serial Number</label><input className="form-input" value={eq.serialNumber} onChange={e => updateEquipment(i, 'serialNumber', e.target.value)} placeholder="SN-12345" /></div>
                      <div><label className="form-label text-xs">Issued Date</label><input type="date" className="form-input" value={eq.issuedDate} onChange={e => updateEquipment(i, 'issuedDate', e.target.value)} /></div>
                      <div><label className="form-label text-xs">Condition</label><select className="form-input" value={eq.condition} onChange={e => updateEquipment(i, 'condition', e.target.value)}>{EQUIP_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                      <div><label className="form-label text-xs">Status</label><select className="form-input" value={eq.status} onChange={e => updateEquipment(i, 'status', e.target.value)}>{EQUIP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                      <div className="col-span-2 sm:col-span-3"><label className="form-label text-xs">Notes</label><input className="form-input" value={eq.notes} onChange={e => updateEquipment(i, 'notes', e.target.value)} placeholder="Additional notes about this item" /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 5: Review */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">{form.name.charAt(0)}</div>
                    <div>
                      <h4 className="font-semibold text-blue-700">{form.name}</h4>
                      <p className="text-xs text-blue-500">Employee Code: <span className="font-mono font-bold">{empCode}</span> | {form.designation} - {form.department}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-400">Father:</span> {form.fatherName}</div>
                    <div><span className="text-slate-400">CNIC:</span> <span className="font-mono">{form.cnic}</span></div>
                    <div><span className="text-slate-400">Mobile:</span> {form.mobile}</div>
                    <div><span className="text-slate-400">Gender:</span> {form.gender} / Age: {form.age}</div>
                    <div className="col-span-2"><span className="text-slate-400">Address:</span> {form.address || '-'}</div>
                    <div><span className="text-slate-400">Salary:</span> <span className="font-bold">Rs. {(form.salary || 0).toLocaleString()}</span></div>
                    <div><span className="text-slate-400">Join Date:</span> {form.joinDate}</div>
                    <div><span className="text-slate-400">Bank Account:</span> {form.bankAccount || '-'}</div>
                    <div><span className="text-slate-400">Emergency:</span> {form.emergencyContact || '-'}</div>
                  </div>
                </div>
                {form.education.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <h4 className="font-semibold text-emerald-700 mb-1 text-sm">Education ({form.education.length})</h4>
                    {form.education.map((e, i) => <p key={i} className="text-xs">{e.degree} - {e.institution} ({e.year}) - {e.grade}</p>)}
                  </div>
                )}
                {form.experience.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <h4 className="font-semibold text-amber-700 mb-1 text-sm">Experience ({form.experience.length})</h4>
                    {form.experience.map((e, i) => <p key={i} className="text-xs">{e.position} at {e.organization} ({e.startDate} to {e.endDate}) - {e.duration}</p>)}
                  </div>
                )}
                {form.documents.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <h4 className="font-semibold text-purple-700 mb-1 text-sm">Documents ({form.documents.length})</h4>
                    <div className="flex gap-1 flex-wrap">{form.documents.map((d, i) => <span key={i} className="badge badge-purple text-xs">{d.name || d.type} ({d.type})</span>)}</div>
                  </div>
                )}
                {form.equipment.length > 0 && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                    <h4 className="font-semibold text-teal-700 mb-1 text-sm">Equipment Issued ({form.equipment.length})</h4>
                    {form.equipment.map((eq, i) => (
                      <p key={i} className="text-xs">
                        <span className="font-medium">{eq.itemName}</span> ({eq.category}) - SN: {eq.serialNumber || 'N/A'} - {eq.condition} - <span className={`font-semibold ${eq.status === 'Issued' ? 'text-emerald-600' : eq.status === 'Returned' ? 'text-blue-600' : 'text-red-600'}`}>{eq.status}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-6">
              {step > 0 && <button onClick={() => setStep(step - 1)} className="btn btn-outline">Previous</button>}
              <div className="flex-1" />
              {step < 4 && <button onClick={() => setStep(step + 1)} className="btn btn-primary">Next</button>}
              {step === 4 && (
                <>
                  <button onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                  <button onClick={handleSave} className="btn btn-success">{editMode ? 'Update Employee' : 'Submit Employee'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal - Full Employee Profile */}
      {viewEmployee && (
        <div className="modal-overlay" onClick={() => setViewEmployee(null)}>
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Employee Profile</h3>
              <button onClick={() => setViewEmployee(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex items-center gap-4 mb-5 bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl p-4 border border-blue-100">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">{viewEmployee.name.split(' ').slice(-1)[0].charAt(0)}</div>
              <div className="flex-1">
                <h4 className="font-bold text-lg text-slate-800">{viewEmployee.name}</h4>
                <p className="text-sm text-slate-500">{viewEmployee.designation} - {viewEmployee.department}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">{viewEmployee.employeeCode}</span>
                  <span className={`badge ${viewEmployee.status === 'Active' ? 'badge-green' : viewEmployee.status === 'Inactive' ? 'badge-amber' : 'badge-red'}`}>{viewEmployee.status}</span>
                  <span className="text-xs text-slate-400">Joined: {viewEmployee.joinDate}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Monthly Salary</p>
                <p className="text-xl font-bold text-slate-800">Rs. {viewEmployee.salary.toLocaleString()}</p>
              </div>
            </div>

            {/* Personal Details */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Father Name</p><p className="font-medium">{viewEmployee.fatherName || '-'}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">CNIC</p><p className="font-mono">{viewEmployee.cnic}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Mobile</p><p className="font-mono">{viewEmployee.mobile}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Gender / Age</p><p>{viewEmployee.gender || '-'} / {viewEmployee.age || '-'}</p></div>
              <div className="bg-slate-50 rounded-lg p-3 col-span-2"><p className="text-xs text-slate-400">Address</p><p>{viewEmployee.address || '-'}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Bank Account</p><p className="font-mono text-sm">{viewEmployee.bankAccount || '-'}</p></div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Emergency Contact</p><p className="font-mono">{viewEmployee.emergencyContact || '-'}</p></div>
            </div>

            {/* Equipment */}
            {viewEmployee.equipment && viewEmployee.equipment.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  Equipment / Items Issued ({viewEmployee.equipment.length})
                </h4>
                <div className="space-y-1">
                  {viewEmployee.equipment.map((eq, i) => (
                    <div key={eq.id || i} className={`flex items-center justify-between p-2 rounded-lg text-sm ${eq.status === 'Issued' ? 'bg-emerald-50 border border-emerald-200' : eq.status === 'Returned' ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{eq.itemName}</span>
                        <span className="badge badge-slate text-xs">{eq.category}</span>
                        {eq.serialNumber && <span className="text-xs text-slate-400">SN: {eq.serialNumber}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Issued: {eq.issuedDate}</span>
                        <span className={`badge text-xs ${eq.status === 'Issued' ? 'badge-green' : eq.status === 'Returned' ? 'badge-blue' : 'badge-red'}`}>{eq.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attendance History */}
            <div className="mb-4">
              <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Attendance History (Recent)
              </h4>
              {empAttendance.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-3 bg-slate-50 rounded-lg">No attendance records found</p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="data-table text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr>
                        <th>Date</th><th>Check In</th><th>Check Out</th><th>Status</th><th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empAttendance.map((a) => (
                        <tr key={a.id}>
                          <td className="font-mono">{a.date}</td>
                          <td className="font-mono">{a.checkIn || '-'}</td>
                          <td className="font-mono">{a.checkOut || '-'}</td>
                          <td>
                            <span className={`badge ${a.status === 'Present' ? 'badge-green' : a.status === 'Absent' ? 'badge-red' : a.status === 'Half Day' ? 'badge-amber' : a.status === 'Leave' ? 'badge-blue' : 'badge-purple'}`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="text-slate-400">{a.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Education */}
            {viewEmployee.education && viewEmployee.education.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-slate-700 mb-2">Education</h4>
                {viewEmployee.education.map((edu, i) => (
                  <div key={i} className="bg-emerald-50 rounded-lg p-2 mb-1 text-sm"><span className="font-medium">{edu.degree}</span> - {edu.institution} ({edu.year}) {edu.grade && `- ${edu.grade}`}</div>
                ))}
              </div>
            )}

            {/* Experience */}
            {viewEmployee.experience && viewEmployee.experience.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-slate-700 mb-2">Work Experience</h4>
                {viewEmployee.experience.map((exp, i) => (
                  <div key={i} className="bg-amber-50 rounded-lg p-2 mb-1 text-sm"><span className="font-medium">{exp.position}</span> at {exp.organization} ({exp.startDate} to {exp.endDate}) - {exp.duration}</div>
                ))}
              </div>
            )}

            {/* Documents */}
            {viewEmployee.documents && viewEmployee.documents.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-slate-700 mb-2">Documents</h4>
                <div className="flex gap-2 flex-wrap">{viewEmployee.documents.map((doc, i) => <span key={i} className="badge badge-purple">{doc.name} ({doc.type})</span>)}</div>
              </div>
            )}

            <button onClick={() => setViewEmployee(null)} className="btn btn-outline w-full mt-4">Close</button>
          </div>
        </div>
      )}

      {/* Joining Letter Modal */}
      {joiningLetter && (() => {
        const hospital = getHospital();
        const refNo = `${hospital.name.substring(0, 4).toUpperCase()}/HR/${joiningLetter.employeeCode}/${new Date(joiningLetter.joinDate).getFullYear()}`;
        return (
          <div className="modal-overlay" style={{ zIndex: 60 }} onClick={() => setJoiningLetter(null)}>
            <div className="modal-content max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Modal Header with Print & Close */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Joining Letter</h3>
                    <p className="text-sm text-slate-400">Generated for {joiningLetter.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrintJoiningLetter} className="btn btn-primary btn-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print
                  </button>
                  <button onClick={() => setJoiningLetter(null)} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* Letter Content */}
              <div
                id="joining-letter-content"
                className="bg-white border border-slate-200 rounded-lg p-8"
                style={{ fontFamily: "'Times New Roman', serif" }}
              >
                {/* Hospital Header */}
                <div className="header" style={{ textAlign: 'center', borderBottom: '3px double #1a1a1a', paddingBottom: 15, marginBottom: 20 }}>
                  <div className="hospital-name" style={{ fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' }}>{hospital.name}</div>
                  <div className="hospital-info" style={{ fontSize: 12, color: '#555', marginTop: 5 }}>{hospital.address}</div>
                  <div className="hospital-info" style={{ fontSize: 12, color: '#555' }}>Phone: {hospital.phone} | Email: {hospital.email}</div>
                  <div className="hospital-info" style={{ fontSize: 12, color: '#555' }}>License: {hospital.licenseNo}</div>
                </div>

                <hr className="double" style={{ border: 'none', borderTop: '3px double #1a1a1a', margin: '15px 0' }} />

                {/* Letter Title */}
                <div className="letter-title" style={{ textAlign: 'center', fontSize: 20, fontWeight: 'bold', margin: '20px 0', textDecoration: 'underline' }}>
                  JOINING LETTER
                </div>

                {/* Ref & Date */}
                <div className="ref" style={{ fontSize: 12, color: '#555' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>Ref:</strong> {refNo}</span>
                    <span><strong>Date:</strong> {joiningLetter.joinDate}</span>
                  </div>
                </div>

                {/* Salutation */}
                <div className="body" style={{ fontSize: 14, lineHeight: 1.8, marginTop: 20 }}>
                  <p>Dear <strong>{joiningLetter.name}</strong>,</p>

                  <p style={{ marginTop: 15 }}>
                    With reference to your application and subsequent interview, we are pleased to offer you the position of <strong>{joiningLetter.designation}</strong> in the <strong>{joiningLetter.department}</strong> department of {hospital.name}.
                  </p>

                  <p style={{ marginTop: 15 }}>Your employment details are as follows:</p>

                  {/* Details Table */}
                  <table className="details-table" style={{ width: '100%', margin: '15px 0', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr><td style={{ padding: '4px 0', fontSize: 13 }}><strong>Employee Code:</strong> {joiningLetter.employeeCode}</td></tr>
                      <tr><td style={{ padding: '4px 0', fontSize: 13 }}><strong>Designation:</strong> {joiningLetter.designation}</td></tr>
                      <tr><td style={{ padding: '4px 0', fontSize: 13 }}><strong>Department:</strong> {joiningLetter.department}</td></tr>
                      <tr><td style={{ padding: '4px 0', fontSize: 13 }}><strong>Date of Joining:</strong> {joiningLetter.joinDate}</td></tr>
                      <tr><td style={{ padding: '4px 0', fontSize: 13 }}><strong>Monthly Salary:</strong> Rs. {joiningLetter.salary.toLocaleString()} (subject to applicable deductions)</td></tr>
                    </tbody>
                  </table>

                  {/* Terms */}
                  <p>This appointment is subject to the following terms and conditions:</p>
                  <div className="terms" style={{ margin: '15px 0' }}>
                    <ol style={{ marginLeft: 20 }}>
                      <li style={{ marginBottom: 5, fontSize: 13 }}>You will serve a probation period of three (3) months from the date of joining.</li>
                      <li style={{ marginBottom: 5, fontSize: 13 }}>Your performance will be evaluated at the end of the probation period.</li>
                      <li style={{ marginBottom: 5, fontSize: 13 }}>You will abide by the rules, regulations, and policies of the hospital.</li>
                      <li style={{ marginBottom: 5, fontSize: 13 }}>Your appointment can be terminated by either party with one (1) month notice.</li>
                      <li style={{ marginBottom: 5, fontSize: 13 }}>You will maintain strict confidentiality of patient and hospital information.</li>
                    </ol>
                  </div>

                  <p>
                    We welcome you to the <strong>{hospital.name}</strong> family and look forward to your valuable contribution to our healthcare services.
                  </p>

                  <p style={{ marginTop: 15 }}>
                    Please confirm your acceptance by signing and returning a copy of this letter.
                  </p>

                  <p style={{ marginTop: 20 }}>Best regards,</p>

                  {/* Signature Area */}
                  <div className="signature" style={{ marginTop: 40, textAlign: 'right' }}>
                    <div className="signature-line" style={{ borderTop: '1px solid #1a1a1a', width: 250, marginLeft: 'auto', paddingTop: 5, fontSize: 13 }}>
                      <strong>Hospital Administrator</strong><br />
                      {hospital.name}
                    </div>
                  </div>

                  {/* Employee Acceptance */}
                  <div style={{ marginTop: 60, borderTop: '1px dashed #ccc', paddingTop: 20 }}>
                    <p style={{ fontSize: 12, color: '#555', marginBottom: 30 }}>Employee Acceptance:</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ borderBottom: '1px solid #1a1a1a', width: 200, marginBottom: 5, height: 20 }}></div>
                        <p style={{ fontSize: 12, color: '#555' }}>Employee Signature</p>
                      </div>
                      <div>
                        <div style={{ borderBottom: '1px solid #1a1a1a', width: 200, marginBottom: 5, height: 20 }}></div>
                        <p style={{ fontSize: 12, color: '#555' }}>Date</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                <button onClick={handlePrintJoiningLetter} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Print Letter
                </button>
                <button onClick={() => setJoiningLetter(null)} className="btn btn-outline flex-1">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
