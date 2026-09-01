import React, { useState } from "react";
import { Check } from "lucide-react";
import type { QuizQuestion } from "../../context/UserContext";

interface QuizQuestionRendererProps {
  question: QuizQuestion;
  questionIndex?: number;
  userAnswer: number | string | Record<number, number> | undefined;
  onAnswerChange: (answer: number | string | Record<number, number>) => void;
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
      <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
        จับคู่รายการซ้ายกับรายการขวา (คลิกซ้ายก่อน แล้วคลิกขวาเพื่อจับคู่)
      </p>
      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          {leftItems.map((item, idx) => {
            const isMatched = userAnswer[idx] !== undefined;
            const isSelected = selectedLeft === idx;
            return (
              <button
                key={idx}
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
                className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all ${
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
    const chosenIndex = typeof userAnswer === "number" ? userAnswer : undefined;
    return (
      <div className="grid grid-cols-1 gap-2.5">
        {(question.options || []).map((opt, oIdx) => {
          const isSelected = chosenIndex === oIdx;
          return (
            <button
              key={oIdx}
              onClick={() => onAnswerChange(oIdx)}
              className={`w-full text-left p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between active:scale-[0.98] cursor-pointer ${
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
    );
  }

  if (qType === "fill_blank") {
    const answerText = typeof userAnswer === "string" ? userAnswer : "";
    return (
      <div className="space-y-2">
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
