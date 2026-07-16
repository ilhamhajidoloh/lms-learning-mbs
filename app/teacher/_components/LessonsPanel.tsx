import React from "react";
import { Plus, Video } from "lucide-react";
import { tx, card } from "../../lib/theme";
import type { Lesson } from "../../context/UserContext";

interface LessonsPanelProps {
  lessons: Lesson[];
  courseId: string;
  setShowAddLessonModal: (show: boolean) => void;
  setEditingLesson: (lesson: Lesson | null) => void;
  setEditLessonTitle: (v: string) => void;
  setEditLessonDescription: (v: string) => void;
  setEditLessonVideoUrl: (v: string) => void;
}

export function LessonsPanel({
  lessons,
  courseId,
  setShowAddLessonModal,
  setEditingLesson,
  setEditLessonTitle,
  setEditLessonDescription,
  setEditLessonVideoUrl,
}: LessonsPanelProps) {
  return (
    <div className="rounded-3xl p-6 shadow-sm border space-y-4" style={card.style}>
      <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: tx.borderS }}>
        <div>
          <h3 className="font-bold text-lg">โครงสร้างบทเรียนหลักสูตร</h3>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            {lessons.filter(l => l.courseId === courseId).length} บทเรียน
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowAddLessonModal(true)}
          className="btn-primary px-4 py-2 text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> เพิ่มบทเรียนใหม่
        </button>
      </div>


      <div className="space-y-3">
        {lessons.filter(l => l.courseId === courseId).map((l) => (
          <div key={l.id} className="p-5 rounded-2xl border text-left flex flex-col sm:flex-row justify-between sm:items-start gap-4 transition-all" style={{ borderColor: tx.borderS }}>
            <div className="space-y-1.5 flex-1 min-w-0">
              <h4 className="font-bold text-sm sm:text-base text-indigo-600 dark:text-indigo-400">{l.title}</h4>
              <p className="text-xs leading-relaxed max-w-2xl" style={{ color: tx.muted }}>{l.description}</p>
              {l.videoUrl && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Video className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <span className="text-[10px] font-mono truncate max-w-[300px]" style={{ color: tx.faint }}>{l.videoUrl}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingLesson(l);
                setEditLessonTitle(l.title);
                setEditLessonDescription(l.description);
                setEditLessonVideoUrl(l.videoUrl || "");
              }}
              className="py-1.5 px-3 rounded-lg border border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/10 font-bold text-xs transition-all shrink-0 cursor-pointer self-start sm:self-center btn-press"
            >
              แก้ไขรายละเอียด
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
