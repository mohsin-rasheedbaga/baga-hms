'use client';
import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getHospital, getMedicines, getExpiredMedicines, getLowStockMedicines, getEmployees, addEmployee, generateEmployeeCode, genId } from '@/lib/store';
import { getSession, clearSession, fetchLicenseInfo } from '@/lib/db-bridge';
import type { User, Employee } from '@/lib/types';

interface MenuItem {
  label: string;
  path: string;
  icon: string;
}

interface SubMenuParent {
  label: string;
  icon: string;
  children: MenuItem[];
}

type RoleMenu = (MenuItem | SubMenuParent)[];

function isSubMenu(item: MenuItem | SubMenuParent): item is SubMenuParent {
  return 'children' in item;
}

// Menu items per role
const roleMenus: Record<string, RoleMenu> = {
  super_admin: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { label: 'Reception', path: '/reception', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { label: 'Doctors', path: '/doctors', icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Appointment', path: '/appointment', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: 'Admission', path: '/admission', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Laboratory', path: '/lab', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { label: 'X-Ray', path: '/xray', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'Ultrasound', path: '/ultrasound', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Pharmacy', path: '/pharmacy', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { label: 'Accounts', path: '/accounts', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Main Statement', path: '/admin/statement', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'User Management', path: '/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    {
      label: 'HR Department',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      children: [
        { label: 'Dashboard', path: '/hr', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
        { label: 'Employees', path: '/hr/employees', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
        { label: 'Salaries', path: '/hr/salaries', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { label: 'Attendance', path: '/hr/attendance', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
      ],
    },
    { label: 'Settings', path: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  ],
  reception: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { label: 'Reception', path: '/reception', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { label: 'Appointment', path: '/appointment', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: 'Admission', path: '/admission', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Patients', path: '/patients', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Lab Reports', path: '/reception/lab-reports', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'My Statement', path: '/reception/statement', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ],
  doctor: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { label: 'My Patients', path: '/doctor', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { label: 'Admitted Patients', path: '/doctor/admitted-patients', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Patient Admission', path: '/doctor/admission', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'Patient Discharge', path: '/doctor/discharge', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'My Statement', path: '/doctor/statement', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ],
  lab: [
    { label: 'Dashboard', path: '/lab', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    {
      label: 'Laboratory',
      icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      children: [
        { label: 'Dashboard', path: '/lab', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
        { label: 'Test Orders', path: '/lab/orders', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
        { label: 'Sample Collection', path: '/lab/samples', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
        { label: 'Result Entry', path: '/lab/processing', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
        { label: 'Completed Reports', path: '/lab/reports', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        { label: 'Statistics', path: '/lab/statistics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
        { label: 'Inventory', path: '/lab/inventory', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
        { label: 'Test Catalog', path: '/lab/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
        { label: 'Expenses', path: '/lab/expenses', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
        { label: 'My Statement', path: '/lab/statement', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      ],
    },
  ],
  pharmacy: [
    { label: 'Dashboard', path: '/pharmacy', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { label: 'Point of Sale', path: '/pharmacy?tab=pos', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z' },
    { label: 'Return Medicine', path: '/pharmacy/returns', icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' },
    { label: 'Prescriptions', path: '/pharmacy/prescriptions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { label: 'Medicine Inventory', path: '/pharmacy/inventory', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { label: 'Sales Reports', path: '/pharmacy/reports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'Expenses', path: '/pharmacy/expenses', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { label: 'My Statement', path: '/pharmacy/statement', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Net Profit', path: '/pharmacy/statement?tab=profit', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  ],
  xray: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { label: 'X-Ray', path: '/xray', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ],
  ultrasound: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { label: 'Ultrasound', path: '/ultrasound', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ],
  accounts: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { label: 'Accounts', path: '/accounts', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ],
};

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  reception: 'Reception',
  doctor: 'Doctor',
  lab: 'Lab Technician',
  pharmacy: 'Pharmacist',
  xray: 'Radiologist',
  ultrasound: 'USG Technician',
  accounts: 'Accountant',
};

const roleColors: Record<string, string> = {
  super_admin: 'bg-blue-600',
  reception: 'bg-emerald-600',
  doctor: 'bg-purple-600',
  lab: 'bg-teal-600',
  pharmacy: 'bg-amber-600',
  xray: 'bg-rose-600',
  ultrasound: 'bg-indigo-600',
  accounts: 'bg-cyan-600',
};

function getPageTitle(pathname: string, menuItems: RoleMenu, searchStr: string): string {
  // Check admin sub-paths
  if (pathname.startsWith('/admin/')) {
    const subMap: Record<string, string> = {
      '/admin/statement': 'Main Statement',
    };
    return subMap[pathname] || 'Admin';
  }

  // Check HR sub-paths
  if (pathname.startsWith('/hr/')) {
    const subMap: Record<string, string> = {
      '/hr': 'HR Dashboard',
      '/hr/employees': 'Employees',
      '/hr/salaries': 'Salaries',
      '/hr/attendance': 'Attendance',
    };
    return subMap[pathname] || 'HR Department';
  }

  // Check doctor sub-paths
  if (pathname.startsWith('/doctor/')) {
    const subMap: Record<string, string> = {
      '/doctor': 'My Patients',
      '/doctor/admitted-patients': 'Admitted Patients',
      '/doctor/admission': 'Patient Admission',
      '/doctor/discharge': 'Patient Discharge',
      '/doctor/statement': 'My Statement',
    };
    return subMap[pathname] || 'Doctor';
  }

  // Check lab sub-paths first
  if (pathname.startsWith('/lab/')) {
    const subMap: Record<string, string> = {
      '/lab/orders': 'Test Orders',
      '/lab/samples': 'Sample Collection',
      '/lab/processing': 'Result Entry',
      '/lab/reports': 'Completed Reports',
      '/lab/statistics': 'Statistics',
      '/lab/inventory': 'Inventory',
      '/lab/settings': 'Test Catalog',
      '/lab/expenses': 'Expenses',
    };
    return subMap[pathname] || 'Laboratory';
  }
  
  // Check regular menu items - match with query params
  const paramsMatch = (itemPath: string): boolean => {
    if (!itemPath.includes('?')) return searchStr === '';
    const [_, queryStr] = itemPath.split('?');
    const expected = new URLSearchParams(queryStr);
    const current = new URLSearchParams(searchStr);
    for (const [key, val] of expected.entries()) {
      if (current.get(key) !== val) return false;
    }
    return true;
  };
  
  for (const item of menuItems) {
    if (isSubMenu(item)) {
      for (const child of item.children) {
        const itemBase = child.path.split('?')[0];
        if (pathname === itemBase && paramsMatch(child.path)) return child.label;
      }
    } else {
      const itemBase = item.path.split('?')[0];
      if (pathname === itemBase && paramsMatch(item.path)) return item.label;
    }
  }
  // Fallback: check without params
  for (const item of menuItems) {
    if (isSubMenu(item)) {
      for (const child of item.children) {
        if (pathname === child.path.split('?')[0]) return child.label;
      }
    } else {
      if (pathname === item.path.split('?')[0] && !item.path.includes('?')) return item.label;
    }
  }
  return 'Dashboard';
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [session, setSession] = useState<{ userId: string; name: string; role: string; department: string; licenseType?: string; mode?: string } | null>(null);
  const [hospitalName, setHospitalName] = useState('BAGA Hospital');
  const [searchStr, setSearchStr] = useState('');
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [logoSrc, setLogoSrc] = useState<string>('');

  // Notification state
  const [showNotif, setShowNotif] = useState(false);
  const [notifItems, setNotifItems] = useState<{ type: string; msg: string; color: string }[]>([]);

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);

  // Employee modal state
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [empForm, setEmpForm] = useState({ name: '', fatherName: '', cnic: '', mobile: '', gender: 'Male', age: '', address: '', designation: '', department: '', salary: 0, education: '' });

  // Load dark mode preference
  useEffect(() => {
    const dm = localStorage.getItem('baga_dark_mode');
    if (dm === 'true') { setDarkMode(true); document.documentElement.classList.add('dark'); }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('baga_dark_mode', String(next));
  };

  // Load notifications
  const loadNotifications = () => {
    const items: { type: string; msg: string; color: string }[] = [];
    try {
      const expired = getExpiredMedicines();
      const lowStock = getLowStockMedicines();
      expired.forEach(m => items.push({ type: 'expired', msg: `${m.name} (${m.strength}) expired`, color: 'rose' }));
      lowStock.filter(m => !expired.find(e => e.id === m.id)).slice(0, 5).forEach(m => items.push({ type: 'low_stock', msg: `${m.name} stock: ${m.stock}`, color: 'amber' }));
    } catch {}
    setNotifItems(items);
  };

  useEffect(() => {
    setSearchStr(typeof window !== 'undefined' ? window.location.search : '');
  }, [pathname]);

  useEffect(() => {
    // Try to get session — retry once in case of SQLite timing issue
    let s = getSession();
    if (!s) {
      // Retry after a brief delay (SQLite sync can be slow on startup)
      const timer = setTimeout(() => {
        const retry = getSession();
        if (!retry) { router.push('/login'); return; }
        setSession(retry);
        const h = getHospital();
        setHospitalName(h.name);
      }, 100);
      return () => clearTimeout(timer);
    }
    setSession(s);
    try {
      const h = getHospital();
      setHospitalName(h.name);
    } catch {}
  }, [router]);

  useEffect(() => {
    async function loadLicense() {
      try {
        const info = await fetchLicenseInfo();
        setLicenseInfo(info);
        // Load logo
        if (info.logoPath) {
          try {
            const isEl = typeof window !== 'undefined' && !!(window as any).bagaAPI;
            if (isEl) {
              const logoResult = await (window as any).bagaAPI.getLogoBase64();
              if (logoResult.success) setLogoSrc(logoResult.data);
            }
          } catch (e) {}
        } else if (info.logoUrl) {
          setLogoSrc(info.logoUrl);
        }
      } catch (e) {}
    }
    loadLicense();
    loadNotifications();
    // Refresh notifications every 60 seconds
    const notifInterval = setInterval(loadNotifications, 60000);
    return () => clearInterval(notifInterval);
  }, []);

  // Employee save handler
  const handleSaveEmployee = () => {
    if (!empForm.name.trim() || !empForm.mobile.trim() || !empForm.designation.trim() || !empForm.department.trim()) {
      alert('Name, Mobile, Designation and Department are required');
      return;
    }
    const code = generateEmployeeCode();
    const newEmp: Employee = {
      id: genId(),
      employeeCode: code,
      name: empForm.name.trim(),
      fatherName: empForm.fatherName.trim(),
      cnic: empForm.cnic.trim(),
      mobile: empForm.mobile.trim(),
      gender: empForm.gender,
      age: empForm.age || '-',
      address: empForm.address.trim(),
      designation: empForm.designation.trim(),
      department: empForm.department.trim(),
      salary: empForm.salary || 0,
      joinDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      education: empForm.education ? [{ degree: empForm.education, institution: '', year: new Date().getFullYear().toString(), grade: '' }] : [],
      experience: [],
      documents: [],
      equipment: [],
      bankAccount: '',
      emergencyContact: '',
    };
    addEmployee(newEmp);
    setShowEmpModal(false);
    setEmpForm({ name: '', fatherName: '', cnic: '', mobile: '', gender: 'Male', age: '', address: '', designation: '', department: '', salary: 0, education: '' });
    alert(`Employee ${newEmp.name} added! Code: ${code}`);
  };

  // Auto-expand submenus when on sub-paths
  useEffect(() => {
    if (pathname.startsWith('/lab/')) {
      setExpandedMenus(prev => prev.includes('Laboratory') ? prev : [...prev, 'Laboratory']);
    }
    if (pathname.startsWith('/hr/')) {
      setExpandedMenus(prev => prev.includes('HR Department') ? prev : [...prev, 'HR Department']);
    }
  }, [pathname]);

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  // Dynamic role label based on license type
  const getLicenseRoleLabel = () => {
    const lt = licenseInfo?.licenseType || session?.licenseType;
    if (lt === 'pharmacy') return 'Pharmacy';
    if (lt === 'lab') return 'Lab';
    if (lt === 'clinic') return 'Clinic';
    if (lt === 'reception') return 'Reception';
    return session?.role ? (roleLabels[session.role] || session.name) : 'Admin';
  };

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev =>
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  };

  if (!session) return null;

  // Determine menus based on license type and role
  let menuItems: RoleMenu;
  const lt = licenseInfo?.licenseType || session?.licenseType || 'hospital';
  
  if (lt === 'pharmacy') {
    // Pharmacy license: simplified POS only
    menuItems = [
      { label: 'Dashboard', path: '/pharmacy', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
      { label: 'Point of Sale', path: '/pharmacy?tab=pos', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z' },
      { label: 'Return Medicine', path: '/pharmacy/returns', icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' },
      { label: 'Medicine Inventory', path: '/pharmacy/inventory', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
      { label: 'My Statement', path: '/pharmacy/statement', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { label: 'User Management', path: '/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
      { label: 'Settings', path: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    ];
  } else if (lt === 'lab') {
    // Lab license: lab module only
    menuItems = [
      { label: 'Dashboard', path: '/lab', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
      {
        label: 'Laboratory',
        icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
        children: [
          { label: 'Test Orders', path: '/lab/orders', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
          { label: 'Sample Collection', path: '/lab/samples', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
          { label: 'Result Entry', path: '/lab/processing', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
          { label: 'Completed Reports', path: '/lab/reports', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          { label: 'Statistics', path: '/lab/statistics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
          { label: 'Inventory', path: '/lab/inventory', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
          { label: 'Test Catalog', path: '/lab/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
          { label: 'Expenses', path: '/lab/expenses', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
        ],
      },
      { label: 'User Management', path: '/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
      { label: 'Settings', path: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    ];
  } else if (lt === 'clinic') {
    // Clinic license: reception, doctors, lab, pharmacy
    menuItems = [
      { label: 'Dashboard', path: '/dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
      { label: 'Reception', path: '/reception', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
      { label: 'Doctors', path: '/doctors', icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
      { label: 'Appointment', path: '/appointment', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { label: 'Laboratory', path: '/lab', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
      { label: 'Pharmacy', path: '/pharmacy', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
      { label: 'User Management', path: '/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
      { label: 'Settings', path: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    ];
  } else {
    // Hospital (default) or demo: use role-based menus as before
    menuItems = roleMenus[session.role] || roleMenus.reception;
    
    // Ensure User Management is included for all roles in hospital mode
    const hasUserMgmt = menuItems.some(item => 
      !('children' in item) && item.path === '/users'
    );
    if (!hasUserMgmt) {
      menuItems.push({ label: 'User Management', path: '/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' });
    }
  }
  const currentLabel = getPageTitle(pathname, menuItems, searchStr);

  // Helper to check if an item is active based on path and query params
  const isItemActive = (itemPath: string): boolean => {
    if (!itemPath.includes('?')) {
      return pathname === itemPath && searchStr === '';
    }
    const [basePath, queryStr] = itemPath.split('?');
    if (pathname !== basePath) return false;
    const expected = new URLSearchParams(queryStr);
    const current = new URLSearchParams(searchStr);
    for (const [key, val] of expected.entries()) {
      if (current.get(key) !== val) return false;
    }
    return true;
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="p-3 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 ${logoSrc ? '' : (roleColors[session.role] || 'bg-blue-600')} rounded-xl flex items-center justify-center overflow-hidden`}>
              {logoSrc ? (
                <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-white font-bold text-sm leading-tight">{hospitalName}</h2>
              <p className="text-slate-400 text-xs">{getLicenseRoleLabel()}</p>
            </div>
          </div>
        </div>

        <nav className="py-1 flex-1">
          <div className="px-4 mb-1 mt-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Menu</span>
          </div>
          {menuItems.map((item) => {
            if (isSubMenu(item)) {
              const isExpanded = expandedMenus.includes(item.label);
              const isChildActive = item.children.some(c => isItemActive(c.path));
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={`sidebar-link w-full justify-between ${isChildActive ? 'active' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                      <span>{item.label}</span>
                    </div>
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="bg-slate-800/50">
                      {item.children.map(child => (
                        <Link
                          key={child.path}
                          href={child.path}
                          className={`sidebar-link pl-12 text-xs py-1.5 ${isItemActive(child.path) ? 'active' : ''}`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <span>{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`sidebar-link ${isItemActive(item.path) ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 ${roleColors[session.role] || 'bg-blue-600'} rounded-full flex items-center justify-center text-white font-bold text-xs`}>
              {session.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{session.name}</p>
              <p className="text-slate-400 text-xs">{getLicenseRoleLabel()}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content flex-1">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-slate-800">{currentLabel}</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle */}
            <button onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-slate-100 transition" title={darkMode ? 'Light Mode' : 'Dark Mode'}>
              {darkMode ? (
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button onClick={() => { setShowNotif(!showNotif); loadNotifications(); }} className="p-2 rounded-lg hover:bg-slate-100 transition relative">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {notifItems.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{notifItems.length > 9 ? '9+' : notifItems.length}</span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-hidden">
                  <div className="px-4 py-2 border-b border-slate-100 font-semibold text-sm text-slate-700">Notifications</div>
                  {notifItems.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">No notifications</div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      {notifItems.map((n, i) => (
                        <div key={i} className={`px-4 py-2 text-xs border-b border-slate-50 flex items-center gap-2 ${n.color === 'rose' ? 'bg-red-50' : 'bg-amber-50'}`}>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${n.color === 'rose' ? 'bg-red-500' : 'bg-amber-500'}`} />
                          <span className="text-slate-700">{n.msg}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Add Employee Button */}
            <button onClick={() => setShowEmpModal(true)} className="p-2 rounded-lg hover:bg-slate-100 transition" title="Add Employee">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </button>

            <span className={`badge ${roleColors[session.role] ? roleColors[session.role].replace('bg-', 'bg-') : ''}`} style={{background: 'var(--sidebar-active)', color: 'white'}}>
              {getLicenseRoleLabel()}
            </span>
            {session?.mode === 'demo' && licenseInfo?.demo && (
              <span className="badge" style={{ background: '#d97706', color: 'white' }}>
                Demo: {licenseInfo.demo.remaining} day(s) left
              </span>
            )}
            {licenseInfo?.licenseKey && (
              <span className="badge" style={{ background: '#0ea5e9', color: 'white' }}>
                {licenseInfo.licenseKey}
              </span>
            )}
          </div>
        </header>

        {/* Add Employee Modal */}
        {showEmpModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowEmpModal(false)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">Add Employee</h3>
                <button onClick={() => setShowEmpModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">Full Name *</label><input className="form-input" value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} placeholder="Employee name" /></div>
                <div><label className="form-label">Father Name</label><input className="form-input" value={empForm.fatherName} onChange={e => setEmpForm({...empForm, fatherName: e.target.value})} /></div>
                <div><label className="form-label">CNIC</label><input className="form-input" value={empForm.cnic} onChange={e => setEmpForm({...empForm, cnic: e.target.value})} placeholder="XXXXX-XXXXXXX-X" /></div>
                <div><label className="form-label">Mobile *</label><input className="form-input" value={empForm.mobile} onChange={e => setEmpForm({...empForm, mobile: e.target.value})} placeholder="03XX-XXXXXXX" /></div>
                <div><label className="form-label">Gender</label><select className="form-input" value={empForm.gender} onChange={e => setEmpForm({...empForm, gender: e.target.value})}><option>Male</option><option>Female</option></select></div>
                <div><label className="form-label">Age</label><input className="form-input" value={empForm.age} onChange={e => setEmpForm({...empForm, age: e.target.value})} /></div>
                <div><label className="form-label">Designation *</label><input className="form-input" value={empForm.designation} onChange={e => setEmpForm({...empForm, designation: e.target.value})} placeholder="e.g. Pharmacist" /></div>
                <div><label className="form-label">Department *</label><input className="form-input" value={empForm.department} onChange={e => setEmpForm({...empForm, department: e.target.value})} placeholder="e.g. Pharmacy" /></div>
                <div><label className="form-label">Salary</label><input type="number" className="form-input" value={empForm.salary || ''} onChange={e => setEmpForm({...empForm, salary: Number(e.target.value) || 0})} /></div>
                <div><label className="form-label">Education</label><input className="form-input" value={empForm.education} onChange={e => setEmpForm({...empForm, education: e.target.value})} placeholder="e.g. B.Pharm" /></div>
                <div className="col-span-2"><label className="form-label">Address</label><input className="form-input" value={empForm.address} onChange={e => setEmpForm({...empForm, address: e.target.value})} /></div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowEmpModal(false)} className="btn btn-outline flex-1">Cancel</button>
                <button onClick={handleSaveEmployee} className="btn btn-primary flex-1">Add Employee</button>
              </div>
              <p className="text-xs text-slate-400 mt-2">Employee ID will be auto-generated. For full details, manage in HR Department.</p>
            </div>
          </div>
        )}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
