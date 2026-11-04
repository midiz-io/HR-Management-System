import PDFDocument from 'pdfkit';

export interface PayslipData {
  employeeName: string;
  department: string;
  month: string;
  year: number;
  basicSalary: number;
  allowances: number;
  offDayPay: number;
  holidayPay: number;
  otPay: number;
  incentive: number;
  performanceIncentive: number;
  attendanceBonus: number;
  deductions: number;
  salaryAdvance: number;
  loanDeduction: number;
  pendingBills: number;
  lateDeductions: number;
  epfEmployee: number;
  etfEmployer: number;
  netSalary: number;
  timestamp: string;
}

export async function generatePayslipPDFBuffer(data: PayslipData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      // Header
      doc.fontSize(22).font('Helvetica-Bold').text('Tropical ShellFish', { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(12).font('Helvetica').text('Monthly Payslip', { align: 'center' });
      doc.moveDown(1.5);

      // Employee Details
      doc.fontSize(14).font('Helvetica-Bold').text('Employee Details', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      
      const leftCol = 50;
      const rightCol = 300;
      let y = doc.y;

      doc.text(`Name: ${data.employeeName}`, leftCol, y);
      doc.text(`Month: ${data.month} ${data.year}`, rightCol, y);
      y += 15;
      doc.text(`Department: ${data.department}`, leftCol, y);
      doc.text(`Generated: ${data.timestamp}`, rightCol, y);
      
      doc.moveDown(2);

      // Earnings Table
      doc.fontSize(14).font('Helvetica-Bold').text('Earnings & Deductions', leftCol, doc.y, { underline: true });
      doc.moveDown(0.5);

      y = doc.y;
      
      // Draw Table Header
      doc.rect(leftCol, y, 500, 20).fill('#f3f4f6');
      doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');
      doc.text('Description', leftCol + 10, y + 6);
      doc.text('Earnings (Rs)', leftCol + 250, y + 6, { width: 100, align: 'right' });
      doc.text('Deductions (Rs)', leftCol + 380, y + 6, { width: 100, align: 'right' });
      
      y += 20;
      doc.font('Helvetica');

      const addRow = (desc: string, earning: number, deduction: number) => {
        doc.text(desc, leftCol + 10, y + 6);
        doc.text(earning > 0 ? earning.toFixed(2) : '-', leftCol + 250, y + 6, { width: 100, align: 'right' });
        doc.text(deduction > 0 ? deduction.toFixed(2) : '-', leftCol + 380, y + 6, { width: 100, align: 'right' });
        
        doc.moveTo(leftCol, y + 20).lineTo(leftCol + 500, y + 20).strokeOpacity(0.2).stroke();
        y += 20;
      };

      addRow('Basic Salary', data.basicSalary, 0);
      if (data.allowances > 0) addRow('Allowances', data.allowances, 0);
      if (data.offDayPay > 0) addRow('Off Day Pay', data.offDayPay, 0);
      if (data.holidayPay > 0) addRow('Holiday Pay', data.holidayPay, 0);
      if (data.otPay > 0) addRow('OT Pay', data.otPay, 0);
      if (data.incentive > 0) addRow('Incentive', data.incentive, 0);
      if (data.performanceIncentive > 0) addRow('Performance Inc.', data.performanceIncentive, 0);
      if (data.attendanceBonus > 0) addRow('Attendance Bonus', data.attendanceBonus, 0);

      if (data.deductions > 0) addRow('Other Deductions', 0, data.deductions);
      if (data.salaryAdvance > 0) addRow('Salary Advance', 0, data.salaryAdvance);
      if (data.loanDeduction > 0) addRow('Loan Deduction', 0, data.loanDeduction);
      if (data.pendingBills > 0) addRow('Pending Bills', 0, data.pendingBills);
      if (data.lateDeductions > 0) addRow('Late Deductions', 0, data.lateDeductions);
      if (data.epfEmployee > 0) addRow('EPF (Employee)', 0, data.epfEmployee);

      // Totals
      y += 10;
      doc.font('Helvetica-Bold');
      const totalEarnings = data.basicSalary + data.allowances + data.offDayPay + data.holidayPay + data.otPay + data.incentive + data.performanceIncentive + data.attendanceBonus;
      const totalDeductions = data.deductions + data.salaryAdvance + data.loanDeduction + data.pendingBills + data.lateDeductions + data.epfEmployee;
      
      doc.text('Total', leftCol + 10, y);
      doc.text(totalEarnings.toFixed(2), leftCol + 250, y, { width: 100, align: 'right' });
      doc.text(totalDeductions.toFixed(2), leftCol + 380, y, { width: 100, align: 'right' });
      
      y += 30;

      // Net Salary
      doc.rect(leftCol, y, 500, 30).fill('#e0f2fe');
      doc.fillColor('#0284c7').fontSize(14).font('Helvetica-Bold');
      doc.text('Net Salary:', leftCol + 10, y + 8);
      doc.text(`Rs. ${data.netSalary.toFixed(2)}`, leftCol + 300, y + 8, { width: 180, align: 'right' });

      // Note
      doc.moveDown(4);
      doc.fillColor('#6b7280').fontSize(9).font('Helvetica-Oblique');
      doc.text('This is a system generated payslip and does not require a signature.', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
