import React from "react";
import { X } from "lucide-react";
import { tx } from "../../lib/theme";
import type { AppUser, Enrollment } from "../../context/UserContext";

interface AddStudentModalProps {
  setShowAddStudentModal: (show: boolean) => void;
  chosenStudentId: string;
  setChosenStudentId: (v: string) => void;
  appUsers: AppUser[];
  enrollments: Enrollment[];
  selectedCourseId: string | null;
  teacherAddStudent: (courseId: string, studentId: string) => Promise<{ success: boolean; error?: string }>;
}

export function AddStudentModal({
  setShowAddStudentModal,
  chosenStudentId,
  setChosenStudentId,
  appUsers,
  enrollments,
  selectedCourseId,
  teacherAddStudent,
}: AddStudentModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
        <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <h2 className="text-xl font-bold">ดึงนักเรียนเข้าคอร์สเรียน</h2>
          <button onClick={() => { setShowAddStudentModal(false); setChosenStudentId(""); }} className="btn-icon p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer">
            <X className="h-5 w-5" style={{ color: tx.secondary }} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 text-left space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>เลือกนักเรียนที่ต้องการดึงเข้าเรียน</label>
            <select
              value={chosenStudentId}
              onChange={(e) => setChosenStudentId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
              style={{ borderColor: tx.borderS, color: tx.primary }}
            >
              <option value="" style={{ color: "var(--text-primary)", backgroundColor: "var(--bg-surface)" }}>-- เลือกผู้เรียน --</option>
              {appUsers.filter(u =>
                u.role === "student" &&
                !enrollments.filter(enroll => enroll.courseId === selectedCourseId).some(enroll => enroll.studentId === u.id)
              ).map(s => (
                <option key={s.id} value={s.id} style={{ color: "var(--text-primary)", backgroundColor: "var(--bg-surface)" }}>
                  {s.displayName} ({s.username})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <button type="button" onClick={() => { setShowAddStudentModal(false); setChosenStudentId(""); }} className="btn-cancel px-5 py-2.5 rounded-xl text-sm font-bold">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!chosenStudentId}
            onClick={async () => {
              if (chosenStudentId && selectedCourseId) {
                  const res = await teacherAddStudent(selectedCourseId, chosenStudentId);
                  if (res.success) {
                    setChosenStudentId("");
                    setShowAddStudentModal(false);
                  }
              }
            }}
            className="btn-primary px-6 py-2.5 rounded-xl text-sm shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            ยืนยันการดึงเข้าวิชา
          </button>
        </div>
      </div>
    </div>
  );
}
