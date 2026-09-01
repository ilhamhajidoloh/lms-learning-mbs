"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Award, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import LoadingScreen from "../../components/LoadingScreen";
import { QuizReviewItem } from "../../student/_components/QuizReviewItem";
import { useUser, type QuizQuestion } from "../../context/UserContext";
import { tx } from "../../lib/theme";
import { TeacherHeader } from "./TeacherHeader";

function automaticQuestionScore(
  question: QuizQuestion,
  answer: number | string | Record<number, number> | undefined,
): number {
  const points = Number(question.points ?? 1);
  const type = question.questionType ?? "multiple_choice";

  if (type === "multiple_choice") {
    return typeof answer === "number" && answer === question.correctIndex ? points : 0;
  }
  if (type === "fill_blank" && question.correctAnswer?.trim()) {
    return typeof answer === "string" && answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
      ? points
      : 0;
  }
  if (type === "matching" && question.matchingPairs && typeof answer === "object" && answer !== null && !Array.isArray(answer)) {
    return question.matchingPairs.every((_, index) => answer[index] === index) ? points : 0;
  }
  return 0;
}

export function QuizReviewPage({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const { role, isAuthenticated, loadingData, assignments, submissions, gradeSubmission, displayName, logout, darkMode, toggleDarkMode } = useUser();
  const [questionScoreOverrides, setQuestionScoreOverrides] = useState<Record<string, Record<number, number>>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const submission = submissions.find((item) => item.id === submissionId);
  const assignment = submission ? assignments.find((item) => item.id === submission.assignmentId) : undefined;
  const questions = useMemo(() => assignment?.questions ?? [], [assignment]);

  useEffect(() => {
    if (!loadingData && (!isAuthenticated || role !== "teacher")) {
      router.replace("/login");
    }
  }, [isAuthenticated, loadingData, role, router]);

  const questionScores = useMemo(() => {
    if (!submission || questions.length === 0) return [];

    const savedScores = submission.questionScores?.length === questions.length
      ? submission.questionScores
      : questions.map((question, index) => {
          const answer = Array.isArray(submission.answers)
            ? submission.answers[index]
            : submission.answers?.[index];
          return automaticQuestionScore(question, answer);
        });
    const overrides = questionScoreOverrides[submission.id] ?? {};

    return savedScores.map((score, index) => overrides[index] ?? score);
  }, [questionScoreOverrides, questions, submission]);

  const totalScore = useMemo(
    () => questionScores.reduce((sum, score) => sum + (Number.isFinite(score) ? score : 0), 0),
    [questionScores],
  );

  const updateQuestionScore = (index: number, rawValue: string) => {
    if (!submission) return;
    const maximum = Number(questions[index]?.points ?? 1);
    const nextScore = rawValue === "" ? 0 : Number(rawValue);
    const score = Math.min(maximum, Math.max(0, Number.isFinite(nextScore) ? nextScore : 0));
    setQuestionScoreOverrides((current) => ({
      ...current,
      [submission.id]: {
        ...current[submission.id],
        [index]: score,
      },
    }));
  };

  const saveScores = async () => {
    if (!submission || questionScores.length !== questions.length) return;
    setIsSaving(true);
    const result = await gradeSubmission(submission.id, totalScore, questionScores);
    setIsSaving(false);
    if (result.success) router.refresh();
  };

  if (loadingData) return <LoadingScreen />;
  if (!isAuthenticated || role !== "teacher") return null;

  if (!submission || !assignment || submission.type !== "quiz" || questions.length === 0) {
    return (
      <main className="min-h-screen grid place-items-center px-4" style={{ backgroundColor: tx.base, color: tx.primary }}>
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold">ไม่พบแบบทดสอบที่ต้องการตรวจ</h1>
          <button onClick={() => router.push("/teacher")} className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer">กลับหน้าผู้สอน</button>
        </div>
      </main>
    );
  }

  const questionIndex = Math.min(currentQuestionIndex, questions.length - 1);
  const question = questions[questionIndex];
  const studentAnswer = Array.isArray(submission.answers)
    ? submission.answers[questionIndex]
    : submission.answers?.[questionIndex];
  const maximum = Number(question.points ?? 1);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>
      <TeacherHeader
        tab="courses"
        setTab={() => router.push("/teacher")}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        displayName={displayName}
        logout={logout}
        router={router}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-bold hover:text-indigo-500 transition-colors cursor-pointer">
              <ArrowLeft className="h-4 w-4" /> กลับไปรายการส่งงาน
            </button>
            <div>
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">ตรวจคำตอบรายข้อ</p>
              <h1 className="text-2xl font-black mt-1">{assignment.title}</h1>
              <p className="text-sm mt-1" style={{ color: tx.muted }}>นักเรียน: {submission.studentName}</p>
            </div>
          </div>

          <div className="rounded-2xl border px-5 py-3 text-right min-w-44" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: tx.muted }}>คะแนนรวม</p>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{totalScore} <span className="text-sm">/ {assignment.points}</span></p>
          </div>
        </div>

        <div className="rounded-3xl border p-4 sm:p-6" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-5 w-5 text-indigo-500" />
            <h2 className="font-bold">กำหนดคะแนนแต่ละข้อ</h2>
          </div>
          <p className="text-xs" style={{ color: tx.muted }}>ปรับคะแนนในแต่ละข้อได้ตั้งแต่ 0 ถึงคะแนนเต็มของข้อนั้น ระบบจะรวมคะแนนให้โดยอัตโนมัติ</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border px-4 py-3" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">ข้อที่ {questionIndex + 1} จาก {questions.length}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))}
                disabled={questionIndex === 0}
                className="flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-30"
                style={{ borderColor: tx.borderS, color: tx.secondary }}
              >
                <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
              </button>
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}
                disabled={questionIndex === questions.length - 1}
                className="flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-30"
                style={{ borderColor: tx.borderS, color: tx.secondary }}
              >
                ถัดไป <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <section key={questionIndex} className="rounded-3xl border p-4 sm:p-5 space-y-4" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
            <QuizReviewItem
              question={question}
              questionIndex={questionIndex}
              studentAnswer={studentAnswer}
              showCorrectAnswer={true}
              isTeacher={true}
            />
            <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
              <label htmlFor={`question-score-${questionIndex}`} className="text-sm font-bold">คะแนนข้อ {questionIndex + 1} <span style={{ color: tx.muted }}>(เต็ม {maximum})</span></label>
              <div className="flex items-center gap-2">
                <input
                  id={`question-score-${questionIndex}`}
                  type="number"
                  min="0"
                  max={maximum}
                  step="0.01"
                  value={questionScores[questionIndex] ?? 0}
                  onChange={(event) => updateQuestionScore(questionIndex, event.target.value)}
                  className="w-24 rounded-lg border bg-white dark:bg-slate-900 px-3 py-2 text-right text-sm font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ borderColor: tx.borderS, color: tx.primary }}
                />
                <span className="text-xs" style={{ color: tx.muted }}>คะแนน</span>
              </div>
            </div>
          </section>
        </div>

        <div className="sticky bottom-4 flex justify-end rounded-2xl border p-3 shadow-lg" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <button
            type="button"
            onClick={saveScores}
            disabled={isSaving || questionScores.length !== questions.length}
            className="btn-primary flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {isSaving ? "กำลังบันทึก..." : `บันทึกคะแนนรวม ${totalScore}/${assignment.points}`}
          </button>
        </div>
      </main>

      <footer className="py-6 mt-12 border-t text-center text-xs" style={{ borderColor: tx.borderS, color: tx.faint }}>
        <p>© 2026 Math by Seng — Teacher Workspace Console</p>
      </footer>
    </div>
  );
}
