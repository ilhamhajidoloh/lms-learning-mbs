import React from "react";
import { X, BookOpen } from "lucide-react";
import { tx } from "../../lib/theme";
import type { Course } from "../../context/UserContext";
import { Portal } from "@/app/components/Portal";

interface CourseEnrollSettingsModalProps {
  selectedCourse: Course;
  setShowEnrollSettingsModal: (show: boolean) => void;
  updateCourseSettings: (
    courseId: string,
    isOpen: boolean,
    enrollCode: string | null,
    showScores?: boolean,
    sequentialLessons?: boolean,
    quizReviewMode?: "full" | "answers_only" | "none"
  ) => Promise<{ success: boolean; error?: string }>;
}

const QUIZ_REVIEW_OPTIONS: { value: "full" | "answers_only" | "none"; label: string; desc: string }[] = [
  { value: "full", label: "เปิดเฉลยเต็มรูปแบบ (Full Review)", desc: "นักเรียนเห็นคำตอบของตนเอง + เฉลยที่ถูกต้อง + คำอธิบาย" },
  { value: "answers_only", label: "แสดงเฉพาะคำตอบของนักเรียน", desc: "นักเรียนเห็นเฉพาะคำตอบที่ตนเองเลือก โดยไม่มีเฉลยหรือคำอธิบาย" },
  { value: "none", label: "ปิดดูผล (ไม่แสดงอะไร)", desc: "นักเรียนไม่สามารถดูผลลัพธ์หรือเฉลยใดๆ ได้ (ปุ่ม 'ดูผลคะแนน & เฉลย' จะถูกซ่อน)" },
];

export function CourseEnrollSettingsModal({ selectedCourse, setShowEnrollSettingsModal, updateCourseSettings }: CourseEnrollSettingsModalProps) {
  const currentMode = selectedCourse.quizReviewMode ?? "full";

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
        <div className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
        <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <h2 className="text-xl font-bold">การตั้งค่าสิทธิ์และการเรียนรู้ของคอร์ส</h2>
          <button onClick={() => setShowEnrollSettingsModal(false)} className="btn-icon p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer">
            <X className="h-5 w-5" style={{ color: tx.secondary }} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 text-left space-y-6">
          {/* Section 1: Enrollment */}
          <div className="space-y-4 border-b pb-4" style={{ borderColor: tx.borderS }}>
            <h3 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">1. การเข้าเรียนและการลงทะเบียน</h3>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                เปิดลงทะเบียนเสรีโดยตรง (Open Enrollment)
              </label>
              <input
                type="checkbox"
                checked={!!selectedCourse.isOpen}
                onChange={async (e) => {
                  await updateCourseSettings(selectedCourse.id, e.target.checked, selectedCourse.enrollCode || null, selectedCourse.showScores, selectedCourse.sequentialLessons, currentMode);
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
                      await updateCourseSettings(selectedCourse.id, false, val || null, selectedCourse.showScores, selectedCourse.sequentialLessons, currentMode);
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      await updateCourseSettings(selectedCourse.id, false, val || null, selectedCourse.showScores, selectedCourse.sequentialLessons, currentMode);
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

          {/* Section 2: Score & Progression */}
          <div className="space-y-4 border-b pb-4" style={{ borderColor: tx.borderS }}>
            <h3 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">2. การแสดงผลคะแนนและการเรียนรู้</h3>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold block" style={{ color: tx.primary }}>
                  เปิดแสดงคะแนนให้นักเรียนเห็น (Show Scores to Students)
                </label>
                <p className="text-[10px]" style={{ color: tx.muted }}>
                  หากปิด นักเรียนจะเห็นสถานะ &ldquo;ส่งแล้ว (รอประกาศคะแนน)&rdquo; โดยไม่แสดงตัวเลขคะแนน
                </p>
              </div>
              <input
                type="checkbox"
                checked={selectedCourse.showScores !== false}
                onChange={async (e) => {
                  await updateCourseSettings(selectedCourse.id, !!selectedCourse.isOpen, selectedCourse.enrollCode || null, e.target.checked, selectedCourse.sequentialLessons, currentMode);
                }}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold block" style={{ color: tx.primary }}>
                  บังคับเรียนตามลำดับ (Sequential Progression Lock)
                </label>
                <p className="text-[10px]" style={{ color: tx.muted }}>
                  ล็อกบทเรียนถัดไป 🔒 นักเรียนจะเข้าเรียนได้ต่อเมื่อทำการบ้าน/ควิซในบทเรียนก่อนหน้าสำเร็จแล้วเท่านั้น
                </p>
              </div>
              <input
                type="checkbox"
                checked={!!selectedCourse.sequentialLessons}
                onChange={async (e) => {
                  await updateCourseSettings(selectedCourse.id, !!selectedCourse.isOpen, selectedCourse.enrollCode || null, selectedCourse.showScores, e.target.checked, currentMode);
                }}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer shrink-0"
              />
            </div>
          </div>

          {/* Section 3: Quiz Review Mode */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-500" />
              <h3 className="font-extrabold text-sm text-purple-600 dark:text-purple-400">3. การแสดงผลเฉลย Quiz หลังส่ง</h3>
            </div>
            <p className="text-[10px]" style={{ color: tx.muted }}>
              กำหนดว่านักเรียนจะเห็นอะไรได้บ้างหลังจากส่งข้อสอบ Quiz เรียบร้อยแล้ว
            </p>
            <div className="space-y-2">
              {QUIZ_REVIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={async () => {
                    if (opt.value !== currentMode) {
                      await updateCourseSettings(selectedCourse.id, !!selectedCourse.isOpen, selectedCourse.enrollCode || null, selectedCourse.showScores, selectedCourse.sequentialLessons, opt.value);
                    }
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all active:scale-[0.99] cursor-pointer ${
                    currentMode === opt.value
                      ? "border-purple-500 bg-purple-500/10 dark:bg-purple-950/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                  style={currentMode !== opt.value ? { borderColor: tx.borderS } : {}}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      currentMode === opt.value ? "border-purple-500 bg-purple-500" : "border-slate-300 dark:border-slate-600"
                    }`}>
                      {currentMode === opt.value && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <div>
                      <p className={`text-xs font-bold ${currentMode === opt.value ? "text-purple-600 dark:text-purple-400" : ""}`} style={currentMode === opt.value ? {} : { color: tx.primary }}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: tx.muted }}>{opt.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
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
    </Portal>
  );
}
