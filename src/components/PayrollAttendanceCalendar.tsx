import React, { useEffect, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/util/payroll';
import { Loader2, CheckCircle2 } from 'lucide-react';
interface PayrollCalendarDay {
  date: string;
  hasAttendance: boolean;
  isPublicHoliday: boolean;
  isPoyaDay: boolean;
  isMercantileHoliday: boolean;
  isScheduledWorkDay: boolean | null;
  isOffDayWorked: boolean;
  isHolidayWorked: boolean;
}

interface CalendarPayload {
  days: PayrollCalendarDay[];
  offDaysWorked: number;
  holidaysWorked: number;
}

interface PaymentsSummary {
  dailyRate: number;
  offDayPayment: number;
  holidayPayment: number;
  offDaysWorked: number;
  holidaysWorked: number;
}

interface PayrollAttendanceCalendarProps {
  userId: string;
  employeeName: string;
  authHeader: string;
  initialMonth?: number;
  initialYear?: number;
  onApply?: (month: number, year: number) => void;
}

function parseYmd(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function PayrollAttendanceCalendar({
  userId,
  employeeName,
  authHeader,
  initialMonth,
  initialYear,
  onApply,
}: PayrollAttendanceCalendarProps) {
  const now = new Date();
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1);
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [calendar, setCalendar] = useState<CalendarPayload | null>(null);
  const [payments, setPayments] = useState<PaymentsSummary | null>(null);
  const [displayMonth, setDisplayMonth] = useState(new Date(year, month - 1, 1));

  useEffect(() => {
    setDisplayMonth(new Date(year, month - 1, 1));
  }, [month, year]);

  useEffect(() => {
    if (!userId || !authHeader) return;

    const fetchCalendar = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/payroll/calendar?userId=${userId}&month=${month}&year=${year}`,
          { headers: { Authorization: authHeader } }
        );
        if (!res.ok) throw new Error('Failed to load calendar');
        const data = await res.json();
        setCalendar(data.calendar);
        setPayments(data.payments);
      } catch {
        setCalendar(null);
        setPayments(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendar();
  }, [userId, month, year, authHeader]);

  const attendedDates =
    calendar?.days.filter((d) => d.hasAttendance).map((d) => parseYmd(d.date)) ?? [];
  const poyaOnlyDates =
    calendar?.days
      .filter((d) => d.isPoyaDay && !d.isMercantileHoliday && !d.hasAttendance)
      .map((d) => parseYmd(d.date)) ?? [];
  const mercantileOnlyDates =
    calendar?.days
      .filter((d) => d.isMercantileHoliday && !d.hasAttendance)
      .map((d) => parseYmd(d.date)) ?? [];
  const regularAttendanceDates =
    calendar?.days
      .filter(
        (d) =>
          d.hasAttendance && !d.isHolidayWorked && !d.isOffDayWorked
      )
      .map((d) => parseYmd(d.date)) ?? [];
  const poyaWorkedDates =
    calendar?.days
      .filter((d) => d.isPoyaDay && !d.isMercantileHoliday && d.isHolidayWorked)
      .map((d) => parseYmd(d.date)) ?? [];
  const mercantileWorkedDates =
    calendar?.days
      .filter((d) => d.isMercantileHoliday && d.isHolidayWorked)
      .map((d) => parseYmd(d.date)) ?? [];
  const offDayWorkedDates =
    calendar?.days.filter((d) => d.isOffDayWorked).map((d) => parseYmd(d.date)) ?? [];

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{employeeName}</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-lg h-8" onClick={() => shiftMonth(-1)}>
            Prev
          </Button>
          <span className="text-xs font-black uppercase tracking-widest min-w-[120px] text-center">
            {months[month - 1]} {year}
          </span>
          <Button type="button" variant="outline" size="sm" className="rounded-lg h-8" onClick={() => shiftMonth(1)}>
            Next
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading calendar…
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              Attendance (worked)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-400" />
              Poya holiday (no work)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-red-100 ring-1 ring-red-400" />
              Mercantile holiday (no work)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-amber-500" />
              Poya worked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-red-500" />
              Mercantile worked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-blue-500" />
              Off day worked
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-white dark:bg-slate-900 flex justify-center">
            <Calendar
              mode="single"
              month={displayMonth}
              onMonthChange={(d) => {
                if (d) {
                  setDisplayMonth(d);
                  setMonth(d.getMonth() + 1);
                  setYear(d.getFullYear());
                }
              }}
              modifiers={{
                attended: regularAttendanceDates,
                poyaOnly: poyaOnlyDates,
                mercantileOnly: mercantileOnlyDates,
                poyaWorked: poyaWorkedDates,
                mercantileWorked: mercantileWorkedDates,
                offDayWorked: offDayWorkedDates,
              }}
              modifiersClassNames={{
                attended:
                  '!bg-emerald-500 !text-white hover:!bg-emerald-600 focus:!bg-emerald-600 font-semibold',
                poyaOnly:
                  '!bg-amber-100 !text-amber-900 dark:!bg-amber-950/50 dark:!text-amber-200 font-medium ring-1 ring-amber-400',
                mercantileOnly:
                  '!bg-red-100 !text-red-900 dark:!bg-red-950/50 dark:!text-red-200 font-medium ring-1 ring-red-400',
                poyaWorked:
                  '!bg-emerald-500 !text-white ring-2 ring-amber-500 ring-offset-1 font-semibold hover:!bg-emerald-600',
                mercantileWorked:
                  '!bg-emerald-500 !text-white ring-2 ring-red-500 ring-offset-1 font-semibold hover:!bg-emerald-600',
                offDayWorked:
                  '!bg-emerald-500 !text-white ring-2 ring-blue-500 ring-offset-1 font-semibold hover:!bg-emerald-600',
              }}
              className="mx-auto"
            />
          </div>

          {payments && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Off day payment</p>
                  <p className="font-black text-blue-700 dark:text-blue-300">
                    {formatCurrency(payments.offDayPayment)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {payments.offDaysWorked} off day(s) worked
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Holiday payment</p>
                  <p className="font-black text-amber-700 dark:text-amber-300">
                    {formatCurrency(payments.holidayPayment)}
                  </p>
                  <p className="text-xs text-muted-foreground">{payments.holidaysWorked} holiday(s) worked</p>
                </div>
              </div>

              {onApply && (
                <Button
                  type="button"
                  onClick={() => onApply(month, year)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 font-bold text-xs shadow-md flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" /> Apply {months[month - 1]} {year} Payments to Table
                </Button>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Green = check-in recorded. Amber = Poya day. Red = Mercantile holiday. Payments use salary per day (basic ÷ 30).
          </p>
        </>
      )}
    </div>
  );
}
