import React from "react";
import { Trash2, Plus, Check, CheckSquare, Square } from "lucide-react";
import { tx } from "../../lib/theme";
import type { QuizQuestion, QuestionType } from "../../context/UserContext";
import { QuestionTypeSelector } from "./QuestionTypeSelector";

interface QuestionEditorProps {
  question: QuizQuestion;
  index: number;
  canRemove: boolean;
  onRemove: (index: number) => void;
  onUpdateQuestion: (index: number, question: QuizQuestion) => void;
}

export function QuestionEditor({ question, index, canRemove, onRemove, onUpdateQuestion }: QuestionEditorProps) {
  const currentOptions = question.options && question.options.length >= 2
    ? question.options
    : ["", "", "", ""];

  const currentCorrectIndices: number[] = question.correctIndices && Array.isArray(question.correctIndices) && question.correctIndices.length > 0
    ? question.correctIndices
    : (question.correctIndex !== undefined && question.correctIndex !== null ? [question.correctIndex] : [0]);

  const handleTypeChange = (type: QuestionType) => {
    let updatedQuestion: QuizQuestion = {
      ...question,
      questionType: type,
      explanation: question.explanation || "",
      points: question.points !== undefined ? question.points : 1,
    };

    if (type === "multiple_choice") {
      updatedQuestion = {
        ...updatedQuestion,
        options: currentOptions,
        correctIndex: currentCorrectIndices[0] ?? 0,
        correctIndices: currentCorrectIndices,
        correctAnswer: undefined,
        matchingPairs: undefined,
      };
    } else if (type === "fill_blank") {
      updatedQuestion = {
        ...updatedQuestion,
        correctAnswer: question.correctAnswer || "",
        options: undefined,
        correctIndex: undefined,
        correctIndices: undefined,
        matchingPairs: undefined,
      };
    } else if (type === "matching") {
      updatedQuestion = {
        ...updatedQuestion,
        matchingPairs: question.matchingPairs || [
          { left: "", right: "" },
          { left: "", right: "" },
        ],
        options: undefined,
        correctIndex: undefined,
        correctIndices: undefined,
        correctAnswer: undefined,
      };
    } else if (type === "essay") {
      updatedQuestion = {
        ...updatedQuestion,
        correctAnswer: question.correctAnswer || "",
        options: undefined,
        correctIndex: undefined,
        correctIndices: undefined,
        matchingPairs: undefined,
      };
    }

    onUpdateQuestion(index, updatedQuestion);
  };

  const handlePointsChange = (pts: number) => {
    onUpdateQuestion(index, { ...question, points: isNaN(pts) ? 1 : pts });
  };

  const handleQuestionTextChange = (text: string) => {
    onUpdateQuestion(index, { ...question, question: text });
  };

  const handleExplanationChange = (text: string) => {
    onUpdateQuestion(index, { ...question, explanation: text });
  };

  const handleOptionChange = (optIndex: number, value: string) => {
    const newOptions = [...currentOptions];
    newOptions[optIndex] = value;
    onUpdateQuestion(index, { ...question, options: newOptions });
  };

  const handleAddOption = () => {
    const newOptions = [...currentOptions, ""];
    onUpdateQuestion(index, { ...question, options: newOptions });
  };

  const handleRemoveOption = (optIndex: number) => {
    if (currentOptions.length <= 2) return;
    const newOptions = currentOptions.filter((_, idx) => idx !== optIndex);
    // Adjust correctIndices
    const adjustedCorrectIndices = currentCorrectIndices
      .filter((cIdx) => cIdx !== optIndex)
      .map((cIdx) => (cIdx > optIndex ? cIdx - 1 : cIdx));

    const finalCorrectIndices = adjustedCorrectIndices.length > 0 ? adjustedCorrectIndices : [0];
    onUpdateQuestion(index, {
      ...question,
      options: newOptions,
      correctIndices: finalCorrectIndices,
      correctIndex: finalCorrectIndices[0] ?? 0,
    });
  };

  const handleToggleCorrectOption = (optIndex: number) => {
    let nextCorrect: number[];
    if (currentCorrectIndices.includes(optIndex)) {
      // If already selected, remove it unless it's the only one selected
      if (currentCorrectIndices.length > 1) {
        nextCorrect = currentCorrectIndices.filter((idx) => idx !== optIndex);
      } else {
        return; // Keep at least one correct option
      }
    } else {
      nextCorrect = [...currentCorrectIndices, optIndex].sort((a, b) => a - b);
    }

    onUpdateQuestion(index, {
      ...question,
      correctIndices: nextCorrect,
      correctIndex: nextCorrect[0] ?? 0,
    });
  };

  const handleCorrectAnswerChange = (value: string) => {
    onUpdateQuestion(index, { ...question, correctAnswer: value });
  };

  const handleMatchingPairChange = (pairIndex: number, side: "left" | "right", value: string) => {
    if (!question.matchingPairs) return;
    const newPairs = [...question.matchingPairs];
    newPairs[pairIndex] = { ...newPairs[pairIndex], [side]: value };
    onUpdateQuestion(index, { ...question, matchingPairs: newPairs });
  };

  const handleAddMatchingPair = () => {
    const newPairs = [...(question.matchingPairs || []), { left: "", right: "" }];
    onUpdateQuestion(index, { ...question, matchingPairs: newPairs });
  };

  const handleRemoveMatchingPair = (pairIndex: number) => {
    if (!question.matchingPairs || question.matchingPairs.length <= 2) return;
    const newPairs = question.matchingPairs.filter((_, idx) => idx !== pairIndex);
    onUpdateQuestion(index, { ...question, matchingPairs: newPairs });
  };

  const currentType: QuestionType = question.questionType || "multiple_choice";

  return (
    <div className="p-4 sm:p-5 rounded-2xl border space-y-4 text-left" style={{ borderColor: tx.borderS }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: tx.borderS }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            ข้อสอบข้อที่ {index + 1}
          </span>
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            <label className="text-[11px] font-bold text-slate-500">คะแนน:</label>
            <input
              type="number"
              min="0"
              step="any"
              value={question.points !== undefined ? question.points : 1}
              onChange={(e) => handlePointsChange(Number(e.target.value))}
              className="w-14 px-1.5 py-0.5 rounded border text-xs font-bold text-center bg-white dark:bg-slate-900"
              style={{ borderColor: tx.border, color: tx.primary }}
            />
            <span className="text-[11px] text-slate-400">แต้ม</span>
          </div>
          <label className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-700 dark:text-amber-300 cursor-pointer">
            <input
              type="checkbox"
              checked={question.required !== false}
              onChange={(event) => onUpdateQuestion(index, { ...question, required: event.target.checked })}
              className="h-3.5 w-3.5 accent-amber-500"
            />
            จำเป็นต้องตอบ
          </label>
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-xs text-rose-500 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" /> ลบข้อสอบข้อนี้
          </button>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold" style={{ color: tx.muted }}>รูปแบบคำถาม</label>
        <QuestionTypeSelector selectedType={currentType} onSelectType={handleTypeChange} />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold" style={{ color: tx.muted }}>โจทย์ข้อสอบ</label>
        <input
          type="text"
          value={question.question}
          onChange={(e) => handleQuestionTextChange(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-xs sm:text-sm"
          style={{ borderColor: tx.border, color: tx.primary }}
          placeholder="เช่น จงอธิบายความหมายของลิมิต หรือแก้สมการ..."
        />
      </div>

      {currentType === "multiple_choice" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold" style={{ color: tx.muted }}>
                ตัวเลือกคำตอบ ({currentOptions.length} ช้อยส์)
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                คลิกปุ่ม <span className="text-emerald-600 font-bold">✓ คำตอบที่ถูกต้อง</span> เพื่อเฉลย (สามารถเลือกถูกได้มากกว่า 1 ข้อ ระบบจะให้คะแนนตามสัดส่วน)
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddOption}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/50"
            >
              <Plus className="h-3.5 w-3.5" /> เพิ่มช้อยส์
            </button>
          </div>

          <div className="space-y-2.5">
            {currentOptions.map((opt, oIdx) => {
              const isCorrect = currentCorrectIndices.includes(oIdx);
              const optionLetter = String.fromCharCode(65 + oIdx);

              return (
                <div
                  key={oIdx}
                  className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 ${
                    isCorrect
                      ? "border-emerald-500/80 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isCorrect
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {optionLetter}
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(oIdx, e.target.value)}
                      required
                      className="flex-1 px-3 py-2 rounded-xl border bg-transparent text-xs sm:text-sm"
                      style={{ borderColor: tx.border, color: tx.primary }}
                      placeholder={`ตัวเลือก ${optionLetter}`}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleCorrectOption(oIdx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isCorrect
                          ? "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                          : "border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
                      }`}
                    >
                      {isCorrect ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                      <span>{isCorrect ? "คำตอบที่ถูกต้อง ✓" : "กำหนดเป็นคำตอบถูก"}</span>
                    </button>

                    {currentOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(oIdx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="ลบช้อยส์นี้"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Correct Choices Summary Banner */}
          <div className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between flex-wrap gap-2 text-xs" style={{ borderColor: tx.borderS }}>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600 dark:text-slate-300">เฉลยข้อที่ถูกต้อง:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {currentCorrectIndices.map((cIdx) => (
                  <span
                    key={cIdx}
                    className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-extrabold"
                  >
                    {String.fromCharCode(65 + cIdx)}
                  </span>
                ))}
              </div>
            </div>
            {currentCorrectIndices.length > 1 ? (
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                ⭐ มี {currentCorrectIndices.length} ข้อถูกต้อง (ให้คะแนนตามสัดส่วนที่เลือกถูก)
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-400">
                (มี 1 คำตอบที่ถูกต้อง)
              </span>
            )}
          </div>
        </div>
      )}

      {currentType === "fill_blank" && (
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold" style={{ color: tx.muted }}>
              คำตอบที่ถูกต้อง / คีย์เวิร์ดเฉลย
            </label>
            <span className="text-[10px] text-slate-400 font-semibold">
              (ไม่บังคับ - เว้นว่างไว้หากต้องการตรวจด้วยตนเอง)
            </span>
          </div>
          <input
            type="text"
            value={question.correctAnswer || ""}
            onChange={(e) => handleCorrectAnswerChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-xs sm:text-sm"
            style={{ borderColor: tx.border, color: tx.primary }}
            placeholder="เช่น 0 หรือ คำตอบเฉลย (หากเว้นว่างไว้ ครูจะเป็นผู้ให้คะแนนเอง)"
          />
        </div>
      )}

      {currentType === "essay" && (
        <div className="space-y-3 p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40">
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs">
            <span>✍️ รูปแบบข้อสอบอัตนัย / เขียนบรรยาย</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            นักเรียนจะพิมพ์ตอบในกล่องข้อความบรรยายขนาดใหญ่ โดยผู้สอนสามารถตรวจและใส่คะแนนด้วยตนเองหลังจากนักเรียนส่งงาน
          </p>
          <div className="space-y-1">
            <label className="text-xs font-bold" style={{ color: tx.muted }}>
              แนวทางคำตอบ / เกณฑ์เฉลย (ไม่บังคับ - สำหรับเป็นแนวทางตรวจ)
            </label>
            <textarea
              rows={3}
              value={question.correctAnswer || ""}
              onChange={(e) => handleCorrectAnswerChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-xs sm:text-sm"
              style={{ borderColor: tx.border, color: tx.primary }}
              placeholder="ระบุแนวทางคำตอบ คีย์เวิร์ด หรือเกณฑ์การให้คะแนน..."
            />
          </div>
        </div>
      )}

      {currentType === "matching" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <label className="text-xs font-bold" style={{ color: tx.muted }}>คู่ที่ต้องจับคู่ ({question.matchingPairs?.length || 0} คู่)</label>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                ระบบจะให้คะแนนตามสัดส่วนจำนวนคู่ที่จับคู่ถูกต้องต่อคะแนนเต็มของข้อนี้
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddMatchingPair}
              className="text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline cursor-pointer bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/50"
            >
              + เพิ่มคู่
            </button>
          </div>
          <div className="space-y-2.5">
            {(question.matchingPairs || [{ left: "", right: "" }, { left: "", right: "" }]).map((pair, pIdx) => (
              <div
                key={pIdx}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30"
              >
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block sm:hidden">
                    รายการซ้าย (โจทย์ {pIdx + 1}):
                  </span>
                  <input
                    type="text"
                    value={pair.left}
                    onChange={(e) => handleMatchingPairChange(pIdx, "left", e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 text-xs"
                    style={{ borderColor: tx.border, color: tx.primary }}
                    placeholder={`ข้อความซ้าย ${pIdx + 1}`}
                  />
                </div>
                <span className="text-sm self-center text-slate-400 font-bold hidden sm:inline px-1">⇄</span>
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block sm:hidden">
                    รายการขวา (คู่ที่ถูกต้อง {pIdx + 1}):
                  </span>
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) => handleMatchingPairChange(pIdx, "right", e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 text-xs"
                    style={{ borderColor: tx.border, color: tx.primary }}
                    placeholder={`ข้อความขวา ${pIdx + 1}`}
                  />
                </div>
                {question.matchingPairs && question.matchingPairs.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMatchingPair(pIdx)}
                    className="self-end sm:self-center p-2 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="ลบคู่นี้"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-bold" style={{ color: tx.muted }}>คำเฉลยอธิบายเพิ่มเติม</label>
        <input
          type="text"
          value={question.explanation || ""}
          onChange={(e) => handleExplanationChange(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-xs sm:text-sm"
          style={{ borderColor: tx.border, color: tx.primary }}
          placeholder="เช่น เพราะต้องหาลิมิตซ้ายขวา..."
        />
      </div>
    </div>
  );
}
