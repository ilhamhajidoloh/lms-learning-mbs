import React, { type FormEvent } from "react";
import { X, Trash2 } from "lucide-react";
import { tx } from "../../lib/theme";
import type { Lesson, QuizQuestion } from "../../context/UserContext";

interface AssignmentFormModalProps {
  setShowForm: (show: boolean) => void;
  lessons: Lesson[];
  assignLessonId: string;
  setAssignLessonId: (v: string) => void;
  assignType: "file" | "quiz";
  setAssignType: (type: "file" | "quiz") => void;
  assignTitle: string;
  setAssignTitle: (v: string) => void;
  assignPoints: number;
  setAssignPoints: (v: number) => void;
  assignDueDate: string;
  setAssignDueDate: (v: string) => void;
  assignInstructions: string;
  setAssignInstructions: (v: string) => void;
  assignTimeLimit: number;
  setAssignTimeLimit: (v: number) => void;
  quizQuestions: QuizQuestion[];
  handleCreateAssignment: (e: FormEvent) => void;
  handleAddQuestion: () => void;
  handleRemoveQuestion: (index: number) => void;
  handleUpdateQuestionText: (index: number, val: string) => void;
  handleUpdateOptionText: (qIndex: number, optIndex: number, val: string) => void;
  handleUpdateCorrectIndex: (qIndex: number, val: number) => void;
  handleUpdateExplanation: (qIndex: number, val: string) => void;
}

export function AssignmentFormModal({
  setShowForm,
  lessons,
  assignLessonId,
  setAssignLessonId,
  assignType,
  setAssignType,
  assignTitle,
  setAssignTitle,
  assignPoints,
  setAssignPoints,
  assignDueDate,
  setAssignDueDate,
  assignInstructions,
  setAssignInstructions,
  assignTimeLimit,
  setAssignTimeLimit,
  quizQuestions,
  handleCreateAssignment,
  handleAddQuestion,
  handleRemoveQuestion,
  handleUpdateQuestionText,
  handleUpdateOptionText,
  handleUpdateCorrectIndex,
  handleUpdateExplanation,
}: AssignmentFormModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
        <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <h2 className="text-xl font-bold">สร้างงาน / ควิซใหม่</h2>
          <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer">
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

            {/* Type Select */}
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => setAssignType("file")} className="py-3 px-4 rounded-xl border text-center font-bold text-sm transition-all cursor-pointer animate-fadeIn"
                style={assignType === "file" ? { borderColor: tx.accent, color: tx.accent, backgroundColor: tx.accentBg } : { borderColor: tx.borderS, color: tx.secondary }}>
                แบบส่งไฟล์ (File Submission)
              </button>
              <button type="button" onClick={() => setAssignType("quiz")} className="py-3 px-4 rounded-xl border text-center font-bold text-sm transition-all cursor-pointer animate-fadeIn"
                style={assignType === "quiz" ? { borderColor: tx.accent, color: tx.accent, backgroundColor: tx.accentBg } : { borderColor: tx.borderS, color: tx.secondary }}>
                แบบทดสอบตอบคำถาม (Quiz)
              </button>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>หัวข้อการสั่งงาน / แบบทดสอบ</label>
              <input type="text" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} placeholder="เช่น การบ้านบทที่ 1 หรือ ควิซย่อยความต่อเนื่อง" />
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

            {/* Render Sub Form based on type */}
            {assignType === "file" ? (
              <div className="space-y-1 animate-fadeIn">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>คำชี้แจงโจทย์การบ้าน</label>
                <textarea value={assignInstructions} onChange={(e) => setAssignInstructions(e.target.value)} required rows={4} className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} placeholder="ระบุสิ่งที่นักเรียนต้องทำ พร้อมรายละเอียดการส่งไฟล์..." />
              </div>
            ) : (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>จำกัดเวลาในการทำควิซ (นาที)</label>
                  <input type="number" min={1} value={assignTimeLimit} onChange={(e) => setAssignTimeLimit(Number(e.target.value))} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: tx.borderS }}>
                    <label className="text-sm font-bold uppercase tracking-wider" style={{ color: tx.secondary }}>ตั้งโจทย์แบบทดสอบ ({quizQuestions.length} ข้อ)</label>
                    <button type="button" onClick={handleAddQuestion} className="text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline">
                      + เพิ่มข้อสอบใหม่
                    </button>
                  </div>

                  {quizQuestions.map((q, idx) => (
                    <div key={idx} className="p-5 rounded-2xl border space-y-4 text-left" style={{ borderColor: tx.borderS }}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400">ข้อสอบข้อที่ {idx + 1}</span>
                        {quizQuestions.length > 1 && (
                          <button type="button" onClick={() => handleRemoveQuestion(idx)} className="text-xs text-rose-500 font-bold hover:underline flex items-center gap-1">
                            <Trash2 className="h-4 w-4" /> ลบข้อสอบข้อนี้
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold" style={{ color: tx.muted }}>โจทย์ข้อสอบ</label>
                        <input type="text" value={q.question} onChange={(e) => handleUpdateQuestionText(idx, e.target.value)} required className="w-full px-3 py-2 rounded-xl border bg-transparent text-xs" style={{ borderColor: tx.border, color: tx.primary }} placeholder="เช่น lim(x->2) (x-2) มีค่าเท่ากับเท่าใด?" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="space-y-1">
                            <label className="text-[10px] font-bold" style={{ color: tx.muted }}>ตัวเลือก {oIdx + 1} ({String.fromCharCode(65 + oIdx)})</label>
                            <input type="text" value={opt} onChange={(e) => handleUpdateOptionText(idx, oIdx, e.target.value)} required className="w-full px-3 py-2 rounded-xl border bg-transparent text-xs" style={{ borderColor: tx.border, color: tx.primary }} placeholder={`ตัวเลือก ${oIdx + 1}`} />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold" style={{ color: tx.muted }}>เฉลยตัวเลือกที่ถูกต้อง</label>
                          <select value={q.correctIndex} onChange={(e) => handleUpdateCorrectIndex(idx, Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border bg-transparent text-xs" style={{ borderColor: tx.border, color: tx.primary }}>
                            {q.options.map((_, oIdx) => (
                              <option key={oIdx} value={oIdx}>ตัวเลือกที่ {oIdx + 1} ({String.fromCharCode(65 + oIdx)})</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold" style={{ color: tx.muted }}>คำเฉลยอธิบายเพิ่มเติม</label>
                          <input type="text" value={q.explanation} onChange={(e) => handleUpdateExplanation(idx, e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-transparent text-xs" style={{ borderColor: tx.border, color: tx.primary }} placeholder="เช่น เพราะต้องหาลิมิตซ้ายขวา..." />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <button type="button" onClick={() => setShowForm(false)} className="py-2.5 px-4 rounded-xl border font-bold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" style={{ borderColor: tx.borderS, color: tx.secondary }}>
            ยกเลิก
          </button>
          <button type="submit" form="createAssignmentForm" disabled={lessons.length === 0} className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50">
            เผยแพร่งานสู่คอร์สเรียน
          </button>
        </div>
      </div>
    </div>
  );
}
