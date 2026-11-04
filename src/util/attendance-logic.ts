import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';


const SRI_LANKA_TZ = 'Asia/Colombo';

/**
 * Helper to parse time string (HH:mm) and convert to minutes since midnight
 */
export const parseTimeToMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Helper to format minutes to HH:mm
 */
export const formatMinutesToTime = (minutes: number): string => {
  const hrs = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Helper to get day name from date
 */
export const getDayName = (date: Date): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
};

interface LatenessResult {
  isLate: boolean;
  lateMinutes: number;
  rosterStartTime: string | null;
  status: 'LATE' | 'PRESENT' | 'OFF DUTY' | 'NO ROSTER';
}

/**
 * Calculates lateness for a check-in record based on user's rosters or work shifts.
 */
export function calculateLateness(
  checkInTime: Date,
  userWithRosters: any
): LatenessResult {
  const checkInDate = toZonedTime(checkInTime, SRI_LANKA_TZ);
  const hours = parseInt(format(checkInDate, 'HH'), 10);
  const minutes = parseInt(format(checkInDate, 'mm'), 10);
  const checkInTimeMinutes = hours * 60 + minutes;
  const dayName = getDayName(checkInDate);

  // Safety check for missing user or rosters
  if (!userWithRosters || !userWithRosters.rosters) {
    return {
      isLate: false,
      lateMinutes: 0,
      rosterStartTime: null,
      status: 'NO ROSTER'
    };
  }

  // Find applicable roster for this specific check-in date (using Sri Lankan date)
  const checkInDateOnlyStr = format(checkInDate, 'yyyy-MM-dd');

  const applicableRoster = userWithRosters.rosters
    ?.filter((roster: any) => {
      const rosterStartStr = format(toZonedTime(new Date(roster.startDate), SRI_LANKA_TZ), 'yyyy-MM-dd');
      const rosterEndStr = roster.endDate
        ? format(toZonedTime(new Date(roster.endDate), SRI_LANKA_TZ), 'yyyy-MM-dd')
        : '2099-12-31';
      return checkInDateOnlyStr >= rosterStartStr && checkInDateOnlyStr <= rosterEndStr;
    })
    .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];

  if (applicableRoster?.workShift) {
    const workShiftDays = applicableRoster.workShift.days || [];
    const isWorkDay = applicableRoster.isDaily || 
                      (applicableRoster.customDays && applicableRoster.customDays.length > 0 
                        ? applicableRoster.customDays.includes(dayName) 
                        : workShiftDays.includes(dayName));

    if (isWorkDay) {
      const rosterStartTime = applicableRoster.workShift.startTime;
      const expectedStartMinutes = parseTimeToMinutes(rosterStartTime);
      const lateMinutes = checkInTimeMinutes - expectedStartMinutes;

      return {
        isLate: lateMinutes > 0,
        lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
        rosterStartTime: rosterStartTime,
        status: lateMinutes > 0 ? 'LATE' : 'PRESENT'
      };
    }
  }

  // Fallback if no roster or workshift for this day
  return {
    isLate: false,
    lateMinutes: 0,
    rosterStartTime: 'None',
    status: applicableRoster ? 'OFF DUTY' : 'NO ROSTER'
  };
}

export interface ShiftInfoResult {
  hasShift: boolean;
  shiftName: string | null;
  rosterStartTime: string | null;
  rosterEndTime: string | null;
  shiftStartDateTime: Date | null;
  shiftEndDateTime: Date | null;
  isShiftEnded: boolean;
  remainingSeconds: number;
}

/**
 * Returns active shift information and exact shift end time for a user on a given date.
 */
export function getUserActiveShiftInfo(
  targetDate: Date,
  userWithRosters: any
): ShiftInfoResult {
  const dateInSl = toZonedTime(targetDate, SRI_LANKA_TZ);
  const dayName = getDayName(dateInSl);

  if (!userWithRosters || !userWithRosters.rosters || userWithRosters.rosters.length === 0) {
    return {
      hasShift: false,
      shiftName: null,
      rosterStartTime: null,
      rosterEndTime: null,
      shiftStartDateTime: null,
      shiftEndDateTime: null,
      isShiftEnded: false,
      remainingSeconds: 0
    };
  }

  const dateOnlyStr = format(dateInSl, 'yyyy-MM-dd');

  const applicableRoster = userWithRosters.rosters
    ?.filter((roster: any) => {
      const rosterStartStr = format(toZonedTime(new Date(roster.startDate), SRI_LANKA_TZ), 'yyyy-MM-dd');
      const rosterEndStr = roster.endDate
        ? format(toZonedTime(new Date(roster.endDate), SRI_LANKA_TZ), 'yyyy-MM-dd')
        : '2099-12-31';
      return dateOnlyStr >= rosterStartStr && dateOnlyStr <= rosterEndStr;
    })
    .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];

  if (applicableRoster?.workShift) {
    const workShiftDays = applicableRoster.workShift.days || [];
    const isWorkDay = applicableRoster.isDaily || 
                      (applicableRoster.customDays && applicableRoster.customDays.length > 0 
                        ? applicableRoster.customDays.includes(dayName) 
                        : workShiftDays.includes(dayName));

    if (isWorkDay) {
      const startTimeStr = applicableRoster.workShift.startTime; // HH:mm
      const endTimeStr = applicableRoster.workShift.endTime;     // HH:mm

      const startMinutes = parseTimeToMinutes(startTimeStr);
      const endMinutes = parseTimeToMinutes(endTimeStr);

      const [startH, startM] = startTimeStr.split(':').map(Number);
      const [endH, endM] = endTimeStr.split(':').map(Number);

      // Create start and end Date objects in Sri Lanka timezone (zoned / skewed)
      const shiftStartDateTime = new Date(dateInSl);
      shiftStartDateTime.setHours(startH, startM, 0, 0);

      const shiftEndDateTime = new Date(dateInSl);
      shiftEndDateTime.setHours(endH, endM, 0, 0);

      // If end time is earlier than start time, it spans past midnight into next day
      if (endMinutes <= startMinutes) {
        shiftEndDateTime.setDate(shiftEndDateTime.getDate() + 1);
      }

      // Convert zoned dates back to true UTC Dates for robust comparison & DB storage
      const utcShiftStart = fromZonedTime(shiftStartDateTime, SRI_LANKA_TZ);
      const utcShiftEnd = fromZonedTime(shiftEndDateTime, SRI_LANKA_TZ);

      const diffMs = utcShiftEnd.getTime() - targetDate.getTime();
      const remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
      const isShiftEnded = targetDate.getTime() >= utcShiftEnd.getTime();

      return {
        hasShift: true,
        shiftName: applicableRoster.workShift.name,
        rosterStartTime: startTimeStr,
        rosterEndTime: endTimeStr,
        shiftStartDateTime: utcShiftStart,
        shiftEndDateTime: utcShiftEnd,
        isShiftEnded,
        remainingSeconds
      };
    }
  }

  return {
    hasShift: false,
    shiftName: null,
    rosterStartTime: null,
    rosterEndTime: null,
    shiftStartDateTime: null,
    shiftEndDateTime: null,
    isShiftEnded: false,
    remainingSeconds: 0
  };
}

