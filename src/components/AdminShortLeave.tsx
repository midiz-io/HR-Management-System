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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FaUserClock, FaSpinner, FaCheck, FaTimes, FaSearch, FaPlus, FaInfoCircle } from 'react-icons/fa';
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
  user: {
    firstName: string | null;
    lastName: string | null;
    department: string | null;
    position: string | null;
  };
}

const AdminShortLeave: React.FC = () => {
  const [requests, setRequests] = useState<ShortLeaveRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<ShortLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Create Dialog State
  const [employees, setEmployees] = useState<any[]>([]);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [formData, setFormData] = useState({
    targetUserId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    leaveType: 'MORNING',
    startTime: '',
    endTime: '',
    reason: '',
    requestTo: 'ADMIN'
  });

  // Review Dialog State
  const [selectedRequest, setSelectedRequest] = useState<ShortLeaveRequest | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  useEffect(() => {
    filterRequests();
  }, [requests, searchTerm, statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/short-leave');
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
      const res = await fetch(`/api/admin/short-leave/${selectedRequest.id}`, {
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

  const handleSubmit = async () => {
    if (!formData.targetUserId || !formData.leaveType) {
      toast({ variant: 'destructive', title: 'Error', description: 'Employee and Leave Type are required' });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/short-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Short Leave request submitted successfully' });
        setIsSubmitOpen(false);
        setFormData({ ...formData, targetUserId: '', reason: '', startTime: '', endTime: '', requestTo: 'ADMIN' });
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

  const openReviewDialog = (request: ShortLeaveRequest) => {
    setSelectedRequest(request);
    setRejectionReason(request.rejectionReason || '');
    setIsReviewOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <FaUserClock className="text-primary" />
            Short Leaves
          </h2>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
            Review and approve employee short leave requests
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
              <DialogTitle>Request Short Leave (Admin)</DialogTitle>
              <DialogDescription>Submit a short leave request on behalf of an employee.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={formData.targetUserId} onValueChange={(val) => setFormData({...formData, targetUserId: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.department || 'No Dept'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Textarea placeholder="Explain why the short leave is needed..." value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
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
                  <TableHead>Requested Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <FaUserClock className="h-8 w-8 opacity-20" />
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
            <DialogTitle>Review Short Leave</DialogTitle>
            <DialogDescription>
              Review the short leave request for {selectedRequest?.user.firstName} {selectedRequest?.user.lastName}.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-3 border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-bold uppercase">Requested Date</span>
                  <span className="font-medium text-sm">{format(new Date(selectedRequest.date), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-bold uppercase">Leave Type</span>
                  <Badge variant="outline" className={selectedRequest.leaveType === 'MORNING' ? 'text-blue-500 border-blue-200' : 'text-orange-500 border-orange-200'}>
                    {selectedRequest.leaveType}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-bold uppercase">Requested To</span>
                  <Badge variant="outline" className={selectedRequest.requestTo === 'DEPT_HEAD' ? 'text-indigo-500 border-indigo-200' : 'text-emerald-500 border-emerald-200'}>
                    {selectedRequest.requestTo === 'DEPT_HEAD' ? 'Department Head' : 'Admin'}
                  </Badge>
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

export default AdminShortLeave;
