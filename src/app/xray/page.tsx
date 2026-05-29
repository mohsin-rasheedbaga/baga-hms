'use client';

import { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { HMSData, Visit, XrayOrder } from '@/lib/types';
import { loadData, saveData } from '@/lib/data';
import { toast } from 'sonner';
import { ScanLine, CreditCard, Clock, CheckCircle, Lock } from 'lucide-react';

export default function XrayPage() {
  const [data, setData] = useState<HMSData | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<{ visit: Visit; order: XrayOrder } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultText, setResultText] = useState('');

  const refreshData = useCallback(() => { setData(loadData()); }, []);
  useEffect(() => { refreshData(); }, [refreshData]);

  if (!data) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const collectHere = data.settings.xrayPaymentLocation === 'xray';
  const getPatient = (pid: string) => data.patients.find(p => p.id === pid);

  const allOrders: { visit: Visit; order: XrayOrder }[] = [];
  data.visits.forEach(visit => { visit.xrayOrders.forEach(o => allOrders.push({ visit, order: o })); });

  const collectPayment = () => {
    if (!selectedOrder) return;
    const uv = { ...selectedOrder.visit, xrayOrders: selectedOrder.visit.xrayOrders.map(o => o.id === selectedOrder.order.id ? { ...o, status: 'paid' as const, paidAt: new Date().toISOString() } : o) };
    const updated = { ...data, visits: data.visits.map(v => v.id === uv.id ? uv : v) };
    saveData(updated); setData(updated);
    setSelectedOrder({ visit: uv, order: { ...selectedOrder.order, status: 'paid', paidAt: new Date().toISOString() } });
    setShowPayment(false);
    toast.success('Payment received');
  };

  const completeTest = () => {
    if (!selectedOrder) return;
    const uv = { ...selectedOrder.visit, xrayOrders: selectedOrder.visit.xrayOrders.map(o => o.id === selectedOrder.order.id ? { ...o, status: 'completed' as const, result: resultText, completedAt: new Date().toISOString() } : o) };
    const updated = { ...data, visits: data.visits.map(v => v.id === uv.id ? uv : v) };
    saveData(updated); setData(updated);
    setSelectedOrder({ visit: uv, order: { ...selectedOrder.order, status: 'completed', result: resultText } });
    setShowResult(false);
    toast.success('X-Ray completed');
  };

  const togglePaymentLocation = (val: boolean) => {
    const loc = val ? 'xray' as const : 'reception' as const;
    const updated = { ...data, settings: { ...data.settings, xrayPaymentLocation: loc } };
    saveData(updated); setData(updated);
    toast.success(`Payment: ${val ? 'X-Ray' : 'Reception'}`);
  };

  const blocked = (order: XrayOrder) => order.status === 'ordered' && order.paymentLocation === 'reception';

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{allOrders.filter(o => o.order.status === 'ordered').length}</p><p className="text-xs text-gray-500">Ordered</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center"><CreditCard className="w-5 h-5 text-emerald-600" /></div><div><p className="text-2xl font-bold">{allOrders.filter(o => o.order.status === 'paid').length}</p><p className="text-xs text-gray-500">Paid</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-cyan-600" /></div><div><p className="text-2xl font-bold">{allOrders.filter(o => o.order.status === 'completed').length}</p><p className="text-xs text-gray-500">Completed</p></div></CardContent></Card>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <p className="font-medium text-sm">Payment Location</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Reception</span>
              <Switch checked={collectHere} onCheckedChange={togglePaymentLocation} />
              <span className="text-sm font-medium">X-Ray</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">X-Ray Orders</CardTitle></CardHeader>
          <CardContent>
            {allOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No orders</p>
            ) : (
              <div className="space-y-2">
                {allOrders.map(({ visit, order }) => {
                  const patient = getPatient(visit.patientId);
                  const isBlocked = blocked(order);
                  return (
                    <div key={order.id} className={`border rounded-lg p-4 flex items-center justify-between ${isBlocked ? 'bg-amber-50 border-amber-200' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isBlocked ? 'bg-amber-100' : 'bg-cyan-100'}`}>
                          {isBlocked ? <Lock className="w-5 h-5 text-amber-600" /> : <ScanLine className="w-5 h-5 text-cyan-600" />}
                        </div>
                        <div>
                          <p className="font-bold">{patient?.name}</p>
                          <p className="text-xs text-gray-500">{visit.patientNumber} | {order.testName} | Rs. {order.price}</p>
                          {isBlocked && <p className="text-xs text-amber-600 mt-1">Waiting for reception payment</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={order.status === 'completed' ? 'default' : 'outline'} className={order.status === 'completed' ? 'bg-emerald-600' : ''}>
                          {order.status === 'ordered' ? 'Ordered' : order.status === 'paid' ? 'Paid' : 'Completed'}
                        </Badge>
                        {!isBlocked && <Button size="sm" variant="outline" onClick={() => setSelectedOrder({ visit, order })}>View</Button>}
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
                  <p>Patient: {getPatient(selectedOrder.visit.patientId)?.name}</p>
                  <p>Price: Rs. {selectedOrder.order.price}</p>
                  <p>Status: {selectedOrder.order.status}</p>
                </div>
                {selectedOrder.order.result && <div className="bg-emerald-50 rounded-lg p-4 text-sm"><p className="font-bold mb-1">Results:</p>{selectedOrder.order.result}</div>}
                <DialogFooter>
                  {selectedOrder.order.status === 'ordered' && collectHere && <Button onClick={() => setShowPayment(true)} className="bg-emerald-600 hover:bg-emerald-700"><CreditCard className="w-4 h-4 mr-1" /> Payment</Button>}
                  {selectedOrder.order.status === 'paid' && <Button onClick={() => { setResultText(selectedOrder.order.result); setShowResult(true); }} className="bg-cyan-600 hover:bg-cyan-700"><ScanLine className="w-4 h-4 mr-1" /> Results</Button>}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showPayment} onOpenChange={setShowPayment}>
          <DialogContent>
            <DialogHeader><DialogTitle>Payment</DialogTitle></DialogHeader>
            <p className="text-sm">Rs. {selectedOrder?.order.price}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
              <Button onClick={collectPayment} className="bg-emerald-600 hover:bg-emerald-700">Pay</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showResult} onOpenChange={setShowResult}>
          <DialogContent>
            <DialogHeader><DialogTitle>Enter Results</DialogTitle></DialogHeader>
            <Textarea value={resultText} onChange={e => setResultText(e.target.value)} rows={6} placeholder="X-Ray report..." />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResult(false)}>Cancel</Button>
              <Button onClick={completeTest} className="bg-emerald-600 hover:bg-emerald-700">Complete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
