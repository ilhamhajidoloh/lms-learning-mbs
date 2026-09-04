"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CalendarClock, CheckCircle2, Clock3, Loader2, MessageSquare, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { alert as swalAlert, toast } from "@/lib/swal";
import { formatThaiDateTime, isoToLocalInput } from "@/app/lib/date";
import { tx } from "@/app/lib/theme";
import { useUser, type Course } from "@/app/context/UserContext";
import { JoinLiveClassButton } from "./JoinLiveClassButton";

type RequestStatus = "pending" | "accepted" | "declined" | "cancelled";
type TeacherAvailabilityDay = { weekday: number; isAvailable: boolean; startTime: string; endTime: string };

export interface PrivateLessonRequest {
  id: string;
  course_id: string;
  course_title: string;
  student_name: string;
  teacher_name: string;
  requested_at: string;
  confirmed_at: string | null;
  duration_minutes: number;
  requested_slots: string[];
  message: string;
  teacher_note: string | null;
  live_class_id: string | null;
  live_room_name: string | null;
  live_is_active: boolean | null;
  status: RequestStatus;
  created_at: string;
}

const statusStyle: Record<RequestStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  declined: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  cancelled: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

const statusLabel: Record<RequestStatus, string> = {
  pending: "รอครูตอบรับ",
  accepted: "ยืนยันนัดแล้ว",
  declined: "ครูไม่สะดวก",
  cancelled: "ยกเลิกแล้ว",
};

function localInputTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
}

function nextDayLocalDate() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return localInputTime(date).slice(0, 10);
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function createTimeSlots(startTime = "08:00", endTime = "20:00") {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 10) return [];
  return Array.from({ length: Math.floor((end - start) / 10) }, (_, index) => formatSlotTime(start + index * 10));
}

function formatSlotTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function summarizeSelectedSlots(slots: string[]) {
  const minutes = [...new Set(slots)].sort().map((slot) => {
    const [hours, slotMinutes] = slot.split(":").map(Number);
    return hours * 60 + slotMinutes;
  });
  const ranges: { start: number; end: number; blocks: number }[] = [];

  for (const minute of minutes) {
    const previous = ranges.at(-1);
    if (previous && minute === previous.end) {
      previous.end += 10;
      previous.blocks += 1;
    } else {
      ranges.push({ start: minute, end: minute + 10, blocks: 1 });
    }
  }

  return { ranges, totalMinutes: minutes.length * 10 };
}

export function PrivateLessonBookingCard({ course }: { course: Course }) {
  const { displayName } = useUser();
  const [requests, setRequests] = useState<PrivateLessonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<PrivateLessonRequest | null>(null);
  const [bookingDate, setBookingDate] = useState(nextDayLocalDate);
  const [bookingMinimumTime, setBookingMinimumTime] = useState(() => Date.now() + 5 * 60_000);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [availability, setAvailability] = useState<TeacherAvailabilityDay[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bookingWeekday = new Date(`${bookingDate}T12:00:00`).getDay();
  const selectedDayAvailability = availability.find((day) => day.weekday === bookingWeekday && day.isAvailable);
  const timeSlots = selectedDayAvailability ? createTimeSlots(selectedDayAvailability.startTime, selectedDayAvailability.endTime) : [];

  const loadRequests = useCallback(async () => {
    const { data, error: fetchError } = await apiFetch<{ privateLessonRequests: PrivateLessonRequest[] }>(`/api/private-lesson-requests?courseId=${encodeURIComponent(course.id)}`);
    if (fetchError) setError(fetchError);
    else setRequests(data?.privateLessonRequests ?? []);
    setLoading(false);
  }, [course.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRequests(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  useEffect(() => {
    let cancelled = false;
    const loadAvailability = async () => {
      const { data, error: fetchError } = await apiFetch<{ availability: TeacherAvailabilityDay[] }>(`/api/private-lesson-availability?teacherId=${encodeURIComponent(course.instructorId)}`);
      if (cancelled) return;
      if (fetchError) setError(fetchError);
      else setAvailability(data?.availability || []);
      setAvailabilityLoading(false);
    };
    void loadAvailability();
    return () => { cancelled = true; };
  }, [course.instructorId]);

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    const requestedAt = `${bookingDate}T${selectedSlots[0]}`;
    if (!bookingDate || selectedSlots.length === 0) return;
    setSubmitting(true);
    setError(null);
    const { error: submitError } = await apiFetch("/api/private-lesson-requests", editingRequest ? {
      method: "PATCH",
      body: JSON.stringify({ id: editingRequest.id, action: "resubmit", requestedAt: new Date(requestedAt).toISOString(), requestedSlots: selectedSlots, durationMinutes: selectedSlots.length * 10, message }),
    } : {
      method: "POST",
      body: JSON.stringify({ courseId: course.id, requestedAt: new Date(requestedAt).toISOString(), requestedSlots: selectedSlots, durationMinutes: selectedSlots.length * 10, message }),
    });
    setSubmitting(false);
    if (submitError) {
      setError(submitError);
      return;
    }
    setMessage("");
    setEditingRequest(null);
    setShowForm(false);
    await loadRequests();
  };

  const openNewRequestForm = () => {
    setBookingMinimumTime(Date.now() + 5 * 60_000);
    setEditingRequest(null);
    setBookingDate(nextDayLocalDate());
    setSelectedSlots([]);
    setMessage("");
    setError(null);
    setShowForm((current) => !current);
  };

  const editDeclinedRequest = (request: PrivateLessonRequest) => {
    setEditingRequest(request);
    const localDateTime = isoToLocalInput(request.requested_at);
    setBookingDate(localDateTime.slice(0, 10));
    const previousSlot = localDateTime.slice(11, 16);
    const savedSlots = request.requested_slots?.filter((slot) => timeSlots.includes(slot)) ?? [];
    const nextSlots = savedSlots.length > 0 ? savedSlots : [timeSlots.includes(previousSlot) ? previousSlot : "09:00"];
    setSelectedSlots(nextSlots);
    setMessage(request.message);
    setError(null);
    setShowForm(true);
  };

  const cancelRequest = async (id: string, isConfirmedAppointment = false) => {
    const confirmed = await swalAlert.confirm(
      isConfirmedAppointment ? "ยืนยันการยกเลิกนัดหมาย?" : "ยืนยันการยกเลิกคำขอ?",
      isConfirmedAppointment ? "ห้องเรียนส่วนตัวที่สร้างไว้จะถูกยกเลิกด้วย" : "ครูจะไม่สามารถตอบรับคำขอนี้ได้อีก",
      "ยืนยันการยกเลิก",
    );
    if (!confirmed) return;
    const { error: cancelError } = await apiFetch("/api/private-lesson-requests", {
      method: "PATCH",
      body: JSON.stringify({ id, action: "cancelled" }),
    });
    if (cancelError) {
      setError(cancelError);
      await swalAlert.error("ยกเลิกนัดหมายไม่สำเร็จ", cancelError);
    } else {
      toast.success("ยกเลิกนัดหมายเรียบร้อยแล้ว");
      await loadRequests();
    }
  };

  const deleteRequest = async (id: string) => {
    const confirmed = await swalAlert.confirm(
      "ลบรายการนัดหมาย?",
      "รายการนี้จะถูกลบอย่างถาวรและไม่สามารถกู้คืนได้",
      "ลบรายการ",
    );
    if (!confirmed) return;
    const { error: deleteError } = await apiFetch("/api/private-lesson-requests", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    if (deleteError) {
      setError(deleteError);
      await swalAlert.error("ลบรายการไม่สำเร็จ", deleteError);
    } else {
      toast.success("ลบรายการนัดหมายเรียบร้อยแล้ว");
      await loadRequests();
    }
  };

  const bookingSummary = summarizeSelectedSlots(selectedSlots);

  return (
    <section className="rounded-3xl border p-5 sm:p-6 space-y-5 animate-slideInUp" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center"><CalendarClock className="h-5 w-5" /></div>
          <div>
            <h2 className="font-extrabold">จองเวลาสอนตัวต่อตัว</h2>
            <p className="text-xs" style={{ color: tx.muted }}>วิชา {course.title} · ครู{course.instructor}</p>
          </div>
        </div>
        <button type="button" onClick={openNewRequestForm} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 text-xs font-bold transition-all active:scale-95">
          <Plus className="h-4 w-4" /> ขอเวลานัดเรียน
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl p-4 border animate-fadeIn" style={{ backgroundColor: tx.elevated, borderColor: tx.borderS }}>
          {editingRequest && <p className="md:col-span-2 text-xs font-bold text-violet-600 dark:text-violet-300">แก้ไขคำขอ แล้วบันทึกเพื่ออัปเดตคิวของครู</p>}
          <label className="text-xs font-bold space-y-1.5">
            <span>วันที่ต้องการ</span>
            <input required type="date" min={localInputTime(new Date(bookingMinimumTime)).slice(0, 10)} value={bookingDate} onChange={(event) => { setBookingDate(event.target.value); setSelectedSlots([]); }} className="w-full rounded-xl border px-3 py-2.5 bg-transparent" style={{ borderColor: tx.borderS }} />
          </label>
          <fieldset className="md:col-span-2 space-y-2">
            <legend className="text-xs font-bold">เลือกบล็อกเวลา <span style={{ color: tx.muted }}>(1 บล็อก = 10 นาที · เลือกหลายบล็อกและเว้นช่วงได้ สูงสุด 12 บล็อก)</span></legend>
            {availabilityLoading ? <div className="flex items-center gap-2 rounded-xl border px-3 py-4 text-xs" style={{ borderColor: tx.borderS, color: tx.muted }}><Loader2 className="h-4 w-4 animate-spin" />กำลังโหลดเวลาว่างของครู...</div> : !selectedDayAvailability ? <div className="rounded-xl border px-3 py-4 text-xs" style={{ borderColor: tx.borderS, color: tx.muted }}>ครูยังไม่เปิดรับจองในวันนี้ กรุณาเลือกวันอื่น</div> : <><p className="text-[11px] font-bold" style={{ color: tx.secondary }}>ครูเปิดรับจอง {selectedDayAvailability.startTime}–{selectedDayAvailability.endTime}</p><div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-64 overflow-y-auto pr-1">
              {timeSlots.map((slot) => {
                const isPast = new Date(`${bookingDate}T${slot}:00`).getTime() < bookingMinimumTime;
                const selected = selectedSlots.includes(slot);
                return <button key={slot} type="button" aria-pressed={selected} disabled={isPast || (!selected && selectedSlots.length >= 12)} onClick={() => setSelectedSlots((current) => selected ? current.filter((value) => value !== slot) : [...current, slot].sort())} className={`min-h-10 rounded-xl border text-[10px] sm:text-xs font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${selected ? "bg-violet-600 border-violet-600 text-white shadow-sm" : "hover:bg-violet-500/10"}`} style={!selected ? { borderColor: tx.borderS, color: tx.secondary } : undefined}>{slot}–{formatSlotTime(timeToMinutes(slot) + 10)}</button>;
              })}
            </div></>}
            <div className="rounded-xl border px-3 py-2.5 text-xs space-y-1.5" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
              <p className="font-bold">สรุปเวลาที่เลือก</p>
              {bookingSummary.ranges.length === 0
                ? <p style={{ color: tx.muted }}>ยังไม่ได้เลือกบล็อกเวลา</p>
                : <div className="flex flex-wrap gap-1.5">{bookingSummary.ranges.map((range) => <span key={`${range.start}-${range.end}`} className="rounded-lg bg-violet-500/10 px-2 py-1 font-bold text-violet-700 dark:text-violet-300">{formatSlotTime(range.start)}–{formatSlotTime(range.end)} ({range.blocks * 10} นาที)</span>)}</div>}
              <p style={{ color: tx.muted }}>รวม {bookingSummary.totalMinutes} นาที · ช่วงเวลาที่เว้นไว้จะไม่นับรวม</p>
            </div>
          </fieldset>
          <label className="text-xs font-bold space-y-1.5">
            <span>หัวข้อที่อยากให้ช่วย (ไม่บังคับ)</span>
            <input maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="เช่น ขอทบทวนเรื่องสมการกำลังสอง" className="w-full rounded-xl border px-3 py-2.5 bg-transparent" style={{ borderColor: tx.borderS }} />
          </label>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingRequest(null); }} className="btn-cancel px-4 py-2.5 text-xs">ยกเลิก</button>
            <button disabled={submitting} className="btn-primary px-4 py-2.5 text-xs disabled:opacity-60">{submitting ? "กำลังบันทึก..." : editingRequest ? editingRequest.status === "pending" ? "บันทึกการแก้ไข" : "ส่งคำขอใหม่" : "ส่งคำขอถึงครู"}</button>
          </div>
        </form>
      )}

      {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
      <div className="space-y-2">
        {loading ? <div className="flex items-center gap-2 text-xs" style={{ color: tx.muted }}><Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดรายการนัดหมาย...</div>
          : requests.length === 0 ? <p className="text-xs" style={{ color: tx.muted }}>ยังไม่มีคำขอนัดเรียนส่วนตัวสำหรับรายวิชานี้</p>
          : requests.slice(0, 4).map((request) => (
            <div key={request.id} className="rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: tx.borderS }}>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-sm truncate">{request.course_title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusStyle[request.status]}`}>{statusLabel[request.status]}</span></div>
                <p className="text-xs" style={{ color: tx.secondary }}><Clock3 className="h-3.5 w-3.5 inline mr-1" />{formatThaiDateTime(request.confirmed_at || request.requested_at)} · {request.duration_minutes} นาที · ครู{request.teacher_name}</p>
                {request.teacher_note && <p className="text-xs text-violet-600 dark:text-violet-300"><MessageSquare className="h-3.5 w-3.5 inline mr-1" />{request.teacher_note}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {request.status === "pending" && <><button type="button" onClick={() => editDeclinedRequest(request)} className="inline-flex items-center justify-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 px-3 py-2 rounded-xl"><Pencil className="h-4 w-4" /> แก้ไขคำขอ</button><button type="button" onClick={() => void cancelRequest(request.id)} className="inline-flex items-center justify-center gap-1 text-xs font-bold text-rose-500 hover:bg-rose-500/10 px-3 py-2 rounded-xl"><XCircle className="h-4 w-4" /> ยกเลิกคำขอ</button></>}
                {request.status === "declined" && <><button type="button" onClick={() => editDeclinedRequest(request)} className="inline-flex items-center justify-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 px-3 py-2 rounded-xl"><Pencil className="h-4 w-4" /> แก้ไข</button><button type="button" onClick={() => void deleteRequest(request.id)} className="inline-flex items-center justify-center gap-1 text-xs font-bold text-rose-500 hover:bg-rose-500/10 px-3 py-2 rounded-xl"><Trash2 className="h-4 w-4" /> ลบ</button></>}
                {request.status === "accepted" && <><CheckCircle2 className="h-5 w-5 text-emerald-500" />{request.live_class_id && request.live_room_name && <JoinLiveClassButton liveClassId={request.live_class_id} roomName={request.live_room_name} displayName={displayName} isActive={request.live_is_active === true} size="sm">เข้าห้องเรียน</JoinLiveClassButton>}<button type="button" onClick={() => void cancelRequest(request.id, true)} className="inline-flex items-center justify-center gap-1 text-xs font-bold text-rose-500 hover:bg-rose-500/10 px-3 py-2 rounded-xl"><Ban className="h-4 w-4" /> ยกเลิกนัด</button></>}
                {request.status === "cancelled" && <button type="button" onClick={() => void deleteRequest(request.id)} className="inline-flex items-center justify-center gap-1 text-xs font-bold text-rose-500 hover:bg-rose-500/10 px-3 py-2 rounded-xl"><Trash2 className="h-4 w-4" /> ลบรายการ</button>}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
