import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Send,
  UserCheck,
  RefreshCw,
  Info,
  CalendarDays,
  Check,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isBefore, startOfToday } from 'date-fns';

interface OffDayRequest {
  id: string;
  userId: string;
  departmentId: string | null;
  departmentName?: string | null;
  date: string;
  reason: string | null;
  status: 'PENDING_SECTIONAL_HEAD' | 'PENDING_HR' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewerId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  recommendedById: string | null;
  recommendedAt: string | null;
  createdAt: string;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
    position: string | null;
  };
  recommender?: {
    firstName: string | null;
    lastName: string | null;
  } | null;
  reviewer?: {
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface BookedDate {
  id: string;
  date: string;
  userId: string;
  isSelf: boolean;
  status: string;
  employeeName: string;
}

interface OffDayManagementProps {
  currentUserId?: string;
  userRole?: string;
}

export default function OffDayManagement({ currentUserId, userRole }: OffDayManagementProps) {
  const [requests, setRequests] = useState<OffDayRequest[]>([]);
  const [bookedDates, setBookedDates] = useState<BookedDate[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSectionalHead, setIsSectionalHead] = useState<boolean>(false);
  const [isSuperAdminOrHR, setIsSuperAdminOrHR] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('calendar');

  // Rejection Dialog State
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [actionProcessing, setActionProcessing] = useState<boolean>(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
    fetchConflicts();
  }, [currentMonth]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/off-day-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        setIsSectionalHead(data.isSectionalHead || false);
        setIsSuperAdminOrHR(data.isSuperAdminOrHR || false);
      }
    } catch (err: any) {
      console.error('Error fetching off-day requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConflicts = async () => {
    try {
      const monthNum = currentMonth.getMonth() + 1;
      const yearNum = currentMonth.getFullYear();
      const res = await fetch(`/api/off-day-requests?conflictsOnly=true&month=${monthNum}&year=${yearNum}`);
      if (res.ok) {
        const data = await res.json();
        setBookedDates(data.bookedDates || []);
      }
    } catch (err) {
      console.error('Error fetching off-day conflicts:', err);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) {
      toast({ title: 'Select Date', description: 'Please select a date from the calendar', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/off-day-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(selectedDate, 'yyyy-MM-dd'),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: 'Request Submitted',
          description: data.message || 'Your off-day request has been submitted.',
        });
        setSelectedDate(null);
        setReason('');
        fetchRequests();
        fetchConflicts();
        setActiveTab('my-requests');
      } else {
        toast({
          variant: 'destructive',
          title: 'Request Failed',
          description: data.error || 'Failed to submit off-day request',
        });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (requestId: string, action: 'RECOMMEND' | 'APPROVE' | 'REJECT' | 'CANCEL', rejectReason?: string) => {
    try {
      setActionProcessing(true);
      const res = await fetch(`/api/off-day-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejectionReason: rejectReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Success', description: data.message });
        setRejectModalOpen(false);
        setTargetRequestId(null);
        setRejectionReasonInput('');
        fetchRequests();
        fetchConflicts();
      } else {
        toast({ variant: 'destructive', title: 'Action Failed', description: data.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActionProcessing(false);
    }
  };

  // Calendar Day Calculation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOffset = monthStart.getDay(); // 0 for Sunday
  const today = startOfToday();

  // Helper to find booked conflict on a day
  const getDayConflict = (day: Date) => {
    if (!Array.isArray(bookedDates)) return undefined;
    return bookedDates.find((b) => isSameDay(new Date(b.date), day) && !b.isSelf);
  };

  const getMyBookedDate = (day: Date) => {
    if (!Array.isArray(bookedDates)) return undefined;
    return bookedDates.find((b) => isSameDay(new Date(b.date), day) && b.isSelf);
  };

  const pendingRecommendations = Array.isArray(requests) ? requests.filter((r) => r.status === 'PENDING_SECTIONAL_HEAD') : [];
  const pendingApprovals = Array.isArray(requests) ? requests.filter((r) => r.status === 'PENDING_HR') : [];
  const myRequests = Array.isArray(requests) ? requests.filter((r) => currentUserId ? r.userId === currentUserId : true) : [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_SECTIONAL_HEAD':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300">Pending Sectional Head</Badge>;
      case 'PENDING_HR':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300">Pending HR Approval</Badge>;
      case 'APPROVED':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300">Approved by HR</Badge>;
      case 'REJECTED':
        return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300">Rejected</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <CalendarDays className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">Off-Day Request System</h2>
          </div>
          <p className="text-xs text-slate-400">
            Request scheduled off-days with automated department date-conflict prevention and 2-tier approval workflow.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => { fetchRequests(); fetchConflicts(); }}
          className="border-slate-700 hover:bg-slate-800 text-slate-200 text-xs self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger value="calendar" className="text-xs">
            <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
            Request Off-Day Calendar
          </TabsTrigger>
          <TabsTrigger value="my-requests" className="text-xs">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            My Requests ({myRequests.length})
          </TabsTrigger>
          {isSectionalHead && (
            <TabsTrigger value="recommendations" className="text-xs">
              <UserCheck className="w-3.5 h-3.5 mr-1.5" />
              Head Recommendations
              {pendingRecommendations.length > 0 && (
                <Badge className="ml-1.5 bg-blue-600 text-white text-[10px] px-1.5 py-0">
                  {pendingRecommendations.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {isSuperAdminOrHR && (
            <TabsTrigger value="hr-approvals" className="text-xs">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              HR Final Approvals
              {pendingApprovals.length > 0 && (
                <Badge className="ml-1.5 bg-amber-600 text-white text-[10px] px-1.5 py-0">
                  {pendingApprovals.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* TAB 1: CALENDAR & REQUEST SUBMISSION */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Interactive Calendar Card */}
            <Card className="lg:col-span-8 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="h-8 w-8"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-bold text-base text-slate-800 dark:text-slate-100">
                      {format(currentMonth, 'MMMM yyyy')}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="h-8 w-8"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-indigo-600"></div>
                      <span>Selected</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-rose-500"></div>
                      <span>Dept Conflict (Blocked)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-emerald-500"></div>
                      <span>My Booked Off-Day</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                <div className="overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[500px]">
                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400 mb-2">
                      <span>Sun</span>
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                      <span>Sat</span>
                    </div>

                    {/* Day Grid */}
                    <div className="grid grid-cols-7 gap-2">
                      {/* Empty cells for start offset */}
                      {Array.from({ length: startDayOffset }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-20 bg-slate-50/40 dark:bg-slate-900/30 rounded-xl" />
                      ))}

                      {/* Month days */}
                      {daysInMonth.map((day) => {
                        const conflict = getDayConflict(day);
                        const isMyBooking = getMyBookedDate(day);
                        const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                        const isPast = isBefore(day, today);
                        const isSelectable = !conflict && !isPast && !isMyBooking;

                        return (
                          <div
                            key={day.toISOString()}
                            onClick={() => {
                              if (conflict) {
                                toast({
                                  variant: 'destructive',
                                  title: 'Department Date Conflict',
                                  description: `${conflict.employeeName} from your department has already requested this date. Off-days on the same day in the same department are blocked.`,
                                });
                                return;
                              }
                              if (isPast) {
                                toast({ title: 'Past Date', description: 'Cannot request off-days in the past.' });
                                return;
                              }
                              if (isMyBooking) {
                                toast({ title: 'Already Requested', description: 'You have already requested an off-day on this date.' });
                                return;
                              }
                              setSelectedDate(day);
                            }}
                            className={`h-20 p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400'
                                : conflict
                                ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 cursor-not-allowed opacity-90'
                                : isMyBooking
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                                : isPast
                                ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <span className={`text-xs font-bold ${isSelected ? 'text-white' : ''}`}>
                              {format(day, 'd')}
                            </span>

                            {conflict && (
                              <div className="bg-rose-500 text-white text-[9px] font-semibold px-1 py-0.5 rounded truncate" title={`Conflict: ${conflict.employeeName}`}>
                                Booked: {conflict.employeeName}
                              </div>
                            )}

                            {isMyBooking && (
                              <div className="bg-emerald-600 text-white text-[9px] font-semibold px-1 py-0.5 rounded truncate">
                                My Off-Day ({isMyBooking.status === 'APPROVED' ? 'Approved' : 'Pending'})
                              </div>
                            )}

                            {isSelectable && !isSelected && (
                              <span className="text-[10px] text-slate-400 self-end">Available</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Request Submission Panel */}
            <Card className="lg:col-span-4 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Send className="w-4 h-4 text-indigo-600" />
                  Submit Off-Day Request
                </CardTitle>
                <CardDescription className="text-xs">
                  {isSectionalHead
                    ? 'Sectional Head requests go directly to HR for final approval.'
                    : 'Requests are first recommended by your Sectional Head before HR final approval.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4 space-y-4 flex-1">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Selected Off-Day Date:
                  </label>
                  <div className="mt-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-500" />
                    {selectedDate ? format(selectedDate, 'EEEE, MMMM dd, yyyy') : 'Please click a date on the calendar'}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Reason / Notes (Optional):
                  </label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Personal family event, personal rest day..."
                    rows={4}
                    className="mt-1 text-xs"
                  />
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Department conflict policy is strictly enforced. If a colleague has already requested a date, the date cannot be selected.
                  </span>
                </div>
              </CardContent>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  onClick={handleSubmitRequest}
                  disabled={submitting || !selectedDate}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-10 shadow-md"
                >
                  {submitting ? 'Submitting Request...' : 'Submit Off-Day Request'}
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: MY OFF-DAY REQUESTS */}
        <TabsContent value="my-requests" className="space-y-4">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base font-bold">My Off-Day Requests History</CardTitle>
              <CardDescription className="text-xs">
                Track status of your submitted off-days and supervisor review milestones.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {myRequests.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">You have not submitted any off-day requests yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {format(new Date(req.date), 'EEEE, MMMM dd, yyyy')}
                          </span>
                          {getStatusBadge(req.status)}
                        </div>
                        {req.reason && (
                          <p className="text-xs text-slate-500">Reason: {req.reason}</p>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                          <span>Requested on {format(new Date(req.createdAt), 'yyyy-MM-dd')}</span>
                          {req.recommender && (
                            <span>• Recommended by: {req.recommender.firstName} {req.recommender.lastName}</span>
                          )}
                          {req.reviewer && (
                            <span>• Reviewed by HR: {req.reviewer.firstName} {req.reviewer.lastName}</span>
                          )}
                          {req.rejectionReason && (
                            <span className="text-rose-500 font-semibold">• Note: {req.rejectionReason}</span>
                          )}
                        </div>
                      </div>

                      {req.status.startsWith('PENDING') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(req.id, 'CANCEL')}
                          disabled={actionProcessing}
                          className="border-rose-200 text-rose-600 hover:bg-rose-50 text-xs self-start md:self-auto"
                        >
                          Cancel Request
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SECTIONAL HEAD RECOMMENDATIONS */}
        {isSectionalHead && (
          <TabsContent value="recommendations" className="space-y-4">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-bold">Department Off-Day Recommendations</CardTitle>
                <CardDescription className="text-xs">
                  As Sectional Head, recommend or reject off-day requests from your department employees before they proceed to HR.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {pendingRecommendations.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
                    <p className="text-sm">All department off-day requests have been reviewed!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRecommendations.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {req.user?.firstName} {req.user?.lastName} ({req.user?.position || 'Employee'})
                            </span>
                            <Badge variant="outline" className="text-xs">{req.departmentName || 'Department'}</Badge>
                          </div>
                          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            Requested Date: {format(new Date(req.date), 'EEEE, MMMM dd, yyyy')}
                          </p>
                          {req.reason && <p className="text-xs text-slate-600 dark:text-slate-300">Reason: {req.reason}</p>}
                        </div>

                        <div className="flex items-center gap-2 self-start md:self-auto">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setTargetRequestId(req.id);
                              setRejectModalOpen(true);
                            }}
                            disabled={actionProcessing}
                            className="text-xs h-9"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAction(req.id, 'RECOMMEND')}
                            disabled={actionProcessing}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Recommend (Send to HR)
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* TAB 4: HR FINAL APPROVALS */}
        {isSuperAdminOrHR && (
          <TabsContent value="hr-approvals" className="space-y-4">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-bold">HR Final Approvals (Super Admin)</CardTitle>
                <CardDescription className="text-xs">
                  Review recommended off-day requests and grant final company approval.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {pendingApprovals.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
                    <p className="text-sm">No off-day requests awaiting HR final approval.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingApprovals.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {req.user?.firstName} {req.user?.lastName}
                            </span>
                            <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                              Recommended by Sectional Head
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            Requested Date: {format(new Date(req.date), 'EEEE, MMMM dd, yyyy')}
                          </p>
                          {req.reason && <p className="text-xs text-slate-600 dark:text-slate-300">Reason: {req.reason}</p>}
                        </div>

                        <div className="flex items-center gap-2 self-start md:self-auto">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setTargetRequestId(req.id);
                              setRejectModalOpen(true);
                            }}
                            disabled={actionProcessing}
                            className="text-xs h-9"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAction(req.id, 'APPROVE')}
                            disabled={actionProcessing}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Approve (HR Final)
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Rejection Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              Reject Off-Day Request
            </DialogTitle>
            <DialogDescription className="text-xs">
              Please specify the reason for rejecting this off-day request. The employee will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Textarea
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              placeholder="e.g. Critical project deadline, shift coverage required..."
              rows={3}
              className="text-xs"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => targetRequestId && handleAction(targetRequestId, 'REJECT', rejectionReasonInput)}
              disabled={actionProcessing}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
