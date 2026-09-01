import React, { useEffect, useState, useMemo } from "react";
import { ArrowLeft, ChevronRight, Search, CheckCircle2, Lock, RefreshCw, Video } from "lucide-react";
import { tx } from "../../lib/theme";
import { toast } from "@/lib/swal";
import { apiFetch } from "@/lib/api";
import { useUser } from "../../context/UserContext";
import type { Assignment, Chapter, Course, Lesson, StudentSubmission, Topic } from "../../context/UserContext";
import { type LiveClassData } from "../../components/LiveClassCard";
import { LessonOverviewPanel } from "./LessonOverviewPanel";
import { TaskListPanel } from "./TaskListPanel";
import { FileSubmissionPanel } from "./FileSubmissionPanel";
import { QuizPlayer } from "./QuizPlayer";
import { EmptyState } from "../../components/EmptyState";
import { JoinLiveClassButton } from "../../components/JoinLiveClassButton";
import { formatThaiShortDateTime } from "../../lib/date";

type StudentTab = "dashboard" | "courses" | "study" | "profile";
type StudyTabId = "overview" | "resources" | "tasks";

interface StudyTabProps {
  enrolledCourses: Course[];
  courses: Course[];
  chapters: Chapter[];
  topics: Topic[];
  lessons: Lesson[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  currentUserId: string | null;
  displayName: string;
  addSubmission: (submission: StudentSubmission) => void;

  setTab: (tab: StudentTab) => void;

  selectedCourseId: string | null;
  setSelectedCourseId: React.Dispatch<React.SetStateAction<string | null>>;
  activeLessonId: string | null;
  setActiveLessonId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedAssignmentId: string | null;
  setSelectedAssignmentId: React.Dispatch<React.SetStateAction<string | null>>;

  studyTab: StudyTabId;
  setStudyTab: React.Dispatch<React.SetStateAction<StudyTabId>>;

  fileNameInput: string;
  setFileNameInput: React.Dispatch<React.SetStateAction<string>>;

  currentQuizQuestionIndex: number;
  setCurrentQuizQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  quizAnswers: Record<number, number | string | Record<number, number>>;
  setQuizAnswers: React.Dispatch<React.SetStateAction<Record<number, number | string | Record<number, number>>>>;
}

export function StudyTab({
  enrolledCourses, courses, chapters, topics, lessons, assignments, submissions, currentUserId, displayName, addSubmission,
  setTab, selectedCourseId, setSelectedCourseId, activeLessonId, setActiveLessonId,
  selectedAssignmentId, setSelectedAssignmentId, studyTab, setStudyTab,
  fileNameInput, setFileNameInput,
  currentQuizQuestionIndex, setCurrentQuizQuestionIndex, quizAnswers, setQuizAnswers,
}: StudyTabProps) {
  const { completedLessonIds, toggleLessonComplete, refreshData } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [activeLiveClass, setActiveLiveClass] = useState<LiveClassData | null>(null);
  const [courseLiveClasses, setCourseLiveClasses] = useState<LiveClassData[]>([]);
  const [quizRetakingId, setQuizRetakingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCourseId) {
      return;
    }
    let isCancelled = false;
    Promise.all([
      apiFetch<{ activeLiveClass: LiveClassData }>(`/api/live-classes/active?course_id=${selectedCourseId}`),
      apiFetch<{ liveClasses: LiveClassData[] }>(`/api/live-classes?course_id=${selectedCourseId}`),
    ])
      .then(([{ data: activeData }, { data: listData }]) => {
        if (isCancelled) return;
        setActiveLiveClass(activeData?.activeLiveClass || null);
        setCourseLiveClasses(listData?.liveClasses || []);
      })
      .catch(() => {
        if (isCancelled) return;
        setActiveLiveClass(null);
        setCourseLiveClasses([]);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedCourseId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    if (selectedCourseId) {
      try {
        const [{ data: activeData }, { data: listData }] = await Promise.all([
          apiFetch<{ activeLiveClass: LiveClassData }>(`/api/live-classes/active?course_id=${selectedCourseId}`),
          apiFetch<{ liveClasses: LiveClassData[] }>(`/api/live-classes?course_id=${selectedCourseId}`),
        ]);
        setActiveLiveClass(activeData?.activeLiveClass || null);
        setCourseLiveClasses(listData?.liveClasses || []);
      } catch {
        setActiveLiveClass(null);
        setCourseLiveClasses([]);
      }
    }
    setTimeout(() => setRefreshing(false), 500);
    toast.success("อัปเดตบทเรียนและคะแนนล่าสุดเรียบร้อยแล้ว!");
  };

  const courseChapters = useMemo(() => {
    return selectedCourseId ? chapters.filter(ch => ch.courseId === selectedCourseId) : [];
  }, [chapters, selectedCourseId]);

  const courseTopics = useMemo(() => {
    return selectedCourseId
      ? topics.filter(t => {
          const chapter = chapters.find(ch => ch.id === t.chapterId);
          return chapter?.courseId === selectedCourseId;
        })
      : [];
  }, [topics, chapters, selectedCourseId]);

  const courseLessons = useMemo(() => {
    return selectedCourseId
      ? lessons.filter(
          l =>
            l.isPublished !== false &&
            (courseTopics.some(t => t.id === l.topicId) ||
              (l as { courseId?: string }).courseId === selectedCourseId)
        )
      : [];
  }, [lessons, courseTopics, selectedCourseId]);

  // Auto-sync lesson completion when all tasks for a lesson are submitted or unsubmitted
  useEffect(() => {
    if (!currentUserId || !selectedCourseId || courseLessons.length === 0) return;

    courseLessons.forEach((l, index) => {
      const lAssignments = assignments.filter((a) => {
        if (a.courseId !== selectedCourseId) return false;
        if (a.lessonId) return a.lessonId === l.id;
        return index === 0;
      });

      if (lAssignments.length > 0) {
        const allDone = lAssignments.every((a) =>
          submissions.some((s) => s.assignmentId === a.id && s.studentId === currentUserId)
        );
        if (allDone && !completedLessonIds.includes(l.id)) {
          toggleLessonComplete(l.id, true);
        } else if (!allDone && completedLessonIds.includes(l.id)) {
          toggleLessonComplete(l.id, false);
        }
      }
    });
  }, [selectedCourseId, courseLessons, assignments, submissions, currentUserId, completedLessonIds, toggleLessonComplete]);

  if (selectedCourseId === null) {
    // COURSE SELECTOR
    return (
      <div className="space-y-6 text-left animate-fadeIn">
        <div className="animate-slideInUp">
          <h1 className="text-3xl font-extrabold tracking-tight">ห้องเรียนจำลอง (LMS Study Area)</h1>
          <p className="text-sm mt-1" style={{ color: tx.muted }}>เลือกวิชาที่คุณลงทะเบียนเรียนไว้ เพื่อเข้าสู่ห้องเรียน ทบทวนบทเรียน และทำแบบฝึกหัด</p>
        </div>

        {enrolledCourses.length === 0 ? (
          <EmptyState
            illustration="bookshelf"
            variant="hero"
            accent="indigo"
            title="คุณยังไม่ได้ลงเรียนวิชาใดๆ"
            description="กรุณาลงทะเบียนเข้าเรียนในคอร์สต่างๆ ก่อน เพื่อเข้าศึกษาเนื้อหาบทเรียนและการบ้านในระบบครับ"
            action={
              <button onClick={() => setTab("courses")} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95 flex items-center gap-2 animate-pulseGlow">
                <Search className="h-5 w-5" /> ไปที่หน้ารายการคอร์สเรียน
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrolledCourses.map((course, i) => (
              <div key={course.id} onClick={() => { setSelectedCourseId(course.id); setActiveLessonId(null); }}
                className={`rounded-3xl overflow-hidden shadow-md cursor-pointer flex flex-col border card-hover animate-slideInUp stagger-${Math.min(i + 1, 6)}`}
                style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
                <div className={`h-24 bg-gradient-to-tr ${course.gradientClass} p-5 text-white flex flex-col justify-between`}>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm self-start">
                    {course.levelLabel}
                  </span>
                  <h3 className="font-extrabold text-base drop-shadow-md truncate">{course.title}</h3>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <p className="text-xs" style={{ color: tx.muted }}>ผู้สอน: {course.instructor}</p>
                  <div className="mt-4 flex justify-between items-center group/link">
                    <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 group-hover/link:underline">เข้าเรียนวิชานี้</span>
                    <ChevronRight className="h-4 w-4 text-indigo-500 transition-transform group-hover/link:translate-x-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // STUDY AREA ROOM
  const currentCourse = courses.find(c => c.id === selectedCourseId);
  if (!currentCourse) return null;

  const checkLessonCompleted = (lesson: Lesson, index: number) => {
    const lAssignments = assignments.filter((a) => {
      if (a.courseId !== selectedCourseId) return false;
      if (a.lessonId) return a.lessonId === lesson.id;
      return index === 0;
    });
    if (lAssignments.length > 0) {
      return lAssignments.every((a) =>
        submissions.some((s) => s.assignmentId === a.id && s.studentId === currentUserId)
      );
    }
    return completedLessonIds.includes(lesson.id);
  };

  const isLessonLocked = (lessonId: string) => {
    const lesson = courseLessons.find(l => l.id === lessonId);
    if (lesson?.isLocked === true) return true;
    if (!currentCourse.sequentialLessons) return false;
    const lessonIdx = courseLessons.findIndex(l => l.id === lessonId);
    if (lessonIdx <= 0) return false;

    for (let i = 0; i < lessonIdx; i++) {
      const prevL = courseLessons[i];
      const prevCompleted = checkLessonCompleted(prevL, i);
      if (!prevCompleted) {
        return true;
      }
    }
    return false;
  };

  // Find active lesson (ensure not locked)
  const activeLesson = lessons.find(l => l.id === activeLessonId && !isLessonLocked(l.id)) || courseLessons.find(l => !isLessonLocked(l.id)) || null;
  const activeLessonIdResolved = activeLesson?.id || null;
  const firstUnlockedLessonId = courseLessons.find(l => !isLessonLocked(l.id))?.id || null;
  const courseAssignments = activeLessonIdResolved
    ? assignments.filter((assignment) => {
        if (assignment.courseId !== selectedCourseId) return false;
        if (assignment.lessonId) {
          return assignment.lessonId === activeLessonIdResolved;
        }
        return activeLessonIdResolved === firstUnlockedLessonId;
      })
    : [];

  const activeLessonHasTasks = courseAssignments.length > 0;
  const activeLessonTasksCompleted = activeLessonHasTasks && courseAssignments.every(a => submissions.some(s => s.assignmentId === a.id && s.studentId === currentUserId));

  const courseLessonsCount = courseLessons.length;
  const courseCompletedLessonsCount = courseLessons.filter((l, idx) => checkLessonCompleted(l, idx)).length;
  const realTimeProgress = courseLessonsCount > 0 ? Math.round((courseCompletedLessonsCount / courseLessonsCount) * 100) : 0;

  // Check if student is actively taking or reviewing a Quiz -> Render Full-Page Quiz View
  const activeQuizTask = selectedAssignmentId
    ? courseAssignments.find(a => a.id === selectedAssignmentId && a.type === "quiz")
    : null;

  if (activeQuizTask) {
    const sub = submissions.find(s => s.assignmentId === activeQuizTask.id && s.studentId === currentUserId);
    const effectiveSub = quizRetakingId === activeQuizTask.id ? undefined : sub;

    return (
      <div className="space-y-6 text-left animate-fadeIn">
        <QuizPlayer
          key={activeQuizTask.id}
          activeTask={activeQuizTask}
          sub={effectiveSub}
          currentQuizQuestionIndex={currentQuizQuestionIndex}
          setCurrentQuizQuestionIndex={setCurrentQuizQuestionIndex}
          quizAnswers={quizAnswers}
          setQuizAnswers={setQuizAnswers}
          setSelectedAssignmentId={setSelectedAssignmentId}
          addSubmission={addSubmission}
          currentUserId={currentUserId}
          displayName={displayName}
          activeLessonId={activeLessonIdResolved}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      {/* Navigation Back & Refresh Button */}
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <button onClick={() => { setSelectedCourseId(null); setActiveLessonId(null); setSelectedAssignmentId(null); }}
          className="flex items-center gap-2 font-bold hover:text-indigo-500 dark:hover:text-indigo-400 transition-all active:scale-95 group">
          <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" /> กลับหน้ารายการคอร์สเรียน
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
          <span>{refreshing ? "กำลังอัปเดต..." : "รีเฟรชข้อมูล"}</span>
        </button>
      </div>

      {/* Active Live Class Banner */}
      {activeLiveClass && (
        <div className="rounded-3xl p-6 sm:p-7 border-2 border-red-500/60 bg-gradient-to-r from-red-950/50 via-slate-900/80 to-red-950/50 shadow-xl shadow-red-500/10 animate-slideInUp relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-36 h-36 bg-red-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-black animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  🔴 กำลังสอนสดอยู่ตอนนี้
                </span>
                {activeLiveClass.host_name && (
                  <span className="text-xs text-slate-300">
                    ผู้สอน: ครู{activeLiveClass.host_name}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">{activeLiveClass.title}</h2>
              {activeLiveClass.description && (
                <p className="text-xs sm:text-sm text-slate-300 line-clamp-2">{activeLiveClass.description}</p>
              )}
            </div>

            <JoinLiveClassButton
              liveClassId={activeLiveClass.id}
              roomName={activeLiveClass.room_name}
              displayName={displayName}
              isActive={true}
              size="lg"
            >
              เข้าห้องเรียนสดทันที →
            </JoinLiveClassButton>
          </div>
        </div>
      )}

      {/* Course Banner */}
      <div className="rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-xl text-white bg-gradient-to-r from-indigo-900 via-purple-950 to-slate-950 animate-slideInUp">
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-300 via-purple-900 to-indigo-950" />
        <div className="relative z-10 space-y-2">
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm self-start">
            {currentCourse.levelLabel}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{currentCourse.title}</h1>
          <p className="text-indigo-200 text-sm">
            ผู้สอน: {currentCourse.instructor}
          </p>
        </div>
        <div className="relative z-10 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-center text-xs">
          <p className="font-bold">Progress ความคืบหน้า</p>
          <p className="text-lg font-black mt-0.5">{realTimeProgress}%</p>
        </div>
      </div>

      {/* Course Live Classes List (Active & Upcoming) */}
      {courseLiveClasses.length > 0 && (
        <div className="rounded-3xl p-5 border space-y-3 animate-slideInUp" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                <Video className="h-4 w-4" />
              </div>
              <h3 className="font-extrabold text-sm tracking-tight" style={{ color: tx.primary }}>
                ห้องเรียนสดประจำวิชานี้ (Live Classroom Sessions)
              </h3>
            </div>
            <span className="text-xs font-bold" style={{ color: tx.muted }}>
              {courseLiveClasses.length} คาบเรียน
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {courseLiveClasses.map((lc) => (
              <div
                key={lc.id}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                  lc.is_active
                    ? "border-red-500/50 bg-red-500/5 dark:bg-red-950/20 shadow-md shadow-red-500/10"
                    : "bg-slate-50/50 dark:bg-slate-900/30"
                }`}
                style={{ borderColor: lc.is_active ? undefined : tx.borderS }}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {lc.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-500 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                        🔴 กำลังสอนสด
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400">
                        🕒 {lc.scheduled_at ? formatThaiShortDateTime(lc.scheduled_at) : "กำหนดการ"}
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: tx.muted }}>
                      ({lc.duration_minutes} นาที)
                    </span>
                  </div>
                  <h4 className="font-bold text-xs truncate" style={{ color: tx.primary }}>
                    {lc.title}
                  </h4>
                  {lc.host_name && (
                    <p className="text-[10px]" style={{ color: tx.muted }}>
                      ผู้สอน: ครู{lc.host_name}
                    </p>
                  )}
                </div>

                <JoinLiveClassButton
                  liveClassId={lc.id}
                  roomName={lc.room_name}
                  displayName={displayName}
                  isActive={lc.is_active}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left side: Lessons selection */}
        <div className="space-y-4 animate-slideInLeft">
          <div className="p-4 rounded-2xl border flex flex-col space-y-3" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
            <h3 className="font-extrabold text-sm uppercase tracking-wider" style={{ color: tx.muted }}>บทเรียนทั้งหมด ({courseLessons.length})</h3>
            {courseLessons.length === 0 ? (
              <EmptyState
                illustration="clipboard"
                variant="compact"
                accent="slate"
                title="วิชานี้ยังไม่มีหัวข้อบทเรียน"
              />
            ) : courseChapters.length === 0 ? (
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {courseLessons.map((l, index) => {
                  const isActive = activeLesson && l.id === activeLesson.id;
                  const isCompleted = checkLessonCompleted(l, index);
                  const isLocked = isLessonLocked(l.id);
                  return (
                    <button key={l.id}
                      onClick={() => {
                        if (isLocked) {
                          toast.error(l.isLocked === true ? "บทเรียนนี้ถูกล็อกโดยคุณครู 🔒" : "บทเรียนนี้ถูกล็อก 🔒 กรุณาเรียนบทเรียนก่อนหน้าให้ผ่านก่อนครับ");
                          return;
                        }
                        setActiveLessonId(l.id);
                        setSelectedAssignmentId(null);
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs font-bold flex gap-3 items-center transition-all duration-200 active:scale-[0.98] ${isActive ? "animate-borderGlow" : ""} ${isLocked ? "opacity-60 bg-slate-100/50 dark:bg-slate-900/50 cursor-not-allowed" : ""}`}
                      style={isActive
                        ? { borderColor: tx.accent, backgroundColor: tx.accentBg, color: tx.accent }
                        : { borderColor: tx.borderS, color: tx.secondary }}>
                      <span className={`flex h-5 w-5 rounded-full items-center justify-center text-[10px] font-mono shrink-0 transition-colors ${
                        isLocked
                          ? "bg-amber-500/20 text-amber-500"
                          : isCompleted
                            ? "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20"
                            : isActive ? "bg-indigo-500/20 text-indigo-500" : "bg-indigo-500/10 text-indigo-500"
                      }`}>
                        {isLocked ? <Lock className="h-3 w-3" /> : isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span className="truncate">{l.title}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {courseChapters.map((chap, cIdx) => {
                  const chapTopics = topics.filter(t => t.chapterId === chap.id);
                  return (
                    <div key={chap.id} className="rounded-xl border p-3 space-y-2" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                      <div className="flex items-center justify-between text-xs font-extrabold text-indigo-600 dark:text-indigo-400 border-b pb-1.5" style={{ borderColor: tx.borderS }}>
                        <span className="truncate">หน่วยที่ {cIdx + 1}: {chap.title}</span>
                      </div>

                      <div className="space-y-2 pt-1">
                        {chapTopics.map((top, tIdx) => {
                          const topicLessons = lessons.filter(l => l.topicId === top.id && l.isPublished !== false);
                          return (
                            <div key={top.id} className="space-y-1.5 border-l-2 border-indigo-500/30 pl-2.5">
                              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                                {cIdx + 1}.{tIdx + 1} {top.title}
                              </div>

                              <div className="space-y-1">
                                {topicLessons.map((l, index) => {
                                  const isActive = activeLesson && l.id === activeLesson.id;
                                  const isCompleted = checkLessonCompleted(l, index);
                                  const isLocked = isLessonLocked(l.id);
                                  return (
                                    <button key={l.id}
                                      onClick={() => {
                                        if (isLocked) {
                                          toast.error(l.isLocked === true ? "บทเรียนนี้ถูกล็อกโดยคุณครู 🔒" : "บทเรียนนี้ถูกล็อก 🔒 กรุณาเรียนบทเรียนก่อนหน้าให้ผ่านก่อนครับ");
                                          return;
                                        }
                                        setActiveLessonId(l.id);
                                        setSelectedAssignmentId(null);
                                      }}
                                      className={`w-full text-left p-2.5 rounded-lg border text-xs font-semibold flex gap-2.5 items-center transition-all duration-200 ${isActive ? "shadow-sm border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 font-bold" : "hover:bg-slate-100 dark:hover:bg-slate-800"} ${isLocked ? "opacity-60 bg-slate-100/50 dark:bg-slate-900/50 cursor-not-allowed" : ""}`}
                                      style={!isActive ? { borderColor: tx.borderS, color: tx.secondary } : {}}>
                                      <span className={`flex h-4 w-4 rounded-full items-center justify-center text-[9px] font-mono shrink-0 ${
                                        isLocked
                                          ? "bg-amber-500/20 text-amber-500"
                                          : isCompleted
                                            ? "bg-emerald-500/20 text-emerald-500"
                                            : isActive ? "bg-indigo-500/20 text-indigo-500" : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                                      }`}>
                                        {isLocked ? <Lock className="h-2.5 w-2.5" /> : isCompleted ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
                                      </span>
                                      <span className="truncate">{l.title}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Video player & Subtabs */}
        <div className="lg:col-span-2 space-y-6 animate-slideInRight">
          {!activeLesson ? (
            courseLessons.length === 0 ? (
              <EmptyState
                illustration="inbox"
                variant="default"
                accent="slate"
                title="ไม่มีเนื้อหาบทเรียน"
                description="หลักสูตรนี้กำลังอัพเดทเนื้อหาการสอนโดยครูผู้ดูแลระบบ"
              />
            ) : (
              <div
                className="rounded-3xl p-10 shadow-sm border text-center space-y-4 animate-scaleIn"
                style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}
              >
                <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Lock className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold" style={{ color: tx.primary }}>
                    บทเรียนถูกล็อกอยู่ 🔒
                  </h3>
                  <p className="text-xs max-w-md mx-auto" style={{ color: tx.muted }}>
                    บทเรียนในวิชานี้ถูกตั้งค่าล็อกไว้โดยคุณครูผู้สอน หรือจำเป็นต้องเรียนบทเรียนก่อนหน้าให้สำเร็จก่อน จึงจะสามารถเปิดดูเนื้อหาได้ครับ
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-6" key={activeLesson.id}>

              {/* Active Lesson details */}
              <div className="rounded-3xl p-6 shadow-sm border space-y-4 animate-scaleIn" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
                <LessonOverviewPanel
                  activeLesson={activeLesson}
                  studyTab={studyTab}
                  setStudyTab={setStudyTab}
                  hasTasks={activeLessonHasTasks}
                  tasksCompleted={activeLessonTasksCompleted}
                />

                {studyTab === "tasks" && (
                  <div className="space-y-4 py-2">
                    {selectedAssignmentId === null ? (
                      // ASSIGNMENT LIST
                      <TaskListPanel
                        courseAssignments={courseAssignments}
                        submissions={submissions}
                        currentUserId={currentUserId}
                        setSelectedAssignmentId={setSelectedAssignmentId}
                        setCurrentQuizQuestionIndex={setCurrentQuizQuestionIndex}
                        setQuizAnswers={setQuizAnswers}
                        setFileNameInput={setFileNameInput}
                        setQuizRetakingId={setQuizRetakingId}
                      />
                    ) : (
                      // ACTIVE TASK VIEW (FILE OR QUIZ)
                      (() => {
                        const activeTask = courseAssignments.find(a => a.id === selectedAssignmentId)!;
                        const sub = submissions.find(s => s.assignmentId === activeTask.id && s.studentId === currentUserId);
                        // When retaking, hide the existing submission so QuizPlayer shows the interactive quiz
                        const effectiveSub = quizRetakingId === activeTask.id ? undefined : sub;

                        if (activeTask.type === "file") {
                          return (
                            <FileSubmissionPanel
                              activeTask={activeTask}
                              fileNameInput={fileNameInput}
                              setFileNameInput={setFileNameInput}
                              setSelectedAssignmentId={setSelectedAssignmentId}
                              addSubmission={addSubmission}
                              currentUserId={currentUserId}
                              displayName={displayName}
                              activeLessonId={activeLessonIdResolved}
                            />
                          );
                        } else {
                          // QUIZ TYPE
                          return (
                            <QuizPlayer
                              key={activeTask.id}
                              activeTask={activeTask}
                              sub={effectiveSub}
                              currentQuizQuestionIndex={currentQuizQuestionIndex}
                              setCurrentQuizQuestionIndex={setCurrentQuizQuestionIndex}
                              quizAnswers={quizAnswers}
                              setQuizAnswers={setQuizAnswers}
                              setSelectedAssignmentId={setSelectedAssignmentId}
                              addSubmission={addSubmission}
                              currentUserId={currentUserId}
                              displayName={displayName}
                              activeLessonId={activeLessonIdResolved}
                            />
                          );
                        }
                      })()
                    )}
                  </div>
                )}

              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
