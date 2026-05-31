'use client';
import { useState } from 'react';

const DOCTORS = [
  { id: 'd1', name: 'Dr. Ahmed Hassan', dept: 'Emergency', fee: 1500, timing: '9AM - 1PM', phone: '0300-1111111', status: 'Active' },
  { id: 'd2', name: 'Dr. Muhammad Ali', dept: 'Cardiology', fee: 2500, timing: '2PM - 6PM', phone: '0300-2222222', status: 'Active' },
  { id: 'd3', name: 'Dr. Sara Khan', dept: 'Gynecology', fee: 2000, timing: '10AM - 2PM', phone: '0300-3333333', status: 'Active' },
  { id: 'd4', name: 'Dr. Bilal Siddiqui', dept: 'Orthopedic', fee: 1800, timing: '4PM - 8PM', phone: '0300-4444444', status: 'Active' },
  { id: 'd5', name: 'Dr. Zainab Malik', dept: 'Pediatrician', fee: 1500, timing: '9AM - 1PM', phone: '0300-5555555', status: 'Active' },
  { id: 'd6', name: 'Dr. Usman Tariq', dept: 'ENT', fee: 2000, timing: '3PM - 7PM', phone: '0300-6666666', status: 'Active' },
  { id: 'd7', name: 'Dr. Imran Raza', dept: 'General Medicine', fee: 1200, timing: '9AM - 5PM', phone: '0300-7777777', status: 'Active' },
  { id: 'd8', name: 'Dr. Nadia Ashraf', dept: 'Skin Specialist', fee: 2000, timing: '11AM - 3PM', phone: '0300-8888888', status: 'Active' },
  { id: 'd9', name: 'Dr. Kamran Hyder', dept: 'Eye Specialist', fee: 2200, timing: '10AM - 4PM', phone: '0300-9999999', status: 'Active' },
  { id: 'd10', name: 'Dr. Farhan Ali', dept: 'Dental', fee: 1500, timing: '9AM - 2PM', phone: '0300-0000001', status: 'Active' },
  { id: 'd11', name: 'Dr. Saima Noor', dept: 'Physiotherapy', fee: 1000, timing: '8AM - 12PM', phone: '0300-0000002', status: 'Active' },
  { id: 'd12', name: 'Dr. Rizwan Ahmad', dept: 'Surgery', fee: 5000, timing: 'By Appointment', phone: '0300-0000003', status: 'Active' },
];

export default function DoctorsPage() {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [viewDoctor, setViewDoctor] = useState<typeof DOCTORS[0] | null>(null);

  const departments = ['All', ...Array.from(new Set(DOCTORS.map(d => d.dept)))];
  const totalDoctors = DOCTORS.length;
  const activeDepts = new Set(DOCTORS.map(d => d.dept)).size;

  const filtered = DOCTORS.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.dept.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'All' || d.dept === deptFilter;
    return matchSearch && matchDept;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Doctors Management</h2>
          <p className="text-sm text-slate-500">{totalDoctors} registered doctors across {activeDepts} departments</p>
        </div>
        <input className="form-input w-64" placeholder="Search doctor or department..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="stat-card card-hover border border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 font-medium">Total Doctors</p>
          <p className="text-2xl font-bold text-blue-700">{totalDoctors}</p>
        </div>
        <div className="stat-card card-hover border border-purple-200 bg-purple-50">
          <p className="text-xs text-purple-600 font-medium">Active Departments</p>
          <p className="text-2xl font-bold text-purple-700">{activeDepts}</p>
        </div>
      </div>

      {/* Department Filter */}
      <div className="flex gap-2 flex-wrap">
        {departments.map(dept => (
          <button key={dept} onClick={() => setDeptFilter(dept)} className={`btn ${deptFilter === dept ? 'btn-primary' : 'btn-outline'} btn-sm`}>
            {dept} {dept !== 'All' && <span className="ml-1 opacity-70">({DOCTORS.filter(d => d.dept === dept).length})</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="data-table">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th>#</th><th>Name</th><th>Department</th><th>Fee</th><th>Timing</th><th>Phone</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-400 py-8">No doctors found</td></tr>
              )}
              {filtered.map((doc, i) => (
                <tr key={doc.id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td className="font-medium">{doc.name}</td>
                  <td><span className="badge badge-blue">{doc.dept}</span></td>
                  <td className="font-semibold">Rs. {doc.fee.toLocaleString()}</td>
                  <td>{doc.timing}</td>
                  <td className="font-mono text-sm">{doc.phone}</td>
                  <td><span className="badge badge-green">{doc.status}</span></td>
                  <td>
                    <button onClick={() => setViewDoctor(doc)} className="btn btn-outline btn-sm">View Schedule</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Details Modal */}
      {viewDoctor && (
        <div className="modal-overlay" onClick={() => setViewDoctor(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Doctor Details</h3>
              <button onClick={() => setViewDoctor(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">
                {viewDoctor.name.split(' ').slice(-1)[0].charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-lg text-slate-800">{viewDoctor.name}</h4>
                <span className="badge badge-blue">{viewDoctor.dept}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-50 rounded-lg p-3">
                <span className="text-sm text-slate-500">Consultation Fee</span>
                <span className="font-bold text-slate-800 text-lg">Rs. {viewDoctor.fee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 rounded-lg p-3">
                <span className="text-sm text-slate-500">Schedule</span>
                <span className="font-semibold">{viewDoctor.timing}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 rounded-lg p-3">
                <span className="text-sm text-slate-500">Phone</span>
                <span className="font-mono">{viewDoctor.phone}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 rounded-lg p-3">
                <span className="text-sm text-slate-500">Status</span>
                <span className={`badge ${viewDoctor.status === 'Active' ? 'badge-green' : 'badge-red'}`}>{viewDoctor.status}</span>
              </div>
            </div>

            <button onClick={() => setViewDoctor(null)} className="btn btn-outline w-full mt-4">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
