"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Clock,
  Sparkles,
} from "lucide-react";

export interface DatePickerProps {
  value?: string | null; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  minDate?: string; // "YYYY-MM-DD"
  maxDate?: string; // "YYYY-MM-DD"
  className?: string;
  size?: "sm" | "md" | "lg";
  clearable?: boolean;
  align?: "left" | "right";
  showPresets?: boolean;
  id?: string;
  name?: string;
}

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

const GEORGIAN_DAYS_HEADER = ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვი"];

function parseDateKey(key: string | null | undefined): Date | null {
  if (!key) return null;
  const parts = key.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  // Noon prevents daylight saving / timezone drift
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "აირჩიეთ თარიღი",
  disabled = false,
  required = false,
  minDate,
  maxDate,
  className = "",
  size = "md",
  clearable = true,
  align = "left",
  showPresets = true,
  id,
  name,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [viewMode, setViewMode] = useState<"days" | "months" | "years">("days");

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const selectedDate = useMemo(() => parseDateKey(value), [value]);

  // Calendar viewport (month/year currently viewed)
  const [viewYear, setViewYear] = useState<number>(() => {
    return selectedDate ? selectedDate.getFullYear() : new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    return selectedDate ? selectedDate.getMonth() : new Date().getMonth();
  });

  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });

  // Sync viewed month/year when value changes externally
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }

  // Compute Popover Position relative to viewport
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 310;
    const popoverHeight = 370;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + 6;
    if (spaceBelow < popoverHeight && spaceAbove > popoverHeight) {
      top = rect.top - popoverHeight - 6;
    }

    let left = rect.left;
    if (align === "right") {
      left = rect.right - popoverWidth;
    }

    // Boundary constraints
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    setPopoverPosition({ top, left });
  }, [align]);

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setViewMode("days");
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setViewMode("days");
  };

  // Close on Outside Click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Navigate Months
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Select Date
  const handleSelectDay = (day: Date) => {
    const key = formatDateKey(day);
    onChange(key);
    handleClose();
  };

  // Quick Preset Actions
  const handleSetToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    onChange(formatDateKey(today));
    handleClose();
  };

  const handleSetTomorrow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const d = new Date();
    d.setDate(d.getDate() + 1);
    onChange(formatDateKey(d));
    handleClose();
  };

  const handleSetPlus3Days = (e: React.MouseEvent) => {
    e.stopPropagation();
    const d = new Date();
    d.setDate(d.getDate() + 3);
    onChange(formatDateKey(d));
    handleClose();
  };

  const handleSetPlus1Week = (e: React.MouseEvent) => {
    e.stopPropagation();
    const d = new Date();
    d.setDate(d.getDate() + 7);
    onChange(formatDateKey(d));
    handleClose();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    handleClose();
  };

  // Formatted Label for Trigger
  const displayLabel = useMemo(() => {
    if (!selectedDate) return placeholder;
    const d = selectedDate.getDate();
    const m = GEORGIAN_MONTHS[selectedDate.getMonth()];
    const y = selectedDate.getFullYear();

    const todayStr = formatDateKey(new Date());
    const valStr = formatDateKey(selectedDate);

    if (valStr === todayStr) {
      return `დღეს (${d} ${m})`;
    }
    return `${d} ${m}, ${y}`;
  }, [selectedDate, placeholder]);

  // Build Calendar Matrix (42 days, Mon-Sun)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1, 12, 0, 0);
    // Sunday is 0 in JS, make Monday 0
    let dayOfWeek = firstDayOfMonth.getDay() - 1;
    if (dayOfWeek === -1) dayOfWeek = 6;

    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const days: {
      date: Date;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
      key: string;
    }[] = [];

    const todayKey = formatDateKey(new Date());
    const currentValKey = value || "";

    const curr = new Date(startDate);
    for (let i = 0; i < 42; i++) {
      const key = formatDateKey(curr);
      const isCurrentMonth = curr.getMonth() === viewMonth;
      const isSelected = key === currentValKey;
      const isToday = key === todayKey;

      let isDisabled = false;
      if (minDate && key < minDate) isDisabled = true;
      if (maxDate && key > maxDate) isDisabled = true;

      days.push({
        date: new Date(curr),
        isCurrentMonth,
        isSelected,
        isToday,
        isDisabled,
        key,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return days;
  }, [viewYear, viewMonth, value, minDate, maxDate]);

  // Years for Year Picker (e.g. 2024 to 2032)
  const yearOptions = useMemo(() => {
    const startYear = Math.min(viewYear - 4, new Date().getFullYear() - 1);
    return Array.from({ length: 12 }, (_, i) => startYear + i);
  }, [viewYear]);

  // Trigger size classes
  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs rounded-lg gap-1.5",
    md: "px-3 py-2 text-xs sm:text-sm rounded-xl gap-2",
    lg: "px-3.5 py-2.5 text-sm rounded-xl gap-2.5",
  }[size];

  return (
    <>
      {/* 1. TRIGGER BUTTON */}
      <div className="relative inline-block w-full">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          onClick={handleOpen}
          className={`group flex items-center justify-between w-full border text-left font-medium transition-all select-none cursor-pointer ${sizeClasses} ${
            disabled
              ? "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
              : isOpen
              ? "bg-white border-blue-500 ring-2 ring-blue-500/20 text-stone-900 shadow-xs"
              : selectedDate
              ? "bg-white border-stone-300 hover:border-stone-400 text-stone-900 shadow-2xs hover:shadow-xs"
              : "bg-white border-stone-200 hover:border-stone-300 text-stone-500 shadow-2xs"
          } ${className}`}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon
              size={size === "sm" ? 13 : 15}
              className={`shrink-0 transition-colors ${
                disabled
                  ? "text-stone-300"
                  : selectedDate
                  ? "text-blue-600"
                  : "text-stone-400 group-hover:text-stone-600"
              }`}
            />
            <span
              className={`truncate ${
                selectedDate
                  ? "font-semibold text-stone-800"
                  : "font-normal text-stone-400"
              }`}
            >
              {displayLabel}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {clearable && selectedDate && !disabled && (
              <span
                role="button"
                onClick={handleClear}
                className="p-1 rounded-full text-stone-300 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                title="გასუფთავება"
              >
                <X size={12} strokeWidth={2.5} />
              </span>
            )}
            <ChevronDown
              size={13}
              className={`text-stone-400 transition-transform ${
                isOpen ? "rotate-180 text-blue-600" : ""
              }`}
            />
          </div>
        </button>

        {/* Hidden input for native form compatibility */}
        {name && (
          <input
            type="hidden"
            name={name}
            value={value || ""}
            required={required}
          />
        )}
      </div>

      {/* 2. POPOVER DROPDOWN (Rendered in Portal to escape modal/drawer overflow) */}
      {isMounted &&
        isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${popoverPosition.top}px`,
              left: `${popoverPosition.left}px`,
              zIndex: 999999,
            }}
            className="w-[310px] bg-white rounded-2xl border border-stone-200/90 shadow-2xl p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150 select-none text-stone-800 font-sans"
          >
            {/* Header: Month / Year Controls */}
            <div className="flex items-center justify-between pb-1 border-b border-stone-100">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setViewMode((prev) => (prev === "months" ? "days" : "months"))
                  }
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                    viewMode === "months"
                      ? "bg-blue-50 text-blue-700"
                      : "text-stone-800 hover:bg-stone-100"
                  }`}
                  title="თვის არჩევა"
                >
                  <span>{GEORGIAN_MONTHS[viewMonth]}</span>
                  <ChevronDown size={11} className="text-stone-400" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setViewMode((prev) => (prev === "years" ? "days" : "years"))
                  }
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                    viewMode === "years"
                      ? "bg-blue-50 text-blue-700"
                      : "text-stone-800 hover:bg-stone-100"
                  }`}
                  title="წლის არჩევა"
                >
                  <span>{viewYear}</span>
                  <ChevronDown size={11} className="text-stone-400" />
                </button>
              </div>

              {/* Prev / Next Month Buttons */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                  title="წინა თვე"
                >
                  <ChevronLeft size={16} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                  title="შემდეგი თვე"
                >
                  <ChevronRight size={16} strokeWidth={2.2} />
                </button>
              </div>
            </div>

            {/* VIEW MODE: MONTHS SELECTOR */}
            {viewMode === "months" && (
              <div className="grid grid-cols-3 gap-1.5 py-2">
                {GEORGIAN_MONTHS.map((m, idx) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setViewMonth(idx);
                      setViewMode("days");
                    }}
                    className={`py-2 px-1 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                      viewMonth === idx
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

            {/* VIEW MODE: YEARS SELECTOR */}
            {viewMode === "years" && (
              <div className="grid grid-cols-3 gap-1.5 py-2 max-h-[190px] overflow-y-auto">
                {yearOptions.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setViewYear(y);
                      setViewMode("days");
                    }}
                    className={`py-2 px-1 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                      viewYear === y
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            {/* VIEW MODE: DAYS CALENDAR GRID */}
            {viewMode === "days" && (
              <div>
                {/* Weekdays Header: ორშ, სამ, ოთხ, ხუთ, პარ, შაბ, კვი */}
                <div className="grid grid-cols-7 mb-1 text-center">
                  {GEORGIAN_DAYS_HEADER.map((d, idx) => (
                    <span
                      key={d}
                      className={`text-[10px] font-bold py-1 ${
                        idx >= 5 ? "text-amber-600/80" : "text-stone-400"
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {/* Days Cells */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((item) => {
                    const dayNumber = item.date.getDate();
                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={item.isDisabled}
                        onClick={() => handleSelectDay(item.date)}
                        className={`h-8 rounded-xl flex items-center justify-center text-xs font-semibold transition-all relative cursor-pointer ${
                          item.isDisabled
                            ? "opacity-25 cursor-not-allowed text-stone-300"
                            : item.isSelected
                            ? "bg-blue-600 text-white font-bold shadow-xs scale-102"
                            : item.isCurrentMonth
                            ? "text-stone-800 hover:bg-blue-50 hover:text-blue-700"
                            : "text-stone-300 hover:bg-stone-50 hover:text-stone-500"
                        } ${
                          item.isToday && !item.isSelected
                            ? "ring-1.5 ring-blue-500/80 font-black text-blue-700"
                            : ""
                        }`}
                      >
                        <span>{dayNumber}</span>
                        {item.isToday && !item.isSelected && (
                          <span className="w-1 h-1 rounded-full bg-blue-600 absolute bottom-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Presets Bar (Fast Deadline Picking!) */}
            {showPresets && (
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] font-bold text-stone-600">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSetToday}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    დღეს
                  </button>
                  <button
                    type="button"
                    onClick={handleSetTomorrow}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    ხვალ
                  </button>
                  <button
                    type="button"
                    onClick={handleSetPlus3Days}
                    className="px-1.5 py-1 rounded-lg bg-stone-100 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer hidden sm:inline-block"
                  >
                    +3 დღე
                  </button>
                  <button
                    type="button"
                    onClick={handleSetPlus1Week}
                    className="px-1.5 py-1 rounded-lg bg-stone-100 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    +1 კვ
                  </button>
                </div>

                {clearable && value && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    გასუფთავება
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

