"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";

interface WorkingDay {
  id: string;
  dayOfWeek: number;
  isWorking: boolean;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  isOfficial: boolean;
}

export function CalendarSettings() {
  const [workingCalendar, setWorkingCalendar] = useState<WorkingDay[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDays, setIsSavingDays] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add holiday modal
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayIsOfficial, setNewHolidayIsOfficial] = useState(false);
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const refreshCalendar = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/settings/calendar");
      if (!res.ok) {
        throw new Error("კალენდრის პარამეტრების ჩატვირთვა ვერ მოხერხდა");
      }
      const data = await res.json();
      setWorkingCalendar(data.workingCalendar || []);
      setHolidays(data.holidays || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "სერვერის შეცდომა");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      try {
        const res = await fetch("/api/settings/calendar");
        if (!res.ok) {
          throw new Error("კალენდრის პარამეტრების ჩატვირთვა ვერ მოხერხდა");
        }
        const data = await res.json();
        if (active) {
          setWorkingCalendar(data.workingCalendar || []);
          setHolidays(data.holidays || []);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "სერვერის შეცდომა");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      active = false;
    };
  }, []);

  const handleToggleDay = (dayOfWeek: number) => {
    setWorkingCalendar((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, isWorking: !d.isWorking } : d
      )
    );
  };

  const handleSaveWorkingDays = async () => {
    try {
      setIsSavingDays(true);
      setError(null);
      const res = await fetch("/api/settings/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: workingCalendar.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            isWorking: d.isWorking,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "შენახვა ვერ მოხერხდა");
      }

      setSuccessMessage("სამუშაო დღეების პარამეტრები წარმატებით შეინახა");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "შეცდომა შენახვისას");
    } finally {
      setIsSavingDays(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!newHolidayDate || !newHolidayName.trim()) {
      setModalError("გთხოვთ შეავსოთ თარიღი და დასახელება");
      return;
    }

    try {
      setIsSubmittingHoliday(true);
      const res = await fetch("/api/settings/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newHolidayDate,
          name: newHolidayName.trim(),
          isOfficial: newHolidayIsOfficial,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "უქმე დღის დამატება ვერ მოხერხდა");
      }

      setIsAddHolidayOpen(false);
      setNewHolidayDate("");
      setNewHolidayName("");
      setNewHolidayIsOfficial(false);
      setSuccessMessage("უქმე დღე წარმატებით დაემატა");
      setTimeout(() => setSuccessMessage(null), 4000);
      refreshCalendar();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "შეცდომა დამატებისას");
    } finally {
      setIsSubmittingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (holiday: Holiday) => {
    if (!confirm(`ნამდვილად გსურთ უქმე დღის წაშლა (${holiday.name})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/settings/calendar?id=${holiday.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "უქმე დღის წაშლა ვერ მოხერხდა");
      }

      setHolidays((prev) => prev.filter((h) => h.id !== holiday.id));
      setSuccessMessage(`უქმე დღე (${holiday.name}) წარმატებით წაიშალა`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "შეცდომა წაშლისას");
    }
  };

  const dayNames = [
    "კვირა",
    "ორშაბათი",
    "სამშაბათი",
    "ოთხშაბათი",
    "ხუთშაბათი",
    "პარასკევი",
    "შაბათი",
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50/50 p-6 lg:p-8 space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs">
        <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase tracking-wider mb-1">
          <Calendar size={16} />
          <span>სისტემის პარამეტრები</span>
        </div>
        <h1 className="text-xl font-bold text-stone-900 tracking-tight">
          სამუშაო კალენდარი და უქმეები
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          განსაზღვრეთ სამუშაო კვირის განრიგი და ოფიციალური თუ შიდა დასვენების დღეები.
        </p>
      </div>

      {/* Notifications / Alerts */}
      {successMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-in fade-in duration-200">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-stone-400 gap-3 bg-white rounded-2xl border border-stone-200/80">
          <Loader2 size={28} className="animate-spin text-orange-600" />
          <span className="text-xs">პარამეტრები იტვირთება...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Working Week Days */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  სამუშაო კვირის დღეები
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  მონიშნეთ დღეები, რომლებიც ითვლება სამუშაო დღეებად.
                </p>
              </div>
              <button
                onClick={handleSaveWorkingDays}
                disabled={isSavingDays}
                className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                {isSavingDays ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle size={13} />
                )}
                <span>შენახვა</span>
              </button>
            </div>

            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                const dayConfig = workingCalendar.find((d) => d.dayOfWeek === dayIdx);
                const isWorking = dayConfig ? dayConfig.isWorking : dayIdx >= 1 && dayIdx <= 5;

                return (
                  <div
                    key={dayIdx}
                    onClick={() => handleToggleDay(dayIdx)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      isWorking
                        ? "bg-emerald-50/40 border-emerald-200/80 text-emerald-900"
                        : "bg-stone-50/60 border-stone-200/70 text-stone-500"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isWorking
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-stone-300 bg-white"
                        }`}
                      >
                        {isWorking && <CheckCircle size={12} className="stroke-[3]" />}
                      </div>
                      <span className="text-xs font-bold">{dayNames[dayIdx]}</span>
                    </div>
                    <span className="text-[11px] font-semibold">
                      {isWorking ? "სამუშაო დღე" : "დასვენება"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Holidays List */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs space-y-5 flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  უქმე / დასვენების დღეები
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  ოფიციალური სახელმწიფო უქმეები და შიდა დასვენების დღეები.
                </p>
              </div>
              <button
                onClick={() => {
                  setModalError(null);
                  setIsAddHolidayOpen(true);
                }}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus size={14} />
                <span>დამატება</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[380px] divide-y divide-stone-100">
              {holidays.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  უქმე დღეები არ არის დამატებული
                </div>
              ) : (
                holidays.map((h) => (
                  <div
                    key={h.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs shrink-0">
                        {new Date(h.date).getDate()}
                      </div>
                      <div>
                        <div className="font-bold text-stone-900">{h.name}</div>
                        <div className="text-[11px] text-stone-400">
                          {new Date(h.date).toLocaleDateString("ka-GE", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {h.isOfficial ? (
                        <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-[10px] font-semibold">
                          ოფიციალური
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-200 rounded-full text-[10px] font-semibold">
                          შიდა
                        </span>
                      )}

                      <button
                        onClick={() => handleDeleteHoliday(h)}
                        className="p-1 text-stone-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="წაშლა"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Holiday Modal */}
      {isAddHolidayOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Calendar size={16} />
                </div>
                <h3 className="text-sm font-bold text-stone-900">
                  უქმე დღის დამატება
                </h3>
              </div>
              <button
                onClick={() => setIsAddHolidayOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddHoliday} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  თარიღი *
                </label>
                <DatePicker
                  value={newHolidayDate}
                  onChange={(val) => setNewHolidayDate(val)}
                  placeholder="აირჩიეთ თარიღი"
                  size="md"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  დასახელება *
                </label>
                <input
                  type="text"
                  required
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  placeholder="მაგ: გიორგობა / კორპორატიული დასვენება"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isOfficial"
                  checked={newHolidayIsOfficial}
                  onChange={(e) => setNewHolidayIsOfficial(e.target.checked)}
                  className="rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="isOfficial" className="text-xs text-stone-700 font-medium cursor-pointer">
                  ოფიციალური სახელმწიფო უქმე
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddHolidayOpen(false)}
                  className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHoliday}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingHoliday && (
                    <Loader2 size={13} className="animate-spin" />
                  )}
                  <span>დამატება</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
