'use client';
import { useState, useEffect, useCallback } from 'react';
import { getUsers, addUser, updateUser, deleteUser, genId, getEmployees } from '@/lib/store';
import type { User, Employee } from '@/lib/types';
import { fetchLicenseInfo } from '@/lib/db-bridge';
import { ALL_PERMISSIONS, PERMISSION_LABELS, PERMISSION_GROUPS, getModulePermissions as getModulePermissionsFromConfig } from '@/lib/permissions';

const ROLES = [
  { value: 'reception', label: 'Reception', dept: 'Reception' },
  { value: 'doctor', label: 'Doctor', dept: 'Doctor' },
  { value: 'lab', label: 'Lab Technician', dept: 'Laboratory' },
  { value: 'lab_technologist', label: 'Lab Technologist', dept: 'Laboratory' },
  { value: 'pharmacy', label: 'Pharmacist', dept: 'Pharmacy' },
  { value: 'xray', label: 'Radiologist', dept: 'X-Ray' },
  { value: 'ultrasound', label: 'USG Technician', dept: 'Ultrasound' },
  { value: 'accounts', label: 'Accountant', dept: 'Accounts' },
];

const DEPT_ROLE_MAP: Record<string, string> = {
  reception: 'reception',
  frontdesk: 'reception',
  'front desk': 'reception',
  doctor: 'doctor',
  doctors: 'doctor',
  medical: 'doctor',
  'medical officer': 'doctor',
  physician: 'doctor',
  consultant: 'doctor',
  specialist: 'doctor',
  gynecology: 'doctor',
  gyne: 'doctor',
  surgery: 'doctor',
  surgeon: 'doctor',
  pediatric: 'doctor',
  pediatrician: 'doctor',
  medicine: 'doctor',
  emergency: 'doctor',
  orthopedic: 'doctor',
  ent: 'doctor',
  eye: 'doctor',
  dental: 'doctor',
  skin: 'doctor',
  pathology: 'doctor',
  anesthesia: 'doctor',
  laboratory: 'lab',
  lab: 'lab',
  'pathology lab': 'lab',
  'lab technician': 'lab',
  pharmacy: 'pharmacy',
  pharmacist: 'pharmacy',
  dispensary: 'pharmacy',
  'x-ray': 'xray',
  xray: 'xray',
  radiology: 'xray',
  radiologist: 'xray',
  ultrasound: 'ultrasound',
  usg: 'ultrasound',
  sonologist: 'ultrasound',
  'radiology & ultrasound': 'ultrasound',
  accounts: 'accounts',
  finance: 'accounts',
  accountant: 'accounts',
  billing: 'accounts',
  hr: 'reception',
  admin: 'reception',
  it: 'reception',
  security: 'reception',
  housekeeping: 'reception',
  nursing: 'doctor',
  nurse: 'doctor',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [licenseType, setLicenseType] = useState('hospital');

  useEffect(() => {
    fetchLicenseInfo().then(info => {
      if (info?.licenseType) setLicenseType(info.licenseType);
    }).catch(() => {});
  }, []);

  // License-aware default department based on license module
  const getDefaultDept = useCallback(() => {
    if (licenseType === 'pharmacy') return 'Pharmacy';
    if (licenseType === 'lab') return 'Laboratory';
    if (licenseType === 'clinic') return 'Reception';
    return 'Reception'; // hospital default
  }, [licenseType]);

  const getDefaultRole = useCallback(() => {
    if (licenseType === 'pharmacy') return 'pharmacy';
    if (licenseType === 'lab') return 'lab';
    if (licenseType === 'clinic') return 'reception';
    return 'reception'; // hospital default
  }, [licenseType]);

  const [addStep, setAddStep] = useState<1 | 2 | 3>(1);
  const [empCode, setEmpCode] = useState('');
  const [empLookupStatus, setEmpLookupStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [foundEmployee, setFoundEmployee] = useState<Employee | null>(null);
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('reception');
  const [selectedDept, setSelectedDept] = useState('Reception');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Auto-set role and department when license type loads or when opening add modal
  useEffect(() => {
    if (licenseType) {
      setSelectedRole(getDefaultRole());
      setSelectedDept(getDefaultDept());
    }
  }, [licenseType, getDefaultRole, getDefaultDept]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(() => {
    setUsers(getUsers());
    setEmployees(getEmployees());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Employee Lookup ----
  const lookupEmployee = useCallback(() => {
    const code = empCode.trim();
    if (!code) return;
    setEmpLookupStatus('searching');
    // Simulate brief lookup delay for UX
    setTimeout(() => {
      const match = employees.find(
        (e) => e.employeeCode.toLowerCase() === code.toLowerCase()
      );
      if (match) {
        setFoundEmployee(match);
        setEmpLookupStatus('found');
        // Auto-suggest role based on department
        const deptLower = match.department.toLowerCase();
        const suggestedRole = DEPT_ROLE_MAP[deptLower] || 'reception';
        const roleObj = ROLES.find((r) => r.value === suggestedRole);
        setSelectedRole(suggestedRole);
        setSelectedDept(roleObj?.dept || match.department);
      } else {
        setFoundEmployee(null);
        setEmpLookupStatus('not_found');
      }
    }, 300);
  }, [empCode, employees]);

  // Handle enter key in employee code input
  const handleEmpCodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      lookupEmployee();
    }
  };

  // ---- Module-Aware Permissions (uses shared permissions config) ----
  const getLocalModulePermissions = () => getModulePermissionsFromConfig(licenseType);

  // ---- Permission Toggles (Add Modal) ----
  const toggleAddPermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const selectAllPermissions = () => {
    setSelectedPermissions(getLocalModulePermissions().all);
  };

  const clearAllPermissions = () => {
    setSelectedPermissions([]);
  };

  const toggleAddPermissionGroup = (perms: string[]) => {
    const allSelected = perms.every((p) => selectedPermissions.includes(p));
    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((p) => !perms.includes(p)));
    } else {
      const newPerms = perms.filter((p) => !selectedPermissions.includes(p));
      setSelectedPermissions((prev) => [...prev, ...newPerms]);
    }
  };

  // ---- CRUD Handlers ----
  const resetAddForm = () => {
    setAddStep(1);
    setEmpCode('');
    setEmpLookupStatus('idle');
    setFoundEmployee(null);
    setLoginId('');
    setLoginPassword('');
    setSelectedRole('reception');
    setSelectedDept('Reception');
    setSelectedPermissions([]);
  };

  const handleAddSubmit = () => {
    if (!foundEmployee) {
      showToast('Please select an employee first', 'error');
      return;
    }
    if (!loginId.trim()) {
      showToast('Login ID is required', 'error');
      return;
    }
    if (!loginPassword.trim()) {
      showToast('Password is required', 'error');
      return;
    }
    if (users.find((u) => u.email === loginId.trim())) {
      showToast('Login ID already exists', 'error');
      return;
    }
    const newUser: User = {
      id: genId(),
      name: foundEmployee.name,
      email: loginId.trim(),
      password: loginPassword.trim(),
      role: selectedRole as User['role'],
      department: selectedDept,
      active: true,
      // CRITICAL: Only assign explicitly selected permissions.
      // Do NOT default to ['all'] — that gives the user access to everything.
      permissions: selectedPermissions,
    };
    addUser(newUser);
    loadData();
    setShowAdd(false);
    resetAddForm();
    showToast('User created successfully!', 'success');
  };

  const handleUpdate = () => {
    if (!editingUser) return;
    updateUser(editingUser.id, editingUser);
    setUsers(getUsers());
    setEditingUser(null);
    showToast('User updated!', 'success');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this user?')) return;
    deleteUser(id);
    setUsers(getUsers());
    showToast('User deleted', 'success');
  };

  const togglePermission = (perm: string) => {
    if (!editingUser) return;
    const perms = editingUser.permissions.includes('all')
      ? ALL_PERMISSIONS.filter((p) => p !== perm)
      : editingUser.permissions;
    setEditingUser({
      ...editingUser,
      permissions: perms.includes(perm)
        ? perms.filter((p) => p !== perm)
        : [...perms, perm],
    });
  };

  const selectRole = (role: string, dept: string) => {
    setForm({ ...form, role, department: dept });
  };

  const roleUsers = (role: string) => users.filter((u) => u.role === role);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'reception',
    department: '',
    active: true,
    permissions: [] as string[],
  });

  // ---- Render Helpers ----
  const canProceedStep1 = empLookupStatus === 'found' && foundEmployee !== null;
  const canProceedStep2 = loginId.trim() !== '' && loginPassword.trim() !== '';
  const step1Active = addStep === 1;
  const step2Active = addStep === 2;
  const step3Active = addStep === 3;

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
          <h2 className="text-xl font-bold text-slate-800">User Management</h2>
          <p className="text-sm text-slate-500">{users.length} total users</p>
        </div>
        <button
          onClick={() => {
            resetAddForm();
            loadData();
            setShowAdd(true);
          }}
          className="btn btn-primary"
        >
          + Add User
        </button>
      </div>

      {/* Users by Role */}
      {ROLES.map((r) => (
        <div key={r.value} className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">{r.label}</h3>
            <span className="badge badge-blue">{roleUsers(r.value).length}</span>
          </div>
          {roleUsers(r.value).length === 0 && (
            <p className="text-sm text-slate-400">No users</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {roleUsers(r.value).map((u) => (
              <div
                key={u.id}
                className={`border rounded-lg p-4 ${u.active ? 'border-slate-200' : 'border-red-200 bg-red-50 opacity-75'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{u.name}</span>
                  <span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>
                    Login ID:{' '}
                    <span className="font-mono font-medium text-slate-700">{u.email}</span>
                  </p>
                  <p>
                    Password:{' '}
                    <span className="font-mono font-medium text-slate-700">{u.password}</span>
                  </p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setEditingUser({ ...u })}
                    className="btn btn-outline btn-sm flex-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="btn btn-danger btn-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Super Admin */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Super Admin</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {users
            .filter((u) => u.role === 'super_admin')
            .map((u) => (
              <div key={u.id} className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge badge-blue">Super Admin</span>
                </div>
                <span className="font-semibold">{u.name}</span>
                <p className="text-xs text-slate-500 mt-1">
                  Login: <span className="font-mono">{u.email}</span>
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* ============================== */}
      {/* Add User Modal - 3 Step Wizard */}
      {/* ============================== */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '720px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">Add New User</h3>
              <button
                onClick={() => setShowAdd(false)}
                className="btn btn-outline btn-sm"
              >
                ✕ Close
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-1 mb-6">
              {/* Step 1 */}
              <div className="flex items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step1Active
                      ? 'bg-blue-600 text-white'
                      : addStep > 1
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {addStep > 1 ? '✓' : '1'}
                </div>
                <span className={`text-xs font-medium ${step1Active ? 'text-blue-600' : 'text-slate-400'}`}>
                  Employee
                </span>
              </div>
              {/* Connector */}
              <div className={`flex-1 h-0.5 mx-2 ${addStep > 1 ? 'bg-green-400' : 'bg-slate-200'}`} />
              {/* Step 2 */}
              <div className="flex items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step2Active
                      ? 'bg-blue-600 text-white'
                      : addStep > 2
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {addStep > 2 ? '✓' : '2'}
                </div>
                <span className={`text-xs font-medium ${step2Active ? 'text-blue-600' : 'text-slate-400'}`}>
                  Login
                </span>
              </div>
              {/* Connector */}
              <div className={`flex-1 h-0.5 mx-2 ${addStep > 2 ? 'bg-green-400' : 'bg-slate-200'}`} />
              {/* Step 3 */}
              <div className="flex items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step3Active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  3
                </div>
                <span className={`text-xs font-medium ${step3Active ? 'text-blue-600' : 'text-slate-400'}`}>
                  Role & Permissions
                </span>
              </div>
            </div>

            {/* ===== STEP 1: Employee Code Lookup ===== */}
            {addStep === 1 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-4">
                    Enter the employee code to look up their record from the HR department. The employee must be registered in the HR system first.
                  </p>
                  <label className="form-label">Employee Code *</label>
                  <div className="flex gap-2">
                    <input
                      className="form-input flex-1"
                      value={empCode}
                      onChange={(e) => {
                        setEmpCode(e.target.value);
                        setEmpLookupStatus('idle');
                        setFoundEmployee(null);
                      }}
                      onKeyDown={handleEmpCodeKeyDown}
                      placeholder="e.g. 0001"
                      autoFocus
                    />
                    <button
                      onClick={lookupEmployee}
                      disabled={empCode.trim() === '' || empLookupStatus === 'searching'}
                      className="btn btn-primary"
                    >
                      {empLookupStatus === 'searching' ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'Lookup'
                      )}
                    </button>
                  </div>
                </div>

                {/* Searching State */}
                {empLookupStatus === 'searching' && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-blue-600 font-medium">Searching employee records...</span>
                  </div>
                )}

                {/* Employee Found */}
                {empLookupStatus === 'found' && foundEmployee && (
                  <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-green-700">Employee Found</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div>
                        <span className="text-slate-500">Full Name:</span>
                        <p className="font-semibold text-slate-800">{foundEmployee.name}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Department:</span>
                        <p className="font-semibold text-slate-800">{foundEmployee.department}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Designation:</span>
                        <p className="font-semibold text-slate-800">{foundEmployee.designation}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">CNIC:</span>
                        <p className="font-semibold text-slate-800 font-mono">{foundEmployee.cnic}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Employee Code:</span>
                        <p className="font-semibold text-slate-800 font-mono">{foundEmployee.employeeCode}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Mobile:</span>
                        <p className="font-semibold text-slate-800">{foundEmployee.mobile}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Employee Not Found */}
                {empLookupStatus === 'not_found' && (
                  <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-red-700">Employee not found</p>
                        <p className="text-xs text-red-600 mt-0.5">
                          No employee with code &ldquo;{empCode}&rdquo; exists in HR records. Please add the employee in the HR Department first.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 1 Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setAddStep(2)}
                    disabled={!canProceedStep1}
                    className="btn btn-success btn-lg flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next: Login Credentials →
                  </button>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="btn btn-outline btn-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ===== STEP 2: Login Credentials ===== */}
            {addStep === 2 && (
              <div className="space-y-4">
                {/* Employee Summary */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Creating account for:</p>
                  <p className="font-semibold text-slate-800">{foundEmployee?.name}</p>
                  <p className="text-xs text-slate-500">
                    {foundEmployee?.designation} &middot; {foundEmployee?.department} &middot; Code: {foundEmployee?.employeeCode}
                  </p>
                </div>

                <div>
                  <label className="form-label">Login ID *</label>
                  <input
                    className="form-input"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="The ID they will use to log in (e.g. doctor1, reception)"
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 mt-1">This will be their username to sign in to the system.</p>
                </div>

                <div>
                  <label className="form-label">Password *</label>
                  <input
                    className="form-input"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    type="text"
                    placeholder="Set their initial password"
                  />
                  <p className="text-xs text-slate-400 mt-1">The user can change their password later from their profile.</p>
                </div>

                {/* Step 2 Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setAddStep(1)}
                    className="btn btn-outline btn-lg"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setAddStep(3)}
                    disabled={!canProceedStep2}
                    className="btn btn-success btn-lg flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next: Role & Permissions →
                  </button>
                </div>
              </div>
            )}

            {/* ===== STEP 3: Role & Permissions ===== */}
            {addStep === 3 && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Creating account for:</p>
                  <p className="font-semibold text-slate-800">{foundEmployee?.name}</p>
                  <p className="text-xs text-slate-500">
                    Login: <span className="font-mono font-medium text-slate-700">{loginId}</span>
                  </p>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="form-label">Role / Department *</label>
                  <select
                    className="form-input"
                    value={selectedRole}
                    onChange={(e) => {
                      const r = ROLES.find((x) => x.value === e.target.value);
                      setSelectedRole(e.target.value);
                      setSelectedDept(r?.dept || '');
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label} ({r.dept})
                      </option>
                    ))}
                  </select>
                  {foundEmployee && (
                    <p className="text-xs text-blue-600 mt-1">
                      Suggested based on employee department ({foundEmployee.department}):&nbsp;
                      <span className="font-semibold">
                        {ROLES.find((r) => r.value === selectedRole)?.label}
                      </span>
                    </p>
                  )}
                </div>

                {/* Permissions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="form-label mb-0">Permissions</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllPermissions}
                        className="btn btn-outline btn-sm text-xs"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearAllPermissions}
                        className="btn btn-outline btn-sm text-xs"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {getLocalModulePermissions().groups.map((group) => {
                      const allGroupSelected = group.perms.every((p) =>
                        selectedPermissions.includes(p)
                      );
                      const someGroupSelected =
                        group.perms.some((p) => selectedPermissions.includes(p)) &&
                        !allGroupSelected;

                      return (
                        <div
                          key={group.title}
                          className="border border-slate-200 rounded-lg overflow-hidden"
                        >
                          {/* Group Header */}
                          <button
                            type="button"
                            onClick={() => toggleAddPermissionGroup(group.perms)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium transition-colors ${
                              allGroupSelected
                                ? 'bg-green-50 text-green-700'
                                : someGroupSelected
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span>{group.title}</span>
                            <span className="text-xs">
                              {allGroupSelected
                                ? 'All Selected'
                                : someGroupSelected
                                ? `${group.perms.filter((p) => selectedPermissions.includes(p)).length}/${group.perms.length} Selected`
                                : 'None Selected'}
                            </span>
                          </button>
                          {/* Permission Items */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-2">
                            {group.perms.map((perm) => {
                              const isSelected = selectedPermissions.includes(perm);
                              return (
                                <label
                                  key={perm}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'border border-transparent text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleAddPermission(perm)}
                                    className="rounded"
                                  />
                                  {PERMISSION_LABELS[perm] || perm.replace(/_/g, ' ')}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Permission Count */}
                  <div className="mt-2 text-xs text-slate-400">
                    {selectedPermissions.length === 0
                      ? 'No permissions selected'
                      : `${selectedPermissions.length} of ${getLocalModulePermissions().all.length} permissions granted`}
                  </div>
                </div>

                {/* Step 3 Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setAddStep(2)}
                    className="btn btn-outline btn-lg"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleAddSubmit}
                    className="btn btn-success btn-lg flex-1"
                  >
                    ✓ Create User
                  </button>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="btn btn-outline btn-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== */}
      {/* Edit User Modal     */}
      {/* =================== */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Edit User - {editingUser.name}</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="btn btn-outline btn-sm"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Login ID</label>
                <input
                  className="form-input"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Password</label>
                <input
                  className="form-input"
                  value={editingUser.password}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="form-label mb-0">Active</label>
                <button
                  onClick={() => setEditingUser({ ...editingUser, active: !editingUser.active })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    editingUser.active ? 'bg-green-500' : 'bg-red-400'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      editingUser.active ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Permissions */}
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Permissions</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, permissions: [...getLocalModulePermissions().all] })}
                      className="btn btn-outline btn-sm text-xs"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, permissions: [] })}
                      className="btn btn-outline btn-sm text-xs"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {getLocalModulePermissions().groups.map((group) => {
                    const allGroupSelected = group.perms.every((p) =>
                      editingUser.permissions.includes(p)
                    );
                    const someGroupSelected =
                      group.perms.some((p) => editingUser.permissions.includes(p)) &&
                      !allGroupSelected;

                    return (
                      <div
                        key={group.title}
                        className="border border-slate-200 rounded-lg overflow-hidden"
                      >
                        <div
                          className={`px-3 py-1.5 text-xs font-medium border-b border-slate-100 ${
                            allGroupSelected
                              ? 'bg-green-50 text-green-700'
                              : someGroupSelected
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          {group.title}
                        </div>
                        <div className="grid grid-cols-2 gap-1 p-2">
                          {group.perms.map((perm) => (
                            <label
                              key={perm}
                              className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                editingUser.permissions.includes(perm)
                                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 text-slate-500'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={editingUser.permissions.includes(perm)}
                                onChange={() => togglePermission(perm)}
                                className="rounded"
                              />
                              {PERMISSION_LABELS[perm] || perm.replace(/_/g, ' ')}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleUpdate}
                  className="btn btn-primary btn-lg flex-1"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="btn btn-outline btn-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
