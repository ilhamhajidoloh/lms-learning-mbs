"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, Clock3, Loader2, MessageSquare, UserRound } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatThaiDateTime, isoToLocalInput } from "@/app/lib/date";
import { tx } from "@/app/lib/theme";
import { ModalShell } from "./ModalShell";
import { type PrivateLessonRequest } from "./PrivateLessonBookingCard";

function selectedSlotsFor(request: PrivateLessonRequest) {
  if (request.requested_slots?.length > 0) return [...request.requested_slots].sort();
  return [isoToLocalInput(request.requested_at).slice(11, 16)];
}

function summarizeSlots(slots: string[]) {
  const minutes = slots.map((slot) => {
    const [hours, slotMinutes] = slot.split(":").map(Number);
    return hours * 60 + slotMinutes;
  });
  const ranges: { start: number; end: number }[] = [];
  for (const minute of minutes) {
    const previous = ranges.at(-1);
    if (previous && minute === previous.end) previous.end += 10;
    else ranges.push({ start: minute, end: minute + 10 });
  }
  const format = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  return { ranges: ranges.map((range) => `${format(range.start)}–${format(range.end)}`), totalMinutes: slots.length * 10 };
}

export function PrivateLessonRequestsPanel({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [requests, setRequests] = useState<PrivateLessonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PrivateLessonRequest | null>(null);
  const [confirmedAt, setConfirmedAt] = useState("");
  const [teacherNote, setTeacherNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    const { data, error: fetchError } = await apiFetch<{ privateLessonRequests: PrivateLessonRequest[] }>(`/api/private-lesson-requests?courseId=${encodeURIComponent(courseId)}`);
    if (fetchError) setError(fetchError);
    else setRequests(data?.privateLessonRequests ?? []);
    setLoading(false);
  }, [courseId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRequests(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  const openRequest = (request: PrivateLessonRequest) => {
    setSelected(request);
    setConfirmedAt(isoToLocalInput(request.requested_at));
    setTeacherNote(request.teacher_note || "");
    setError(null);
  };

  const respond = async (action: "accepted" | "declined") => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await apiFetch("/api/private-lesson-requests", {
      method: "PATCH",
      body: JSON.stringify({ id: selected.id, action, confirmedAt: confirmedAt ? new Date(confirmedAt).toISOString() : null, teacherNote }),
    });
    setSaving(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    setSelected(null);
    await loadRequests();
  };

  const pending = requests.filter((request) => request.status === "pending");
  const latest = requests.filter((request) => request.status !== "pending").slice(0, 3);

  return (
    <section className="rounded-3xl border p-5 sm:p-6 space-y-4 animate-slideInUp" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center"><CalendarCheck2 className="h-5 w-5" /></div><div><h2 className="font-extrabold">คิวสอนตัวต่อตัว</h2><p className="text-xs" style={{ color: tx.muted }}>รายวิชา {courseTitle} · ตรวจคำขอและยืนยันเวลานัดหมาย</p></div></div>
        {pending.length > 0 && <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 text-xs font-bold">รอตอบ {pending.length} รายการ</span>}
      </div>

      {loading ? <div className="flex items-center gap-2 text-xs" style={{ color: tx.muted }}><Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดคำขอ...</div>
        : pending.length === 0 ? <p className="text-xs" style={{ color: tx.muted }}>ยังไม่มีคำขอที่รอการตอบรับ</p>
        : <div className="space-y-3">{pending.map((request) => <div key={request.id} className="rounded-2xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}><div className="space-y-1"><p className="font-bold text-sm"><UserRound className="h-4 w-4 inline mr-1 text-violet-500" />{request.student_name} <span className="font-normal" style={{ color: tx.muted }}>· {request.course_title}</span></p><p className="text-xs" style={{ color: tx.secondary }}><Clock3 className="h-3.5 w-3.5 inline mr-1" />ขอเวลา {formatThaiDateTime(request.requested_at)} · {request.duration_minutes} นาที</p>{request.requested_slots?.length > 0 && <p className="text-xs" style={{ color: tx.muted }}>บล็อกเวลาที่เลือก: {request.requested_slots.join(", ")}</p>}{request.message && <p className="text-xs" style={{ color: tx.muted }}><MessageSquare className="h-3.5 w-3.5 inline mr-1" />{request.message}</p>}</div><button type="button" onClick={() => openRequest(request)} className="btn-primary shrink-0 px-4 py-2.5 text-xs">จัดการคำขอ</button></div>)}</div>}

      {latest.length > 0 && <div className="border-t pt-3 space-y-2" style={{ borderColor: tx.borderS }}>{latest.map((request) => <p key={request.id} className="text-xs" style={{ color: tx.muted }}>{request.student_name} · {request.course_title} · {request.status === "accepted" ? "ยืนยันแล้ว" : request.status === "declined" ? "ปฏิเสธแล้ว" : "ยกเลิกแล้ว"}</p>)}</div>}

      {selected && <ModalShell onClose={() => setSelected(null)} title="ตอบรับคำขอสอนตัวต่อตัว" subtitle={`${selected.student_name} · ${selected.course_title}`} maxWidth="max-w-lg" footer={<><button type="button" disabled={saving} onClick={() => void respond("declined")} className="btn-cancel px-4 py-2.5 text-xs">ไม่สะดวก</button><button type="button" disabled={saving} onClick={() => void respond("accepted")} className="btn-primary px-4 py-2.5 text-xs">{saving ? "กำลังบันทึก..." : "ยืนยันนัดหมาย"}</button></>}>
        {(() => {
          const summary = summarizeSlots(selectedSlotsFor(selected));
          return <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
            <p className="text-xs font-bold">เวลาที่นักเรียนขอ</p>
            <p className="text-xs" style={{ color: tx.secondary }}>{formatThaiDateTime(selected.requested_at)}</p>
            <div className="flex flex-wrap gap-1.5">{summary.ranges.map((range) => <span key={range} className="rounded-lg bg-violet-500/10 px-2 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">{range}</span>)}</div>
            <p className="text-[11px]" style={{ color: tx.muted }}>รวม {summary.totalMinutes} นาที · ช่วงที่เว้นไว้จะไม่นับรวม</p>
          </div>;
        })()}
        <label className="block text-xs font-bold space-y-1.5"><span>ยืนยันวันและเวลา</span><input required type="datetime-local" value={confirmedAt} onChange={(event) => setConfirmedAt(event.target.value)} className="w-full rounded-xl border px-3 py-2.5 bg-transparent" style={{ borderColor: tx.borderS }} /></label>
        <label className="block text-xs font-bold space-y-1.5"><span>ข้อความถึงนักเรียน (ไม่บังคับ)</span><textarea maxLength={1000} rows={3} value={teacherNote} onChange={(event) => setTeacherNote(event.target.value)} placeholder="เช่น พบกันในห้องเรียนสดตามเวลานี้" className="w-full rounded-xl border px-3 py-2.5 bg-transparent resize-none" style={{ borderColor: tx.borderS }} /></label>
        {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
      </ModalShell>}
    </section>
  );
}
