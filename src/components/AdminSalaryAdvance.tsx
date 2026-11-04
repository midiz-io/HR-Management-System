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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { FaMoneyBillWave, FaSpinner, FaCheck, FaTimes, FaSearch } from 'react-icons/fa';
import { format } from 'date-fns';

interface SalaryAdvanceRequest {
  id: string;
  requestDate: string;
  amount: number;
  transferDate: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejectionReason?: string | null;
  user: {
    firstName: string | null;
    lastName: string | null;
    department: string | null;
    position: string | null;
  };
}

const AdminSalaryAdvance: React.FC = () => {
  const [requests, setRequests] = useState<SalaryAdvanceRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<SalaryAdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Review Dialog State
  const [selectedRequest, setSelectedRequest] = useState<SalaryAdvanceRequest | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, searchTerm, statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/salary-advance');
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

  const filterRequests = () => {
    let result = requests;
    
    if (statusFilter !== 'ALL') {
      result = result.filter(r => r.status === statusFilter);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => 
        (r.user.firstName?.toLowerCase() || '').includes(term) ||
        (r.user.lastName?.toLowerCase() || '').includes(term) ||
        (r.user.department?.toLowerCase() || '').includes(term)
      );
    }
    
    setFilteredRequests(result);
  };

  const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedRequest) return;
    
    if (status === 'REJECTED' && !rejectionReason) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please provide a reason for rejection.' });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/admin/salary-advance/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejectionReason })
      });

      if (res.ok) {
        toast({ title: 'Success', description: `Request ${status.toLowerCase()} successfully.` });
        setIsReviewOpen(false);
        setRejectionReason('');
        setSelectedRequest(null);
        fetchRequests();
      } else {
        const data = await res.json();
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'Failed to update request' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update request' });
    } finally {
      setIsProcessing(false);
    }
  };

  const openReviewDialog = (request: SalaryAdvanceRequest) => {
    setSelectedRequest(request);
    setRejectionReason(request.rejectionReason || '');
    setIsReviewOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <FaMoneyBillWave className="text-primary" />
            Salary Advances
          </h2>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
            Review and approve employee advance requests
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-72">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search employee or department..." 
                className="pl-9 bg-slate-50 dark:bg-slate-900 border-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
                <Badge 
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  className="cursor-pointer whitespace-nowrap"
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <FaSpinner className="animate-spin text-3xl text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Expected Transfer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <FaMoneyBillWave className="h-8 w-8 opacity-20" />
                        <p>No requests found matching your criteria.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRequests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div>
                        <p className="font-bold">{req.user.firstName} {req.user.lastName}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{req.user.department || 'N/A'} • {req.user.position}</p>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(req.requestDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                      Rs. {req.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {req.transferDate ? format(new Date(req.transferDate), 'MMM dd, yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        req.status === 'APPROVED' ? 'default' :
                        req.status === 'REJECTED' ? 'destructive' :
                        req.status === 'PENDING' ? 'secondary' : 'outline'
                      }>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => openReviewDialog(req)}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Review Advance Request</DialogTitle>
            <DialogDescription>
              Review the salary advance request for {selectedRequest?.user.firstName} {selectedRequest?.user.lastName}.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-3 border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-bold uppercase">Amount</span>
                  <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">Rs. {selectedRequest.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-bold uppercase">Requested For</span>
                  <span className="font-medium text-sm">{selectedRequest.transferDate ? format(new Date(selectedRequest.transferDate), 'MMM dd, yyyy') : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-bold uppercase">Submitted On</span>
                  <span className="font-medium text-sm">{format(new Date(selectedRequest.requestDate), 'MMM dd, yyyy')}</span>
                </div>
                {selectedRequest.reason && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-muted-foreground font-bold uppercase block mb-1">Employee Note</span>
                    <p className="text-sm italic">"{selectedRequest.reason}"</p>
                  </div>
                )}
              </div>

              {selectedRequest.status === 'PENDING' && (
                <div className="space-y-2">
                  <Label>Rejection Reason (if rejecting)</Label>
                  <Textarea 
                    placeholder="Provide a reason if you are rejecting this request..." 
                    value={rejectionReason} 
                    onChange={e => setRejectionReason(e.target.value)} 
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedRequest?.status === 'PENDING' ? (
              <>
                <Button 
                  variant="destructive" 
                  onClick={() => handleReview('REJECTED')}
                  disabled={isProcessing}
                  className="w-full sm:w-auto"
                >
                  {isProcessing ? <FaSpinner className="animate-spin mr-2" /> : <FaTimes className="mr-2" />}
                  Reject
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => handleReview('APPROVED')}
                  disabled={isProcessing}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isProcessing ? <FaSpinner className="animate-spin mr-2" /> : <FaCheck className="mr-2" />}
                  Approve
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsReviewOpen(false)} className="w-full">
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSalaryAdvance;
