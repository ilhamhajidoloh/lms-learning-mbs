import React, { type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { tx } from "../../lib/theme";
import type { CourseLevelOption } from "../../context/UserContext";
import { Portal } from "@/app/components/Portal";

interface CourseCreationModalProps {
  setShowCourseForm: (show: boolean) => void;
  courseTitle: string;
  setCourseTitle: (v: string) => void;
  courseDesc: string;
  setCourseDesc: (v: string) => void;
  courseLevelValue: string;
  setCourseLevelValue: (v: string) => void;
  levels: CourseLevelOption[];
  courseGradient: string;
  setCourseGradient: (v: string) => void;
  courseSaving: boolean;
  courseError: string;
  handleCreateCourse: (e: FormEvent) => void;
}

export function CourseCreationModal({
  setShowCourseForm,
  courseTitle,
  setCourseTitle,
  courseDesc,
  setCourseDesc,
  courseLevelValue,
  setCourseLevelValue,
  levels,
  courseGradient,
  setCourseGradient,
  courseSaving,
  courseError,
  handleCreateCourse,
}: CourseCreationModalProps) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
        <div className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
        <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <h2 className="text-xl font-bold">สร้างคอร์สเรียนใหม่</h2>
          <button onClick={() => setShowCourseForm(false)} className="btn-icon p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer">
            <X className="h-5 w-5" style={{ color: tx.secondary }} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 text-left space-y-5">
          <form id="createCourseForm" onSubmit={handleCreateCourse} className="space-y-5">
            {courseError && (
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-bold border border-rose-500/20">
                {courseError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ชื่อคอร์สเรียน <span className="text-rose-500">*</span></label>
              <input type="text" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} placeholder="เช่น แคลคูลัส 101 สำหรับ ม.ปลาย" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>รายละเอียดคอร์ส</label>
              <textarea value={courseDesc} onChange={(e) => setCourseDesc(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} placeholder="อธิบายเนื้อหาและจุดประสงค์ของคอร์สนี้..." />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ระดับชั้นเรียน <span className="text-rose-500">*</span></label>
              {levels.length === 0 ? (
                <p className="text-xs p-3 rounded-xl bg-amber-500/10 text-amber-600 font-bold">
                  ยังไม่มีระดับชั้นเรียนในระบบ กรุณาแจ้งแอดมินให้เพิ่มระดับก่อนสร้างคอร์ส
                </p>
              ) : (
                <select value={courseLevelValue} onChange={(e) => setCourseLevelValue(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }}>
                  <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">-- เลือกระดับชั้นเรียน --</option>
                  {levels.map((lvl) => (
                    <option key={lvl.id} value={lvl.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {lvl.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>สไตล์สี (Gradient)</label>
              <select value={courseGradient} onChange={(e) => setCourseGradient(e.target.value)} className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }}>
                <option value="from-indigo-600 to-purple-600" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Indigo-Purple (ม่วง/น้ำเงิน)</option>
                <option value="from-blue-600 to-cyan-500" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Blue-Cyan (ฟ้า/น้ำเงิน)</option>
                <option value="from-emerald-500 to-teal-500" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Emerald-Teal (เขียว)</option>
                <option value="from-rose-500 to-pink-500" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Rose-Pink (ชมพู/แดง)</option>
                <option value="from-amber-500 to-orange-500" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Amber-Orange (ส้ม/เหลือง)</option>
              </select>
            </div>

            {/* Preview Card */}
            <div className="space-y-1 mt-4">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ตัวอย่างการ์ดคอร์สเรียน</label>
              <div className={`h-24 w-full rounded-2xl bg-gradient-to-tr ${courseGradient} flex flex-col justify-between p-4 relative overflow-hidden shadow-inner`}>
                <div className="absolute inset-0 bg-white/5 opacity-50" />
                <h3 className="font-extrabold text-white text-lg drop-shadow-md relative z-10">{courseTitle || "ชื่อคอร์สเรียน"}</h3>
              </div>
            </div>
          </form>
        </div>
        <div className="p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <button type="button" onClick={() => setShowCourseForm(false)} disabled={courseSaving} className="btn-cancel px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
            ยกเลิก
          </button>
          <button type="submit" form="createCourseForm" disabled={courseSaving || levels.length === 0} className="btn-primary px-6 py-2.5 rounded-xl text-sm shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer">
            {courseSaving ? "กำลังบันทึก..." : <><Plus className="h-4 w-4" /> ยืนยันการสร้างคอร์ส</>}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
