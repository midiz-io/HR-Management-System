import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useRealtimeSubscription } from '@/contexts/RealtimeContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { FaUserTimes } from 'react-icons/fa';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  FaSpinner,
  FaSearch,
  FaUserClock,
  FaMapMarkerAlt,
  FaFilePdf,
  FaFileExcel,
  FaWhatsapp,
  FaDownload,
  FaCalendarAlt,
  FaCheck,
  FaChevronDown,
  FaBuilding,
  FaUserTie,
  FaUsers,
  FaUserCheck,
  FaClock,
  FaExclamationTriangle,
  FaLayerGroup,
  FaEdit,
  FaTimes
} from 'react-icons/fa';
import { DateRange } from 'react-day-picker';
import {
  format,
  parseISO,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  startOfDay,
  endOfDay,
  startOfWeek,
  subDays,
  eachDayOfInterval
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getLocationColor } from '@/lib/locationColors';
import { getUserActiveShiftInfo } from '@/util/attendance-logic';

// Sri Lankan timezone constant
const SRI_LANKA_TZ = 'Asia/Colombo';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  department?: string | null;
  position?: string | null;
  rosters?: any[];
}

interface Location {
  id: string;
  name: string;
}

interface Attendance {
  id: string;
  userId: string;
  user: User;
  locationId: string;
  location: Location;
  checkInTime: string;
  checkOutTime: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface AbsentEmployee { userId?: string; status?: string;
  id: string;
  employeeName: string;
  email: string;
  date: string;
  position: string;
}

interface LateEmployee { userId?: string;
  id: string;
  employeeName: string;
  email: string;
  date: string;
  checkInTime: string;
  rosterStartTime: string;
  lateMinutes: string;
  location: string;
  position: string;
  status: string;
}

const AttendanceReports: React.FC = () => {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('thisMonth');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [isDateRangePopoverOpen, setIsDateRangePopoverOpen] = useState(false);
  const [isEmployeePopoverOpen, setIsEmployeePopoverOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [generatingPDF, setGeneratingPDF] = useState<boolean>(false);
  const [generatingExcel, setGeneratingExcel] = useState<boolean>(false);
  const [lastGeneratedRange, setLastGeneratedRange] = useState<DateRangeInfo | null>(null);
  const [absentEmployees, setAbsentEmployees] = useState<AbsentEmployee[]>([]);
  const [loadingAbsent, setLoadingAbsent] = useState<boolean>(false);
  const [hasFetchedAbsent, setHasFetchedAbsent] = useState<boolean>(false);
  const [lateEmployees, setLateEmployees] = useState<LateEmployee[]>([]);
  const [loadingLate, setLoadingLate] = useState<boolean>(false);
  const [hasFetchedLate, setHasFetchedLate] = useState<boolean>(false);
  const [lateSummary, setLateSummary] = useState<any>(null);
  const { toast } = useToast();

  // Force Checkout & Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [forcingCheckout, setForcingCheckout] = useState<boolean>(false);

  // In-line editing state for attendance report
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    checkInTime: string;
    checkOutTime: string;
    notes: string;
  }>({
    checkInTime: '',
    checkOutTime: '',
    notes: '',
  });
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Clear selections when any filter or query changes
  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, searchTerm, dateFilter, locationFilter, employeeFilter, overdueOnly]);

  type DateRangeInfo = {
    startDate: Date;
    endDate: Date;
    summaryLabel: string;
    rangeLabel: string;
    filterKey: string;
  };

  const getResolvedDateRange = (): DateRangeInfo => {
    const now = new Date();
    let summaryLabel = 'Last 30 days';
    const filterKey = dateFilter;
    let startDate = startOfDay(subDays(now, 30));
    let endDate = endOfDay(now);

    switch (dateFilter) {
      case 'today': {
        summaryLabel = 'Today';
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      }
      case 'yesterday': {
        summaryLabel = 'Yesterday';
        const yesterday = subDays(now, 1);
        startDate = startOfDay(yesterday);
        endDate = endOfDay(yesterday);
        break;
      }
      case 'thisWeek': {
        summaryLabel = 'This Week';
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        startDate = startOfDay(weekStart);
        endDate = endOfDay(now);
        break;
      }
      case 'thisMonth': {
        summaryLabel = 'This Month';
        startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        endDate = endOfDay(now);
        break;
      }
      case 'range': {
        summaryLabel = 'Custom Range';
        if (customDateRange?.from) {
          startDate = startOfDay(customDateRange.from);
        } else {
          startDate = startOfDay(now);
        }
        if (customDateRange?.to) {
          endDate = endOfDay(customDateRange.to);
        } else if (customDateRange?.from) {
          endDate = endOfDay(customDateRange.from);
        } else {
          endDate = endOfDay(now);
        }
        break;
      }
      default:
        break;
    }

    const sameDay = format(startDate, 'yyyyMMdd') === format(endDate, 'yyyyMMdd');
    const rangeLabel = sameDay ? format(startDate, 'MMM d, yyyy') : `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;

    return {
      startDate,
      endDate,
      summaryLabel,
      rangeLabel,
      filterKey,
    };
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAttendances.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAttendances.map(att => att.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const isAttendanceOverdue = (att: Attendance) => {
    if (att.checkOutTime !== null) return false;
    const shiftInfo = getUserActiveShiftInfo(new Date(), att.user);
    return shiftInfo.hasShift && shiftInfo.isShiftEnded;
  };

  const handleForceCheckout = async () => {
    if (selectedIds.length === 0) return;
    
    try {
      setForcingCheckout(true);
      const response = await fetch('/api/admin/force-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attendanceIds: selectedIds,
          notes: 'Force checked-out by Admin'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to force check-out');
      }

      const result = await response.json();
      toast({
        title: 'Success',
        description: `Successfully checked out ${result.count} employees.`,
      });

      setSelectedIds([]);
      fetchAttendances();
    } catch (error: any) {
      console.error('Error force checking out:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to force check-out',
      });
    } finally {
      setForcingCheckout(false);
    }
  };

  const [departmentsList, setDepartmentsList] = useState<{ id: string; name: string; head?: any; _count?: any }[]>([]);
  const [departmentReportData, setDepartmentReportData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'ALL_REPORTS' | 'DEPARTMENT_ANALYTICS'>('ALL_REPORTS');
  const [loadingDeptReport, setLoadingDeptReport] = useState<boolean>(false);

  // Fetch locations, employees, and departments on component mount
  useEffect(() => {
    fetchLocations();
    fetchEmployees();
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartmentsList(data);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchDepartmentReport = async (deptId: string = departmentFilter) => {
    try {
      setLoadingDeptReport(true);
      const rangeInfo = getResolvedDateRange();
      const dateStr = format(rangeInfo.startDate, 'yyyy-MM-dd');
      const url = `/api/reports/department-attendance?date=${dateStr}&departmentId=${deptId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDepartmentReportData(data);
      }
    } catch (err) {
      console.error('Error fetching department report data:', err);
    } finally {
      setLoadingDeptReport(false);
    }
  };

  // Re-fetch attendances whenever UI filters change
  useEffect(() => {
    fetchAttendances();
    fetchDepartmentReport(departmentFilter);
  }, [dateFilter, statusFilter, locationFilter, employeeFilter, departmentFilter, customDateRange]);

  // No longer using department filter
  // const departments = Array.from(new Set(employees.map(e => e.department).filter(d => d && d !== 'All Departments'))).sort() as string[];

  // Fetch attendances from API with filters
  const fetchAttendances = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      
      // Date filter
      if (dateFilter !== 'all') {
        const rangeInfo = getResolvedDateRange();
        params.append('startDate', format(rangeInfo.startDate, 'yyyy-MM-dd'));
        params.append('endDate', format(rangeInfo.endDate, 'yyyy-MM-dd'));
      }
      
      // Status filter
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      
      // Location filter
      if (locationFilter !== 'ALL') {
        params.append('locationId', locationFilter);
      }
      
      // Employee filter
      if (employeeFilter !== 'ALL') {
        params.append('userId', employeeFilter);
      }
      
      // Department filter
      if (departmentFilter !== 'ALL') {
        params.append('department', departmentFilter);
      }
      
      const queryStr = params.toString();
      const url = `/api/admin/attendance${queryStr ? `?${queryStr}` : ''}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch attendance records');
      }
      const data = await response.json();
      setAttendances(data);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch attendance records',
      });
    } finally {
      setLoading(false);
    }
  };

  // Real-time attendance subscription
  useRealtimeSubscription('ATTENDANCE_UPDATED', () => {
    fetchAttendances();
  });

  useRealtimeSubscription('REFRESH_ALL', () => {
    fetchAttendances();
  });

  // Fetch locations for filtering
  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  // Fetch employees for employee-wise filtering and reporting
  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch employees');
      }
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch employees for filtering',
      });
    }
  };

  // Fetch absent employees from the absent-attendance report API
  const fetchAbsentEmployees = async () => {
    try {
      setLoadingAbsent(true);
      const rangeInfo = getResolvedDateRange();
      const startDateStr = format(rangeInfo.startDate, 'yyyy-MM-dd');
      const endDateStr = format(rangeInfo.endDate, 'yyyy-MM-dd');

      // Include location and employee filters if selected
      const locationQP = locationFilter !== 'ALL' ? `&locationId=${locationFilter}` : '';
      const employeeQP = employeeFilter !== 'ALL' ? `&userId=${employeeFilter}` : '';

      const response = await fetch(
        `/api/reports/absent-attendance?startDate=${startDateStr}&endDate=${endDateStr}${locationQP}${employeeQP}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch absent attendance data');
      }
      const result = await response.json();
      const fetchedData = result.data || [];
      setAbsentEmployees(fetchedData);
      setHasFetchedAbsent(true);

      // Show alert if no records found
      if (fetchedData.length === 0) {
        toast({
          title: 'Not "ABSENT" Records Found',
          description: "No absent employees were found for the selected date range and filters.",
        });
      }
    } catch (error) {
      console.error('Error fetching absent employees:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch absent employee data',
      });
      setAbsentEmployees([]);
    } finally {
      setLoadingAbsent(false);
    }
  };

  // Fetch late employees from the late-attendance report API
  const fetchLateEmployees = async () => {
    try {
      setLoadingLate(true);
      const rangeInfo = getResolvedDateRange();
      const startDateStr = format(rangeInfo.startDate, 'yyyy-MM-dd');
      const endDateStr = format(rangeInfo.endDate, 'yyyy-MM-dd');

      // Include location and employee filters if selected
      const locationQP = locationFilter !== 'ALL' ? `&locationId=${locationFilter}` : '';
      const employeeQP = employeeFilter !== 'ALL' ? `&userId=${employeeFilter}` : '';

      const response = await fetch(
        `/api/reports/late-attendance?startDate=${startDateStr}&endDate=${endDateStr}${locationQP}${employeeQP}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch late attendance data');
      }
      const result = await response.json();
      setLateEmployees(result.data || []);
      setLateSummary(result.summary || null);
      setHasFetchedLate(true);
    } catch (error) {
      console.error('Error fetching late employees:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch late employee data',
      });
      setLateEmployees([]);
    } finally {
      setLoadingLate(false);
    }
  };

  // Format date for display in Sri Lankan timezone
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const zonedDate = toZonedTime(date, SRI_LANKA_TZ);
    if (isToday(zonedDate)) {
      return `Today, ${format(zonedDate, 'h:mm a')}`;
    } else if (isYesterday(zonedDate)) {
      return `Yesterday, ${format(zonedDate, 'h:mm a')}`;
    } else {
      return format(zonedDate, 'MMM d, yyyy h:mm a');
    }
  };

  // Calculate duration between check-in and check-out
  const calculateDuration = (checkInTime: string, checkOutTime: string | null) => {
    if (!checkOutTime) return 'In progress';

    const checkIn = new Date(checkInTime).getTime();
    const checkOut = new Date(checkOutTime).getTime();
    const durationMs = checkOut - checkIn;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  // Convert ISO UTC or date string to local datetime-local input format (YYYY-MM-DDTHH:mm)
  const toDateTimeLocal = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const handleStartEdit = (att: Attendance) => {
    setEditingId(att.id);
    setEditForm({
      checkInTime: toDateTimeLocal(att.checkInTime),
      checkOutTime: toDateTimeLocal(att.checkOutTime),
      notes: att.notes || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ checkInTime: '', checkOutTime: '', notes: '' });
  };

  const handleSaveEdit = async (attId: string) => {
    if (!editForm.checkInTime) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Check-in time cannot be empty',
      });
      return;
    }

    try {
      setSavingEdit(true);
      const payload: any = {
        id: attId,
        checkInTime: new Date(editForm.checkInTime).toISOString(),
        checkOutTime: editForm.checkOutTime ? new Date(editForm.checkOutTime).toISOString() : null,
        notes: editForm.notes,
      };

      const res = await fetch('/api/admin/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update attendance');
      }

      const updatedRecord = await res.json();

      setAttendances((prev) =>
        prev.map((item) => (item.id === attId ? { ...item, ...updatedRecord } : item))
      );

      toast({
        title: 'Updated Successfully',
        description: 'Attendance record updated and saved permanently.',
      });
      setEditingId(null);
    } catch (err: any) {
      console.error('Failed to save attendance edit:', err);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: err.message || 'Could not update attendance record',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // resolved date range helper is now defined at the top of the component

  const getPeriodDescription = (rangeInfo: DateRangeInfo) => {
    return rangeInfo.summaryLabel === rangeInfo.rangeLabel
      ? rangeInfo.rangeLabel
      : `${rangeInfo.summaryLabel} (${rangeInfo.rangeLabel})`;
  };

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value);
    if (value === 'range') {
      setIsDateRangePopoverOpen(true);
    } else {
      setIsDateRangePopoverOpen(false);
      // Auto-fetch if specialized
      if (statusFilter === 'ABSENT') fetchAbsentEmployees();
      if (statusFilter === 'LATE') fetchLateEmployees();
    }
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setCustomDateRange(range);
    if (range?.from && range?.to) {
      setDateFilter('range');
      setIsDateRangePopoverOpen(false);
      // Auto-fetch if specialized
      if (statusFilter === 'ABSENT') fetchAbsentEmployees();
      if (statusFilter === 'LATE') fetchLateEmployees();
    }
  };

  const clearCustomDateRange = () => {
    setCustomDateRange(undefined);
    setDateFilter('all');
    setIsDateRangePopoverOpen(false);
    // Explicitly re-fetch if status is specialized
    if (statusFilter === 'ABSENT') fetchAbsentEmployees();
    if (statusFilter === 'LATE') fetchLateEmployees();
  };

  const isCustomRangeActive = dateFilter === 'range';
  let customRangeButtonText = 'Pick a date range';
  if (customDateRange?.from && customDateRange?.to) {
    customRangeButtonText = `${format(customDateRange.from, 'MMM d, yyyy')} - ${format(customDateRange.to, 'MMM d, yyyy')}`;
  } else if (customDateRange?.from) {
    customRangeButtonText = `${format(customDateRange.from, 'MMM d, yyyy')} - ...`;
  }

  // Generate and open PDF report
  const generatePDFReport = async () => {
    try {
      if (dateFilter === 'range' && (!customDateRange?.from || !customDateRange?.to)) {
        toast({
          variant: 'destructive',
          title: 'Date range required',
          description: 'Please select both a start and end date before generating the report.',
        });
        setIsDateRangePopoverOpen(true);
        return;
      }

      setGeneratingPDF(true);

      const rangeInfo = getResolvedDateRange();
      const { startDate, endDate, summaryLabel, rangeLabel } = rangeInfo;

      console.log('Generating PDF report for period:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        summaryLabel,
        rangeLabel,
        status: statusFilter,
        location: locationFilter
      });

      // Prepare request body with filters
      const requestBody: any = {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        includeDetails: true,
      };

      // Add employee filter if specific employee is selected
      if (employeeFilter !== 'ALL') {
        requestBody.userId = employeeFilter;
      }

      // Add location filter if specific location is selected
      if (locationFilter !== 'ALL') {
        requestBody.locationId = locationFilter;
      }

      // Add status filter if specific status is selected
      if (statusFilter !== 'ALL') {
        requestBody.status = statusFilter;
      }

      // Fetch the data for the report with filters
      const response = await fetch('/api/attendance/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response from API:', errorData);
        throw new Error(errorData.error || 'Failed to generate report data');
      }

      const reportData = await response.json();
      console.log('Successfully received report data:', {
        attendancesCount: reportData.attendances?.length || 0,
        summary: reportData.summary
      });

      // Generate PDF using jsPDF and jspdf-autotable
      const generatePDF = async () => {
        const { default: jsPDF } = await import('jspdf');
        await import('jspdf-autotable');

        // Calculate number of records to determine dynamic height for a single-sheet PDF
        const rowCount = reportData.attendances?.length || 0;
        // Estimate height: Header section (35mm) + Table header (10mm) + Rows (8mm each) + Footer (20mm) + Padding (10mm)
        const estimatedTableHeight = rowCount * 8 + 10;
        const totalNeededHeight = 35 + estimatedTableHeight + 20 + 10;
        // Use at least A4 height (297mm), but expand if more records are present
        const dynamicHeight = Math.max(297, totalNeededHeight);

        // Create a new PDF document with A4 width and dynamic height for a single sheet
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [210, dynamicHeight]
        });

        // Add header with icon and title
        doc.setFillColor(41, 98, 255); // Primary blue color
        doc.rect(0, 0, 210, 25, 'F');

        // Add title with icon
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text('Attendance Report', 105, 15, { align: 'center' });

        // Add period and filter information
        doc.setFontSize(10);
        doc.text(`Period: ${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`, 105, 22, { align: 'center' });

        // Add filter information below the title
        let filterText = '';
        if (statusFilter !== 'ALL') {
          filterText += `Status: ${statusFilter} | `;
        }
        if (locationFilter !== 'ALL') {
          const locationName = locations.find(loc => loc.id === locationFilter)?.name || locationFilter;
          filterText += `Location: ${locationName} | `;
        }

        // Remove trailing separator if exists
        if (filterText.endsWith(' | ')) {
          filterText = filterText.slice(0, -3);
        }

        // Only display filter text if filters are applied
        if (filterText) {
          doc.setFontSize(8);
          doc.text(`Filters: ${filterText}`, 105, 28, { align: 'center' });
        }

        // Debug the report data
        console.log('Report data received:', reportData);

        // Check if attendances array exists and has data
        if (!reportData.attendances || reportData.attendances.length === 0) {
          console.error('No attendance data found in the report data');
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No attendance data available for the selected period',
          });

          // Add a message to the PDF
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(12);
          doc.text('No attendance data available for the selected period', 105, 50, { align: 'center' });

          // Generate a blob from the PDF
          const pdfBlob = doc.output('blob');
          const pdfUrl = URL.createObjectURL(pdfBlob);

          // Create HTML wrapper with WhatsApp share button
          setLastGeneratedRange(rangeInfo);
          createHtmlWrapperWithPdf(pdfUrl, generateFilteredFilename(rangeInfo), true, rangeInfo);

          setPdfUrl(pdfUrl);
          setPdfBlob(pdfBlob);
          return;
        }

        // Prepare table data with the requested structure
        let tableColumn: string[];
        let tableRows: any[];

        if (statusFilter === 'LATE') {
          tableColumn = ["Employee", "Location", "Date", "Scheduled", "Check In", "Lateness", "Status"];
          tableRows = reportData.attendances.map((att: any) => [
            att.employee,
            att.location,
            att.date,
            att.scheduled,
            att.checkIn,
            att.lateness,
            att.status
          ]);
        } else {
          tableColumn = ["Employee", "Location", "Check In", "Check Out", "Duration", "Status"];
          tableRows = reportData.attendances.map((att: any) => [
            att.employee,
            att.location,
            att.checkIn,
            att.checkOut,
            att.duration,
            att.status
          ]);
        }

        // Add the table
        (doc as any).autoTable({
          head: [tableColumn],
          body: tableRows,
          startY: 35,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: {
            fillColor: [41, 98, 255],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          columnStyles: {
            0: { cellWidth: 35 }, // Employee
            1: { cellWidth: 25 }, // Location
            2: { cellWidth: 25 }, // Date / Check In
            3: { cellWidth: 30 }, // Scheduled / Check Out
            4: { cellWidth: 25 }, // Check In / Duration
            5: { // Lateness / Status
              cellWidth: 25,
              cellCallback: function (cell: any, data: any) {
                const statusValue = statusFilter === 'LATE' ? data.raw[6] : data.raw[5];
                if (statusValue === 'PRESENT' || statusValue === 'COMPLETED') {
                  cell.styles.textColor = [0, 128, 0]; // Green for present
                } else if (statusValue === 'LATE') {
                  cell.styles.textColor = [255, 127, 0]; // Orange for late
                } else if (statusValue === 'ABSENT') {
                  cell.styles.textColor = [255, 0, 0]; // Red for absent
                } else if (statusValue === 'OFF DUTY') {
                  cell.styles.textColor = [0, 0, 255]; // Blue for off duty
                } else if (statusValue === 'NO ROSTER') {
                  cell.styles.textColor = [128, 128, 128]; // Gray for no roster
                }
              }
            },
            6: { cellWidth: 0, overflow: 'hidden', display: 'none' } // Hidden Status for Late report
          },
          didParseCell: function(data: any) {
            // Apply location-specific colors to the Location column (index 1)
            if (data.section === 'body' && data.column.index === 1) {
              const locationName = data.cell.text[0];
              const { hex } = getLocationColor(locationName);
              
              // Apply strong text color and a bold font
              data.cell.styles.textColor = hex;
              data.cell.styles.fontStyle = 'bold';
            }
            
            // Apply status-specific colors
            if (data.section === 'body' && (data.column.index === 5 || (statusFilter === 'LATE' && data.column.index === 6))) {
              const statusValue = data.cell.text[0];
              if (statusValue === 'PRESENT' || statusValue === 'COMPLETED') data.cell.styles.textColor = [0, 128, 0]; else if (statusValue === 'IN PROGRESS' || statusValue === 'Currently Not Checked Out') data.cell.styles.textColor = [217, 119, 6];
              else if (statusValue === 'LATE') data.cell.styles.textColor = [255, 127, 0];
              else if (statusValue === 'ON LEAVE') data.cell.styles.textColor = [37, 99, 235]; else if (statusValue === 'OFF DAY' || statusValue === 'ABSENT') data.cell.styles.textColor = [217, 119, 6];
              else if (statusValue === 'OFF DUTY') data.cell.styles.textColor = [0, 0, 255];
            }
          },
          willDrawCell: function(data: any) {
             // Add a colored thin bar to the left of the location cell for a badge effect
             if (data.section === 'body' && data.column.index === 1) {
                const locationName = data.cell.text[0];
                const { hex } = getLocationColor(locationName);
                doc.setDrawColor(hex[0], hex[1], hex[2]);
                doc.setLineWidth(1.5);
                // Draw a vertical line on the left side of the cell
                doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
             }
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          // Pagination is disabled (single sheet), so we don't need recurring headers or page numbers
        });

        // Calculate dynamic y position for footer
        const finalY = (doc as any).lastAutoTable.finalY || 35;
        const footerY = Math.max(dynamicHeight - 20, finalY + 10);

        // Add footer at the bottom of the single sheet
        doc.setFillColor(245, 245, 245);
        doc.rect(0, footerY, 210, 20, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated at: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 10, footerY + 6);
        doc.text(`Generated by: ${reportData.generatedBy || 'System'}`, 10, footerY + 11);

        // Generate a blob from the PDF
        const pdfBlob = doc.output('blob');

        // Create a URL for the blob
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Create HTML wrapper with WhatsApp share button
        setLastGeneratedRange(rangeInfo);
        createHtmlWrapperWithPdf(pdfUrl, generateFilteredFilename(rangeInfo), false, rangeInfo);

        // Store the URL for potential sharing
        setPdfUrl(pdfUrl);
        setPdfBlob(pdfBlob);

        toast({
          title: 'Success',
          description: 'Attendance report generated successfully',
        });
      };

      // Generate the PDF
      await generatePDF();

    } catch (error: any) {
      console.error('Error generating PDF report:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to generate PDF report',
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Generate and download Excel report with a weekly/grid layout
  const generateExcelReport = async () => {
    try {
      if (dateFilter === 'range' && (!customDateRange?.from || !customDateRange?.to)) {
        toast({
          variant: 'destructive',
          title: 'Date range required',
          description: 'Please select both a start and end date before generating the report.',
        });
        setIsDateRangePopoverOpen(true);
        return;
      }

      setGeneratingExcel(true);

      const rangeInfo = getResolvedDateRange();
      const { startDate, endDate } = rangeInfo;
      
      // Calculate all days in the selected range
      const days = eachDayOfInterval({ 
        start: startOfDay(startDate), 
        end: endOfDay(endDate) 
      });

      // Fetch the detailed data
      const response = await fetch('/api/attendance/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          userId: employeeFilter !== 'ALL' ? employeeFilter : undefined,
          locationId: locationFilter !== 'ALL' ? locationFilter : undefined,
          status: 'ALL', // Get all records to determine presence
          includeDetails: true,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch report data');
      }

      const reportData = await response.json();
      
      // Filter employees to include in report
      let displayEmployees = employees;
      if (employeeFilter !== 'ALL') {
        displayEmployees = employees.filter(e => e.id === employeeFilter);
      } else if (locationFilter !== 'ALL') {
        // If location filter is set, only show employees who had at least one attendance record at that location
        const employeeNamesWithAttendance = new Set(reportData.attendances.map((a: any) => a.employee));
        displayEmployees = employees.filter(e => {
          const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email;
          return employeeNamesWithAttendance.has(name);
        });
        
        // If no employees found with attendance but a filter is active, 
        // fallback to search results or just show empty table
        if (displayEmployees.length === 0 && reportData.attendances.length === 0) {
           // Keep empty
        }
      }

      // Group attendance by employee and date
      const attendanceMap: Record<string, Set<string>> = {}; const approvedLeavesMap: Record<string, Set<string>> = {}; if (reportData.approvedLeavesByEmployee) { Object.entries(reportData.approvedLeavesByEmployee).forEach(([k, v]: [string, any]) => { approvedLeavesMap[k] = new Set(Array.isArray(v) ? v : []); }); }
      reportData.attendances.forEach((att: any) => {
        const empName = att.employee; if (att.status === 'ON LEAVE' || att.status === 'OFF DAY' || att.status === 'ABSENT' || att.isPresentRecord === false) return;
        if (!attendanceMap[empName]) attendanceMap[empName] = new Set();
        
        // Robustly extract date part: "Apr 13, 2026 11:17:23" -> "Apr 13, 2026"
        // The API returns dates in format: "MMM d, yyyy HH:mm:ss"
        const dateMatch = att.checkIn.match(/^[A-Z][a-z]{2}\s\d{1,2},\s\d{4}/);
        if (dateMatch) {
          attendanceMap[empName].add(dateMatch[0]);
        } else {
          // Fallback if format is different (e.g. "3/14/2026")
          const d = new Date(att.checkIn);
          if (!isNaN(d.getTime())) {
            attendanceMap[empName].add(format(d, 'MMM d, yyyy'));
          }
        }
      });

      const periodDescription = getPeriodDescription(rangeInfo);
      
      let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <style>
            table { border-collapse: collapse; border: 1px solid #999; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            th { background-color: #1A237E; color: white; padding: 12px; text-align: center; border: 1px solid #999; font-size: 13px; }
            td { padding: 10px; border: 1px solid #ccc; font-size: 13px; }
            .emp-name { text-align: left; font-weight: bold; min-width: 200px; background-color: #F5F5F5; border-right: 2px solid #999; }
            .header-info { font-size: 24px; font-weight: bold; margin-bottom: 5px; color: #1A237E; text-align: center; }
            .period-info { font-size: 16px; margin-bottom: 25px; text-align: center; color: #555; }
            .tick { color: #2E7D32; font-weight: bold; font-size: 18px; text-align: center; }
            .cross { color: #B45309; background-color: #FFFBEB; font-weight: bold; font-size: 11px; text-align: center; } .on-leave { color: #1D4ED8; background-color: #EFF6FF; font-weight: bold; font-size: 11px; text-align: center; }
            .stats { text-align: center; font-weight: bold; background-color: #EEE; border-left: 2px solid #999; }
          </style>
        </head>
        <body>
          <div class="header-info">Employee Attendance Report</div>
          <div class="period-info">Period: ${periodDescription}</div>
          <table>
            <thead>
              <tr>
                <th rowspan="2">Employee Name</th>
                <th colspan="${days.length}">Daily Attendance Status (✓=Present, ON LEAVE=Approved Leave, OFF DAY=Absent)</th>
                <th rowspan="2" style="background-color: #0D47A1;">Total Present</th>
                <th rowspan="2" style="background-color: #B71C1C;">Total Absent</th>
              </tr>
              <tr>
                ${days.map(day => `<th style="min-width: 50px;">${format(day, 'EEE')}<br/><small>${format(day, 'MMM d')}</small></th>`).join('')}
              </tr>
            </thead>
            <tbody>
      `;

      displayEmployees.forEach((emp) => {
        const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
        let presentCount = 0;
        let absentCount = 0;

        html += `<tr><td class="emp-name">${name}</td>`;
        
        days.forEach(day => {
          const dayStr = format(day, 'MMM d, yyyy');
          const isPresent = attendanceMap[name] && attendanceMap[name].has(dayStr);
          
          if (isPresent) {
            presentCount++;
            html += `<td class="tick">✓</td>`;
          } else {
            absentCount++;
            const isOnLeave = approvedLeavesMap[name] && approvedLeavesMap[name].has(dayStr); html += isOnLeave ? `<td class="on-leave">ON LEAVE</td>` : `<td class="cross">OFF DAY</td>`;
          }
        });

        html += `
          <td class="stats" style="color: #2E7D32;">${presentCount}</td>
          <td class="stats" style="color: #C62828;">${absentCount}</td>
        </tr>`;
      });

      html += `
            </tbody>
          </table>
          <div style="margin-top: 25px; border-top: 1px solid #ccc; padding-top: 10px;">
            <p style="font-size: 12px; color: #444;"><strong>Report Summary:</strong> Generated from Employee Geofencing System.</p>
            <p style="font-size: 10px; color: #888;">Report Timestamp: ${format(new Date(), 'MMM d, yyyy h:mm a')}</p>
          </div>
        </body>
        </html>
      `;

      // Create a Blob from the HTML and trigger download
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${generateFilteredFilename(rangeInfo)}_Weekly_Tracker.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Excel Report Ready',
        description: 'New grid-layout attendance report downloaded successfully.',
      });

    } catch (error: any) {
      console.error('Error generating Excel report:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to generate Excel report',
      });
    } finally {
      setGeneratingExcel(false);
    }
  };

  // Create HTML wrapper with PDF and WhatsApp share button
  const createHtmlWrapperWithPdf = (pdfUrl: string, filename: string, isEmpty: boolean, rangeInfo: DateRangeInfo) => {
    // Create WhatsApp sharing message with filter details for PDF link
    let pdfMessage = `📊 *Employee Attendance Report*\n\n`;

    const periodDescription = getPeriodDescription(rangeInfo);

    // Add period information
    pdfMessage += `*Period:* ${periodDescription}\n`;

    // Add status information if filtered
    if (statusFilter !== 'ALL') {
      pdfMessage += `*Status:* ${statusFilter}\n`;
    }

    // Add location information if filtered
    if (locationFilter !== 'ALL') {
      const locationName = locations.find(loc => loc.id === locationFilter)?.name || 'Selected Location';
      pdfMessage += `*Location:* ${locationName}\n`;
    }

    // Add employee information if filtered
    if (employeeFilter !== 'ALL') {
      const employee = employees.find(emp => emp.id === employeeFilter);
      const employeeName = employee
        ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email
        : 'Selected Employee';
      pdfMessage += `*Employee:* ${employeeName}\n`;
    }

    // Add note about empty report if applicable
    if (isEmpty) {
      pdfMessage += `\n*Note:* No attendance data available for the selected period.\n`;
    }

    // Add company name
    pdfMessage += `\nGenerated from Employee Management System on ${format(new Date(), 'MMM d, yyyy h:mm a')}`;

    // Create a more detailed text summary for plain text sharing
    let textSummary = `📊 *ATTENDANCE REPORT SUMMARY*\n\n`;

    // Add header with date and time
    textSummary += `*Generated:* ${format(new Date(), 'MMM d, yyyy h:mm a')}\n\n`;

    // Add period information
    textSummary += `*Period:* ${periodDescription}\n`;

    // Add filter information
    if (statusFilter !== 'ALL') {
      textSummary += `*Status Filter:* ${statusFilter}\n`;
    }

    if (locationFilter !== 'ALL') {
      const locationName = locations.find(loc => loc.id === locationFilter)?.name || 'Selected Location';
      textSummary += `*Location:* ${locationName}\n`;
    }

    if (employeeFilter !== 'ALL') {
      const employee = employees.find(emp => emp.id === employeeFilter);
      const employeeName = employee
        ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email
        : 'Selected Employee';
      textSummary += `*Employee:* ${employeeName}\n`;
    }

    textSummary += `\n*SUMMARY STATISTICS*\n`;

    if (isEmpty) {
      textSummary += `No attendance data available for the selected period.\n`;
    } else {
      // Add some statistics about the report
      textSummary += `- Total Records: ${filteredAttendances.length}\n`;

      // Count by status
      const presentCount = filteredAttendances.filter(a => a.status === 'COMPLETED' || a.status === 'Currently Not Checked Out' || a.status === 'IN PROGRESS' || a.status === 'PRESENT').length;
      const lateCount = filteredAttendances.filter(a => a.status === 'LATE').length;
      const absentCount = filteredAttendances.filter(a => a.status === 'ABSENT').length;
      const otherCount = filteredAttendances.length - presentCount - lateCount - absentCount;

      textSummary += `- Present: ${presentCount}\n`;
      textSummary += `- Late: ${lateCount}\n`;
      textSummary += `- Absent: ${absentCount}\n`;
      if (otherCount > 0) {
        textSummary += `- Other: ${otherCount}\n`;
      }

      // Add attendance rate
      const attendanceRate = ((presentCount + lateCount) / filteredAttendances.length * 100).toFixed(1);
      textSummary += `- Attendance Rate: ${attendanceRate}%\n`;

      // Add punctuality rate
      const punctualityRate = (presentCount / (presentCount + lateCount) * 100).toFixed(1);
      textSummary += `- Punctuality Rate: ${punctualityRate}%\n`;
    }

    textSummary += `\n*For detailed information, please refer to the full report.*\n\n`;
    textSummary += `Employee Management System`;

    // Encode messages for WhatsApp
    const encodedPdfMessage = encodeURIComponent(pdfMessage);
    const encodedTextSummary = encodeURIComponent(textSummary);

    // Create WhatsApp sharing URLs
    const pdfWhatsappUrl = `https://wa.me/?text=${encodedPdfMessage}`;
    const textWhatsappUrl = `https://wa.me/?text=${encodedTextSummary}`;

    // Create an HTML wrapper with the PDF and WhatsApp share button
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Attendance Report</title>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
          }
          .header {
            background-color: #f0f0f0;
            padding: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 100;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            margin: 0;
          }
          .actions {
            display: flex;
            gap: 10px;
          }
          .whatsapp-btn {
            background-color: #25D366;
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .download-btn {
            background-color: #4285F4;
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          }
          .pdf-container {
            flex-grow: 1;
            margin-top: 60px;
            width: 100%;
            height: calc(100% - 60px);
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
          
          /* Modal styles */
          .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 200;
            justify-content: center;
            align-items: center;
          }
          .modal-content {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
          }
          .modal-title {
            font-size: 18px;
            font-weight: bold;
            margin: 0;
          }
          .close-btn {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #666;
          }
          .share-options {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }
          .share-option {
            display: flex;
            align-items: center;
            padding: 15px;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .share-option:hover {
            background-color: #f5f5f5;
          }
          .share-option-icon {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            border-radius: 50%;
          }
          .share-option-icon.pdf {
            background-color: #f44336;
            color: white;
          }
          .share-option-icon.text {
            background-color: #4caf50;
            color: white;
          }
          .share-option-content {
            flex: 1;
          }
          .share-option-title {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .share-option-description {
            font-size: 14px;
            color: #666;
          }
          
          @media (max-width: 768px) {
            .title {
              font-size: 16px;
            }
            .whatsapp-btn, .download-btn {
              width: 36px;
              height: 36px;
            }
            .modal-content {
              width: 95%;
              padding: 15px;
            }
            .share-option {
              padding: 12px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Attendance Report</h1>
          <div class="actions">
            <button class="download-btn" onclick="downloadPDF()" title="Download PDF">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button class="whatsapp-btn" onclick="openShareModal()" title="Share on WhatsApp">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Share Modal -->
        <div id="shareModal" class="modal">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title">Share on WhatsApp</h2>
              <button class="close-btn" onclick="closeShareModal()">&times;</button>
            </div>
            <div class="share-options">
              <div class="share-option" onclick="shareFullPDF()">
                <div class="share-option-icon pdf">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                </div>
                <div class="share-option-content">
                  <div class="share-option-title">Share Full Report</div>
                  <div class="share-option-description">Share a message with a link to view or download the complete PDF report</div>
                </div>
              </div>
              <div class="share-option" onclick="shareTextSummary()">
                <div class="share-option-icon text">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                </div>
                <div class="share-option-content">
                  <div class="share-option-title">Share Text Summary</div>
                  <div class="share-option-description">Share a plain text summary with key statistics from the report</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="pdf-container">
          <iframe src="${pdfUrl}" type="application/pdf"></iframe>
        </div>
        
        <script>
          function downloadPDF() {
            const link = document.createElement('a');
            link.href = "${pdfUrl}";
            link.download = "${filename}.pdf";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          
          function openShareModal() {
            document.getElementById('shareModal').style.display = 'flex';
          }
          
          function closeShareModal() {
            document.getElementById('shareModal').style.display = 'none';
          }
          
          function shareFullPDF() {
            window.open("${pdfWhatsappUrl}", "_blank");
            closeShareModal();
          }
          
          function shareTextSummary() {
            window.open("${textWhatsappUrl}", "_blank");
            closeShareModal();
          }
          
          // Close modal when clicking outside of it
          window.onclick = function(event) {
            const modal = document.getElementById('shareModal');
            if (event.target === modal) {
              closeShareModal();
            }
          }
        </script>
      </body>
      </html>
    `;

    // Create a blob from the HTML
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const htmlUrl = URL.createObjectURL(htmlBlob);

    // Open the HTML wrapper in a new tab
    window.open(htmlUrl, '_blank');
  };

  // State for PDF sharing
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  // Generate a filename with filter information
  const generateFilteredFilename = (rangeInfo?: DateRangeInfo) => {
    const resolvedRange = rangeInfo ?? lastGeneratedRange ?? getResolvedDateRange();
    let filename = `Attendance_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}`;

    // Add status to filename if filtered
    if (statusFilter !== 'ALL') {
      filename += `_${statusFilter}`;
    }

    // Add location to filename if filtered
    if (locationFilter !== 'ALL') {
      const locationName = locations.find(loc => loc.id === locationFilter)?.name || 'Location';
      filename += `_${locationName.replace(/\s+/g, '_')}`;
    }

    // Add employee to filename if filtered
    if (employeeFilter !== 'ALL') {
      const employee = employees.find(emp => emp.id === employeeFilter);
      const employeeName = employee
        ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email
        : 'Employee';
      filename += `_${employeeName.replace(/\s+/g, '_')}`;
    }

    // Add date filter to filename
    if (resolvedRange.filterKey === 'range') {
      filename += `_${format(resolvedRange.startDate, 'yyyyMMdd')}-${format(resolvedRange.endDate, 'yyyyMMdd')}`;
    } else if (resolvedRange.filterKey !== 'all') {
      filename += `_${resolvedRange.filterKey}`;
    }

    return filename;
  };

  // Download the generated PDF
  const downloadPDF = () => {
    if (!pdfUrl || !pdfBlob) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No PDF has been generated yet',
      });
      return;
    }

    const link = document.createElement('a');
    const rangeForFilename = lastGeneratedRange ?? getResolvedDateRange();
    link.href = pdfUrl;
    link.download = `${generateFilteredFilename(rangeForFilename)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Success',
      description: 'Attendance report downloaded successfully',
    });
  };

  // Share via WhatsApp
  const shareViaWhatsApp = () => {
    if (!pdfUrl) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No PDF has been generated yet',
      });
      return;
    }

    // Create filter information for the message
    let filterInfo = '';
    const rangeInfo = lastGeneratedRange ?? getResolvedDateRange();
    const periodDescription = getPeriodDescription(rangeInfo);

    // Add date range info
    filterInfo += `*Period:* ${periodDescription}\n`;

    // Add status filter info if not ALL
    if (statusFilter !== 'ALL') {
      filterInfo += `*Status:* ${statusFilter}\n`;
    }

    // Add location filter info if not ALL
    if (locationFilter !== 'ALL') {
      const locationName = locations.find(loc => loc.id === locationFilter)?.name || 'Selected Location';
      filterInfo += `*Location:* ${locationName}\n`;
    }

    if (employeeFilter !== 'ALL') {
      const employee = employees.find(emp => emp.id === employeeFilter);
      const employeeName = employee
        ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email
        : 'Selected Employee';
      filterInfo += `*Employee:* ${employeeName}\n`;
    }

    // Create a detailed message for WhatsApp with filter information
    const message = `📊 *Employee Attendance Report*\n\nI'm sharing an attendance report generated on ${format(new Date(), 'MMM d, yyyy h:mm a')}.\n\n${filterInfo}\nPlease check the attached PDF for details.`;

    // Encode the message for a URL
    const encodedMessage = encodeURIComponent(message);

    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;

    // Open WhatsApp in a new window
    window.open(whatsappUrl, '_blank');

    toast({
      title: 'WhatsApp Share',
      description: 'Sharing attendance report via WhatsApp',
    });
  };

  // Filter attendances based on search term, status, date, and location
  const filteredAttendances = React.useMemo(() => {
    return attendances.filter(attendance => {
      // Search filter
      const matchesSearch =
        searchTerm === '' ||
        attendance.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (attendance.user.firstName && attendance.user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (attendance.user.lastName && attendance.user.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        attendance.location.name.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      let matchesStatus = false;
      if (statusFilter === 'ALL') {
        matchesStatus = true;
      } else if (statusFilter === 'ACTIVE' || statusFilter === 'IN PROGRESS' || statusFilter === 'Currently Not Checked Out') {
        matchesStatus = attendance.checkOutTime === null && attendance.status !== 'ABSENT' && attendance.status !== 'ON LEAVE' && attendance.status !== 'OFF DAY';
      } else {
        matchesStatus = statusFilter === 'ABSENT' ? (attendance.status === 'ABSENT' || attendance.status === 'ON LEAVE' || attendance.status === 'OFF DAY') : (statusFilter === 'COMPLETED' || statusFilter === 'PRESENT') ? (attendance.checkOutTime !== null && attendance.status !== 'ABSENT' && attendance.status !== 'ON LEAVE' && attendance.status !== 'OFF DAY') : (attendance.status === statusFilter || (attendance as any).originalStatus === statusFilter);
      }

      // Location filter
      const matchesLocation = locationFilter === 'ALL' || attendance.locationId === locationFilter;

      // Employee filter
      const matchesEmployee = employeeFilter === 'ALL' || attendance.userId === employeeFilter;

      // Department filter
      const matchesDepartment = departmentFilter === 'ALL' || attendance.user.department === departmentFilter;

      // Date filter
      let matchesDate = true;
      const checkInDate = parseISO(attendance.checkInTime);

      if (dateFilter === 'today') {
        matchesDate = isToday(checkInDate);
      } else if (dateFilter === 'yesterday') {
        matchesDate = isYesterday(checkInDate);
      } else if (dateFilter === 'thisWeek') {
        matchesDate = isThisWeek(checkInDate, { weekStartsOn: 1 });
      } else if (dateFilter === 'thisMonth') {
        matchesDate = isThisMonth(checkInDate);
      } else if (dateFilter === 'range' && customDateRange?.from && customDateRange?.to) {
        const rangeStart = startOfDay(customDateRange.from);
        const rangeEnd = endOfDay(customDateRange.to);
        matchesDate = checkInDate >= rangeStart && checkInDate <= rangeEnd;
      }

      // Overdue filter (only for ACTIVE status)
      let matchesOverdue = true;
      if (statusFilter === 'ACTIVE' && overdueOnly) {
        matchesOverdue = isAttendanceOverdue(attendance);
      }

      return matchesSearch && matchesStatus && matchesDate && matchesLocation && matchesEmployee && matchesDepartment && matchesOverdue;
    });
  }, [attendances, searchTerm, statusFilter, locationFilter, employeeFilter, departmentFilter, dateFilter, customDateRange, overdueOnly]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <CardTitle>Attendance Reports</CardTitle>
              <CardDescription>
                View and analyze employee attendance records
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={generatePDFReport}
                disabled={
                  generatingPDF ||
                  (dateFilter === 'range' && (!customDateRange?.from || !customDateRange?.to)) ||
                  (statusFilter === 'ABSENT' && !hasFetchedAbsent) ||
                  (statusFilter === 'LATE' && !hasFetchedLate) ||
                  (statusFilter === 'ABSENT' && absentEmployees.length === 0) ||
                  (statusFilter === 'LATE' && lateEmployees.length === 0) ||
                  (statusFilter === 'ALL' && filteredAttendances.length === 0)
                }
                className="flex-1 sm:flex-none"
              >
                {generatingPDF ? (
                  <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FaFilePdf className="mr-2 h-4 w-4" />
                )}
                {statusFilter === 'ABSENT'
                  ? 'Generate Absent Report'
                  : statusFilter === 'LATE'
                    ? 'Generate Late Report'
                    : 'Generate Report'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateExcelReport}
                disabled={
                  generatingExcel ||
                  (dateFilter === 'range' && (!customDateRange?.from || !customDateRange?.to)) ||
                  (statusFilter === 'ABSENT' && !hasFetchedAbsent) ||
                  (statusFilter === 'LATE' && !hasFetchedLate) ||
                  (statusFilter === 'ABSENT' && absentEmployees.length === 0) ||
                  (statusFilter === 'LATE' && lateEmployees.length === 0) ||
                  (statusFilter === 'ALL' && filteredAttendances.length === 0)
                }
                className="flex-1 sm:flex-none border-green-200 text-green-700 hover:bg-green-50"
              >
                {generatingExcel ? (
                  <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FaFileExcel className="mr-2 h-4 w-4" />
                )}
                Excel Report
              </Button>
              {pdfUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadPDF}
                    className="flex-1 sm:flex-none"
                  >
                    <FaDownload className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareViaWhatsApp}
                    className="flex-1 sm:flex-none"
                  >
                    <FaWhatsapp className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* View Mode Toggle Bar (General Reports vs Department Analytics) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-5">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border">
              <button
                type="button"
                onClick={() => setViewMode('ALL_REPORTS')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                  viewMode === 'ALL_REPORTS'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FaLayerGroup className="h-3.5 w-3.5" />
                General Reports
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('DEPARTMENT_ANALYTICS');
                  fetchDepartmentReport(departmentFilter);
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                  viewMode === 'DEPARTMENT_ANALYTICS'
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FaBuilding className="h-3.5 w-3.5 text-primary" />
                Department Analytics
              </button>
            </div>
            
            {viewMode === 'DEPARTMENT_ANALYTICS' && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FaBuilding className="h-3.5 w-3.5 text-primary" />
                <span>Viewing Department Breakdown & Lateness Durations</span>
              </div>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employees, positions or locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                // Auto-switch to All Time when selecting Late or Absent so historical records show
                if (value === 'LATE' || value === 'ABSENT') {
                  if (dateFilter === 'today' || dateFilter === 'yesterday') {
                    setDateFilter('all');
                  }
                  // Auto-fetch specialized reports
                  if (value === 'ABSENT') fetchAbsentEmployees();
                  if (value === 'LATE') fetchLateEmployees();
                }
                // Clear specialized data when switching away
                if (value !== 'ABSENT') {
                  setAbsentEmployees([]);
                  setHasFetchedAbsent(false);
                }
                if (value !== 'LATE') {
                  setLateEmployees([]);
                  setHasFetchedLate(false);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Currently Not Checked Out</SelectItem><SelectItem value="IN PROGRESS">In Progress (Checked In)</SelectItem>
                  <SelectItem value="COMPLETED">Completed (Checked Out)</SelectItem>
                  <SelectItem value="LATE">Late</SelectItem>
                  <SelectItem value="ON LEAVE">On Leave</SelectItem><SelectItem value="OFF DAY">Off Day</SelectItem><SelectItem value="ABSENT">Absent (On Leave / Off Day)</SelectItem>
                  <SelectItem value="OVERTIME">Overtime</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={handleDateFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="thisWeek">This Week</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="range">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              <Select value={locationFilter} onValueChange={(value) => {
                setLocationFilter(value);
                if (statusFilter === 'ABSENT') fetchAbsentEmployees();
                if (statusFilter === 'LATE') fetchLateEmployees();
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Locations</SelectItem>
                  {locations.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={departmentFilter} onValueChange={(value) => {
                setDepartmentFilter(value);
                fetchDepartmentReport(value);
                if (statusFilter === 'ABSENT') fetchAbsentEmployees();
                if (statusFilter === 'LATE') fetchLateEmployees();
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {departmentsList.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover open={isEmployeePopoverOpen} onOpenChange={setIsEmployeePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isEmployeePopoverOpen}
                    className="w-full justify-between font-normal text-sm"
                  >
                    <span className="truncate">
                    {employeeFilter === 'ALL'
                      ? "All Employees"
                      : employees.find((emp) => emp.id === employeeFilter)
                        ? (employees.find((emp) => emp.id === employeeFilter)!.firstName && employees.find((emp) => emp.id === employeeFilter)!.lastName
                            ? `${employees.find((emp) => emp.id === employeeFilter)!.firstName} ${employees.find((emp) => emp.id === employeeFilter)!.lastName}`
                            : employees.find((emp) => emp.id === employeeFilter)!.firstName || employees.find((emp) => emp.id === employeeFilter)!.email)
                        : "All Employees"}
                    </span>
                    <FaChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command
                    filter={(value, search) => {
                      if (value.includes(search.toLowerCase())) return 1;
                      return 0;
                    }}
                  >
                    <CommandInput placeholder="Search employees or departments..." />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          key="ALL"
                          value="all employees"
                          onSelect={() => {
                            setEmployeeFilter("ALL");
                            setIsEmployeePopoverOpen(false);
                            if (statusFilter === 'ABSENT') fetchAbsentEmployees();
                            if (statusFilter === 'LATE') fetchLateEmployees();
                          }}
                        >
                          <FaCheck
                            className={cn(
                              "mr-2 h-4 w-4",
                              employeeFilter === "ALL" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          All Employees
                        </CommandItem>
                        {(employees.length > 0 ? employees : Array.from(new Map(attendances.map(a => [a.user.id, a.user])).values())).map((employee) => {
                          const empName = employee.firstName && employee.lastName
                            ? `${employee.firstName} ${employee.lastName}`
                            : employee.firstName || employee.email;
                          const dept = employee.department || "No Department";
                          const searchValue = `${empName} ${dept} ${employee.email}`.toLowerCase();
                          
                          return (
                            <CommandItem
                              key={employee.id}
                              value={searchValue}
                              onSelect={() => {
                                setEmployeeFilter(employee.id);
                                setIsEmployeePopoverOpen(false);
                                if (statusFilter === 'ABSENT') fetchAbsentEmployees();
                                if (statusFilter === 'LATE') fetchLateEmployees();
                              }}
                            >
                              <FaCheck
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  employeeFilter === employee.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{empName}</span>
                                <span className="text-[10px] text-muted-foreground">{dept}</span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Popover open={isDateRangePopoverOpen} onOpenChange={setIsDateRangePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start font-normal text-sm",
                      !customDateRange?.from && "text-muted-foreground",
                      isCustomRangeActive && "border-primary text-primary"
                    )}
                  >
                    <FaCalendarAlt className="mr-2 h-4 w-4" />
                    {customRangeButtonText}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customDateRange?.from ?? customDateRange?.to}
                    selected={customDateRange}
                    onSelect={handleDateRangeSelect}
                    numberOfMonths={2}
                  />
                  <div className="flex items-center justify-between gap-2 border-t p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCustomDateRange}
                      disabled={!customDateRange?.from && !customDateRange?.to}
                    >
                      Clear
                    </Button>
                    <Button size="sm" onClick={() => setIsDateRangePopoverOpen(false)}>
                      Done
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {statusFilter === 'ACTIVE' && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="overdueOnly"
                  checked={overdueOnly}
                  onChange={(e) => setOverdueOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="overdueOnly" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Show Overdue Only (Shift End Time Passed)
                </label>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {selectedIds.length} of {filteredAttendances.length} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleForceCheckout}
                  disabled={selectedIds.length === 0 || forcingCheckout}
                  className="font-bold flex items-center"
                >
                  {forcingCheckout ? (
                    <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FaUserClock className="mr-2 h-4 w-4" />
                  )}
                  {forcingCheckout ? 'Checking out...' : 'Force Check-out'}
                </Button>
              </div>
            </div>
          )}

          {/* Department Analytics View */}
          {viewMode === 'DEPARTMENT_ANALYTICS' ? (
            <div className="space-y-6">
              {/* Department Selector Chips */}
              <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
                <Button
                  type="button"
                  variant={departmentFilter === 'ALL' ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs rounded-full"
                  onClick={() => {
                    setDepartmentFilter('ALL');
                    fetchDepartmentReport('ALL');
                  }}
                >
                  <FaBuilding className="mr-1.5 h-3 w-3" /> All Departments
                </Button>
                {departmentsList.map((dept) => (
                  <Button
                    key={dept.id}
                    type="button"
                    variant={departmentFilter === dept.id ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs rounded-full"
                    onClick={() => {
                      setDepartmentFilter(dept.id);
                      fetchDepartmentReport(dept.id);
                    }}
                  >
                    <span>{dept.name}</span>
                    {dept._count?.employees !== undefined && (
                      <span className="ml-1.5 px-1.5 py-0.2 bg-primary/20 text-primary rounded-full text-[10px] font-bold">
                        {dept._count.employees}
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              {loadingDeptReport ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <FaSpinner className="animate-spin h-8 w-8 text-primary" />
                  <p className="text-sm text-muted-foreground">Loading department attendance records...</p>
                </div>
              ) : departmentReportData ? (
                <div className="space-y-6">
                  {/* Department Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold">Total Staff</p>
                          <p className="text-2xl font-bold mt-1 text-foreground">{departmentReportData.summary?.totalStaff || 0}</p>
                          <p className="text-[11px] text-muted-foreground">Head & Employees</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold">
                          <FaUsers className="h-5 w-5" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">Checked In</p>
                          <p className="text-2xl font-bold mt-1 text-emerald-900 dark:text-emerald-200">
                            {departmentReportData.summary?.checkedInCount || 0}
                          </p>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            {departmentReportData.summary?.totalStaff > 0
                              ? Math.round((departmentReportData.summary.checkedInCount / departmentReportData.summary.totalStaff) * 100)
                              : 0}% Active
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 flex items-center justify-center font-bold">
                          <FaUserCheck className="h-5 w-5" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-green-50/60 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-green-800 dark:text-green-300 font-semibold">On Time / Present</p>
                          <p className="text-2xl font-bold mt-1 text-green-900 dark:text-green-200">
                            {departmentReportData.summary?.onTimeCount || 0}
                          </p>
                          <p className="text-[11px] text-green-700 dark:text-green-400">Punctual arrival</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 text-green-600 flex items-center justify-center font-bold">
                          <FaClock className="h-5 w-5" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">Late Arrival</p>
                          <p className="text-2xl font-bold mt-1 text-amber-900 dark:text-amber-200">
                            {departmentReportData.summary?.lateCount || 0}
                          </p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">Delayed arrival</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 flex items-center justify-center font-bold">
                          <FaExclamationTriangle className="h-5 w-5" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Not Checked In</p>
                          <p className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-200">
                            {departmentReportData.summary?.absentCount || 0}
                          </p>
                          <p className="text-[11px] text-muted-foreground">Absent or Pending</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
                          <FaUserTimes className="h-5 w-5" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Department Member Attendance Table */}
                  <div className="rounded-xl border overflow-hidden bg-card shadow-sm">
                    <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FaBuilding className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-sm">
                          Department Members Attendance Breakdown ({departmentReportData.members?.length || 0})
                        </h3>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">Date: {departmentReportData.date}</span>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="font-bold">Member & Role</TableHead>
                            <TableHead className="font-bold">Department</TableHead>
                            <TableHead className="font-bold">Status</TableHead>
                            <TableHead className="font-bold">Check-In Time</TableHead>
                            <TableHead className="font-bold">Check-Out Time</TableHead>
                            <TableHead className="font-bold">Lateness Duration</TableHead>
                            <TableHead className="font-bold">Location</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {departmentReportData.members
                            ?.filter((m: any) => {
                              if (!searchTerm) return true;
                              const term = searchTerm.toLowerCase();
                              return (
                                m.fullName.toLowerCase().includes(term) ||
                                m.email.toLowerCase().includes(term) ||
                                m.position?.toLowerCase().includes(term) ||
                                m.departmentName?.toLowerCase().includes(term)
                              );
                            })
                            .map((m: any) => (
                              <TableRow key={m.id} className={m.isDepartmentHead ? 'bg-primary/5 hover:bg-primary/10' : ''}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5 font-semibold text-sm">
                                      {m.fullName}
                                      {m.isDepartmentHead && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                          <FaUserTie className="h-3 w-3" /> Head
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{m.email}</span>
                                    <span className="text-[11px] text-slate-500">{m.position}</span>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <span className="font-medium text-xs text-foreground bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border">
                                    {m.departmentName}
                                  </span>
                                </TableCell>

                                <TableCell>
                                  {(m.status === 'Currently Not Checked Out' || m.status === 'IN PROGRESS' || m.status === 'ON_TIME') && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 whitespace-nowrap">
                                      {m.statusLabel || 'Currently Not Checked Out'}
                                    </span>
                                  )}
                                  {(m.status === 'COMPLETED' || m.status === 'PRESENT') && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border border-green-300">
                                      {m.statusLabel}
                                    </span>
                                  )}
                                  {m.status === 'LATE' && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                                      Late ({m.lateDurationFormatted})
                                    </span>
                                  )}
                                  {(m.status === 'OFF DAY' || m.status === 'ABSENT') && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300">
                                      OFF DAY
                                    </span>
                                  )}
                                  {(m.status === 'ON LEAVE' || m.status === 'ON_LEAVE') && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
                                      ON LEAVE
                                    </span>
                                  )}
                                </TableCell>

                                <TableCell>
                                  {m.checkInTime ? (
                                    <div className="flex items-center gap-1.5 text-xs font-medium">
                                      <FaClock className="h-3 w-3 text-emerald-600" />
                                      {m.checkInTime}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">-</span>
                                  )}
                                </TableCell>

                                <TableCell>
                                  {m.checkOutTime ? (
                                    <div className="flex items-center gap-1.5 text-xs font-medium">
                                      <FaClock className="h-3 w-3 text-red-500" />
                                      {m.checkOutTime}
                                    </div>
                                  ) : m.hasCheckedIn ? (
                                    <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      Currently Not Checked Out
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">-</span>
                                  )}
                                </TableCell>

                                <TableCell>
                                  {m.isLate ? (
                                    <div className="flex flex-col">
                                      <span className="font-bold text-xs text-rose-600 dark:text-rose-400">
                                        Late by {m.lateDurationFormatted}
                                      </span>
                                      {m.rosterStartTime && (
                                        <span className="text-[10px] text-muted-foreground">
                                          Scheduled start: {m.rosterStartTime}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-emerald-600 font-medium">On Time</span>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <span className="text-xs text-muted-foreground">{m.locationName}</span>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  No department records found for the selected filter.
                </div>
              )}
            </div>
          ) : statusFilter === 'ABSENT' ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Showing employees with no check-ins during the selected period
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAbsentEmployees}
                  disabled={loadingAbsent}
                >
                  {loadingAbsent ? (
                    <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FaUserTimes className="mr-2 h-4 w-4" />
                  )}
                  {loadingAbsent ? 'Loading...' : 'Fetch Absent Records'}
                </Button>
              </div>
              {loadingAbsent ? (
                <div className="flex justify-center py-8">
                  <FaSpinner className="animate-spin h-8 w-8 text-primary" />
                </div>
              ) : absentEmployees.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="hidden md:table-cell">Position</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {absentEmployees
                          .filter(emp => {
                            if (searchTerm === '') return true;
                            const term = searchTerm.toLowerCase();
                            return (
                              emp.employeeName.toLowerCase().includes(term) ||
                              emp.email.toLowerCase().includes(term)
                            );
                          })
                          .filter(emp => {
                            if (employeeFilter === 'ALL') return true;
                            return emp.userId === employeeFilter || emp.id.startsWith(employeeFilter);
                          })
                          .map((emp) => (
                            <TableRow key={emp.id}>
                              <TableCell className="font-medium">
                                {emp.employeeName}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {emp.email}
                                </span>
                              </TableCell>
                              <TableCell>
                                {emp.date}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {emp.position}
                              </TableCell>
                              <TableCell>
                                <span className={emp.status === 'ON LEAVE' ? "px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300" : "px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300"}>
                                  {emp.status || 'OFF DAY'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {!hasFetchedAbsent && !loadingAbsent
                    ? 'Wait a moment, fetching absent records...'
                    : 'No absent employees found for the selected period and filters.'}
                </div>
              )}
            </>
          ) : statusFilter === 'LATE' ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Showing only late attendance records during the selected period
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchLateEmployees}
                  disabled={loadingLate}
                >
                  {loadingLate ? (
                    <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FaUserClock className="mr-2 h-4 w-4" />
                  )}
                  {loadingLate ? 'Loading...' : 'Fetch Late Records'}
                </Button>
              </div>

              {lateSummary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card className="bg-orange-50/50 col-span-1 sm:col-span-2">
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium text-orange-600 mb-1">Late Attendances</div>
                        <div className="text-2xl font-bold">{lateSummary.totalLateAttendances}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-orange-600 mb-1">Total Analyzed</div>
                        <div className="text-xl font-semibold">{lateSummary.totalRecords}</div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round((lateSummary.totalLateAttendances / lateSummary.totalRecords) * 100)}% late
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-50/50 col-span-1 sm:col-span-2">
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium text-purple-600 mb-1">Total Late Time</div>
                        <div className="text-2xl font-bold">{lateSummary.totalLateMinutes}</div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        Avg: {lateSummary.averageLateMinutes}/record
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              {loadingLate ? (
                <div className="flex justify-center py-8">
                  <FaSpinner className="animate-spin h-8 w-8 text-primary" />
                </div>
              ) : lateEmployees.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Scheduled</TableHead>
                          <TableHead>Check In</TableHead>
                          <TableHead>Lateness</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lateEmployees
                          .filter(emp => {
                            if (searchTerm === '') return true;
                            const term = searchTerm.toLowerCase();
                            return (
                              emp.employeeName.toLowerCase().includes(term) ||
                              emp.email.toLowerCase().includes(term) ||
                              emp.location.toLowerCase().includes(term)
                            );
                          })
                          .filter(emp => {
                            if (employeeFilter === 'ALL') return true;
                            return emp.userId === employeeFilter || emp.id.startsWith(employeeFilter);
                          })
                          .filter(emp => emp.status === 'LATE')
                          .map((emp) => (
                            <TableRow key={emp.id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{emp.employeeName}</span>
                                  <span className="text-xs text-muted-foreground">{emp.email}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getLocationColor(emp.location).bg} ${getLocationColor(emp.location).text} ${getLocationColor(emp.location).border}`}>
                                  {emp.location}
                                </span>
                              </TableCell>
                              <TableCell>{emp.date}</TableCell>
                              <TableCell>{emp.rosterStartTime}</TableCell>
                              <TableCell>{emp.checkInTime}</TableCell>
                              <TableCell>
                                {emp.status === 'LATE' ? (
                                  <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 font-medium">
                                    {emp.lateMinutes} late
                                  </span>
                                ) : emp.status === 'PRESENT' ? (
                                  <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 font-medium">
                                    On Time
                                  </span>
                                ) : emp.status === 'OFF DUTY' ? (
                                  <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 font-medium">
                                    Off Duty
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 font-medium">
                                    No Roster
                                  </span>
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
                  {!hasFetchedLate && !loadingLate
                    ? 'Wait a moment, fetching late records...'
                    : 'No late employees found for the selected period and filters.'}
                </div>
              )}
            </>
          ) : loading ? (
            <div className="flex justify-center py-8">
              <FaSpinner className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : filteredAttendances.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {statusFilter === 'ACTIVE' && (
                        <TableHead className="w-[40px]">
                          <input
                            type="checkbox"
                            checked={selectedIds.length === filteredAttendances.length && filteredAttendances.length > 0}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        </TableHead>
                      )}
                      <TableHead>Employee</TableHead>
                      <TableHead className="hidden sm:table-cell">Location</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead className="hidden md:table-cell">
                        {statusFilter === 'ACTIVE' ? 'Shift End' : 'Check Out'}
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendances.map((attendance) => {
                      const shiftInfo = getUserActiveShiftInfo(new Date(), attendance.user);
                      const overdue = shiftInfo.hasShift && shiftInfo.isShiftEnded;
                      const isEditing = editingId === attendance.id;

                      // Live duration while editing
                      const displayDuration = isEditing
                        ? calculateDuration(editForm.checkInTime, editForm.checkOutTime || null)
                        : (attendance.status === 'ABSENT' || attendance.status === 'ON LEAVE' || attendance.status === 'OFF DAY')
                        ? '-'
                        : calculateDuration(attendance.checkInTime, attendance.checkOutTime);

                      return (
                        <TableRow key={attendance.id} className={isEditing ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                          {statusFilter === 'ACTIVE' && (
                            <TableCell className="w-[40px]">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(attendance.id)}
                                onChange={() => toggleSelectOne(attendance.id)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>
                                {attendance.user.firstName && attendance.user.lastName
                                  ? `${attendance.user.firstName} ${attendance.user.lastName}`
                                  : 'Not set'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {attendance.user.email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center ${getLocationColor(attendance.location.name).bg} ${getLocationColor(attendance.location.name).text} ${getLocationColor(attendance.location.name).border}`}>
                                <FaMapMarkerAlt className="mr-1 h-3 w-3" />
                                {attendance.location.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                type="datetime-local"
                                value={editForm.checkInTime}
                                onChange={(e) => setEditForm({ ...editForm, checkInTime: e.target.value })}
                                className="h-8 text-xs w-[170px]"
                              />
                            ) : (
                              <div className="flex items-center">
                                <FaUserClock className={`mr-2 h-3 w-3 ${(attendance.status === 'ABSENT' || attendance.status === 'ON LEAVE' || attendance.status === 'OFF DAY') ? 'text-slate-400' : 'text-green-500'}`} />
                                {(attendance.status === 'ABSENT' || attendance.status === 'ON LEAVE' || attendance.status === 'OFF DAY') ? (
                                  <span className="text-muted-foreground text-xs italic">{format(toZonedTime(parseISO(attendance.checkInTime), SRI_LANKA_TZ), 'MMM d, yyyy')} • Did Not Check In</span>
                                ) : (
                                  formatDate(attendance.checkInTime)
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="datetime-local"
                                  value={editForm.checkOutTime}
                                  onChange={(e) => setEditForm({ ...editForm, checkOutTime: e.target.value })}
                                  placeholder="Check out"
                                  className="h-8 text-xs w-[170px]"
                                />
                                {editForm.checkOutTime && (
                                  <button
                                    type="button"
                                    onClick={() => setEditForm({ ...editForm, checkOutTime: '' })}
                                    title="Clear Check-out (set In-progress)"
                                    className="p-1 text-muted-foreground hover:text-red-500 text-xs"
                                  >
                                    <FaTimes className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ) : statusFilter === 'ACTIVE' ? (
                              shiftInfo.hasShift ? (
                                <span className="font-medium">
                                  {shiftInfo.rosterEndTime}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">No Roster</span>
                              )
                            ) : (attendance.status === 'ABSENT' || attendance.status === 'ON LEAVE' || attendance.status === 'OFF DAY') ? (
                              <span className="text-muted-foreground text-xs italic">-</span>
                            ) : attendance.checkOutTime ? (
                              <div className="flex items-center">
                                <FaUserClock className="mr-2 h-3 w-3 text-red-500" />
                                {formatDate(attendance.checkOutTime)}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 whitespace-nowrap">Currently Not Checked Out</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className={isEditing ? 'font-semibold text-primary' : ''}>
                              {displayDuration}
                            </span>
                          </TableCell>
                          <TableCell>
                            {statusFilter === 'ACTIVE' ? (
                              overdue ? (
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 font-medium">
                                  OVERDUE
                                </span>
                              ) : (
                                <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                  Currently Not Checked Out
                                </span>
                              )
                            ) : (
                              <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold ${(attendance.status === 'COMPLETED' || (attendance.checkOutTime && attendance.status !== 'ABSENT' && attendance.status !== 'ON LEAVE' && attendance.status !== 'OFF DAY'))
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : (attendance.status === 'Currently Not Checked Out' || attendance.status === 'IN PROGRESS' || (!attendance.checkOutTime && attendance.status !== 'ABSENT' && attendance.status !== 'ON LEAVE' && attendance.status !== 'OFF DAY'))
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : attendance.status === 'ON LEAVE' ? 'bg-blue-100 text-blue-800 font-bold border border-blue-300' : (attendance.status === 'OFF DAY' || attendance.status === 'ABSENT')
                                    ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                {attendance.status === 'ON LEAVE' ? 'ON LEAVE' : (attendance.status === 'OFF DAY' || attendance.status === 'ABSENT') ? 'OFF DAY' : !attendance.checkOutTime ? 'Currently Not Checked Out' : 'COMPLETED'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="default"
                                  disabled={savingEdit}
                                  onClick={() => handleSaveEdit(attendance.id)}
                                  className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm flex items-center gap-1"
                                  title="Save permanent changes (Tick mark)"
                                >
                                  {savingEdit ? (
                                    <FaSpinner className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <FaCheck className="h-3.5 w-3.5 text-white stroke-[2]" />
                                  )}
                                  <span className="text-xs">Save</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={savingEdit}
                                  onClick={handleCancelEdit}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                  title="Cancel"
                                >
                                  <FaTimes className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartEdit(attendance)}
                                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                                title="Edit times"
                              >
                                <FaEdit className="h-3.5 w-3.5 text-primary" />
                                <span>Edit</span>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No attendance records found matching your search criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceReports;