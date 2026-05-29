'use client';

import { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { HMSData, SurgeryOrder } from '@/lib/types';
import { loadData, saveData } from '@/lib/data';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Users, CalendarDays, CreditCard, Settings, Scissors,
  TrendingUp, AlertTriangle, RefreshCw, Pill, Beaker, Activity, ScanLine
} from 'lucide-react';

export default function AdminPage() {
  const [data, setData] = useState<HMSData | null>(null);
  const [showSurgeryPayment, setShowSurgeryPayment] = useState(false);
  const [selectedSurgery, setSelectedSurgery] = useState<{ visitId: string; patientName: string; patientNumber: string } | null>(null);
  const [surgeryPayAmount, setSurgeryPayAmount] = useState('');

  const refreshData = useCallback(() => { setData(loadData()); }, []);
  useEffect(() => { refreshData(); }, [refreshData]);

  if (!data) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayVisits = data.visits.filter(v => v.date === today);

  // Stats
  const totalRevenue = data.pharmacyBills.filter(b => b.status !== 'pending').reduce((s, b) => s + b.totalAmount, 0);
  const allLabOrders = data.visits.flatMap(v => v.labTests);
  const allXrayOrders = data.visits.flatMap(v => v.xrayOrders);
  const allUsOrders = data.visits.flatMap(v => v.ultrasoundOrders);
  const labRevenue = allLabOrders.filter(o => o.status === 'completed').reduce((s, o) => s + o.price, 0);
  const xrayRevenue = allXrayOrders.filter(o => o.status === 'completed').reduce((s, o) => s + o.price, 0);
  const usRevenue = allUsOrders.filter(o => o.status === 'completed').reduce((s, o) => s + o.price, 0);
  const surgeryRevenue = data.visits.filter(v => v.surgeryOrder).reduce((s, v) => s + (v.surgeryOrder?.amountPaid || 0), 0);

  // Pending payments
  const pendingLabPayments = allLabOrders.filter(o => o.status === 'ordered' && o.paymentLocation === 'reception');
  const pendingXrayPayments = allXrayOrders.filter(o => o.status === 'ordered' && o.paymentLocation === 'reception');
  const pendingUsPayments = allUsOrders.filter(o => o.status === 'ordered' && o.paymentLocation === 'reception');

  // Surgeries
  const surgeries = data.visits.filter(v => v.surgeryOrder).map(v => ({
    ...v.surgeryOrder!,
    visitId: v.id,
    patientName: data.patients.find(p => p.id === v.patientId)?.name || 'Unknown',
    patientNumber: v.patientNumber,
    diagnosis: v.diagnosis,
  }));

  // Settings handlers
  const updateSetting = <K extends keyof HMSData['settings']>(key: K, value: HMSData['settings'][K]) => {
    const updated = { ...data, settings: { ...data.settings, [key]: value } };
    saveData(updated);
    setData(updated);
  };

  const collectSurgeryPayment = () => {
    if (!selectedSurgery) return;
    const amount = parseInt(surgeryPayAmount) || 0;
    const visit = data.visits.find(v => v.id === selectedSurgery.visitId);
    if (!visit || !visit.surgeryOrder) return;

    const newPaid = visit.surgeryOrder.amountPaid + amount;
    const newBalance = visit.surgeryOrder.totalCost - newPaid;
    const updatedVisit = {
      ...visit,
      surgeryOrder: {
        ...visit.surgeryOrder,
        amountPaid: newPaid,
        balance: Math.max(0, newBalance),
      },
    };
    const updated = { ...data, visits: data.visits.map(v => v.id === visit.id ? updatedVisit : v) };
    saveData(updated);
    setData(updated);
    setShowSurgeryPayment(false);
    toast.success(`Rs. ${amount} paid - Balance: Rs. ${Math.max(0, newBalance)}`);
  };

  const markSurgeryStatus = (visitId: string, status: 'scheduled' | 'in-progress' | 'completed') => {
    const visit = data.visits.find(v => v.id === visitId);
    if (!visit || !visit.surgeryOrder) return;
    const updatedVisit = { ...visit, surgeryOrder: { ...visit.surgeryOrder, status } };
    const updated = { ...data, visits: data.visits.map(v => v.id === visitId ? updatedVisit : v) };
    saveData(updated);
    setData(updated);
    toast.success('Surgery status changed');
  };

  const getPatient = (pid: string) => data.patients.find(p => p.id === pid);

  const resetDemoData = () => {
    if (confirm('Reset all demo data?')) {
      localStorage.removeItem('baga_hms_data');
      refreshData();
      toast.success('Data has been reset');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="dashboard"><TrendingUp className="w-4 h-4 mr-1" /> Dashboard</TabsTrigger>
              <TabsTrigger value="surgeries"><Scissors className="w-4 h-4 mr-1" /> Surgery</TabsTrigger>
              <TabsTrigger value="pending"><AlertTriangle className="w-4 h-4 mr-1" /> Pending</TabsTrigger>
              <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" /> Settings</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refreshData}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
              <Button variant="destructive" size="sm" onClick={resetDemoData}>Reset</Button>
            </div>
          </div>

          {/* DASHBOARD */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card><CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
                <div><p className="text-2xl font-bold">{data.patients.length}</p><p className="text-xs text-gray-500">Total Patients</p></div>
              </CardContent></Card>
              <Card><CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center"><CalendarDays className="w-5 h-5 text-emerald-600" /></div>
                <div><p className="text-2xl font-bold">{todayVisits.length}</p><p className="text-xs text-gray-500">Today Visits</p></div>
              </CardContent></Card>
              <Card><CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><CreditCard className="w-5 h-5 text-amber-600" /></div>
                <div><p className="text-2xl font-bold">Rs. {(totalRevenue + labRevenue + xrayRevenue + usRevenue + surgeryRevenue).toLocaleString()}</p><p className="text-xs text-gray-500">Total Revenue</p></div>
              </CardContent></Card>
              <Card><CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <div><p className="text-2xl font-bold">{pendingLabPayments.length + pendingXrayPayments.length + pendingUsPayments.length}</p><p className="text-xs text-gray-500">Pending Payments</p></div>
              </CardContent></Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1"><Pill className="w-4 h-4 text-purple-500" /> Pharmacy</span><span className="font-bold">Rs. {totalRevenue.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1"><Beaker className="w-4 h-4 text-orange-500" /> Lab</span><span className="font-bold">Rs. {labRevenue.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1"><Activity className="w-4 h-4 text-cyan-500" /> X-Ray</span><span className="font-bold">Rs. {xrayRevenue.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1"><Activity className="w-4 h-4 text-pink-500" /> Ultrasound</span><span className="font-bold">Rs. {usRevenue.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1"><Scissors className="w-4 h-4 text-red-500" /> Surgery</span><span className="font-bold">Rs. {surgeryRevenue.toLocaleString()}</span></div>
                </CardContent>
              </Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Today Patients</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {todayVisits.length === 0 ? <p className="text-sm text-gray-500">No visits today</p> :
                      todayVisits.map(v => (
                        <div key={v.id} className="flex items-center justify-between text-sm border-b pb-2">
                          <div>
                            <p className="font-medium">{getPatient(v.patientId)?.name}</p>
                            <p className="text-xs text-gray-500">{v.patientNumber} | {v.doctorName}</p>
                          </div>
                          <Badge variant={v.status === 'waiting' ? 'outline' : 'default'} className={v.status === 'waiting' ? 'border-amber-400 text-amber-700' : v.status === 'completed' || v.status === 'seen' ? 'bg-emerald-600' : 'bg-blue-600'}>
                            {v.status === 'waiting' ? 'Waiting' : v.status === 'in-progress' ? 'In Progress' : v.status === 'seen' ? 'Seen' : 'Completed'}
                          </Badge>
                        </div>
                      ))
                    }
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* SURGERIES */}
          <TabsContent value="surgeries">
            <Card>
              <CardHeader><CardTitle className="text-lg">Surgeries</CardTitle></CardHeader>
              <CardContent>
                {surgeries.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No surgeries</p>
                ) : (
                  <div className="space-y-3">
                    {surgeries.map(s => (
                      <div key={s.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-bold">{s.patientName} - {s.surgeryType}</p>
                            <p className="text-xs text-gray-500">{s.patientNumber} | {s.diagnosis}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={s.status === 'scheduled' ? 'outline' : s.status === 'in-progress' ? 'default' : 'secondary'}
                              className={s.status === 'in-progress' ? 'bg-blue-600' : s.status === 'completed' ? 'bg-emerald-600' : ''}>
                              {s.status === 'scheduled' ? 'Scheduled' : s.status === 'in-progress' ? 'In Progress' : 'Completed'}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-lg p-3 text-sm mb-3">
                          <div><span className="text-gray-500">Total:</span> <span className="font-bold">Rs. {s.totalCost.toLocaleString()}</span></div>
                          <div><span className="text-gray-500">Paid:</span> <span className="font-bold text-emerald-600">Rs. {s.amountPaid.toLocaleString()}</span></div>
                          <div><span className="text-gray-500">Balance:</span> <span className="font-bold text-red-600">Rs. {s.balance.toLocaleString()}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {s.status === 'scheduled' && <Button size="sm" onClick={() => markSurgeryStatus(s.visitId, 'in-progress')} className="bg-blue-600 hover:bg-blue-700">Start</Button>}
                          {s.status === 'in-progress' && <Button size="sm" onClick={() => markSurgeryStatus(s.visitId, 'completed')} className="bg-emerald-600 hover:bg-emerald-700">Complete</Button>}
                          {s.balance > 0 && (
                            <Button size="sm" variant="outline" onClick={() => { setSelectedSurgery({ visitId: s.visitId, patientName: s.patientName, patientNumber: s.patientNumber }); setSurgeryPayAmount(''); setShowSurgeryPayment(true); }}>
                              <CreditCard className="w-3 h-3 mr-1" /> Payment
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PENDING PAYMENTS */}
          <TabsContent value="pending">
            <Card>
              <CardHeader><CardTitle className="text-lg">Pending Payments at Reception</CardTitle></CardHeader>
              <CardContent>
                {pendingLabPayments.length + pendingXrayPayments.length + pendingUsPayments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">All payments completed</p>
                ) : (
                  <div className="space-y-2">
                    {pendingLabPayments.map(o => {
                      const visit = data.visits.find(v => v.labTests.some(lt => lt.id === o.id));
                      const patient = visit ? getPatient(visit.patientId) : null;
                      return (
                        <div key={o.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 flex items-center justify-between">
                          <div><p className="font-medium">{patient?.name}</p><p className="text-xs">Lab: {o.testName} | Rs. {o.price}</p></div>
                          <Badge variant="outline" className="border-amber-400 text-amber-700">Payment Overdue</Badge>
                        </div>
                      );
                    })}
                    {pendingXrayPayments.map(o => {
                      const visit = data.visits.find(v => v.xrayOrders.some(x => x.id === o.id));
                      const patient = visit ? getPatient(visit.patientId) : null;
                      return (
                        <div key={o.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 flex items-center justify-between">
                          <div><p className="font-medium">{patient?.name}</p><p className="text-xs">X-Ray: {o.testName} | Rs. {o.price}</p></div>
                          <Badge variant="outline" className="border-amber-400 text-amber-700">Payment Overdue</Badge>
                        </div>
                      );
                    })}
                    {pendingUsPayments.map(o => {
                      const visit = data.visits.find(v => v.ultrasoundOrders.some(u => u.id === o.id));
                      const patient = visit ? getPatient(visit.patientId) : null;
                      return (
                        <div key={o.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 flex items-center justify-between">
                          <div><p className="font-medium">{patient?.name}</p><p className="text-xs">Ultrasound: {o.testName} | Rs. {o.price}</p></div>
                          <Badge variant="outline" className="border-amber-400 text-amber-700">Payment Overdue</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings">
            <Card>
              <CardHeader><CardTitle className="text-lg">Settings</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Hospital Name</Label>
                  <Input value={data.settings.hospitalName} onChange={e => updateSetting('hospitalName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={data.settings.hospitalAddress} onChange={e => updateSetting('hospitalAddress', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={data.settings.hospitalPhone} onChange={e => updateSetting('hospitalPhone', e.target.value)} dir="ltr" />
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-bold">Payment Location</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Pharmacy Payment</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Reception</span>
                        <Switch checked={data.settings.pharmacyPaymentLocation === 'pharmacy'} onCheckedChange={v => updateSetting('pharmacyPaymentLocation', v ? 'pharmacy' : 'reception')} />
                        <span className="text-xs font-medium">Pharmacy</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Lab Payment</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Reception</span>
                        <Switch checked={data.settings.labPaymentLocation === 'lab'} onCheckedChange={v => updateSetting('labPaymentLocation', v ? 'lab' : 'reception')} />
                        <span className="text-xs font-medium">Lab</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">X-Ray Payment</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Reception</span>
                        <Switch checked={data.settings.xrayPaymentLocation === 'xray'} onCheckedChange={v => updateSetting('xrayPaymentLocation', v ? 'xray' : 'reception')} />
                        <span className="text-xs font-medium">X-Ray</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Ultrasound Payment</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Reception</span>
                        <Switch checked={data.settings.ultrasoundPaymentLocation === 'ultrasound'} onCheckedChange={v => updateSetting('ultrasoundPaymentLocation', v ? 'ultrasound' : 'reception')} />
                        <span className="text-xs font-medium">Ultrasound</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Surgery Payment</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">Reception</span>
                        <Switch checked={data.settings.surgeryPaymentLocation === 'surgery'} onCheckedChange={v => updateSetting('surgeryPaymentLocation', v ? 'surgery' : 'reception')} />
                        <span className="text-xs text-gray-500">Surgery</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Surgery Payment Dialog */}
        <Dialog open={showSurgeryPayment} onOpenChange={setShowSurgeryPayment}>
          <DialogContent>
            <DialogHeader><DialogTitle>Surgery Payment - {selectedSurgery?.patientName}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Label>Amount (Rs.)</Label>
              <Input type="number" value={surgeryPayAmount} onChange={e => setSurgeryPayAmount(e.target.value)} placeholder="Payment Amount" dir="ltr" />
              <p className="text-xs text-gray-500">Partial payments are also accepted</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSurgeryPayment(false)}>Cancel</Button>
              <Button onClick={collectSurgeryPayment} className="bg-emerald-600 hover:bg-emerald-700">Pay</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
