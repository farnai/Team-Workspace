/**
 * Georgian Working Calendar, Holidays & Timezone Utilities
 * Standard timezone: Asia/Tbilisi (UTC+4)
 */

export interface GeorgianHolidayDef {
  dateStr: string; // YYYY-MM-DD
  name: string;
  isMovable?: boolean;
}

/**
 * Orthodox Easter calculation using Meeus algorithm (Julian calendar converted to Gregorian).
 * Valid for 1900-2099.
 */
export function getOrthodoxEasterSunday(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;

  // Julian date
  const julianDate = new Date(Date.UTC(year, month - 1, day));
  // In the 20th and 21st centuries, Gregorian calendar is 13 days ahead of Julian
  julianDate.setUTCDate(julianDate.getUTCDate() + 13);
  return julianDate;
}

/**
 * Format Date as YYYY-MM-DD in local Asia/Tbilisi timezone
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get all official Georgian public holidays for a given year.
 * Includes official fixed public holidays and movable Easter holidays.
 */
export function getGeorgianHolidaysForYear(year: number): GeorgianHolidayDef[] {
  // 1. Fixed official public holidays in Georgia
  const fixedHolidays: { month: number; day: number; name: string }[] = [
    { month: 1, day: 1, name: "ახალი წელი" },
    { month: 1, day: 2, name: "ბედობა" },
    { month: 1, day: 7, name: "შობა" },
    { month: 1, day: 19, name: "ნათლისღება" },
    { month: 3, day: 3, name: "დედის დღე" },
    { month: 3, day: 8, name: "ქალთა საერთაშორისო დღე" },
    { month: 4, day: 9, name: "ეროვნული ერთიანობის დღე" },
    { month: 5, day: 9, name: "ფაშიზმზე გამარჯვების დღე" },
    { month: 5, day: 12, name: "ანდრია პირველწოდებულის დღე" },
    { month: 5, day: 26, name: "საქართველოს დამოუკიდებლობის დღე" },
    { month: 8, day: 28, name: "მარიამობა" },
    { month: 10, day: 14, name: "სვეტიცხოვლობა" },
    { month: 11, day: 23, name: "გიორგობა" },
  ];

  const holidays: GeorgianHolidayDef[] = fixedHolidays.map((h) => ({
    dateStr: `${year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`,
    name: h.name,
    isMovable: false,
  }));

  // 2. Movable Orthodox Easter holidays
  const easterSunday = getOrthodoxEasterSunday(year);

  // Good Friday (Easter - 2 days)
  const goodFriday = new Date(easterSunday);
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  holidays.push({
    dateStr: formatDateKey(goodFriday),
    name: "სააღდგომო პარასკევი (წითელი პარასკევი)",
    isMovable: true,
  });

  // Great Saturday (Easter - 1 day)
  const greatSaturday = new Date(easterSunday);
  greatSaturday.setUTCDate(greatSaturday.getUTCDate() - 1);
  holidays.push({
    dateStr: formatDateKey(greatSaturday),
    name: "დიდი შაბათი",
    isMovable: true,
  });

  // Easter Sunday
  holidays.push({
    dateStr: formatDateKey(easterSunday),
    name: "ბრწყინვალე აღდგომა",
    isMovable: true,
  });

  // Easter Monday (Easter + 1 day)
  const easterMonday = new Date(easterSunday);
  easterMonday.setUTCDate(easterMonday.getUTCDate() + 1);
  holidays.push({
    dateStr: formatDateKey(easterMonday),
    name: "მიცვალებულთა მოხსენიების დღე",
    isMovable: true,
  });

  return holidays;
}

/**
 * Check if a date is a working day, considering workingDaysMap (0=Sun, 6=Sat) and holidays.
 */
export function isDateWorkingDay(
  date: Date,
  workingDaysMap: Map<number, boolean>,
  holidaysMap: Map<string, string>
): { isWorking: boolean; isWeekend: boolean; holidayName: string | null } {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isDayConfiguredWorking = workingDaysMap.get(dayOfWeek) ?? !isWeekend;

  const dateStr = formatDateKey(date);
  const holidayName = holidaysMap.get(dateStr) || null;

  const isWorking = isDayConfiguredWorking && !holidayName;

  return { isWorking, isWeekend, holidayName };
}

/**
 * Calculate working days and calendar days count between two dates inclusive.
 */
export function calculateWorkingDaysSpan(
  startDate: Date,
  endDate: Date,
  workingDaysMap: Map<number, boolean>,
  holidaysMap: Map<string, string>
): { totalCalendarDays: number; totalWorkingDays: number } {
  let calendarDays = 0;
  let workingDays = 0;

  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (cur <= end) {
    calendarDays++;
    const { isWorking } = isDateWorkingDay(cur, workingDaysMap, holidaysMap);
    if (isWorking) {
      workingDays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return {
    totalCalendarDays: calendarDays,
    totalWorkingDays: workingDays,
  };
}
