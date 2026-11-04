import prisma from '@/lib/prisma';
import { toZonedTime, format } from 'date-fns-tz';

const SRI_LANKA_TZ = 'Asia/Colombo';

export async function runMonthlyPayroll(now: Date) {
  const slNow = toZonedTime(now, SRI_LANKA_TZ);
  const month = parseInt(format(slNow, 'MM'), 10);
  const year = parseInt(format(slNow, 'yyyy'), 10);

  const configs = await prisma.salaryConfig.findMany({
    include: { user: true }
  });

  let generatedCount = 0;

  for (const config of configs) {
    const basic = config.basicSalary;
    const allowances = config.allowances;
    
    // In a real scenario, we would calculate exact OT, late deductions, etc. 
    // from Attendance and OTRequest tables for this month.
    // For now, we seed it with the config defaults.
    const deductions = config.deductions;
    const salaryAdvance = config.salaryAdvance;
    const loanDeduction = config.loanDeduction;
    const pendingBills = config.pendingBills;
    const incentive = config.incentive;
    const otPay = 0; 
    const lateDeductions = 0;

    const grossSalary = basic + allowances + incentive + otPay;
    const totalDeductions = deductions + salaryAdvance + loanDeduction + pendingBills + lateDeductions;
    
    const epfEmployeeAmount = (basic * config.epfEmployee) / 100;
    const epfEmployerAmount = (basic * config.epfEmployer) / 100;
    const etfEmployerAmount = (basic * config.etfEmployer) / 100;

    const netSalary = grossSalary - totalDeductions - epfEmployeeAmount;

    await prisma.payroll.upsert({
      where: {
        userId_month_year: {
          userId: config.userId,
          month,
          year
        }
      },
      update: {
        // If it's already generated and pending, we might update it or skip it.
        // Let's update it in case config changed, but only if PENDING
      },
      create: {
        userId: config.userId,
        month,
        year,
        basicSalary: basic,
        allowances,
        deductions,
        salaryAdvance,
        loanDeduction,
        pendingBills,
        incentive,
        otPay,
        lateDeductions,
        epfAmount: epfEmployeeAmount,
        etfAmount: etfEmployerAmount, // Or total employer contributions depending on schema intent
        netSalary,
        status: 'PENDING'
      }
    });

    generatedCount++;
  }

  return { status: 'success', generatedCount, month, year };
}
