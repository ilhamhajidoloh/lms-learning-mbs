import React from "react";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { tx, card } from "../../lib/theme";
import type { Assignment, Enrollment, StudentSubmission } from "../../context/UserContext";
import { alert as swalAlert } from "../../../lib/swal";

interface StudentsPanelProps {
  enrollments: Enrollment[];
  courseId: string;
  submissions: StudentSubmission[];
  courseAssignments: Assignment[];
  viewingStudentId: string | null;
  setViewingStudentId: (id: string | null) => void;
  setViewingQuizSub: (sub: StudentSubmission | null) => void;
  setShowAddStudentModal: (show: boolean) => void;
  teacherRemoveStudent: (courseId: string, studentId: string) => Promise<{ success: boolean; error?: string }>;
}

export function StudentsPanel({
  enrollments,
  courseId,
  submissions,
  courseAssignments,
  viewingStudentId,
  setViewingStudentId,
  setViewingQuizSub,
  setShowAddStudentModal,
  teacherRemoveStudent,
}: StudentsPanelProps) {
  const courseEnrollments = enrollments.filter(e => e.courseId === courseId);
  return viewingStudentId ? (
    (() => {
      const studentName = courseEnrollments.find(s => s.studentId === viewingStudentId)?.studentName || "นักเรียน";

      const studentSubs = submissions.filter(s => s.studentId === viewingStudentId);

      return (
        <div className="space-y-6 text-left animate-fadeIn">
          <button onClick={() => setViewingStudentId(null)} className="flex items-center gap-2 text-xs font-bold hover:text-indigo-500 transition-colors">
            <ArrowLeft className="h-4 w-4" /> กลับรายชื่อนักเรียนทั้งหมด
          </button>

          <div className="rounded-3xl p-6 shadow-sm border space-y-6" style={card.style}>
            <div className="flex items-center gap-4 border-b pb-4" style={{ borderColor: tx.borderS }}>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                {studentName.charAt(0)}
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg">{studentName}</h3>
                <p className="text-xs" style={{ color: tx.muted }}>รหัสนักเรียน: {viewingStudentId}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-sm">รายการงานและประวัติการส่ง</h4>
              {courseAssignments.length === 0 ? (
                <p className="text-xs" style={{ color: tx.muted }}>ยังไม่มีงานมอบหมายในระบบ</p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {courseAssignments.map((a) => {
                    const sub = studentSubs.find(s => s.assignmentId === a.id);
                    return (
                      <div key={a.id} className="p-4 rounded-xl border flex justify-between items-center text-xs" style={{ borderColor: tx.borderS }}>
                        <div className="space-y-1">
                          <p className="font-bold">{a.title}</p>
                          <p className="text-[10px]" style={{ color: tx.muted }}>กำหนดส่ง: {a.dueDate}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50"
                          }`}>
                            {sub ? "ส่งแล้ว" : "ยังไม่ส่ง"}
                          </span>
                          {sub && (
                            sub.type === "file" ? (
                              <button type="button" onClick={() => alert(`จำลองการเปิดไฟล์: ${sub.fileName}`)} className="text-[10px] text-indigo-500 hover:underline cursor-pointer">ดูไฟล์ที่ส่ง</button>
                            ) : (
                              <button type="button" onClick={() => setViewingQuizSub(sub)} className="text-[10px] text-indigo-500 hover:underline cursor-pointer">ตรวจคำตอบ ({sub.score} คะแนน)</button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    })()
  ) : (
    (() => {
      return (
        <div className="rounded-3xl p-6 shadow-sm border space-y-4" style={card.style}>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b pb-4 mb-4" style={{ borderColor: tx.borderS }}>
            <div>
              <h3 className="font-bold text-lg">นักเรียนที่กำลังเรียนในขณะนี้</h3>
              <p className="text-[11px]" style={{ color: tx.muted }}>* คลิกที่ชื่อนักเรียนแต่ละคนเพื่อดูประวัติการส่งงานและคะแนนอย่างละเอียด</p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddStudentModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
            >
              <Plus className="h-4 w-4" /> ดึงนักเรียนเข้าคอร์ส
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead>
                <tr className="border-b" style={{ borderColor: tx.borderS }}>
                  <th className="pb-2 font-bold" style={{ color: tx.muted }}>รหัสนักเรียน</th>
                  <th className="pb-2 font-bold" style={{ color: tx.muted }}>ชื่อ-นามสกุล</th>
                  <th className="pb-2 font-bold" style={{ color: tx.muted }}>สถานะการส่งงาน</th>
                  <th className="pb-2 font-bold" style={{ color: tx.muted }}>คะแนนเฉลี่ยควิซ</th>
                  <th className="pb-2 font-bold" style={{ color: tx.muted }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {courseEnrollments.map((e, idx) => {
                  const studentAssignments = courseAssignments;
                  const studentSubs = submissions.filter(sub => sub.studentId === e.studentId && studentAssignments.some(a => a.id === sub.assignmentId));
                  const hasPending = studentAssignments.some(a => !studentSubs.some(sub => sub.assignmentId === a.id));
                  const displayStatus = hasPending ? "ค้างส่งงาน" : "ส่งงานครบ";

                  const quizSubs = studentSubs.filter(sub => sub.type === "quiz" && sub.score !== undefined);
                  const avgScore = quizSubs.length > 0
                    ? (quizSubs.reduce((acc, sub) => acc + (sub.score || 0), 0) / quizSubs.length).toFixed(1) + " คะแนน"
                    : "-";

                  return (
                    <tr key={idx}
                      onClick={() => e.studentId && setViewingStudentId(e.studentId)}
                      className="border-b last:border-b-0 hover:bg-slate-200/40 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                      style={{ borderColor: tx.borderS }}>
                      <td className="py-3 font-mono">{e.studentId}</td>
                      <td className="py-3 font-bold">{e.studentName} ({e.studentUsername})</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          displayStatus === "ส่งงานครบ" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                        }`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="py-3 text-indigo-500 font-bold">
                        {avgScore}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            if (e.studentId && courseId) {
                              const confirmed = await swalAlert.confirm(
                                "ยืนยันการลบนักเรียน",
                                `คุณต้องการลบนักเรียน "${e.studentName}" ออกจากคอร์สเรียนใช่หรือไม่?`
                              );
                              if (confirmed) {
                                await teacherRemoveStudent(courseId, e.studentId);
                              }
                            }
                          }}
                          className="px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] rounded-lg shadow transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> ลบออก
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {courseEnrollments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-bold border border-dashed rounded-2xl" style={{ borderColor: tx.borderS }}>
                      ยังไม่มีนักเรียนลงทะเบียนในคอร์สนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

          </div>
        </div>
      );
    })()
  );
}
