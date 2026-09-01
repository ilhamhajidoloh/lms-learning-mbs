import React from "react";
import { X, Award } from "lucide-react";
import { tx } from "../../lib/theme";
import { useUser, type Assignment, type StudentSubmission } from "../../context/UserContext";
import { QuizReviewItem } from "../../student/_components/QuizReviewItem";
import Swal from "sweetalert2";
import { Portal } from "@/app/components/Portal";

interface QuizReviewModalProps {
  viewingQuizSub: StudentSubmission;
  assignments: Assignment[];
  setViewingQuizSub: (sub: StudentSubmission | null) => void;
}

export function QuizReviewModal({ viewingQuizSub, assignments, setViewingQuizSub }: QuizReviewModalProps) {
  const { gradeSubmission } = useUser();
  const activeAssignment = assignments.find(a => a.id === viewingQuizSub.assignmentId);

  if (!activeAssignment) return null;

  const maxPoints = activeAssignment.points;

  const handleEditScore = async () => {
    const { value: inputScore } = await Swal.fire({
      title: "ให้คะแนน / ปรับคะแนนข้อสอบ",
      input: "number",
      inputLabel: `ระบุคะแนนที่ต้องการให้สำหรับ ${viewingQuizSub.studentName} (เต็ม ${maxPoints} คะแนน)`,
      inputValue: viewingQuizSub.score ?? 0,
      showCancelButton: true,
      confirmButtonText: "บันทึกคะแนน",
      cancelButtonText: "ยกเลิก",
      inputValidator: (value) => {
        if (value === "" || value === null || value === undefined) {
          return "กรุณาระบุคะแนน!";
        }
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > maxPoints) {
          return `คะแนนต้องอยู่ระหว่าง 0 ถึง ${maxPoints}`;
        }
        return null;
      },
    });

    if (inputScore !== undefined && inputScore !== null && inputScore !== "") {
      const res = await gradeSubmission(viewingQuizSub.id, Number(inputScore));
      if (res.success) {
        setViewingQuizSub({ ...viewingQuizSub, score: Number(inputScore) });
      }
    }
  };
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
        <div className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
          <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
            <div>
              <h2 className="text-xl font-bold">ผลการตรวจข้อสอบ: {viewingQuizSub.studentName}</h2>
              <p className="text-xs mt-0.5" style={{ color: tx.muted }}>
                แบบทดสอบ: {activeAssignment.title} · ได้คะแนน{" "}
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {viewingQuizSub.score !== undefined && viewingQuizSub.score !== null ? viewingQuizSub.score.toFixed(2) : "-"}
                </span>{" "}
                / {maxPoints} คะแนน
              </p>
            </div>
            <button onClick={() => setViewingQuizSub(null)} className="btn-icon p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer">
              <X className="h-5 w-5" style={{ color: tx.secondary }} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 text-left space-y-4">
            <div className="space-y-4">
              {activeAssignment.questions?.map((q, idx) => {
                const studentAns = Array.isArray(viewingQuizSub.answers)
                  ? viewingQuizSub.answers[idx]
                  : (viewingQuizSub.answers as Record<number, number | string | Record<number, number>> | undefined)?.[idx];
                return (
                  <QuizReviewItem
                    key={idx}
                    question={q}
                    questionIndex={idx}
                    studentAnswer={studentAns}
                    showCorrectAnswer={true}
                    showScore={true}
                    earnedPoints={viewingQuizSub.questionScores?.[idx]}
                    isTeacher={true}
                  />
                );
              })}
            </div>
          </div>

          <div className="p-4 sm:p-6 border-t flex flex-wrap items-center justify-between gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
            <button
              type="button"
              onClick={handleEditScore}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Award className="h-4 w-4" />
              <span>ปรับคะแนน / ให้คะแนนชุดนี้ ({(viewingQuizSub.score ?? 0).toFixed(2)}/{maxPoints} คะแนน)</span>
            </button>

            <button type="button" onClick={() => setViewingQuizSub(null)} className="btn-secondary py-2.5 px-6 rounded-xl text-xs sm:text-sm font-bold shadow-sm cursor-pointer">
              ปิดหน้าต่างตรวจคำตอบ
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
