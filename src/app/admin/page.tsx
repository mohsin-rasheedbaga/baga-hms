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
    toast.success(`Rs. ${amount} ادا ہوئے - بیلنس: Rs. ${Math.max(0, newBalance)}`);
  };

  const markSurgeryStatus = (visitId: string, status: 'scheduled' | 'in-progress' | 'completed') => {
    const visit = data.visits.find(v => v.id === visitId);
    if (!visit || !visit.surgeryOrder) return;
    const updatedVisit = { ...visit, surgeryOrder: { ...visit.surgeryOrder, status } };
    const updated = { ...data, visits: data.visits.map(v => v.id === visitId ? updatedVisit : v) };
    saveData(updated);
    setData(updated);
    toast.success('سرجری کی حالت تبدیل');
  };

  const getPatient = (pid: string) => data.patients.find(p => p.id === pid);

  const resetDemoData = () => {
    if (confirm('تمام ڈیمو ڈیٹا ری سیٹ کریں؟')) {
      localStorage.removeItem('baga_hms_data');
      refreshData();
      toast.success('ڈیٹا ری سیٹ ہو گیا');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="dashboard"><TrendingUp className="w-4 h-4 mr-1" /> ڈیش بورڈ</TabsTrigger>
              <TabsTrigger value="surgeries"><Scissors className="w-4 h-4 mr-1" /> سرجری</TabsTrigger>
              <TabsTrigger value="pending"><AlertTriangle className="w-4 h-4 mr-1" /> زیر التوا</TabsTrigger>
              <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" /> سیٹنگز</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refreshData}><RefreshCw className="w-4 h-4 mr-1" /> ریفریش</Button>
              <Button variant="destructive" size="sm" onClick={resetDemoData}>ری سیٹ</Button>
            </div>
          </div>

          {/* DASHBOARD */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card><CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
                <div><p className="text-2xl font-bold">{data.patients.length}</p><p className="text-xs text-gray-500">کل مریض</p></div>
              </CardContent></Card>
              <Card><CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center"><CalendarDays className="w-5 h-5 text-emerald-600" /></div>
                <div><p className="text-2xl font-bold">{todayVisits.length}</p><p className="text-xs text-gray-500">آج کے وزیٹ</p></div>
              </CardContent></Card>
              <Card><CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><CreditCard className="w-5 h-5 text-amber-600" /></div>
                <div><p className="text-2xl font-bold">Rs. {(totalRevenue + labRevenue + xrayRevenue + usRevenue + surgeryRevenue).toLocaleString()}</p><p className="text-xs text-gray-500">کل آمدنی</p></div>
              </CardContent></Card>
              <Card><CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <div><p className="text-2xl font-bold">{pendingLabPayments.length + pendingXrayPayments.length + pendingUsPayments.length}</p><p className="text-xs text-gray-500">زیر التوا ادائیگیاں</p></div>
              </CardContent></Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">آمدنی تفصیل</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1"><Pill className="w-4 h-4 text-purple-500" /> فارمیسی</span><span className="font-bold">Rs. {totalRevenue.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1"><Beaker className="w-4 h-4 text-orange-500" /> لیب</span><span className="font-bold">Rs. {labRevenue.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1"><Activity className="w-4 h-4 text-cyan-500" /> ایکس ری</span><span className="font-bold">Rs. {xrayRevenue.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1"><Activity className="w-4 h-4 text-pink-500" /> الٹراساؤنڈ</span><span className="font-bold">Rs. {usRevenue.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1"><Scissors className="w-4 h-4 text-red-500" /> سرجری</span><span className="font-bold">Rs. {surgeryRevenue.toLocaleString()}</span></div>
                </CardContent>
              </Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">آج کے مریض</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {todayVisits.length === 0 ? <p className="text-sm text-gray-500">آج کوئی وزیٹ نہیں</p> :
                      todayVisits.map(v => (
                        <div key={v.id} className="flex items-center justify-between text-sm border-b pb-2">
                          <div>
                            <p className="font-medium">{getPatient(v.patientId)?.name}</p>
                            <p className="text-xs text-gray-500">{v.patientNumber} | {v.doctorName}</p>
                          </div>
                          <Badge variant={v.status === 'waiting' ? 'outline' : 'default'} className={v.status === 'waiting' ? 'border-amber-400 text-amber-700' : v.status === 'completed' || v.status === 'seen' ? 'bg-emerald-600' : 'bg-blue-600'}>
                            {v.status === 'waiting' ? 'انتظار' : v.status === 'in-progress' ? 'جاری' : v.status === 'seen' ? 'دیکھا' : 'مکمل'}
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
              <CardHeader><CardTitle className="text-lg">سرجریز</CardTitle></CardHeader>
              <CardContent>
                {surgeries.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">کوئی سرجری نہیں</p>
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
                              {s.status === 'scheduled' ? 'شیڈولڈ' : s.status === 'in-progress' ? 'جاری' : 'مکمل'}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-lg p-3 text-sm mb-3">
                          <div><span className="text-gray-500">کل:</span> <span className="font-bold">Rs. {s.totalCost.toLocaleString()}</span></div>
                          <div><span className="text-gray-500">ادا:</span> <span className="font-bold text-emerald-600">Rs. {s.amountPaid.toLocaleString()}</span></div>
                          <div><span className="text-gray-500">بیلنس:</span> <span className="font-bold text-red-600">Rs. {s.balance.toLocaleString()}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {s.status === 'scheduled' && <Button size="sm" onClick={() => markSurgeryStatus(s.visitId, 'in-progress')} className="bg-blue-600 hover:bg-blue-700">شروع کریں</Button>}
                          {s.status === 'in-progress' && <Button size="sm" onClick={() => markSurgeryStatus(s.visitId, 'completed')} className="bg-emerald-600 hover:bg-emerald-700">مکمل</Button>}
                          {s.balance > 0 && (
                            <Button size="sm" variant="outline" onClick={() => { setSelectedSurgery({ visitId: s.visitId, patientName: s.patientName, patientNumber: s.patientNumber }); setSurgeryPayAmount(''); setShowSurgeryPayment(true); }}>
                              <CreditCard className="w-3 h-3 mr-1" /> ادائیگی
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
              <CardHeader><CardTitle className="text-lg">ریسپشن میں زیر التوا ادائیگیاں</CardTitle></CardHeader>
              <CardContent>
                {pendingLabPayments.length + pendingXrayPayments.length + pendingUsPayments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">تمام ادائیگیاں ہو چکی ہیں</p>
                ) : (
                  <div className="space-y-2">
                    {pendingLabPayments.map(o => {
                      const visit = data.visits.find(v => v.labTests.some(lt => lt.id === o.id));
                      const patient = visit ? getPatient(visit.patientId) : null;
                      return (
                        <div key={o.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 flex items-center justify-between">
                          <div><p className="font-medium">{patient?.name}</p><p className="text-xs">لیب: {o.testName} | Rs. {o.price}</p></div>
                          <Badge variant="outline" className="border-amber-400 text-amber-700">ادائیگی زائد</Badge>
                        </div>
                      );
                    })}
                    {pendingXrayPayments.map(o => {
                      const visit = data.visits.find(v => v.xrayOrders.some(x => x.id === o.id));
                      const patient = visit ? getPatient(visit.patientId) : null;
                      return (
                        <div key={o.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 flex items-center justify-between">
                          <div><p className="font-medium">{patient?.name}</p><p className="text-xs">ایکس ری: {o.testName} | Rs. {o.price}</p></div>
                          <Badge variant="outline" className="border-amber-400 text-amber-700">ادائیگی زائد</Badge>
                        </div>
                      );
                    })}
                    {pendingUsPayments.map(o => {
                      const visit = data.visits.find(v => v.ultrasoundOrders.some(u => u.id === o.id));
                      const patient = visit ? getPatient(visit.patientId) : null;
                      return (
                        <div key={o.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 flex items-center justify-between">
                          <div><p className="font-medium">{patient?.name}</p><p className="text-xs">الٹراساؤنڈ: {o.testName} | Rs. {o.price}</p></div>
                          <Badge variant="outline" className="border-amber-400 text-amber-700">ادائیگی زائد</Badge>
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
              <CardHeader><CardTitle className="text-lg">سیٹنگز</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>ہسپتال کا نام</Label>
                  <Input value={data.settings.hospitalName} onChange={e => updateSetting('hospitalName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>پتہ</Label>
                  <Input value={data.settings.hospitalAddress} onChange={e => updateSetting('hospitalAddress', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>فون</Label>
                  <Input value={data.settings.hospitalPhone} onChange={e => updateSetting('hospitalPhone', e.target.value)} dir="ltr" />
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-bold">ادائیگی کی جگہ</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">فارمیسی ادائیگی</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">ریسپشن</span>
                        <Switch checked={data.settings.pharmacyPaymentLocation === 'pharmacy'} onCheckedChange={v => updateSetting('pharmacyPaymentLocation', v ? 'pharmacy' : 'reception')} />
                        <span className="text-xs font-medium">فارمیسی</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">لیب ادائیگی</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">ریسپشن</span>
                        <Switch checked={data.settings.labPaymentLocation === 'lab'} onCheckedChange={v => updateSetting('labPaymentLocation', v ? 'lab' : 'reception')} />
                        <span className="text-xs font-medium">لیب</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">ایکس ری ادائیگی</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">ریسپشن</span>
                        <Switch checked={data.settings.xrayPaymentLocation === 'xray'} onCheckedChange={v => updateSetting('xrayPaymentLocation', v ? 'xray' : 'reception')} />
                        <span className="text-xs font-medium">ایکس ری</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">الٹراساؤنڈ ادائیگی</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">ریسپشن</span>
                        <Switch checked={data.settings.ultrasoundPaymentLocation === 'ultrasound'} onCheckedChange={v => updateSetting('ultrasoundPaymentLocation', v ? 'ultrasound' : 'reception')} />
                        <span className="text-xs font-medium">الٹراساؤنڈ</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">سرجری ادائیگی</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">ریسپشن</span>
                        <Switch checked={data.settings.surgeryPaymentLocation === 'surgery'} onCheckedChange={v => updateSetting('surgeryPaymentLocation', v ? 'surgery' : 'reception')} />
                        <span className="text-xs text-gray-500">سرجری</span>
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
            <DialogHeader><DialogTitle>سرجری ادائیگی - {selectedSurgery?.patientName}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Label>رقم (Rs.)</Label>
              <Input type="number" value={surgeryPayAmount} onChange={e => setSurgeryPayAmount(e.target.value)} placeholder="ادائیگی کی رقم" dir="ltr" />
              <p className="text-xs text-gray-500">جزوی ادائیگی بھی کرسکتے ہیں</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSurgeryPayment(false)}>منسوخ</Button>
              <Button onClick={collectSurgeryPayment} className="bg-emerald-600 hover:bg-emerald-700">ادائیگی کریں</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
