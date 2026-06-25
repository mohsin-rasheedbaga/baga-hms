/* ========== PERMISSIONS CONFIGURATION ========== */
/*
 * Comprehensive permission system for BAGA HMS.
 * Each permission maps to a specific menu item, page, or button within the app.
 * Used by both User Management (permission panel) and Dashboard Layout (sidebar filtering).
 *
 * Keys are split into two categories:
 *  - OLD KEYS: backward-compatible keys that already exist in the codebase
 *  - NEW KEYS: added for menu items that previously had no permission gating
 */

export interface PermissionGroup {
  title: string;
  icon: string; // emoji for visual grouping
  perms: string[];
}

export const ALL_PERMISSIONS: string[] = [
  // Reception Module
  'dashboard', 'register_patient', 'new_visit', 'search_patient', 'card_renewal', 'print_card',
  'view_doctors', 'manage_appointments', 'manage_admissions', 'view_patients',

  // Clinical / Doctor Module
  'view_admitted_patients', 'discharge_patient', 'write_clinical_notes',
  'order_lab', 'prescribe', 'order_xray', 'order_ultrasound', 'write_notes', 'discharge',

  // Laboratory Module
  'view_lab_dashboard', 'view_lab_orders', 'collect_samples', 'enter_results',
  'print_report', 'view_reports', 'view_completed_reports', 'lab_statistics',
  'lab_inventory', 'manage_test_catalog', 'lab_expenses', 'view_lab_reports',

  // X-Ray Module
  'view_xray_dashboard', 'view_xray_orders', 'enter_xray_report',

  // Ultrasound Module
  'view_ultrasound_dashboard', 'view_usg_orders', 'enter_usg_report',

  // Pharmacy Module
  'view_pharmacy_dashboard', 'view_prescriptions', 'dispense_medicine', 'return_medicine',
  'view_bills', 'collect_payment', 'daily_report', 'add_inventory', 'view_statement', 'view_profit',
  'pharmacy_sales_reports', 'pharmacy_expenses',
  'view_expired_medicine', 'view_low_stock', 'manage_pharmacy_return', 'print_pharmacy_sale_slip',

  // Accounts Module
  'view_accounts_dashboard', 'print_bill', 'manage_accounts_statement',

  // HR Module
  'view_hr_dashboard', 'manage_employees', 'manage_salaries', 'manage_attendance',

  // Admin / Statements
  'view_main_statement', 'print_statement',

  // System Administration
  'manage_users', 'manage_settings', 'manage_department_filter',
];

export const PERMISSION_LABELS: Record<string, string> = {
  // Reception
  dashboard: 'Dashboard',
  register_patient: 'Register New Patient',
  new_visit: 'Create New Visit',
  search_patient: 'Search Patient',
  card_renewal: 'Card Renewal',
  print_card: 'Print Patient Card',
  view_doctors: 'View Doctors Panel',
  manage_appointments: 'Manage Appointments',
  manage_admissions: 'Manage Admissions',
  view_patients: 'View Patient Records',

  // Clinical / Doctor
  view_admitted_patients: 'View Admitted Patients',
  discharge_patient: 'Discharge Patient',
  write_clinical_notes: 'Write Clinical Notes',
  order_lab: 'Order Lab Test',
  prescribe: 'Write Prescription',
  order_xray: 'Order X-Ray',
  order_ultrasound: 'Order Ultrasound',
  write_notes: 'Write Notes',
  discharge: 'Discharge',

  // Laboratory
  view_lab_dashboard: 'Lab Dashboard',
  view_lab_orders: 'View Test Orders',
  collect_samples: 'Sample Collection',
  enter_results: 'Enter Results',
  print_report: 'Print Report',
  view_reports: 'View Reports',
  view_completed_reports: 'View Completed Reports',
  lab_statistics: 'Lab Statistics',
  lab_inventory: 'Lab Inventory',
  manage_test_catalog: 'Manage Test Catalog',
  lab_expenses: 'Lab Expenses',
  view_lab_reports: 'View Lab Reports (Reception)',

  // X-Ray
  view_xray_dashboard: 'X-Ray Dashboard',
  view_xray_orders: 'View X-Ray Orders',
  enter_xray_report: 'Enter X-Ray Report',

  // Ultrasound
  view_ultrasound_dashboard: 'USG Dashboard',
  view_usg_orders: 'View USG Orders',
  enter_usg_report: 'Enter USG Report',

  // Pharmacy
  view_pharmacy_dashboard: 'Pharmacy Dashboard',
  view_prescriptions: 'View Prescriptions',
  dispense_medicine: 'Point of Sale (POS)',
  return_medicine: 'Return Medicine',
  view_bills: 'View Bills',
  collect_payment: 'Collect Payment',
  daily_report: 'Daily Report',
  add_inventory: 'Add Inventory',
  view_statement: 'View Statement',
  view_profit: 'View Profit',
  pharmacy_sales_reports: 'Sales Reports',
  pharmacy_expenses: 'Pharmacy Expenses',
  view_expired_medicine: 'View Expired Medicine',
  view_low_stock: 'View Low Stock',
  manage_pharmacy_return: 'Manage Returns',
  print_pharmacy_sale_slip: 'Print Sale Slip',

  // Accounts
  view_accounts_dashboard: 'Accounts Dashboard',
  print_bill: 'Print Bill',
  manage_accounts_statement: 'Manage Statements',

  // HR
  view_hr_dashboard: 'HR Dashboard',
  manage_employees: 'Manage Employees',
  manage_salaries: 'Manage Salaries',
  manage_attendance: 'Manage Attendance',

  // Admin
  view_main_statement: 'Main Statement',
  print_statement: 'Print / Download Statement',

  // System
  manage_users: 'User Management',
  manage_settings: 'Settings',
  manage_department_filter: 'Department Filter',
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'Reception',
    icon: '🏥',
    perms: [
      'register_patient', 'new_visit', 'search_patient', 'card_renewal', 'print_card',
      'manage_appointments', 'view_patients',
    ],
  },
  {
    title: 'Clinical / Doctor',
    icon: '👨‍⚕️',
    perms: [
      'view_doctors', 'view_admitted_patients', 'manage_admissions', 'discharge_patient',
      'prescribe', 'order_lab', 'order_xray', 'order_ultrasound',
      'write_notes', 'write_clinical_notes', 'discharge',
    ],
  },
  {
    title: 'Laboratory',
    icon: '🔬',
    perms: [
      'view_lab_dashboard', 'view_lab_orders', 'collect_samples', 'enter_results',
      'print_report', 'view_reports', 'view_completed_reports', 'lab_statistics',
      'lab_inventory', 'manage_test_catalog', 'lab_expenses', 'view_lab_reports',
    ],
  },
  {
    title: 'X-Ray',
    icon: '🩻',
    perms: ['view_xray_dashboard', 'view_xray_orders', 'enter_xray_report'],
  },
  {
    title: 'Ultrasound',
    icon: '🔊',
    perms: ['view_ultrasound_dashboard', 'view_usg_orders', 'enter_usg_report'],
  },
  {
    title: 'Pharmacy',
    icon: '💊',
    perms: [
      'view_pharmacy_dashboard', 'view_prescriptions', 'dispense_medicine', 'return_medicine',
      'view_bills', 'collect_payment', 'daily_report', 'add_inventory', 'view_statement',
      'view_profit', 'pharmacy_sales_reports', 'pharmacy_expenses',
      'view_expired_medicine', 'view_low_stock', 'manage_pharmacy_return', 'print_pharmacy_sale_slip',
    ],
  },
  {
    title: 'Accounts & Billing',
    icon: '💰',
    perms: ['view_accounts_dashboard', 'print_bill', 'manage_accounts_statement'],
  },
  {
    title: 'HR Department',
    icon: '👥',
    perms: ['view_hr_dashboard', 'manage_employees', 'manage_salaries', 'manage_attendance'],
  },
  {
    title: 'Admin & Statements',
    icon: '📊',
    perms: ['view_main_statement', 'print_statement', 'dashboard'],
  },
  {
    title: 'System Administration',
    icon: '⚙️',
    perms: ['manage_users', 'manage_settings', 'manage_department_filter'],
  },
];

// Get permissions relevant to a specific license type
export function getModulePermissions(licenseType: string): { groups: PermissionGroup[]; all: string[] } {
  if (licenseType === 'pharmacy') {
    const perms: string[] = [
      // Common
      'dashboard', 'manage_employees', 'manage_users', 'manage_settings',
      // Old pharmacy keys (backward compatible)
      'view_prescriptions', 'dispense_medicine', 'view_bills', 'collect_payment',
      'daily_report', 'return_medicine', 'view_profit', 'add_inventory', 'view_statement',
      // New pharmacy keys
      'view_pharmacy_dashboard', 'pharmacy_sales_reports', 'pharmacy_expenses',
      'view_expired_medicine', 'view_low_stock', 'manage_pharmacy_return', 'print_pharmacy_sale_slip',
    ];
    return {
      groups: PERMISSION_GROUPS.filter(g => g.perms.some(p => perms.includes(p))),
      all: perms,
    };
  }
  if (licenseType === 'lab') {
    const perms: string[] = [
      // Common
      'dashboard', 'manage_employees', 'manage_users', 'manage_settings',
      // Old lab keys (backward compatible)
      'view_reports', 'view_lab_orders', 'enter_results', 'print_report',
      // New lab keys
      'view_lab_dashboard', 'collect_samples', 'view_completed_reports', 'lab_statistics',
      'lab_inventory', 'manage_test_catalog', 'lab_expenses', 'view_lab_reports',
    ];
    return {
      groups: PERMISSION_GROUPS.filter(g => g.perms.some(p => perms.includes(p))),
      all: perms,
    };
  }
  if (licenseType === 'clinic') {
    const perms: string[] = [
      // Common
      'dashboard', 'manage_employees', 'manage_users', 'manage_settings',
      // Reception
      'register_patient', 'new_visit', 'search_patient', 'card_renewal', 'print_card',
      'view_doctors', 'manage_appointments', 'manage_admissions', 'view_patients',
      // Clinical
      'view_admitted_patients', 'discharge_patient', 'write_clinical_notes',
      'order_lab', 'prescribe', 'order_xray', 'order_ultrasound', 'write_notes', 'discharge',
      // Laboratory (old keys)
      'view_reports', 'view_lab_orders', 'enter_results', 'print_report',
      // Laboratory (new keys)
      'view_lab_dashboard', 'collect_samples', 'view_completed_reports', 'lab_statistics',
      'lab_inventory', 'manage_test_catalog', 'lab_expenses', 'view_lab_reports',
      // X-Ray
      'view_xray_dashboard', 'view_xray_orders', 'enter_xray_report',
      // Ultrasound
      'view_ultrasound_dashboard', 'view_usg_orders', 'enter_usg_report',
      // Pharmacy (old keys)
      'view_prescriptions', 'dispense_medicine', 'view_bills', 'collect_payment',
      'daily_report', 'return_medicine', 'view_profit', 'add_inventory', 'view_statement',
      // Pharmacy (new keys)
      'view_pharmacy_dashboard', 'pharmacy_sales_reports', 'pharmacy_expenses',
      'view_expired_medicine', 'view_low_stock', 'manage_pharmacy_return', 'print_pharmacy_sale_slip',
      // Accounts
      'view_accounts_dashboard', 'print_bill', 'manage_accounts_statement',
    ];
    return {
      groups: PERMISSION_GROUPS.filter(g => g.perms.some(p => perms.includes(p))),
      all: perms,
    };
  }
  // Hospital - show all
  return { groups: PERMISSION_GROUPS, all: ALL_PERMISSIONS };
}

// Map menu paths to permission keys (used by layout.tsx to filter sidebar)
export const MENU_PERMISSION_MAP: Record<string, string> = {
  // Super Admin menus
  '/dashboard': 'dashboard',
  '/reception': 'register_patient',
  '/doctors': 'view_doctors',
  '/appointment': 'manage_appointments',
  '/admission': 'manage_admissions',
  '/lab': 'view_lab_dashboard',
  '/xray': 'view_xray_dashboard',
  '/ultrasound': 'view_ultrasound_dashboard',
  '/pharmacy': 'dispense_medicine',
  '/accounts': 'view_accounts_dashboard',
  '/admin/statement': 'view_main_statement',
  '/users': 'manage_users',
  '/hr': 'view_hr_dashboard',
  '/hr/employees': 'manage_employees',
  '/hr/salaries': 'manage_salaries',
  '/hr/attendance': 'manage_attendance',
  '/settings': 'manage_settings',

  // Reception sub-menus
  '/patients': 'view_patients',
  '/reception/lab-reports': 'view_lab_reports',
  '/reception/statement': 'view_statement',

  // Doctor sub-menus
  '/doctor': 'view_doctors',
  '/doctor/admitted-patients': 'view_admitted_patients',
  '/doctor/admission': 'manage_admissions',
  '/doctor/discharge': 'discharge_patient',
  '/doctor/statement': 'view_statement',

  // Lab sub-menus
  '/lab/orders': 'view_lab_orders',
  '/lab/samples': 'collect_samples',
  '/lab/processing': 'enter_results',
  '/lab/reports': 'view_completed_reports',
  '/lab/statistics': 'lab_statistics',
  '/lab/inventory': 'lab_inventory',
  '/lab/settings': 'manage_test_catalog',
  '/lab/expenses': 'lab_expenses',
  '/lab/statement': 'view_statement',

  // Pharmacy sub-menus
  '/pharmacy/returns': 'return_medicine',
  '/pharmacy/prescriptions': 'view_prescriptions',
  '/pharmacy/inventory': 'add_inventory',
  '/pharmacy/reports': 'pharmacy_sales_reports',
  '/pharmacy/expenses': 'pharmacy_expenses',
  '/pharmacy/statement': 'view_statement',

  // Accounts sub-menus
  '/accounts/statement': 'manage_accounts_statement',
};

// Check if a user has a specific permission
export function hasPermission(permissions: string[], perm: string): boolean {
  if (!permissions) return false;
  if (permissions.includes('all')) return true;
  return permissions.includes(perm);
}