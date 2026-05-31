'use client';
import { useState, useEffect, useCallback } from 'react';
import { getEmployees, getAttendanceRecords, todayStr } from '@/lib/store';
import type { Employee } from '@/lib/types';

export default function HRDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const loadData = useCallback(() => {
    setEmployees(getEmployees());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const inactiveEmployees = employees.filter(e => e.status === 'Inactive').length;
  const terminatedEmployees = employees.filter(e => e.status === 'Terminated').length;
  const monthlySalary = employees.filter(e => e.status === 'Active').reduce((s, e) => s + e.salary, 0);

  const departments = [...new Set(employees.map(e => e.department))];
  const deptCount = departments.length;

  const deptBreakdown = departments.map(d => ({
    name: d,
    count: employees.filter(e => e.department === d && e.status === 'Active').length,
    total: employees.filter(e => e.department === d).length,
  })).sort((a, b) => b.count - a.count);

  const recentEmployees = [...employees].sort((a, b) => b.joinDate.localeCompare(a.joinDate)).slice(0, 5);

  const todayAttendance = getAttendanceRecords().filter(a => a.date === todayStr());
  const presentToday = todayAttendance.filter(a => a.status === 'Present').length;
  const absentToday = todayAttendance.filter(a => a.status === 'Absent').length;
  const onLeaveToday = todayAttendance.filter(a => a.status === 'Leave').length;
  const halfDayToday = todayAttendance.filter(a => a.status === 'Half Day').length;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">HR Dashboard</h2>
          <p className="text-sm text-slate-500">Employee Management Overview</p>
        </div>
        <div className="text-sm text-slate-400">
          <span className="font-semibold">Today: </span>{todayStr()}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Total Employees</p>
          <p className="text-2xl font-bold text-blue-700">{totalEmployees}</p>
        </div>
        <div className="stat-card card-hover border border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 font-medium">Active Employees</p>
          <p className="text-2xl font-bold text-emerald-700">{activeEmployees}</p>
        </div>
        <div className="stat-card card-hover border border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 font-medium">Monthly Salary</p>
          <p className="text-2xl font-bold text-amber-700">Rs. {monthlySalary.toLocaleString()}</p>
        </div>
        <div className="stat-card card-hover border border-purple-200 bg-purple-50">
          <p className="text-xs text-purple-600 font-medium">Departments</p>
          <p className="text-2xl font-bold text-purple-700">{deptCount}</p>
        </div>
      </div>

      {/* Today's Attendance Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-3">Today&apos;s Attendance Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
            <p className="text-2xl font-bold text-emerald-700">{presentToday}</p>
            <p className="text-xs text-emerald-600">Present</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
            <p className="text-2xl font-bold text-red-700">{absentToday}</p>
            <p className="text-xs text-red-600">Absent</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-200">
            <p className="text-2xl font-bold text-amber-700">{onLeaveToday}</p>
            <p className="text-xs text-amber-600">On Leave</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
            <p className="text-2xl font-bold text-blue-700">{halfDayToday}</p>
            <p className="text-xs text-blue-600">Half Day</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Employees */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-3">Recent Employees</h3>
          {recentEmployees.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No employees yet</p>
          ) : (
            <div className="space-y-2">
              {recentEmployees.map(emp => (
                <div key={emp.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                      {(emp.employeeCode || emp.name.charAt(0))}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-800">{emp.name}</p>
                      <p className="text-xs text-slate-400">{emp.designation} - {emp.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">{emp.joinDate}</p>
                    <span className={`badge ${emp.status === 'Active' ? 'badge-green' : emp.status === 'Inactive' ? 'badge-amber' : 'badge-red'} text-xs`}>
                      {emp.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Department Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-3">Department Breakdown</h3>
          {deptBreakdown.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No departments</p>
          ) : (
            <div className="space-y-2">
              {deptBreakdown.map(dept => (
                <div key={dept.name} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-bold text-sm">
                      {dept.count}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-800">{dept.name}</p>
                      <p className="text-xs text-slate-400">{dept.total} total employees</p>
                    </div>
                  </div>
                  <div className="w-24 bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${activeEmployees > 0 ? (dept.count / activeEmployees) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a href="/hr/employees" className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </div>
            <div>
              <p className="font-medium text-sm text-slate-800">Add Employee</p>
              <p className="text-xs text-slate-400">New hire</p>
            </div>
          </a>
          <a href="/hr/salaries" className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="font-medium text-sm text-slate-800">Manage Salaries</p>
              <p className="text-xs text-slate-400">Payroll</p>
            </div>
          </a>
          <a href="/hr/attendance" className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="font-medium text-sm text-slate-800">Attendance</p>
              <p className="text-xs text-slate-400">Mark today</p>
            </div>
          </a>
          <a href="/hr/employees" className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div>
              <p className="font-medium text-sm text-slate-800">View All Staff</p>
              <p className="text-xs text-slate-400">Directory</p>
            </div>
          </a>
        </div>
      </div>

      {/* Employee Status Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-3">Employee Status Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-2xl font-bold text-emerald-700">{activeEmployees}</p>
            <p className="text-sm text-emerald-600">Active</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-2xl font-bold text-amber-700">{inactiveEmployees}</p>
            <p className="text-sm text-amber-600">Inactive</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-2xl font-bold text-red-700">{terminatedEmployees}</p>
            <p className="text-sm text-red-600">Terminated</p>
          </div>
        </div>
      </div>
    </div>
  );
}
