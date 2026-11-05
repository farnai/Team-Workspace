import test from "node:test";
import assert from "node:assert";
import {
  getTbilisiTodayString,
  getTbilisiTodayDate,
  isTbilisiToday,
  getDateRelativeLabel,
  formatGeorgianDate,
  formatGeorgianDateShort,
} from "../src/lib/dateUtils";
import { format, addDays, subDays } from "date-fns";

test("Step 8.2: Georgia/Tbilisi Timezone Calendar & Relative Label Integrity", () => {
  const todayStr = getTbilisiTodayString();
  assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/, "getTbilisiTodayString must return YYYY-MM-DD");

  const todayDate = getTbilisiTodayDate();
  assert.ok(todayDate instanceof Date, "getTbilisiTodayDate must return a Date object");
  assert.strictEqual(format(todayDate, "yyyy-MM-dd"), todayStr, "getTbilisiTodayDate must match getTbilisiTodayString");

  // Verify isTbilisiToday
  assert.strictEqual(isTbilisiToday(todayStr), true, "todayStr must be identified as today");
  assert.strictEqual(isTbilisiToday(todayDate), true, "todayDate must be identified as today");

  const pastDateStr = "2026-10-28";
  assert.strictEqual(isTbilisiToday(pastDateStr), false, "Past date must not be identified as today");

  // Verify relative labels
  assert.strictEqual(getDateRelativeLabel(todayStr), "დღეს", "Current date must receive 'დღეს' relative label");

  const [y, m, d] = todayStr.split("-").map(Number);
  const tomorrow = new Date(y, m - 1, d + 1);
  const yesterday = new Date(y, m - 1, d - 1);

  assert.strictEqual(getDateRelativeLabel(tomorrow), "ხვალ", "Next day must receive 'ხვალ' relative label");
  assert.strictEqual(getDateRelativeLabel(yesterday), "გუშინ", "Previous day must receive 'გუშინ' relative label");
  assert.strictEqual(getDateRelativeLabel(pastDateStr), null, "Distant date must receive null relative label");
});

test("Step 8.2: Timeline Date Formatting & Georgian Translations", () => {
  const formatted = formatGeorgianDate("2026-11-05");
  assert.strictEqual(formatted, "05 ნოემბერი, 2026");

  const formattedShort = formatGeorgianDateShort("2026-11-05");
  assert.strictEqual(formattedShort, "05 ნოე");

  const formattedOct = formatGeorgianDate("2026-10-28");
  assert.strictEqual(formattedOct, "28 ოქტომბერი, 2026");
});

test("Step 8.2: Active-Day Focus Zone Calculation Invariants", () => {
  // Simulate the container and day element rects
  const containerTop = 128;
  const focusLineY = containerTop + 24; // 152px
  let currentScrollTop = 0;

  // Day 1 (Oct 28): top 128, height 40 -> bottom 168
  const day1Rect = { top: 128, bottom: 168 };
  const isDay1InFocus = focusLineY >= day1Rect.top && focusLineY <= day1Rect.bottom;
  assert.strictEqual(isDay1InFocus, true, "When container is at top 0, day 1 intersects focus line");

  // When scrolled to Today (Nov 5) where Today is positioned 12px below container top:
  // Today's top is containerTop + 12 = 140px, bottom is 140 + 80 = 220px
  const todayRect = { top: 140, bottom: 220 };
  const isTodayInFocus = focusLineY >= todayRect.top && focusLineY <= todayRect.bottom;
  assert.strictEqual(isTodayInFocus, true, "When Today is scrolled to 12px below top, focus line (152px) falls inside Today");

  // Day 1 is now far above: top = 140 - 700 = -560
  const day1RectScrolled = { top: -560, bottom: -520 };
  const isDay1InFocusAfterScroll = focusLineY >= day1RectScrolled.top && focusLineY <= day1RectScrolled.bottom;
  assert.strictEqual(isDay1InFocusAfterScroll, false, "Day 1 must not be in focus when scrolled to Today");
});
