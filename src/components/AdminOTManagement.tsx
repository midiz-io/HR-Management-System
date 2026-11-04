import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { FaClock, FaCheck, FaTimes, FaSpinner, FaFilter, FaUser } from 'react-icons/fa';
import { format } from 'date-fns';

interface OTRequest {
  id: string;
  userId: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    department: string | null;
  };
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewer?: {
    firstName: string | null;
    lastName: string | null;
  };
  rejectionReason?: string | null;
}

const AdminOTManagement: React.FC = () => {
  const [requests, setRequests] = useState<OTRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Rejection dialog
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectionId, setRejectionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

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
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load OT requests' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string, reason?: string) => {
    setProcessingId(id);
    try {
      const res = await fetch('/api/ot-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, rejectionReason: reason })
      });

      if (res.ok) {
        toast({ title: 'Success', description: `Request ${status.toLowerCase()} successfully` });
        fetchRequests();
        if (status === 'REJECTED') setIsRejectOpen(false);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update request');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <FaClock className="text-primary" />
          Overtime Requests
        </h2>
        <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
          Review and approve employee OT hours
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <FaSpinner className="animate-spin text-3xl text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900">
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time Range</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No OT requests found.
                    </TableCell>
                  </TableRow>
                ) : requests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {req.user.firstName?.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold">{req.user.firstName} {req.user.lastName}</span>
                          <span className="text-[10px] text-muted-foreground font-black uppercase">{req.user.department || 'No Dept'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{format(new Date(req.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {req.startTime} - {req.endTime}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-black text-primary">{req.totalHours}h</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{req.reason}</TableCell>
                    <TableCell>
                      <Badge className={
                        req.status === 'APPROVED' ? 'bg-green-500' :
                        req.status === 'REJECTED' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === 'PENDING' && (
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 w-8 p-0 rounded-lg text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => handleStatusUpdate(req.id, 'APPROVED')}
                            disabled={!!processingId}
                          >
                            {processingId === req.id ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 w-8 p-0 rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => {
                              setRejectionId(req.id);
                              setIsRejectOpen(true);
                            }}
                            disabled={!!processingId}
                          >
                            <FaTimes />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject OT Request</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this request.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder="e.g. Work hours already covered in normal shift..." 
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>CANCEL</Button>
            <Button 
              variant="destructive" 
              onClick={() => rejectionId && handleStatusUpdate(rejectionId, 'REJECTED', rejectionReason)}
              disabled={!rejectionReason || !!processingId}
            >
              REJECT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOTManagement;
