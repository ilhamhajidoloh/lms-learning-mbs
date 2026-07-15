import React from "react";
import { ArrowLeft, Shield } from "lucide-react";
import { tx } from "../../lib/theme";
import type { Assignment, Course, Enrollment, Lesson, StudentSubmission } from "../../context/UserContext";
import { AssignmentsPanel } from "./AssignmentsPanel";
import { LessonsPanel } from "./LessonsPanel";
import { StudentsPanel } from "./StudentsPanel";

interface CourseDetailPanelProps {
  selectedCourse: Course;
  setSelectedCourseId: (id: string | null) => void;
  setShowForm: (show: boolean) => void;
  detailTab: "assignments" | "lessons" | "students";
  setDetailTab: (tab: "assignments" | "lessons" | "students") => void;
  setShowEnrollSettingsModal: (show: boolean) => void;

  assignments: Assignment[];
  submissions: StudentSubmission[];
  viewingAssignmentId: string | null;
  setViewingAssignmentId: (id: string | null) => void;
  setViewingQuizSub: (sub: StudentSubmission | null) => void;

  lessons: Lesson[];
  setShowAddLessonModal: (show: boolean) => void;
  setEditingLesson: (lesson: Lesson | null) => void;
  setEditLessonTitle: (v: string) => void;
  setEditLessonDescription: (v: string) => void;
  setEditLessonVideoUrl: (v: string) => void;

  enrollments: Enrollment[];
  viewingStudentId: string | null;
  setViewingStudentId: (id: string | null) => void;
  setShowAddStudentModal: (show: boolean) => void;
  teacherRemoveStudent: (courseId: string, studentId: string) => Promise<{ success: boolean; error?: string }>;
}

export function CourseDetailPanel({
  selectedCourse,
  setSelectedCourseId,
  setShowForm,
  detailTab,
  setDetailTab,
  setShowEnrollSettingsModal,
  assignments,
  submissions,
  viewingAssignmentId,
  setViewingAssignmentId,
  setViewingQuizSub,
  lessons,
  setShowAddLessonModal,
  setEditingLesson,
  setEditLessonTitle,
  setEditLessonDescription,
  setEditLessonVideoUrl,
  enrollments,
  viewingStudentId,
  setViewingStudentId,
  setShowAddStudentModal,
  teacherRemoveStudent,
}: CourseDetailPanelProps) {
  const courseAssignments = assignments.filter(a => a.courseId === selectedCourse.id);

  return (
    <div className="space-y-6 animate-fadeIn text-left">
      {/* Back Button */}
      <button onClick={() => { setSelectedCourseId(null); setShowForm(false); }} className="flex items-center gap-2 font-bold hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors mb-4">
        <ArrowLeft className="h-5 w-5" /> กลับหน้าคอร์สเรียนทั้งหมด
      </button>

      {/* Header Banner */}
      <div className="rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-xl text-white bg-gradient-to-r from-indigo-900 via-purple-950 to-slate-950">
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-300 via-purple-900 to-indigo-950" />
        <div className="relative z-10 space-y-2">
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm self-start">
            จัดการโดยแอดมิน
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{selectedCourse.title}</h1>
          <p className="text-indigo-200 text-sm max-w-xl">
            ผู้สอน: {selectedCourse.instructor}
          </p>
        </div>
        <div className="relative z-10 shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setShowEnrollSettingsModal(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-4 py-2.5 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5 text-xs cursor-pointer"
          >
            <Shield className="h-4 w-4 text-indigo-300" />
            ตั้งค่าการลงทะเบียน
          </button>
        </div>
      </div>


      {/* Tabs */}
      <div className="flex space-x-6 border-b pb-3 mb-6" style={{ borderColor: tx.borderS }}>
        <button onClick={() => setDetailTab("assignments")} className="text-sm font-bold pb-2 border-b-2 transition-all px-1 shrink-0"
          style={detailTab === "assignments" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          งาน & แบบทดสอบ (Assignments & Quizzes)
        </button>
        <button onClick={() => setDetailTab("lessons")} className="text-sm font-bold pb-2 border-b-2 transition-all px-1 shrink-0"
          style={detailTab === "lessons" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          โครงสร้างวิชา (Lessons)
        </button>
        <button onClick={() => setDetailTab("students")} className="text-sm font-bold pb-2 border-b-2 transition-all px-1 shrink-0"
          style={detailTab === "students" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          รายชื่อนักเรียน
        </button>
      </div>

      {/* Tab 1: Assignments */}
      {detailTab === "assignments" && (
        <AssignmentsPanel
          courseAssignments={courseAssignments}
          assignments={assignments}
          submissions={submissions}
          viewingAssignmentId={viewingAssignmentId}
          setViewingAssignmentId={setViewingAssignmentId}
          setViewingQuizSub={setViewingQuizSub}
          setShowForm={setShowForm}
        />
      )}

      {/* Tab 2: Lessons */}
      {detailTab === "lessons" && (
        <LessonsPanel
          lessons={lessons}
          courseId={selectedCourse.id}
          setShowAddLessonModal={setShowAddLessonModal}
          setEditingLesson={setEditingLesson}
          setEditLessonTitle={setEditLessonTitle}
          setEditLessonDescription={setEditLessonDescription}
          setEditLessonVideoUrl={setEditLessonVideoUrl}
        />
      )}

      {/* Tab 3: Students */}
      {detailTab === "students" && (
        <StudentsPanel
          enrollments={enrollments}
          courseId={selectedCourse.id}
          submissions={submissions}
          courseAssignments={courseAssignments}
          viewingStudentId={viewingStudentId}
          setViewingStudentId={setViewingStudentId}
          setViewingQuizSub={setViewingQuizSub}
          setShowAddStudentModal={setShowAddStudentModal}
          teacherRemoveStudent={teacherRemoveStudent}
        />
      )}
    </div>
  );
}
