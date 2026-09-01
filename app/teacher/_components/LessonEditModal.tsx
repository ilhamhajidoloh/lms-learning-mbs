import React from "react";
import { X, Video } from "lucide-react";
import { tx } from "../../lib/theme";
import type { Lesson } from "../../context/UserContext";
import { Portal } from "@/app/components/Portal";

interface LessonEditModalProps {
  editingLesson: Lesson;
  setEditingLesson: (lesson: Lesson | null) => void;
  editLessonTitle: string;
  setEditLessonTitle: (v: string) => void;
  editLessonDescription: string;
  setEditLessonDescription: (v: string) => void;
  editLessonVideoUrl: string;
  setEditLessonVideoUrl: (v: string) => void;
  updateLesson: (lesson: Lesson) => void;
}

export function LessonEditModal({
  editingLesson,
  setEditingLesson,
  editLessonTitle,
  setEditLessonTitle,
  editLessonDescription,
  setEditLessonDescription,
  editLessonVideoUrl,
  setEditLessonVideoUrl,
  updateLesson,
}: LessonEditModalProps) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
        <div className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
        <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <h3 className="text-xl font-bold">แก้ไขรายละเอียดหัวข้อเรียน</h3>
          <button
            type="button"
            onClick={() => setEditingLesson(null)}
            className="btn-icon p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-left space-y-4">
          <form
            id="editLessonForm"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editLessonTitle.trim()) return;
              updateLesson({
                ...editingLesson,
                title: editLessonTitle,
                description: editLessonDescription,
                videoUrl: editLessonVideoUrl.trim() || undefined
              });
              setEditingLesson(null);
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>หัวข้อบทเรียน</label>
              <input
                type="text"
                value={editLessonTitle}
                onChange={(e) => setEditLessonTitle(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                style={{ borderColor: tx.border, color: tx.primary }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>รายละเอียด / คำอธิบายบทเรียน</label>
              <textarea
                value={editLessonDescription}
                onChange={(e) => setEditLessonDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                style={{ borderColor: tx.border, color: tx.primary }}
                placeholder="ระบุคำอธิบายย่อยสำหรับบทเรียนนี้..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: tx.muted }}>
                <Video className="h-3.5 w-3.5 text-red-500" />
                ลิงก์วิดีโอ YouTube (ไม่บังคับ)
              </label>
              <input
                type="url"
                value={editLessonVideoUrl}
                onChange={(e) => setEditLessonVideoUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 bg-transparent text-sm"
                style={{ borderColor: tx.border, color: tx.primary }}
                placeholder="https://www.youtube.com/watch?v=xxxxx"
              />
              <p className="text-[10px]" style={{ color: tx.faint }}>วางลิงก์ YouTube เพื่อให้นักเรียนสามารถดูวิดีโอได้ในเว็บโดยไม่ต้องไปหน้า YouTube</p>
            </div>
          </form>
        </div>

        <div className="p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <button
            type="button"
            onClick={() => setEditingLesson(null)}
            className="btn-cancel py-2.5 px-5 rounded-xl font-bold text-sm cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            form="editLessonForm"
            className="btn-primary py-2.5 px-6 rounded-xl text-sm shadow-md cursor-pointer"
          >
            บันทึกการแก้ไข
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
