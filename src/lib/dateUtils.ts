import { format, isToday, isTomorrow, isYesterday } from "date-fns";

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

export function getDateRelativeLabel(dateInput: Date | string): string | null {
  const date = new Date(dateInput);
  if (isToday(date)) return "დღეს";
  if (isTomorrow(date)) return "ხვალ";
  if (isYesterday(date)) return "გუშინ";
  return null;
}
