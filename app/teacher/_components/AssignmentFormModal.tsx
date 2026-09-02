import React, { type FormEvent } from "react";
import { X } from "lucide-react";
import { tx } from "../../lib/theme";
import type { Lesson } from "../../context/UserContext";
import { Portal } from "@/app/components/Portal";

interface AssignmentFormModalProps {
  setShowForm: (show: boolean) => void;
  lessons: Lesson[];
  assignLessonId: string;
  setAssignLessonId: (v: string) => void;
  assignTitle: string;
  setAssignTitle: (v: string) => void;
  assignPoints: number;
  setAssignPoints: (v: number) => void;
  assignDueDate: string;
  setAssignDueDate: (v: string) => void;
  assignInstructions: string;
  setAssignInstructions: (v: string) => void;
  handleCreateAssignment: (e: FormEvent) => void;
}

export function AssignmentFormModal({
  setShowForm,
  lessons,
  assignLessonId,
  setAssignLessonId,
  assignTitle,
  setAssignTitle,
  assignPoints,
  setAssignPoints,
  assignDueDate,
  setAssignDueDate,
  assignInstructions,
  setAssignInstructions,
  handleCreateAssignment,
}: AssignmentFormModalProps) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
        <div className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
        <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <h2 className="text-xl font-bold">สร้างงานส่งไฟล์ใหม่</h2>
          <button type="button" onClick={() => setShowForm(false)} className="btn-icon p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer">
            <X className="h-5 w-5" style={{ color: tx.secondary }} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 text-left space-y-6">
          <form id="createAssignmentForm" onSubmit={handleCreateAssignment} className="space-y-6">

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>หัวข้อบทเรียน</label>
              {lessons.length > 0 ? (
                <select
                  value={assignLessonId}
                  onChange={(e) => setAssignLessonId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: tx.border, color: tx.primary }}
                >
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {lesson.title}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  ยังไม่มีหัวข้อบทเรียนในคอร์สนี้ กรุณาเพิ่มบทเรียนก่อนสร้างงาน
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>หัวข้อการสั่งงาน</label>
              <input type="text" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} placeholder="เช่น การบ้านบทที่ 1" />
            </div>

            {/* Points & Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>คะแนนเต็ม (Points)</label>
                <input type="number" min={1} value={assignPoints} onChange={(e) => setAssignPoints(Number(e.target.value))} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>กำหนดส่งงาน (Due Date)</label>
                <input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
              </div>
            </div>

            <div className="space-y-1 animate-fadeIn">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>คำชี้แจงโจทย์การบ้าน</label>
              <textarea value={assignInstructions} onChange={(e) => setAssignInstructions(e.target.value)} required rows={4} className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} placeholder="ระบุสิ่งที่นักเรียนต้องทำ พร้อมรายละเอียดการส่งไฟล์..." />
            </div>
          </form>
        </div>

        <div className="p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <button type="button" onClick={() => setShowForm(false)} className="btn-cancel py-2.5 px-4 rounded-xl font-bold text-xs cursor-pointer">
            ยกเลิก
          </button>
          <button type="submit" form="createAssignmentForm" disabled={lessons.length === 0} className="btn-primary py-2.5 px-5 rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50">
            เผยแพร่งานสู่คอร์สเรียน
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
