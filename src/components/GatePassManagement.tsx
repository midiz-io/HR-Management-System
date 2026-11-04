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
import { FaDoorOpen, FaPlus, FaSpinner, FaHistory, FaCheckCircle, FaExclamationCircle, FaCamera } from 'react-icons/fa';
import { format } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';

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
}

const GatePassManagement: React.FC = () => {
  const [requests, setRequests] = useState<GatePassRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Scanner state
  const [activeScannerId, setActiveScannerId] = useState<string | null>(null);
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const { toast } = useToast();

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    timeOut: '10:00',
    expectedTimeIn: '11:00',
    purpose: ''
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  // Initialize and stop the scanner dynamically when the scanner modal is open
  useEffect(() => {
    let html5Qrcode: Html5Qrcode | null = null;
    
    if (activeScannerId && isScannerOpen) {
      // Small timeout to allow the modal container to render
      const timer = setTimeout(() => {
        const element = document.getElementById('qr-reader');
        if (element) {
          try {
            html5Qrcode = new Html5Qrcode('qr-reader');
            setScannerInstance(html5Qrcode);
            
            html5Qrcode.start(
              { facingMode: 'environment' },
              {
                fps: 10,
                qrbox: { width: 250, height: 250 }
              },
              (decodedText) => {
                handleSuccessfulScan(decodedText, activeScannerId, html5Qrcode!);
              },
              () => {
                // Ignore verbose scan errors
              }
            ).catch(err => {
              console.error('Failed to start scanner:', err);
              toast({ 
                variant: 'destructive', 
                title: 'Camera Access Error', 
                description: 'Unable to access your back camera. Please check camera permissions.' 
              });
              setIsScannerOpen(false);
              setActiveScannerId(null);
            });
          } catch (e) {
            console.error('Error initializing scanner:', e);
          }
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (html5Qrcode && html5Qrcode.isScanning) {
          html5Qrcode.stop().catch(err => console.error('Error stopping scanner during cleanup:', err));
        }
      };
    }
  }, [activeScannerId, isScannerOpen]);

  const handleSuccessfulScan = async (decodedText: string, gatePassId: string, scanner: Html5Qrcode) => {
    if (scanner && scanner.isScanning) {
      await scanner.stop().catch(err => console.error('Error stopping scanner:', err));
    }
    
    setIsScannerOpen(false);
    setActiveScannerId(null);

    // Validate that the scanned QR code corresponds to this gate pass
    if (decodedText.includes(`/public/gate-pass/${gatePassId}`)) {
      toast({ title: 'QR Code verified', description: 'Redirecting to your active gate pass timer page...' });
      window.location.href = decodedText;
    } else {
      toast({ 
        variant: 'destructive', 
        title: 'Verification Failed', 
        description: 'This QR code is not valid for this gate pass. Please scan the QR code displayed on the security console.' 
      });
    }
  };

  const startScanner = (gatePassId: string) => {
    setActiveScannerId(gatePassId);
    setIsScannerOpen(true);
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests/gate-pass');
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
    if (!formData.timeOut || !formData.purpose) {
      toast({ variant: 'destructive', title: 'Error', description: 'Time Out and Purpose are required' });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/requests/gate-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Gate Pass request submitted' });
        setIsSubmitOpen(false);
        setFormData({ ...formData, purpose: '' });
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <FaDoorOpen className="text-primary" />
            Gate Pass
          </h2>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">
            Request permission to leave premises during work hours
          </p>
        </div>
        <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2 shadow-lg shadow-primary/20 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white">
              <FaPlus /> NEW GATE PASS
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Gate Pass</DialogTitle>
              <DialogDescription>Submit your request to leave the premises. Requires Sectional Head and HR approval.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg text-blue-700 dark:text-blue-300 text-xs flex gap-2">
                <FaExclamationCircle className="mt-0.5 shrink-0" />
                <p>Gate passes are for temporary exits during your shift. Please ensure you return by the expected time.</p>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Time Out</Label>
                  <Input type="time" value={formData.timeOut} onChange={e => setFormData({...formData, timeOut: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Expected Time In</Label>
                  <Input type="time" value={formData.expectedTimeIn} onChange={e => setFormData({...formData, expectedTimeIn: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Textarea placeholder="Explain why you need to leave..." value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} />
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
            Gate Pass History
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
                  <TableHead>Time Out</TableHead>
                  <TableHead>Expected In</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Remarks / Return Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No gate pass requests found.
                    </TableCell>
                  </TableRow>
                ) : requests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>{format(new Date(req.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="font-bold">{req.timeOut}</TableCell>
                    <TableCell className="text-xs">{req.expectedTimeIn || '-'}</TableCell>
                    <TableCell>
                      {getStatusBadge(req.status)}
                    </TableCell>
                    <TableCell>
                      {req.status === 'APPROVED' && !req.checkout && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200 rounded-xl gap-1.5 flex items-center font-bold"
                          onClick={() => startScanner(req.id)}
                        >
                          <FaCamera className="h-3 w-3" /> SCAN TO LEAVE
                        </Button>
                      )}
                      {req.checkout && (
                        <span 
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 cursor-pointer hover:underline" 
                          onClick={() => window.location.href = `/public/gate-pass/${req.id}`}
                        >
                          <FaDoorOpen className="h-3.5 w-3.5" /> Checked Out: {format(new Date(req.checkout.actualTimeOut), 'HH:mm')}
                        </span>
                      )}
                      {req.status !== 'APPROVED' && !req.checkout && (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {req.returnedAt ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                          <FaCheckCircle /> Returned: {format(new Date(req.returnedAt), 'HH:mm')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{req.rejectionReason || req.purpose}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Scanner Dialog */}
      <Dialog open={isScannerOpen} onOpenChange={(open) => {
        setIsScannerOpen(open);
        if (!open) {
          setActiveScannerId(null);
          if (scannerInstance && scannerInstance.isScanning) {
            scannerInstance.stop().catch(err => console.error('Error stopping scanner:', err));
          }
        }
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FaCamera className="text-primary animate-pulse" />
              Scan Security QR Code
            </DialogTitle>
            <DialogDescription>
              Point your camera at the QR code displayed on the security gate console to verify your departure.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div id="qr-reader" className="w-full max-w-[320px] aspect-square rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-black"></div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Using back camera automatically. Please ensure good lighting.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setIsScannerOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GatePassManagement;
