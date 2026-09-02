import React, { useMemo } from "react";
import { Award, BookOpen, ClipboardList, FileText, Trophy } from "lucide-react";
import { tx } from "../../lib/theme";
import type { Assignment, StudentSubmission } from "../../context/UserContext";

interface CourseScoresPanelProps {
  assignments: Assignment[];
  submissions: StudentSubmission[];
  currentUserId: string | null;
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(2);
}

export function CourseScoresPanel({ assignments, submissions, currentUserId }: CourseScoresPanelProps) {
  const scoreRows = useMemo(() => assignments.map((assignment) => {
    const latestSubmission = submissions
      .filter((submission) => submission.assignmentId === assignment.id && submission.studentId === currentUserId)
      .reduce<StudentSubmission | undefined>(
        (latest, submission) => !latest || submission.submittedAt >= latest.submittedAt ? submission : latest,
        undefined,
      );
    const score = latestSubmission?.score;
    const hasPublishedScore = assignment.showScores !== false && typeof score === "number" && Number.isFinite(score);
    return { assignment, latestSubmission, score: hasPublishedScore ? score : undefined };
  }), [assignments, currentUserId, submissions]);

  const totalPossible = scoreRows.reduce((total, { assignment }) => total + Number(assignment.points || 0), 0);
  const totalEarned = scoreRows.reduce((total, row) => total + (row.score ?? 0), 0);
  const percentage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
  const publishedScoreCount = scoreRows.filter((row) => row.score !== undefined).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border p-4" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: tx.muted }}>
            <Award className="h-4 w-4 text-indigo-500" /> คะแนนรวม
          </div>
          <p className="mt-2 text-2xl font-black" style={{ color: tx.primary }}>
            {formatScore(totalEarned)} <span className="text-sm font-bold" style={{ color: tx.muted }}>/ {formatScore(totalPossible)}</span>
          </p>
        </div>
        <div className="rounded-2xl border p-4" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: tx.muted }}>
            <Trophy className="h-4 w-4 text-amber-500" /> คิดเป็นเปอร์เซ็นต์
          </div>
          <p className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">{percentage.toFixed(2)}%</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: tx.muted }}>
            <ClipboardList className="h-4 w-4 text-emerald-500" /> คะแนนที่ประกาศแล้ว
          </div>
          <p className="mt-2 text-2xl font-black" style={{ color: tx.primary }}>{publishedScoreCount} <span className="text-sm font-bold" style={{ color: tx.muted }}>/ {scoreRows.length} งาน</span></p>
        </div>
      </div>

      <div className="rounded-3xl border overflow-hidden" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
        <div className="p-5 border-b flex items-center gap-2" style={{ borderColor: tx.borderS }}>
          <BookOpen className="h-5 w-5 text-indigo-500" />
          <div>
            <h3 className="font-extrabold text-sm" style={{ color: tx.primary }}>ผลคะแนนรายงานและแบบทดสอบ</h3>
            <p className="text-[11px] mt-0.5" style={{ color: tx.muted }}>เปอร์เซ็นต์คำนวณจากคะแนนเต็มของงานทั้งหมดในรายวิชานี้</p>
          </div>
        </div>

        {scoreRows.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: tx.muted }}>ยังไม่มีงานหรือแบบทดสอบในรายวิชานี้</div>
        ) : (
          <div className="divide-y" style={{ borderColor: tx.borderS }}>
            {scoreRows.map(({ assignment, latestSubmission, score }) => (
              <div key={assignment.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {assignment.type === "quiz" ? <Trophy className="h-4 w-4 text-purple-500" /> : <FileText className="h-4 w-4 text-blue-500" />}
                    <p className="font-bold text-sm truncate" style={{ color: tx.primary }}>{assignment.title}</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${assignment.type === "quiz" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"}`}>
                      {assignment.type === "quiz" ? "ควิซ" : "งานส่งไฟล์"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color: tx.muted }}>
                    {latestSubmission ? "ส่งแล้ว" : "ยังไม่ได้ส่ง"} · คะแนนเต็ม {formatScore(Number(assignment.points || 0))} คะแนน
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  {score !== undefined ? (
                    <p className="font-black text-lg text-indigo-600 dark:text-indigo-400">{formatScore(score)} <span className="text-xs" style={{ color: tx.muted }}>/ {formatScore(Number(assignment.points || 0))}</span></p>
                  ) : (
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{assignment.showScores === false ? "รอประกาศคะแนน" : latestSubmission ? "รอตรวจคะแนน" : "ยังไม่มีคะแนน"}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
