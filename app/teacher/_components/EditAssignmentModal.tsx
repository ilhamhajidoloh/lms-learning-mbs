"use client";

import React, { useState, type FormEvent } from "react";
import { X, Plus, Save } from "lucide-react";
import { tx } from "../../lib/theme";
import { useUser, type Assignment, type Lesson, type QuizQuestion } from "../../context/UserContext";
import { QuestionEditor } from "./QuestionEditor";
import { isoToDateInput } from "../../lib/date";
import Swal from "sweetalert2";
import { Portal } from "@/app/components/Portal";

interface EditAssignmentModalProps {
  assignment: Assignment;
  onClose: () => void;
  lessons: Lesson[];
}

export function EditAssignmentModal({ assignment: a, onClose, lessons }: EditAssignmentModalProps) {
  const { updateAssignment } = useUser();
  const [assignLessonId, setAssignLessonId] = useState(a.lessonId || (lessons[0]?.id || ""));
  const [assignTitle, setAssignTitle] = useState(a.title);
  const [assignPoints, setAssignPoints] = useState(a.points);
  const [assignDueDate, setAssignDueDate] = useState(isoToDateInput(a.dueDate) || "");
  const [assignInstructions, setAssignInstructions] = useState(a.instructions || "");
  const [assignTimeLimit, setAssignTimeLimit] = useState(a.timeLimit || 15);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(
    a.questions && a.questions.length > 0
      ? a.questions.map((q) => ({ ...q, points: q.points !== undefined ? Number(q.points) : 1 }))
      : [{ question: "", questionType: "multiple_choice", options: ["", "", "", ""], correctIndex: 0, explanation: "", points: 1, required: true }]
  );
  const [saving, setSaving] = useState(false);

  const handleAddQuestion = () => {
    setQuizQuestions((prev) => [
      ...prev,
      {
        question: "",
        questionType: "multiple_choice",
        options: ["", "", "", ""],
        correctIndex: 0,
        explanation: "",
        points: 1,
        required: true,
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (quizQuestions.length <= 1) return;
    setQuizQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateQuestion = (index: number, updatedQuestion: QuizQuestion) => {
    setQuizQuestions((prev) => {
      const next = [...prev];
      next[index] = updatedQuestion;
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignTitle.trim()) {
      Swal.fire({
        icon: "warning",
        title: "กรุณาระบุชื่องาน/แบบทดสอบ",
        confirmButtonColor: "#4f46e5",
      });
      return;
    }

    if (a.type === "quiz") {
      const emptyQ = quizQuestions.some((q) => !q.question.trim());
      if (emptyQ) {
        Swal.fire({
          icon: "warning",
          title: "กรุณากรอกคำถามให้ครบทุกข้อ",
          confirmButtonColor: "#4f46e5",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const res = await updateAssignment({
        ...a,
        lessonId: assignLessonId || undefined,
        title: assignTitle.trim(),
        points: Number(assignPoints),
        dueDate: assignDueDate || a.dueDate,
        ...(a.type === "file"
          ? { instructions: assignInstructions }
          : { timeLimit: Number(assignTimeLimit), questions: quizQuestions }),
      });

      if (res.success) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
        <div
          className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border text-left"
          style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}
        >
        {/* Modal Header */}
        <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <div>
            <h2 className="text-xl font-bold">
              {a.type === "quiz" ? "✏️ แก้ไขแบบทดสอบ (Quiz)" : "✏️ แก้ไขงานส่งไฟล์"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: tx.muted }}>
              แก้ไขรายละเอียด คำถาม เฉลย และการตั้งค่าของงานนี้
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" style={{ color: tx.secondary }} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <form id="editAssignmentForm" onSubmit={handleSubmit} className="space-y-6">
            {/* Lesson Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                หัวข้อบทเรียนที่สังกัด
              </label>
              {lessons.length > 0 ? (
                <select
                  value={assignLessonId}
                  onChange={(e) => setAssignLessonId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: tx.border, color: tx.primary }}
                >
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      {lesson.title}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  ยังไม่มีหัวข้อบทเรียนในคอร์สนี้
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                ชื่อ{a.type === "file" ? "งานที่มอบหมาย" : "แบบทดสอบ (Quiz)"}
              </label>
              <input
                type="text"
                required
                value={assignTitle}
                onChange={(e) => setAssignTitle(e.target.value)}
                placeholder="เช่น แบบฝึกหัดท้ายบท, Quiz ทดสอบความเข้าใจ"
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                style={{ borderColor: tx.border, color: tx.primary }}
              />
            </div>

            {/* Points & Due Date & Time Limit Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                  คะแนนเต็ม
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={assignPoints}
                  onChange={(e) => setAssignPoints(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: tx.border, color: tx.primary }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                  วันครบกำหนดส่ง (Due Date)
                </label>
                <input
                  type="date"
                  required
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm font-mono"
                  style={{ borderColor: tx.border, color: tx.primary }}
                />
              </div>

              {a.type === "quiz" && (
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                    เวลาในการทำข้อสอบ (นาที)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={assignTimeLimit}
                    onChange={(e) => setAssignTimeLimit(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                    style={{ borderColor: tx.border, color: tx.primary }}
                  />
                </div>
              )}
            </div>

            {/* File Instructions */}
            {a.type === "file" && (
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                  คำอธิบายหรือโจทย์เพิ่มเติม
                </label>
                <textarea
                  rows={4}
                  value={assignInstructions}
                  onChange={(e) => setAssignInstructions(e.target.value)}
                  placeholder="ระบุรายละเอียดงานที่ต้องการให้นักเรียนส่งไฟล์..."
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: tx.border, color: tx.primary }}
                />
              </div>
            )}

            {/* Quiz Questions List */}
            {a.type === "quiz" && (
              <div className="space-y-4 pt-4 border-t" style={{ borderColor: tx.borderS }}>
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm">
                    ชุดข้อสอบ ({quizQuestions.length} ข้อ)
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 dark:text-indigo-400 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> เพิ่มข้อสอบ
                  </button>
                </div>

                <div className="space-y-4">
                  {quizQuestions.map((q, idx) => (
                    <QuestionEditor
                      key={idx}
                      question={q}
                      index={idx}
                      canRemove={quizQuestions.length > 1}
                      onRemove={handleRemoveQuestion}
                      onUpdateQuestion={handleUpdateQuestion}
                    />
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl border font-bold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            style={{ borderColor: tx.border, color: tx.secondary }}
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            form="editAssignmentForm"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
