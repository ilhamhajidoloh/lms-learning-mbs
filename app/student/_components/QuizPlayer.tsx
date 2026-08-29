import React from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Swal from "sweetalert2";
import { tx } from "../../lib/theme";
import { useUser, type Assignment, type StudentSubmission } from "../../context/UserContext";
import { EmptyState } from "../../components/EmptyState";

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
  activeLessonId?: string | null;
}

export function QuizPlayer({
  activeTask, sub, currentQuizQuestionIndex, setCurrentQuizQuestionIndex, quizAnswers, setQuizAnswers,
  setSelectedAssignmentId, addSubmission, currentUserId, displayName, activeLessonId,
}: QuizPlayerProps) {
  const { toggleLessonComplete } = useUser();
  const quizReviewMode = activeTask.quizReviewMode ?? "full";
  const showScores = activeTask.showScores !== false;

  if (sub) {
    // QUIZ REVIEW (SUBMITTED) - quizReviewMode controls what is shown
    // "none" mode: this panel should never be opened (button is hidden in TaskListPanel)
    // but guard here just in case
    if (quizReviewMode === "none") {
      return (
        <div className="p-4 rounded-xl border text-center space-y-2 animate-scaleIn" style={{ borderColor: tx.borderS }}>
          <p className="text-sm font-bold" style={{ color: tx.muted }}>ผู้สอนไม่เปิดให้ดูผลควิซนี้</p>
          <button onClick={() => setSelectedAssignmentId(null)} className="text-xs text-indigo-500 hover:underline font-bold active:scale-95 transition-transform">ย้อนกลับ</button>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-xl border space-y-4 animate-scaleIn" style={{ borderColor: tx.borderS }}>
        <div className="flex justify-between items-center">
          <h5 className="font-bold text-sm">
            {quizReviewMode === "answers_only" ? "คำตอบของคุณ:" : "เฉลยและผลคะแนน:"} {activeTask.title}
          </h5>
          <button onClick={() => setSelectedAssignmentId(null)} className="text-xs text-rose-500 hover:underline font-bold active:scale-95 transition-transform">ย้อนกลับ</button>
        </div>

        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 text-left">
          {activeTask.questions?.map((q, idx) => {
            const studentAns = sub.answers?.[idx];
            const isCorrect = studentAns === q.correctIndex;
            const showCorrectAnswer = quizReviewMode === "full";

            // Border color: full mode - green/red by correctness; answers_only - neutral
            const borderColor = showCorrectAnswer ? (isCorrect ? "#10b981" : "#f43f5e") : undefined;

            return (
              <div key={idx}
                className={`p-3.5 rounded-xl border text-xs space-y-2 animate-slideInUp stagger-${Math.min(idx + 1, 6)}`}
                style={{ borderColor: borderColor ?? tx.borderS }}
              >
                <h6 className="font-bold">ข้อที่ {idx + 1}: {q.question}</h6>
                <p className={
                  showCorrectAnswer
                    ? (isCorrect ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold")
                    : "font-semibold"
                } style={!showCorrectAnswer ? { color: tx.secondary } : {}}>
                  คำตอบของคุณ: {studentAns !== undefined ? q.options[studentAns as number] : "ไม่ได้ตอบ"}
                </p>
                {showCorrectAnswer && (
                  <p className="text-emerald-500">คำตอบที่ถูก: {q.options[q.correctIndex]}</p>
                )}
                {showCorrectAnswer && q.explanation && (
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
  const nowMs = Date.now();
  const openAtMs = activeTask.openAt ? new Date(activeTask.openAt).getTime() : null;
  const closeAtMs = activeTask.closeAt ? new Date(activeTask.closeAt).getTime() : null;
  const notOpenYet = openAtMs !== null && nowMs < openAtMs;
  const alreadyClosed = closeAtMs !== null && nowMs > closeAtMs;
  const isOpen = activeTask.isOpen !== false && !notOpenYet && !alreadyClosed;

  if (!isOpen) {
    return (
      <div className="p-4 rounded-xl border text-center space-y-2 animate-scaleIn" style={{ borderColor: tx.borderS }}>
        <p className="text-sm font-bold text-rose-500">
          {notOpenYet ? `ข้อสอบนี้จะเปิดให้ทำในวันที่ ${new Date(activeTask.openAt!).toLocaleString("th-TH")}` : "แบบทดสอบนี้ปิดรับการส่งแล้ว"}
        </p>
        <button onClick={() => setSelectedAssignmentId(null)} className="text-xs text-indigo-500 hover:underline font-bold active:scale-95 transition-transform">ย้อนกลับ</button>
      </div>
    );
  }

  const q = activeTask.questions?.[currentQuizQuestionIndex];
  if (!q) return <EmptyState illustration="quiz" variant="compact" accent="purple" title="ไม่มีคำถามในชุดแบบทดสอบนี้" />;
  const chosenIndex = quizAnswers[currentQuizQuestionIndex];
  const totalQuestions = activeTask.questions!.length;
  const answeredCount = Object.keys(quizAnswers).length;
  const allAnswered = answeredCount === totalQuestions;

  return (
    <div className="p-5 rounded-2xl border space-y-5 animate-fadeIn" style={{ borderColor: tx.borderS }}>
      {/* Header with progress dots */}
      <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: tx.borderS }}>
        <span className="text-xs font-bold text-indigo-500">แบบทดสอบ: {activeTask.title}</span>
        <span className="text-xs font-extrabold" style={{ color: tx.muted }}>ข้อที่ {currentQuizQuestionIndex + 1} / {totalQuestions}</span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5">
        {activeTask.questions!.map((_, idx) => {
          const isCurrent = idx === currentQuizQuestionIndex;
          const isAnswered = quizAnswers[idx] !== undefined;
          return (
            <button key={idx} onClick={() => setCurrentQuizQuestionIndex(idx)}
              className={`rounded-full transition-all duration-300 ${
                isCurrent
                  ? "w-6 h-2 bg-indigo-500"
                  : isAnswered
                    ? "w-2 h-2 bg-indigo-400 dark:bg-indigo-500"
                    : "w-2 h-2 bg-slate-300 dark:bg-slate-600"
              }`}
              title={`ข้อที่ ${idx + 1}${isAnswered ? " (ตอบแล้ว)" : ""}`}
            />
          );
        })}
      </div>

      <div className="space-y-4 animate-scaleIn" key={currentQuizQuestionIndex}>
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
                className={`w-full text-left p-3 rounded-xl border text-xs font-bold flex items-center justify-between active:scale-[0.98] ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 animate-borderGlow shadow-sm"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                } transition-all duration-200`}
              >
                <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                {isSelected && (
                  <div className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 animate-scaleIn">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: tx.borderS }}>
        <button
          disabled={currentQuizQuestionIndex === 0}
          onClick={() => setCurrentQuizQuestionIndex(prev => prev - 1)}
          className="flex items-center gap-1 px-4 py-2 border rounded-xl font-bold text-xs transition-all disabled:opacity-30 cursor-pointer active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-800"
          style={{ borderColor: tx.borderS, color: tx.secondary }}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> ข้อก่อนหน้า
        </button>

        {currentQuizQuestionIndex < totalQuestions - 1 ? (
          <button
            onClick={() => setCurrentQuizQuestionIndex(prev => prev + 1)}
            className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all hover:shadow-lg active:scale-95"
          >
            ข้อถัดไป <ChevronRight className="h-3.5 w-3.5" />
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

                const targetLessonId = activeTask.lessonId || activeLessonId;
                if (targetLessonId) {
                  toggleLessonComplete(targetLessonId, true);
                }

                setQuizAnswers({});
                setSelectedAssignmentId(null);
              }
            }}
            className={`px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-all hover:shadow-lg active:scale-95 ${!allAnswered ? "animate-pulseGlow" : ""}`}
          >
            ส่งข้อสอบ {allAnswered ? "" : `(${answeredCount}/${totalQuestions})`}
          </button>
        )}
      </div>
    </div>
  );
}
