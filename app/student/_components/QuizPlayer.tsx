"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Award, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import Swal from "sweetalert2";
import { tx, card } from "../../lib/theme";
import { useUser, type Assignment, type QuizQuestion, type StudentSubmission } from "../../context/UserContext";
import { EmptyState } from "../../components/EmptyState";
import { formatThaiDateTime } from "../../lib/date";
import { QuizQuestionRenderer } from "./QuizQuestionRenderer";
import { QuizReviewItem } from "./QuizReviewItem";
import { calculateQuestionScore } from "@/lib/quizScoring";
import { toast } from "@/lib/swal";

interface QuizPlayerProps {
  activeTask: Assignment;
  sub: StudentSubmission | undefined;
  currentQuizQuestionIndex: number;
  setCurrentQuizQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  quizAnswers: Record<number, number | number[] | string | Record<number, number>>;
  setQuizAnswers: React.Dispatch<React.SetStateAction<Record<number, number | number[] | string | Record<number, number>>>>;
  setSelectedAssignmentId: React.Dispatch<React.SetStateAction<string | null>>;
  addSubmission: (submission: StudentSubmission) => void;
  currentUserId: string | null;
  displayName: string;
  activeLessonId?: string | null;
}

function isQuestionAnswered(question: QuizQuestion, answer: unknown): boolean {
  if (answer === undefined || answer === null || answer === -1) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  if (question.questionType === "matching") {
    return typeof answer === "object" && !Array.isArray(answer) && Object.keys(answer).length === question.matchingPairs?.length;
  }
  return true;
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getAutomaticQuestionScore(
  question: QuizQuestion,
  answer: number | number[] | string | Record<number, number> | undefined,
): number | undefined {
  const type = question.questionType || "multiple_choice";
  if (type === "essay" || (type === "fill_blank" && !question.correctAnswer?.trim())) {
    return undefined;
  }
  return calculateQuestionScore(question, answer).score;
}

export function QuizPlayer({
  activeTask,
  sub,
  currentQuizQuestionIndex,
  setCurrentQuizQuestionIndex,
  quizAnswers,
  setQuizAnswers,
  setSelectedAssignmentId,
  addSubmission,
  currentUserId,
  displayName,
  activeLessonId,
}: QuizPlayerProps) {
  const { toggleLessonComplete } = useUser();
  const [nowMs] = React.useState(() => Date.now());
  const quizReviewMode = activeTask.quizReviewMode ?? "full";
  const showScores = activeTask.showScores !== false;
  const questions = useMemo(() => activeTask.questions ?? [], [activeTask.questions]);
  const timeLimitSeconds = Math.max(0, Number(activeTask.timeLimit ?? 0) * 60);
  const isTimedQuiz = timeLimitSeconds > 0;
  const [timerDeadline] = useState(() => Date.now() + timeLimitSeconds * 1000);
  const [remainingSeconds, setRemainingSeconds] = useState(timeLimitSeconds);
  const autoSubmissionStarted = useRef(false);

  const handleBackWithConfirm = async () => {
    const answeredCount = Object.keys(quizAnswers).length;
    if (answeredCount > 0 && !sub) {
      const res = await Swal.fire({
        title: "ออกจากแบบทดสอบ?",
        text: `คุณได้ตอบไปแล้ว ${answeredCount} ข้อ หากออกตอนนี้คำตอบจะไม่ถูกส่ง คุณแน่ใจหรือไม่?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "ออกจากแบบทดสอบ",
        cancelButtonText: "ทำต่อ",
        confirmButtonColor: "#e11d48",
      });
      if (!res.isConfirmed) return;
    }
    setQuizAnswers({});
    setSelectedAssignmentId(null);
  };

  const submitQuiz = useCallback(async (timedOut = false) => {
    let finalScore = 0;
    let hasManualGraded = false;
    const questionScoresList: number[] = [];

    questions.forEach((question, index) => {
      const qType = question.questionType || "multiple_choice";
      if (qType === "essay" || (qType === "fill_blank" && !question.correctAnswer?.trim())) {
        hasManualGraded = true;
      }
      const answer = quizAnswers[index];
      const result = calculateQuestionScore(question, answer);
      questionScoresList.push(result.score);
      finalScore += result.score;
    });

    const submissionAnswers = questions.map((_, index) => quizAnswers[index] !== undefined ? quizAnswers[index] : -1);
    await addSubmission({
      id: Math.random().toString(),
      studentId: currentUserId || "",
      studentName: displayName,
      assignmentId: activeTask.id,
      type: "quiz",
      score: finalScore,
      questionScores: questionScoresList,
      answers: submissionAnswers,
      submittedAt: Date.now(),
    });

    const targetLessonId = activeTask.lessonId || activeLessonId;
    if (targetLessonId) {
      toggleLessonComplete(targetLessonId, true);
    }

    setQuizAnswers({});
    setSelectedAssignmentId(null);

    if (timedOut) {
      await Swal.fire({
        icon: "info",
        title: "หมดเวลาทำแบบทดสอบ",
        text: "ระบบส่งคำตอบที่ทำไว้ให้โดยอัตโนมัติแล้ว",
        confirmButtonColor: "#4f46e5",
      });
    } else if (hasManualGraded) {
      await Swal.fire({
        icon: "info",
        title: "ส่งแบบทดสอบเรียบร้อยแล้ว",
        text: "ระบบบันทึกคำตอบแล้ว โดยข้ออัตนัยจะได้รับการตรวจจากผู้สอนต่อไป",
        confirmButtonColor: "#4f46e5",
      });
    }
  }, [activeLessonId, activeTask.id, activeTask.lessonId, addSubmission, currentUserId, displayName, questions, quizAnswers, setQuizAnswers, setSelectedAssignmentId, toggleLessonComplete]);

  useEffect(() => {
    if (!isTimedQuiz || sub) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000)));
    }, 250);

    return () => window.clearInterval(interval);
  }, [isTimedQuiz, sub, timerDeadline]);

  useEffect(() => {
    if (!isTimedQuiz || sub || remainingSeconds > 0 || autoSubmissionStarted.current) return;

    autoSubmissionStarted.current = true;
    void submitQuiz(true);
  }, [isTimedQuiz, remainingSeconds, sub, submitQuiz]);

  if (sub) {
    // QUIZ REVIEW (SUBMITTED)
    if (quizReviewMode === "none") {
      return (
        <div className="max-w-4xl mx-auto p-8 rounded-3xl border text-center space-y-4 animate-scaleIn" style={card.style}>
          <HelpCircle className="h-12 w-12 text-slate-400 mx-auto" />
          <h4 className="text-lg font-bold" style={{ color: tx.primary }}>
            ผู้สอนไม่เปิดให้ดูผลแบบทดสอบชุดนี้
          </h4>
          <p className="text-xs" style={{ color: tx.muted }}>
            ระบบได้บันทึกคำตอบของคุณเรียบร้อยแล้ว
          </p>
          <button
            type="button"
            onClick={() => setSelectedAssignmentId(null)}
            className="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
          >
            กลับไปยังบทเรียน
          </button>
        </div>
      );
    }

    const totalPts = activeTask.points;
    const scoreGot = sub.score !== undefined && sub.score !== null ? sub.score : 0;
    const isPassing = scoreGot >= (totalPts * 0.5);
    const reviewQuestions = activeTask.questions ?? [];
    const reviewQuestionIndex = Math.min(
      currentQuizQuestionIndex,
      Math.max(0, reviewQuestions.length - 1),
    );
    const reviewQuestion = reviewQuestions[reviewQuestionIndex];
    const reviewStudentAnswer = reviewQuestion
      ? (Array.isArray(sub.answers)
          ? sub.answers[reviewQuestionIndex]
          : (sub.answers as Record<number, number | string | Record<number, number>> | undefined)?.[reviewQuestionIndex])
      : undefined;
    // For student review: prefer saved question_scores from teacher grading
    // If not available, try automatic scoring, but accept undefined for manual-graded questions
    const savedQuestionScore = sub.questionScores?.[reviewQuestionIndex];
    let reviewQuestionScore: number | undefined;

    if (typeof savedQuestionScore === "number" && Number.isFinite(savedQuestionScore)) {
      // Use teacher's graded score if available
      reviewQuestionScore = Number(savedQuestionScore);
    } else if (reviewQuestion) {
      // Try automatic scoring only if the question supports it
      reviewQuestionScore = getAutomaticQuestionScore(reviewQuestion, reviewStudentAnswer);
    } else {
      reviewQuestionScore = undefined;
    }

    return (
      <div className="max-w-4xl mx-auto space-y-6 text-left animate-fadeIn pb-16">
        {/* Top bar */}
        <div
          className="p-5 rounded-3xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedAssignmentId(null)}
              className="p-2.5 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-95"
              style={{ borderColor: tx.border, color: tx.secondary }}
              title="กลับไปยังบทเรียน"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  {quizReviewMode === "answers_only" ? "📋 คำตอบของคุณ" : "🎯 ผลคะแนนและเฉลย"}
                </span>
                <span className="text-xs" style={{ color: tx.muted }}>
                  ส่งเมื่อ {formatThaiDateTime(sub.submittedAt)}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black mt-0.5" style={{ color: tx.primary }}>
                {activeTask.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {showScores && (
              <div className={`px-4 py-2 rounded-2xl border text-center ${
                isPassing
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400"
              }`}>
                <span className="text-[10px] font-bold block uppercase tracking-wider">คะแนนที่ได้</span>
                <span className="text-base sm:text-lg font-black">{scoreGot.toFixed(2)} / {totalPts} คะแนน</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSelectedAssignmentId(null)}
              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              กลับสู่บทเรียน
            </button>
          </div>
        </div>

        {/* Review one question at a time */}
        {reviewQuestion && (
          <>
            <div className="flex items-center justify-between rounded-2xl border px-4 py-3" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                ข้อที่ {reviewQuestionIndex + 1} จาก {reviewQuestions.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentQuizQuestionIndex(Math.max(0, reviewQuestionIndex - 1))}
                  disabled={reviewQuestionIndex === 0}
                  aria-label="ข้อก่อนหน้า"
                  className="flex items-center px-3 py-2 rounded-xl border text-xs font-bold disabled:opacity-30"
                  style={{ borderColor: tx.border, color: tx.secondary }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentQuizQuestionIndex(Math.min(reviewQuestions.length - 1, reviewQuestionIndex + 1))}
                  disabled={reviewQuestionIndex === reviewQuestions.length - 1}
                  aria-label="ข้อถัดไป"
                  className="flex items-center px-3 py-2 rounded-xl border text-xs font-bold disabled:opacity-30"
                  style={{ borderColor: tx.border, color: tx.secondary }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <QuizReviewItem
              question={reviewQuestion}
              questionIndex={reviewQuestionIndex}
              studentAnswer={reviewStudentAnswer}
              showCorrectAnswer={quizReviewMode === "full"}
              showScore={showScores}
              earnedPoints={reviewQuestionScore}
            />
          </>
        )}
      </div>
    );
  }

  // ACTIVE INTERACTIVE QUIZ
  const openAtMs = activeTask.openAt ? new Date(activeTask.openAt).getTime() : null;
  const closeAtMs = activeTask.closeAt ? new Date(activeTask.closeAt).getTime() : null;
  const notOpenYet = openAtMs !== null && nowMs < openAtMs;
  const alreadyClosed = closeAtMs !== null && nowMs > closeAtMs;
  const isOpen = activeTask.isOpen !== false && !notOpenYet && !alreadyClosed;

  if (!isOpen) {
    return (
      <div className="max-w-xl mx-auto p-8 rounded-3xl border text-center space-y-4 animate-scaleIn" style={card.style}>
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h4 className="text-lg font-bold text-rose-500">
          {notOpenYet
            ? `แบบทดสอบนี้จะเปิดให้ทำในวันที่ ${formatThaiDateTime(activeTask.openAt)}`
            : alreadyClosed
              ? `แบบทดสอบนี้หมดเวลาทำแล้ว (ปิดรับส่งเมื่อ ${formatThaiDateTime(activeTask.closeAt)})`
              : "แบบทดสอบนี้ปิดรับการส่งแล้ว"}
        </h4>
        <button
          type="button"
          onClick={() => setSelectedAssignmentId(null)}
          className="btn-primary px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
        >
          กลับไปยังบทเรียน
        </button>
      </div>
    );
  }

  const q = questions[currentQuizQuestionIndex];
  if (!q) return <EmptyState illustration="quiz" variant="compact" accent="purple" title="ไม่มีคำถามในชุดแบบทดสอบนี้" />;
  
  const totalQuestions = questions.length;
  const answeredCount = questions.filter((question, index) => isQuestionAnswered(question, quizAnswers[index])).length;
  const unansweredRequiredIndexes = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question, index }) => question.required !== false && !isQuestionAnswered(question, quizAnswers[index]))
    .map(({ index }) => index);
  const allRequiredAnswered = unansweredRequiredIndexes.length === 0;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  const handleManualSubmit = async () => {
    if (!allRequiredAnswered) {
      toast.warning(`กรุณาตอบข้อบังคับให้ครบ: ข้อ ${unansweredRequiredIndexes.map((index) => index + 1).join(", ")}`);
      return;
    }

    const confirmed = await Swal.fire({
      title: "ยืนยันการส่งคำตอบ",
      text: `ตอบแล้ว ${answeredCount}/${totalQuestions} ข้อ ยืนยันที่จะส่งข้อสอบใช่หรือไม่?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ยืนยันส่งข้อสอบ",
      cancelButtonText: "ตรวจสอบอีกครั้ง",
      confirmButtonColor: "#059669",
    });

    if (confirmed.isConfirmed) {
      await submitQuiz();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left animate-fadeIn pb-16">
      {/* Sticky Top Header Bar */}
      <div
        className="sticky top-0 z-30 p-4 sm:p-5 rounded-3xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md"
        style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackWithConfirm}
            className="p-2.5 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0 active:scale-95"
            style={{ borderColor: tx.border, color: tx.secondary }}
            title="ออกจากแบบทดสอบ"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                📝 ห้องสอบแบบทดสอบ (Quiz Room)
              </span>
              <span className="text-xs font-bold" style={{ color: tx.muted }}>
                ข้อที่ {currentQuizQuestionIndex + 1} จาก {totalQuestions} ข้อ
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-black truncate max-w-md mt-0.5" style={{ color: tx.primary }}>
              {activeTask.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-end sm:self-center">
          {isTimedQuiz && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
              remainingSeconds <= 60
                ? "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-300"
                : "bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800/40 text-purple-600 dark:text-purple-300"
            }`}>
              <Clock className="h-3.5 w-3.5" />
              <span>เหลือ {formatCountdown(remainingSeconds)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold">
            <Award className="h-3.5 w-3.5" />
            <span>เต็ม {activeTask.points} คะแนน</span>
          </div>
        </div>
      </div>

      {/* Quick Jump Navigator Bar */}
      <div
        className="p-3.5 rounded-2xl border shadow-sm flex items-center justify-between gap-2 overflow-hidden"
        style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 scrollbar-none flex-1">
          {questions.map((question, idx) => {
            const isActive = idx === currentQuizQuestionIndex;
            const isAnswered = isQuestionAnswered(question, quizAnswers[idx]);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentQuizQuestionIndex(idx)}
                className={`min-w-[42px] h-9 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 active:scale-95 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-105"
                    : isAnswered
                      ? "border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                      : "border border-slate-200 dark:border-slate-700 bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>ข้อ {idx + 1}{question.required !== false ? " *" : ""}</span>
                {isAnswered && <CheckCircle2 className={`h-3 w-3 ${isActive ? "text-white" : "text-emerald-500"}`} />}
              </button>
            );
          })}
        </div>
        <span className="text-[11px] font-bold text-slate-400 shrink-0 hidden sm:inline-block pl-2">
          ตอบแล้ว {answeredCount}/{totalQuestions}
        </span>
      </div>

      {/* Question Main Card */}
      <div
        className="p-6 sm:p-8 rounded-3xl border shadow-md space-y-6 animate-scaleIn"
        key={currentQuizQuestionIndex}
        style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}
      >
        <div className="flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: tx.borderS }}>
          <div className="space-y-1">
            <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              โจทย์ข้อที่ {currentQuizQuestionIndex + 1}
            </span>
            {q.required !== false && <span className="text-[10px] font-bold text-rose-500">* จำเป็นต้องตอบ</span>}
            <h3 className="font-bold text-base sm:text-lg leading-relaxed pt-2" style={{ color: tx.primary }}>
              {q.question}
            </h3>
          </div>
          <span className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 border border-slate-200 dark:border-slate-700">
            {q.points !== undefined ? q.points : 1} คะแนน
          </span>
        </div>

        <QuizQuestionRenderer
          question={q}
          questionIndex={currentQuizQuestionIndex}
          userAnswer={quizAnswers[currentQuizQuestionIndex]}
          onAnswerChange={(answer) => {
            setQuizAnswers(prev => ({
              ...prev,
              [currentQuizQuestionIndex]: answer,
            }));
          }}
        />
      </div>

      {/* Bottom Action / Submission Bar */}
      <div
        className="p-4 sm:p-5 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4"
        style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}
      >
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={() => setCurrentQuizQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuizQuestionIndex === 0}
            className="px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-30 cursor-pointer active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-800"
            style={{ borderColor: tx.border, color: tx.secondary }}
          >
            <ChevronLeft className="h-4 w-4" /> ข้อก่อนหน้า
          </button>

          {currentQuizQuestionIndex < totalQuestions - 1 && (
            <button
              type="button"
              onClick={() => setCurrentQuizQuestionIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              ข้อถัดไป <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] font-bold text-slate-400 block">
              ความคืบหน้า: {progressPercent}%
            </span>
            <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
              ตอบแล้ว {answeredCount} / {totalQuestions} ข้อ
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualSubmit}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md transition-all cursor-pointer active:scale-95 ${
              allRequiredAnswered
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                : "bg-slate-700 hover:bg-slate-600 opacity-90"
            }`}
          >
            ส่งข้อสอบ {allRequiredAnswered ? "✓" : `(ต้องตอบอีก ${unansweredRequiredIndexes.length} ข้อ)`}
          </button>
        </div>
      </div>
    </div>
  );
}
