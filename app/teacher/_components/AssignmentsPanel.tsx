import React from "react";
import { Plus, ArrowLeft, Users, FileText } from "lucide-react";
import { tx, card } from "../../lib/theme";
import type { Assignment, StudentSubmission } from "../../context/UserContext";

interface SubmissionRow {
  id: string;
  name: string;
  submission: StudentSubmission;
}

interface AssignmentsPanelProps {
  courseAssignments: Assignment[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  viewingAssignmentId: string | null;
  setViewingAssignmentId: (id: string | null) => void;
  setViewingQuizSub: (sub: StudentSubmission | null) => void;
  setShowForm: (show: boolean) => void;
}

export function AssignmentsPanel({
  courseAssignments,
  assignments,
  submissions,
  viewingAssignmentId,
  setViewingAssignmentId,
  setViewingQuizSub,
  setShowForm,
}: AssignmentsPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">งานที่มอบหมายทั้งหมดในวิชานี้</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer">
          <Plus className="h-4 w-4" /> สร้างงาน / ควิซใหม่
        </button>
      </div>




      {/* Assignments List */}
      {viewingAssignmentId ? (
        (() => {
          const activeAssignment = assignments.find(a => a.id === viewingAssignmentId)!;
          const activeSubmissions = submissions.filter(s => s.assignmentId === viewingAssignmentId);
          const submissionRows = activeSubmissions.reduce<SubmissionRow[]>((rows, submission) => {
            if (!rows.some(row => row.id === submission.studentId)) {
              rows.push({
                id: submission.studentId,
                name: submission.studentName,
                submission,
              });
            }
            return rows;
          }, []);

          const totalStudents = Math.max(new Set(activeSubmissions.map(submission => submission.studentId)).size, 1);
          const submissionsCount = activeSubmissions.length;
          const submissionRate = ((submissionsCount / totalStudents) * 100).toFixed(0);

          const quizSubs = activeSubmissions.filter(s => s.type === "quiz");
          const classAverage = quizSubs.length > 0
            ? (quizSubs.reduce((acc, curr) => acc + (curr.score || 0), 0) / quizSubs.length).toFixed(1)
            : null;

          return (
            <div className="space-y-6 text-left animate-fadeIn">
              <button onClick={() => setViewingAssignmentId(null)} className="flex items-center gap-2 text-xs font-bold hover:text-indigo-500 transition-colors">
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
                    คะแนนเต็ม {activeAssignment.points} คะแนน · กำหนดส่ง {activeAssignment.dueDate}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border text-center" style={card.style}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ส่งแล้ว / ทั้งหมด</p>
                  <p className="text-2xl font-black text-indigo-500 mt-1">{submissionsCount} / {totalStudents} คน</p>
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
                    {activeAssignment.type === 'file' ? 'ไฟล์ PDF / รูปภาพ' : (classAverage !== null ? `${classAverage} / ${activeAssignment.questions?.length}` : '-')}
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
                                {new Date(sub.submittedAt).toLocaleString("th-TH")}
                              </td>
                              <td className="py-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50">
                                  ส่งแล้ว
                                </span>
                              </td>
                              <td className="py-3 font-semibold">
                                {sub.type === "file" ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs line-clamp-1 max-w-[150px] font-mono" style={{ color: tx.muted }}>{sub.fileName}</span>
                                    <button type="button" onClick={() => alert(`จำลองการเปิดไฟล์: ${sub.fileName}`)} className="text-[10px] text-indigo-500 hover:underline cursor-pointer">เปิดดูไฟล์</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <span className="text-emerald-600 font-bold">{sub.score} / {activeAssignment.questions?.length} คะแนน</span>
                                    <button type="button" onClick={() => setViewingQuizSub(sub)} className="text-[10px] text-indigo-500 hover:underline cursor-pointer">ตรวจคำตอบ</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm" style={{ color: tx.faint }}>
                            ยังไม่มีการส่งงานสำหรับรายการนี้
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
          <div className="rounded-3xl p-12 text-center border border-dashed flex flex-col items-center justify-center" style={{ borderColor: tx.borderS }}>
            <FileText className="h-10 w-10 mb-2" style={{ color: tx.faint }} />
            <p className="font-bold text-sm">ยังไม่มีงานหรือควิซการทดสอบ</p>
            <p className="text-xs mt-1" style={{ color: tx.muted }}>คุณครูสามารถกดสร้างงานใหม่ เพื่อมอบหมายโจทย์ต่างๆ หรือทำชุดคำถามให้เรียนรู้ได้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {courseAssignments.map((a) => (
              <div key={a.id} className="rounded-2xl p-5 shadow-sm border text-left flex justify-between items-start" style={card.style}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      a.type === 'file'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
                    }`}>
                      {a.type === 'file' ? 'ส่งไฟล์' : 'Quiz แบบทดสอบ'}
                    </span>
                    <span className="text-[10px]" style={{ color: tx.faint }}>
                      สร้างเมื่อ {new Date(a.createdAt).toLocaleDateString("th-TH")}
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

                <div className="text-right shrink-0 flex flex-col justify-between items-end min-h-[70px]">
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-indigo-500 dark:text-indigo-400">{a.points} คะแนนเต็ม</p>
                    <p className="text-[10px] mt-1" style={{ color: tx.faint }}>ครบกำหนด: {a.dueDate}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingAssignmentId(a.id)}
                    className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Users className="h-3 w-3" /> ดูการส่งงาน
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
