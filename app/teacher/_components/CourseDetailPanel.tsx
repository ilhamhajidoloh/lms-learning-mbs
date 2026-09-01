import React, { useState } from "react";
import { ArrowLeft, Shield, RefreshCw, Radio } from "lucide-react";
import { tx } from "../../lib/theme";
import { toast } from "@/lib/swal";
import { useUser, type Assignment, type Chapter, type Course, type Enrollment, type Lesson, type StudentSubmission, type Topic } from "../../context/UserContext";
import { AssignmentsPanel } from "./AssignmentsPanel";
import { LessonsPanel } from "./LessonsPanel";
import { StudentsPanel } from "./StudentsPanel";
import { HeroBanner } from "../../components/HeroBanner";

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
}: CourseDetailPanelProps) {
  const { refreshData } = useUser();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setTimeout(() => setRefreshing(false), 500);
    toast.success("อัปเดตข้อมูลบทเรียนและงานล่าสุดเรียบร้อยแล้ว!");
  };

  const courseAssignments = assignments.filter(a => a.courseId === selectedCourse.id);

  return (
    <div className="space-y-6 animate-fadeIn text-left">
      {/* Back Button & Refresh Button */}
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <button onClick={() => { setSelectedCourseId(null); setShowForm(false); }} className="flex items-center gap-2 font-bold hover:text-indigo-500 dark:hover:text-indigo-400 transition-all duration-200 active:scale-95 text-sm md:text-base">
          <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
          <span className="hidden sm:inline">กลับหน้าคอร์สเรียนทั้งหมด</span>
          <span className="sm:hidden">กลับ</span>
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer btn-press"
          style={{ borderColor: tx.borderS, color: tx.secondary }}
          title="คลิกเพื่อดึงข้อมูลบทเรียนและงานล่าสุดจากเซิร์ฟเวอร์"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-indigo-500 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{refreshing ? "กำลังอัปเดต..." : "รีเฟรชข้อมูล"}</span>
          <span className="sm:hidden">{refreshing ? "อัปเดต..." : "รีเฟรช"}</span>
        </button>
      </div>

      {/* Header Banner */}
      <HeroBanner
        gradient="from-indigo-900 via-purple-950 to-slate-950"
        badge="จัดการโดยแอดมิน"
        title={selectedCourse.title}
        subtitle={`ผู้สอน: ${selectedCourse.instructor}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/teacher/live-classes"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600/80 hover:bg-red-600 border border-red-500/40 text-white font-bold px-4 py-2.5 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5 text-xs cursor-pointer btn-press"
            >
              <Radio className="h-4 w-4 animate-pulse" />
              จัดการห้องเรียนสด
            </a>
            <button
              type="button"
              onClick={() => setShowEnrollSettingsModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-4 py-2.5 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5 text-xs cursor-pointer btn-press"
            >
              <Shield className="h-4 w-4 text-indigo-300" />
              ตั้งค่าการลงทะเบียน
            </button>
          </div>
        }
      />


      {/* Tabs */}
      <div className="flex space-x-3 md:space-x-6 border-b pb-3 mb-6 overflow-x-auto" style={{ borderColor: tx.borderS }}>
        <button onClick={() => setDetailTab("assignments")} className="text-xs md:text-sm font-bold pb-2 border-b-2 transition-all px-1 shrink-0 btn-press whitespace-nowrap"
          style={detailTab === "assignments" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          <span className="hidden sm:inline">งาน & แบบทดสอบ (Assignments & Quizzes)</span>
          <span className="sm:hidden">งาน & แบบทดสอบ</span>
        </button>
        <button onClick={() => setDetailTab("lessons")} className="text-xs md:text-sm font-bold pb-2 border-b-2 transition-all px-1 shrink-0 btn-press whitespace-nowrap"
          style={detailTab === "lessons" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          <span className="hidden sm:inline">โครงสร้างวิชา (Lessons)</span>
          <span className="sm:hidden">โครงสร้างวิชา</span>
        </button>
        <button onClick={() => setDetailTab("students")} className="text-xs md:text-sm font-bold pb-2 border-b-2 transition-all px-1 shrink-0 btn-press whitespace-nowrap"
          style={detailTab === "students" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          รายชื่อนักเรียน
        </button>
      </div>

      {/* Tab 1: Assignments */}
      {detailTab === "assignments" && (
        <AssignmentsPanel
          courseId={selectedCourse.id}
          courseAssignments={courseAssignments}
          assignments={assignments}
          submissions={submissions}
          viewingAssignmentId={viewingAssignmentId}
          setViewingAssignmentId={setViewingAssignmentId}
          setShowForm={setShowForm}
        />
      )}

       {/* Tab 2: Lessons */}
       {detailTab === "lessons" && (
         <LessonsPanel
           lessons={lessons}
           chapters={chapters}
           topics={topics}
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
          setShowAddStudentModal={setShowAddStudentModal}
          teacherRemoveStudent={teacherRemoveStudent}
        />
      )}
    </div>
  );
}
