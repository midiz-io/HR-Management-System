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
import { FaDoorOpen, FaSpinner, FaCheck, FaTimes, FaSearch, FaUndo, FaQrcode } from 'react-icons/fa';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';

interface GatePassRequest {
  id: string;
  date: string;
  timeOut: string;
  expectedTimeIn: string | null;
  purpose: string;
  status: 'PENDING_SECTIONAL_HEAD' | 'PENDING_HR' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'RETURNED' | 'NOT_RETURNED';
  rejectionReason?: string | null;
  returnedAt?: string | null;
  checkout?: {
    actualTimeOut: string;
  } | null;
  user: {
    firstName: string | null;
    lastName: string | null;
    department: string | null;
    position: string | null;
    departmentId: string | null;
  };
}

const AdminGatePass: React.FC = () => {
  const [requests, setRequests] = useState<GatePassRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<GatePassRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // QR Code viewing state
  const [qrRequest, setQrRequest] = useState<GatePassRequest | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Review Dialog State
  const [selectedRequest, setSelectedRequest] = useState<GatePassRequest | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { toast } = useToast();

  const showQRCode = (request: GatePassRequest) => {
    setQrRequest(request);
    setIsQrOpen(true);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, searchTerm, statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gate-pass');
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
      if (statusFilter === 'PENDING') {
        result = result.filter(r => r.status.startsWith('PENDING'));
      } else {
        result = result.filter(r => r.status === statusFilter);
      }
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

  const handleStatusUpdate = async (status: string) => {
    if (!selectedRequest) return;
    
    if (status === 'REJECTED' && !rejectionReason) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please provide a reason for rejection.' });
      return;
    }

    setIsProcessing(true);
    try {
      const payload: any = { status };
      if (status === 'REJECTED') payload.rejectionReason = rejectionReason;
      if (status === 'RETURNED') payload.returnedAt = new Date().toISOString();

      const res = await fetch(`/api/admin/gate-pass/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast({ title: 'Success', description: `Request updated to ${status.replace(/_/g, ' ')}.` });
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

  const openReviewDialog = (request: GatePassRequest) => {
    setSelectedRequest(request);
    setRejectionReason(request.rejectionReason || '');
    setIsReviewOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'RETURNED':
        return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">{status}</Badge>;
      case 'REJECTED':
      case 'NOT_RETURNED':
        return <Badge variant="destructive">{status}</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline">{status}</Badge>;
      default:
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-400">{status.replace(/_/g, ' ')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <FaDoorOpen className="text-primary" />
            Gate Passes
          </h2>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
            Review and approve employee gate pass requests
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
              {['ALL', 'PENDING', 'APPROVED', 'RETURNED', 'REJECTED'].map((status) => (
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
                  <TableHead>Date</TableHead>
                  <TableHead>Time Out - In</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <FaDoorOpen className="h-8 w-8 opacity-20" />
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
                    <TableCell className="font-bold">
                      {req.timeOut} - {req.expectedTimeIn || '?'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(req.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {req.status === 'APPROVED' && !req.checkout && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => showQRCode(req)}
                            className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-xl flex items-center gap-1"
                          >
                            <FaQrcode className="h-3 w-3" /> QR Code
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openReviewDialog(req)}
                          className="text-primary hover:text-primary hover:bg-primary/10 rounded-xl"
                        >
                          Review
                        </Button>
                      </div>
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
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Review Gate Pass Request</DialogTitle>
            <DialogDescription>
              Review the gate pass request for {selectedRequest?.user.firstName} {selectedRequest?.user.lastName}.
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
                  <span className="text-xs text-muted-foreground font-bold uppercase">Time Out</span>
                  <span className="font-black text-lg text-blue-600 dark:text-blue-400">{selectedRequest.timeOut}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-bold uppercase">Expected Return</span>
                  <span className="font-medium text-sm">{selectedRequest.expectedTimeIn || '-'}</span>
                </div>
                {selectedRequest.returnedAt && (
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground font-bold uppercase text-emerald-600">Actual Return</span>
                    <span className="font-bold text-sm text-emerald-600">{format(new Date(selectedRequest.returnedAt), 'HH:mm')}</span>
                  </div>
                )}
                {selectedRequest.purpose && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-muted-foreground font-bold uppercase block mb-1">Purpose</span>
                    <p className="text-sm italic">"{selectedRequest.purpose}"</p>
                  </div>
                )}
              </div>

              {selectedRequest.status.startsWith('PENDING') && (
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
            {selectedRequest?.status.startsWith('PENDING') ? (
              <>
                <Button 
                  variant="destructive" 
                  onClick={() => handleStatusUpdate('REJECTED')}
                  disabled={isProcessing}
                  className="w-full sm:w-auto"
                >
                  {isProcessing ? <FaSpinner className="animate-spin mr-2" /> : <FaTimes className="mr-2" />}
                  Reject
                </Button>
                {selectedRequest.status === 'PENDING_SECTIONAL_HEAD' ? (
                  <Button 
                    variant="default" 
                    onClick={() => handleStatusUpdate('PENDING_HR')}
                    disabled={isProcessing}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isProcessing ? <FaSpinner className="animate-spin mr-2" /> : <FaCheck className="mr-2" />}
                    Approve (Head)
                  </Button>
                ) : (
                  <Button 
                    variant="default" 
                    onClick={() => handleStatusUpdate('APPROVED')}
                    disabled={isProcessing}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isProcessing ? <FaSpinner className="animate-spin mr-2" /> : <FaCheck className="mr-2" />}
                    Approve (HR)
                  </Button>
                )}
              </>
            ) : selectedRequest?.status === 'APPROVED' ? (
              <>
                <Button 
                  variant="destructive" 
                  onClick={() => handleStatusUpdate('NOT_RETURNED')}
                  disabled={isProcessing}
                  className="w-full sm:w-auto"
                >
                  Mark Not Returned
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => handleStatusUpdate('RETURNED')}
                  disabled={isProcessing}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <FaUndo className="mr-2" /> Mark Returned
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
      {/* QR Code Dialog */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="sm:max-w-[400px] text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <FaDoorOpen className="text-primary" />
              Gate Pass QR Code
            </DialogTitle>
            <DialogDescription>
              Scan this QR code using the employee's phone camera inside the AttendX app checkout scanner.
            </DialogDescription>
          </DialogHeader>
          {qrRequest && (
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 my-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <QRCodeSVG 
                  value={typeof window !== 'undefined' ? `${window.location.origin}/public/gate-pass/${qrRequest.id}` : ''}
                  size={220}
                  level="H"
                />
              </div>
              <div className="text-left w-full space-y-1">
                <p className="text-sm font-bold text-center">{qrRequest.user.firstName} {qrRequest.user.lastName}</p>
                <p className="text-xs text-muted-foreground text-center">{qrRequest.user.department || 'N/A'} • {qrRequest.user.position}</p>
                <div className="border-t border-slate-200 dark:border-slate-800 pt-2 mt-2 text-center text-xs space-y-1">
                  <span className="font-semibold block">Expected Exit: {qrRequest.timeOut}</span>
                  <span className="font-semibold block text-muted-foreground">Expected Return: {qrRequest.expectedTimeIn || '-'}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full rounded-xl" onClick={() => setIsQrOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGatePass;
