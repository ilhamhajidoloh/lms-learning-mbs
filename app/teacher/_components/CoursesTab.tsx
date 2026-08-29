import React from "react";
import { Plus, BookOpen, ChevronRight } from "lucide-react";
import { tx, card } from "../../lib/theme";
import type { Assignment, Chapter, Course, Enrollment, Lesson, StudentSubmission, Topic } from "../../context/UserContext";
import { CourseDetailPanel } from "./CourseDetailPanel";

interface CoursesTabProps {
  selectedCourseId: string | null;
  teacherCourses: Course[];
  setSelectedCourseId: (id: string | null) => void;
  setShowForm: (show: boolean) => void;
  setShowCourseForm: (show: boolean) => void;

  detailTab: "assignments" | "lessons" | "students";
  setDetailTab: (tab: "assignments" | "lessons" | "students") => void;
  setShowEnrollSettingsModal: (show: boolean) => void;

  assignments: Assignment[];
  submissions: StudentSubmission[];
  viewingAssignmentId: string | null;
  setViewingAssignmentId: (id: string | null) => void;
  setViewingQuizSub: (sub: StudentSubmission | null) => void;

  lessons: Lesson[];
  chapters: Chapter[];
  topics: Topic[];
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

export function CoursesTab({
  selectedCourseId,
  teacherCourses,
  setSelectedCourseId,
  setShowForm,
  setShowCourseForm,
  detailTab,
  setDetailTab,
  setShowEnrollSettingsModal,
  assignments,
  submissions,
  viewingAssignmentId,
  setViewingAssignmentId,
  setViewingQuizSub,
  lessons,
  chapters,
  topics,
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
}: CoursesTabProps) {
  return selectedCourseId && teacherCourses.find(c => c.id === selectedCourseId) ? (
    // COURSE DETAILS SUBVIEW
    (() => {
      const selectedCourse = teacherCourses.find(c => c.id === selectedCourseId)!;
      return (
        <CourseDetailPanel
          selectedCourse={selectedCourse}
          setSelectedCourseId={setSelectedCourseId}
          setShowForm={setShowForm}
          detailTab={detailTab}
          setDetailTab={setDetailTab}
          setShowEnrollSettingsModal={setShowEnrollSettingsModal}
          assignments={assignments}
          submissions={submissions}
          viewingAssignmentId={viewingAssignmentId}
          setViewingAssignmentId={setViewingAssignmentId}
          setViewingQuizSub={setViewingQuizSub}
          lessons={lessons}
          chapters={chapters}
          topics={topics}
          setShowAddLessonModal={setShowAddLessonModal}
          setEditingLesson={setEditingLesson}
          setEditLessonTitle={setEditLessonTitle}
          setEditLessonDescription={setEditLessonDescription}
          setEditLessonVideoUrl={setEditLessonVideoUrl}
          enrollments={enrollments}
          viewingStudentId={viewingStudentId}
          setViewingStudentId={setViewingStudentId}
          setShowAddStudentModal={setShowAddStudentModal}
          teacherRemoveStudent={teacherRemoveStudent}
        />
      );
    })()

  ) : (
    // ORIGINAL COURSE LIST VIEW
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">การจัดการคอร์สเรียน (Course Dashboard)</h2>
          <p className="text-sm mt-1" style={{ color: tx.muted }}>เลือกจัดการหลักสูตร เนื้อหา วิดีโอ และแบบทดสอบสำหรับแต่ละรายวิชาที่รับผิดชอบ</p>
        </div>
        <button onClick={() => setShowCourseForm(true)} className="btn-primary flex items-center justify-center gap-1.5 text-sm px-4 py-2.5 rounded-xl shadow transition-transform hover:-translate-y-0.5 shrink-0 self-start sm:self-center cursor-pointer">
          <Plus className="h-5 w-5" /> สร้างคอร์สใหม่
        </button>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {teacherCourses.map((course) => (
          <div key={course.id} className="rounded-2xl p-6 flex flex-col justify-between shadow-md text-left" style={card.style}>
            <div className="space-y-4">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-tr ${course.gradientClass} text-white flex items-center justify-center shadow-md`}>
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg leading-snug">{course.title}</h3>
              <p className="text-xs" style={{ color: tx.muted }}>
                {course.lessonsCount} บทเรียน · จัดการโดยแอดมิน
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-300 dark:border-slate-700 flex justify-between items-center">
              <span className="text-xs font-bold" style={{ color: tx.muted }}>
                {course.instructor}
              </span>
              <button onClick={() => setSelectedCourseId(course.id)} className="flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline cursor-pointer btn-press">
                แก้ไขเนื้อหาบทเรียน <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
