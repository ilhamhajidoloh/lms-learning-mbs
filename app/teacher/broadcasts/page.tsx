"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Radio, Square, Video, ArrowLeft } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import LoadingScreen from "@/app/components/LoadingScreen";

interface BroadcastLesson {
  lesson_id: string;
  lesson_title: string;
  course_id: string;
  course_title: string;
  is_live: boolean;
}

export default function TeacherBroadcastsPage() {
  const { isAuthenticated, loadingData, role } = useUser();
  const [broadcasts, setBroadcasts] = useState<BroadcastLesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeBroadcast = broadcasts.find((broadcast) => broadcast.is_live);
  const selectedLesson = broadcasts.find((broadcast) => broadcast.lesson_id === selectedLessonId);
  const courses = useMemo(() => Array.from(new Map(broadcasts.map((item) => [item.course_id, item.course_title])).entries()), [broadcasts]);
  const [courseId, setCourseId] = useState("");
  const visibleLessons = broadcasts.filter((item) => !courseId || item.course_id === courseId);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await apiFetch<{ broadcasts: BroadcastLesson[] }>("/api/lesson-live");
    if (error) toast.error(error);
    setBroadcasts(data?.broadcasts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || (role !== "teacher" && role !== "admin")) return;
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [isAuthenticated, load, role]);

  const changeLiveStatus = async (isLive: boolean) => {
    const lessonId = isLive ? selectedLessonId : activeBroadcast?.lesson_id;
    if (!lessonId) return;
    setSaving(true);
    const { error } = await apiFetch("/api/lesson-live", {
      method: "PUT",
      body: JSON.stringify({ lessonId, isLive }),
    });
    setSaving(false);
    if (error) return toast.error(error);
    toast.success(isLive ? "เปิดสถานะถ่ายทอดสดแล้ว — จากนั้นกด Start Streaming ใน OBS" : "ปิดสถานะถ่ายทอดสดแล้ว");
    await load();
  };

  if (loadingData || loading) return <LoadingScreen />;
  if (!isAuthenticated || (role !== "teacher" && role !== "admin")) return null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-4 sm:p-8">
      <Link href="/teacher" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> กลับหน้าผู้สอน
      </Link>
      <header className="space-y-2">
        <div className="flex items-center gap-3"><Video className="h-7 w-7 text-red-500" /><h1 className="text-2xl font-black">OBS ถ่ายทอดสดตามบทเรียน</h1></div>
        <p className="text-sm text-slate-500">เลือกบทเรียนก่อนเริ่ม OBS นักเรียนจะเห็นไลฟ์เฉพาะบทที่เลือกเท่านั้น</p>
      </header>

      {activeBroadcast ? (
        <section className="rounded-2xl border border-red-400/40 bg-red-50 p-5 dark:bg-red-950/20">
          <p className="flex items-center gap-2 font-extrabold text-red-600"><Radio className="h-5 w-5 animate-pulse" /> กำลังถ่ายทอดสด</p>
          <p className="mt-2 font-semibold">{activeBroadcast.course_title}: {activeBroadcast.lesson_title}</p>
          <button disabled={saving} onClick={() => changeLiveStatus(false)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            <Square className="h-4 w-4" /> ปิดสถานะไลฟ์
          </button>
          <p className="mt-3 text-xs text-slate-500">เมื่อจบคาบ ให้กด Stop Streaming ใน OBS ด้วย เพื่อหยุดส่งภาพไป YouTube</p>
        </section>
      ) : (
        <section className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900">
          <h2 className="font-extrabold">เลือกบทเรียนที่จะถ่ายทอดสด</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select value={courseId} onChange={(event) => { setCourseId(event.target.value); setSelectedLessonId(""); }} className="rounded-xl border p-3 text-sm dark:bg-slate-950">
              <option value="">เลือกคอร์ส</option>
              {courses.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
            <select value={selectedLessonId} onChange={(event) => setSelectedLessonId(event.target.value)} disabled={!courseId} className="rounded-xl border p-3 text-sm disabled:opacity-50 dark:bg-slate-950">
              <option value="">เลือกบทเรียน</option>
              {visibleLessons.map((item) => <option key={item.lesson_id} value={item.lesson_id}>{item.lesson_title}</option>)}
            </select>
          </div>
          <button disabled={!selectedLesson || saving} onClick={() => changeLiveStatus(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            <Radio className="h-4 w-4" /> เปิดสถานะไลฟ์สำหรับบทนี้
          </button>
        </section>
      )}

      <ol className="list-decimal space-y-2 rounded-2xl bg-slate-100 p-6 pl-10 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <li>เลือกบทเรียนและกดเปิดสถานะไลฟ์</li>
        <li>เปิด OBS แล้วกด <strong>Start Streaming</strong></li>
        <li>เมื่อจบ กด <strong>Stop Streaming</strong> ใน OBS แล้วกลับมากดปิดสถานะไลฟ์</li>
      </ol>
    </main>
  );
}
