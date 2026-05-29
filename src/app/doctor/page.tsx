'use client';

import { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HMSData, Visit, PrescriptionItem, LabOrder, XrayOrder, UltrasoundOrder, SurgeryOrder } from '@/lib/types';
import { loadData, saveData, generateId } from '@/lib/data';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Stethoscope, Clock, CheckCircle, Plus, Trash2, Users, Eye, Beaker, ScanLine, Activity, Scissors } from 'lucide-react';

export default function DoctorPage() {
  const [data, setData] = useState<HMSData | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [showPrescription, setShowPrescription] = useState(false);
  const [showLabOrder, setShowLabOrder] = useState(false);
  const [showXrayOrder, setShowXrayOrder] = useState(false);
  const [showUltrasoundOrder, setShowUltrasoundOrder] = useState(false);
  const [showSurgeryOrder, setShowSurgeryOrder] = useState(false);

  // Prescription form
  const [rxForm, setRxForm] = useState<PrescriptionItem>({ medicine: '', dosage: '', frequency: '', duration: '' });
  // Lab order form
  const [labForm, setLabForm] = useState({ testName: '', price: '' });
  // Xray form
  const [xrayForm, setXrayForm] = useState({ testName: '', price: '' });
  // Ultrasound form
  const [usForm, setUsForm] = useState({ testName: '', price: '' });
  // Surgery form
  const [surgForm, setSurgForm] = useState({ surgeryType: '', totalCost: '', notes: '' });

  const refreshData = useCallback(() => { setData(loadData()); }, []);
  useEffect(() => { refreshData(); }, [refreshData]);

  if (!data) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayVisits = data.visits.filter(v => v.date === today);
  const waitingVisits = todayVisits.filter(v => v.status === 'waiting');
  const inProgressVisits = todayVisits.filter(v => v.status === 'in-progress');
  const completedVisits = todayVisits.filter(v => v.status === 'seen' || v.status === 'completed');

  const getPatient = (pid: string) => data.patients.find(p => p.id === pid);

  const updateVisit = (updatedVisit: Visit) => {
    const updated = {
      ...data,
      visits: data.visits.map(v => v.id === updatedVisit.id ? updatedVisit : v),
    };
    saveData(updated);
    setData(updated);
    setSelectedVisit(updatedVisit);
  };

  const markAsInProgress = (visit: Visit) => {
    updateVisit({ ...visit, status: 'in-progress' });
    toast.success('Treatment started');
  };

  const markAsSeen = (visit: Visit) => {
    updateVisit({ ...visit, status: 'seen' });
    toast.success('Patient seen');
  };

  const saveDiagnosis = (diagnosis: string) => {
    if (!selectedVisit) return;
    updateVisit({ ...selectedVisit, diagnosis });
    toast.success('Diagnosis saved');
  };

  const addPrescription = () => {
    if (!selectedVisit || !rxForm.medicine.trim()) return;
    const updated: Visit = {
      ...selectedVisit,
      prescription: [...selectedVisit.prescription, { ...rxForm }],
    };
    updateVisit(updated);
    setRxForm({ medicine: '', dosage: '', frequency: '', duration: '' });
    setShowPrescription(false);
    toast.success('Medicine added');
  };

  const removePrescription = (idx: number) => {
    if (!selectedVisit) return;
    const updated: Visit = {
      ...selectedVisit,
      prescription: selectedVisit.prescription.filter((_, i) => i !== idx),
    };
    updateVisit(updated);
  };

  const addLabTest = () => {
    if (!selectedVisit || !labForm.testName.trim()) return;
    const order: LabOrder = {
      id: generateId(),
      testName: labForm.testName,
      price: parseInt(labForm.price) || 0,
      status: 'ordered',
      result: '',
      paidAt: null,
      completedAt: null,
      paymentLocation: data.settings.labPaymentLocation,
    };
    updateVisit({ ...selectedVisit, labTests: [...selectedVisit.labTests, order] });
    setLabForm({ testName: '', price: '' });
    setShowLabOrder(false);
    toast.success('Lab test ordered');
  };

  const addXray = () => {
    if (!selectedVisit || !xrayForm.testName.trim()) return;
    const order: XrayOrder = {
      id: generateId(),
      testName: xrayForm.testName,
      price: parseInt(xrayForm.price) || 0,
      status: 'ordered',
      result: '',
      paidAt: null,
      completedAt: null,
      paymentLocation: data.settings.xrayPaymentLocation,
    };
    updateVisit({ ...selectedVisit, xrayOrders: [...selectedVisit.xrayOrders, order] });
    setXrayForm({ testName: '', price: '' });
    setShowXrayOrder(false);
    toast.success('X-Ray ordered');
  };

  const addUltrasound = () => {
    if (!selectedVisit || !usForm.testName.trim()) return;
    const order: UltrasoundOrder = {
      id: generateId(),
      testName: usForm.testName,
      price: parseInt(usForm.price) || 0,
      status: 'ordered',
      result: '',
      paidAt: null,
      completedAt: null,
      paymentLocation: data.settings.ultrasoundPaymentLocation,
    };
    updateVisit({ ...selectedVisit, ultrasoundOrders: [...selectedVisit.ultrasoundOrders, order] });
    setUsForm({ testName: '', price: '' });
    setShowUltrasoundOrder(false);
    toast.success('Ultrasound ordered');
  };

  const addSurgery = () => {
    if (!selectedVisit || !surgForm.surgeryType.trim()) return;
    const cost = parseInt(surgForm.totalCost) || 0;
    const order: SurgeryOrder = {
      id: generateId(),
      surgeryType: surgForm.surgeryType,
      totalCost: cost,
      amountPaid: 0,
      balance: cost,
      status: 'scheduled',
      paymentLocation: data.settings.surgeryPaymentLocation,
      notes: surgForm.notes,
    };
    updateVisit({ ...selectedVisit, surgeryOrder: order });
    setSurgForm({ surgeryType: '', totalCost: '', notes: '' });
    setShowSurgeryOrder(false);
    toast.success('Surgery ordered');
  };

  const VisitCard = ({ visit }: { visit: Visit }) => {
    const patient = getPatient(visit.patientId);
    return (
      <div
        className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setSelectedVisit(visit)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              visit.status === 'waiting' ? 'bg-amber-100 text-amber-700' :
              visit.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              {visit.visitNumber.split('-')[1]}
            </div>
            <div>
              <p className="font-bold">{patient?.name}</p>
              <p className="text-xs text-gray-500">{visit.patientNumber}</p>
            </div>
          </div>
          <Badge variant={visit.status === 'waiting' ? 'outline' : visit.status === 'in-progress' ? 'default' : 'secondary'}
            className={visit.status === 'waiting' ? 'border-amber-400 text-amber-700' : visit.status === 'in-progress' ? 'bg-blue-600' : 'bg-emerald-600'}>
            {visit.status === 'waiting' ? 'Waiting' : visit.status === 'in-progress' ? 'In Progress' : visit.status === 'seen' ? 'Seen' : 'Completed'}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{visit.time}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{visit.doctorName}</span>
          {visit.diagnosis && <span>Diagnosis: {visit.diagnosis}</span>}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {visit.prescription.length > 0 && <Badge variant="outline" className="text-xs bg-purple-50">Prescription ({visit.prescription.length})</Badge>}
          {visit.labTests.length > 0 && <Badge variant="outline" className="text-xs bg-orange-50">Lab ({visit.labTests.length})</Badge>}
          {visit.xrayOrders.length > 0 && <Badge variant="outline" className="text-xs bg-cyan-50">X-Ray ({visit.xrayOrders.length})</Badge>}
          {visit.ultrasoundOrders.length > 0 && <Badge variant="outline" className="text-xs bg-pink-50">Ultrasound ({visit.ultrasoundOrders.length})</Badge>}
          {visit.surgeryOrder && <Badge variant="outline" className="text-xs bg-red-50">Surgery</Badge>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{waitingVisits.length}</p>
                <p className="text-xs text-gray-500">Waiting</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressVisits.length}</p>
                <p className="text-xs text-gray-500">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedVisits.length}</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visit List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Today Patients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {waitingVisits.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-bold text-amber-600 mb-2">Waiting</p>
                      {waitingVisits.map(v => <VisitCard key={v.id} visit={v} />)}
                    </div>
                  )}
                  {inProgressVisits.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-bold text-blue-600 mb-2">In Progress</p>
                      {inProgressVisits.map(v => <VisitCard key={v.id} visit={v} />)}
                    </div>
                  )}
                  {completedVisits.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-emerald-600 mb-2">Completed</p>
                      {completedVisits.map(v => <VisitCard key={v.id} visit={v} />)}
                    </div>
                  )}
                  {todayVisits.length === 0 && <p className="text-gray-500 text-center py-8">No patients today</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Patient Detail */}
          <div className="lg:col-span-2">
            {selectedVisit ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{getPatient(selectedVisit.patientId)?.name}</CardTitle>
                      <p className="text-sm text-gray-500">{selectedVisit.patientNumber} | {selectedVisit.visitNumber}</p>
                    </div>
                    <div className="flex gap-2">
                      {selectedVisit.status === 'waiting' && (
                        <Button size="sm" onClick={() => markAsInProgress(selectedVisit)} className="bg-blue-600 hover:bg-blue-700">
                          Start Treatment
                        </Button>
                      )}
                      {selectedVisit.status === 'in-progress' && (
                        <Button size="sm" onClick={() => markAsSeen(selectedVisit)} className="bg-emerald-600 hover:bg-emerald-700">
                          <CheckCircle className="w-4 h-4 mr-1" /> Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Diagnosis */}
                  <div className="space-y-2">
                    <Label>Diagnosis</Label>
                    <div className="flex gap-2">
                      <Input value={selectedVisit.diagnosis} onChange={e => updateVisit({ ...selectedVisit, diagnosis: e.target.value })} placeholder="Enter diagnosis..." />
                      <Button size="sm" variant="outline" onClick={() => saveDiagnosis(selectedVisit.diagnosis)}>Save</Button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input value={selectedVisit.notes} onChange={e => updateVisit({ ...selectedVisit, notes: e.target.value })} placeholder="Notes..." />
                  </div>

                  {/* Prescription */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-bold flex items-center gap-1">
                        <Stethoscope className="w-4 h-4" /> Prescription
                      </Label>
                      <Button size="sm" variant="outline" onClick={() => setShowPrescription(true)}>
                        <Plus className="w-3 h-3 mr-1" /> Add Medicine
                      </Button>
                    </div>
                    {selectedVisit.prescription.length === 0 ? (
                      <p className="text-sm text-gray-400 border rounded-lg p-3 text-center">Prescription is empty</p>
                    ) : (
                      <div className="border rounded-lg divide-y">
                        {selectedVisit.prescription.map((med, idx) => (
                          <div key={idx} className="p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{med.medicine}</p>
                              <p className="text-xs text-gray-500">{med.dosage} | {med.frequency} | {med.duration}</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => removePrescription(idx)} className="text-red-500 h-8 w-8 p-0">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lab Tests */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-bold flex items-center gap-1">
                        <Beaker className="w-4 h-4" /> Lab Tests
                      </Label>
                      <Button size="sm" variant="outline" onClick={() => setShowLabOrder(true)}>
                        <Plus className="w-3 h-3 mr-1" /> Test
                      </Button>
                    </div>
                    {selectedVisit.labTests.length === 0 ? (
                      <p className="text-sm text-gray-400 border rounded-lg p-3 text-center">No lab tests</p>
                    ) : (
                      <div className="border rounded-lg divide-y">
                        {selectedVisit.labTests.map(test => (
                          <div key={test.id} className="p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{test.testName}</p>
                              <p className="text-xs text-gray-500">Rs. {test.price} | {test.status === 'ordered' ? 'Ordered' : test.status === 'paid' ? 'Paid' : test.status === 'processing' ? 'Processing' : 'Completed'}</p>
                            </div>
                            <Badge variant={test.status === 'completed' ? 'default' : 'outline'} className={test.status === 'completed' ? 'bg-emerald-600' : ''}>
                              {test.status === 'ordered' ? 'Ordered' : test.status === 'paid' ? 'Paid' : test.status === 'processing' ? 'Processing' : 'Completed'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* X-Ray */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-bold flex items-center gap-1">
                        <ScanLine className="w-4 h-4" /> X-Ray
                      </Label>
                      <Button size="sm" variant="outline" onClick={() => setShowXrayOrder(true)}>
                        <Plus className="w-3 h-3 mr-1" /> Order
                      </Button>
                    </div>
                    {selectedVisit.xrayOrders.length === 0 ? (
                      <p className="text-sm text-gray-400 border rounded-lg p-3 text-center">No X-Ray orders</p>
                    ) : (
                      <div className="border rounded-lg divide-y">
                        {selectedVisit.xrayOrders.map(x => (
                          <div key={x.id} className="p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{x.testName}</p>
                              <p className="text-xs text-gray-500">Rs. {x.price}</p>
                            </div>
                            <Badge variant={x.status === 'completed' ? 'default' : 'outline'} className={x.status === 'completed' ? 'bg-emerald-600' : ''}>
                              {x.status === 'ordered' ? 'Ordered' : x.status === 'paid' ? 'Paid' : x.status === 'processing' ? 'Processing' : 'Completed'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ultrasound */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-bold flex items-center gap-1">
                        <Activity className="w-4 h-4" /> Ultrasound
                      </Label>
                      <Button size="sm" variant="outline" onClick={() => setShowUltrasoundOrder(true)}>
                        <Plus className="w-3 h-3 mr-1" /> Order
                      </Button>
                    </div>
                    {selectedVisit.ultrasoundOrders.length === 0 ? (
                      <p className="text-sm text-gray-400 border rounded-lg p-3 text-center">No Ultrasound orders</p>
                    ) : (
                      <div className="border rounded-lg divide-y">
                        {selectedVisit.ultrasoundOrders.map(u => (
                          <div key={u.id} className="p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{u.testName}</p>
                              <p className="text-xs text-gray-500">Rs. {u.price}</p>
                            </div>
                            <Badge variant={u.status === 'completed' ? 'default' : 'outline'} className={u.status === 'completed' ? 'bg-emerald-600' : ''}>
                              {u.status === 'ordered' ? 'Ordered' : u.status === 'paid' ? 'Paid' : u.status === 'processing' ? 'Processing' : 'Completed'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Surgery */}
                  {selectedVisit.surgeryOrder && (
                    <div className="space-y-2">
                      <Label className="text-base font-bold flex items-center gap-1">
                        <Scissors className="w-4 h-4" /> Surgery
                      </Label>
                      <div className="border rounded-lg p-4 bg-red-50">
                        <p className="font-bold">{selectedVisit.surgeryOrder.surgeryType}</p>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                          <div><span className="text-gray-500">Total:</span> Rs. {selectedVisit.surgeryOrder.totalCost.toLocaleString()}</div>
                          <div><span className="text-gray-500">Paid:</span> <span className="text-emerald-600 font-bold">Rs. {selectedVisit.surgeryOrder.amountPaid.toLocaleString()}</span></div>
                          <div><span className="text-gray-500">Balance:</span> <span className="text-red-600 font-bold">Rs. {selectedVisit.surgeryOrder.balance.toLocaleString()}</span></div>
                        </div>
                        <Badge variant="outline" className="mt-2">
                          {selectedVisit.surgeryOrder.status === 'scheduled' ? 'Scheduled' : selectedVisit.surgeryOrder.status === 'in-progress' ? 'In Progress' : 'Completed'}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {!selectedVisit.surgeryOrder && (
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => setShowSurgeryOrder(true)} className="text-red-600 border-red-300">
                        <Scissors className="w-3 h-3 mr-1" /> Surgery Order
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center text-gray-400">
                  <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Select a patient</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* DIALOGS */}
        {/* Prescription Dialog */}
        <Dialog open={showPrescription} onOpenChange={setShowPrescription}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Medicine</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Medicine Name</Label><Input value={rxForm.medicine} onChange={e => setRxForm({ ...rxForm, medicine: e.target.value })} placeholder="Panadol" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2"><Label>Dosage</Label><Input value={rxForm.dosage} onChange={e => setRxForm({ ...rxForm, dosage: e.target.value })} placeholder="500mg" /></div>
                <div className="space-y-2"><Label>Frequency</Label><Input value={rxForm.frequency} onChange={e => setRxForm({ ...rxForm, frequency: e.target.value })} placeholder="3 times a day" /></div>
                <div className="space-y-2"><Label>Duration</Label><Input value={rxForm.duration} onChange={e => setRxForm({ ...rxForm, duration: e.target.value })} placeholder="5 days" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPrescription(false)}>Cancel</Button>
              <Button onClick={addPrescription} className="bg-emerald-600 hover:bg-emerald-700">Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lab Order Dialog */}
        <Dialog open={showLabOrder} onOpenChange={setShowLabOrder}>
          <DialogContent>
            <DialogHeader><DialogTitle>Lab Test Order</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Test Name</Label><Input value={labForm.testName} onChange={e => setLabForm({ ...labForm, testName: e.target.value })} placeholder="CBC" /></div>
              <div className="space-y-2"><Label>Price (Rs.)</Label><Input type="number" value={labForm.price} onChange={e => setLabForm({ ...labForm, price: e.target.value })} placeholder="500" dir="ltr" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLabOrder(false)}>Cancel</Button>
              <Button onClick={addLabTest} className="bg-orange-600 hover:bg-orange-700">Order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* X-Ray Order Dialog */}
        <Dialog open={showXrayOrder} onOpenChange={setShowXrayOrder}>
          <DialogContent>
            <DialogHeader><DialogTitle>X-Ray Order</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>X-Ray Type</Label><Input value={xrayForm.testName} onChange={e => setXrayForm({ ...xrayForm, testName: e.target.value })} placeholder="Chest X-Ray" /></div>
              <div className="space-y-2"><Label>Price (Rs.)</Label><Input type="number" value={xrayForm.price} onChange={e => setXrayForm({ ...xrayForm, price: e.target.value })} placeholder="800" dir="ltr" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowXrayOrder(false)}>Cancel</Button>
              <Button onClick={addXray} className="bg-cyan-600 hover:bg-cyan-700">Order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ultrasound Order Dialog */}
        <Dialog open={showUltrasoundOrder} onOpenChange={setShowUltrasoundOrder}>
          <DialogContent>
            <DialogHeader><DialogTitle>Ultrasound Order</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Ultrasound Type</Label><Input value={usForm.testName} onChange={e => setUsForm({ ...usForm, testName: e.target.value })} placeholder="Abdomen Ultrasound" /></div>
              <div className="space-y-2"><Label>Price (Rs.)</Label><Input type="number" value={usForm.price} onChange={e => setUsForm({ ...usForm, price: e.target.value })} placeholder="2000" dir="ltr" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUltrasoundOrder(false)}>Cancel</Button>
              <Button onClick={addUltrasound} className="bg-pink-600 hover:bg-pink-700">Order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Surgery Order Dialog */}
        <Dialog open={showSurgeryOrder} onOpenChange={setShowSurgeryOrder}>
          <DialogContent>
            <DialogHeader><DialogTitle>Surgery Order</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Surgery Type</Label><Input value={surgForm.surgeryType} onChange={e => setSurgForm({ ...surgForm, surgeryType: e.target.value })} placeholder="Appendectomy" /></div>
              <div className="space-y-2"><Label>Estimated Cost (Rs.)</Label><Input type="number" value={surgForm.totalCost} onChange={e => setSurgForm({ ...surgForm, totalCost: e.target.value })} placeholder="50000" dir="ltr" /></div>
              <div className="space-y-2"><Label>Notes</Label><Input value={surgForm.notes} onChange={e => setSurgForm({ ...surgForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSurgeryOrder(false)}>Cancel</Button>
              <Button onClick={addSurgery} className="bg-red-600 hover:bg-red-700">Surgery Order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
