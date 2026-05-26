'use client';

import { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { HMSData, Visit, UltrasoundOrder } from '@/lib/types';
import { loadData, saveData } from '@/lib/data';
import { toast } from 'sonner';
import { Activity, CreditCard, Clock, CheckCircle, Lock } from 'lucide-react';

export default function UltrasoundPage() {
  const [data, setData] = useState<HMSData | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<{ visit: Visit; order: UltrasoundOrder } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultText, setResultText] = useState('');

  const refreshData = useCallback(() => { setData(loadData()); }, []);
  useEffect(() => { refreshData(); }, [refreshData]);

  if (!data) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const collectHere = data.settings.ultrasoundPaymentLocation === 'ultrasound';
  const getPatient = (pid: string) => data.patients.find(p => p.id === pid);

  const allOrders: { visit: Visit; order: UltrasoundOrder }[] = [];
  data.visits.forEach(visit => { visit.ultrasoundOrders.forEach(o => allOrders.push({ visit, order: o })); });

  const collectPayment = () => {
    if (!selectedOrder) return;
    const uv = { ...selectedOrder.visit, ultrasoundOrders: selectedOrder.visit.ultrasoundOrders.map(o => o.id === selectedOrder.order.id ? { ...o, status: 'paid' as const, paidAt: new Date().toISOString() } : o) };
    const updated = { ...data, visits: data.visits.map(v => v.id === uv.id ? uv : v) };
    saveData(updated); setData(updated);
    setSelectedOrder({ visit: uv, order: { ...selectedOrder.order, status: 'paid', paidAt: new Date().toISOString() } });
    setShowPayment(false);
    toast.success('ادائیگی ہو گئی');
  };

  const completeTest = () => {
    if (!selectedOrder) return;
    const uv = { ...selectedOrder.visit, ultrasoundOrders: selectedOrder.visit.ultrasoundOrders.map(o => o.id === selectedOrder.order.id ? { ...o, status: 'completed' as const, result: resultText, completedAt: new Date().toISOString() } : o) };
    const updated = { ...data, visits: data.visits.map(v => v.id === uv.id ? uv : v) };
    saveData(updated); setData(updated);
    setSelectedOrder({ visit: uv, order: { ...selectedOrder.order, status: 'completed', result: resultText } });
    setShowResult(false);
    toast.success('الٹراساؤنڈ مکمل');
  };

  const togglePaymentLocation = (val: boolean) => {
    const loc = val ? 'ultrasound' as const : 'reception' as const;
    const updated = { ...data, settings: { ...data.settings, ultrasoundPaymentLocation: loc } };
    saveData(updated); setData(updated);
    toast.success(`ادائیگی: ${val ? 'الٹراساؤنڈ' : 'ریسپشن'}`);
  };

  const isBlocked = (order: UltrasoundOrder) => order.status === 'ordered' && order.paymentLocation === 'reception';

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{allOrders.filter(o => o.order.status === 'ordered').length}</p><p className="text-xs text-gray-500">آرڈرڈ</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center"><CreditCard className="w-5 h-5 text-emerald-600" /></div><div><p className="text-2xl font-bold">{allOrders.filter(o => o.order.status === 'paid').length}</p><p className="text-xs text-gray-500">ادا شدہ</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-pink-600" /></div><div><p className="text-2xl font-bold">{allOrders.filter(o => o.order.status === 'completed').length}</p><p className="text-xs text-gray-500">مکمل</p></div></CardContent></Card>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <p className="font-medium text-sm">ادائیگی کی جگہ</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">ریسپشن</span>
              <Switch checked={collectHere} onCheckedChange={togglePaymentLocation} />
              <span className="text-sm font-medium">الٹراساؤنڈ</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">الٹراساؤنڈ آرڈرز</CardTitle></CardHeader>
          <CardContent>
            {allOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">کوئی آرڈر نہیں</p>
            ) : (
              <div className="space-y-2">
                {allOrders.map(({ visit, order }) => {
                  const patient = getPatient(visit.patientId);
                  const bl = isBlocked(order);
                  return (
                    <div key={order.id} className={`border rounded-lg p-4 flex items-center justify-between ${bl ? 'bg-amber-50 border-amber-200' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bl ? 'bg-amber-100' : 'bg-pink-100'}`}>
                          {bl ? <Lock className="w-5 h-5 text-amber-600" /> : <Activity className="w-5 h-5 text-pink-600" />}
                        </div>
                        <div>
                          <p className="font-bold">{patient?.name}</p>
                          <p className="text-xs text-gray-500">{visit.patientNumber} | {order.testName} | Rs. {order.price}</p>
                          {bl && <p className="text-xs text-amber-600 mt-1">ریسپشن سے ادائیگی کا انتظار</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={order.status === 'completed' ? 'default' : 'outline'} className={order.status === 'completed' ? 'bg-emerald-600' : ''}>
                          {order.status === 'ordered' ? 'آرڈرڈ' : order.status === 'paid' ? 'ادا شدہ' : 'مکمل'}
                        </Badge>
                        {!bl && <Button size="sm" variant="outline" onClick={() => setSelectedOrder({ visit, order })}>دیکھیں</Button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedOrder} onOpenChange={open => { if (!open) setSelectedOrder(null); }}>
          <DialogContent className="max-w-lg">
            {selectedOrder && (
              <>
                <DialogHeader><DialogTitle>{selectedOrder.order.testName}</DialogTitle></DialogHeader>
                <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                  <p>مریض: {getPatient(selectedOrder.visit.patientId)?.name}</p>
                  <p>قیمت: Rs. {selectedOrder.order.price}</p>
                </div>
                {selectedOrder.order.result && <div className="bg-emerald-50 rounded-lg p-4 text-sm">{selectedOrder.order.result}</div>}
                <DialogFooter>
                  {selectedOrder.order.status === 'ordered' && collectHere && <Button onClick={() => setShowPayment(true)} className="bg-emerald-600 hover:bg-emerald-700"><CreditCard className="w-4 h-4 mr-1" /> ادائیگی</Button>}
                  {selectedOrder.order.status === 'paid' && <Button onClick={() => { setResultText(selectedOrder.order.result); setShowResult(true); }} className="bg-pink-600 hover:bg-pink-700"><Activity className="w-4 h-4 mr-1" /> نتائج</Button>}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showPayment} onOpenChange={setShowPayment}>
          <DialogContent>
            <DialogHeader><DialogTitle>ادائیگی</DialogTitle></DialogHeader>
            <p className="text-sm">Rs. {selectedOrder?.order.price}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPayment(false)}>منسوخ</Button>
              <Button onClick={collectPayment} className="bg-emerald-600 hover:bg-emerald-700">ادائیگی کریں</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showResult} onOpenChange={setShowResult}>
          <DialogContent>
            <DialogHeader><DialogTitle>نتائج</DialogTitle></DialogHeader>
            <Textarea value={resultText} onChange={e => setResultText(e.target.value)} rows={6} placeholder="الٹراساؤنڈ رپورٹ..." />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResult(false)}>منسوخ</Button>
              <Button onClick={completeTest} className="bg-emerald-600 hover:bg-emerald-700">مکمل</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
