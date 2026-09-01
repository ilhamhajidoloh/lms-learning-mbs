"use client";

import React, { useState } from "react";
import { X, Video, Sparkles, Loader2 } from "lucide-react";
import { tx } from "../lib/theme";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import type { Course } from "../context/UserContext";
import type { LiveClassData } from "./LiveClassCard";
import { Portal } from "./Portal";

interface CreateLiveClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (createdClass: LiveClassData) => void;
  courses: Course[];
  initialCourseId?: string;
}

export function CreateLiveClassModal({
  isOpen,
  onClose,
  onCreated,
  courses,
  initialCourseId = "",
}: CreateLiveClassModalProps) {
  const [courseId, setCourseId] = useState(initialCourseId || (courses[0]?.id ?? ""));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => {
    // Default to tomorrow 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
  });
  const [expectedDurationMin, setExpectedDurationMin] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      toast.warning("กรุณาเลือกคอร์สเรียน");
      return;
    }
    if (!title.trim()) {
      toast.warning("กรุณาระบุหัวข้อการสอนสด");
      return;
    }
    if (!scheduledAt) {
      toast.warning("กรุณาระบุวัน-เวลาที่เริ่มสอน");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await apiFetch<{ liveClass: LiveClassData }>("/api/live-classes", {
        method: "POST",
        body: JSON.stringify({
          course_id: courseId,
          title: title.trim(),
          description: description.trim() || undefined,
          scheduled_at: new Date(scheduledAt).toISOString(),
          duration_minutes: Number(expectedDurationMin) || 60,
        }),
      });

      if (error || !data) {
        throw new Error(error || "สร้างห้องเรียนสดไม่สำเร็จ");
      }

      toast.success("สร้างห้องเรียนสดสำเร็จแล้ว!");
      onCreated(data.liveClass);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error("สร้างห้องเรียนสดไม่สำเร็จ: " + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
        <div
          className="w-full max-w-lg rounded-3xl border shadow-2xl p-6 sm:p-8 space-y-6 animate-scaleIn relative"
          style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}
        >
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-lg">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight" style={{ color: tx.primary }}>
                สร้างห้องเรียนสด (Live Class)
              </h2>
              <p className="text-xs" style={{ color: tx.muted }}>
                กำหนดการสอนสดผ่าน Jitsi Meet แบบไม่มีค่าใช้จ่าย
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Select Course */}
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: tx.secondary }}>
              เลือกวิชา / คอร์สเรียน *
            </label>
            <div className="relative">
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ backgroundColor: tx.elevated, borderColor: tx.border, color: tx.primary }}
              >
                {courses.length === 0 ? (
                  <option value="">ไม่มีคอร์สเรียน</option>
                ) : (
                  courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.levelLabel || c.level})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: tx.secondary }}>
              หัวข้อการสอนสด (Title) *
            </label>
            <input
              type="text"
              placeholder="เช่น Live Class: เฉลยโจทย์เตรียมสอบเข้มข้น EP.1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ backgroundColor: tx.elevated, borderColor: tx.border, color: tx.primary }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: tx.secondary }}>
              รายละเอียดเพิ่มเติม (Description)
            </label>
            <textarea
              rows={2}
              placeholder="รายละเอียดเนื้อหาที่สอนในคาบนี้..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ backgroundColor: tx.elevated, borderColor: tx.border, color: tx.primary }}
            />
          </div>

          {/* Schedule Date & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: tx.secondary }}>
                วันและเวลาที่เริ่มเรียน
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ backgroundColor: tx.elevated, borderColor: tx.border, color: tx.primary }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: tx.secondary }}>
                ระยะเวลา (นาที)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={expectedDurationMin}
                  onChange={(e) => setExpectedDurationMin(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ backgroundColor: tx.elevated, borderColor: tx.border, color: tx.primary }}
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              style={{ borderColor: tx.borderS, color: tx.secondary }}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังสร้างห้อง...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  สร้างห้องเรียนสด
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}

export default CreateLiveClassModal;

