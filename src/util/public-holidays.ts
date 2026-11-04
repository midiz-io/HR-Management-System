/**
 * Sri Lanka public holidays (yyyy-MM-dd) details.
 * Categorized into Poya days and Mercantile holidays.
 * Used for automatic holiday payment calculation and calendar display.
 */
export interface HolidayDetail {
  date: string;
  name: string;
  isPoya: boolean;
  isMercantile: boolean;
}

const SRI_LANKA_HOLIDAY_DETAILS: Record<number, HolidayDetail[]> = {
  2025: [
    { date: '2025-01-13', name: 'Duruthu Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-01-14', name: 'Tamil Thai Pongal Day', isPoya: false, isMercantile: true },
    { date: '2025-02-04', name: 'National Independence Day', isPoya: false, isMercantile: true },
    { date: '2025-02-12', name: 'Navam Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-02-26', name: 'Mahasivarathri Day', isPoya: false, isMercantile: false },
    { date: '2025-03-13', name: 'Medin Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-03-31', name: 'Id-Ul-Fitr (Ramazan)', isPoya: false, isMercantile: false },
    { date: '2025-04-12', name: 'Bak Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-04-13', name: 'Day prior to Sinhala & Tamil New Year Day', isPoya: false, isMercantile: true },
    { date: '2025-04-14', name: 'Sinhala & Tamil New Year Day', isPoya: false, isMercantile: true },
    { date: '2025-04-18', name: 'Good Friday', isPoya: false, isMercantile: false },
    { date: '2025-05-01', name: 'May Day', isPoya: false, isMercantile: true },
    { date: '2025-05-12', name: 'Vesak Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-05-13', name: 'Day following Vesak Full Moon Poya Day', isPoya: false, isMercantile: true },
    { date: '2025-06-07', name: 'Id-Ul-Alha (Hadji)', isPoya: false, isMercantile: false },
    { date: '2025-06-10', name: 'Poson Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-07-10', name: 'Esala Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-08-08', name: 'Nikini Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-09-05', name: 'Milad-Un-Nabi (Holy Prophet\'s Birthday)', isPoya: false, isMercantile: true },
    { date: '2025-09-07', name: 'Binara Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-10-06', name: 'Vap Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-10-20', name: 'Deepavali Festival Day', isPoya: false, isMercantile: false },
    { date: '2025-11-05', name: 'Il Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-12-04', name: 'Unduvap Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2025-12-25', name: 'Christmas Day', isPoya: false, isMercantile: true },
  ],
  2026: [
    { date: '2026-01-03', name: 'Duruthu Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-01-15', name: 'Tamil Thai Pongal Day', isPoya: false, isMercantile: true },
    { date: '2026-02-01', name: 'Nawam Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-02-04', name: 'National Day (Independence Day)', isPoya: false, isMercantile: true },
    { date: '2026-02-15', name: 'Maha Sivarathri Day', isPoya: false, isMercantile: false },
    { date: '2026-03-02', name: 'Medin Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-03-21', name: 'Id-Ul-Fitr (Ramazan)', isPoya: false, isMercantile: false },
    { date: '2026-04-01', name: 'Bak Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-04-03', name: 'Good Friday', isPoya: false, isMercantile: false },
    { date: '2026-04-13', name: 'Day Prior to Sinhala and Tamil New Year Day', isPoya: false, isMercantile: true },
    { date: '2026-04-14', name: 'Sinhala and Tamil New Year Day', isPoya: false, isMercantile: true },
    { date: '2026-05-01', name: 'Vesak Full Moon Poya Day & May Day', isPoya: true, isMercantile: true },
    { date: '2026-05-02', name: 'Day Following Vesak Full Moon Poya Day', isPoya: false, isMercantile: true },
    { date: '2026-05-28', name: 'Id-Ul-Alha (Hadji)', isPoya: false, isMercantile: false },
    { date: '2026-05-30', name: 'Adhi Poson Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-06-29', name: 'Poson Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-07-29', name: 'Esala Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-08-26', name: 'Milad-Un-Nabi (Holy Prophet\'s Birthday)', isPoya: false, isMercantile: true },
    { date: '2026-08-27', name: 'Nikini Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-09-26', name: 'Binara Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-10-25', name: 'Vap Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-11-08', name: 'Deepavali Festival Day', isPoya: false, isMercantile: false },
    { date: '2026-11-24', name: 'Il Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-12-23', name: 'Unduvap Full Moon Poya Day', isPoya: true, isMercantile: false },
    { date: '2026-12-25', name: 'Christmas Day', isPoya: false, isMercantile: true },
  ],
};

const SRI_LANKA_PUBLIC_HOLIDAYS: Record<number, string[]> = {
  2025: SRI_LANKA_HOLIDAY_DETAILS[2025].map(h => h.date),
  2026: SRI_LANKA_HOLIDAY_DETAILS[2026].map(h => h.date),
};

export function getPublicHolidaysForYear(year: number): string[] {
  return SRI_LANKA_PUBLIC_HOLIDAYS[year] ?? [];
}

export function isPublicHoliday(dateStr: string, year: number): boolean {
  return getPublicHolidaysForYear(year).includes(dateStr);
}

export function isPoyaDay(dateStr: string, year: number): boolean {
  const details = SRI_LANKA_HOLIDAY_DETAILS[year] ?? [];
  const holiday = details.find(h => h.date === dateStr);
  return holiday ? holiday.isPoya : false;
}

export function isMercantileHoliday(dateStr: string, year: number): boolean {
  const details = SRI_LANKA_HOLIDAY_DETAILS[year] ?? [];
  const holiday = details.find(h => h.date === dateStr);
  return holiday ? holiday.isMercantile : false;
}

export function isPaidHoliday(dateStr: string, year: number): boolean {
  const details = SRI_LANKA_HOLIDAY_DETAILS[year] ?? [];
  const holiday = details.find(h => h.date === dateStr);
  return holiday ? (holiday.isPoya || holiday.isMercantile) : false;
}
