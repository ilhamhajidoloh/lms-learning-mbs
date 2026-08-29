import React from "react";
import { tx, card } from "../../lib/theme";
import type { Assignment, StudentSubmission } from "../../context/UserContext";
import { useUser } from "../../context/UserContext";
import { EmptyState } from "../../components/EmptyState";
import { Lock, Clock, PencilLine, Undo2, RotateCcw, CheckCircle2 } from "lucide-react";
import Swal from "sweetalert2";

interface TaskListPanelProps {
  courseAssignments: Assignment[];
  submissions: StudentSubmission[];
  currentUserId: string | null;
  setSelectedAssignmentId: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentQuizQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setQuizAnswers: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setFileNameInput: React.Dispatch<React.SetStateAction<string>>;
  setQuizRetakingId: (id: string | null) => void;
}

export function TaskListPanel({
  courseAssignments, submissions, currentUserId, setSelectedAssignmentId, setCurrentQuizQuestionIndex, setQuizAnswers, setFileNameInput, setQuizRetakingId,
}: TaskListPanelProps) {
  const { cancelFileSubmission } = useUser();

  const formatWindowTime = (iso?: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("th-TH", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const handleCancelFile = async (a: Assignment, sub: StudentSubmission) => {
    const result = await Swal.fire({
      title: "ยกเลิกการส่งไฟล์?",
      text: "ไฟล์ที่ส่งไว้จะถูกลบออก และต้องส่งใหม่อีกครั้ง",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยกเลิกการส่ง",
      cancelButtonText: "กลับ",
      confirmButtonColor: "#ef4444",
      background: card.style.background ? String(card.style.background) : undefined,
      color: tx.primary,
    });
    if (!result.isConfirmed) return;
    await cancelFileSubmission(sub.id);
  };

  return (
    <div className="space-y-3">
      <h4 className="font-bold text-xs uppercase tracking-wide" style={{ color: tx.muted }}>งานและข้อสอบสำหรับวิชานี้</h4>
      {courseAssignments.length === 0 ? (
        <EmptyState
          illustration="clipboard"
          variant="compact"
          accent="slate"
          title="ไม่มีภาระงานหรือข้อสอบให้ดำเนินการส่งในบทเรียนนี้"
        />
      ) : (
        courseAssignments.map((a) => {
          const mySubs = submissions.filter(s => s.assignmentId === a.id && s.studentId === currentUserId);
          const sub = mySubs[mySubs.length - 1];
          const attemptCount = mySubs.length;
          // Per-assignment settings (fallback to show everything if not set)
          const showScores = a.showScores !== false;
          const quizReviewMode = a.quizReviewMode ?? "full";
          const attemptLimit = a.quizAttemptLimit ?? 0;

          // Scheduled open/close window
          const nowMs = Date.now();
          const openAtMs = a.openAt ? new Date(a.openAt).getTime() : null;
          const closeAtMs = a.closeAt ? new Date(a.closeAt).getTime() : null;
          const notOpenYet = openAtMs !== null && nowMs < openAtMs;
          const alreadyClosed = closeAtMs !== null && nowMs > closeAtMs;
          const isOpen = a.isOpen !== false && !notOpenYet && !alreadyClosed;
          const quizExhausted = a.type === "quiz" && attemptLimit > 0 && attemptCount >= attemptLimit;

          let subStatusLabel = "ค้างส่งงาน";
          if (sub) {
            if (!showScores) {
              subStatusLabel = "ส่งแล้ว (รอประกาศคะแนน)";
            } else if (sub.type === "quiz") {
              subStatusLabel = `ทำแล้วครั้งที่ ${attemptCount} (${sub.score !== undefined && sub.score !== null ? sub.score : "รอตรวจ"}/${a.points})`;
            } else {
              if (sub.score !== undefined && sub.score !== null) {
                subStatusLabel = `ส่งแล้ว (${sub.score}/${a.points} คะแนน)`;
              } else if (sub.previousScore !== undefined && sub.previousScore !== null) {
                subStatusLabel = "ส่งแล้ว (แก้ไขไฟล์ - รอตรวจคะแนนใหม่)";
              } else {
                subStatusLabel = "ส่งแล้ว (รอตรวจคะแนน)";
              }
            }
          }

          const showLockedBadge = !isOpen && (!notOpenYet && !alreadyClosed);
          const windowLabel = notOpenYet
            ? `จะเปิดให้ทำวันที่ ${formatWindowTime(a.openAt)}`
            : alreadyClosed
              ? "หมดเวลาส่งแล้ว"
              : "";

          return (
            <div key={a.id} className={`p-4 rounded-xl border flex flex-col gap-4 text-xs ${isOpen ? "" : "opacity-70"}`} style={{ borderColor: tx.borderS }}>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      a.type === 'file' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50' : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50'
                    }`}>
                      {a.type === 'file' ? 'ส่งไฟล์' : 'Quiz'}
                    </span>
                    <span className="font-bold" style={{ color: tx.primary }}>{a.title}</span>
                    {!isOpen && (
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold flex items-center gap-1 ${
                        alreadyClosed
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {notOpenYet ? <Clock className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                        {notOpenYet ? "ยังไม่เปิด" : "ปิดอยู่"}
                      </span>
                    )}
                    {quizExhausted && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 text-slate-500 dark:bg-slate-800 flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" /> ทำครบแล้ว ({attemptLimit} ครั้ง)
                      </span>
                    )}
                  </div>
                  <p className="text-[10px]" style={{ color: tx.muted }}>
                    กำหนดส่ง: {a.dueDate} · คะแนนเต็ม: {a.points} คะแนน
                    {attemptLimit > 0 && a.type === "quiz" && <span> · ทำได้ {attemptLimit} ครั้ง</span>}
                  </p>
                  {windowLabel && <p className="text-[10px] font-bold" style={{ color: notOpenYet ? tx.secondary : "#ef4444" }}>{windowLabel}</p>}
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center flex-wrap">
                  <span className={`px-2 py-1 rounded-[8px] text-[10px] font-bold ${
                    sub ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50"
                  }`}>
                    {subStatusLabel}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {a.type === "quiz" ? (
                <div className="flex flex-wrap items-center gap-2">
                  {sub && quizReviewMode !== "none" && (
                    <button onClick={() => { setSelectedAssignmentId(a.id); }} className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-indigo-500 font-bold transition-all text-[11px] cursor-pointer btn-press">
                      {quizReviewMode === "answers_only" ? "ดูคำตอบของฉัน" : "ดูผลคะแนน & เฉลย"}
                    </button>
                  )}
                  {sub && isOpen && !quizExhausted ? (
                    <button onClick={() => {
                      setSelectedAssignmentId(a.id);
                      setQuizRetakingId(a.id);
                      setCurrentQuizQuestionIndex(0);
                      setQuizAnswers({});
                    }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-[11px] cursor-pointer shadow-md btn-press flex items-center gap-1.5">
                      <RotateCcw className="h-3 w-3" /> ทำข้อสอบอีกครั้ง ({attemptLimit > 0 ? `${attemptCount}/${attemptLimit}` : `ครั้งที่ ${attemptCount + 1}`})
                    </button>
                  ) : !sub && isOpen ? (
                    <button onClick={() => {
                      setSelectedAssignmentId(a.id);
                      setCurrentQuizQuestionIndex(0);
                      setQuizAnswers({});
                    }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-[11px] cursor-pointer shadow-md btn-press">
                      เริ่มทำข้อสอบ
                    </button>
                  ) : !isOpen ? (
                    <span className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 text-[11px] font-bold flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> งานปิด
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {sub && (
                    <span className="text-[10px]" style={{ color: tx.muted }}>ส่งไฟล์: <span className="font-mono">{sub.fileName}</span></span>
                  )}
                  {sub && isOpen && a.allowEditSubmission && (
                    <button onClick={() => { setSelectedAssignmentId(a.id); setFileNameInput(sub.fileName ?? ""); }} className="px-3.5 py-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 text-indigo-600 dark:text-indigo-300 font-bold transition-all text-[11px] cursor-pointer btn-press flex items-center gap-1.5">
                      <PencilLine className="h-3 w-3" /> แก้ไขไฟล์
                    </button>
                  )}
                  {sub && isOpen && a.allowCancelSubmission && (
                    <button onClick={() => handleCancelFile(a, sub)} className="px-3.5 py-2 rounded-xl bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-200 text-rose-600 dark:text-rose-300 font-bold transition-all text-[11px] cursor-pointer btn-press flex items-center gap-1.5">
                      <Undo2 className="h-3 w-3" /> ยกเลิกการส่ง
                    </button>
                  )}
                  {!sub && isOpen ? (
                    <button onClick={() => { setSelectedAssignmentId(a.id); setFileNameInput(""); }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-[11px] cursor-pointer shadow-md btn-press">
                      อัพโหลดส่งการบ้าน
                    </button>
                  ) : !isOpen ? (
                    <span className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 text-[11px] font-bold flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> งานปิด
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
