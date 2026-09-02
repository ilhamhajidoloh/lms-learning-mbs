import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Play, Book, Clock, Trophy, ChevronRight, Search, Award, Video,
} from "lucide-react";
import { tx } from "../../lib/theme";
import { useUser, type Course } from "../../context/UserContext";
import { StatCard } from "../../components/StatCard";
import { HeroBanner } from "../../components/HeroBanner";
import { EmptyState } from "../../components/EmptyState";
import { JoinLiveClassButton } from "../../components/JoinLiveClassButton";
import { type LiveClassData } from "../../components/LiveClassCard";
import { apiFetch } from "@/lib/api";
import { formatThaiShortDateTime } from "../../lib/date";

type StudentTab = "dashboard" | "courses" | "study" | "profile";

interface DashboardTabProps {
  displayName: string;
  enrolledCourses: Course[];
  setTab: (tab: StudentTab) => void;
  setSelectedCourseId: React.Dispatch<React.SetStateAction<string | null>>;
}

function useAnimatedCounter(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);

  return value;
}

export function DashboardTab({ displayName, enrolledCourses, setTab, setSelectedCourseId }: DashboardTabProps) {
  const courseCount = useAnimatedCounter(enrolledCourses.length, 600);
  const { assignments, submissions, chapters, topics, lessons, completedLessonIds, currentUserId } = useUser();
  const [activeLiveClasses, setActiveLiveClasses] = useState<LiveClassData[]>([]);
  const [allLiveClasses, setAllLiveClasses] = useState<LiveClassData[]>([]);

  const { completedStudyMinutes, passedQuizCount } = useMemo(() => {
    const enrolledCourseIds = new Set(enrolledCourses.map((course) => course.id));
    const chapterCourseIds = new Map(chapters.map((chapter) => [chapter.id, chapter.courseId]));
    const topicCourseIds = new Map(
      topics.map((topic) => [topic.id, chapterCourseIds.get(topic.chapterId)])
    );
    const completedLessonIdSet = new Set(completedLessonIds);

    const completedStudyMinutes = lessons.reduce((total, lesson) => {
      if (!completedLessonIdSet.has(lesson.id) || !enrolledCourseIds.has(topicCourseIds.get(lesson.topicId) ?? "")) {
        return total;
      }

      return total + (lesson.subLessons ?? []).reduce((lessonTotal, segment) => {
        const parts = segment.duration.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
        if (!parts) return lessonTotal;
        const hours = Number(parts[3] ? parts[1] : 0);
        const minutes = Number(parts[3] ? parts[2] : parts[1]);
        const seconds = Number(parts[3] ? parts[3] : parts[2]);
        return lessonTotal + hours * 60 + minutes + Math.round(seconds / 60);
      }, 0);
    }, 0);

    const assignmentsById = new Map(
      assignments
        .filter((assignment) => assignment.type === "quiz" && enrolledCourseIds.has(assignment.courseId))
        .map((assignment) => [assignment.id, assignment])
    );
    const passedQuizCount = submissions.filter((submission) => {
      const assignment = assignmentsById.get(submission.assignmentId);
      return submission.studentId === currentUserId
        && assignment !== undefined
        && submission.score !== undefined
        && submission.score >= assignment.points * 0.5;
    }).length;

    return { completedStudyMinutes, passedQuizCount };
  }, [assignments, chapters, completedLessonIds, currentUserId, enrolledCourses, lessons, submissions, topics]);

  const studyTimeLabel = `${Math.floor(completedStudyMinutes / 60)} ชั่วโมง ${completedStudyMinutes % 60} นาที`;

  useEffect(() => {
    const fetchLiveData = async () => {
      try {
        const [{ data: activeData }, { data: listData }] = await Promise.all([
          apiFetch<{ activeLiveClasses: LiveClassData[] }>("/api/live-classes/active"),
          apiFetch<{ liveClasses: LiveClassData[] }>("/api/live-classes"),
        ]);
        if (activeData?.activeLiveClasses) {
          setActiveLiveClasses(activeData.activeLiveClasses);
        }
        if (listData?.liveClasses) {
          setAllLiveClasses(listData.liveClasses);
        }
      } catch (e) {
        console.warn("Failed to check live classes:", e);
      }
    };
    fetchLiveData();
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Active Live Class Alert Banner */}
      {activeLiveClasses.length > 0 && (
        <div className="rounded-3xl p-6 border-2 border-red-500/70 bg-gradient-to-r from-red-950/60 via-slate-900/90 to-red-950/60 shadow-xl shadow-red-500/10 text-white relative overflow-hidden animate-slideInUp">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-36 h-36 bg-red-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-black animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  🔴 กำลังสอนสดอยู่ตอนนี้
                </span>
                <span className="text-xs text-indigo-300 font-extrabold">
                  {activeLiveClasses[0].course_title}
                </span>
              </div>
              <h2 className="text-xl font-black">{activeLiveClasses[0].title}</h2>
              {activeLiveClasses[0].host_name && (
                <p className="text-xs text-slate-300">
                  ผู้สอน: ครู{activeLiveClasses[0].host_name}
                </p>
              )}
            </div>

            <JoinLiveClassButton
              liveClassId={activeLiveClasses[0].id}
              roomName={activeLiveClasses[0].room_name}
              displayName={displayName}
              isActive={true}
              size="lg"
            >
              เข้าห้องเรียนสดทันที →
            </JoinLiveClassButton>
          </div>
        </div>
      )}

      {/* Banner Section */}
      <HeroBanner
        gradient="from-indigo-900 via-purple-950 to-slate-950"
        badge="ยินดีต้อนรับผู้เรียนระดับพรีเมียม"
        title={`ยินดีต้อนรับครับ, ${displayName}`}
        subtitle="เริ่มต้นการเรียนรู้และพัฒนาทักษะคณิตศาสตร์ไปพร้อมกัน"
        action={
          <button onClick={() => {
            if (enrolledCourses.length > 0) {
              setSelectedCourseId(enrolledCourses[0].id);
            }
            setTab("study");
          }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-indigo-950 hover:bg-slate-200 font-bold px-5 py-3 rounded-2xl shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95">
            <Play className="h-4 w-4" />
            เริ่มเรียนกันเลย
          </button>
        }
        className="animate-slideInUp"
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard icon={<Book className="h-6 w-6" />} label="วิชาที่กำลังเรียน" value={`${courseCount} วิชา`} accent="indigo" className="animate-slideInUp stagger-1" />
        <StatCard icon={<Clock className="h-6 w-6" />} label="เวลาสะสมที่ศึกษา" value={studyTimeLabel} accent="purple" className="animate-slideInUp stagger-2" />
        <StatCard icon={<Trophy className="h-6 w-6" />} label="ควิซที่ผ่านแล้ว" value={`${passedQuizCount} ชุดทดสอบ`} accent="emerald" className="animate-slideInUp stagger-3" />
      </div>

      {/* Live Classroom Sessions Widget (if scheduled or active) */}
      {allLiveClasses.length > 0 && activeLiveClasses.length === 0 && (
        <div className="rounded-3xl p-6 border space-y-4 animate-slideInUp" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                <Video className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold tracking-tight" style={{ color: tx.primary }}>
                ห้องเรียนสดและตารางเรียน (Live Classroom Sessions)
              </h2>
            </div>
            <span className="text-xs font-bold" style={{ color: tx.muted }}>
              {allLiveClasses.length} คาบเรียน
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allLiveClasses.map((lc) => (
              <div
                key={lc.id}
                className="p-4 rounded-2xl border flex flex-col justify-between space-y-3 bg-slate-50/50 dark:bg-slate-900/40"
                style={{ borderColor: tx.borderS }}
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500">
                    {lc.course_title}
                  </span>
                  <h3 className="font-bold text-sm line-clamp-1" style={{ color: tx.primary }}>
                    {lc.title}
                  </h3>
                  {lc.host_name && (
                    <p className="text-xs" style={{ color: tx.muted }}>
                      ผู้สอน: ครู{lc.host_name}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: tx.borderS }}>
                  <span className="text-[11px]" style={{ color: tx.secondary }}>
                    🕒 {lc.scheduled_at ? formatThaiShortDateTime(lc.scheduled_at) : "เร็วๆ นี้"}
                  </span>
                  <JoinLiveClassButton
                    liveClassId={lc.id}
                    roomName={lc.room_name}
                    displayName={displayName}
                    isActive={lc.is_active}
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Courses Overview In Dashboard */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold tracking-tight">วิชาที่กำลังเรียน (Enrolled Courses)</h2>
          <button onClick={() => setTab("courses")} className="text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 transition-colors">
            ดูทั้งหมด <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {enrolledCourses.length === 0 ? (
          <EmptyState
            illustration="bookshelf"
            variant="hero"
            accent="indigo"
            title="ยังไม่มีวิชาที่กำลังเรียน"
            description="คุณยังไม่ได้ลงทะเบียนเรียนในรายวิชาใดๆ เริ่มต้นค้นหาและเลือกเรียนคอร์สที่น่าสนใจเพื่อพัฒนาทักษะของคุณได้เลย"
            action={
              <button onClick={() => setTab("courses")} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl active:scale-95 flex items-center gap-2 animate-pulseGlow">
                <Search className="h-5 w-5" /> สำรวจคอร์สเรียนทั้งหมด
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {enrolledCourses.slice(0, 3).map((course, i) => (
              <div key={course.id} className={`rounded-3xl overflow-hidden shadow-lg flex flex-col relative group card-hover animate-slideInUp stagger-${i + 1}`} style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
                <div className={`h-28 bg-gradient-to-tr ${course.gradientClass} p-5 text-white flex flex-col justify-between relative`}>
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="text-[10px] font-extrabold uppercase px-3 py-1 rounded-full bg-white/20 backdrop-blur-md shadow-sm self-start">
                    {course.levelLabel}
                  </span>
                  <h3 className="font-extrabold text-base leading-snug line-clamp-2 drop-shadow-md z-10">{course.title}</h3>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-medium" style={{ color: tx.secondary }}>
                      <span className="flex items-center gap-1.5"><Book className="h-3.5 w-3.5" /> {course.lessonsCount} ตอน</span>
                      <span className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-amber-500" /> {course.instructor}</span>
                    </div>
                    <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                      <div className="flex justify-between text-[11px] font-extrabold uppercase tracking-wide">
                        <span style={{ color: tx.muted }}>Progress</span>
                        <span className="text-indigo-600 dark:text-indigo-400">{course.progress}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full animate-progressFill" style={{ width: `${course.progress}%` }} />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => {
                    setSelectedCourseId(course.id);
                    setTab("study");
                  }}
                    className="w-full py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-indigo-700 dark:text-indigo-300 hover:text-white dark:hover:text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 ring-1 ring-indigo-500/20 hover:ring-0 hover:shadow-lg active:scale-95">
                    <Play className="h-4 w-4" /> เรียนต่อจากที่ค้างไว้
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
