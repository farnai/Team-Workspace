import { format } from "date-fns";

const GEORGIAN_MONTHS = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];

const GEORGIAN_MONTHS_SHORT = [
  "იან",
  "თებ",
  "მარ",
  "აპრ",
  "მაი",
  "ივნ",
  "ივლ",
  "აგვ",
  "სექ",
  "ოქტ",
  "ნოე",
  "დეკ",
];

const GEORGIAN_DAYS_OF_WEEK = [
  "კვირა",
  "ორშაბათი",
  "სამშაბათი",
  "ოთხშაბათი",
  "ხუთშაბათი",
  "პარასკევი",
  "შაბათი",
];

export function formatGeorgianDate(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  const day = format(date, "dd");
  const month = GEORGIAN_MONTHS[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month}, ${year}`;
}

export function formatGeorgianDateTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  const day = format(date, "dd");
  const month = GEORGIAN_MONTHS[date.getMonth()];
  const time = format(date, "HH:mm");

  return `${day} ${month}, ${time}`;
}

export function formatGeorgianDateShort(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  const day = format(date, "dd");
  const month = GEORGIAN_MONTHS_SHORT[date.getMonth()];

  return `${day} ${month}`;
}

export function getGeorgianDayOfWeek(dateInput: Date | string): string {
  const date = new Date(dateInput);
  return GEORGIAN_DAYS_OF_WEEK[date.getDay()];
}

export function getTbilisiTodayString(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tbilisi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

export function getTbilisiTodayDate(): Date {
  const str = getTbilisiTodayString();
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isTbilisiToday(dateInput: Date | string): boolean {
  if (!dateInput) return false;
  const targetStr =
    typeof dateInput === "string" && dateInput.length >= 10
      ? dateInput.slice(0, 10)
      : format(new Date(dateInput), "yyyy-MM-dd");
  return targetStr === getTbilisiTodayString();
}

export function getDateRelativeLabel(dateInput: Date | string): string | null {
  if (!dateInput) return null;
  const targetStr =
    typeof dateInput === "string" && dateInput.length >= 10
      ? dateInput.slice(0, 10)
      : format(new Date(dateInput), "yyyy-MM-dd");

  const todayStr = getTbilisiTodayString();
  if (targetStr === todayStr) return "დღეს";

  const [y, m, d] = todayStr.split("-").map(Number);
  const tomorrow = new Date(y, m - 1, d + 1);
  const yesterday = new Date(y, m - 1, d - 1);

  const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
  const yesterdayStr = format(yesterday, "yyyy-MM-dd");

  if (targetStr === tomorrowStr) return "ხვალ";
  if (targetStr === yesterdayStr) return "გუშინ";
  return null;
}
