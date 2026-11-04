import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { FaUserClock, FaPlus, FaSpinner, FaHistory, FaInfoCircle } from 'react-icons/fa';
import { format } from 'date-fns';

interface ShortLeaveRequest {
  id: string;
  date: string;
  leaveType: 'MORNING' | 'EVENING';
  startTime: string | null;
  endTime: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejectionReason?: string | null;
  requestTo: 'DEPT_HEAD' | 'ADMIN';
}

const ShortLeaveManagement: React.FC = () => {
  const [requests, setRequests] = useState<ShortLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    leaveType: 'MORNING',
    startTime: '',
    endTime: '',
    reason: '',
    requestTo: 'ADMIN'
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests/short-leave');
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
    if (!formData.leaveType) {
      toast({ variant: 'destructive', title: 'Error', description: 'Leave Type is required' });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/requests/short-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Short Leave request submitted' });
        setIsSubmitOpen(false);
        setFormData({ ...formData, reason: '', startTime: '', endTime: '', requestTo: 'ADMIN' });
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
            <FaUserClock className="text-primary" />
            Short Leave
          </h2>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
            Request morning or evening short leaves
          </p>
        </div>
        <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2 shadow-lg shadow-primary/20 bg-gradient-to-r from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 text-white">
              <FaPlus /> NEW SHORT LEAVE
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Short Leave</DialogTitle>
              <DialogDescription>Submit your short leave request. Check-in or check-out times will be monitored.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg text-orange-700 dark:text-orange-300 text-xs flex gap-2">
                <FaInfoCircle className="mt-0.5 shrink-0" />
                <p>Standard Shift: 8:30 AM to 5:30 PM. For morning leave, ensure you check-in by 10:30 AM. For evening leave, check-out after 3:30 PM.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <Select value={formData.leaveType} onValueChange={(val) => setFormData({...formData, leaveType: val})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MORNING">Morning Leave (Late In)</SelectItem>
                      <SelectItem value="EVENING">Evening Leave (Early Out)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Request To</Label>
                <Select value={formData.requestTo} onValueChange={(val) => setFormData({...formData, requestTo: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEPT_HEAD">Department Head</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason (Optional)</Label>
                <Textarea placeholder="Explain why you need short leave..." value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={isProcessing}>
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
            Short Leave History
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
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Send To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No short leave requests found.
                    </TableCell>
                  </TableRow>
                ) : requests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>{format(new Date(req.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={req.leaveType === 'MORNING' ? 'text-blue-500 border-blue-200' : 'text-orange-500 border-orange-200'}>
                        {req.leaveType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={req.requestTo === 'DEPT_HEAD' ? 'text-indigo-500 border-indigo-200' : 'text-emerald-500 border-emerald-200'}>
                        {req.requestTo === 'DEPT_HEAD' ? 'Dept. Head' : 'Admin'}
                      </Badge>
                    </TableCell>
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

export default ShortLeaveManagement;
