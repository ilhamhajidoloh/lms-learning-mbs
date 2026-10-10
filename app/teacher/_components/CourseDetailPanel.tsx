import React, { useEffect, useState } from "react";
import { ArrowLeft, Shield, RefreshCw, Radio, Trash2, Pencil } from "lucide-react";
import { tx } from "../../lib/theme";
import { alert, toast } from "@/lib/swal";
import { useUser, type Assignment, type Chapter, type Course, type Enrollment, type Lesson, type StudentSubmission, type Topic } from "../../context/UserContext";
import { AssignmentsPanel } from "./AssignmentsPanel";
import { LessonsPanel } from "./LessonsPanel";
import { StudentsPanel } from "./StudentsPanel";
import { HeroBanner } from "../../components/HeroBanner";
import { PrivateLessonRequestsPanel } from "../../components/PrivateLessonRequestsPanel";
import { CourseAnnouncements } from "../../components/CourseAnnouncements";
import { CourseEditModal } from "./CourseEditModal";
import { apiFetch } from "../../../lib/api";

interface CourseDetailPanelProps {
  selectedCourse: Course;
  setSelectedCourseId: (id: string | null) => void;
  deleteCourse: (id: string) => Promise<{ success: boolean; error?: string }>;
  updateCourseDetails: (id: string, data: Pick<Course, "title" | "description" | "level" | "levelLabel" | "gradientClass">) => Promise<{ success: boolean; error?: string }>;
  setShowForm: (show: boolean) => void;
  detailTab: "assignments" | "lessons" | "students" | "announcements" | "private_lessons";
  setDetailTab: (tab: "assignments" | "lessons" | "students" | "announcements" | "private_lessons") => void;
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
  deleteCourse,
  updateCourseDetails,
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
  const { refreshData, levels, appUsers, setContentClassContext } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [courseLevels, setCourseLevels] = useState<string[]>([]);
  // This is the sole class context for this course-detail view.  It is deliberately
  // populated from enrolled students, never from the course-level configuration.
  const [selectedClass, setSelectedClass] = useState<string>("all");

  useEffect(() => {
    void apiFetch<{ levels: string[] }>(`/api/courses/classes?courseId=${encodeURIComponent(selectedCourse.id)}`).then(({ data }) => {
      setCourseLevels(data?.levels ?? []);
      setSelectedClass("all");
    });
  }, [selectedCourse.id]);

  // Publish the single class context for content writes; leaving the view resets it to read-only.
  useEffect(() => {
    setContentClassContext(selectedClass);
    return () => setContentClassContext("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass]);


  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setTimeout(() => setRefreshing(false), 500);
    toast.success("อัปเดตข้อมูลบทเรียนและงานล่าสุดเรียบร้อยแล้ว!");
  };

  const handleDeleteCourse = async () => {
    const confirmed = await alert.confirm(
      `ยืนยันการลบคอร์ส "${selectedCourse.title}"?`,
      "เนื้อหา นักเรียน งาน และข้อมูลทั้งหมดในคอร์สนี้จะถูกลบอย่างถาวร",
      "ลบคอร์ส"
    );
    if (!confirmed) return;

    const result = await deleteCourse(selectedCourse.id);
    if (result.success) {
      setSelectedCourseId(null);
      setShowForm(false);
    }
  };

  const isReadOnly = selectedClass === "all";
  const courseAssignments = assignments.filter((a) => a.courseId === selectedCourse.id && (isReadOnly || !a.targetGroup || a.targetGroup === selectedClass));
  const visibleLessons = lessons.filter((lesson) => {
    const topic = topics.find((item) => item.id === lesson.topicId);
    const chapter = topic && chapters.find((item) => item.id === topic.chapterId);
    return chapter?.courseId === selectedCourse.id && (isReadOnly || !lesson.targetGroup || lesson.targetGroup === selectedClass);
  });
  const visibleEnrollments = enrollments.filter((enrollment) => {
    if (enrollment.courseId !== selectedCourse.id || isReadOnly) return enrollment.courseId === selectedCourse.id;
    return appUsers.find((user) => user.id === enrollment.studentId)?.studentLevel === selectedClass;
  });

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
          onClick={() => setShowEditModal(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-500/40 text-white font-bold px-4 py-2.5 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5 text-xs cursor-pointer btn-press"
        >
          <Pencil className="h-4 w-4" />
          แก้ไขรายละเอียด
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
            <button
              type="button"
              onClick={handleDeleteCourse}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-rose-600/80 hover:bg-rose-600 border border-rose-500/40 text-white font-bold px-4 py-2.5 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5 text-xs cursor-pointer btn-press"
            >
              <Trash2 className="h-4 w-4" />
              ลบคอร์ส
            </button>
          </div>
        }
      />

      <section className="rounded-2xl border p-4 space-y-3" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm">ชั้นเรียนในคอร์สนี้</h3>
            <p className="text-xs" style={{ color: tx.muted }}>ดึงจากชั้นเรียนของนักเรียนที่เพิ่มเข้าคอร์ส และใช้กรองเนื้อหาของแต่ละชั้น</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {courseLevels.map((value) => <span key={value} className="px-3 py-1.5 rounded-xl border text-xs font-bold" style={{ borderColor: tx.borderS, color: tx.secondary }}>{levels.find((level) => level.value === value)?.label ?? value}</span>)}
          {courseLevels.length === 0 && <span className="text-xs" style={{ color: tx.muted }}>ยังไม่มีนักเรียนในคอร์สที่กำหนดชั้นเรียน</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t" style={{ borderColor: tx.borderS }}>
          <label htmlFor="course-class-view" className="text-xs font-bold" style={{ color: tx.muted }}>กำลังดูชั้นเรียน:</label>
          <select id="course-class-view" value={selectedClass} onChange={(event) => { setContentClassContext(event.target.value); setSelectedClass(event.target.value); setShowForm(false); setShowAddLessonModal(false); setEditingLesson(null); setViewingAssignmentId(null); }} className="min-w-48 px-3 py-2 rounded-xl border bg-transparent text-sm font-bold" style={{ borderColor: tx.borderS, color: tx.primary }}>
            <option value="all">ทุกชั้น — ดูอย่างเดียว</option>
            {courseLevels.map((value) => <option key={value} value={value}>{levels.find((level) => level.value === value)?.label ?? value}</option>)}
          </select>
        </div>
      </section>


      {/* Tabs */}
      {isReadOnly && (
        <div className="rounded-xl border px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50">
          ขณะนี้อยู่ในโหมดดูข้อมูลทุกชั้น กรุณาเลือกชั้นเรียนก่อนเพิ่ม แก้ไข หรือลบเนื้อหา
        </div>
      )}
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
        <button onClick={() => setDetailTab("announcements")} className="text-xs md:text-sm font-bold pb-2 border-b-2 transition-all px-1 shrink-0 btn-press whitespace-nowrap"
          style={detailTab === "announcements" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          ประกาศ
        </button>
        <button onClick={() => setDetailTab("private_lessons")} className="text-xs md:text-sm font-bold pb-2 border-b-2 transition-all px-1 shrink-0 btn-press whitespace-nowrap"
          style={detailTab === "private_lessons" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          คิวสอนส่วนตัว
        </button>
      </div>

      {/* Tab 1: Assignments */}
      {detailTab === "assignments" && (
          <AssignmentsPanel
            key={selectedClass}
            courseId={selectedCourse.id}
            courseAssignments={courseAssignments}
            assignments={assignments}
            submissions={submissions}
            viewingAssignmentId={viewingAssignmentId}
            setViewingAssignmentId={setViewingAssignmentId}
            setShowForm={setShowForm}
            selectedClass={selectedClass}
            readOnly={isReadOnly}
          />
      )}

       {/* Tab 2: Lessons */}
       {detailTab === "lessons" && (
           <LessonsPanel
             key={selectedClass}
             lessons={visibleLessons}
             chapters={chapters}
             topics={topics}
             courseId={selectedCourse.id}
             setShowAddLessonModal={setShowAddLessonModal}
             setEditingLesson={setEditingLesson}
             setEditLessonTitle={setEditLessonTitle}
             setEditLessonDescription={setEditLessonDescription}
             setEditLessonVideoUrl={setEditLessonVideoUrl}
             selectedClass={selectedClass}
             readOnly={isReadOnly}
           />
       )}

      {/* Tab 3: Students */}
      {detailTab === "students" && (
        <StudentsPanel
          enrollments={visibleEnrollments}
          courseId={selectedCourse.id}
          submissions={submissions}
          courseAssignments={courseAssignments}
          viewingStudentId={viewingStudentId}
          setViewingStudentId={setViewingStudentId}
          setShowAddStudentModal={setShowAddStudentModal}
          teacherRemoveStudent={teacherRemoveStudent}
        />
      )}

      {detailTab === "announcements" && <CourseAnnouncements key={`${selectedCourse.id}:${selectedClass}`} courseId={selectedCourse.id} canManage selectedClass={selectedClass} courseLevels={courseLevels} />}

      {detailTab === "private_lessons" && (
        <PrivateLessonRequestsPanel courseId={selectedCourse.id} courseTitle={selectedCourse.title} />
      )}

      {showEditModal && (
        <CourseEditModal
          course={selectedCourse}
          levels={levels}
          onClose={() => setShowEditModal(false)}
          updateCourseDetails={updateCourseDetails}
        />
      )}
    </div>
  );
}
