"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CalendarClock, CalendarRange, Loader2, Wand2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { tx } from "@/app/lib/theme";

type AvailabilityDay = { weekday: number; isAvailable: boolean; startTime: string; endTime: string };

const WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const defaultAvailability = (): AvailabilityDay[] => WEEKDAYS.map((_, weekday) => ({ weekday, isAvailable: false, startTime: "08:00", endTime: "20:00" }));

const weekdaysInRange = (start: number, end: number) => {
  const days: number[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const weekday = (start + offset) % 7;
    days.push(weekday);
    if (weekday === end) break;
  }
  return days;
};

export function TeacherPrivateLessonAvailabilityPanel() {
  const [availability, setAvailability] = useState<AvailabilityDay[]>(defaultAvailability);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeStartDay, setRangeStartDay] = useState(6);
  const [rangeEndDay, setRangeEndDay] = useState(3);
  const [quickStartTime, setQuickStartTime] = useState("09:00");
  const [quickEndTime, setQuickEndTime] = useState("21:00");

  const loadAvailability = useCallback(async () => {
    const { data, error: fetchError } = await apiFetch<{ availability: AvailabilityDay[] }>("/api/private-lesson-availability");
    if (fetchError) setError(fetchError);
    else {
      const byWeekday = new Map((data?.availability || []).map((day) => [day.weekday, day]));
      setAvailability(WEEKDAYS.map((_, weekday) => byWeekday.get(weekday) || { weekday, isAvailable: false, startTime: "08:00", endTime: "20:00" }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAvailability(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAvailability]);

  const updateDay = (weekday: number, patch: Partial<AvailabilityDay>) => {
    setAvailability((current) => current.map((day) => day.weekday === weekday ? { ...day, ...patch } : day));
  };

  const applyQuickRange = () => {
    const selectedDays = new Set(weekdaysInRange(rangeStartDay, rangeEndDay));
    setAvailability((current) => current.map((day) => selectedDays.has(day.weekday)
      ? { ...day, isAvailable: true, startTime: quickStartTime, endTime: quickEndTime }
      : day));
  };

  const applyExampleSchedule = () => {
    const saturdayToWednesday = new Set(weekdaysInRange(6, 3));
    setAvailability((current) => current.map((day) => {
      if (saturdayToWednesday.has(day.weekday)) {
        return { ...day, isAvailable: true, startTime: "09:00", endTime: "21:00" };
      }
      if (day.weekday === 4) {
        return { ...day, isAvailable: true, startTime: "12:00", endTime: "22:00" };
      }
      if (day.weekday === 5) {
        return { ...day, isAvailable: false, startTime: "09:00", endTime: "21:00" };
      }
      return day;
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const { error: saveError } = await apiFetch("/api/private-lesson-availability", { method: "PUT", body: JSON.stringify({ availability }) });
    setSaving(false);
    if (saveError) setError(saveError);
    else await loadAvailability();
  };

  return (
    <section className="rounded-3xl border p-5 sm:p-6 space-y-5 animate-slideInUp" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-extrabold text-lg">เวลาสอนส่วนตัวของฉัน</h1>
          <p className="text-xs" style={{ color: tx.muted }}>
            กำหนดเวลาว่างรายสัปดาห์สำหรับการจองสอนตัวต่อตัว ตารางนี้ใช้ร่วมกันทุกวิชาของคุณ
          </p>
        </div>
      </div>

      <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <CalendarRange className="h-4 w-4 text-violet-500" />
              ตั้งค่าเร็ว
            </div>
            <p className="mt-1 text-xs" style={{ color: tx.muted }}>
              เลือกช่วงวันแล้วใช้เวลาเดียวกันได้ทันที ช่วงวันสามารถข้ามสัปดาห์ได้ เช่น เสาร์ ถึง พุธ
            </p>
          </div>
          <button
            type="button"
            onClick={applyExampleSchedule}
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition hover:bg-violet-500/10 active:scale-95"
            style={{ borderColor: tx.borderS, color: tx.accent }}
          >
            <Wand2 className="h-4 w-4" />
            ใช้ตัวอย่างนี้
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="text-[10px] font-medium space-y-1" style={{ color: tx.muted }}>
            จากวัน
            <select value={rangeStartDay} onChange={(event) => setRangeStartDay(Number(event.target.value))} className="block w-full rounded-lg border px-2 py-2 text-xs bg-transparent" style={{ borderColor: tx.borderS, color: tx.primary }}>
              {WEEKDAYS.map((label, weekday) => <option key={weekday} value={weekday}>{label}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-medium space-y-1" style={{ color: tx.muted }}>
            ถึงวัน
            <select value={rangeEndDay} onChange={(event) => setRangeEndDay(Number(event.target.value))} className="block w-full rounded-lg border px-2 py-2 text-xs bg-transparent" style={{ borderColor: tx.borderS, color: tx.primary }}>
              {WEEKDAYS.map((label, weekday) => <option key={weekday} value={weekday}>{label}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-medium space-y-1" style={{ color: tx.muted }}>
            เริ่ม
            <input type="time" step="600" value={quickStartTime} onChange={(event) => setQuickStartTime(event.target.value)} className="block w-full rounded-lg border px-2 py-2 text-xs bg-transparent" style={{ borderColor: tx.borderS, color: tx.primary }} />
          </label>
          <label className="text-[10px] font-medium space-y-1" style={{ color: tx.muted }}>
            สิ้นสุด
            <input type="time" step="600" value={quickEndTime} onChange={(event) => setQuickEndTime(event.target.value)} className="block w-full rounded-lg border px-2 py-2 text-xs bg-transparent" style={{ borderColor: tx.borderS, color: tx.primary }} />
          </label>
          <button type="button" onClick={applyQuickRange} className="btn-primary h-10 self-end px-3 text-xs">
            ใช้กับช่วงวัน
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: tx.muted }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          กำลังโหลดตารางเวลา...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {availability.map((day) => (
            <div key={day.weekday} className="rounded-2xl border p-3 space-y-2.5" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
              <label className="flex items-center justify-between gap-2 text-sm font-bold">
                <span>{WEEKDAYS[day.weekday]}</span>
                <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: tx.muted }}>
                  <input type="checkbox" checked={day.isAvailable} onChange={(event) => updateDay(day.weekday, { isAvailable: event.target.checked })} className="h-3.5 w-3.5 accent-violet-600" />
                  เปิดรับจอง
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-medium space-y-1" style={{ color: tx.muted }}>
                  เริ่ม
                  <input aria-label={`เวลาเริ่ม ${WEEKDAYS[day.weekday]}`} type="time" step="600" disabled={!day.isAvailable} value={day.startTime} onChange={(event) => updateDay(day.weekday, { startTime: event.target.value })} className="block w-full min-w-0 rounded-lg border px-2 py-2 text-xs bg-transparent disabled:opacity-40" style={{ borderColor: tx.borderS, color: tx.primary }} />
                </label>
                <label className="text-[10px] font-medium space-y-1" style={{ color: tx.muted }}>
                  สิ้นสุด
                  <input aria-label={`เวลาสิ้นสุด ${WEEKDAYS[day.weekday]}`} type="time" step="600" disabled={!day.isAvailable} value={day.endTime} onChange={(event) => updateDay(day.weekday, { endTime: event.target.value })} className="block w-full min-w-0 rounded-lg border px-2 py-2 text-xs bg-transparent disabled:opacity-40" style={{ borderColor: tx.borderS, color: tx.primary }} />
                </label>
              </div>
              {!day.isAvailable && (
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: tx.muted }}>
                  <Ban className="h-3.5 w-3.5" />
                  ไม่เปิดจอง
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
      <div className="flex justify-end">
        <button type="button" disabled={loading || saving} onClick={() => void save()} className="btn-primary px-4 py-2.5 text-xs disabled:opacity-60">
          {saving ? "กำลังบันทึก..." : "บันทึกตารางเวลาว่าง"}
        </button>
      </div>
    </section>
  );
}
