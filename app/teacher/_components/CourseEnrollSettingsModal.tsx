import React from "react";
import { X } from "lucide-react";
import { tx } from "../../lib/theme";
import type { Course } from "../../context/UserContext";

interface CourseEnrollSettingsModalProps {
  selectedCourse: Course;
  setShowEnrollSettingsModal: (show: boolean) => void;
  updateCourseSettings: (courseId: string, isOpen: boolean, enrollCode: string | null) => Promise<{ success: boolean; error?: string }>;
}

export function CourseEnrollSettingsModal({ selectedCourse, setShowEnrollSettingsModal, updateCourseSettings }: CourseEnrollSettingsModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
        <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <h2 className="text-xl font-bold">การตั้งค่าสิทธิ์การเข้าเรียน</h2>
          <button onClick={() => setShowEnrollSettingsModal(false)} className="btn-icon p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer">
            <X className="h-5 w-5" style={{ color: tx.secondary }} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 text-left space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                เปิดลงทะเบียนเสรีโดยตรง (Open Enrollment)
              </label>
              <input
                type="checkbox"
                checked={!!selectedCourse.isOpen}
                onChange={async (e) => {
                  await updateCourseSettings(selectedCourse.id, e.target.checked, selectedCourse.enrollCode || null);
                }}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
              />
            </div>

            {!selectedCourse.isOpen && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                  รหัสลงทะเบียนเข้าเรียน (Enrollment Code)
                </label>
                <input
                  type="text"
                  defaultValue={selectedCourse.enrollCode || ""}
                  placeholder="ตั้งค่ารหัสลงทะเบียน (เช่น MATH101)..."
                  onBlur={async (e) => {
                    const val = e.target.value.trim();
                    if (val !== (selectedCourse.enrollCode || "")) {
                        await updateCourseSettings(selectedCourse.id, false, val || null);
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        await updateCourseSettings(selectedCourse.id, false, val || null);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent"
                  style={{ borderColor: tx.borderS, color: tx.primary }}
                />
                <p className="text-[9px]" style={{ color: tx.faint }}>
                  * กด Enter หรือคลิกนอกช่องเพื่อบันทึกรหัส (หากเว้นว่างไว้ วิชาจะเป็นแบบส่วนตัว)
                </p>
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-500/20 text-[11px] text-indigo-700 dark:text-indigo-300 space-y-1.5 leading-relaxed">
            <p className="font-bold">💡 โหมดการลงทะเบียนเรียน:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Open:</strong> นักเรียนสามารถลงเรียนได้ทันทีด้วยตนเอง</li>
              <li><strong>Code:</strong> นักเรียนลงเรียนโดยกรอกรหัสจากครูผู้สอน</li>
              <li><strong>Private:</strong> ซ่อนไม่ให้เห็น ค้นหาไม่ได้ ครูเพิ่มให้รายบุคคลเท่านั้น</li>
            </ul>
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <button onClick={() => setShowEnrollSettingsModal(false)} className="btn-primary px-6 py-2.5 rounded-xl text-sm shadow-md cursor-pointer">
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
}
