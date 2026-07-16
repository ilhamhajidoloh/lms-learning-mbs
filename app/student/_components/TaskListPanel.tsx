import React from "react";
import { tx } from "../../lib/theme";
import type { Assignment, StudentSubmission } from "../../context/UserContext";
import { EmptyState } from "../../components/EmptyState";

interface TaskListPanelProps {
  courseAssignments: Assignment[];
  submissions: StudentSubmission[];
  currentUserId: string | null;
  setSelectedAssignmentId: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentQuizQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setQuizAnswers: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setFileNameInput: React.Dispatch<React.SetStateAction<string>>;
}

export function TaskListPanel({
  courseAssignments, submissions, currentUserId, setSelectedAssignmentId, setCurrentQuizQuestionIndex, setQuizAnswers, setFileNameInput,
}: TaskListPanelProps) {
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
          const sub = submissions.find(s => s.assignmentId === a.id && s.studentId === currentUserId);
          return (
            <div key={a.id} className="p-4 rounded-xl border flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs" style={{ borderColor: tx.borderS }}>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    a.type === 'file' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50' : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50'
                  }`}>
                    {a.type === 'file' ? 'ส่งไฟล์' : 'Quiz'}
                  </span>
                  <span className="font-bold" style={{ color: tx.primary }}>{a.title}</span>
                </div>
                <p className="text-[10px]" style={{ color: tx.muted }}>กำหนดส่ง: {a.dueDate} · คะแนนเต็ม: {a.points} คะแนน</p>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <span className={`px-2 py-1 rounded-[8px] text-[10px] font-bold ${
                  sub ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50"
                }`}>
                  {sub ? (sub.type === "quiz" ? `ทำแล้ว (ได้ ${sub.score}/${a.points})` : "ส่งการบ้านแล้ว") : "ค้างส่งงาน"}
                </span>

                {a.type === "quiz" ? (
                  sub ? (
                    <button onClick={() => { setSelectedAssignmentId(a.id); }} className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-indigo-500 font-bold transition-all text-[11px] cursor-pointer btn-press">
                      ดูผลคะแนน & เฉลย
                    </button>
                  ) : (
                    <button onClick={() => {
                      setSelectedAssignmentId(a.id);
                      setCurrentQuizQuestionIndex(0);
                      setQuizAnswers({});
                    }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-[11px] cursor-pointer shadow-md btn-press">
                      เริ่มทำข้อสอบ
                    </button>
                  )
                ) : (
                  sub ? (
                    <span className="text-[10px]" style={{ color: tx.muted }}>ส่งไฟล์: <span className="font-mono">{sub.fileName}</span></span>
                  ) : (
                    <button onClick={() => { setSelectedAssignmentId(a.id); setFileNameInput(""); }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-[11px] cursor-pointer shadow-md btn-press">
                      อัพโหลดส่งการบ้าน
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
