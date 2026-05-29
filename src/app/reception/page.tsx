'use client';

import { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HMSData, Patient, Visit } from '@/lib/types';
import { loadData, saveData, generateId } from '@/lib/data';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Search, RefreshCw, Edit, UserPlus, CalendarPlus,
  Users, Clock, CreditCard, Phone, MapPin, User, FileText
} from 'lucide-react';

const doctors = ['Dr. Muhammad Ashraf', 'Dr. Sajid Raza', 'Dr. Nabeel Ahmad'];

export default function ReceptionPage() {
  const [data, setData] = useState<HMSData | null>(null);
  const [searchMobile, setSearchMobile] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showNewVisit, setShowNewVisit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Patient>>({});

  // Registration form
  const [regForm, setRegForm] = useState({
    name: '',
    relationType: 'father' as 'father' | 'husband',
    relationName: '',
    mobile: '',
    age: '',
    address: '',
    gender: 'male' as 'male' | 'female',
  });

  // New visit form
  const [visitDoctor, setVisitDoctor] = useState(doctors[0]);

  const refreshData = useCallback(() => {
    const d = loadData();
    setData(d);
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  if (!data) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayVisits = data.visits.filter(v => v.date === today);
  const totalPatients = data.patients.length;

  // Search patient by mobile
  const handleSearch = () => {
    if (!searchMobile.trim()) {
      toast.error('Enter mobile number');
      return;
    }
    const results = data.patients.filter(p => p.mobile.includes(searchMobile.trim()));
    setSearchResults(results);
    if (results.length === 0) {
      toast.error('No patient found');
    }
  };

  // Register new patient
  const handleRegister = () => {
    if (!regForm.name.trim() || !regForm.relationName.trim() || !regForm.mobile.trim() || !regForm.age.trim() || !regForm.address.trim()) {
      toast.error('Fill all required fields');
      return;
    }

    const newPatient: Patient = {
      id: generateId(),
      patientNumber: `PAT-${String(data.counters.patient + 1).padStart(4, '0')}`,
      ...regForm,
      cardStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = {
      ...data,
      patients: [...data.patients, newPatient],
      counters: { ...data.counters, patient: data.counters.patient + 1 },
    };
    saveData(updated);
    setData(updated);
    setRegForm({ name: '', relationType: 'father', relationName: '', mobile: '', age: '', address: '', gender: 'male' });
    setShowRegister(false);
    toast.success(`Patient registered! ${newPatient.patientNumber}`);
  };

  // Renew card
  const handleRenewCard = (patient: Patient) => {
    const updated = {
      ...data,
      patients: data.patients.map(p =>
        p.id === patient.id ? { ...p, cardStatus: 'active' as const, updatedAt: new Date().toISOString() } : p
      ),
    };
    saveData(updated);
    setData(updated);
    setSelectedPatient({ ...patient, cardStatus: 'active', updatedAt: new Date().toISOString() });
    toast.success('Card renewed');
  };

  // Create new visit
  const handleNewVisit = (patient: Patient) => {
    const newVisit: Visit = {
      id: generateId(),
      visitNumber: `V-${String(data.counters.visit + 1).padStart(4, '0')}`,
      patientId: patient.id,
      patientNumber: patient.patientNumber,
      date: today,
      time: format(new Date(), 'HH:mm'),
      doctorName: visitDoctor,
      status: 'waiting',
      diagnosis: '',
      prescription: [],
      labTests: [],
      xrayOrders: [],
      ultrasoundOrders: [],
      surgeryOrder: null,
      notes: '',
      createdAt: new Date().toISOString(),
    };

    const updated = {
      ...data,
      visits: [...data.visits, newVisit],
      counters: { ...data.counters, visit: data.counters.visit + 1 },
    };
    saveData(updated);
    setData(updated);
    setShowNewVisit(false);
    toast.success(`New visit created! ${newVisit.visitNumber}`);
  };

  // Edit patient
  const openEdit = (patient: Patient) => {
    setEditForm({ ...patient });
    setShowEdit(true);
  };

  const handleEditSave = () => {
    if (!editForm.name?.trim() || !editForm.relationName?.trim() || !editForm.mobile?.trim() || !editForm.age?.trim() || !editForm.address?.trim()) {
      toast.error('Fill all required fields');
      return;
    }
    const updated = {
      ...data,
      patients: data.patients.map(p =>
        p.id === editForm.id ? { ...p, ...editForm, updatedAt: new Date().toISOString() } as Patient : p
      ),
    };
    saveData(updated);
    setData(updated);
    setSelectedPatient(editForm as Patient);
    setShowEdit(false);
    toast.success('Patient info updated');
  };

  const patientVisits = selectedPatient ? data.visits.filter(v => v.patientId === selectedPatient.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPatients}</p>
                <p className="text-xs text-gray-500">Total Patients</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CalendarPlus className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayVisits.length}</p>
                <p className="text-xs text-gray-500">Today Visits</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayVisits.filter(v => v.status === 'waiting').length}</p>
                <p className="text-xs text-gray-500">Waiting</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayVisits.filter(v => v.status === 'seen' || v.status === 'completed').length}</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="register" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="register">
                <UserPlus className="w-4 h-4 mr-1" /> New Patient
              </TabsTrigger>
              <TabsTrigger value="search">
                <Search className="w-4 h-4 mr-1" /> Search
              </TabsTrigger>
              <TabsTrigger value="today">
                <Clock className="w-4 h-4 mr-1" /> Today Visits
              </TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={refreshData}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>

          {/* REGISTER TAB */}
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">New Patient Registration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Patient Name <span className="text-red-500">*</span></Label>
                    <Input value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} placeholder="e.g. Muhammad Ahmad" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-2">
                        <Label>Father/Husband Name <span className="text-red-500">*</span></Label>
                        <Input value={regForm.relationName} onChange={e => setRegForm({ ...regForm, relationName: e.target.value })} placeholder="Father/Husband Name" />
                      </div>
                      <Select value={regForm.relationType} onValueChange={v => setRegForm({ ...regForm, relationType: v as 'father' | 'husband' })}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="father">Father</SelectItem>
                          <SelectItem value="husband">Husband</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Mobile Number <span className="text-red-500">*</span></Label>
                    <Input value={regForm.mobile} onChange={e => setRegForm({ ...regForm, mobile: e.target.value })} placeholder="03001234567" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>Age <span className="text-red-500">*</span></Label>
                    <Input value={regForm.age} onChange={e => setRegForm({ ...regForm, age: e.target.value })} placeholder="e.g. 35 years" />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={regForm.gender} onValueChange={v => setRegForm({ ...regForm, gender: v as 'male' | 'female' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Address <span className="text-red-500">*</span></Label>
                    <Input value={regForm.address} onChange={e => setRegForm({ ...regForm, address: e.target.value })} placeholder="Full Address" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setRegForm({ name: '', relationType: 'father', relationName: '', mobile: '', age: '', address: '', gender: 'male' })}>
                    Clear
                  </Button>
                  <Button onClick={handleRegister} className="bg-emerald-600 hover:bg-emerald-700">
                    <UserPlus className="w-4 h-4 mr-1" /> Register
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEARCH TAB */}
          <TabsContent value="search">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Search by Mobile Number</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 mb-4">
                  <Input
                    value={searchMobile}
                    onChange={e => setSearchMobile(e.target.value)}
                    placeholder="Enter mobile number..."
                    dir="ltr"
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
                    <Search className="w-4 h-4 mr-1" /> Search
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">{searchResults.length} patients found</p>
                    {searchResults.map(patient => (
                      <div
                        key={patient.id}
                        className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedPatient(patient)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-bold">{patient.name}</p>
                              <p className="text-sm text-gray-500">{patient.patientNumber}</p>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <p className="flex items-center gap-1 text-gray-500"><Phone className="w-3 h-3" />{patient.mobile}</p>
                            <Badge variant={patient.cardStatus === 'active' ? 'default' : 'destructive'} className="mt-1">
                              {patient.cardStatus === 'active' ? 'Active' : 'Expired'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TODAY VISITS TAB */}
          <TabsContent value="today">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Today Visits - {format(new Date(), 'dd/MM/yyyy')}</CardTitle>
              </CardHeader>
              <CardContent>
                {todayVisits.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No visits today</p>
                ) : (
                  <div className="space-y-2">
                    {todayVisits.map(visit => {
                      const patient = data.patients.find(p => p.id === visit.patientId);
                      return (
                        <div key={visit.id} className="border rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-bold text-emerald-700">
                              {visit.visitNumber.split('-')[1]}
                            </div>
                            <div>
                              <p className="font-medium">{patient?.name || 'Unknown'}</p>
                              <p className="text-xs text-gray-500">{visit.patientNumber} - {visit.doctorName} - {visit.time}</p>
                            </div>
                          </div>
                          <Badge
                            variant={visit.status === 'waiting' ? 'outline' : visit.status === 'in-progress' ? 'default' : 'secondary'}
                            className={
                              visit.status === 'waiting' ? 'border-amber-400 text-amber-700' :
                              visit.status === 'in-progress' ? 'bg-blue-600' :
                              'bg-emerald-600'
                            }
                          >
                            {visit.status === 'waiting' ? 'Waiting' : visit.status === 'in-progress' ? 'In Progress' : visit.status === 'seen' ? 'Seen' : 'Completed'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* PATIENT DETAIL DIALOG */}
        <Dialog open={!!selectedPatient} onOpenChange={open => { if (!open) setSelectedPatient(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {selectedPatient && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-emerald-600" />
                    {selectedPatient.name} - {selectedPatient.patientNumber}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Patient Info */}
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">
                    <div><span className="text-xs text-gray-500">Name:</span><p className="font-medium">{selectedPatient.name}</p></div>
                    <div><span className="text-xs text-gray-500">{selectedPatient.relationType === 'father' ? 'Father' : 'Husband'}:</span><p className="font-medium">{selectedPatient.relationName}</p></div>
                    <div><span className="text-xs text-gray-500">Mobile:</span><p className="font-medium" dir="ltr">{selectedPatient.mobile}</p></div>
                    <div><span className="text-xs text-gray-500">Age:</span><p className="font-medium">{selectedPatient.age}</p></div>
                    <div><span className="text-xs text-gray-500">Address:</span><p className="font-medium">{selectedPatient.address}</p></div>
                    <div><span className="text-xs text-gray-500">Gender:</span><p className="font-medium">{selectedPatient.gender === 'male' ? 'Male' : 'Female'}</p></div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleRenewCard(selectedPatient)} className="bg-blue-600 hover:bg-blue-700">
                      <RefreshCw className="w-4 h-4 mr-1" /> Card Renewal
                    </Button>
                    <Button size="sm" onClick={() => setShowNewVisit(true)} className="bg-emerald-600 hover:bg-emerald-700">
                      <CalendarPlus className="w-4 h-4 mr-1" /> New Visit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(selectedPatient)}>
                      <Edit className="w-4 h-4 mr-1" /> Edit
                    </Button>
                  </div>

                  {/* Visit History */}
                  <div>
                    <h3 className="font-bold text-sm mb-2">Visit History ({patientVisits.length})</h3>
                    {patientVisits.length === 0 ? (
                      <p className="text-sm text-gray-500">No visits</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {patientVisits.map(visit => (
                          <div key={visit.id} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{visit.visitNumber}</span>
                              <Badge variant={visit.status === 'waiting' ? 'outline' : visit.status === 'completed' ? 'default' : 'secondary'}>
                                {visit.status === 'waiting' ? 'Waiting' : visit.status === 'in-progress' ? 'In Progress' : visit.status === 'seen' ? 'Seen' : 'Completed'}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500">{visit.date} {visit.time} - {visit.doctorName}</p>
                            {visit.diagnosis && <p className="text-sm mt-1">Diagnosis: {visit.diagnosis}</p>}
                            {visit.prescription.length > 0 && (
                              <div className="mt-1">
                                <span className="text-xs text-gray-500">Prescription:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {visit.prescription.map((med, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">{med.medicine} {med.dosage}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* NEW VISIT DIALOG */}
        <Dialog open={showNewVisit} onOpenChange={setShowNewVisit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Visit - {selectedPatient?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Doctor</Label>
                <Select value={visitDoctor} onValueChange={(v) => setVisitDoctor(v || '')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {doctors.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewVisit(false)}>Cancel</Button>
              <Button onClick={() => selectedPatient && handleNewVisit(selectedPatient)} className="bg-emerald-600 hover:bg-emerald-700">
                Create Visit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* EDIT PATIENT DIALOG */}
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Patient Information</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Patient Name <span className="text-red-500">*</span></Label>
                <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Father/Husband Name <span className="text-red-500">*</span></Label>
                  <Input value={editForm.relationName || ''} onChange={e => setEditForm({ ...editForm, relationName: e.target.value })} />
                </div>
                <div className="w-32 space-y-2">
                  <Label>Relation</Label>
                  <Select value={editForm.relationType} onValueChange={v => setEditForm({ ...editForm, relationType: v as 'father' | 'husband' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="husband">Husband</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Mobile Number <span className="text-red-500">*</span></Label>
                  <Input value={editForm.mobile || ''} onChange={e => setEditForm({ ...editForm, mobile: e.target.value })} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>Age <span className="text-red-500">*</span></Label>
                  <Input value={editForm.age || ''} onChange={e => setEditForm({ ...editForm, age: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address <span className="text-red-500">*</span></Label>
                <Input value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={editForm.gender} onValueChange={v => setEditForm({ ...editForm, gender: v as 'male' | 'female' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button onClick={handleEditSave} className="bg-emerald-600 hover:bg-emerald-700">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
