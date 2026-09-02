"use client";

import React, { useState, type FormEvent } from "react";
import { ArrowLeft, Plus, Save, Clock, Calendar, BookOpen, Award, CheckCircle2 } from "lucide-react";
import { tx, card } from "../../lib/theme";
import { useUser, type Assignment, type Lesson, type MultiSelectScoringMode, type QuizQuestion } from "../../context/UserContext";
import { QuestionEditor } from "./QuestionEditor";
import { isoToDateInput } from "../../lib/date";
import Swal from "sweetalert2";

interface QuizEditorPanelProps {
  assignment?: Assignment | null;
  isNew?: boolean;
  courseId?: string;
  onBack: () => void;
  lessons: Lesson[];
}

export function QuizEditorPanel({ assignment: a, isNew = false, courseId, onBack, lessons }: QuizEditorPanelProps) {
  const { updateAssignment, addAssignment } = useUser();
  const defaultDueDate = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const [assignLessonId, setAssignLessonId] = useState(a?.lessonId || (lessons[0]?.id || ""));
  const [assignTitle, setAssignTitle] = useState(a?.title || "");
  const [assignDueDate, setAssignDueDate] = useState(a?.dueDate ? (isoToDateInput(a.dueDate) || "") : defaultDueDate);
  const [assignTimeLimit, setAssignTimeLimit] = useState(a?.timeLimit || 15);
  const [multiSelectScoringMode, setMultiSelectScoringMode] = useState<MultiSelectScoringMode>(
    a?.multiSelectScoringMode ?? "correct_only"
  );
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(
    a?.questions && a.questions.length > 0
      ? a.questions.map((q) => ({ ...q, points: q.points !== undefined ? Number(q.points) : 1 }))
      : [{
          question: "",
          questionType: "multiple_choice",
          options: ["", "", "", ""],
          correctIndex: 0,
          explanation: "",
          points: 1,
          required: true,
        }]
  );

  const totalCalculatedPoints = quizQuestions.reduce(
    (sum, q) => sum + (q.points !== undefined && !isNaN(Number(q.points)) ? Number(q.points) : 1),
    0
  );

  const [assignPoints, setAssignPoints] = useState<number>(a?.points || totalCalculatedPoints || 10);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const handleAddQuestion = () => {
    setQuizQuestions((prev) => {
      const next = [
        ...prev,
        {
          question: "",
          questionType: "multiple_choice" as const,
          options: ["", "", "", ""],
          correctIndex: 0,
          explanation: "",
          points: 1,
          required: true,
        },
      ];
      const newTotal = next.reduce((sum, q) => sum + (q.points !== undefined && !isNaN(Number(q.points)) ? Number(q.points) : 1), 0);
      setAssignPoints(newTotal);
      setActiveQuestionIndex(next.length - 1);
      return next;
    });
  };

  const handleRemoveQuestion = (index: number) => {
    if (quizQuestions.length <= 1) return;
    setQuizQuestions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const newTotal = next.reduce((sum, q) => sum + (q.points !== undefined && !isNaN(Number(q.points)) ? Number(q.points) : 1), 0);
      setAssignPoints(newTotal);
      if (activeQuestionIndex >= next.length) {
        setActiveQuestionIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const handleUpdateQuestion = (index: number, updatedQuestion: QuizQuestion) => {
    setQuizQuestions((prev) => {
      const next = [...prev];
      next[index] = updatedQuestion;
      const newTotal = next.reduce((sum, q) => sum + (q.points !== undefined && !isNaN(Number(q.points)) ? Number(q.points) : 1), 0);
      setAssignPoints(newTotal);
      return next;
    });
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!assignTitle.trim()) {
      Swal.fire({
        icon: "warning",
        title: "กรุณาระบุชื่อแบบทดสอบ",
        confirmButtonColor: "#4f46e5",
      });
      return;
    }

    const emptyQ = quizQuestions.some((q) => !q.question.trim());
    if (emptyQ) {
      Swal.fire({
        icon: "warning",
        title: "กรุณากรอกคำถามให้ครบทุกข้อ",
        text: "พบคำถามที่ยังเว้นว่างอยู่ กรุณาตรวจสอบก่อนบันทึกครับ",
        confirmButtonColor: "#4f46e5",
      });
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const newAssignment: Assignment = {
          id: Math.random().toString(),
          courseId: courseId || a?.courseId || "",
          lessonId: assignLessonId || undefined,
          type: "quiz",
          title: assignTitle.trim(),
          points: Number(assignPoints || totalCalculatedPoints),
          dueDate: assignDueDate || defaultDueDate,
          timeLimit: Number(assignTimeLimit),
          multiSelectScoringMode,
          questions: quizQuestions,
          createdAt: Date.now(),
        };
        addAssignment(newAssignment);
        onBack();
      } else if (a) {
        const res = await updateAssignment({
          ...a,
          lessonId: assignLessonId || undefined,
          title: assignTitle.trim(),
          points: Number(assignPoints || totalCalculatedPoints),
          dueDate: assignDueDate || a.dueDate,
          timeLimit: Number(assignTimeLimit),
          multiSelectScoringMode,
          questions: quizQuestions,
        });

        if (res.success) {
          onBack();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const currentQuestionIndex = Math.min(activeQuestionIndex, quizQuestions.length - 1);
  const currentQuestion = quizQuestions[currentQuestionIndex];

  return (
    <div className="space-y-6 text-left animate-fadeIn pb-16">
      {/* Sticky Top Header Bar */}
      <div
        className="sticky top-0 z-30 py-4 px-6 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md"
        style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0 active:scale-95"
            style={{ borderColor: tx.border, color: tx.secondary }}
            title="ย้อนกลับ"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                {isNew ? "✨ สร้างแบบทดสอบใหม่ (New Quiz)" : "📝 หน้าแก้ไขแบบทดสอบ (Quiz Editor)"}
              </span>
              <span className="text-xs font-bold" style={{ color: tx.muted }}>
                ({quizQuestions.length} ข้อ · รวม {assignPoints} คะแนน)
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black truncate max-w-lg mt-0.5" style={{ color: tx.primary }}>
              {assignTitle || (isNew ? "สร้างแบบทดสอบใหม่" : "แบบทดสอบ (Quiz)")}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            style={{ borderColor: tx.border, color: tx.secondary }}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "กำลังบันทึก..." : "บันทึกแบบทดสอบ"}
          </button>
        </div>
      </div>

      {/* Question Quick Jump Bar */}
      <div
        className="p-4 rounded-2xl border shadow-xs flex items-center gap-2 overflow-x-auto"
        style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}
      >
        <span className="text-xs font-bold shrink-0 mr-1" style={{ color: tx.muted }}>
          เลือกข้อ:
        </span>
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto py-1">
          {quizQuestions.map((q, idx) => {
            const isActive = activeQuestionIndex === idx;
            const isFilled = !!q.question.trim();
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveQuestionIndex(idx)}
                className={`min-w-[40px] h-9 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 active:scale-95 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-105"
                    : isFilled
                      ? "border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                      : "border border-slate-200 dark:border-slate-700 bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>ข้อ {idx + 1}</span>
                {isFilled && <CheckCircle2 className={`h-3 w-3 ${isActive ? "text-white" : "text-emerald-500"}`} />}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={handleAddQuestion}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 dark:text-purple-300 text-xs font-bold shrink-0 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> เพิ่มข้อ
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: General Quiz Settings */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-6 rounded-3xl border shadow-sm space-y-4 sticky top-28" style={card.style}>
            <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: tx.borderS }}>
              <Award className="h-5 w-5 text-indigo-500" />
              <h3 className="font-bold text-sm">การตั้งค่าแบบทดสอบ</h3>
            </div>

            <div className="space-y-4 text-xs">
              {/* Lesson */}
              <div className="space-y-1">
                <label className="font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: tx.muted }}>
                  <BookOpen className="h-3.5 w-3.5 text-indigo-500" /> บทเรียนที่สังกัด
                </label>
                {lessons.length > 0 ? (
                  <select
                    value={assignLessonId}
                    onChange={(e) => setAssignLessonId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-xs"
                    style={{ borderColor: tx.border, color: tx.primary }}
                  >
                    {lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        {lesson.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    ยังไม่มีบทเรียนในคอร์สนี้
                  </p>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                  ชื่อแบบทดสอบ (Quiz Title)
                </label>
                <input
                  type="text"
                  required
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  placeholder="เช่น Quiz ทบทวนท้ายบท"
                  className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-xs"
                  style={{ borderColor: tx.border, color: tx.primary }}
                />
              </div>

              {/* Points */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                    คะแนนเต็ม
                  </label>
                  {assignPoints !== totalCalculatedPoints && (
                    <button
                      type="button"
                      onClick={() => setAssignPoints(totalCalculatedPoints)}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      ⚡ รวมจากข้อสอบ ({totalCalculatedPoints} คะแนน)
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  required
                  value={assignPoints}
                  onChange={(e) => setAssignPoints(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-xs"
                  style={{ borderColor: tx.border, color: tx.primary }}
                />
              </div>

              {/* Time Limit */}
              <div className="space-y-1">
                <label className="font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: tx.muted }}>
                  <Clock className="h-3.5 w-3.5 text-purple-500" /> เวลาในการทำ (นาที)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={assignTimeLimit}
                  onChange={(e) => setAssignTimeLimit(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-xs"
                  style={{ borderColor: tx.border, color: tx.primary }}
                />
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <label className="font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                  การคิดคะแนนข้อเลือกได้หลายคำตอบ
                </label>
                <select
                  value={multiSelectScoringMode}
                  onChange={(e) => setMultiSelectScoringMode(e.target.value as MultiSelectScoringMode)}
                  className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-xs"
                  style={{ borderColor: tx.border, color: tx.primary }}
                >
                  <option value="correct_only" className="bg-white dark:bg-slate-900">ได้คะแนนตามข้อที่เลือกถูก</option>
                  <option value="penalize_incorrect" className="bg-white dark:bg-slate-900">เลือกผิดตัดคะแนนตามสัดส่วน</option>
                </select>
                <p className="text-[10px] leading-relaxed" style={{ color: tx.muted }}>
                  ใช้กับข้อที่มีคำตอบถูกมากกว่า 1 ข้อเท่านั้น
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: tx.muted }}>
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" /> วันครบกำหนดส่ง
                </label>
                <input
                  type="date"
                  required
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-xs font-mono"
                  style={{ borderColor: tx.border, color: tx.primary }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: One question per tab */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <span>กำลังแก้ไขข้อที่ {currentQuestionIndex + 1}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                {currentQuestionIndex + 1}/{quizQuestions.length}
              </span>
            </h3>
            <button
              type="button"
              onClick={handleAddQuestion}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition-all cursor-pointer active:scale-95"
            >
              <Plus className="h-4 w-4" /> เพิ่มข้อสอบใหม่
            </button>
          </div>

          <div
            key={currentQuestionIndex}
            className="p-6 rounded-3xl border shadow-sm animate-scaleIn"
            style={{ ...card.style, borderColor: "#6366f1" }}
          >
            <QuestionEditor
              question={currentQuestion}
              index={currentQuestionIndex}
              canRemove={quizQuestions.length > 1}
              onRemove={handleRemoveQuestion}
              onUpdateQuestion={handleUpdateQuestion}
            />
          </div>

          {/* Bottom Add & Save Bar */}
          <div
            className="p-6 rounded-3xl border text-center space-y-3 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}
          >
            <div className="text-left">
              <h4 className="font-bold text-sm">ต้องการเพิ่มข้อสอบอีกหรือไม่?</h4>
              <p className="text-xs" style={{ color: tx.muted }}>
                คุณสามารถเพิ่มคำถาม ปรนัย 4 ตัวเลือก, เติมคำตอบ หรือจับคู่ ได้ไม่จำกัด
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-4 py-2.5 rounded-xl border font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
                style={{ borderColor: tx.border, color: tx.primary }}
              >
                <Plus className="h-4 w-4" /> เพิ่มข้อสอบ
              </button>
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "กำลังบันทึก..." : "บันทึกแบบทดสอบ"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
