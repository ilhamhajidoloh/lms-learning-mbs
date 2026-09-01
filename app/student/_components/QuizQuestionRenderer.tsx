import React, { useState } from "react";
import { Check, CheckSquare, Square } from "lucide-react";
import type { QuizQuestion } from "../../context/UserContext";
import { getQuestionCorrectIndices, getStudentSelectedIndices } from "@/lib/quizScoring";

interface QuizQuestionRendererProps {
  question: QuizQuestion;
  questionIndex?: number;
  userAnswer: number | number[] | string | Record<number, number> | undefined;
  onAnswerChange: (answer: number | number[] | string | Record<number, number>) => void;
}

interface MatchingOption {
  text: string;
  originalIndex: number;
}

function shuffleWithoutOriginalPositions(items: string[]): MatchingOption[] {
  const original = items.map((text, originalIndex) => ({ text, originalIndex }));
  if (original.length < 2) return original;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const shuffled = [...original];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    if (shuffled.every((item, index) => item.originalIndex !== index)) return shuffled;
  }

  // A rotation is a guaranteed fallback that leaves no option in its original position.
  return [...original.slice(1), original[0]];
}

function MatchingQuestionRenderer({
  question,
  userAnswer,
  onAnswerChange,
}: {
  question: QuizQuestion;
  userAnswer: Record<number, number>;
  onAnswerChange: (answer: Record<number, number>) => void;
}) {
  const leftItems = question.matchingPairs?.map((p) => p.left) || [];
  const rightItems = question.matchingPairs?.map((p) => p.right) || [];

  const [shuffledRight] = useState(() => shuffleWithoutOriginalPositions(rightItems));

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
          จับคู่รายการซ้ายกับรายการขวา (คลิกซ้ายก่อน แล้วคลิกขวาเพื่อจับคู่)
        </p>
        <span className="text-[10px] text-indigo-500 font-semibold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
          * ให้คะแนนตามสัดส่วนคู่ที่จับคู่ถูกต้อง
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          {leftItems.map((item, idx) => {
            const isMatched = userAnswer[idx] !== undefined;
            const isSelected = selectedLeft === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (isMatched) {
                    const newAnswer = { ...userAnswer };
                    delete newAnswer[idx];
                    onAnswerChange(newAnswer);
                    setSelectedLeft(null);
                  } else {
                    setSelectedLeft(idx);
                  }
                }}
                className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "border-purple-500 bg-purple-500/20 text-purple-600 dark:text-purple-400 shadow-lg"
                    : isMatched
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                {idx + 1}. {item}
                {isMatched && (
                  <span className="block text-[10px] mt-1 text-indigo-500">
                    → จับคู่กับ: {shuffledRight.find((option) => option.originalIndex === userAnswer[idx])?.text}
                  </span>
                )}
                {isSelected && (
                  <span className="block text-[10px] mt-1 text-purple-500">
                    ⚡ เลือกรายการขวาเพื่อจับคู่
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          {shuffledRight.map((item, idx) => {
            const isMatched = Object.values(userAnswer).includes(item.originalIndex);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (selectedLeft !== null && !isMatched) {
                    onAnswerChange({ ...userAnswer, [selectedLeft]: item.originalIndex });
                    setSelectedLeft(null);
                  }
                }}
                disabled={selectedLeft === null}
                className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 ${
                  isMatched
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : selectedLeft !== null
                      ? "border-purple-300 dark:border-purple-700 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {String.fromCharCode(65 + idx)}. {item.text}
                {isMatched && (
                  <span className="block text-[10px] mt-1 text-emerald-500">
                    ✓ ถูกจับคู่แล้ว
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function QuizQuestionRenderer({
  question,
  userAnswer,
  onAnswerChange,
}: QuizQuestionRendererProps) {
  const qType = question.questionType || "multiple_choice";

  if (qType === "multiple_choice") {
    const correctIndices = getQuestionCorrectIndices(question);
    const isMultiSelect = correctIndices.length > 1;
    const selectedIndices = getStudentSelectedIndices(userAnswer);

    const handleOptionClick = (oIdx: number) => {
      if (isMultiSelect) {
        let nextSelected: number[];
        if (selectedIndices.includes(oIdx)) {
          nextSelected = selectedIndices.filter((idx) => idx !== oIdx);
        } else {
          nextSelected = [...selectedIndices, oIdx].sort((a, b) => a - b);
        }
        onAnswerChange(nextSelected);
      } else {
        onAnswerChange(oIdx);
      }
    };

    return (
      <div className="space-y-2.5 text-left">
        {isMultiSelect && (
          <div className="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
              ☑️ ข้อนี้มีคำตอบที่ถูกต้อง {correctIndices.length} ข้อ (เลือกคำตอบที่ถูกต้องทั้งหมด)
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              *ให้คะแนนตามสัดส่วน
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2.5">
          {(question.options || []).map((opt, oIdx) => {
            const isSelected = selectedIndices.includes(oIdx);
            return (
              <button
                key={oIdx}
                type="button"
                onClick={() => handleOptionClick(oIdx)}
                className={`w-full text-left p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between active:scale-[0.98] cursor-pointer ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 animate-borderGlow shadow-sm"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                } transition-all duration-200`}
              >
                <div className="flex items-center gap-3">
                  {isMultiSelect ? (
                    isSelected ? (
                      <CheckSquare className="h-4 w-4 text-indigo-500 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400 shrink-0" />
                    )
                  ) : (
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                  )}
                  <span>
                    {!isMultiSelect && <span className="font-mono mr-1.5">{String.fromCharCode(65 + oIdx)}.</span>}
                    {opt}
                  </span>
                </div>
                {isSelected && !isMultiSelect && (
                  <div className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 animate-scaleIn">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (qType === "fill_blank") {
    const answerText = typeof userAnswer === "string" ? userAnswer : "";
    return (
      <div className="space-y-2 text-left">
        <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
          กรอกคำตอบของคุณ:
        </label>
        <input
          type="text"
          value={answerText}
          onChange={(e) => onAnswerChange(e.target.value)}
          className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="พิมพ์คำตอบที่นี่..."
        />
      </div>
    );
  }

  if (qType === "essay") {
    const answerText = typeof userAnswer === "string" ? userAnswer : "";
    return (
      <div className="space-y-2 text-left">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            คำตอบ / แสดงวิธีทำของคุณ:
          </label>
          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md">
            ✍️ อัตนัย / บรรยาย
          </span>
        </div>
        <textarea
          rows={6}
          value={answerText}
          onChange={(e) => onAnswerChange(e.target.value)}
          className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-sans"
          placeholder="พิมพ์คำตอบ แสดงวิธีคิด หรืออธิบายคำตอบของคุณที่นี่..."
        />
      </div>
    );
  }

  if (qType === "matching") {
    const matchingAnswer = typeof userAnswer === "object" && !Array.isArray(userAnswer) && userAnswer !== null
      ? (userAnswer as Record<number, number>)
      : {};
    return (
      <MatchingQuestionRenderer
        question={question}
        userAnswer={matchingAnswer}
        onAnswerChange={onAnswerChange}
      />
    );
  }

  return null;
}
