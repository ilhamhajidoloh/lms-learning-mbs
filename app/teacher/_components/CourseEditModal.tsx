"use client";

import React, { useState } from "react";
import { Check, X } from "lucide-react";
import { Portal } from "@/app/components/Portal";
import { tx } from "../../lib/theme";
import type { Course, CourseLevelOption } from "../../context/UserContext";

interface CourseEditModalProps {
  course: Course;
  levels: CourseLevelOption[];
  onClose: () => void;
  updateCourseDetails: (id: string, data: Pick<Course, "title" | "description" | "level" | "levelLabel" | "gradientClass">) => Promise<{ success: boolean; error?: string }>;
}

export function CourseEditModal({ course, levels, onClose, updateCourseDetails }: CourseEditModalProps) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description || "");
  const [level, setLevel] = useState(course.level);
  const [gradientClass, setGradientClass] = useState(course.gradientClass);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedLevel = levels.find((item) => item.value === level);
    if (!title.trim() || !selectedLevel) {
      setError("กรุณากรอกชื่อคอร์สและเลือกระดับชั้นเรียน");
      return;
    }
    setSaving(true);
    setError("");
    const result = await updateCourseDetails(course.id, {
      title: title.trim(),
      description: description.trim(),
      level: selectedLevel.value,
      levelLabel: selectedLevel.label,
      gradientClass,
    });
    setSaving(false);
    if (result.success) onClose();
    else setError(result.error || "ไม่สามารถบันทึกข้อมูลได้");
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md">
        <div className="w-full max-w-2xl rounded-3xl shadow-2xl border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
          <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: tx.borderS }}>
            <h2 className="text-xl font-bold">แก้ไขรายละเอียดคอร์ส</h2>
            <button type="button" onClick={onClose} disabled={saving} className="btn-icon p-2 rounded-xl cursor-pointer">
              <X className="h-5 w-5" style={{ color: tx.secondary }} />
            </button>
          </div>
          <form onSubmit={save} className="p-6 space-y-5">
            {error && <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-bold">{error}</div>}
            <div className="space-y-1">
              <label className="text-xs font-bold" style={{ color: tx.muted }}>ชื่อคอร์สเรียน</label>
              <input value={title} onChange={(event) => setTitle(event.target.value)} required className="w-full px-4 py-3 rounded-xl border bg-transparent text-sm" style={{ borderColor: tx.border }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold" style={{ color: tx.muted }}>รายละเอียดคอร์ส</label>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full px-4 py-3 rounded-xl border bg-transparent text-sm" style={{ borderColor: tx.border }} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <select value={level} onChange={(event) => setLevel(event.target.value)} required className="w-full px-4 py-3 rounded-xl border bg-transparent text-sm" style={{ borderColor: tx.border }}>
                {levels.map((item) => <option key={item.id} value={item.value}>{item.label}</option>)}
              </select>
              <select value={gradientClass} onChange={(event) => setGradientClass(event.target.value)} className="w-full px-4 py-3 rounded-xl border bg-transparent text-sm" style={{ borderColor: tx.border }}>
                <option value="from-indigo-600 to-purple-600">Indigo-Purple</option>
                <option value="from-blue-600 to-cyan-500">Blue-Cyan</option>
                <option value="from-emerald-500 to-teal-500">Emerald-Teal</option>
                <option value="from-rose-500 to-pink-500">Rose-Pink</option>
                <option value="from-amber-500 to-orange-500">Amber-Orange</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={saving} className="btn-cancel px-5 py-2.5 rounded-xl text-sm font-bold">ยกเลิก</button>
              <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
                <Check className="h-4 w-4" /> {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
