import React from "react";
import { X } from "lucide-react";
import { tx } from "../../lib/theme";
import type { Assignment, StudentSubmission } from "../../context/UserContext";

interface QuizReviewModalProps {
  viewingQuizSub: StudentSubmission;
  assignments: Assignment[];
  setViewingQuizSub: (sub: StudentSubmission | null) => void;
}

export function QuizReviewModal({ viewingQuizSub, assignments, setViewingQuizSub }: QuizReviewModalProps) {
  const activeAssignment = assignments.find(a => a.id === viewingQuizSub.assignmentId)!;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
        <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <div>
            <h2 className="text-xl font-bold">ผลการตรวจข้อสอบ: {viewingQuizSub.studentName}</h2>
            <p className="text-xs" style={{ color: tx.muted }}>
              แบบทดสอบ: {activeAssignment.title} · ได้คะแนน {viewingQuizSub.score} / {activeAssignment.questions?.length}
            </p>
          </div>
          <button onClick={() => setViewingQuizSub(null)} className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer">
            <X className="h-5 w-5" style={{ color: tx.secondary }} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-left space-y-4">
          <div className="space-y-4">
            {activeAssignment.questions!.map((q, idx) => {
              const studentAns = viewingQuizSub.answers?.[idx];
              const isCorrect = studentAns === q.correctIndex;
              return (
                <div key={idx} className="p-4 rounded-xl border space-y-2" style={{ borderColor: isCorrect ? "#10b981" : "#f43f5e" }}>
                  <h4 className="font-bold text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                    <span>ข้อที่ {idx + 1}: {q.question}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      isCorrect ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50" : "bg-rose-100 text-rose-700 dark:bg-rose-950/50"
                    }`}>
                      {isCorrect ? "ตอบถูก" : "ตอบผิด"}
                    </span>
                  </h4>
                  <p className="text-xs">
                    นักเรียนตอบ: <span className={isCorrect ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                      {studentAns !== undefined ? q.options[studentAns] : "ไม่ได้ตอบ"}
                    </span>
                  </p>
                  <p className="text-xs" style={{ color: tx.muted }}>
                    คำตอบที่ถูกต้อง: <span className="text-emerald-500 font-bold">{q.options[q.correctIndex]}</span>
                  </p>
                  <div className="p-2.5 rounded-lg border text-xs" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                    <strong>คำอธิบาย:</strong> {q.explanation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <button type="button" onClick={() => setViewingQuizSub(null)} className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md cursor-pointer">
            ปิดหน้าต่างนี้
          </button>
        </div>
      </div>
    </div>
  );
}
