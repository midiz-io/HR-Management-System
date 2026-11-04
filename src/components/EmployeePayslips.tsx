import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Download, 
  FileText, 
  Eye,
  Calendar,
  Wallet,
  TrendingUp,
  Banknote,
  EyeOff,
  ShieldAlert
} from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/util/payroll";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Payroll {
  id: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  offDayPay?: number;
  holidayPay?: number;
  incentive?: number;
  performanceIncentive?: number;
  deductions: number;
  attendanceBonus: number;
  otPay: number;
  lateDeductions: number;
  epfAmount: number;
  etfAmount: number;
  netSalary: number;
  status: string;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    position: string;
    department: string;
  };
}

export default function EmployeePayslips() {
  const { user } = useAuth();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isPayslipHidden, setIsPayslipHidden] = useState(false);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/payroll/settings", {
        headers: { "Authorization": user?.id || "" }
      });
      if (response.ok) {
        const data = await response.json();
        setIsPayslipHidden(data.hidePayslips ?? false);
      }
    } catch (error) {
      console.error("Error fetching payslip settings:", error);
    }
  };

  const fetchPayrolls = async () => {
    try {
      const response = await fetch("/api/payroll", {
        headers: { "Authorization": user?.id || "" }
      });
      if (response.ok) {
        const data = await response.json();
        setPayrolls(data);
      }
    } catch (error) {
      console.error("Error fetching payrolls:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchPayrolls();
    }
  }, [user]);

  const generatePDF = (payroll: Payroll) => {
    const doc = new jsPDF();
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const totalForEpf = payroll.basicSalary + (payroll.offDayPay ?? 0) + (payroll.holidayPay ?? 0);
    const epfRate = totalForEpf > 0 ? Math.round((payroll.epfAmount / totalForEpf) * 100) : 8;

    // Brand Header (Company details removed)


    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38); // red-600
    doc.text("OFFICIAL PAY SLIP", 190, 25, { align: "right" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Period: ${months[payroll.month - 1]} ${payroll.year}`, 190, 31, { align: "right" });

    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(20, 37, 190, 37);

    // Employee & Payslip Metadata Columns
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("EMPLOYEE DETAILS", 20, 47);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    
    const empName = payroll.user ? `${payroll.user.firstName} ${payroll.user.lastName}` : user?.email || "";
    doc.text(`Name: ${empName}`, 20, 53);
    doc.text(`Designation: ${payroll.user?.position || "N/A"}`, 20, 59);
    doc.text(`Department: ${payroll.user?.department || "N/A"}`, 20, 65);

    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT INFORMATION", 110, 47);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Payslip ID: ${payroll.id.substring(0, 8).toUpperCase()}`, 110, 53);
    doc.text(`Email: ${payroll.user?.email || user?.email || "N/A"}`, 110, 59);
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 110, 65);

    // Earnings Table
    autoTable(doc, {
      startY: 75,
      margin: { left: 20, right: 20 },
      head: [['Earnings Description', 'Amount (LKR)']],
      body: [
        ['Basic Salary', payroll.basicSalary.toFixed(2)],
        ['Allowances', payroll.allowances.toFixed(2)],
        ['Attendance Incentive', (payroll.incentive ?? 0).toFixed(2)],
        ['Performance Incentive', (payroll.performanceIncentive ?? 0).toFixed(2)],
        ['Off Day Payment', (payroll.offDayPay ?? 0).toFixed(2)],
        ['Holiday Payment', (payroll.holidayPay ?? 0).toFixed(2)],
        ['Attendance Bonus', payroll.attendanceBonus.toFixed(2)],
        ['Overtime (OT) Pay', payroll.otPay.toFixed(2)],
        [
          { content: 'Gross Earnings', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          {
            content: (
              payroll.basicSalary +
              payroll.allowances +
              (payroll.incentive ?? 0) +
              (payroll.performanceIncentive ?? 0) +
              (payroll.offDayPay ?? 0) +
              (payroll.holidayPay ?? 0) +
              payroll.attendanceBonus +
              payroll.otPay
            ).toFixed(2),
            styles: { fontStyle: 'bold', fillColor: [248, 250, 252] },
          },
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 50, halign: 'right' }
      }
    });

    // Deductions Table
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      margin: { left: 20, right: 20 },
      head: [['Deductions Description', 'Amount (LKR)']],
      body: [
        ['Statutory Deductions', payroll.deductions.toFixed(2)],
        [`EPF Employee Share (${epfRate}%)`, payroll.epfAmount.toFixed(2)],
        [
          { content: 'Total Deductions', styles: { fontStyle: 'bold', fillColor: [254, 242, 242] } },
          { 
            content: (payroll.deductions + payroll.epfAmount).toFixed(2), 
            styles: { fontStyle: 'bold', fillColor: [254, 242, 242], textColor: [220, 38, 38] } 
          }
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [153, 27, 27], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 50, halign: 'right' }
      }
    });

    // Employer Contributions Details
    const startYContrib = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Employer Contributions (Not Deducted From Salary):", 20, startYContrib);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`EPF Employer Contribution (12%): LKR ${(totalForEpf * 0.12).toFixed(2)}`, 20, startYContrib + 5);
    doc.text(`ETF Employer Contribution (3%): LKR ${(totalForEpf * 0.03).toFixed(2)}`, 20, startYContrib + 9);

    // Summary Card / Box for Net Salary
    const finalY = (doc as any).lastAutoTable.finalY + 28;
    
    // Draw background rectangle for Net Salary
    doc.setFillColor(240, 253, 250); // emerald-50
    doc.setDrawColor(209, 250, 229); // emerald-100
    doc.roundedRect(110, finalY - 8, 80, 18, 2, 2, "FD");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(6, 95, 70); // emerald-800
    doc.text("NET SALARY PAYABLE:", 115, finalY + 3);
    
    doc.setFontSize(14);
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text(`LKR ${payroll.netSalary.toFixed(2)}`, 185, finalY + 3, { align: "right" });

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("This is a system generated payslip of AttendX systems and does not require a physical signature.", 105, 275, { align: "center" });

    doc.save(`Payslip_${months[payroll.month - 1]}_${payroll.year}.pdf`);
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (loading) return <div className="p-8 text-center text-sm text-slate-500 font-medium">Loading payroll records...</div>;

  if (isPayslipHidden) {
    return (
      <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-900/40 rounded-3xl overflow-hidden shadow-xl p-8 sm:p-12 text-center my-6">
        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="h-20 w-20 rounded-3xl bg-amber-500/20 text-amber-500 flex items-center justify-center mb-6 ring-8 ring-amber-500/10 shadow-inner">
            <EyeOff className="h-10 w-10" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Payslip Access Temporarily Restricted
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed font-medium">
            Payslips are currently hidden by Super Admin while salary calculations are being updated. Please check back later.
          </p>
          <div className="mt-6 px-4 py-2 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-sm">
            <ShieldAlert className="h-4 w-4" /> Calculation Review in Progress
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Latest Net Pay</CardTitle>
            <Banknote className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {payrolls.length ? formatCurrency(payrolls[0].netSalary) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">For {payrolls.length ? `${months[payrolls[0].month - 1]} ${payrolls[0].year}` : "no records"}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Total YTD Pay</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {formatCurrency(payrolls.reduce((acc, curr) => acc + curr.netSalary, 0))}
            </div>
            <p className="text-xs text-muted-foreground">Year-to-date earnings</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">EPF Balance (Contrib)</CardTitle>
            <Wallet className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {formatCurrency(payrolls.reduce((acc, curr) => acc + curr.epfAmount, 0))}
            </div>
            <p className="text-xs text-muted-foreground">Total employee contribution</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <FileText className="h-4 w-4 text-red-600" />
          </div>
          <h3 className="font-black uppercase tracking-tighter">Payslip History</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="font-black uppercase tracking-widest text-[10px]">Period</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px]">Net Salary</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px]">Status</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrolls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
                  No payslips available yet.
                </TableCell>
              </TableRow>
            ) : (
              payrolls.map((payroll) => (
                <TableRow key={payroll.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold">{months[payroll.month - 1]} {payroll.year}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-black text-emerald-600">
                    {formatCurrency(payroll.netSalary)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Paid
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-xl h-9 hover:bg-slate-100 hover:text-slate-900"
                        title="Preview Payslip"
                        onClick={() => {
                          setSelectedPayroll(payroll);
                          setIsPreviewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-xl h-9 hover:bg-red-50 hover:text-red-600 group-hover:bg-red-50"
                        title="Download PDF"
                        onClick={() => generatePDF(payroll)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Payslip Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[800px] max-h-[90vh] overflow-y-auto rounded-2xl border-t-4 border-slate-900 p-6 print:p-0 print:border-none print:shadow-none print:bg-white">
          {selectedPayroll && (
            <div className="space-y-6">
              <DialogHeader className="print:hidden">
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Payslip Preview
                </DialogTitle>
                <DialogDescription>
                  Review your payslip details for {months[selectedPayroll.month - 1]} {selectedPayroll.year}.
                </DialogDescription>
              </DialogHeader>

              {/* Printable Area resembling A4 payslip sheet */}
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-6 bg-slate-50/50 dark:bg-slate-900/50 space-y-6 print:border-none print:p-0 print:bg-white text-slate-800 dark:text-slate-100">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 border-slate-200 dark:border-slate-800 gap-4">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-primary">AttendX</h2>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Official Pay Slip</p>
                  </div>
                  {/* Company details removed */}

                </div>

                {/* Profile Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-800">
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Employee Name</span>
                      <p className="font-bold text-base text-slate-900 dark:text-slate-100">
                        {selectedPayroll.user ? `${selectedPayroll.user.firstName} ${selectedPayroll.user.lastName}` : user?.email}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Designation</span>
                      <p className="font-bold">{selectedPayroll.user?.position || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Department</span>
                      <p className="font-bold">{selectedPayroll.user?.department || "N/A"}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Pay Period</span>
                      <p className="font-bold text-base text-primary">
                        {months[selectedPayroll.month - 1]} {selectedPayroll.year}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Generated Date</span>
                      <p className="font-bold">{new Date(selectedPayroll.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Email</span>
                      <p className="font-bold">{selectedPayroll.user?.email || user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Earnings & Deductions Tables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  
                  {/* Earnings */}
                  <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="bg-slate-900 text-white px-4 py-2 text-xs font-black uppercase tracking-widest">
                      Earnings
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-slate-100 dark:border-slate-900">
                          <td className="px-4 py-2 text-muted-foreground">Basic Salary</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(selectedPayroll.basicSalary)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-900">
                          <td className="px-4 py-2 text-muted-foreground">Allowances</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(selectedPayroll.allowances)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-900">
                          <td className="px-4 py-2 text-muted-foreground">Attendance Incentive</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(selectedPayroll.incentive ?? 0)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-900">
                          <td className="px-4 py-2 text-muted-foreground">Performance Incentive</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(selectedPayroll.performanceIncentive ?? 0)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-900">
                          <td className="px-4 py-2 text-muted-foreground">Off Day Payment</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(selectedPayroll.offDayPay ?? 0)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-900">
                          <td className="px-4 py-2 text-muted-foreground">Holiday Payment</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(selectedPayroll.holidayPay ?? 0)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-900">
                          <td className="px-4 py-2 text-muted-foreground">Attendance Bonus</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(selectedPayroll.attendanceBonus)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-950">
                          <td className="px-4 py-2 text-muted-foreground">Overtime (OT) Pay</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(selectedPayroll.otPay)}</td>
                        </tr>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 font-black">
                          <td className="px-4 py-3 text-slate-900 dark:text-slate-100">Gross Earnings</td>
                          <td className="px-4 py-3 text-right text-primary">
                            {formatCurrency(
                              selectedPayroll.basicSalary +
                              selectedPayroll.allowances +
                              (selectedPayroll.incentive ?? 0) +
                              (selectedPayroll.performanceIncentive ?? 0) +
                              (selectedPayroll.offDayPay ?? 0) +
                              (selectedPayroll.holidayPay ?? 0) +
                              selectedPayroll.attendanceBonus +
                              selectedPayroll.otPay
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Deductions */}
                  <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="bg-rose-900 text-white px-4 py-2 text-xs font-black uppercase tracking-widest">
                      Deductions
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-slate-100 dark:border-slate-900">
                          <td className="px-4 py-2 text-muted-foreground">Statutory Deductions</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(selectedPayroll.deductions)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-900">
                          <td className="px-4 py-2 text-muted-foreground">
                            EPF Employee ({
                              (() => {
                                const totalForEpf = selectedPayroll.basicSalary + (selectedPayroll.offDayPay ?? 0) + (selectedPayroll.holidayPay ?? 0);
                                return totalForEpf > 0 ? Math.round((selectedPayroll.epfAmount / totalForEpf) * 100) : 8;
                              })()
                            }%)
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">{formatCurrency(selectedPayroll.epfAmount)}</td>
                        </tr>
                        {/* Empty rows to balance height visually */}
                        <tr className="border-b border-transparent">
                          <td className="px-4 py-2">&nbsp;</td>
                          <td className="px-4 py-2 text-right">&nbsp;</td>
                        </tr>
                        <tr className="border-b border-transparent">
                          <td className="px-4 py-2">&nbsp;</td>
                          <td className="px-4 py-2 text-right">&nbsp;</td>
                        </tr>
                        <tr className="border-b border-transparent">
                          <td className="px-4 py-2">&nbsp;</td>
                          <td className="px-4 py-2 text-right">&nbsp;</td>
                        </tr>
                        <tr className="border-b border-transparent">
                          <td className="px-4 py-2">&nbsp;</td>
                          <td className="px-4 py-2 text-right">&nbsp;</td>
                        </tr>
                        <tr className="border-b border-transparent">
                          <td className="px-4 py-2">&nbsp;</td>
                          <td className="px-4 py-2 text-right">&nbsp;</td>
                        </tr>
                        <tr className="bg-rose-50 dark:bg-rose-950/20 font-black">
                          <td className="px-4 py-3 text-slate-900 dark:text-slate-100">Total Deductions</td>
                          <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">
                            {formatCurrency(
                              selectedPayroll.deductions +
                              selectedPayroll.epfAmount
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                </div>

                {/* Net Pay Card */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Employer Contributions (Not Deducted)</span>
                    <div className="flex gap-4 text-xs font-bold mt-1 text-emerald-900 dark:text-emerald-300">
                      <span>EPF (12%): {formatCurrency((selectedPayroll.basicSalary + (selectedPayroll.offDayPay ?? 0) + (selectedPayroll.holidayPay ?? 0)) * 0.12)}</span>
                      <span>ETF (3%): {formatCurrency((selectedPayroll.basicSalary + (selectedPayroll.offDayPay ?? 0) + (selectedPayroll.holidayPay ?? 0)) * 0.03)}</span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 w-full sm:w-auto">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Net Salary Payable</span>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(selectedPayroll.netSalary)}</p>
                  </div>
                </div>

                <div className="text-center text-[10px] text-muted-foreground pt-4 border-t border-slate-200 dark:border-slate-800">
                  This is a system generated payslip of AttendX systems and does not require a physical signature.
                </div>

              </div>

              <DialogFooter className="print:hidden">
                <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)} className="rounded-xl">Close</Button>
                <Button onClick={() => generatePDF(selectedPayroll)} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl flex items-center gap-2 px-6">
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
