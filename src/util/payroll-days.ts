import { eachDayOfInterval, format, getDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  getPublicHolidaysForYear,
  isPublicHoliday,
  isPoyaDay,
  isMercantileHoliday,
  isPaidHoliday,
} from '@/util/public-holidays';

const SRI_LANKA_TZ = 'Asia/Colombo';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WORKING_DAYS_PER_MONTH = 30;
const HOLIDAY_PAY_MULTIPLIER = 1; // single pay for working on a public holiday

export interface RosterWithShift {
  startDate: Date | string;
  endDate?: Date | string | null;
  isDaily: boolean;
  customDays: string[];
  workShift: {
    days: string[];
  };
}

export interface OffHolidayPayResult {
  offDaysWorked: number;
  holidaysWorked: number;
  offDayPayment: number;
  holidayPayment: number;
  dailyRate: number;
  actuallyWorkedDays: number;
  expectedWorkingDays: number;
  calculatedIncentive: number;
}

export function getDailyRate(basicSalary: number): number {
  return basicSalary / WORKING_DAYS_PER_MONTH;
}

export function getApplicableRoster(
  rosters: RosterWithShift[],
  dateStr: string
): RosterWithShift | null {
  const applicable = rosters
    .filter((roster) => {
      const rosterStartStr = format(toZonedTime(new Date(roster.startDate), SRI_LANKA_TZ), 'yyyy-MM-dd');
      const rosterEndStr = roster.endDate
        ? format(toZonedTime(new Date(roster.endDate), SRI_LANKA_TZ), 'yyyy-MM-dd')
        : '2099-12-31';
      return dateStr >= rosterStartStr && dateStr <= rosterEndStr;
    })
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return applicable[0] ?? null;
}

export function isScheduledWorkDay(roster: RosterWithShift, date: Date): boolean {
  const zoned = toZonedTime(date, SRI_LANKA_TZ);
  const dayName = DAY_NAMES[getDay(zoned)];
  const workShiftDays = roster.workShift?.days ?? [];

  if (roster.isDaily) return true;
  if (roster.customDays?.length > 0) {
    return roster.customDays.includes(dayName);
  }
  return workShiftDays.includes(dayName);
}

/**
 * Counts days the employee checked in on roster off-days or public holidays.
 * Off-day payment: (salary per day × off days worked) × 2.
 * Holiday work is paid at 2× daily rate.
 */
/** Off day payment: (basic + incentive) / 30 * off days count */
export function calculateOffDayPaymentFromCount(
  basicSalary: number,
  offDaysCount: number,
  incentive: number = 0
): number {
  return ((basicSalary + incentive) / WORKING_DAYS_PER_MONTH) * Math.max(0, offDaysCount);
}

export function calculateOffAndHolidayPay(
  basicSalary: number,
  rosters: RosterWithShift[],
  attendanceDates: Date[],
  year: number,
  manualOffDaysCount: number = 0,
  incentive: number = 0
): OffHolidayPayResult {
  const dailyRate = getDailyRate(basicSalary);
  let offDaysWorked = 0;
  let holidaysWorked = 0;

  const uniqueDates = new Set<string>();
  for (const checkIn of attendanceDates) {
    const dateStr = format(toZonedTime(checkIn, SRI_LANKA_TZ), 'yyyy-MM-dd');
    if (uniqueDates.has(dateStr)) continue;
    uniqueDates.add(dateStr);

    const onHoliday = isPaidHoliday(dateStr, year);
    if (onHoliday) {
      holidaysWorked += 1;
    }
  }

  // Calculate off-days worked based on the 25-day working limit (5 off-days target).
  // If a manual off-days count is configured and greater than 0, we use that, otherwise default to 5.
  const targetOffDays = manualOffDaysCount > 0 ? manualOffDaysCount : 5;
  const targetWorkingDays = 30 - targetOffDays;
  const expectedWorkingDays = Math.max(1, targetWorkingDays);
  const actuallyWorkedDays = uniqueDates.size;

  // The number of off-days worked is any attendance day (green days) exceeding target working days.
  offDaysWorked = Math.max(0, actuallyWorkedDays - targetWorkingDays);

  const offDayPayment = calculateOffDayPaymentFromCount(basicSalary, offDaysWorked, incentive);
  const holidayPayment = 0; // Holiday payment calculation logic stopped per request

  // Math formula: (Incentive / Expected Working Days) * Actually Worked Days
  const calculatedIncentive = (incentive / expectedWorkingDays) * actuallyWorkedDays;

  return {
    offDaysWorked,
    holidaysWorked,
    offDayPayment,
    holidayPayment,
    dailyRate,
    actuallyWorkedDays,
    expectedWorkingDays,
    calculatedIncentive,
  };
}

export function getMonthBounds(month: number, year: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

export interface PayrollCalendarDay {
  date: string;
  hasAttendance: boolean;
  isPublicHoliday: boolean;
  isPoyaDay: boolean;
  isMercantileHoliday: boolean;
  isScheduledWorkDay: boolean | null;
  isOffDayWorked: boolean;
  isHolidayWorked: boolean;
}

export interface PayrollMonthCalendar {
  days: PayrollCalendarDay[];
  attendedDates: Date[];
  publicHolidayDates: Date[];
  offDayWorkedDates: Date[];
  holidayWorkedDates: Date[];
  offDaysWorked: number;
  holidaysWorked: number;
}

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Day-by-day view for payroll calendar (attendance, holidays, off-day work). */
export function buildPayrollMonthCalendar(
  month: number,
  year: number,
  rosters: RosterWithShift[],
  attendanceDates: Date[]
): PayrollMonthCalendar {
  const { start, end } = getMonthBounds(month, year);
  const monthDays = eachDayOfInterval({ start, end });

  const attendanceByDate = new Set<string>();
  for (const checkIn of attendanceDates) {
    attendanceByDate.add(format(toZonedTime(checkIn, SRI_LANKA_TZ), 'yyyy-MM-dd'));
  }

  const holidaySet = new Set(
    getPublicHolidaysForYear(year).filter((d) => {
      const [y, m] = d.split('-').map(Number);
      return y === year && m === month;
    })
  );

  const days: PayrollCalendarDay[] = [];
  const attendedDates: Date[] = [];
  const publicHolidayDates: Date[] = [];
  const offDayWorkedDates: Date[] = [];
  const holidayWorkedDates: Date[] = [];
  let offDaysWorked = 0;
  let holidaysWorked = 0;

  for (const day of monthDays) {
    const dateStr = format(toZonedTime(day, SRI_LANKA_TZ), 'yyyy-MM-dd');
    const hasAttendance = attendanceByDate.has(dateStr);
    const poya = isPoyaDay(dateStr, year);
    const mercantile = isMercantileHoliday(dateStr, year);
    const isHoliday = poya || mercantile; // Paid holidays (Poya + Mercantile)

    const roster = getApplicableRoster(rosters, dateStr);
    const scheduledWork =
      roster === null ? null : isScheduledWorkDay(roster, toZonedTime(day, SRI_LANKA_TZ));

    const isHolidayWorked = isHoliday && hasAttendance;
    const isOffDayWorked =
      hasAttendance && !isHoliday && scheduledWork === false;

    if (hasAttendance) attendedDates.push(parseDateStr(dateStr));
    if (isHoliday) publicHolidayDates.push(parseDateStr(dateStr));
    if (isOffDayWorked) {
      offDayWorkedDates.push(parseDateStr(dateStr));
      offDaysWorked += 1;
    }
    if (isHolidayWorked) {
      holidayWorkedDates.push(parseDateStr(dateStr));
      holidaysWorked += 1;
    }

    days.push({
      date: dateStr,
      hasAttendance,
      isPublicHoliday: isHoliday,
      isPoyaDay: poya,
      isMercantileHoliday: mercantile,
      isScheduledWorkDay: scheduledWork,
      isOffDayWorked,
      isHolidayWorked,
    });
  }

  return {
    days,
    attendedDates,
    publicHolidayDates,
    offDayWorkedDates,
    holidayWorkedDates,
    offDaysWorked,
    holidaysWorked,
  };
}
