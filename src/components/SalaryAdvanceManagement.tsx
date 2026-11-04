import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { FaMoneyBillWave, FaPlus, FaSpinner, FaHistory, FaPhoneAlt } from 'react-icons/fa';
import { format } from 'date-fns';

interface SalaryAdvanceRequest {
  id: string;
  requestDate: string;
  amount: number;
  transferDate: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejectionReason?: string | null;
}

const SalaryAdvanceManagement: React.FC = () => {
  const [requests, setRequests] = useState<SalaryAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    amount: '',
    requestDate: format(new Date(), 'yyyy-MM-dd'),
    transferDate: format(new Date(new Date().getFullYear(), new Date().getMonth(), 25), 'yyyy-MM-dd'), // Default to 25th of current month
    reason: ''
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests/salary-advance');
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load requests' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a valid amount' });
      return;
    }

    if (Number(formData.amount) > 15000) {
      toast({ 
        variant: 'destructive', 
        title: 'Limit Exceeded', 
        description: 'If you want to request more than 15,000/=, please contact the HR Department directly.' 
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/requests/salary-advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Salary Advance request submitted' });
        setIsSubmitOpen(false);
        setFormData({ ...formData, amount: '', reason: '' });
        fetchRequests();
      } else {
        const data = await res.json();
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'Failed to submit' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <FaMoneyBillWave className="text-primary" />
            Salary Advance
          </h2>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
            Request salary advances before the 25th
          </p>
        </div>
        <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2 shadow-lg shadow-primary/20 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white">
              <FaPlus /> REQUEST ADVANCE
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Salary Advance</DialogTitle>
              <DialogDescription>Submit your advance request. Maximum limit is 15,000/=</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {Number(formData.amount) > 15000 && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
                  <FaPhoneAlt className="mt-0.5 shrink-0" />
                  <p><strong>Limit Exceeded:</strong> If you want to request more than 15,000/=, please contact the HR Department. This request cannot be submitted here.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Request Amount (LKR)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">Rs.</span>
                  <Input 
                    type="number" 
                    className="pl-10 font-bold"
                    placeholder="10000"
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Request Date</Label>
                  <Input type="date" value={formData.requestDate} onChange={e => setFormData({...formData, requestDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Transfer Date</Label>
                  <Input type="date" value={formData.transferDate} onChange={e => setFormData({...formData, transferDate: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason (Optional)</Label>
                <Textarea placeholder="Reason for advance..." value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleSubmit} 
                disabled={isProcessing || Number(formData.amount) > 15000}
                className={Number(formData.amount) > 15000 ? "opacity-50 cursor-not-allowed" : ""}
              >
                {isProcessing && <FaSpinner className="animate-spin mr-2" />}
                SUBMIT REQUEST
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaHistory className="h-4 w-4 text-muted-foreground" />
            Advance Request History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <FaSpinner className="animate-spin text-2xl text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Transfer Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No salary advance requests found.
                    </TableCell>
                  </TableRow>
                ) : requests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>{format(new Date(req.requestDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="font-bold">Rs. {req.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{req.transferDate ? format(new Date(req.transferDate), 'MMM dd, yyyy') : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        req.status === 'APPROVED' ? 'default' :
                        req.status === 'REJECTED' ? 'destructive' :
                        'secondary'
                      }>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {req.rejectionReason || req.reason || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalaryAdvanceManagement;
