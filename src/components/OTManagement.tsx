import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { FaClock, FaPlus, FaSpinner, FaHistory } from 'react-icons/fa';
import { format } from 'date-fns';

interface OTRequest {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejectionReason?: string | null;
}

const OTManagement: React.FC = () => {
  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '17:00',
    endTime: '19:00',
    totalHours: '2.0',
    reason: ''
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ot-requests');
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
    if (!formData.reason) {
      toast({ variant: 'destructive', title: 'Error', description: 'Reason is required' });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/ot-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'OT request submitted' });
        setIsSubmitOpen(false);
        setFormData({ ...formData, reason: '' });
        fetchRequests();
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
            <FaClock className="text-primary" />
            Overtime
          </h2>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
            Request and track your OT hours
          </p>
        </div>
        <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2 shadow-lg shadow-primary/20">
              <FaPlus /> REQUEST OT
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Overtime</DialogTitle>
              <DialogDescription>Submit your OT hours for approval.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Total Hours</Label>
                  <Input type="number" step="0.5" value={formData.totalHours} onChange={e => setFormData({...formData, totalHours: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason / Work Done</Label>
                <Textarea placeholder="Describe the tasks performed during OT..." value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
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
            OT History
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
                  <TableHead>Time</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewer Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No OT requests yet.
                    </TableCell>
                  </TableRow>
                ) : requests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>{format(new Date(req.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="text-xs">{req.startTime} - {req.endTime}</TableCell>
                    <TableCell className="font-bold">{req.totalHours}</TableCell>
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
                      {req.rejectionReason || '-'}
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

export default OTManagement;
