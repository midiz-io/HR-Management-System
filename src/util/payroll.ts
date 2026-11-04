export interface SalaryCalculation {
  basicSalary: number;
  allowances: number;
  offDayPay: number;
  holidayPay: number;
  otPay: number;
  deductions: number;
  attendanceBonus: number;
  lateDeductions: number;
  incentive: number;
  performanceIncentive: number;
  totalIncentive: number;
  epfEmployee: number;
  epfEmployer: number;
  etfEmployer: number;
  grossSalary: number;
  netSalary: number;
  otHours?: number;
}

export const calculatePayroll = (
  basicSalary: number,
  allowances: number,
  deductions: number,
  otHours: number = 0,
  lateDeductions: number = 0,
  attendanceBonus: number = 0,
  epfEmployeeRate: number = 8,
  epfEmployerRate: number = 12,
  etfEmployerRate: number = 3,
  offDayPay: number = 0,
  holidayPay: number = 0,
  incentive: number = 0,
  configuredIncentive: number = 0,
  otHourlyRate: number = 0
): SalaryCalculation => {
  const standardHourlyRate = (basicSalary + configuredIncentive) / 240;
  const appliedOtRate = otHourlyRate > 0 ? otHourlyRate : (standardHourlyRate * 1.5);
  const otPay = otHours * appliedOtRate;
  const attendanceIncentive = incentive;
  const performanceIncentive = Math.max(0, configuredIncentive - attendanceIncentive);
  const totalIncentive = attendanceIncentive + performanceIncentive + otPay;
  
  const totalForEpf = basicSalary + offDayPay + holidayPay;
  const grossSalary = totalForEpf + totalIncentive + allowances + attendanceBonus;

  const epfEmployee = totalForEpf * (epfEmployeeRate / 100);
  const epfEmployer = totalForEpf * (epfEmployerRate / 100);
  const etfEmployer = totalForEpf * (etfEmployerRate / 100);

  const totalDeductions = deductions + epfEmployee;
  const netSalary = grossSalary - totalDeductions;

  return {
    basicSalary,
    allowances,
    offDayPay,
    holidayPay,
    otPay,
    otHours,
    deductions,
    attendanceBonus,
    lateDeductions: 0,
    incentive,
    performanceIncentive,
    totalIncentive,
    epfEmployee,
    epfEmployer,
    etfEmployer,
    grossSalary,
    netSalary,
  };
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount);
};
