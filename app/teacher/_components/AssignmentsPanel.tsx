import React, { useMemo, useState } from "react";
import { Plus, ArrowLeft, Users, Eye, EyeOff, BookOpen, Clock, PencilLine, Undo2, RotateCcw, Settings, X, Lock, Unlock, Check, Save, Copy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { tx, card } from "../../lib/theme";
import { useUser, type Assignment, type StudentSubmission } from "../../context/UserContext";
import { EmptyState } from "../../components/EmptyState";
import Swal from "sweetalert2";
import { toast } from "@/lib/swal";
import { formatThaiDate, formatThaiDateTime, isoToDateInput, isoToLocalInput } from "../../lib/date";
import { EditAssignmentModal } from "./EditAssignmentModal";
import { QuizEditorPanel } from "./QuizEditorPanel";
import { Portal } from "@/app/components/Portal";

interface AssignmentsPanelProps {
  courseId: string;
  courseAssignments: Assignment[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  viewingAssignmentId: string | null;
  setViewingAssignmentId: (id: string | null) => void;
  setShowForm: (show: boolean) => void;
}

interface AssignmentControlModalProps {
  assignment: Assignment | null;
  onClose: () => void;
}

function dueDateToClosingTime(dueDate?: string): string {
  const date = isoToDateInput(dueDate);
  return date ? `${date}T23:59` : "";
}

function AssignmentControlModal({ assignment: a, onClose }: AssignmentControlModalProps) {
  const { updateAssignmentSettings, toggleAssignmentOpen, updateAssignmentAdvancedSettings } = useUser();
  const [isOpenState, setIsOpenState] = useState(a ? a.isOpen !== false : true);
  const [showScores, setShowScores] = useState(a ? a.showScores !== false : true);
  const [quizReviewMode, setQuizReviewMode] = useState<"full" | "answers_only" | "none">(a ? (a.quizReviewMode ?? "full") : "full");
  const [openAtInput, setOpenAtInput] = useState(a ? isoToLocalInput(a.openAt) : "");
  const [closeAtInput, setCloseAtInput] = useState(a ? isoToLocalInput(a.closeAt) || dueDateToClosingTime(a.dueDate) : "");
  const [attemptInput, setAttemptInput] = useState(a && a.quizAttemptLimit ? String(a.quizAttemptLimit) : "");
  const [allowEdit, setAllowEdit] = useState(a ? a.allowEditSubmission === true : false);
  const [allowCancel, setAllowCancel] = useState(a ? a.allowCancelSubmission === true : false);
  const [saving, setSaving] = useState(false);

  if (!a) return null;

  const QUIZ_REVIEW_OPTIONS: { value: "full" | "answers_only" | "none"; label: string }[] = [
    { value: "full", label: "เฉลยเต็มรูปแบบ (ดูเฉลย + คำอธิบาย)" },
    { value: "answers_only", label: "เฉพาะคำตอบของนักเรียน (ไม่เฉลย)" },
    { value: "none", label: "ปิด (ไม่แสดงอะไร)" },
  ];

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await updateAssignmentSettings(a.id, showScores, quizReviewMode);
      await toggleAssignmentOpen(a.id, isOpenState);
      await updateAssignmentAdvancedSettings(a.id, {
        // Keep the legacy date-only deadline aligned with the actual closing time.
        dueDate: closeAtInput ? closeAtInput.slice(0, 10) : undefined,
        allowEditSubmission: allowEdit,
        allowCancelSubmission: allowCancel,
        quizAttemptLimit: attemptInput ? Number(attemptInput) : 0,
        openAt: openAtInput ? new Date(openAtInput).toISOString() : "",
        closeAt: closeAtInput ? new Date(closeAtInput).toISOString() : "",
      });
      await Swal.fire({
        icon: "success",
        title: "บันทึกการตั้งค่าแล้ว",
        text: `อัปเดตการตั้งค่าสำหรับ "${a.title}" เรียบร้อย`,
        timer: 1500,
        showConfirmButton: false,
        background: card.style.background ? String(card.style.background) : undefined,
        color: tx.primary,
      });
      onClose();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการบันทึกการตั้งค่า");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
        <div className="w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleIn overflow-y-auto max-h-[90vh] text-left border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: tx.borderS }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-base line-clamp-1">{a.title}</h4>
              <p className="text-[11px]" style={{ color: tx.muted }}>ตั้งค่าการเปิด/ปิด สิทธิ์นักเรียน และการแสดงผลคะแนน</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-400 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section 1: Submission availability */}
        <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOpenState ? <Unlock className="h-4 w-4 text-emerald-500" /> : <Lock className="h-4 w-4 text-rose-500" />}
              <div>
                <p className="text-xs font-bold" style={{ color: tx.primary }}>เปิดให้นักเรียนทำ/ส่งงาน</p>
                <p className="text-[10px]" style={{ color: tx.muted }}>หากปิด นักเรียนจะไม่สามารถส่งงานหรือทำควิซได้</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpenState(!isOpenState)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${isOpenState ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isOpenState ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: tx.borderS }}>
            <div className="space-y-1">
              <label className="text-[10px] font-bold flex items-center gap-1" style={{ color: tx.secondary }}>
                <Clock className="h-3 w-3 text-indigo-500" /> เริ่มรับส่งงาน
              </label>
              <input
                type="datetime-local"
                value={openAtInput}
                onChange={(e) => setOpenAtInput(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border text-[11px] bg-transparent font-mono"
                style={{ borderColor: tx.border, color: tx.primary }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold flex items-center gap-1" style={{ color: tx.secondary }}>
                <Clock className="h-3 w-3 text-rose-500" /> สิ้นสุดการรับส่งงาน
              </label>
              <input
                type="datetime-local"
                value={closeAtInput}
                onChange={(e) => setCloseAtInput(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border text-[11px] bg-transparent font-mono"
                style={{ borderColor: tx.border, color: tx.primary }}
              />
            </div>
          </div>

          <p className="border-t pt-3 text-[10px]" style={{ borderColor: tx.borderS, color: tx.muted }}>
            หากกำหนด “สิ้นสุดการรับส่งงาน” ระบบจะใช้เวลานี้เป็นทั้งกำหนดส่งและเวลาปิดรับงาน
          </p>
        </div>

        {/* Section 2: Show Scores & Review Mode */}
        <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs font-bold" style={{ color: tx.primary }}>แสดงคะแนนให้นักเรียนเห็น</p>
                <p className="text-[10px]" style={{ color: tx.muted }}>เปิดเมื่อตรวจเสร็จ หรือปิดไว้ระหว่างตรวจงาน</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowScores(!showScores)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${showScores ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showScores ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {a.type === 'quiz' && (
            <div className="space-y-2 border-t pt-3" style={{ borderColor: tx.borderS }}>
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-bold" style={{ color: tx.primary }}>การแสดงเฉลย Quiz หลังส่ง</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {QUIZ_REVIEW_OPTIONS.map((opt) => {
                  const isActive = quizReviewMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQuizReviewMode(opt.value)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold text-left transition-all cursor-pointer border flex items-center justify-between ${
                        isActive
                          ? 'bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isActive && <Check className="h-4 w-4 text-purple-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: File Submission Toggles OR Quiz Attempt Limits */}
        {a.type === 'file' && (
          <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PencilLine className="h-4 w-4 text-indigo-500" />
                <div>
                  <p className="text-xs font-bold" style={{ color: tx.primary }}>อนุญาตให้แก้ไขไฟล์ที่ส่งแล้ว</p>
                  <p className="text-[10px]" style={{ color: tx.muted }}>นักเรียนสามารถอัปโหลดไฟล์ใหม่มาส่งแทนไฟล์เดิมได้</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAllowEdit(!allowEdit)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${allowEdit ? 'bg-indigo-500' : 'bg-slate-400 dark:bg-slate-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${allowEdit ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: tx.borderS }}>
              <div className="flex items-center gap-2">
                <Undo2 className="h-4 w-4 text-rose-500" />
                <div>
                  <p className="text-xs font-bold" style={{ color: tx.primary }}>อนุญาตให้ยกเลิก/ลบการส่งไฟล์</p>
                  <p className="text-[10px]" style={{ color: tx.muted }}>นักเรียนสามารถกดลบไฟล์เดิมออกเพื่อส่งใหม่ได้</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAllowCancel(!allowCancel)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${allowCancel ? 'bg-rose-500' : 'bg-slate-400 dark:bg-slate-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${allowCancel ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        )}

        {a.type === 'quiz' && (
          <div className="p-4 rounded-2xl border flex items-center justify-between gap-3" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-xs font-bold" style={{ color: tx.primary }}>จำนวนครั้งที่ทำควิซได้</p>
                <p className="text-[10px]" style={{ color: tx.muted }}>ระบุจำนวนครั้ง (เช่น 1, 2, 3) หรือเว้นว่างเพื่อทำได้ไม่จำกัด</p>
              </div>
            </div>
            <input
              type="number"
              min={1}
              value={attemptInput}
              onChange={(e) => setAttemptInput(e.target.value)}
              placeholder="ไม่จำกัด"
              className="w-24 px-3 py-1.5 rounded-xl border text-xs font-bold bg-transparent text-right font-mono"
              style={{ borderColor: tx.border, color: tx.primary }}
            />
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: tx.borderS }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            style={{ borderColor: tx.borderS, color: tx.secondary }}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</span>
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

export function AssignmentsPanel({
  courseId,
  courseAssignments,
  assignments,
  submissions,
  viewingAssignmentId,
  setViewingAssignmentId,
  setShowForm,
}: AssignmentsPanelProps) {
  const router = useRouter();
  const { gradeSubmission, cancelSubmissionScore, deleteAssignment, lessons, topics, chapters, enrollments } = useUser();
  const [managingAssignment, setManagingAssignment] = useState<Assignment | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<Assignment | null>(null);
  const [copyingQuiz, setCopyingQuiz] = useState<Assignment | null>(null);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState<boolean>(false);

  const startCopyQuiz = (quiz: Assignment) => {
    setCopyingQuiz({
      ...quiz,
      title: `${quiz.title} (สำเนา)`,
      questions: quiz.questions?.map((question) => ({
        ...question,
        options: question.options ? [...question.options] : undefined,
        correctIndices: question.correctIndices ? [...question.correctIndices] : undefined,
        matchingPairs: question.matchingPairs?.map((pair) => ({ ...pair })),
      })),
    });
  };

  // Keep the lesson selector in the work tab identical to this course's lesson tree.
  // The old selector received every lesson in the system, including lessons from other courses.
  const courseLessons = useMemo(() => {
    const courseChapterIds = new Set(
      chapters.filter((chapter) => chapter.courseId === courseId).map((chapter) => chapter.id)
    );
    const courseTopics = topics.filter((topic) => courseChapterIds.has(topic.chapterId));

    return courseTopics.flatMap((topic) =>
      lessons.filter((lesson) => lesson.topicId === topic.id)
    );
  }, [chapters, courseId, lessons, topics]);

  const groupedAssignments = React.useMemo(() => {
    const map = new Map<string, Assignment[]>();
    const unassigned: Assignment[] = [];

    courseAssignments.forEach((a) => {
      if (a.lessonId) {
        if (!map.has(a.lessonId)) {
          map.set(a.lessonId, []);
        }
        map.get(a.lessonId)!.push(a);
      } else {
        unassigned.push(a);
      }
    });

    const groups: {
      lessonId: string | null;
      lessonTitle: string;
      chapterTopicBreadcrumb?: string;
      items: Assignment[];
    }[] = [];

    map.forEach((items, lessonId) => {
      const l = courseLessons.find((item) => item.id === lessonId);
      const lessonTitle = l ? l.title : "บทเรียน (ID: " + lessonId + ")";

      let breadcrumb = "";
      if (l?.topicId) {
        const top = topics.find((t) => t.id === l.topicId);
        if (top) {
          const chap = chapters.find((ch) => ch.id === top.chapterId);
          if (chap) {
            breadcrumb = `${chap.title} › ${top.title}`;
          } else {
            breadcrumb = top.title;
          }
        }
      }

      groups.push({
        lessonId,
        lessonTitle,
        chapterTopicBreadcrumb: breadcrumb,
        items,
      });
    });

    if (unassigned.length > 0) {
      groups.push({
        lessonId: null,
        lessonTitle: "บทเรียนทั่วไป / งานรวมประจำวิชา",
        items: unassigned,
      });
    }

    return groups;
  }, [courseAssignments, lessons, topics, chapters]);

  const handleGradeFileSubmission = async (subId: string, currentScore: number | undefined | null, maxPoints: number) => {
    const { value: inputScore } = await Swal.fire({
      title: "ให้คะแนนงาน (ส่งไฟล์)",
      input: "number",
      inputLabel: `ระบุคะแนนที่ต้องการให้ (เต็ม ${maxPoints} คะแนน)`,
      inputValue: currentScore ?? maxPoints,
      showCancelButton: true,
      confirmButtonText: "บันทึกคะแนน",
      cancelButtonText: "ยกเลิก",
      inputValidator: (value) => {
        if (value === "" || value === null || value === undefined) {
          return "กรุณาระบุคะแนน!";
        }
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > maxPoints) {
          return `คะแนนต้องอยู่ระหว่าง 0 ถึง ${maxPoints}`;
        }
        return null;
      },
    });

    if (inputScore !== undefined && inputScore !== null && inputScore !== "") {
      await gradeSubmission(subId, Number(inputScore));
    }
  };

  const handleGradeQuizSubmission = async (subId: string, currentScore: number | undefined | null, maxPoints: number) => {
    const { value: inputScore } = await Swal.fire({
      title: "แก้ไขคะแนนแบบทดสอบ (Quiz)",
      input: "number",
      inputLabel: `ระบุคะแนนที่ต้องการแก้ไข (เต็ม ${maxPoints} คะแนน)`,
      inputValue: currentScore ?? maxPoints,
      showCancelButton: true,
      confirmButtonText: "บันทึกคะแนน",
      cancelButtonText: "ยกเลิก",
      inputValidator: (value) => {
        if (value === "" || value === null || value === undefined) {
          return "กรุณาระบุคะแนน!";
        }
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > maxPoints) {
          return `คะแนนต้องอยู่ระหว่าง 0 ถึง ${maxPoints}`;
        }
        return null;
      },
    });

    if (inputScore !== undefined && inputScore !== null && inputScore !== "") {
      await gradeSubmission(subId, Number(inputScore));
    }
  };

  const handleResetScore = async (subId: string, studentName: string) => {
    const confirmed = await Swal.fire({
      title: `ยกเลิกคะแนนของ ${studentName}?`,
      text: "คะแนนจะถูกรีเซ็ตเป็นสถานะยังไม่ได้ตรวจคะแนน",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันยกเลิกคะแนน",
      cancelButtonText: "ยกเลิก",
    });
    if (confirmed.isConfirmed) {
      await cancelSubmissionScore(subId);
    }
  };

  const handleDeleteAssignment = async (assignment: Assignment) => {
    const relatedSubmissions = submissions.filter((submission) => submission.assignmentId === assignment.id).length;
    const itemLabel = assignment.type === "quiz" ? "ควิซ" : "งาน";
    const confirmed = await Swal.fire({
      icon: "warning",
      title: `ยืนยันการลบ${itemLabel}นี้?`,
      text: `“${assignment.title}” และประวัติการส่ง/การทำข้อสอบของนักเรียนทั้งหมด ${relatedSubmissions} รายการจะถูกลบออกอย่างถาวร`,
      showCancelButton: true,
      confirmButtonText: "ยืนยันลบถาวร",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
      focusCancel: true,
    });
    if (!confirmed.isConfirmed) return;

    const result = await deleteAssignment(assignment.id);
    if (result.success) {
      setViewingAssignmentId(null);
      setManagingAssignment(null);
    }
  };

  if (isCreatingQuiz) {
    return (
      <QuizEditorPanel
        isNew={true}
        courseId={courseId}
        onBack={() => setIsCreatingQuiz(false)}
        lessons={courseLessons}
      />
    );
  }

  if (copyingQuiz) {
    return (
      <QuizEditorPanel
        key={copyingQuiz.id}
        assignment={copyingQuiz}
        isNew={true}
        courseId={courseId}
        initialLessonId=""
        onBack={() => setCopyingQuiz(null)}
        lessons={courseLessons}
      />
    );
  }

  if (editingQuiz) {
    return (
      <QuizEditorPanel
        assignment={editingQuiz}
        onBack={() => setEditingQuiz(null)}
        lessons={courseLessons}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <h3 className="text-lg font-bold">งานที่มอบหมายทั้งหมดในวิชานี้</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-bold hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer active:scale-95"
            style={{ color: tx.primary }}
          >
            <Plus className="h-4 w-4 text-indigo-500" /> สร้างงานส่งไฟล์ (File)
          </button>
          <button
            type="button"
            onClick={() => setIsCreatingQuiz(true)}
            className="btn-primary flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> สร้างแบบทดสอบ (Quiz Editor)
          </button>
        </div>
      </div>

      {/* Assignments List */}
      {viewingAssignmentId ? (
        (() => {
          const activeAssignment = assignments.find(a => a.id === viewingAssignmentId)!;
          const activeSubmissions = submissions.filter(s => s.assignmentId === viewingAssignmentId);

          const enrolledInCourse = enrollments.filter(e => e.courseId === activeAssignment.courseId);

          const latestSubmissionsByStudent = new Map<string, StudentSubmission>();
          activeSubmissions.forEach((s) => {
            const existing = latestSubmissionsByStudent.get(s.studentId);
            if (!existing || s.submittedAt > existing.submittedAt) {
              latestSubmissionsByStudent.set(s.studentId, s);
            }
          });

          const uniqueSubmittingStudentsCount = latestSubmissionsByStudent.size;
          const totalCourseStudents = Math.max(enrolledInCourse.length, uniqueSubmittingStudentsCount, 1);
          const submissionRate = Math.min(100, Math.round((uniqueSubmittingStudentsCount / totalCourseStudents) * 100));

          const scoredSubs = Array.from(latestSubmissionsByStudent.values()).filter(s => Number.isFinite(Number(s.score)));
          const classAverage = scoredSubs.length > 0
            ? (scoredSubs.reduce((acc, curr) => acc + Number(curr.score), 0) / scoredSubs.length).toFixed(1)
            : null;

          const submissionRows = Array.from(latestSubmissionsByStudent.values()).map(submission => ({
            id: submission.studentId,
            name: submission.studentName,
            submission,
          }));

          return (
            <div className="space-y-6 text-left animate-fadeIn">
              <button onClick={() => setViewingAssignmentId(null)} className="flex items-center gap-2 text-xs font-bold hover:text-indigo-500 transition-all duration-200 active:scale-95">
                <ArrowLeft className="h-4 w-4" /> กลับรายการงานทั้งหมด
              </button>

              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b pb-4" style={{ borderColor: tx.borderS }}>
                <div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    activeAssignment.type === 'file' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50' : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50'
                  }`}>
                    {activeAssignment.type === 'file' ? 'ส่งไฟล์' : 'Quiz'}
                  </span>
                  <h3 className="text-xl font-bold mt-1">{activeAssignment.title}</h3>
                  <p className="text-xs mt-1" style={{ color: tx.muted }}>
                    คะแนนเต็ม {activeAssignment.points} คะแนน · กำหนดส่ง {activeAssignment.closeAt ? formatThaiDateTime(activeAssignment.closeAt) : formatThaiDate(activeAssignment.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeAssignment.type === "quiz") {
                        setEditingQuiz(activeAssignment);
                      } else {
                        setEditingAssignment(activeAssignment);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-200 dark:border-amber-800/50 shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    <PencilLine className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span>{activeAssignment.type === "quiz" ? "แก้ไขควิซ (Quiz Editor)" : "แก้ไขงาน"}</span>
                  </button>
                  {activeAssignment.type === "quiz" && (
                    <button
                      type="button"
                      onClick={() => startCopyQuiz(activeAssignment)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-200 dark:border-purple-800/50 shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                      <Copy className="h-4 w-4" />
                      <span>คัดลอก Quiz</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteAssignment(activeAssignment)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800/50 shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>ลบ{activeAssignment.type === "quiz" ? "ควิซ" : "งาน"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManagingAssignment(activeAssignment)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800/50 shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    <Settings className="h-4 w-4 text-indigo-500" />
                    <span>ตั้งค่า & ควบคุมงาน</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border text-center" style={card.style}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ส่งแล้ว / ทั้งหมด</p>
                  <p className="text-2xl font-black text-indigo-500 mt-1">{uniqueSubmittingStudentsCount} / {totalCourseStudents} คน</p>
                </div>
                <div className="p-4 rounded-2xl border text-center" style={card.style}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>อัตราการส่งงาน</p>
                  <p className="text-2xl font-black text-emerald-500 mt-1">{submissionRate}%</p>
                </div>
                <div className="p-4 rounded-2xl border text-center" style={card.style}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                    {activeAssignment.type === 'file' ? 'ประเภทการส่ง' : 'คะแนนเฉลี่ย'}
                  </p>
                  <p className="text-2xl font-black text-purple-500 mt-1">
                    {activeAssignment.type === 'file' ? 'ไฟล์ PDF / รูปภาพ' : (classAverage !== null ? `${classAverage} / ${activeAssignment.points}` : '-')}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl p-6 shadow-sm border space-y-4" style={card.style}>
                <h4 className="font-bold text-base">บันทึกการส่งงานของนักเรียน</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead>
                      <tr className="border-b" style={{ borderColor: tx.borderS }}>
                        <th className="pb-2 font-bold" style={{ color: tx.muted }}>นักเรียน</th>
                        <th className="pb-2 font-bold" style={{ color: tx.muted }}>วันที่ส่ง</th>
                        <th className="pb-2 font-bold" style={{ color: tx.muted }}>สถานะ</th>
                        <th className="pb-2 font-bold" style={{ color: tx.muted }}>ผลงาน / คะแนน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissionRows.length > 0 ? (
                        submissionRows.map((student) => {
                          const sub = student.submission;
                          return (
                            <tr key={student.id} className="border-b last:border-b-0" style={{ borderColor: tx.borderS }}>
                              <td className="py-3">
                                <p className="font-bold">{student.name}</p>
                                <p className="text-[10px]" style={{ color: tx.faint }}>รหัส: {student.id}</p>
                              </td>
                              <td className="py-3">
                                {formatThaiDateTime(sub.submittedAt)}
                              </td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sub.score === null && sub.previousScore !== undefined && sub.previousScore !== null
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50"
                                }`}>
                                  {sub.score === null && sub.previousScore !== undefined && sub.previousScore !== null
                                    ? "ส่งแก้ไขใหม่"
                                    : "ส่งแล้ว"}
                                </span>
                              </td>
                              <td className="py-3 font-semibold">
                                {sub.type === "file" ? (
                                   <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                     <div className="flex items-center gap-1.5">
                                       <span className="text-xs line-clamp-1 max-w-[140px] font-mono" style={{ color: tx.muted }}>{sub.fileName}</span>
                                       <button type="button" onClick={() => Swal.fire({ icon: "info", title: "จำลองการเปิดไฟล์", text: sub.fileName, confirmButtonText: "ตกลง" })} className="text-[10px] text-indigo-500 hover:underline cursor-pointer">เปิดดูไฟล์</button>
                                     </div>
                                     <div className="flex items-center gap-1.5 flex-wrap">
                                       {sub.score !== undefined && sub.score !== null ? (
                                         <>
                                           <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                             {sub.score.toFixed(2)} / {activeAssignment.points} คะแนน
                                           </span>
                                           <button
                                             type="button"
                                             onClick={() => handleGradeFileSubmission(sub.id, sub.score, activeAssignment.points)}
                                             className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow cursor-pointer"
                                           >
                                             แก้ไขคะแนน
                                           </button>
                                           <button
                                             type="button"
                                             onClick={() => handleResetScore(sub.id, student.name)}
                                             className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/30 cursor-pointer"
                                           >
                                             ยกเลิกคะแนน
                                           </button>
                                         </>
                                       ) : (
                                         <>
                                           <div className="flex flex-col text-left">
                                             <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                                               {sub.previousScore !== undefined && sub.previousScore !== null ? "รอตรวจคะแนนใหม่" : "รอตรวจคะแนน"}
                                             </span>
                                             {sub.previousScore !== undefined && sub.previousScore !== null && (
                                               <span className="text-[9px] text-slate-500 dark:text-slate-400 font-normal">
                                                 คะแนนเดิมก่อนแก้ไข: <strong>{sub.previousScore}</strong>/{activeAssignment.points}
                                               </span>
                                             )}
                                           </div>
                                           <button
                                             type="button"
                                             onClick={() => handleGradeFileSubmission(sub.id, sub.previousScore ?? sub.score, activeAssignment.points)}
                                             className="px-2.5 py-1 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow cursor-pointer"
                                           >
                                             ⭐ ให้คะแนน
                                           </button>
                                         </>
                                       )}
                                     </div>
                                   </div>
                                ) : (
                                   <div className="flex items-center gap-2.5 flex-wrap">
                                     {sub.questionScores && Array.isArray(sub.questionScores) && sub.questionScores.length > 0 ? (
                                       <>
                                         <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                                           {(sub.score ?? 0).toFixed(2)} / {activeAssignment.points} คะแนน
                                         </span>
                                         <button
                                           type="button"
                                           onClick={() => router.push(`/teacher/review/${sub.id}`)}
                                           className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-200 dark:border-indigo-800/40 cursor-pointer transition-all active:scale-95 shadow-sm"
                                           title="คลิกเพื่อแก้ไขคะแนนรายข้อ"
                                         >
                                           ✏️ แก้ไขคะแนน
                                         </button>
                                       </>
                                     ) : (
                                       <>
                                         <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 font-bold text-xs">
                                           รอตรวจคะแนน
                                         </span>
                                         <button
                                           type="button"
                                           onClick={() => router.push(`/teacher/review/${sub.id}`)}
                                           className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-sm"
                                           title="คลิกเพื่อเปิดหน้าตรวจคำตอบและให้คะแนนรายข้อ"
                                         >
                                           ⭐ ตรวจคำตอบรายข้อ
                                         </button>
                                       </>
                                     )}
                                   </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4}>
                            <EmptyState
                              illustration="file"
                              variant="compact"
                              accent="slate"
                              title="ยังไม่มีการส่งงานสำหรับรายการนี้"
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        courseAssignments.length === 0 ? (
          <EmptyState
            illustration="file"
            variant="hero"
            accent="indigo"
            title="ยังไม่มีงานหรือควิซการทดสอบ"
            description="คุณครูสามารถกดสร้างงานใหม่ เพื่อมอบหมายโจทย์ต่างๆ หรือทำชุดคำถามให้เรียนรู้ได้"
          />
        ) : (
          <div className="space-y-6">
            {groupedAssignments.map((group, gIdx) => (
              <div key={group.lessonId || `unassigned-${gIdx}`} className="space-y-3">
                {/* Lesson Header */}
                <div className="flex items-center gap-2 border-b pb-2 text-left" style={{ borderColor: tx.borderS }}>
                  <BookOpen className="h-4 w-4 text-indigo-500 shrink-0" />
                  <div className="truncate">
                    <h4 className="font-extrabold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 truncate">
                      {group.lessonTitle}
                    </h4>
                    {group.chapterTopicBreadcrumb && (
                      <p className="text-[10px] truncate" style={{ color: tx.muted }}>
                        {group.chapterTopicBreadcrumb}
                      </p>
                    )}
                  </div>
                  <span className="ml-auto text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" style={{ color: tx.muted }}>
                    {group.items.length} รายการ
                  </span>
                </div>

                {/* Cards for this lesson */}
                <div className="grid grid-cols-1 gap-4">
                  {group.items.map((a) => (
                    <div key={a.id} className="rounded-2xl p-5 shadow-sm border text-left space-y-3" style={card.style}>
                      {/* Card Header */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              a.type === 'file'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
                            }`}>
                              {a.type === 'file' ? 'ส่งไฟล์' : 'Quiz แบบทดสอบ'}
                            </span>
                            <span className="text-[10px]" style={{ color: tx.faint }}>
                              สร้างเมื่อ {formatThaiDate(a.createdAt)}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm sm:text-base">{a.title}</h4>
                          {a.type === 'file' ? (
                            <p className="text-xs line-clamp-2" style={{ color: tx.muted }}><strong>คำสั่ง:</strong> {a.instructions}</p>
                          ) : (
                            <p className="text-xs" style={{ color: tx.muted }}>
                              <strong>ข้อสอบ:</strong> {a.questions?.length} ข้อ · <strong>เวลาทำ:</strong> {a.timeLimit} นาที
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0 flex flex-col justify-between items-end gap-2">
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-indigo-500 dark:text-indigo-400">{a.points} คะแนนเต็ม</p>
                            <p className="text-[10px] mt-1" style={{ color: tx.faint }}>ครบกำหนด: {a.closeAt ? formatThaiDateTime(a.closeAt) : formatThaiDate(a.dueDate)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewingAssignmentId(a.id)}
                            className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow transition-all cursor-pointer flex items-center gap-1 btn-press"
                          >
                            <Users className="h-3 w-3" /> ดูการส่งงาน
                          </button>
                        </div>
                      </div>

                      {/* Assignment Control Status Bar & Settings Button */}
                      <div className="flex items-center justify-between border-t pt-3 mt-3 flex-wrap gap-2" style={{ borderColor: tx.borderS }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                            a.isOpen !== false
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                          }`}>
                            {a.isOpen !== false ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            {a.isOpen !== false ? 'เปิดรับส่งงานอยู่' : 'ปิดรับส่งงาน'}
                          </span>
                          {a.showScores === false && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 flex items-center gap-1">
                              <EyeOff className="h-3 w-3" /> ซ่อนคะแนน
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (a.type === "quiz") {
                                setEditingQuiz(a);
                              } else {
                                setEditingAssignment(a);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-200 dark:border-amber-800/50 shadow-xs transition-all cursor-pointer active:scale-95"
                          >
                            <PencilLine className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            <span>{a.type === "quiz" ? "แก้ไขควิซ" : "แก้ไขงาน"}</span>
                          </button>
                          {a.type === "quiz" && (
                            <button
                              type="button"
                              onClick={() => startCopyQuiz(a)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-200 dark:border-purple-800/50 shadow-xs transition-all cursor-pointer active:scale-95"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span>คัดลอก Quiz</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteAssignment(a)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800/50 shadow-xs transition-all cursor-pointer active:scale-95"
                            title={`ลบ${a.type === "quiz" ? "ควิซ" : "งาน"}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>ลบ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setManagingAssignment(a)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800/50 shadow-xs transition-all cursor-pointer active:scale-95"
                          >
                            <Settings className="h-3.5 w-3.5 text-indigo-500" />
                            <span>ตั้งค่า & ควบคุมงาน</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Assignment Controls Modal */}
      {managingAssignment && (
        <AssignmentControlModal
          key={managingAssignment.id}
          assignment={managingAssignment}
          onClose={() => setManagingAssignment(null)}
        />
      )}

      {/* Edit Assignment/Quiz Modal */}
      {editingAssignment && (
        <EditAssignmentModal
          key={editingAssignment.id}
          assignment={editingAssignment}
          onClose={() => setEditingAssignment(null)}
          lessons={courseLessons}
        />
      )}
    </div>
  );
}
