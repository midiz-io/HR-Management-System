import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FaCalendarAlt, FaFileUpload, FaSpinner, FaCheck, FaTimes, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import { format, differenceInDays } from 'date-fns';

interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  defaultAllocation: number | null;
}

interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  leaveType: LeaveType;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  isExceeded?: boolean;
}

interface LeaveDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

interface LeaveRequest {
  id: string;
  leaveTypeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewerId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  documents: LeaveDocument[];
}

const LeaveManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // State for leave request form
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState<string>('');
  const [documents, setDocuments] = useState<File[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);

  // State for leave balances and history
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to check if a leave type has fixed allocation
  const hasFixedAllocation = (type: any) => {
    const name = type?.name?.toLowerCase() || '';
    // Fixed allocations are only Annual + Casual (Medical/No-Pay are unlimited/as-approved)
    return name.includes('annual') || name.includes('casual');
  };

  // Probation/Restriction state
  const [probationStatus, setProbationStatus] = useState<{
    isProbation: boolean;
    tenureMonth: number;
    eligibilityDate: Date | null;
    daysSinceJoined: number;
  }>({
    isProbation: false,
    tenureMonth: 0,
    eligibilityDate: null,
    daysSinceJoined: 0
  });
  const [showQuotaExpiredDialog, setShowQuotaExpiredDialog] = useState<boolean>(false);

  // Fetch leave types, balances, and history on component mount
  useEffect(() => {
    const fetchLeaveData = async () => {
      setIsLoading(true);
      try {
        // Fetch user data for restriction check (use joinDate if available, fallback to createdAt)
        const userResponse = await fetch('/api/user');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if ((userData.role === 'EMPLOYEE' || userData.role === 'ADMIN')) {
            // Use joinDate (actual employment start) if available, otherwise fall back to createdAt
            const dateToUse = userData.joinDate || userData.createdAt;
            if (dateToUse) {
              const joinDate = new Date(dateToUse);
              const now = new Date();
              const diffTime = Math.abs(now.getTime() - joinDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays < 90) {
                const eligDate = new Date(joinDate);
                eligDate.setDate(eligDate.getDate() + 90);
                
                setProbationStatus({
                  isProbation: true,
                  tenureMonth: Math.floor(diffDays / 30) + 1,
                  eligibilityDate: eligDate,
                  daysSinceJoined: diffDays
                });
              } else {
                // Explicitly clear probation for old employees
                setProbationStatus({
                  isProbation: false,
                  tenureMonth: 0,
                  eligibilityDate: null,
                  daysSinceJoined: 0
                });
              }
            }
          }
        }

        // Fetch leave types
        const typesResponse = await fetch('/api/leave-types');
        if (typesResponse.ok) {
          const typesData = await typesResponse.json();
          setLeaveTypes(typesData);
          if (typesData.length > 0 && !selectedLeaveTypeId) {
            setSelectedLeaveTypeId(typesData[0].id);
          }
        }

        // Fetch leave balances
        const balancesResponse = await fetch('/api/leave-balances');
        if (balancesResponse.ok) {
          const balancesData = await balancesResponse.json();
          setLeaveBalances(balancesData);
        }

        // Fetch leave history
        const historyResponse = await fetch('/api/leave-requests');
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setLeaveHistory(historyData);
        }

      } catch (error) {
        console.error('Error fetching leave data:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to fetch leave data',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.id) {
      fetchLeaveData();
    }
  }, [user?.id, toast]);

  // Calculate total leave days
  const calculateLeaveDays = () => {
    if (!startDate || !endDate) return 0;

    if (isHalfDay) return 0.5;

    // Business days only (exclude Saturday/Sunday), inclusive of both dates.
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    let count = 0;
    const cur = new Date(start.getTime());
    while (cur <= end) {
      const dow = cur.getDay(); // 0=Sun, 6=Sat
      if (dow !== 0 && dow !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  // Get selected leave type info
  const getSelectedLeaveType = (): LeaveType | undefined => {
    return leaveTypes.find(t => t.id === selectedLeaveTypeId);
  };

  // Get balance for selected leave type
  const getSelectedBalance = (): LeaveBalance | undefined => {
    return leaveBalances.find(b => b.leaveTypeId === selectedLeaveTypeId);
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);

      // Validate file types (PDF or JPG/JPEG)
      const validFiles = newFiles.filter(file =>
        file.type === 'application/pdf' ||
        file.type === 'image/jpeg' ||
        file.type === 'image/jpg'
      );

      if (validFiles.length !== newFiles.length) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Only PDF and JPG/JPEG files are allowed',
        });
      }

      // Validate file size (max 5MB)
      const validSizeFiles = validFiles.filter(file => file.size <= 5 * 1024 * 1024);

      if (validSizeFiles.length !== validFiles.length) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: 'Maximum file size is 5MB',
        });
      }

      setDocuments([...documents, ...validSizeFiles]);
    }
  };

  // Remove a document from the list
  const removeDocument = (index: number) => {
    const newDocuments = [...documents];
    newDocuments.splice(index, 1);
    setDocuments(newDocuments);
  };

  // Upload documents to server
  const uploadDocuments = async () => {
    const uploadedDocs: Array<{
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSize: number;
    }> = [];

    for (const file of documents) {
      try {
        // Convert file to base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });

        // Upload file
        const response = await fetch('/api/leave-documents/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileData: base64Data,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          uploadedDocs.push(data as any);
        } else {
          throw new Error('Failed to upload document');
        }
      } catch (error) {
        console.error('Error uploading document:', error);
        throw error;
      }
    }

    return uploadedDocs;
  };

  // Submit leave request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLeaveTypeId || !startDate || !endDate || !reason) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please fill in all required fields',
      });
      return;
    }

    if (startDate > endDate) {
      toast({
        variant: 'destructive',
        title: 'Invalid date range',
        description: 'End date must be after start date',
      });
      return;
    }

    try {
      // Check if quota is expired for fixed allocation types
      const selectedType = getSelectedLeaveType();
      const balance = getSelectedBalance();
      const requestedDays = calculateLeaveDays();

      if (hasFixedAllocation(selectedType)) {
        const available = balance
          ? balance.totalDays - balance.usedDays - balance.pendingDays
          : selectedType?.defaultAllocation ?? 0;

        if (available < requestedDays) {
          setShowQuotaExpiredDialog(true);
          return;
        }
      }

      setIsSubmitting(true);

      // Upload documents if any
      let uploadedDocs: any[] = [];
      if (documents.length > 0) {
        uploadedDocs = await uploadDocuments();
      }

      // Submit leave request
      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leaveTypeId: selectedLeaveTypeId,
          startDate: startDate.toISOString(),
          endDate: isHalfDay ? startDate.toISOString() : endDate.toISOString(),
          totalDays: calculateLeaveDays(),
          isHalfDay,
          reason,
          documents: uploadedDocs,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit leave request');
      }

      // Reset form
      setStartDate(undefined);
      setEndDate(undefined);
      setReason('');
      setDocuments([]);
      setUploadedDocuments([]);

      toast({
        title: 'Success',
        description: 'Leave request submitted successfully',
      });

      // Refresh leave history and balances
      const [historyResponse, balancesResponse] = await Promise.all([
        fetch('/api/leave-requests'),
        fetch('/api/leave-balances')
      ]);

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setLeaveHistory(historyData);
      }
      if (balancesResponse.ok) {
        const balancesData = await balancesResponse.json();
        setLeaveBalances(balancesData);
      }
    } catch (error: any) {
      console.error('Error submitting leave request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to submit leave request',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel a leave request
  const handleCancelRequest = async (id: string) => {
    try {
      const response = await fetch(`/api/leave-requests?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel leave request');
      }

      toast({
        title: 'Success',
        description: 'Leave request cancelled successfully',
      });

      // Refresh leave history and balances
      const [historyResponse, balancesResponse] = await Promise.all([
        fetch('/api/leave-requests'),
        fetch('/api/leave-balances')
      ]);

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setLeaveHistory(historyData);
      }
      if (balancesResponse.ok) {
        const balancesData = await balancesResponse.json();
        setLeaveBalances(balancesData);
      }
    } catch (error: any) {
      console.error('Error cancelling leave request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to cancel leave request',
      });
    }
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-500">Rejected</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-gray-500">Cancelled</Badge>;
      default:
        return <Badge className="bg-yellow-500">Pending</Badge>;
    }
  };

  // Format date for display
  const formatDateDisplay = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  // Calculate leave summary per type from history (approved leaves only)
  const getLeaveSummary = () => {
    const summary: Record<string, { typeName: string; totalDays: number; color: string }> = {};
    leaveHistory
      .filter(leave => leave.status === 'APPROVED')
      .forEach(leave => {
        const key = leave.leaveTypeId;
        if (!summary[key]) {
          summary[key] = {
            typeName: leave.leaveType.name,
            totalDays: 0,
            color: leave.leaveType.color || '#6b7280'
          };
        }
        summary[key].totalDays += leave.totalDays;
      });
    return Object.values(summary);
  };


  return (
    <div className="space-y-6">
      <Tabs defaultValue="request" className="space-y-4">
        <div className="overflow-x-auto pb-2">
          <TabsList className="w-full">
            <TabsTrigger value="request" className="flex-1">
              <FaCalendarAlt className="mr-2 h-4 w-4" />
              <span className="text-sm sm:text-base">Request</span>
            </TabsTrigger>
            <TabsTrigger value="balance" className="flex-1">
              <FaInfoCircle className="mr-2 h-4 w-4" />
              <span className="text-sm sm:text-base">Balance</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <FaCheck className="mr-2 h-4 w-4" />
              <span className="text-sm sm:text-base">History</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Leave Request Form */}
        <TabsContent value="request">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">Request Leave</CardTitle>
                <CardDescription>
                  Submit a new leave request. Fields with * are required.
                </CardDescription>
              </CardHeader>
              <CardContent>

              {probationStatus.isProbation && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <FaInfoCircle className="text-amber-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-amber-800">Probation Period Rules (Month {probationStatus.tenureMonth})</h4>
                    <p className="text-sm text-amber-700">
                      You are currently in your first 3 months of registration. During this period:
                    </p>
                    <ul className="text-xs text-amber-700 list-disc ml-4 mt-2 space-y-1">
                      <li>You are allowed <strong>one Half Day leave</strong> per month.</li>
                      <li>Full-day leaves are restricted until you complete 90 days.</li>
                    </ul>
                    {probationStatus.eligibilityDate && (
                      <p className="text-sm font-medium text-amber-800 mt-3">
                        Full-day leave eligibility: {probationStatus.eligibilityDate.toLocaleDateString()} ({90 - probationStatus.daysSinceJoined} days remaining)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Quota Over Alert Banner */}
              {(() => {
                const exhaustedTypes = leaveBalances
                  .filter(b => hasFixedAllocation(b.leaveType) && (b.totalDays - b.usedDays - b.pendingDays) <= 0)
                  .map(b => b.leaveType.name);
                
                if (exhaustedTypes.length > 0) {
                  return (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                      <FaExclamationTriangle className="text-red-600 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-red-800">Your leave quota for this year is over</h4>
                        <p className="text-sm text-red-700">
                          You have exhausted your quota for: <span className="font-bold underline">{exhaustedTypes.join(', ')}</span>.
                        </p>
                        <p className="text-[10px] text-red-600 uppercase font-bold mt-1 tracking-wider italic">
                          Further requests for these types may be rejected or processed as unpaid leave.
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Leave Type */}
                  <div className="space-y-2">
                    <Label htmlFor="leaveType">Leave Type *</Label>
                    <Select
                      value={selectedLeaveTypeId}
                      onValueChange={setSelectedLeaveTypeId}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="leaveType">
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: type.color || '#6b7280' }}
                              />
                              {type.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Show allocation info for selected type */}
                    {selectedLeaveTypeId && (() => {
                      const selectedType = getSelectedLeaveType();
                      const balance = getSelectedBalance();

                      if (!selectedType) return null;

                      if (hasFixedAllocation(selectedType)) {
                        const available = balance
                          ? balance.totalDays - balance.usedDays - balance.pendingDays
                          : selectedType.defaultAllocation ?? 0;
                        const isExceeded = balance?.isExceeded || available < 0;
                        return (
                          <div className={`text-sm mt-2 p-3 ${isExceeded ? 'bg-red-50 border-red-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50'} rounded-xl border shadow-sm animate-in fade-in slide-in-from-left-2`}>
                            <div className="flex items-center justify-between">
                              <div className={`flex items-center ${isExceeded ? 'text-red-700' : 'text-blue-700'} font-bold`}>
                                {isExceeded ? <FaExclamationTriangle className="mr-2 h-4 w-4" /> : <FaInfoCircle className="mr-2 h-4 w-4" />}
                                {isExceeded ? 'Quota Exceeded' : 'Available Balance'}
                              </div>
                              <span className={`text-xl font-black ${isExceeded ? 'text-red-600' : 'text-primary'}`}>
                                {available} days
                              </span>
                            </div>
                            <div className={`mt-1 text-[10px] ${isExceeded ? 'text-red-600' : 'text-blue-600/70'} uppercase tracking-widest font-black text-right`}>
                              {isExceeded ? 'Exceeds annual entitlement' : `out of ${selectedType.defaultAllocation} days annual quota`}
                            </div>
                            {isExceeded && (
                              <div className="mt-2 text-xs font-bold text-red-700 border-t border-red-200 pt-2 flex items-center gap-1">
                                <FaExclamationTriangle className="h-3 w-3" />
                                <span>You have enough leave left this year.</span>
                              </div>
                            )}
                          </div>
                        );
                      } else if (selectedType.name === 'Medical Leave') {
                        return (
                          <div className="text-sm mt-2 p-2 bg-amber-50 rounded-md">
                            <div className="flex items-center text-amber-700">
                              <FaInfoCircle className="mr-1 h-3 w-3" />
                              Medical leave is granted as approved by management
                            </div>
                          </div>
                        );
                      } else if (selectedType.name === 'No-Pay Leave') {
                        return (
                          <div className="text-sm mt-2 p-2 bg-red-50 rounded-md">
                            <div className="flex items-center text-red-700">
                              <FaInfoCircle className="mr-1 h-3 w-3" />
                              No-Pay leave — salary will be deducted for these days
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Date Range */}
                  <div className="space-y-2">
                    <Label>Date Range *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startDate" className="text-xs">Start Date</Label>
                        <div className="border rounded-md p-2 overflow-x-auto">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            disabled={isSubmitting}
                            initialFocus
                            className="mx-auto scale-90 sm:scale-100 origin-top"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="endDate" className="text-xs">End Date</Label>
                        <div className="border rounded-md p-2 overflow-x-auto">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            disabled={isSubmitting || isHalfDay || !startDate}
                            initialFocus
                            className="mx-auto scale-90 sm:scale-100 origin-top"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Show total days */}
                    {startDate && (isHalfDay || endDate) && (
                      <div className="text-sm text-muted-foreground mt-2">
                        Total: {calculateLeaveDays()} days
                      </div>
                    )}
                  </div>
                </div>

                {/* Half Day Option */}
                <div className="flex items-center space-x-2 pb-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="halfDay"
                      checked={isHalfDay}
                      onChange={(e) => {
                        setIsHalfDay(e.target.checked);
                        if (e.target.checked && startDate) {
                          setEndDate(startDate);
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="halfDay" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Half Day Request
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    (Leave for 0.5 days - <span className="text-amber-600 font-medium">Deducted from Annual Leave balance</span>)
                  </p>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="reason">
                    Reason for Leave *
                  </Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Please provide a reason for your leave request..."
                    disabled={isSubmitting}
                    rows={4}
                  />
                </div>

                {/* Supporting Documents */}
                <div className="space-y-2">
                  <Label htmlFor="documents">
                    Supporting Documents <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="documents"
                      type="file"
                      onChange={handleFileChange}
                      disabled={isSubmitting}
                      accept=".pdf,.jpg,.jpeg"
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>
                      <FaFileUpload className="mr-2 h-4 w-4" />
                      Browse
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Accepted formats: PDF, JPG/JPEG (max 5MB)
                  </div>

                  {/* Document List */}
                  {documents.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <Label>Selected Documents:</Label>
                      <div className="space-y-2">
                        {documents.map((doc, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                            <div className="truncate flex-1">
                              <span className="font-medium">{doc.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({(doc.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDocument(index)}
                              disabled={isSubmitting}
                            >
                              <FaTimes className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col items-center gap-3 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={(() => {
                  if (isSubmitting || !selectedLeaveTypeId || !startDate || !endDate || !reason) return true;
                  
                  // Probation rule: only half-day allowed
                  if (probationStatus.isProbation && !isHalfDay) return true;

                  const selectedType = getSelectedLeaveType();
                  const balance = getSelectedBalance();
                  const requestedDays = calculateLeaveDays();
                  if (hasFixedAllocation(selectedType)) {
                    const available = balance
                      ? balance.totalDays - balance.usedDays - balance.pendingDays
                      : selectedType?.defaultAllocation ?? 0;
                    if (available < requestedDays) return true;
                  }
                  return false;
                })()}
                className="w-full py-6 text-lg"
                size="lg"
                type="button"
              >
                {isSubmitting ? (
                  <>
                    <FaSpinner className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Leave Request'
                )}
              </Button>

              {/* Form completion status */}
              {!isSubmitting && (
                <div className="text-sm text-muted-foreground">
                  {!selectedLeaveTypeId && (
                    <div className="flex items-center text-amber-600">
                      <FaInfoCircle className="mr-1 h-3 w-3" />
                      Please select a leave type
                    </div>
                  )}
                  {!startDate && (
                    <div className="flex items-center text-amber-600">
                      <FaInfoCircle className="mr-1 h-3 w-3" />
                      Please select a start date
                    </div>
                  )}
                  {!endDate && startDate && (
                    <div className="flex items-center text-amber-600">
                      <FaInfoCircle className="mr-1 h-3 w-3" />
                      Please select an end date
                    </div>
                  )}
                  {!reason && (
                    <div className="flex items-center text-amber-600">
                      <FaInfoCircle className="mr-1 h-3 w-3" />
                      Please enter a reason for your leave
                    </div>
                  )}
                  {(() => {
                    const selectedType = getSelectedLeaveType();
                    const balance = getSelectedBalance();
                    const requestedDays = calculateLeaveDays();
                    if (selectedType && hasFixedAllocation(selectedType)) {
                      const available = balance
                        ? balance.totalDays - balance.usedDays - balance.pendingDays
                        : selectedType?.defaultAllocation ?? 0;
                      if (available < requestedDays) {
                        return (
                          <div className="flex items-center text-red-600 font-bold">
                            <FaExclamationTriangle className="mr-1 h-3 w-3" />
                            Quota Exceeded: You have enough leave left this year.
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                  {selectedLeaveTypeId && startDate && endDate && reason && (() => {
                    const selectedType = getSelectedLeaveType();
                    const balance = getSelectedBalance();
                    const requestedDays = calculateLeaveDays();
                    if (hasFixedAllocation(selectedType)) {
                      const available = balance
                        ? balance.totalDays - balance.usedDays - balance.pendingDays
                        : selectedType?.defaultAllocation ?? 0;
                      if (available < requestedDays) return false;
                    }
                    return true;
                  })() && (
                    <div className="flex items-center text-green-600">
                      <FaCheck className="mr-1 h-3 w-3" />
                      All required fields completed
                    </div>
                  )}
                </div>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Leave Balance */}
        <TabsContent value="balance">
          <Card>
            <CardHeader>
              <CardTitle>Leave Balance</CardTitle>
              <CardDescription>
                Your leave allocations and remaining balances for {new Date().getFullYear()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <FaSpinner className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Balance Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {leaveBalances.map((balance: any) => {
                      const isFixed = hasFixedAllocation(balance.leaveType);
                      
                      const remaining = isFixed ? balance.totalDays - balance.usedDays - balance.pendingDays : null;
                        
                      const usagePercent = isFixed && balance.totalDays > 0
                        ? Math.round(((balance.usedDays + balance.pendingDays) / balance.totalDays) * 100)
                        : 0;

                      return (
                        <div
                          key={balance.id}
                          className="p-4 border rounded-lg space-y-3"
                          style={{ borderLeftColor: balance.leaveType.color || '#6b7280', borderLeftWidth: '4px' }}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold text-base">{balance.leaveType.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {isFixed
                                  ? `${balance.totalDays} days per year`
                                  : balance.leaveType.name === 'Medical Leave'
                                    ? 'As approved'
                                    : 'Unlimited (salary deducted)'}
                              </p>
                            </div>
                            {isFixed && (
                              <div className="text-right">
                                <span
                                  className={`text-2xl font-bold ${remaining !== null && remaining <= 0 ? 'text-red-600' : ''}`}
                                  style={{ color: balance.leaveType.color || '#6b7280' }}
                                >
                                  {remaining}
                                </span>
                                <p className="text-xs text-muted-foreground">remaining</p>
                              </div>
                            )}
                          </div>

                          {/* Progress bar for fixed allocation types */}
                          {isFixed && (
                            <div className="space-y-1">
                              <Progress value={usagePercent} className="h-2" />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{`Used: ${balance.usedDays} days`}</span>
                                {balance.pendingDays > 0 && (
                                  <span className="text-amber-600">Pending: {balance.pendingDays} days</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* For non-fixed types, show usage stats */}
                          {!isFixed && (
                            <div className="flex gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Used: </span>
                                <span className="font-medium">{balance.usedDays} days</span>
                              </div>
                              {balance.pendingDays > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Pending: </span>
                                  <span className="font-medium text-amber-600">{balance.pendingDays} days</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {leaveBalances.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No leave balances found. Please contact your administrator.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Leave History</CardTitle>
              <CardDescription>
                Your leave request history and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <FaSpinner className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Remaining Balance Summary */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold mb-3">Available Quota Summary ({new Date().getFullYear()})</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {leaveBalances.map((balance) => {
                        const isFixed = hasFixedAllocation(balance.leaveType);
                        if (!isFixed) return null;
                        
                        const remaining = balance.totalDays - balance.usedDays - balance.pendingDays;
                        
                        return (
                          <div
                            key={balance.id}
                            className={`p-3 border rounded-lg flex justify-between items-center shadow-sm ${remaining <= 0 ? 'bg-red-50 border-red-200' : 'bg-background'}`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: remaining <= 0 ? '#dc2626' : (balance.leaveType.color || '#6b7280') }}
                              />
                              <span className={`text-sm font-medium ${remaining <= 0 ? 'text-red-800' : ''}`}>{balance.leaveType.name}</span>
                            </div>
                            <div className="text-right">
                              <span className={`text-lg font-bold ${remaining <= 0 ? 'text-red-600' : 'text-primary'}`}>
                                {remaining}
                              </span>
                              <span className="text-[10px] text-muted-foreground block uppercase font-bold">Days Left</span>
                              {remaining <= 0 && (
                                <span className="text-[9px] text-red-600 font-black uppercase mt-1 block">QUOTA OVER</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Leave Summary (Approved only) */}
                  {getLeaveSummary().length > 0 && (
                    <div className="mb-6 p-4 bg-muted/30 rounded-lg">
                      <h4 className="text-sm font-semibold mb-3">Approved Leave Summary</h4>
                      <div className="flex flex-wrap gap-3">
                        {getLeaveSummary().map((item, index) => (
                          <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-sm">{item.typeName}:</span>
                            <span className="text-sm font-semibold">{item.totalDays} days</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {leaveHistory.length > 0 ? (
                    <div className="space-y-4">
                      {/* Mobile view - card layout */}
                      <div className="sm:hidden space-y-3">
                        {leaveHistory.map((leave) => (
                          <div key={leave.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-medium truncate max-w-[180px]">{leave.leaveType.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {formatDateDisplay(leave.startDate)} - {formatDateDisplay(leave.endDate)}
                                </p>
                              </div>
                              <div>{getStatusBadge(leave.status)}</div>
                            </div>
                            <div className="flex justify-between text-xs mt-2">
                              <span className="text-muted-foreground mr-4">Days: {leave.totalDays}</span>
                              {(() => {
                                const balance = leaveBalances.find(b => b.leaveTypeId === leave.leaveTypeId);
                                if (balance) {
                                  const remaining = balance.totalDays - balance.usedDays - balance.pendingDays;
                                  return (
                                    <span className={`font-semibold ${remaining <= 0 ? 'text-red-500' : 'text-primary'}`}>
                                      Rem: {remaining} d
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {leave.status === 'PENDING' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCancelRequest(leave.id)}
                                  className="h-7 text-xs"
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                            {leave.status === 'REJECTED' && leave.rejectionReason && (
                              <div className="text-xs text-red-500 mt-2 pt-2 border-t">
                                Reason: {leave.rejectionReason}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Desktop view - table layout */}
                      <div className="hidden sm:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Leave Type</TableHead>
                              <TableHead>Dates</TableHead>
                              <TableHead className="hidden md:table-cell">Days</TableHead>
                              <TableHead>Remaining</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {leaveHistory.map((leave) => (
                              <TableRow key={leave.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: leave.leaveType.color || '#6b7280' }}
                                    />
                                    {leave.leaveType.name}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {formatDateDisplay(leave.startDate)} - {formatDateDisplay(leave.endDate)}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">{leave.totalDays}</TableCell>
                                <TableCell>
                                  {(() => {
                                    const balance = leaveBalances.find(b => b.leaveTypeId === leave.leaveTypeId);
                                    if (balance) {
                                      const remaining = balance.totalDays - balance.usedDays - balance.pendingDays;
                                      return (
                                        <span className={remaining <= 0 ? 'text-red-500 font-bold' : 'font-medium'}>
                                          {remaining} days
                                        </span>
                                      );
                                    }
                                    return <span className="text-muted-foreground">-</span>;
                                  })()}
                                </TableCell>
                                <TableCell>{getStatusBadge(leave.status)}</TableCell>
                                <TableCell>
                                  {leave.status === 'PENDING' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCancelRequest(leave.id)}
                                    >
                                      Cancel
                                    </Button>
                                  )}
                                  {leave.status === 'REJECTED' && leave.rejectionReason && (
                                    <div className="text-xs text-red-500">
                                      Reason: {leave.rejectionReason}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No leave history found
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quota Expired Dialog */}
      <Dialog open={showQuotaExpiredDialog} onOpenChange={setShowQuotaExpiredDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <FaExclamationTriangle className="h-5 w-5" />
              Restriction Active
            </DialogTitle>
            <DialogDescription className="py-2 text-lg font-black text-red-600 uppercase tracking-tight">
              Your leave quota for this year has expired.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 p-4 rounded-md border border-amber-200 mb-4">
            <h4 className="font-semibold text-amber-800 text-sm mb-1">Current Balance Info:</h4>
            {(() => {
              const balance = getSelectedBalance();
              const type = getSelectedLeaveType();
              if (!type) return null;
              const remaining = balance 
                ? balance.totalDays - balance.usedDays - balance.pendingDays 
                : type.defaultAllocation ?? 0;
              return (
                <div className="text-sm text-amber-700">
                  <p>Leave Type: <span className="font-medium">{type.name}</span></p>
                  <p>Remaining: <span className="font-bold">{remaining} days</span></p>
                  <p>Requested: <span className="font-bold">{calculateLeaveDays()} days</span></p>
                </div>
              );
            })()}
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowQuotaExpiredDialog(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;