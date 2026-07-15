import React from "react";
import { Check } from "lucide-react";
import Swal from "sweetalert2";
import { tx } from "../../lib/theme";
import type { Assignment, StudentSubmission } from "../../context/UserContext";

interface QuizPlayerProps {
  activeTask: Assignment;
  sub: StudentSubmission | undefined;
  currentQuizQuestionIndex: number;
  setCurrentQuizQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  quizAnswers: Record<number, number>;
  setQuizAnswers: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setSelectedAssignmentId: React.Dispatch<React.SetStateAction<string | null>>;
  addSubmission: (submission: StudentSubmission) => void;
  currentUserId: string | null;
  displayName: string;
}

export function QuizPlayer({
  activeTask, sub, currentQuizQuestionIndex, setCurrentQuizQuestionIndex, quizAnswers, setQuizAnswers,
  setSelectedAssignmentId, addSubmission, currentUserId, displayName,
}: QuizPlayerProps) {
  if (sub) {
    // QUIZ REVIEW (SUBMITTED)
    return (
      <div className="p-4 rounded-xl border space-y-4 animate-fadeIn" style={{ borderColor: tx.borderS }}>
        <div className="flex justify-between items-center">
          <div>
            <h5 className="font-bold text-sm">ผลลัพธ์คำตอบควิซ: {activeTask.title}</h5>
            <p className="text-[10px]" style={{ color: tx.muted }}>ได้คะแนน {sub.score} / {activeTask.questions?.length} ข้อ</p>
          </div>
          <button onClick={() => setSelectedAssignmentId(null)} className="text-xs text-rose-500 hover:underline font-bold">ย้อนกลับ</button>
        </div>

        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 text-left">
          {activeTask.questions?.map((q, idx) => {
            const studentAns = sub.answers?.[idx];
            const isCorrect = studentAns === q.correctIndex;
            return (
              <div key={idx} className="p-3.5 rounded-xl border text-xs space-y-2" style={{ borderColor: isCorrect ? "#10b981" : "#f43f5e" }}>
                <h6 className="font-bold">ข้อที่ {idx + 1}: {q.question}</h6>
                <p className={isCorrect ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>
                  คุณตอบ: {studentAns !== undefined ? q.options[studentAns] : "ไม่ได้ตอบ"}
                </p>
                <p className="text-emerald-500">คำตอบที่ถูก: {q.options[q.correctIndex]}</p>
                {q.explanation && (
                  <div className="p-2.5 rounded-lg border text-[11px]" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                    <strong>อธิบาย:</strong> {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ACTIVE INTERACTIVE QUIZ
  const q = activeTask.questions?.[currentQuizQuestionIndex];
  if (!q) return <p className="text-xs text-slate-400">ไม่มีคำถามในชุดแบบทดสอบนี้</p>;
  const chosenIndex = quizAnswers[currentQuizQuestionIndex];

  return (
    <div className="p-5 rounded-2xl border space-y-5 animate-fadeIn" style={{ borderColor: tx.borderS }}>
      <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: tx.borderS }}>
        <span className="text-xs font-bold text-indigo-500">แบบทดสอบ: {activeTask.title}</span>
        <span className="text-xs font-extrabold" style={{ color: tx.muted }}>ข้อที่ {currentQuizQuestionIndex + 1} / {activeTask.questions?.length}</span>
      </div>

      <div className="space-y-4">
        <h5 className="font-bold text-sm">{q.question}</h5>

        <div className="grid grid-cols-1 gap-2.5">
          {q.options.map((opt, oIdx) => {
            const isSelected = chosenIndex === oIdx;
            return (
              <button
                key={oIdx}
                onClick={() => {
                  setQuizAnswers(prev => ({
                    ...prev,
                    [currentQuizQuestionIndex]: oIdx
                  }));
                }}
                className="w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between"
                style={isSelected
                  ? { borderColor: tx.accent, backgroundColor: tx.accentBg, color: tx.accent }
                  : { borderColor: tx.borderS, color: tx.secondary }}
              >
                <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: tx.borderS }}>
        <button
          disabled={currentQuizQuestionIndex === 0}
          onClick={() => setCurrentQuizQuestionIndex(prev => prev - 1)}
          className="px-4 py-2 border rounded-xl font-bold text-xs transition-colors disabled:opacity-30 cursor-pointer"
          style={{ borderColor: tx.borderS, color: tx.secondary }}
        >
          ข้อก่อนหน้า
        </button>

        {currentQuizQuestionIndex < activeTask.questions!.length - 1 ? (
          <button
            onClick={() => setCurrentQuizQuestionIndex(prev => prev + 1)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-transform"
          >
            ข้อถัดไป
          </button>
        ) : (
          <button
            onClick={async () => {
              const confirmed = await Swal.fire({
                title: "ยืนยันการส่งคำตอบ",
                text: "คุณกรอกคำตอบครบและยืนยันที่จะส่งข้อสอบใช่หรือไม่?",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "ส่งข้อสอบ",
                cancelButtonText: "ตรวจสอบอีกครั้ง"
              });
              if (confirmed.isConfirmed) {
                // Calculate score
                let finalScore = 0;
                activeTask.questions!.forEach((question, idx) => {
                  if (quizAnswers[idx] === question.correctIndex) {
                    finalScore++;
                  }
                });

                const submissionAnswers = activeTask.questions!.map((_, idx) => quizAnswers[idx] !== undefined ? quizAnswers[idx] : -1);

                await addSubmission({
                  id: Math.random().toString(),
                  studentId: currentUserId || "",
                  studentName: displayName,
                  assignmentId: activeTask.id,
                  type: "quiz",
                  score: finalScore,
                  answers: submissionAnswers,
                  submittedAt: Date.now()
                });

                setQuizAnswers({});
                setSelectedAssignmentId(null);
              }
            }}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-transform"
          >
            ส่งข้อสอบ
          </button>
        )}
      </div>
    </div>
  );
}
