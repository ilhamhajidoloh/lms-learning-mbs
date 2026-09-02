import React, { useMemo } from "react";
import {
  Users, BookOpen, Clipboard, Clock, Plus,
  ArrowUpRight, BookDashed, Award,
} from "lucide-react";
import { tx, card } from "../../lib/theme";
import { useUser, type Course } from "../../context/UserContext";
import { StatCard } from "../../components/StatCard";
import { HeroBanner } from "../../components/HeroBanner";
import { EmptyState } from "../../components/EmptyState";

interface StudentActivity {
  id: string;
  name: string;
  action: string;
  course: string;
  time: string;
  score?: string;
}

const RECENT_STUDENT_ACTIVITIES: StudentActivity[] = [];

interface DashboardTabProps {
  displayName: string;
  teacherCourses: Course[];
  setShowCourseForm: (show: boolean) => void;
  setTab: (tab: "dashboard" | "courses" | "students") => void;
  setSelectedCourseId: (id: string | null) => void;
  setDetailTab: (tab: "assignments" | "lessons" | "students") => void;
}

export function DashboardTab({ displayName, teacherCourses, setShowCourseForm, setTab, setSelectedCourseId, setDetailTab }: DashboardTabProps) {
  const { assignments, submissions, enrollments } = useUser();
  const { enrolledStudentCount, assignmentCount, assignmentSubmissionRate } = useMemo(() => {
    const courseIds = new Set(teacherCourses.map((course) => course.id));
    const courseEnrollments = enrollments.filter((enrollment) => courseIds.has(enrollment.courseId));
    const enrolledStudentCount = new Set(
      courseEnrollments.map((enrollment) => enrollment.studentId).filter(Boolean)
    ).size;
    const courseAssignments = assignments.filter((assignment) => courseIds.has(assignment.courseId));
    const courseAssignmentIds = new Set(courseAssignments.map((assignment) => assignment.id));
    const expectedSubmissions = courseAssignments.reduce(
      (total, assignment) => total + courseEnrollments.filter((enrollment) => enrollment.courseId === assignment.courseId).length,
      0
    );
    const submittedCount = new Set(
      submissions
        .filter((submission) => courseAssignmentIds.has(submission.assignmentId))
        .map((submission) => `${submission.assignmentId}:${submission.studentId}`)
    ).size;

    return {
      enrolledStudentCount,
      assignmentCount: courseAssignments.length,
      assignmentSubmissionRate: expectedSubmissions > 0 ? Math.round((submittedCount / expectedSubmissions) * 100) : 0,
    };
  }, [assignments, enrollments, submissions, teacherCourses]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero / Welcome */}
      <HeroBanner
        gradient="from-indigo-900 via-indigo-950 to-slate-950"
        badge="Teacher Dashboard"
        title={`สวัสดีครับ, ${displayName}`}
        subtitle="ยินดีต้อนรับกลับสู่ระบบจัดการคอร์สและการเรียนการสอนของ Math by Seng วันนี้มีห้องเรียนและข้อมูลกิจกรรมใหม่ให้ตรวจสอบ"
      />

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<Users className="h-6 w-6" />} label="นักเรียนทั้งหมด" value={`${enrolledStudentCount} คน`} accent="indigo" className="animate-slideInUp stagger-1" />
        <StatCard icon={<Clock className="h-6 w-6" />} label="งานที่มอบหมาย" value={`${assignmentCount} งาน`} accent="purple" className="animate-slideInUp stagger-2" />
        <StatCard icon={<BookOpen className="h-6 w-6" />} label="คอร์สที่เปิดสอน" value={`${teacherCourses.length} คอร์ส`} accent="blue" className="animate-slideInUp stagger-3" />
        <StatCard icon={<Clipboard className="h-6 w-6" />} label="อัตราการส่งการบ้าน" value={`${assignmentSubmissionRate}%`} accent="pink" className="animate-slideInUp stagger-4" />
      </div>

      {/* Main Area: Course List & Student Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Courses overview list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold tracking-tight">คอร์สเรียนหลักที่ครูดูแล</h2>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowCourseForm(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95 cursor-pointer">
                <Plus className="h-4 w-4" /> สร้างคอร์สใหม่
              </button>
              <button onClick={() => setTab("courses")} className="text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 transition-colors">
                ดูคอร์สทั้งหมด <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {teacherCourses.length === 0 ? (
            <EmptyState
              illustration="bookshelf"
              variant="hero"
              accent="indigo"
              title="ยังไม่มีคอร์สเรียนที่เปิดสอน"
              description="คุณยังไม่ได้สร้างคอร์สเรียนใดๆ เริ่มต้นสร้างคอร์สแรกเพื่อเชิญนักเรียนเข้ามาเรียนด้วยกันเลยครับ"
              action={
                <button onClick={() => setShowCourseForm(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl active:scale-95 flex items-center gap-2 cursor-pointer animate-pulseGlow">
                  <Plus className="h-5 w-5" /> สร้างคอร์สใหม่
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {teacherCourses.map((course, i) => (
                <div key={course.id} className={`rounded-3xl p-6 relative overflow-hidden shadow-lg group flex flex-col justify-between border card-hover animate-slideInUp stagger-${Math.min(i + 1, 6)}`} style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
                  <div className={`h-2.5 w-full bg-gradient-to-r ${course.gradientClass} absolute top-0 left-0`} />
                  <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="space-y-5 pt-2 relative z-10">
                    <h3 className="font-extrabold text-lg leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">
                      {course.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs font-semibold" style={{ color: tx.secondary }}>
                      <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300"><BookDashed className="h-4 w-4" /> {course.lessonsCount} บทเรียน</span>
                      <span className="flex items-center gap-1.5 text-amber-500"><Award className="h-4 w-4" /> จัดการโดยแอดมิน</span>
                    </div>
                    <div className="pt-4 flex justify-between items-center border-t border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-medium" style={{ color: tx.muted }}>ไม่มีไลฟ์ตอนนี้</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCourseId(course.id);
                          setDetailTab("lessons");
                          setTab("courses");
                        }}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95 cursor-pointer"
                      >
                        <BookOpen className="h-4 w-4" /> เข้าดูบทเรียน
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real-time Student activities feed */}
        <div className="space-y-6 animate-slideInRight">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">กิจกรรมล่าสุดของนักเรียน</h2>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>

          <div className="rounded-2xl p-6 space-y-4 shadow-sm" style={card.style}>
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-slate-300 dark:divide-slate-700">
                {RECENT_STUDENT_ACTIVITIES.map((activity) => (
                  <li key={activity.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {activity.name}
                        </p>
                        <p className="text-xs truncate" style={{ color: tx.muted }}>
                          {activity.action} · <span className="font-bold text-indigo-600 dark:text-indigo-400">{activity.course}</span>
                        </p>
                        <span className="text-[10px]" style={{ color: tx.faint }}>{activity.time}</span>
                      </div>
                      {activity.score && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                          {activity.score}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
