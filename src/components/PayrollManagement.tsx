import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  Wallet, 
  Banknote, 
  FileText, 
  Download, 
  Send, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Users,
  Settings2,
  CheckCircle2,
  Clock,
  CalendarDays,
  Save,
  Eye,
  EyeOff,
  Building2
} from "lucide-react";
import CompanyCategorization from "@/components/CompanyCategorization";
import { motion } from "framer-motion";
import { formatCurrency } from "@/util/payroll";
import PayrollAttendanceCalendar from "@/components/PayrollAttendanceCalendar";
import { Checkbox } from "@/components/ui/checkbox";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


interface SalaryConfig {
  id: string;
  userId: string;
  basicSalary: number;
  allowances: number;
  otAllowance?: number;
  otherAllowances?: number;
  deductions: number;
  salaryAdvance: number;
  loanDeduction: number;
  pendingBills: number;
  epfEmployee: number;
  epfEmployer: number;
  etfEmployer: number;
  bankName: string;
  accountNumber: string;
  branchName: string;
  offDaysCount?: number;
  offDayPayment?: number;
  holidayPayment?: number;
  offDaysWorked?: number;
  holidaysWorked?: number;
  incentive?: number;
  calculatedIncentive?: number;
  performanceIncentive?: number;
  actuallyWorkedDays?: number;
  expectedWorkingDays?: number;
  calculationMonth?: number;
  calculationYear?: number;
  isSaved?: boolean;
  payrollStatus?: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    position: string;
    department: string;
    assignedDepartment?: { name: string } | null;
    location?: { name: string } | null;
  };
  calc?: any; // The full SalaryCalculation object from the backend
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  position: string;
  department: string;
}

export default function PayrollManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SalaryConfig[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<Partial<SalaryConfig> | null>(null);
  const [processMonth, setProcessMonth] = useState(new Date().getMonth() + 1);
  const [processYear, setProcessYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [calendarConfig, setCalendarConfig] = useState<SalaryConfig | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [dbDepartments, setDbDepartments] = useState<{ id: string; name: string }[]>([]);
  const [dbLocations, setDbLocations] = useState<{ id: string; name: string }[]>([]);
  const [hidePayslips, setHidePayslips] = useState<boolean>(true);
  const [isUpdatingSetting, setIsUpdatingSetting] = useState<boolean>(false);
  const [companyAssignments, setCompanyAssignments] = useState<Record<string, string>>({});
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [epfFilter, setEpfFilter] = useState("ALL");
  const [isCompanyCategorizationOpen, setIsCompanyCategorizationOpen] = useState(false);

  const fetchCompanyAssignments = async () => {
    try {
      const res = await fetch("/api/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanyAssignments(data.assignments || {});
      }
    } catch (err) {
      console.error("Error fetching company assignments:", err);
    }
  };

  const fetchPayslipSetting = async () => {
    try {
      const res = await fetch("/api/payroll/settings", {
        headers: { "Authorization": user?.id || "" }
      });
      if (res.ok) {
        const data = await res.json();
        setHidePayslips(data.hidePayslips);
      }
    } catch (err) {
      console.error("Error fetching payslip setting:", err);
    }
  };

  const handleTogglePayslipVisibility = async (newVal: boolean) => {
    setIsUpdatingSetting(true);
    try {
      const res = await fetch("/api/payroll/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": user?.id || ""
        },
        body: JSON.stringify({ hidePayslips: newVal })
      });
      if (res.ok) {
        const data = await res.json();
        setHidePayslips(data.hidePayslips);
        toast({
          title: data.hidePayslips ? "Payslips Hidden" : "Payslips Visible",
          description: data.message || `Payslips are now ${data.hidePayslips ? "hidden from" : "visible to"} admins and employees.`,
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update setting");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update setting",
      });
    } finally {
      setIsUpdatingSetting(false);
    }
  };

  const handleSaveCurrentPayroll = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/payroll/process", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": user?.id || "" 
        },
        body: JSON.stringify({
          month: viewMonth,
          year: viewYear
        })
      });

      if (response.ok) {
        toast({
          title: "Payroll Saved Permanently",
          description: `Successfully saved payroll records for ${months[viewMonth - 1]} ${viewYear} to database.`,
        });
        fetchConfigs(viewMonth, viewYear);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save payroll");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save payroll.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fetchConfigs = async (m = viewMonth, y = viewYear) => {
    try {
      const response = await fetch(`/api/payroll/config?month=${m}&year=${y}`, {
        headers: { "Authorization": user?.id || "" }
      });
      if (response.ok) {
        const data = await response.json();
        setConfigs(data);
      }
    } catch (error) {
      console.error("Error fetching configs:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users", {
        headers: { "Authorization": user?.id || "" }
      });
      if (response.ok) {
        const data = await response.json();
        // Only allow payroll for employees and admins
        setAllUsers(data.filter((u: User) => u.role === "EMPLOYEE" || u.role === "ADMIN"));
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchDbDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDbDepartments(data);
      }
    } catch (error) {
      console.error("Error fetching departments from database:", error);
    }
  };

  const fetchDbLocations = async () => {
    try {
      const response = await fetch("/api/locations");
      if (response.ok) {
        const data = await response.json();
        setDbLocations(data);
      }
    } catch (error) {
      console.error("Error fetching locations from database:", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchConfigs(viewMonth, viewYear);
      fetchUsers();
      fetchDbDepartments();
      fetchDbLocations();
      fetchPayslipSetting();
      fetchCompanyAssignments();
      setLoading(false);
    }
  }, [user, viewMonth, viewYear]);


  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConfig?.userId || !selectedConfig?.basicSalary) return;

    try {
      const response = await fetch("/api/payroll/config", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": user?.id || "" 
        },
        body: JSON.stringify({
          targetUserId: selectedConfig.userId,
          ...selectedConfig
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Salary configuration saved successfully.",
        });
        setIsConfigDialogOpen(false);
        fetchConfigs();
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.details || err.error || "Failed to save config");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save configuration.",
      });
    }
  };

  const handleProcessPayroll = async () => {
    try {
      const response = await fetch("/api/payroll/process", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": user?.id || "" 
        },
        body: JSON.stringify({
          month: processMonth,
          year: processYear
        })
      });

      if (response.ok) {
        toast({
          title: "Payroll Processed",
          description: `Successfully processed payroll for ${processMonth}/${processYear}.`,
        });
        setIsProcessDialogOpen(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to process payroll");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to process payroll.",
      });
    }
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const departmentsList = dbDepartments.map((d) => d.name);
  const locationsList = dbLocations.map((l) => l.name);

  const handleClearPayroll = async () => {
    try {
      const response = await fetch("/api/payroll/process", {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": user?.id || "" 
        },
        body: JSON.stringify({
          month: viewMonth,
          year: viewYear,
          userIds: selectedUserIds
        })
      });

      if (response.ok) {
        toast({
          title: "Payroll Cleared",
          description: `Successfully cleared payroll records for selected employees for ${viewMonth}/${viewYear}.`,
        });
        setIsClearDialogOpen(false);
        setSelectedUserIds([]);
        fetchConfigs(viewMonth, viewYear);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to clear payroll");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to clear payroll.",
      });
    }
  };

  const downloadCSVReport = () => {
    const headers = [
      "Employee Name",
      "Email",
      "Position",
      "Department",
      "Location",
      "Basic Salary (LKR)",
      "Off Day Payment (LKR)",
      "Holiday Payment (LKR)",
      "Total For EPF (LKR)",
      "Attendance Incentive (LKR)",
      "Performance Incentive (LKR)",
      "OT Pay (LKR)",
      "Total Incentive (LKR)",
      "Allowances (LKR)",
      "Gross Salary (LKR)",
      "Statutory Deductions (LKR)",
      "Salary Advance (LKR)",
      "Loan Deduction (LKR)",
      "Pending Bills (LKR)",
      "EPF Employee Contribution (LKR)",
      "Total Deductions (LKR)",
      "Net Salary (LKR)",
      "Bank Name",
      "Account Number",
      "Branch"
    ];

    const rows = filteredConfigs.map(c => {
      const epfBasis = c.basicSalary + (c.offDayPayment ?? 0) + (c.holidayPayment ?? 0);
      const perfInc = c.performanceIncentive ?? (c.calc?.performanceIncentive ?? Math.max(0, (c.incentive ?? 0) - (c.calculatedIncentive ?? 0)));
      const totalInc = c.calc?.totalIncentive ?? ((c.calculatedIncentive ?? 0) + perfInc + (c.calc?.otPay ?? 0));
      const totalAllw = c.allowances + (c.otAllowance ?? 0) + (c.otherAllowances ?? 0);
      const gross = c.calc?.grossSalary ?? (epfBasis + totalInc + totalAllw);
      const totalDeductions = c.deductions + c.salaryAdvance + c.loanDeduction + c.pendingBills + (c.calc?.epfEmployee ?? 0);
      const deptName = c.user.assignedDepartment?.name || c.user.department || "No Department";
      const locName = c.user.location?.name || "No Location";

      return [
        `"${c.user.firstName} ${c.user.lastName}"`,
        `"${c.user.email}"`,
        `"${c.user.position || ''}"`,
        `"${deptName}"`,
        `"${locName}"`,
        c.basicSalary.toFixed(2),
        (c.offDayPayment ?? 0).toFixed(2),
        (c.holidayPayment ?? 0).toFixed(2),
        epfBasis.toFixed(2),
        (c.calculatedIncentive ?? 0).toFixed(2),
        perfInc.toFixed(2),
        (c.calc?.otPay ?? 0).toFixed(2),
        totalInc.toFixed(2),
        totalAllw.toFixed(2),
        gross.toFixed(2),
        c.deductions.toFixed(2),
        c.salaryAdvance.toFixed(2),
        c.loanDeduction.toFixed(2),
        c.pendingBills.toFixed(2),
        (c.calc?.epfEmployee ?? 0).toFixed(2),
        totalDeductions.toFixed(2),
        (c.calc?.netSalary ?? 0).toFixed(2),
        `"${c.bankName || ''}"`,
        `"${c.accountNumber || ''}"`,
        `"${c.branchName || ''}"`
      ];
    });

    const csvString = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Payroll_Report_${months[viewMonth - 1]}_${viewYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDFReport = () => {
    const doc = new jsPDF("landscape");
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(`Payroll Summary Report - ${months[viewMonth - 1]} ${viewYear}`, 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated on: ${new Date().toLocaleDateString()} | Filtered by Department: ${deptFilter}`, 14, 21);

    const headers = [
      [
        "Employee Name",
        "Department",
        "Basic (LKR)",
        "Off Day Pay (LKR)",
        "Holiday Pay (LKR)",
        "Attn Inc (LKR)",
        "Perf Inc (LKR)",
        "OT Pay (LKR)",
        "Allowances (LKR)",
        "Gross (LKR)",
        "Deductions (LKR)",
        "EPF Employee (LKR)",
        "Net Salary (LKR)"
      ]
    ];

    const rows = filteredConfigs.map(c => {
      const epfBasis = c.basicSalary + (c.offDayPayment ?? 0) + (c.holidayPayment ?? 0);
      const perfInc = c.performanceIncentive ?? (c.calc?.performanceIncentive ?? Math.max(0, (c.incentive ?? 0) - (c.calculatedIncentive ?? 0)));
      const totalInc = c.calc?.totalIncentive ?? ((c.calculatedIncentive ?? 0) + perfInc + (c.calc?.otPay ?? 0));
      const totalAllw = c.allowances + (c.otherAllowances ?? 0);
      const gross = c.calc?.grossSalary ?? (epfBasis + totalInc + totalAllw);
      const totalDeductions = c.deductions + c.salaryAdvance + c.loanDeduction + c.pendingBills + (c.calc?.epfEmployee ?? 0);
      const netSalary = c.calc?.netSalary ?? 0;
      const epfAmount = c.calc?.epfEmployee ?? 0;
      const deptName = c.user.assignedDepartment?.name || c.user.department || "No Department";

      return [
        `${c.user.firstName} ${c.user.lastName}`,
        deptName,
        c.basicSalary.toFixed(2),
        (c.offDayPayment ?? 0).toFixed(2),
        (c.holidayPayment ?? 0).toFixed(2),
        (c.calculatedIncentive ?? 0).toFixed(2),
        perfInc.toFixed(2),
        (c.calc?.otPay ?? 0).toFixed(2),
        totalAllw.toFixed(2),
        gross.toFixed(2),
        totalDeductions.toFixed(2),
        epfAmount.toFixed(2),
        netSalary.toFixed(2)
      ];
    });

    // Compute Totals
    const totals = {
      basic: 0,
      offDay: 0,
      holiday: 0,
      attendanceIncentive: 0,
      performanceIncentive: 0,
      ot: 0,
      allowances: 0,
      gross: 0,
      deductions: 0,
      epf: 0,
      net: 0
    };

    filteredConfigs.forEach(c => {
      const epfBasis = c.basicSalary + (c.offDayPayment ?? 0) + (c.holidayPayment ?? 0);
      const perfInc = c.performanceIncentive ?? (c.calc?.performanceIncentive ?? Math.max(0, (c.incentive ?? 0) - (c.calculatedIncentive ?? 0)));
      const totalInc = c.calc?.totalIncentive ?? ((c.calculatedIncentive ?? 0) + perfInc + (c.calc?.otPay ?? 0));
      const totalAllw = c.allowances + (c.otherAllowances ?? 0);
      const gross = c.calc?.grossSalary ?? (epfBasis + totalInc + totalAllw);
      const totalDeductions = c.deductions + c.salaryAdvance + c.loanDeduction + c.pendingBills + (c.calc?.epfEmployee ?? 0);
      const netSalary = c.calc?.netSalary ?? 0;
      const epfAmount = c.calc?.epfEmployee ?? 0;

      totals.basic += c.basicSalary;
      totals.offDay += c.offDayPayment ?? 0;
      totals.holiday += c.holidayPayment ?? 0;
      totals.attendanceIncentive += c.calculatedIncentive ?? 0;
      totals.performanceIncentive += perfInc;
      totals.ot += c.calc?.otPay ?? 0;
      totals.allowances += totalAllw;
      totals.gross += gross;
      totals.deductions += totalDeductions;
      totals.epf += epfAmount;
      totals.net += netSalary;
    });

    // Append total row
    rows.push([
      "Total",
      "",
      totals.basic.toFixed(2),
      totals.offDay.toFixed(2),
      totals.holiday.toFixed(2),
      totals.attendanceIncentive.toFixed(2),
      totals.performanceIncentive.toFixed(2),
      totals.ot.toFixed(2),
      totals.allowances.toFixed(2),
      totals.gross.toFixed(2),
      totals.deductions.toFixed(2),
      totals.epf.toFixed(2),
      totals.net.toFixed(2)
    ]);

    autoTable(doc, {
      startY: 26,
      head: headers,
      body: rows,
      theme: "striped",
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
        9: { halign: "right" },
        10: { halign: "right" },
        11: { halign: "right" },
        12: { halign: "right" }
      },
      didParseCell: function (data) {
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [241, 245, 249];
        }
      }
    });

    doc.save(`Payroll_Report_${months[viewMonth - 1]}_${viewYear}.pdf`);
  };

  const downloadMonthlySummary = () => {
    const headers = [
      "Employee Name",
      "Basic Salary (Total for EPF)",
      "Allowance (Total Incentive)",
      "Gross Salary",
      "Total Deductions",
      "Net Salary",
      "Gross + Allowance",
      "Deductions",
      "ETF (3%)",
      "EPF (12%)",
      "EPF (8%)",
      "EPF Total (20%)",
      "Advance"
    ];

    const rows = filteredConfigs.map(c => {
      const epfBasis = c.basicSalary + (c.offDayPayment ?? 0) + (c.holidayPayment ?? 0);
      const perfInc = c.performanceIncentive ?? (c.calc?.performanceIncentive ?? Math.max(0, (c.incentive ?? 0) - (c.calculatedIncentive ?? 0)));
      const totalInc = c.calc?.totalIncentive ?? ((c.calculatedIncentive ?? 0) + perfInc + (c.calc?.otPay ?? 0));
      const totalAllw = c.allowances + (c.otherAllowances ?? 0);
      const gross = c.calc?.grossSalary ?? (epfBasis + totalInc + totalAllw);
      const totalDeductions = c.deductions + c.salaryAdvance + c.loanDeduction + c.pendingBills + (c.calc?.epfEmployee ?? 0);
      const netSalary = c.calc?.netSalary ?? 0;
      
      const etf = (epfBasis * 0.03).toFixed(2);
      const epfEmployer = (epfBasis * 0.12).toFixed(2);
      const epfEmployee = (epfBasis * 0.08).toFixed(2);
      const epfTotal = (epfBasis * 0.20).toFixed(2);

      return [
        `"${c.user.firstName} ${c.user.lastName}"`,
        epfBasis.toFixed(2),
        totalInc.toFixed(2),
        gross.toFixed(2),
        totalDeductions.toFixed(2),
        netSalary.toFixed(2),
        (gross + totalAllw).toFixed(2), // Assumed Gross + Allowance based on req
        c.deductions.toFixed(2),
        etf,
        epfEmployer,
        epfEmployee,
        epfTotal,
        c.salaryAdvance.toFixed(2)
      ];
    });

    const csvString = [headers.join(","), ...rows.map(e => e.join(","))].join("\\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Monthly_Summary_${months[viewMonth - 1]}_${viewYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredConfigs = configs.filter(c => {
    const matchesSearch = `${c.user.firstName} ${c.user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
    const resolvedDept = c.user.assignedDepartment?.name || c.user.department || "No Department";
    const resolvedLoc = c.user.location?.name || "No Location";

    const matchesDept = deptFilter === "ALL" || resolvedDept === deptFilter;
    const matchesLoc = locationFilter === "ALL" || resolvedLoc === locationFilter;

    // Additionally let search term match dept/location directly
    const searchAlsoMatchesLocation = resolvedLoc.toLowerCase().includes(searchTerm.toLowerCase());
    const searchAlsoMatchesDept = resolvedDept.toLowerCase().includes(searchTerm.toLowerCase());

    const assignedComp = companyAssignments[c.userId] || "UNASSIGNED";
    const matchesCompany = companyFilter === "ALL" || 
      (companyFilter === "UNASSIGNED" ? assignedComp === "UNASSIGNED" : assignedComp === companyFilter);

    const epfAmount = c.calc?.epfEmployee ?? 0;
    const hasEpf = epfAmount > 0;
    const matchesEpf = epfFilter === "ALL" || (epfFilter === "WITH_EPF" ? hasEpf : !hasEpf);

    return (matchesSearch || searchAlsoMatchesLocation || searchAlsoMatchesDept) && matchesDept && matchesLoc && matchesCompany && matchesEpf;
  });


  return (
    <div className="space-y-6">
      {/* Super Admin Payslip Visibility Control Card */}
      <Card className={`border-2 transition-all rounded-2xl overflow-hidden shadow-md ${
        hidePayslips
          ? "border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 dark:via-amber-900/10 dark:to-transparent"
          : "border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/30 dark:via-emerald-900/10 dark:to-transparent"
      }`}>
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl shrink-0 ${
              hidePayslips
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            }`}>
              {hidePayslips ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100 tracking-tight">
                  Payslip Visibility for Employees & Admins
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                  hidePayslips
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                }`}>
                  {hidePayslips ? "HIDDEN (Restricted)" : "VISIBLE (Allowed)"}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {hidePayslips
                  ? "Payslips are currently HIDDEN across the platform for all regular Admins and Employees while calculations are being reviewed."
                  : "Payslips are currently VISIBLE to Employees and Admins on their respective dashboards."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <Button
              disabled={isUpdatingSetting}
              onClick={() => handleTogglePayslipVisibility(!hidePayslips)}
              className={`rounded-xl font-bold px-4 py-2 text-xs transition-all shadow-md flex items-center gap-2 ${
                hidePayslips
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                  : "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20"
              }`}
            >
              {hidePayslips ? (
                <>
                  <Eye className="h-4 w-4" /> Enable Payslip Visibility
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4" /> Hide Payslips
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              className="pl-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select 
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            {departmentsList.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          
          <select 
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="ALL">All Locations</option>
            <option value="TSF">TSF</option>
            <option value="DIVRON">DIVRON</option>
            {locationsList.filter(l => l !== "TSF" && l !== "DIVRON").map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          <select 
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="ALL">All Companies</option>
            <option value="Divron Bioventuress">Divron Bioventuress</option>
            <option value="Tropical ShellFish">Tropical ShellFish</option>
            <option value="UNASSIGNED">Unassigned</option>
          </select>

          <select 
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100"
            value={epfFilter}
            onChange={(e) => setEpfFilter(e.target.value)}
          >
            <option value="ALL">All EPF Status</option>
            <option value="WITH_EPF">With EPF Deductions</option>
            <option value="WITHOUT_EPF">Without EPF Deductions</option>
          </select>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-sm flex-wrap">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Period:</span>
            <select 
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
              value={viewMonth}
              onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
            >
              {months.map((m, idx) => (
                <option key={m} value={idx + 1} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                  {m}
                </option>
              ))}
            </select>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <select 
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
              value={viewYear}
              onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
            >
              {[2024, 2025, 2026, 2027, 2028].map(y => (
                <option key={y} value={y} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                  {y}
                </option>
              ))}
            </select>
          </div>

          {configs.some(c => c.isSaved) ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-widest border border-emerald-500/20 whitespace-nowrap">
              <CheckCircle2 className="h-3.5 w-3.5" /> Permanent Record Saved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-widest border border-amber-500/20 whitespace-nowrap">
              <Clock className="h-3.5 w-3.5" /> Live Preview
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedUserIds.length > 0 && (
            <Button 
              onClick={() => setIsClearDialogOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-rose-500/10"
            >
              <Trash2 className="h-4 w-4" /> Clear Selected ({selectedUserIds.length})
            </Button>
          )}
          <Button 
            onClick={downloadCSVReport}
            className="bg-slate-600 hover:bg-slate-700 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-slate-500/10"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button 
            onClick={downloadMonthlySummary}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-purple-500/10"
          >
            <Download className="h-4 w-4" /> Export Monthly Summary
          </Button>
          <Button 
            onClick={downloadPDFReport}
            className="bg-slate-600 hover:bg-slate-700 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-slate-500/10"
          >
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
          <Button 
            onClick={() => {
              setSelectedConfig({});
              setIsConfigDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Salary Config
          </Button>
          <Button 
            onClick={handleSaveCurrentPayroll}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/10 font-bold"
          >
            <Save className="h-4 w-4" /> {isSaving ? "Saving..." : `Save Payroll (${months[viewMonth - 1]})`}
          </Button>
          <Button 
            onClick={() => setIsProcessDialogOpen(true)}
            className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl flex items-center gap-2"
          >
            <Settings2 className="h-4 w-4" /> Process Monthly
          </Button>
          <Button 
            onClick={() => setIsCompanyCategorizationOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/10 font-bold"
          >
            <Building2 className="h-4 w-4" /> Company Profiles
          </Button>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Configured Staff</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{configs.length}</div>
            <p className="text-xs text-muted-foreground">Active salary profiles</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Average Basic</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {formatCurrency(configs.length ? configs.reduce((acc, curr) => acc + curr.basicSalary, 0) / configs.length : 0)}
            </div>
            <p className="text-xs text-muted-foreground">Per employee monthly</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Employer's Contributions</CardTitle>
            <Banknote className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">EPF (Employer)</span>
                <span className="text-base font-black text-amber-600 dark:text-amber-400">
                  {formatCurrency(
                    configs.reduce(
                      (acc, curr) =>
                        acc +
                        (curr.basicSalary + (curr.offDayPayment ?? 0) + (curr.holidayPayment ?? 0)) * ((curr.epfEmployer ?? 12) / 100),
                      0
                    )
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">ETF (Employer)</span>
                <span className="text-base font-black text-amber-600 dark:text-amber-400">
                  {formatCurrency(
                    configs.reduce(
                      (acc, curr) =>
                        acc +
                        (curr.basicSalary + (curr.offDayPayment ?? 0) + (curr.holidayPayment ?? 0)) * ((curr.etfEmployer ?? 3) / 100),
                      0
                    )
                  )}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">Calculated on Total For EPF</p>
          </CardContent>
        </Card>
      </div>

      <Table containerClassName="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto max-h-[70vh] relative" className="min-w-[1800px] w-full border-separate border-spacing-0">
        <TableHeader className="sticky top-0 z-20 shadow-sm">
          <TableRow className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">
            <TableHead className="w-12 min-w-[48px] max-w-[48px] sticky top-0 left-0 z-30 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
              <Checkbox 
                checked={filteredConfigs.length > 0 && selectedUserIds.length === filteredConfigs.length}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedUserIds(filteredConfigs.map(c => c.userId));
                  } else {
                    setSelectedUserIds([]);
                  }
                }}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="sticky top-0 left-12 z-30 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px] w-[260px] min-w-[260px] max-w-[260px] border-r border-slate-200 dark:border-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">Employee</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px] whitespace-nowrap min-w-[120px]">Basic Salary</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px] whitespace-nowrap min-w-[130px]">
              Off Day Payment
              <span className="block font-normal normal-case tracking-normal text-muted-foreground">Auto · {months[viewMonth - 1]} {viewYear}</span>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px] whitespace-nowrap min-w-[130px]">
              Holiday Payment
              <span className="block font-normal normal-case tracking-normal text-muted-foreground">Auto · {months[viewMonth - 1]} {viewYear}</span>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-purple-100 dark:bg-purple-950 font-black uppercase tracking-widest text-[10px] text-purple-700 dark:text-purple-300 whitespace-nowrap min-w-[130px]">
              Total For EPF
              <span className="block font-normal normal-case tracking-normal text-muted-foreground">Basic + Off + Holiday</span>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-emerald-100 dark:bg-emerald-950 font-black uppercase tracking-widest text-[10px] text-emerald-700 dark:text-emerald-300 whitespace-nowrap min-w-[140px]">
              Attendance Incentive
              <span className="block font-normal normal-case tracking-normal text-muted-foreground">Prorated Attendance</span>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-teal-100 dark:bg-teal-950 font-black uppercase tracking-widest text-[10px] text-teal-700 dark:text-teal-300 whitespace-nowrap min-w-[140px]">
              Performance Incentive
              <span className="block font-normal normal-case tracking-normal text-muted-foreground">Config - Attendance</span>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px] whitespace-nowrap min-w-[130px]">
              Over Time
              <span className="block font-normal normal-case tracking-normal text-muted-foreground">Hours × Rate × 1.5</span>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-amber-100 dark:bg-amber-950 font-black uppercase tracking-widest text-[10px] text-amber-700 dark:text-amber-300 whitespace-nowrap min-w-[130px]">
              Total Incentive
              <span className="block font-normal normal-case tracking-normal text-muted-foreground">Incentive + OT</span>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px] whitespace-nowrap min-w-[130px]">Allowances</TableHead>
            <TableHead className="sticky top-0 z-20 bg-blue-100 dark:bg-blue-950 font-black uppercase tracking-widest text-[10px] text-blue-700 dark:text-blue-300 whitespace-nowrap min-w-[130px]">
              Gross Salary
              <span className="block font-normal normal-case tracking-normal text-muted-foreground">EPF + Inc + Allw</span>
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px] whitespace-nowrap min-w-[160px]">
              Deductions Breakdown
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-red-100 dark:bg-red-950 font-black uppercase tracking-widest text-[10px] text-red-700 dark:text-red-300 whitespace-nowrap min-w-[130px]">
              Total Deductions
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-emerald-100 dark:bg-emerald-950 font-black uppercase tracking-widest text-[10px] text-emerald-700 dark:text-emerald-300 whitespace-nowrap min-w-[130px]">
              Net Salary
            </TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px] whitespace-nowrap min-w-[150px]">Bank Details</TableHead>
            <TableHead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 font-black uppercase tracking-widest text-[10px] text-right whitespace-nowrap min-w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
          <TableBody>
            {filteredConfigs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={16} className="text-center py-10 text-muted-foreground">
                  No salary configurations found.
                </TableCell>
              </TableRow>
            ) : (
              filteredConfigs.map((config) => (
                <TableRow key={config.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <TableCell className="w-12 min-w-[48px] max-w-[48px] sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                    <Checkbox 
                      checked={selectedUserIds.includes(config.userId)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUserIds([...selectedUserIds, config.userId]);
                        } else {
                          setSelectedUserIds(selectedUserIds.filter(id => id !== config.userId));
                        }
                      }}
                      aria-label={`Select ${config.user.firstName}`}
                    />
                  </TableCell>
                  <TableCell className="sticky left-12 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 w-[260px] min-w-[260px] max-w-[260px] border-r border-slate-200 dark:border-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap overflow-hidden">
                    <div className="flex flex-col max-w-[240px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate" title={`${config.user.firstName} ${config.user.lastName}`}>{config.user.firstName} {config.user.lastName}</span>
                        {config.isSaved && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0" title="Saved in Database">
                            SAVED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-xs text-muted-foreground truncate max-w-[230px]" title={`${config.user.position} | ${config.user.department}`}>{config.user.position} | {config.user.department}</span>
                        {companyAssignments[config.userId] && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                            companyAssignments[config.userId] === 'Divron Bioventuress'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300'
                          }`}>
                            {companyAssignments[config.userId]}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold whitespace-nowrap">{formatCurrency(config.basicSalary)}</TableCell>
                  <TableCell className="text-blue-600 font-medium whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>+{formatCurrency(config.offDayPayment ?? 0)}</span>
                      {(config.offDaysWorked ?? 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {config.offDaysWorked} off day{config.offDaysWorked !== 1 ? 's' : ''} worked
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-amber-600 font-medium whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>+{formatCurrency(config.holidayPayment ?? 0)}</span>
                      {(config.holidaysWorked ?? 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {config.holidaysWorked} holiday{config.holidaysWorked !== 1 ? 's' : ''} worked
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-purple-600 dark:text-purple-400 font-black bg-purple-50/30 dark:bg-purple-950/10 whitespace-nowrap">
                    {formatCurrency(
                      config.basicSalary +
                        (config.offDayPayment ?? 0) +
                        (config.holidayPayment ?? 0)
                    )}
                  </TableCell>
                  <TableCell className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/30 dark:bg-emerald-950/10 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>+{formatCurrency(config.calculatedIncentive ?? 0)}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {config.actuallyWorkedDays ?? 0}/{config.expectedWorkingDays ?? 25} days · Config: {formatCurrency(config.incentive ?? 0)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-teal-600 dark:text-teal-400 font-bold bg-teal-50/30 dark:bg-teal-950/10 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>+{formatCurrency(config.performanceIncentive ?? (config.calc?.performanceIncentive ?? Math.max(0, (config.incentive ?? 0) - (config.calculatedIncentive ?? 0))))}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        Config: {formatCurrency(config.incentive ?? 0)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>+{formatCurrency(config.calc?.otPay ?? 0)}</span>
                      {(config.calc?.otHours ?? 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {config.calc?.otHours} hrs
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50/30 dark:bg-amber-950/10 whitespace-nowrap">
                    +{formatCurrency(config.calc?.totalIncentive ?? ((config.calculatedIncentive ?? 0) + (config.performanceIncentive ?? (config.calc?.performanceIncentive ?? Math.max(0, (config.incentive ?? 0) - (config.calculatedIncentive ?? 0)))) + (config.calc?.otPay ?? 0)))}
                  </TableCell>
                  <TableCell className="text-emerald-600 font-medium whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>+{formatCurrency(config.allowances + (config.otherAllowances || 0))}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        Fixed: {formatCurrency(config.allowances)}
                      </span>
                      {(config.otAllowance || 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          OT Rate: {formatCurrency(config.otAllowance!)}/hr
                        </span>
                      )}
                      {(config.otherAllowances || 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Other: {formatCurrency(config.otherAllowances!)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-blue-600 dark:text-blue-400 font-black bg-blue-50/30 dark:bg-blue-950/10 whitespace-nowrap">
                    {formatCurrency(config.calc?.grossSalary ?? (
                      config.basicSalary + (config.offDayPayment ?? 0) + (config.holidayPayment ?? 0) + (config.calculatedIncentive ?? 0) + (config.performanceIncentive ?? Math.max(0, (config.incentive ?? 0) - (config.calculatedIncentive ?? 0))) + config.allowances + (config.otherAllowances || 0) + ((otData.find(d => d.userId === config.userId)?.otHours ?? 0) * (config.otAllowance ?? (((config.basicSalary + (config.incentive ?? 0))/240)*1.5)))
                    ))}
                  </TableCell>
                  <TableCell className="text-red-600 text-xs whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      {config.deductions > 0 && <span>Statutory: {formatCurrency(config.deductions)}</span>}
                      {config.salaryAdvance > 0 && <span>Advance: {formatCurrency(config.salaryAdvance)}</span>}
                      {config.loanDeduction > 0 && <span>Loan: {formatCurrency(config.loanDeduction)}</span>}
                      {config.pendingBills > 0 && <span>Bills: {formatCurrency(config.pendingBills)}</span>}
                      {config.calc?.epfEmployee > 0 && <span>EPF ({config.epfEmployee}%): {formatCurrency(config.calc?.epfEmployee)}</span>}
                      {(config.deductions === 0 && config.salaryAdvance === 0 && config.loanDeduction === 0 && config.pendingBills === 0 && !(config.calc?.epfEmployee > 0)) && (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-red-600 dark:text-red-400 font-bold bg-red-50/30 dark:bg-red-950/10 whitespace-nowrap">
                    -{formatCurrency(
                      config.deductions + config.salaryAdvance + config.loanDeduction + config.pendingBills + (config.calc?.epfEmployee ?? 0)
                    )}
                  </TableCell>
                  <TableCell className="text-emerald-600 dark:text-emerald-400 font-black text-lg bg-emerald-50/30 dark:bg-emerald-950/10 whitespace-nowrap">
                    {formatCurrency(config.calc?.netSalary ?? 0)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-col text-xs">
                      <span className="font-medium">{config.bankName || "N/A"}</span>
                      <span className="text-muted-foreground">{config.accountNumber || "N/A"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        title="View attendance calendar"
                        onClick={() => {
                          setCalendarConfig(config);
                          setIsCalendarDialogOpen(true);
                        }}
                      >
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg h-8 w-8 p-0"
                        onClick={() => {
                          setSelectedConfig(config);
                          setIsConfigDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

      {/* Config Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-2xl border-t-4 border-primary p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              {selectedConfig?.id ? "Edit Salary Profile" : "New Salary Profile"}
            </DialogTitle>
            <DialogDescription>
              Configure basic salary, allowances, and off days count. Off-day payment = (daily rate × off days) × 2. Holiday payment is from attendance on public holidays.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveConfig} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Employee</Label>
                <select 
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  value={selectedConfig?.userId || ""}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, userId: e.target.value })}
                  disabled={!!selectedConfig?.id}
                >
                  <option value="">Select an employee...</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Basic Salary (LKR)</Label>
                <Input 
                  type="number"
                  value={selectedConfig?.basicSalary || ""}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, basicSalary: parseFloat(e.target.value) })}
                  className="rounded-xl"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fixed Allowances (LKR)</Label>
                <Input 
                  type="number"
                  value={selectedConfig?.allowances || ""}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, allowances: parseFloat(e.target.value) })}
                  className="rounded-xl"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hourly OT Rate (LKR)</Label>
                <Input 
                  type="number"
                  value={selectedConfig?.otAllowance || ""}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, otAllowance: parseFloat(e.target.value) })}
                  className="rounded-xl"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Other Allowances (LKR)</Label>
                <Input 
                  type="number"
                  value={selectedConfig?.otherAllowances || ""}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, otherAllowances: parseFloat(e.target.value) })}
                  className="rounded-xl"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Off Days (count)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={selectedConfig?.offDaysCount ?? ""}
                  onChange={(e) =>
                    setSelectedConfig({
                      ...selectedConfig,
                      offDaysCount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="rounded-xl"
                  placeholder="0"
                />
                 <p className="text-[10px] text-muted-foreground">
                  Allowed off-days count. Expected work days = 30 - off days.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Incentive (LKR)</Label>
                <Input 
                  type="number"
                  value={selectedConfig?.incentive ?? ""}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, incentive: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl"
                  placeholder="0.00"
                />
                <p className="text-[10px] text-muted-foreground">
                  Configured monthly incentive. Paid prorated: (incentive ÷ expected work days) × actually worked days.
                </p>
              </div>
              <div className="col-span-2 space-y-4 pt-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Statutory Deductions & Advances</Label>
                  <select 
                    className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg border-none cursor-pointer outline-none hover:bg-primary/10 transition-colors"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "salaryAdvance") setSelectedConfig({ ...selectedConfig, salaryAdvance: 0 });
                      if (val === "loanDeduction") setSelectedConfig({ ...selectedConfig, loanDeduction: 0 });
                      if (val === "pendingBills") setSelectedConfig({ ...selectedConfig, pendingBills: 0 });
                    }}
                    value=""
                  >
                    <option value="" disabled>+ Add Deduction Type</option>
                    <option value="salaryAdvance">Salary Advance</option>
                    <option value="loanDeduction">Loan Deduction</option>
                    <option value="pendingBills">Pending Bills</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(selectedConfig?.salaryAdvance !== undefined || (configs.find(c => c.id === selectedConfig?.id)?.salaryAdvance || 0) > 0) && (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold flex items-center justify-between">
                        Salary Advance (LKR)
                        <button type="button" onClick={() => setSelectedConfig({ ...selectedConfig, salaryAdvance: undefined })} className="text-[8px] text-red-500 hover:underline">Remove</button>
                      </Label>
                      <Input 
                        type="number"
                        value={selectedConfig?.salaryAdvance ?? ""}
                        onChange={(e) => setSelectedConfig({ ...selectedConfig, salaryAdvance: parseFloat(e.target.value) })}
                        className="rounded-xl h-9"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  {(selectedConfig?.loanDeduction !== undefined || (configs.find(c => c.id === selectedConfig?.id)?.loanDeduction || 0) > 0) && (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold flex items-center justify-between">
                        Loan Deduction (LKR)
                        <button type="button" onClick={() => setSelectedConfig({ ...selectedConfig, loanDeduction: undefined })} className="text-[8px] text-red-500 hover:underline">Remove</button>
                      </Label>
                      <Input 
                        type="number"
                        value={selectedConfig?.loanDeduction ?? ""}
                        onChange={(e) => setSelectedConfig({ ...selectedConfig, loanDeduction: parseFloat(e.target.value) })}
                        className="rounded-xl h-9"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  {(selectedConfig?.pendingBills !== undefined || (configs.find(c => c.id === selectedConfig?.id)?.pendingBills || 0) > 0) && (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold flex items-center justify-between">
                        Pending Bills (LKR)
                        <button type="button" onClick={() => setSelectedConfig({ ...selectedConfig, pendingBills: undefined })} className="text-[8px] text-red-500 hover:underline">Remove</button>
                      </Label>
                      <Input 
                        type="number"
                        value={selectedConfig?.pendingBills ?? ""}
                        onChange={(e) => setSelectedConfig({ ...selectedConfig, pendingBills: parseFloat(e.target.value) })}
                        className="rounded-xl h-9"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold">Other Deductions (LKR)</Label>
                    <Input 
                      type="number"
                      value={selectedConfig?.deductions || ""}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, deductions: parseFloat(e.target.value) })}
                      className="rounded-xl h-9"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">EPF Employee %</Label>
                <Input 
                  type="number"
                  value={selectedConfig?.epfEmployee ?? 8}
                  onChange={(e) => setSelectedConfig({ ...selectedConfig, epfEmployee: parseFloat(e.target.value) })}
                  className="rounded-xl"
                />
              </div>

              <div className="col-span-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Banking Information (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bank Name</Label>
                    <Input 
                      value={selectedConfig?.bankName || ""}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, bankName: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account Number</Label>
                    <Input 
                      value={selectedConfig?.accountNumber || ""}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, accountNumber: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Branch</Label>
                    <Input 
                      value={selectedConfig?.branchName || ""}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, branchName: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsConfigDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8">Save Profile</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Attendance / Holiday Calendar */}
      <Dialog open={isCalendarDialogOpen} onOpenChange={setIsCalendarDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl border-t-4 border-emerald-600 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-emerald-600" />
              Attendance &amp; Holiday Calendar
            </DialogTitle>
            <DialogDescription>
              Green = worked (attendance). Amber = public holiday. Check if the employee worked on holidays and off days.
            </DialogDescription>
          </DialogHeader>
          {calendarConfig && user?.id && (
            <PayrollAttendanceCalendar
              userId={calendarConfig.userId}
              employeeName={`${calendarConfig.user.firstName} ${calendarConfig.user.lastName}`}
              authHeader={user.id}
              initialMonth={calendarConfig.calculationMonth}
              initialYear={calendarConfig.calculationYear}
              onApply={(m, y) => {
                setViewMonth(m);
                setViewYear(y);
                setIsCalendarDialogOpen(false);
                toast({
                  title: "Payments Applied",
                  description: `Applied payroll calculation view for ${months[m - 1]} ${y}.`,
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Process Dialog */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl border-t-4 border-emerald-600">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-emerald-600" />
              Process Monthly Payroll
            </DialogTitle>
            <DialogDescription>
              This will generate payslips for all configured employees for the selected period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Month</Label>
                <select 
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  value={processMonth}
                  onChange={(e) => setProcessMonth(parseInt(e.target.value))}
                >
                  {months.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Year</Label>
                <Input 
                  type="number"
                  value={processYear}
                  onChange={(e) => setProcessYear(parseInt(e.target.value))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 flex gap-3">
              <Clock className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Processing uses salary config, attendance (late deductions, off-day & holiday pay from roster), and approved OT.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProcessDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleProcessPayroll} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8 shadow-lg shadow-emerald-500/20">
              Run Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Confirmation Dialog */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl border-t-4 border-rose-600">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-600" />
              Clear Processed Payroll
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to clear the processed payroll records for the selected employee(s) for the period {months[viewMonth - 1]} {viewYear}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsClearDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleClearPayroll} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-8 shadow-lg shadow-rose-500/20">
              Clear Records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Categorization Dialog */}
      <Dialog open={isCompanyCategorizationOpen} onOpenChange={(open) => {
        setIsCompanyCategorizationOpen(open);
        if (!open) fetchCompanyAssignments();
      }}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[92vh] overflow-y-auto rounded-3xl p-4 sm:p-6 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Building2 className="h-6 w-6 text-indigo-600" />
              Company Profiles & Batch Categorization
            </DialogTitle>
            <DialogDescription>
              Assign employees to Divron Bioventuress or Tropical ShellFish in batch using Select All.
            </DialogDescription>
          </DialogHeader>
          <CompanyCategorization />
        </DialogContent>
      </Dialog>
    </div>
  );
}
