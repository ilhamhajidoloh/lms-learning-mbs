import React from "react";
import { tx } from "../../lib/theme";
import type { QuizQuestion } from "../../context/UserContext";
import { calculateQuestionScore, getQuestionCorrectIndices, getStudentSelectedIndices } from "@/lib/quizScoring";

interface QuizReviewItemProps {
  question: QuizQuestion;
  questionIndex: number;
  studentAnswer: number | number[] | string | Record<number, number> | undefined;
  showCorrectAnswer: boolean;
  showScore?: boolean;
  earnedPoints?: number;
  isTeacher?: boolean;
}

export function QuizReviewItem({
  question,
  questionIndex,
  studentAnswer,
  showCorrectAnswer,
  showScore = true,
  earnedPoints,
  isTeacher = false,
}: QuizReviewItemProps) {
  const qType = question.questionType || "multiple_choice";
  const pts = question.points !== undefined ? question.points : 1;

  const scoreResult = calculateQuestionScore(question, studentAnswer);
  const hasManualScore = typeof earnedPoints === "number" && Number.isFinite(earnedPoints);
  const displayEarned = hasManualScore ? earnedPoints : scoreResult.score;
  const isGraded = hasManualScore || scoreResult.isCorrect !== null;

  const isCorrect = scoreResult.isCorrect !== null
    ? scoreResult.isCorrect
    : (hasManualScore ? displayEarned >= pts : null);

  const isPartial = scoreResult.isPartial || (hasManualScore && displayEarned > 0 && displayEarned < pts);

  let answerDisplay = scoreResult.studentAnswerText;
  let correctAnswerDisplay = scoreResult.correctAnswerText;

  if (qType === "essay") {
    if (typeof studentAnswer === "string") {
      answerDisplay = studentAnswer || "ไม่ได้ตอบ";
    }
    correctAnswerDisplay = question.correctAnswer
      ? `แนวทางเฉลย: ${question.correctAnswer}`
      : (isGraded ? `ผู้สอนตรวจให้คะแนนแล้ว (${displayEarned.toFixed(2)} / ${pts} คะแนน)` : "รอผู้สอนตรวจให้คะแนน");
  } else if (qType === "fill_blank" && !question.correctAnswer?.trim()) {
    correctAnswerDisplay = isGraded
      ? `ผู้สอนตรวจให้คะแนนแล้ว (${displayEarned.toFixed(2)} / ${pts} คะแนน)`
      : "รอผู้สอนตรวจให้คะแนน";
  }

  const borderColor = showCorrectAnswer && isGraded
    ? (isCorrect ? "#10b981" : isPartial ? "#f59e0b" : "#f43f5e")
    : undefined;

  return (
    <div
      className={`p-4 rounded-2xl border text-xs space-y-3 animate-slideInUp stagger-${Math.min(questionIndex + 1, 6)} ${
        showCorrectAnswer && isGraded && isCorrect === true
          ? "bg-emerald-50/20 dark:bg-emerald-950/10"
          : showCorrectAnswer && isGraded && isPartial
            ? "bg-amber-50/20 dark:bg-amber-950/10"
            : showCorrectAnswer && isGraded && isCorrect === false
              ? "bg-rose-50/20 dark:bg-rose-950/10"
              : ""
      }`}
      style={{ borderColor: borderColor ?? tx.borderS }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-extrabold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[11px]">
            ข้อที่ {questionIndex + 1}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
            {qType === "multiple_choice"
              ? (getQuestionCorrectIndices(question).length > 1 ? "ปรนัย (หลายคำตอบ)" : "ปรนัย")
              : qType === "fill_blank"
                ? "เติมคำ"
                : qType === "matching"
                  ? "จับคู่"
                  : "✍️ อัตนัย/บรรยาย"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showCorrectAnswer && isGraded && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
              isCorrect
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                : isPartial
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
            }`}>
              {isCorrect ? "✓ ถูกต้อง (เต็ม)" : isPartial ? "⚡ ได้คะแนนบางส่วน" : "✗ ไม่ถูกต้อง / 0 คะแนน"}
            </span>
          )}
          {!isGraded && !isTeacher && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              ⏳ รอผู้สอนตรวจ
            </span>
          )}
          {showScore && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
              {isGraded
                ? `${displayEarned.toFixed(2)} / ${pts} คะแนน`
                : isTeacher
                  ? `${pts} คะแนน`
                  : `รอตรวจ / ${pts} คะแนน`}
            </span>
          )}
        </div>
      </div>

      <h6 className="font-bold text-sm leading-relaxed" style={{ color: tx.primary }}>
        {question.question}
      </h6>

      {/* Student Answer Block */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
          <span>{isTeacher ? "คำตอบที่นักเรียนส่ง:" : "คำตอบของคุณ:"}</span>
          {showCorrectAnswer && scoreResult.detailText && (
            <span className="text-[10px] font-bold text-indigo-500">{scoreResult.detailText}</span>
          )}
        </div>
        {qType === "essay" ? (
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-sans whitespace-pre-wrap leading-relaxed">
            {typeof studentAnswer === "string" && studentAnswer.trim() ? studentAnswer : <em className="text-slate-400">ไม่ได้ตอบ</em>}
          </div>
        ) : (
          <p
            className={
              showCorrectAnswer && isGraded
                ? (isCorrect ? "text-emerald-600 font-bold" : isPartial ? "text-amber-600 font-bold" : "text-rose-600 font-bold")
                : "font-semibold"
            }
            style={!showCorrectAnswer || !isGraded ? { color: tx.secondary } : {}}
          >
            {answerDisplay}
          </p>
        )}
      </div>

      {/* Matching Breakdown */}
      {qType === "matching" && typeof studentAnswer === "object" && !Array.isArray(studentAnswer) && question.matchingPairs && (
        <div className="p-3 rounded-xl border space-y-1.5" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            {showCorrectAnswer ? "รายละเอียดการจับคู่:" : "คู่ที่คุณเลือก:"}
          </span>
          {question.matchingPairs.map((pair, i) => {
            const userMatchedRight = studentAnswer[i];
            const correctRight = i;
            const pairCorrect = userMatchedRight === correctRight;
            const matchedRight = typeof userMatchedRight === "number"
              ? question.matchingPairs![userMatchedRight]?.right
              : undefined;

            return (
              <div key={i} className={`flex items-center justify-between gap-2 text-xs p-1.5 rounded-lg ${
                showCorrectAnswer
                  ? (pairCorrect ? "bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300" : "bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300")
                  : "bg-slate-50 dark:bg-slate-800/50"
              }`}>
                <span>{i + 1}. {pair.left} ➔ {matchedRight ?? "ไม่ได้จับคู่"}</span>
                {showCorrectAnswer && !pairCorrect && <span className="text-[10px] opacity-75 font-semibold shrink-0">(เฉลย: {pair.right})</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Correct Answer Display */}
      {showCorrectAnswer && qType !== "matching" && (
        <div className="text-xs space-y-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">
            {qType === "essay" ? "แนวทางคำตอบ / เกณฑ์เฉลย:" : "คำตอบที่ถูกต้อง:"}
          </span>
          <p className="font-bold">{correctAnswerDisplay}</p>
        </div>
      )}

      {/* Explanation */}
      {showCorrectAnswer && question.explanation && (
        <div
          className="p-3 rounded-xl border text-[11px] space-y-0.5"
          style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}
        >
          <span className="font-bold text-indigo-500 block">💡 คำอธิบายเฉลย:</span>
          <p style={{ color: tx.secondary }}>{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
