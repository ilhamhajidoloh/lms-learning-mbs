import React, { useEffect, useState } from "react";
import { tx, card } from "../../lib/theme";
import type { Assignment, StudentSubmission } from "../../context/UserContext";
import { useUser } from "../../context/UserContext";
import { EmptyState } from "../../components/EmptyState";
import { Lock, Clock, PencilLine, Undo2, RotateCcw, CheckCircle2 } from "lucide-react";
import Swal from "sweetalert2";
import { formatThaiDate, formatThaiDateTime } from "../../lib/date";

interface TaskListPanelProps {
  courseAssignments: Assignment[];
  submissions: StudentSubmission[];
  currentUserId: string | null;
  setSelectedAssignmentId: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentQuizQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setQuizAnswers: React.Dispatch<React.SetStateAction<Record<number, number | string | Record<number, number>>>>;
  setFileNameInput: React.Dispatch<React.SetStateAction<string>>;
  setQuizRetakingId: (id: string | null) => void;
}

function getSubmissionDeadlineMs(closeAt?: string, dueDate?: string): number | null {
  if (closeAt) {
    const closeAtMs = new Date(closeAt).getTime();
    if (!Number.isNaN(closeAtMs)) return closeAtMs;
  }
  if (!dueDate) return null;

  const date = dueDate.slice(0, 10);
  const dueAtMs = new Date(`${date}T23:59:59`).getTime();
  return Number.isNaN(dueAtMs) ? null : dueAtMs;
}

function formatRemainingTime(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days} วัน ${hours} ชม.`;
  if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
  return `${minutes}:${String(seconds).padStart(2, "0")} นาที`;
}

export function TaskListPanel({
  courseAssignments, submissions, currentUserId, setSelectedAssignmentId, setCurrentQuizQuestionIndex, setQuizAnswers, setFileNameInput, setQuizRetakingId,
}: TaskListPanelProps) {
  const { cancelFileSubmission } = useUser();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

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
          // Always show the most recent attempt, regardless of the API response order.
          const sub = mySubs.reduce<StudentSubmission | undefined>(
            (latest, candidate) => !latest || candidate.submittedAt >= latest.submittedAt ? candidate : latest,
            undefined,
          );
          const attemptCount = mySubs.length;
          // Per-assignment settings (fallback to show everything if not set)
          const showScores = a.showScores !== false;
          const quizReviewMode = a.quizReviewMode ?? "full";
          const attemptLimit = a.quizAttemptLimit ?? 0;

          // Scheduled open/close window
          const openAtMs = a.openAt ? new Date(a.openAt).getTime() : null;
          const deadlineMs = getSubmissionDeadlineMs(a.closeAt, a.dueDate);
          const notOpenYet = openAtMs !== null && nowMs < openAtMs;
          const alreadyClosed = deadlineMs !== null && nowMs > deadlineMs;
          const isOpen = a.isOpen !== false && !notOpenYet && !alreadyClosed;
          const quizExhausted = a.type === "quiz" && attemptLimit > 0 && attemptCount >= attemptLimit;
          const remainingMs = deadlineMs !== null ? deadlineMs - nowMs : null;

          let subStatusLabel = "ค้างส่งงาน";
          if (sub) {
            if (!showScores) {
              subStatusLabel = "ส่งแล้ว (รอประกาศคะแนน)";
            } else if (sub.type === "quiz") {
              const scoreText = sub.score !== undefined && sub.score !== null
                ? (typeof sub.score === "number" ? sub.score.toFixed(2) : sub.score)
                : "รอตรวจ";
              subStatusLabel = `ทำแล้วครั้งที่ ${attemptCount} (${scoreText}/${a.points})`;
            } else {
              if (sub.score !== undefined && sub.score !== null) {
                subStatusLabel = `ส่งแล้ว (${sub.score.toFixed(2)}/${a.points} คะแนน)`;
              } else if (sub.previousScore !== undefined && sub.previousScore !== null) {
                subStatusLabel = "ส่งแล้ว (แก้ไขไฟล์ - รอตรวจคะแนนใหม่)";
              } else {
                subStatusLabel = "ส่งแล้ว (รอตรวจคะแนน)";
              }
            }
          }

          const displayDeadline = a.closeAt ? formatThaiDateTime(a.closeAt) : formatThaiDate(a.dueDate);
          const windowLabel = notOpenYet
            ? `จะเปิดให้ทำวันที่ ${formatThaiDateTime(a.openAt)}`
            : alreadyClosed
              ? `หมดเวลาส่งแล้ว (ปิดรับส่งเมื่อ ${a.closeAt ? formatThaiDateTime(a.closeAt) : formatThaiDate(a.dueDate)})`
              : "";

          return (
            <div key={a.id} className={`p-3 md:p-4 rounded-xl border flex flex-col gap-3 md:gap-4 text-xs ${isOpen ? "" : "opacity-70"}`} style={{ borderColor: tx.borderS }}>
              <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 md:gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      a.type === 'file' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50' : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50'
                    }`}>
                      {a.type === 'file' ? 'ส่งไฟล์' : 'Quiz'}
                    </span>
                    <span className="font-bold text-[11px] md:text-xs" style={{ color: tx.primary }}>{a.title}</span>
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
                    กำหนดส่ง: {displayDeadline} · คะแนนเต็ม: {a.points} คะแนน
                    {attemptLimit > 0 && a.type === "quiz" && <span> · ทำได้ {attemptLimit} ครั้ง</span>}
                  </p>
                  {remainingMs !== null && remainingMs > 0 && (
                    <p className={`flex items-center gap-1 text-[10px] font-black ${remainingMs <= 3600000 ? "text-rose-500" : "text-amber-600 dark:text-amber-400"}`}>
                      <Clock className="h-3 w-3" /> เหลือเวลา {formatRemainingTime(remainingMs)}
                    </p>
                  )}
                  {windowLabel && <p className="text-[10px] font-bold" style={{ color: notOpenYet ? tx.secondary : "#ef4444" }}>{windowLabel}</p>}
                </div>

                <div className="flex items-center gap-2 md:gap-3 self-end sm:self-start flex-wrap">
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
                    <button onClick={() => { setSelectedAssignmentId(a.id); setCurrentQuizQuestionIndex(0); }} className="px-3 md:px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-indigo-500 font-bold transition-all text-[11px] cursor-pointer btn-press">
                      <span className="hidden sm:inline">{quizReviewMode === "answers_only" ? "ดูคำตอบของฉัน" : "ดูผลคะแนน & เฉลย"}</span>
                      <span className="sm:hidden">ดูผลคะแนน</span>
                    </button>
                  )}
                  {sub && isOpen && !quizExhausted ? (
                    <button onClick={() => {
                      setSelectedAssignmentId(a.id);
                      setQuizRetakingId(a.id);
                      setCurrentQuizQuestionIndex(0);
                      setQuizAnswers({});
                    }} className="px-3 md:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-[11px] cursor-pointer shadow-md btn-press flex items-center gap-1.5">
                      <RotateCcw className="h-3 w-3" />
                      <span className="hidden sm:inline">ทำข้อสอบอีกครั้ง ({attemptLimit > 0 ? `${attemptCount}/${attemptLimit}` : `ครั้งที่ ${attemptCount + 1}`})</span>
                      <span className="sm:hidden">ทำอีกครั้ง</span>
                    </button>
                  ) : !sub && isOpen ? (
                    <button onClick={() => {
                      setSelectedAssignmentId(a.id);
                      setCurrentQuizQuestionIndex(0);
                      setQuizAnswers({});
                    }} className="px-3 md:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-[11px] cursor-pointer shadow-md btn-press">
                      เริ่มทำข้อสอบ
                    </button>
                  ) : !isOpen ? (
                    <span className="px-3 md:px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 text-[11px] font-bold flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> งานปิด
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2">
                  {sub && (
                    <span className="text-[10px] break-all" style={{ color: tx.muted }}>ส่งไฟล์: <span className="font-mono">{sub.fileName}</span></span>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {sub && isOpen && a.allowEditSubmission && (
                      <button onClick={() => { setSelectedAssignmentId(a.id); setFileNameInput(sub.fileName ?? ""); }} className="px-3 md:px-3.5 py-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 text-indigo-600 dark:text-indigo-300 font-bold transition-all text-[11px] cursor-pointer btn-press flex items-center gap-1.5">
                        <PencilLine className="h-3 w-3" /> แก้ไขไฟล์
                      </button>
                    )}
                    {sub && isOpen && a.allowCancelSubmission && (
                      <button onClick={() => handleCancelFile(a, sub)} className="px-3 md:px-3.5 py-2 rounded-xl bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-200 text-rose-600 dark:text-rose-300 font-bold transition-all text-[11px] cursor-pointer btn-press flex items-center gap-1.5">
                        <Undo2 className="h-3 w-3" /> ยกเลิกการส่ง
                      </button>
                    )}
                    {!sub && isOpen ? (
                      <button onClick={() => { setSelectedAssignmentId(a.id); setFileNameInput(""); }} className="px-3 md:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-[11px] cursor-pointer shadow-md btn-press">
                        อัพโหลดส่งการบ้าน
                      </button>
                    ) : !isOpen ? (
                      <span className="px-3 md:px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 text-[11px] font-bold flex items-center gap-1.5">
                        <Lock className="h-3 w-3" /> งานปิด
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
