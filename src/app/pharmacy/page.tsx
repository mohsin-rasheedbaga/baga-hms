'use client';

import { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { HMSData, PharmacyBill, Visit } from '@/lib/types';
import { loadData, saveData, generateId } from '@/lib/data';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Pill, CheckCircle, CreditCard, Clock, AlertCircle } from 'lucide-react';

export default function PharmacyPage() {
  const [data, setData] = useState<HMSData | null>(null);
  const [selectedBill, setSelectedBill] = useState<PharmacyBill | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');

  const refreshData = useCallback(() => { setData(loadData()); }, []);
  useEffect(() => { refreshData(); }, [refreshData]);

  if (!data) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // Get visits with prescriptions that need pharmacy attention
  const visitWithRx = data.visits.filter(v =>
    v.prescription.length > 0 && (v.status === 'seen' || v.status === 'in-progress' || v.status === 'completed')
  );

  // Bills
  const pendingBills = data.pharmacyBills.filter(b => b.status === 'pending');
  const paidBills = data.pharmacyBills.filter(b => b.status === 'paid');
  const dispensedBills = data.pharmacyBills.filter(b => b.status === 'dispensed');

  const collectHere = data.settings.pharmacyPaymentLocation === 'pharmacy';

  const createBill = (visit: Visit) => {
    const patient = data.patients.find(p => p.id === visit.patientId);
    if (!patient) return;

    // Check if bill already exists
    const existing = data.pharmacyBills.find(b => b.visitId === visit.id);
    if (existing) {
      setSelectedBill(existing);
      return;
    }

    const bill: PharmacyBill = {
      id: generateId(),
      visitId: visit.id,
      patientId: patient.id,
      patientNumber: patient.patientNumber,
      patientName: patient.name,
      medicines: visit.prescription,
      totalAmount: visit.prescription.length * 150,
      status: 'pending',
      paymentLocation: data.settings.pharmacyPaymentLocation,
      createdAt: new Date().toISOString(),
    };

    const updated = { ...data, pharmacyBills: [...data.pharmacyBills, bill] };
    saveData(updated);
    setData(updated);
    setSelectedBill(bill);
    toast.success('Bill created');
  };

  const collectPayment = () => {
    if (!selectedBill) return;
    const updated = {
      ...data,
      pharmacyBills: data.pharmacyBills.map(b =>
        b.id === selectedBill.id ? { ...b, status: 'paid' as const } : b
      ),
    };
    saveData(updated);
    setData(updated);
    setSelectedBill({ ...selectedBill, status: 'paid' });
    setShowPayment(false);
    toast.success('Payment received');
  };

  const dispense = () => {
    if (!selectedBill) return;
    const updated = {
      ...data,
      pharmacyBills: data.pharmacyBills.map(b =>
        b.id === selectedBill.id ? { ...b, status: 'dispensed' as const } : b
      ),
    };
    saveData(updated);
    setData(updated);
    setSelectedBill({ ...selectedBill, status: 'dispensed' });
    toast.success('Medicine dispensed');
  };

  const togglePaymentLocation = (val: boolean) => {
    const loc = val ? 'pharmacy' as const : 'reception' as const;
    const updated = {
      ...data,
      settings: { ...data.settings, pharmacyPaymentLocation: loc },
    };
    saveData(updated);
    setData(updated);
    toast.success(`Payment: ${val ? 'Pharmacy' : 'Reception'}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
              <div><p className="text-2xl font-bold">{pendingBills.length}</p><p className="text-xs text-gray-500">Pending</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center"><CreditCard className="w-5 h-5 text-emerald-600" /></div>
              <div><p className="text-2xl font-bold">{paidBills.length}</p><p className="text-xs text-gray-500">Paid</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Pill className="w-5 h-5 text-purple-600" /></div>
              <div><p className="text-2xl font-bold">{dispensedBills.length}</p><p className="text-xs text-gray-500">Dispensed</p></div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Location Setting */}
        <Card className="mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-sm">Payment Location</p>
                <p className="text-xs text-gray-500">Where to collect payment</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Reception</span>
              <Switch checked={collectHere} onCheckedChange={togglePaymentLocation} />
              <span className="text-sm font-medium">Pharmacy</span>
            </div>
          </CardContent>
        </Card>

        {/* Prescriptions List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prescriptions - Pharmacy</CardTitle>
          </CardHeader>
          <CardContent>
            {visitWithRx.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No prescriptions</p>
            ) : (
              <div className="space-y-2">
                {visitWithRx.map(visit => {
                  const patient = data.patients.find(p => p.id === visit.patientId);
                  const bill = data.pharmacyBills.find(b => b.visitId === visit.id);
                  return (
                    <div key={visit.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <Pill className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-bold">{patient?.name}</p>
                          <p className="text-xs text-gray-500">{visit.patientNumber} | {visit.visitNumber}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {visit.prescription.map((med, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{med.medicine}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {bill && (
                          <Badge variant={bill.status === 'dispensed' ? 'default' : bill.status === 'paid' ? 'secondary' : 'outline'}
                            className={bill.status === 'dispensed' ? 'bg-emerald-600' : ''}>
                            {bill.status === 'pending' ? 'Pending' : bill.status === 'paid' ? 'Paid' : 'Dispensed'}
                          </Badge>
                        )}
                        <Button size="sm" variant="outline" onClick={() => createBill(visit)}>
                          {bill ? 'View' : 'Create Bill'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bill Detail Dialog */}
        <Dialog open={!!selectedBill} onOpenChange={open => { if (!open) setSelectedBill(null); }}>
          <DialogContent className="max-w-lg">
            {selectedBill && (
              <>
                <DialogHeader>
                  <DialogTitle>Bill - {selectedBill.patientName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Patient No: {selectedBill.patientNumber}</p>
                    <p className="text-sm text-gray-500">Bill No: {selectedBill.id.slice(-6).toUpperCase()}</p>
                  </div>
                  <div className="border rounded-lg divide-y">
                    <div className="p-2 font-bold text-sm bg-gray-50 grid grid-cols-3">
                      <span>Medicine</span><span>Dosage</span><span>Duration</span>
                    </div>
                    {selectedBill.medicines.map((med, i) => (
                      <div key={i} className="p-2 text-sm grid grid-cols-3">
                        <span>{med.medicine}</span><span>{med.dosage} - {med.frequency}</span><span>{med.duration}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between bg-emerald-50 rounded-lg p-4">
                    <span className="font-bold">Total Amount:</span>
                    <span className="text-2xl font-bold text-emerald-700">Rs. {selectedBill.totalAmount.toLocaleString()}</span>
                  </div>
                  {selectedBill.status === 'pending' && !collectHere && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Collect payment at reception
                    </div>
                  )}
                </div>
                <DialogFooter>
                  {selectedBill.status === 'pending' && collectHere && (
                    <Button onClick={() => { setPayAmount(String(selectedBill.totalAmount)); setShowPayment(true); }} className="bg-emerald-600 hover:bg-emerald-700">
                      <CreditCard className="w-4 h-4 mr-1" /> Pay
                    </Button>
                  )}
                  {selectedBill.status === 'paid' && (
                    <Button onClick={dispense} className="bg-purple-600 hover:bg-purple-700">
                      <Pill className="w-4 h-4 mr-1" /> Dispense Medicine
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={showPayment} onOpenChange={setShowPayment}>
          <DialogContent>
            <DialogHeader><DialogTitle>Payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Label>Amount (Rs.)</Label>
              <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} dir="ltr" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
              <Button onClick={collectPayment} className="bg-emerald-600 hover:bg-emerald-700">Pay</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
