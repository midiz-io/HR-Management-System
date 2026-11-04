import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  FaShareAlt,
  FaShieldAlt,
  FaInfoCircle,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaFileDownload,
  FaSpinner,
  FaCheck,
  FaTimes,
  FaFilter,
  FaUser,
  FaBuilding,
  FaCalendar,
  FaBroom,
  FaWhatsapp,
  FaFilePdf
} from 'react-icons/fa';
import { format, addDays, subDays } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  department: string | null;
  position: string | null;
}

interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
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
  userId: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    department: string | null;
  };
  leaveTypeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewerId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  documents: LeaveDocument[];
}

const AdminLeaveManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // State for leave requests
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // State for filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<Date | undefined>(undefined);
  const [endDateFilter, setEndDateFilter] = useState<Date | undefined>(undefined);
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>('ALL');

  // State for leave types and departments
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);

  // State for leave request details
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState<boolean>(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState<boolean>(false);
  const [showShareDialog, setShowShareDialog] = useState<boolean>(false);
  const [initializingLeaveTypes, setInitializingLeaveTypes] = useState<boolean>(false);

  // State for report generation
  const [reportType, setReportType] = useState<string>('summary');
  const [reportUserId, setReportUserId] = useState<string>('');
  const [reportDepartment, setReportDepartment] = useState<string>('');
  const [reportStartDate, setReportStartDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [reportEndDate, setReportEndDate] = useState<Date | undefined>(new Date());
  const [reportLeaveType, setReportLeaveType] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);

  // State for WhatsApp sharing
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedEmployeeBalances, setSelectedEmployeeBalances] = useState<any[]>([]);
  const [selectedEmployeeHistory, setSelectedEmployeeHistory] = useState<LeaveRequest[]>([]);
  const [isFetchingBalances, setIsFetchingBalances] = useState<boolean>(false);


  // Initialize leave types
  const handleInitializeLeaveTypes = async () => {
    try {
      setInitializingLeaveTypes(true);
      const response = await fetch('/api/leave-types/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initialize leave types');
      }

      const data = await response.json();
      setLeaveTypes(data.leaveTypes);

      toast({
        title: 'Success',
        description: `Leave types reset successfully. Deleted ${data.deleted} unused types.`,
      });
    } catch (error: any) {
      console.error('Error initializing leave types:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to initialize leave types',
      });
    } finally {
      setInitializingLeaveTypes(false);
    }
  };

  // Fetch leave requests, types, and departments on component mount
  useEffect(() => {
    const fetchLeaveData = async () => {
      setIsLoading(true);
      try {
        // Fetch leave requests
        const requestsResponse = await fetch('/api/leave-requests');
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json();
          setLeaveRequests(requestsData);
          setFilteredRequests(requestsData);

          // Extract unique departments with proper deduplication
          const deptSet = new Set<string>();
          requestsData.forEach((req: LeaveRequest) => {
            if (req.user.department) {
              // Trim whitespace and normalize the department name
              const normalizedDept = req.user.department.trim();
              if (normalizedDept && normalizedDept !== 'All Departments') {
                deptSet.add(normalizedDept);
              }
            }
          });
          setDepartments(Array.from(deptSet).sort());

          // Extract unique employees
          const empMap = new Map<string, User>();
          requestsData.forEach((req: LeaveRequest) => {
            empMap.set(req.userId, {
              id: req.userId,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              email: req.user.email,
              department: req.user.department,
              position: null
            });
          });
          setEmployees(Array.from(empMap.values()));
        }

        // Fetch leave types
        const typesResponse = await fetch('/api/leave-types');
        if (typesResponse.ok) {
          const typesData = await typesResponse.json();
          setLeaveTypes(typesData);
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

    fetchLeaveData();
  }, [toast]);

  // Apply filters when filter values change
  useEffect(() => {
    let filtered = [...leaveRequests];

    // Filter by status
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }

    // Filter by department
    if (departmentFilter !== 'ALL') {
      filtered = filtered.filter(req => req.user.department === departmentFilter);
    }

    // Filter by employee
    if (employeeFilter) {
      filtered = filtered.filter(req => req.userId === employeeFilter);
    }

    // Filter by date range
    if (startDateFilter || endDateFilter) {
      filtered = filtered.filter(req => {
        const reqStartDate = new Date(req.startDate);
        const reqEndDate = new Date(req.endDate);

        if (startDateFilter && endDateFilter) {
          // Request overlaps with filter range
          return (
            (reqStartDate >= startDateFilter && reqStartDate <= endDateFilter) ||
            (reqEndDate >= startDateFilter && reqEndDate <= endDateFilter) ||
            (reqStartDate <= startDateFilter && reqEndDate >= endDateFilter)
          );
        } else if (startDateFilter) {
          // Request ends on or after filter start date
          return reqEndDate >= startDateFilter;
        } else if (endDateFilter) {
          // Request starts on or before filter end date
          return reqStartDate <= endDateFilter;
        }

        return true;
      });
    }

    // Filter by leave type
    if (leaveTypeFilter !== 'ALL') {
      filtered = filtered.filter(req => req.leaveTypeId === leaveTypeFilter);
    }

    setFilteredRequests(filtered);
  }, [
    leaveRequests,
    statusFilter,
    departmentFilter,
    employeeFilter,
    startDateFilter,
    endDateFilter,
    leaveTypeFilter
  ]);

  // Fetch balances for selected employee
  useEffect(() => {
    const fetchEmployeeBalances = async () => {
      if (!employeeFilter || employeeFilter === 'all_employees') {
        setSelectedEmployeeBalances([]);
        return;
      }

      setIsFetchingBalances(true);
      try {
        const [balancesResponse, historyResponse] = await Promise.all([
          fetch(`/api/leave-balances?userId=${employeeFilter}&year=${new Date().getFullYear()}`),
          fetch(`/api/leave-requests?userId=${employeeFilter}`)
        ]);

        if (balancesResponse.ok) {
          const balancesData = await balancesResponse.json();
          setSelectedEmployeeBalances(balancesData);
        }
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setSelectedEmployeeHistory(historyData);
        }
      } catch (error) {
        console.error('Error fetching employee data:', error);
      } finally {
        setIsFetchingBalances(false);
      }
    };
    
    fetchEmployeeBalances();
  }, [employeeFilter]);

  const refreshSelectedEmployeeData = async () => {
    if (!employeeFilter || employeeFilter === 'all_employees') return;
    setIsFetchingBalances(true);
    try {
      const [balancesResponse, historyResponse] = await Promise.all([
        fetch(`/api/leave-balances?userId=${employeeFilter}&year=${new Date().getFullYear()}`),
        fetch(`/api/leave-requests?userId=${employeeFilter}`)
      ]);

      if (balancesResponse.ok) {
        const balancesData = await balancesResponse.json();
        setSelectedEmployeeBalances(balancesData);
      }

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setSelectedEmployeeHistory(historyData);
      }
    } catch (error) {
      console.error('Error refreshing employee data:', error);
    } finally {
      setIsFetchingBalances(false);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setStatusFilter('ALL');
    setDepartmentFilter('ALL');
    setEmployeeFilter('');
    setStartDateFilter(undefined);
    setEndDateFilter(undefined);
    setLeaveTypeFilter('ALL');
  };

  // Handle approve leave request
  const handleApproveRequest = async (id: string) => {
    try {
      setIsProcessing(true);

      const response = await fetch('/api/leave-requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user?.id || ''
        },
        body: JSON.stringify({
          id,
          status: 'APPROVED'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve leave request');
      }

      // Update leave requests
      const updatedRequest = await response.json();
      setLeaveRequests(prevRequests =>
        prevRequests.map(req => req.id === id ? updatedRequest : req)
      );
      await refreshSelectedEmployeeData();

      toast({
        title: 'Success',
        description: 'Leave request approved successfully',
      });
    } catch (error: any) {
      console.error('Error approving leave request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to approve leave request',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle verify leave request
  const handleVerifyRequest = async (id: string) => {
    try {
      setIsProcessing(true);

      const response = await fetch('/api/leave-requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user?.id || ''
        },
        body: JSON.stringify({
          id,
          status: 'VERIFIED'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify leave request');
      }

      // Update leave requests
      const updatedRequest = await response.json();
      setLeaveRequests(prevRequests =>
        prevRequests.map(req => req.id === id ? updatedRequest : req)
      );
      await refreshSelectedEmployeeData();

      toast({
        title: 'Success',
        description: 'Leave request verified successfully',
      });
    } catch (error: any) {
      console.error('Error verifying leave request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to verify leave request',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle reject leave request
  const handleRejectRequest = async () => {
    if (!selectedRequest) return;

    if (!rejectionReason || rejectionReason.trim().length < 10) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please provide a detailed rejection reason (at least 10 characters)',
      });
      return;
    }

    try {
      setIsProcessing(true);

      const response = await fetch('/api/leave-requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user?.id || ''
        },
        body: JSON.stringify({
          id: selectedRequest.id,
          status: 'REJECTED',
          rejectionReason
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject leave request');
      }

      // Update leave requests
      const updatedRequest = await response.json();
      setLeaveRequests(prevRequests =>
        prevRequests.map(req => req.id === selectedRequest.id ? updatedRequest : req)
      );
      await refreshSelectedEmployeeData();

      // Close dialog and reset form
      setShowRejectionDialog(false);
      setRejectionReason('');
      setSelectedRequest(null);

      toast({
        title: 'Success',
        description: 'Leave request rejected successfully',
      });
    } catch (error: any) {
      console.error('Error rejecting leave request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to reject leave request',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Open rejection dialog
  const openRejectionDialog = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setShowRejectionDialog(true);
  };

  // Open details dialog
  const openDetailsDialog = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setShowDetailsDialog(true);
  };

  // Generate report
  const handleGenerateReport = async () => {
    try {
      setIsGeneratingReport(true);

      const response = await fetch('/api/leave-reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType,
          userId: reportUserId || undefined,
          department: reportDepartment || undefined,
          startDate: reportStartDate?.toISOString() || undefined,
          endDate: reportEndDate?.toISOString() || undefined,
          leaveTypeId: reportLeaveType || undefined
        }),
      });

      let reportData;
      let errorMessage = 'Failed to generate report';

      try {
        const responseData = await response.text();
        if (responseData) {
          try {
            const parsedData = JSON.parse(responseData);
            if (!response.ok) {
              errorMessage = parsedData.error || errorMessage;
              throw new Error(errorMessage);
            }
            reportData = parsedData;
          } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            throw new Error('Invalid response format from server');
          }
        } else {
          throw new Error('Empty response from server');
        }
      } catch (responseError) {
        console.error('Response error:', responseError);
        throw new Error(errorMessage);
      }

      if (!reportData) {
        throw new Error('No report data received');
      }

      // If it's an individual report, generate a PDF using jsPDF
      if (reportType === 'individual' && reportData.employee) {
        const doc = new jsPDF();
        const emp = reportData.employee;
        const stats = reportData.statistics;

        // Title
        doc.setFontSize(20);
        doc.setTextColor(59, 130, 246); // Primary blue
        doc.text('Individual Leave Summary Report', 14, 20);

        // Employee Info
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Employee: ${emp.firstName || ''} ${emp.lastName || ''}`, 14, 32);
        doc.text(`Email: ${emp.email}`, 14, 38);
        doc.text(`Department: ${emp.department || 'N/A'}`, 14, 44);
        doc.text(`Position: ${emp.position || 'N/A'}`, 14, 50);
        doc.text(`Generated At: ${new Date(reportData.generatedAt).toLocaleString()}`, 14, 56);

        // Leave Balance Header
        doc.setFontSize(14);
        doc.text('Leave Balance Summary (2026)', 14, 70);

        // Balance Table
        const balanceRows = (reportData.leaveBalances || []).map((b: any) => {
          const remaining = (b.totalDays || 0) - (b.usedDays || 0) - (b.pendingDays || 0);
          const entitlement = b.allocationLabel ?? (b.totalDays || 0);
          return [
            b.leaveType?.name || b.leaveType || 'N/A',
            entitlement,
            b.usedDays || 0,
            b.pendingDays || 0,
            remaining,
            remaining <= 0 ? 'QUOTA OVER' : 'AVAILABLE'
          ];
        });

        autoTable(doc, {
          startY: 75,
          head: [['Leave Type', 'Entitlement', 'Used', 'Pending', 'Remaining', 'Status']],
          body: balanceRows,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          didParseCell: function(data) {
              if (data.section === 'body' && data.column.index === 5) {
                  if (data.cell.text[0] === 'QUOTA OVER') {
                      data.cell.styles.textColor = [239, 68, 68]; // Red
                      data.cell.styles.fontStyle = 'bold';
                  } else {
                      data.cell.styles.textColor = [16, 185, 129]; // Green
                      data.cell.styles.fontStyle = 'bold';
                  }
              }
              if (data.section === 'body' && data.column.index === 4) {
                  if (parseInt(data.cell.text[0]) <= 0) {
                      data.cell.styles.textColor = [239, 68, 68];
                      data.cell.styles.fontStyle = 'bold';
                  }
              }
          }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 15;

        // Leave Requests Header
        doc.setFontSize(14);
        doc.text('Detailed Leave History', 14, finalY);

        // History Table
        const historyRows = (reportData.leaveRequests || []).map((r: any) => [
          r.leaveType?.name || 'N/A',
          r.reason || 'N/A',
          `${new Date(r.startDate).toLocaleDateString()} - ${new Date(r.endDate).toLocaleDateString()}`,
          r.totalDays || 0,
          r.status
        ]);

        autoTable(doc, {
          startY: finalY + 5,
          head: [['Leave Type', 'Reason', 'Date Range', 'Days', 'Status']],
          body: historyRows,
          theme: 'grid',
          headStyles: { fillColor: [71, 85, 105] },
          columnStyles: {
            1: { cellWidth: 50 }, // Reason column width
          }
        });

        // Save the PDF
        doc.save(`Leave_Report_${emp.firstName || 'Employee'}_${new Date().getFullYear()}.pdf`);
        
        toast({
          title: 'Success',
          description: 'Individual PDF report generated and downloaded.',
        });
        setIsGeneratingReport(false);
        return;
      }

      // Fallback to the original HTML window for other report types
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        const logoSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 10px;">
          <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4ZM12.5 7H11V13L16.25 16.15L17 14.92L12.5 12.25V7Z" fill="#3b82f6"/>
        </svg>`;

        reportWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${reportData.reportType} - ${reportData.employee?.firstName || ''} ${reportData.employee?.lastName || ''}</title>
              <style>
                :root {
                  --primary: #3b82f6;
                  --primary-foreground: #ffffff;
                  --muted: #f1f5f9;
                  --muted-foreground: #64748b;
                  --border: #e2e8f0;
                  --radius: 0.5rem;
                }
                body { 
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
                  line-height: 1.5;
                  color: #1e293b;
                  margin: 0;
                  padding: 40px;
                  background-color: #fff;
                }
                .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  margin-bottom: 40px;
                  border-bottom: 2px solid var(--primary);
                  padding-bottom: 20px;
                }
                .logo-container {
                  display: flex;
                  align-items: center;
                  font-size: 24px;
                  font-weight: bold;
                  color: var(--primary);
                }
                .report-title {
                  text-align: right;
                }
                .report-title h1 {
                  margin: 0;
                  font-size: 24px;
                  color: #0f172a;
                }
                .report-meta {
                  font-size: 14px;
                  color: var(--muted-foreground);
                  margin-top: 5px;
                }
                .section {
                  margin-bottom: 30px;
                }
                .section-title {
                  font-size: 18px;
                  font-weight: 600;
                  margin-bottom: 15px;
                  color: #0f172a;
                  border-bottom: 1px solid var(--border);
                  padding-bottom: 8px;
                }
                .info-grid {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 20px;
                  background-color: var(--muted);
                  padding: 20px;
                  border-radius: var(--radius);
                }
                .info-item {
                  display: flex;
                  flex-direction: column;
                }
                .info-label {
                  font-size: 12px;
                  color: var(--muted-foreground);
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                }
                .info-value {
                  font-size: 15px;
                  font-weight: 500;
                }
                .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(4, 1fr);
                  gap: 15px;
                  margin-bottom: 30px;
                }
                .stat-card {
                  padding: 15px;
                  border: 1px solid var(--border);
                  border-radius: var(--radius);
                  text-align: center;
                }
                .stat-value {
                  font-size: 24px;
                  font-weight: bold;
                  color: var(--primary);
                }
                .stat-label {
                  font-size: 12px;
                  color: var(--muted-foreground);
                }
                table { 
                  border-collapse: collapse; 
                  width: 100%; 
                  margin-top: 10px;
                  font-size: 14px;
                }
                th, td { 
                  padding: 12px 15px; 
                  text-align: left; 
                  border-bottom: 1px solid var(--border);
                }
                th { 
                  background-color: var(--muted);
                  font-weight: 600;
                  color: #475569;
                }
                .badge {
                  display: inline-block;
                  padding: 2px 8px;
                  border-radius: 9999px;
                  font-size: 11px;
                  font-weight: 600;
                  text-transform: uppercase;
                }
                .badge-pending { background-color: #fef9c3; color: #854d0e; }
                .badge-approved { background-color: #dcfce7; color: #166534; }
                .badge-rejected { background-color: #fee2e2; color: #991b1b; }
                .badge-cancelled { background-color: #f1f5f9; color: #475569; }
                .badge-verified { background-color: #dbeafe; color: #1e40af; }
                
                .no-print {
                  margin-bottom: 20px;
                  display: flex;
                  justify-content: flex-end;
                }
                .btn {
                  padding: 10px 20px;
                  background-color: var(--primary);
                  color: white;
                  border: none;
                  border-radius: var(--radius);
                  cursor: pointer;
                  font-weight: 500;
                  font-size: 14px;
                }
                @media print {
                  .no-print { display: none; }
                  body { padding: 0; }
                }
              </style>
            </head>
            <body>
              <div class="no-print">
                <button class="btn" onclick="window.print()">Print Report</button>
              </div>

              <div class="header">
                <div class="logo-container">
                  ${logoSvg}
                  TimeTrack
                </div>
                <div class="report-title">
                  <h1>${reportData.reportType}</h1>
                  <div class="report-meta">
                    Report Period: ${reportStartDate ? reportStartDate.toLocaleDateString() : 'N/A'} - ${reportEndDate ? reportEndDate.toLocaleDateString() : 'N/A'}
                  </div>
                  <div class="report-meta">
                    Generated on: ${new Date(reportData.generatedAt).toLocaleString()}
                  </div>
                </div>
              </div>

              ${reportData.employee ? `
                <div class="section">
                  <div class="section-title">Employee Information</div>
                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">Name</span>
                      <span class="info-value">${reportData.employee.firstName || ''} ${reportData.employee.lastName || ''}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Email</span>
                      <span class="info-value">${reportData.employee.email}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Department</span>
                      <span class="info-value">${reportData.employee.department || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Position</span>
                      <span class="info-value">${reportData.employee.position || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ` : ''}

              <div class="section">
                <div class="section-title">Leave Balance Summary</div>
                <table>
                  <thead>
                    <tr>
                      <th>Leave Type</th>
                      <th>Entitlement</th>
                      <th>Used</th>
                      <th>Pending</th>
                      <th>Remaining</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(reportData.leaveBalances || []).map((b: any) => {
                      const remaining = (b.totalDays || 0) - (b.usedDays || 0) - (b.pendingDays || 0);
                      const isOver = remaining <= 0;
                      return `
                        <tr>
                          <td>${b.leaveType?.name || 'N/A'}</td>
                          <td>${b.totalDays || 0}</td>
                          <td>${b.usedDays || 0}</td>
                          <td>${b.pendingDays || 0}</td>
                          <td style="font-weight: bold; ${isOver ? 'color: #ef4444;' : ''}">${remaining}</td>
                          <td style="font-weight: bold; font-size: 0.85em; ${isOver ? 'color: #ef4444;' : 'color: #10b981;'}">
                            ${isOver ? 'QUOTA OVER' : 'AVAILABLE'}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              ${reportData.statistics?.employeeStats ? `
                <div class="section">
                  <div class="section-title">Employee Statistics (Department: ${reportData.department || 'N/A'})</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Total Requests</th>
                        <th>Approved</th>
                        <th>Days Taken</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${reportData.statistics.employeeStats.map((stat: any) => `
                        <tr>
                          <td>${stat.employee?.firstName || ''} ${stat.employee?.lastName || ''} (${stat.employee?.email || 'N/A'})</td>
                          <td>${stat.totalRequests}</td>
                          <td>${stat.approvedRequests}</td>
                          <td>${stat.totalDaysTaken}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}

              ${reportData.statistics?.departmentStats ? `
                <div class="section">
                  <div class="section-title">Department Breakdown</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Total Requests</th>
                        <th>Approved</th>
                        <th>Days Taken</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${reportData.statistics.departmentStats.map((stat: any) => `
                        <tr>
                          <td>${stat.department}</td>
                          <td>${stat.totalRequests}</td>
                          <td>${stat.approvedRequests}</td>
                          <td>${stat.totalDaysTaken}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}

              ${reportData.statistics?.leaveTypeStats ? `
                <div class="section">
                  <div class="section-title">Leave Type Breakdown</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Leave Type</th>
                        <th>Total Requests</th>
                        <th>Approved</th>
                        <th>Days Taken</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${reportData.statistics.leaveTypeStats.map((stat: any) => `
                        <tr>
                          <td>${stat.leaveType?.name || 'N/A'}</td>
                          <td>${stat.totalRequests}</td>
                          <td>${stat.approvedRequests}</td>
                          <td>${stat.totalDaysTaken}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}

              ${reportData.leaveRequests && reportData.leaveRequests.length > 0 ? `
                <div class="section">
                  <div class="section-title">Leave History</div>
                  <table>
                    <thead>
                      <tr>
                        ${reportData.reportType !== 'Individual Employee Report' ? '<th>Employee</th>' : ''}
                        <th>Leave Type</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Days</th>
                        <th>Status</th>
                        <th>Approved By</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${reportData.leaveRequests.map((req: any) => `
                        <tr>
                          ${reportData.reportType !== 'Individual Employee Report' ? `<td>${req.user?.firstName || ''} ${req.user?.lastName || ''} (${req.user?.email || 'N/A'})</td>` : ''}
                          <td>${req.leaveType?.name || 'N/A'}</td>
                          <td>${req.startDate ? new Date(req.startDate).toLocaleDateString() : 'N/A'}</td>
                          <td>${req.endDate ? new Date(req.endDate).toLocaleDateString() : 'N/A'}</td>
                          <td>${req.totalDays || 'N/A'}</td>
                          <td>
                            <span class="badge badge-${(req.status || 'PENDING').toLowerCase()}">${req.status || 'PENDING'}</span>
                          </td>
                          <td>
                            ${req.reviewer ? `${req.reviewer.firstName || ''} ${req.reviewer.lastName || ''}` : 'N/A'}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div class="section">
                  <div class="section-title">Leave History</div>
                  <p>No leave requests found for the selected period.</p>
                </div>
              `}
              
              <div style="margin-top: 50px; font-size: 11px; text-align: center; color: var(--muted-foreground);">
                This is a computer-generated document. No signature is required.
              </div>
            </body>
          </html>
        `);
        reportWindow.document.close();
      }

      toast({
        title: 'Success',
        description: 'Report generated successfully',
      });
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to generate report',
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Generate leave report for WhatsApp sharing
  const generateLeaveReport = async () => {
    try {
      setGeneratingReport(true);

      const response = await fetch('/api/leave-reports/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUserId === "all_employees" ? undefined : selectedUserId,
          year: selectedYear,
          includeDetails: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate leave report');
      }

      const data = await response.json();
      setReportData(data);
    } catch (error: any) {
      console.error('Error generating leave report:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to generate leave report',
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  // Share leave report via WhatsApp
  const shareLeaveReportViaWhatsApp = () => {
    if (!reportData) return;

    // Create a summary text for WhatsApp
    const summaryText = `
*${reportData.reportTitle}*

*Employee:* ${reportData.employeeInfo.name}
*Department:* ${reportData.employeeInfo.department}
*Position:* ${reportData.employeeInfo.position}

*Leave Summary:*
- Total Requested: ${reportData.summary.totalLeavesRequested} days
- Total Taken: ${reportData.summary.totalLeavesTaken} days
- Pending: ${reportData.summary.pendingLeaves} days
- Approved: ${reportData.summary.approvedLeaves} days

*Leave Balances:*
${reportData.leaveBalances.map((balance: any) =>
      `- ${balance.leaveType}: ${balance.remainingDays} days remaining`
    ).join('\n')}

Generated at: ${reportData.generatedAt}
    `.trim();

    // Encode the text for a URL
    const encodedText = encodeURIComponent(summaryText);

    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;

    // Open WhatsApp in a new window
    window.open(whatsappUrl, '_blank');
  };

  // Format date for display
  const formatDateDisplay = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  // Get employee full name
  const getEmployeeName = (user: { firstName: string | null; lastName: string | null; email: string }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user.firstName) {
      return user.firstName;
    } else {
      return user.email;
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Verified</Badge>;
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

  return (
    <div className="space-y-6">
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">
            <FaCalendarAlt className="mr-2 h-4 w-4" />
            Leave Requests
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FaFileDownload className="mr-2 h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* Leave Requests Tab */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Leave Requests</CardTitle>
                  <CardDescription>
                    Manage employee leave requests
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInitializeLeaveTypes}
                    disabled={initializingLeaveTypes}
                  >
                    <FaBroom className="mr-2 h-4 w-4" />
                    Clean Up Leave Types
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowShareDialog(true)}
                  >
                    <FaShareAlt className="mr-2 h-4 w-4" />
                    Share Leave Report
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="mb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Filters</h3>
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Reset Filters
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Status Filter */}
                  <div>
                    <Label htmlFor="statusFilter">Status</Label>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger id="statusFilter">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Statuses</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Department Filter */}
                  {/* Department Filter Removed */}

                  {/* Employee Filter */}
                  <div>
                    <Label htmlFor="employeeFilter">Employee</Label>
                    <Select
                      value={employeeFilter}
                      onValueChange={setEmployeeFilter}
                    >
                      <SelectTrigger id="employeeFilter">
                        <SelectValue placeholder="Filter by employee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_employees">All Employees</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {getEmployeeName(emp)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Range Filter */}
                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <FaCalendar className="mr-2 h-4 w-4" />
                          {startDateFilter ? format(startDateFilter, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={startDateFilter}
                          onSelect={setStartDateFilter}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <FaCalendar className="mr-2 h-4 w-4" />
                          {endDateFilter ? format(endDateFilter, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={endDateFilter}
                          onSelect={setEndDateFilter}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Leave Type Filter */}
                  <div>
                    <Label htmlFor="leaveTypeFilter">Leave Type</Label>
                    <Select
                      value={leaveTypeFilter}
                      onValueChange={setLeaveTypeFilter}
                    >
                      <SelectTrigger id="leaveTypeFilter">
                        <SelectValue placeholder="Filter by leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Leave Types</SelectItem>
                        {leaveTypes.length > 0 ? (
                          leaveTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No leave types found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Selected Employee Balance Summary */}
                {employeeFilter && employeeFilter !== 'all_employees' && selectedEmployeeBalances.length > 0 && (
                  <div className="space-y-4">
                    {/* Alert if any quota is over */}
                    {(() => {
                      const exhausted = selectedEmployeeBalances.filter(b => {
                        const remaining = b.totalDays - b.usedDays - b.pendingDays;
                        return remaining <= 0;
                      });
                      
                      if (exhausted.length > 0) {
                        return (
                          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-start gap-3">
                            <FaExclamationTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                            <div>
                                <h4 className="text-red-800 font-black text-sm uppercase tracking-tight underlineDecoration">Important: This employee's leave quota for this year is over</h4>
                                <p className="text-red-700 text-xs mt-1 font-bold italic">
                                  "You have enough leave left this year." — Exhausted: <span className="font-extrabold">{exhausted.map(e => e.leaveType.name).join(', ')}</span>.
                                </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="p-4 bg-muted/30 rounded-lg border border-muted">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                         <FaInfoCircle className="h-4 w-4 text-blue-500" />
                         Leave Quota Summary for selected Employee ({new Date().getFullYear()})
                      </h4>
                      {isFetchingBalances ? (
                        <div className="flex justify-center py-2">
                          <FaSpinner className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {selectedEmployeeBalances.map((balance: any) => {
                            const remaining = balance.totalDays - balance.usedDays - balance.pendingDays;
                            return (
                              <div key={balance.id} className="p-2 border rounded bg-background flex justify-between items-center shadow-sm">
                                <span className="text-xs font-medium truncate pr-2">{balance.leaveType.name}</span>
                                <div className="text-right flex-shrink-0">
                                  <span className={`text-sm font-bold ${remaining <= 0 ? 'text-red-500' : 'text-primary'}`}>
                                    {remaining}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground ml-1 uppercase">Left</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Leave Requests Table */}
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <FaSpinner className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredRequests.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead className="hidden md:table-cell">Department</TableHead>
                        <TableHead className="hidden sm:table-cell">Leave Type</TableHead>
                        <TableHead className="hidden lg:table-cell">Dates</TableHead>
                        <TableHead className="hidden md:table-cell">Days</TableHead>
                        <TableHead className="hidden sm:table-cell">Remaining</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>{getEmployeeName(request.user)}</TableCell>
                          <TableCell className="hidden md:table-cell">{request.user.department || 'N/A'}</TableCell>
                          <TableCell className="hidden sm:table-cell">{request.leaveType.name}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {formatDateDisplay(request.startDate)} - {formatDateDisplay(request.endDate)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{request.totalDays}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {(() => {
                              const balance = selectedEmployeeBalances.find((b: any) => b.leaveTypeId === request.leaveTypeId);
                              if (balance && request.userId === selectedUserId) {
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
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDetailsDialog(request)}
                              >
                                View
                              </Button>

                              {(request.status === 'PENDING' || request.status === 'VERIFIED') && (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleApproveRequest(request.id)}
                                    disabled={isProcessing}
                                    title="Approve"
                                  >
                                    {isProcessing ? (
                                      <FaSpinner className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <FaCheck className="h-4 w-4" />
                                    )}
                                  </Button>

                                  {request.status === 'PENDING' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleVerifyRequest(request.id)}
                                      disabled={isProcessing}
                                      className="border-blue-500 text-blue-500 hover:bg-blue-50"
                                      title="Verify"
                                    >
                                      {isProcessing ? (
                                        <FaSpinner className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <FaShieldAlt className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}

                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => openRejectionDialog(request)}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? (
                                      <FaSpinner className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <FaTimes className="h-4 w-4" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No leave requests found matching the filters
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rejection Dialog */}
          <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Leave Request</DialogTitle>
                <DialogDescription>
                  Please provide a reason for rejecting this leave request.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="rejectionReason">Rejection Reason</Label>
                  <Textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a detailed reason for rejection..."
                    rows={4}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowRejectionDialog(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRejectRequest}
                  disabled={isProcessing || !rejectionReason || rejectionReason.trim().length < 10}
                >
                  {isProcessing ? (
                    <>
                      <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Reject Request'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Details Dialog */}
          <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Leave Request Details</DialogTitle>
              </DialogHeader>

              {selectedRequest && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium">Employee</h3>
                      <p>{getEmployeeName(selectedRequest.user)}</p>
                      <p className="text-sm text-muted-foreground">{selectedRequest.user.email}</p>
                    </div>

                    <div>
                      <h3 className="font-medium">Department</h3>
                      <p>{selectedRequest.user.department || 'N/A'}</p>
                    </div>

                    <div>
                      <h3 className="font-medium">Leave Type</h3>
                      <p>{selectedRequest.leaveType.name}</p>
                    </div>

                    <div>
                      <h3 className="font-medium">Status</h3>
                      <p>{getStatusBadge(selectedRequest.status)}</p>
                    </div>

                    <div className="col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FaInfoCircle className="text-blue-500" />
                        <div>
                          <p className="text-sm font-semibold text-blue-800">Remaining {selectedRequest.leaveType.name} Balance:</p>
                          <p className="text-xs text-blue-600">Calculated as Total Quota - Used - Pending</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {(() => {
                          const empBalance = selectedEmployeeBalances.find((b: any) => b.leaveTypeId === selectedRequest.leaveTypeId);
                          const remaining = empBalance 
                            ? empBalance.totalDays - empBalance.usedDays - empBalance.pendingDays 
                            : 'N/A';
                          return (
                            <span className={`text-2xl font-bold ${typeof remaining === 'number' && remaining <= 0 ? 'text-red-500' : 'text-blue-700'}`}>
                              {remaining} <span className="text-xs font-normal">days</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium">Date Range</h3>
                      <p>
                        {formatDateDisplay(selectedRequest.startDate)} - {formatDateDisplay(selectedRequest.endDate)}
                      </p>
                      <p className="text-sm text-muted-foreground">{selectedRequest.totalDays} days</p>
                    </div>

                    <div>
                      <h3 className="font-medium">Requested On</h3>
                      <p>{format(new Date(selectedRequest.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium">Reason</h3>
                    <p className="mt-1 p-3 bg-gray-50 rounded-md">{selectedRequest.reason}</p>
                  </div>

                  {selectedRequest.status === 'REJECTED' && selectedRequest.rejectionReason && (
                    <div>
                      <h3 className="font-medium text-red-500">Rejection Reason</h3>
                      <p className="mt-1 p-3 bg-red-50 text-red-800 rounded-md">
                        {selectedRequest.rejectionReason}
                      </p>
                    </div>
                  )}

                  {selectedRequest.documents && selectedRequest.documents.length > 0 && (
                    <div>
                      <h3 className="font-medium">Supporting Documents</h3>
                      <div className="mt-2 space-y-2">
                        {selectedRequest.documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-2 border rounded-md">
                            <div className="truncate flex-1">
                              <span className="font-medium">{doc.fileName}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({(doc.fileSize / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90"
                            >
                              View
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Close
                </Button>

                {selectedRequest && (selectedRequest.status === 'PENDING' || selectedRequest.status === 'VERIFIED') && (
                  <>
                    <Button
                      variant="default"
                      onClick={() => {
                        setShowDetailsDialog(false);
                        handleApproveRequest(selectedRequest.id);
                      }}
                      disabled={isProcessing}
                    >
                      Approve
                    </Button>

                    {selectedRequest.status === 'PENDING' && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowDetailsDialog(false);
                          handleVerifyRequest(selectedRequest.id);
                        }}
                        disabled={isProcessing}
                        className="border-blue-500 text-blue-500"
                      >
                        Verify
                      </Button>
                    )}

                    <Button
                      variant="destructive"
                      onClick={() => {
                        setShowDetailsDialog(false);
                        openRejectionDialog(selectedRequest);
                      }}
                      disabled={isProcessing}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Share Leave Report Dialog */}
          <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share Leave Summary Report</DialogTitle>
                <DialogDescription>
                  Generate and share a leave summary report for an employee
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="employee">Select Employee</Label>
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                  >
                    <SelectTrigger id="employee">
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_employees">All Employees</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {getEmployeeName(emp)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Select
                    value={selectedYear}
                    onValueChange={setSelectedYear}
                  >
                    <SelectTrigger id="year">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {reportData && (
                  <div className="border rounded-md p-4 bg-muted/30 space-y-3">
                    <h3 className="text-lg font-semibold">{reportData.reportTitle}</h3>

                    <div className="space-y-1">
                      <h4 className="font-medium">Employee: {reportData.employeeInfo.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {reportData.employeeInfo.department} • {reportData.employeeInfo.position}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-medium">Leave Summary</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Total Requested: <span className="font-medium">{reportData.summary.totalLeavesRequested} days</span></div>
                        <div>Total Taken: <span className="font-medium">{reportData.summary.totalLeavesTaken} days</span></div>
                        <div>Pending: <span className="font-medium">{reportData.summary.pendingLeaves} days</span></div>
                        <div>Approved: <span className="font-medium">{reportData.summary.approvedLeaves} days</span></div>
                      </div>
                    </div>

                    {reportData.leaveBalances.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="font-medium">Leave Balances</h4>
                        <div className="text-sm space-y-1">
                          {reportData.leaveBalances.map((balance: any, index: number) => (
                            <div key={index} className="flex justify-between">
                              <span>{balance.leaveType}:</span>
                              <span className="font-medium">{balance.remainingDays} days remaining</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowShareDialog(false)}
                  className="sm:order-1"
                >
                  Close
                </Button>

                {reportData ? (
                  <Button
                    onClick={shareLeaveReportViaWhatsApp}
                    className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
                  >
                    <FaWhatsapp className="mr-2 h-4 w-4" />
                    Share via WhatsApp
                  </Button>
                ) : (
                  <Button
                    onClick={generateLeaveReport}
                    disabled={generatingReport}
                    className="flex-1 sm:flex-none"
                  >
                    {generatingReport ? (
                      <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FaFilePdf className="mr-2 h-4 w-4" />
                    )}
                    Generate Report
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Generate Reports</CardTitle>
              <CardDescription>
                Generate leave reports for employees and departments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Report Type */}
                <div className="space-y-2">
                  <Label htmlFor="reportType">Report Type</Label>
                  <Select
                    value={reportType}
                    onValueChange={setReportType}
                  >
                    <SelectTrigger id="reportType">
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">Summary Report</SelectItem>
                      <SelectItem value="individual">Individual Employee Report</SelectItem>
                      <SelectItem value="department">Department Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Report Parameters */}
                <div className="space-y-4">
                  {/* Individual Employee Parameters */}
                  {reportType === 'individual' && (
                    <div className="space-y-2">
                      <Label htmlFor="reportUserId">Select Employee</Label>
                      <Select
                        value={reportUserId}
                        onValueChange={setReportUserId}
                      >
                        <SelectTrigger id="reportUserId">
                          <SelectValue placeholder="Select an employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {getEmployeeName(emp)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Department Parameters */}
                  {reportType === 'department' && (
                    <div className="space-y-2">
                      <Label htmlFor="reportDepartment">Select Department</Label>
                      <Select
                        value={reportDepartment}
                        onValueChange={setReportDepartment}
                      >
                        <SelectTrigger id="reportDepartment">
                          <SelectValue placeholder="Select a department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept, index) => (
                            <SelectItem key={index} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Common Parameters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Date Range */}
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <FaCalendar className="mr-2 h-4 w-4" />
                            {reportStartDate ? format(reportStartDate, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={reportStartDate}
                            onSelect={setReportStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <FaCalendar className="mr-2 h-4 w-4" />
                            {reportEndDate ? format(reportEndDate, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={reportEndDate}
                            onSelect={setReportEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Leave Type */}
                    <div className="space-y-2">
                      <Label htmlFor="reportLeaveType">Leave Type (Optional)</Label>
                      <Select
                        value={reportLeaveType}
                        onValueChange={setReportLeaveType}
                      >
                        <SelectTrigger id="reportLeaveType">
                          <SelectValue placeholder="All leave types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Leave Types</SelectItem>
                          {leaveTypes.length > 0 ? (
                            leaveTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              No leave types found
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleGenerateReport}
                disabled={
                  isGeneratingReport ||
                  (reportType === 'individual' && !reportUserId) ||
                  (reportType === 'department' && !reportDepartment) ||
                  !reportStartDate ||
                  !reportEndDate
                }
                className="w-full"
              >
                {isGeneratingReport ? (
                  <>
                    <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FaFileDownload className="mr-2 h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminLeaveManagement;