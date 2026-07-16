import React from "react";
import { ArrowLeft, BookOpen, ChevronRight, Search, CheckCircle2 } from "lucide-react";
import { tx } from "../../lib/theme";
import { useUser } from "../../context/UserContext";
import type { Assignment, Course, Lesson, StudentSubmission } from "../../context/UserContext";
import { LessonOverviewPanel } from "./LessonOverviewPanel";
import { TaskListPanel } from "./TaskListPanel";
import { FileSubmissionPanel } from "./FileSubmissionPanel";
import { QuizPlayer } from "./QuizPlayer";
import { EmptyState } from "../../components/EmptyState";

type StudentTab = "dashboard" | "courses" | "study" | "profile";
type StudyTabId = "overview" | "resources" | "tasks";

interface StudyTabProps {
  enrolledCourses: Course[];
  courses: Course[];
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
  quizAnswers: Record<number, number>;
  setQuizAnswers: React.Dispatch<React.SetStateAction<Record<number, number>>>;
}

export function StudyTab({
  enrolledCourses, courses, lessons, assignments, submissions, currentUserId, displayName, addSubmission,
  setTab, selectedCourseId, setSelectedCourseId, activeLessonId, setActiveLessonId,
  selectedAssignmentId, setSelectedAssignmentId, studyTab, setStudyTab,
  fileNameInput, setFileNameInput,
  currentQuizQuestionIndex, setCurrentQuizQuestionIndex, quizAnswers, setQuizAnswers,
}: StudyTabProps) {
  const { completedLessonIds } = useUser();

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

  const courseLessons = lessons.filter(l => l.courseId === selectedCourseId);
  // Find active lesson
  const activeLesson = lessons.find(l => l.id === activeLessonId) || courseLessons[0];
  const activeLessonIdResolved = activeLesson?.id || null;
  const firstLessonId = courseLessons[0]?.id || null;
  const courseAssignments = assignments.filter((assignment) => {
    if (assignment.courseId !== selectedCourseId) return false;
    if (assignment.lessonId) {
      return assignment.lessonId === activeLessonIdResolved;
    }
    return activeLessonIdResolved !== null && activeLessonIdResolved === firstLessonId;
  });

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      {/* Navigation Back */}
      <button onClick={() => { setSelectedCourseId(null); setActiveLessonId(null); setSelectedAssignmentId(null); }}
        className="flex items-center gap-2 font-bold hover:text-indigo-500 dark:hover:text-indigo-400 transition-all mb-4 active:scale-95 group">
        <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" /> กลับหน้ารายการคอร์สเรียน
      </button>

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
          <p className="text-lg font-black mt-0.5">{currentCourse.progress}%</p>
        </div>
      </div>

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
            ) : (
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {courseLessons.map((l, index) => {
                  const isActive = activeLesson && l.id === activeLesson.id;
                  const isCompleted = completedLessonIds.includes(l.id);
                  return (
                    <button key={l.id} onClick={() => { setActiveLessonId(l.id); setSelectedAssignmentId(null); }}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs font-bold flex gap-3 items-center transition-all duration-200 active:scale-[0.98] ${isActive ? "animate-borderGlow" : ""}`}
                      style={isActive
                        ? { borderColor: tx.accent, backgroundColor: tx.accentBg, color: tx.accent }
                        : { borderColor: tx.borderS, color: tx.secondary }}>
                      <span className={`flex h-5 w-5 rounded-full items-center justify-center text-[10px] font-mono shrink-0 transition-colors ${
                        isCompleted
                          ? "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20"
                          : isActive ? "bg-indigo-500/20 text-indigo-500" : "bg-indigo-500/10 text-indigo-500"
                      }`}>
                        {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span className="truncate">{l.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Video player & Subtabs */}
        <div className="lg:col-span-2 space-y-6 animate-slideInRight">
          {!activeLesson ? (
            <EmptyState
              illustration="inbox"
              variant="default"
              accent="slate"
              title="ไม่มีเนื้อหาบทเรียน"
              description="หลักสูตรนี้กำลังอัพเดทเนื้อหาการสอนโดยครูผู้ดูแลระบบ"
            />
          ) : (
            <div className="space-y-6" key={activeLesson.id}>

              {/* Active Lesson details */}
              <div className="rounded-3xl p-6 shadow-sm border space-y-4 animate-scaleIn" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
                <LessonOverviewPanel activeLesson={activeLesson} studyTab={studyTab} setStudyTab={setStudyTab} />

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
                      />
                    ) : (
                      // ACTIVE TASK VIEW (FILE OR QUIZ)
                      (() => {
                        const activeTask = courseAssignments.find(a => a.id === selectedAssignmentId)!;
                        const sub = submissions.find(s => s.assignmentId === activeTask.id && s.studentId === currentUserId);

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
                            />
                          );
                        } else {
                          // QUIZ TYPE
                          return (
                            <QuizPlayer
                              activeTask={activeTask}
                              sub={sub}
                              currentQuizQuestionIndex={currentQuizQuestionIndex}
                              setCurrentQuizQuestionIndex={setCurrentQuizQuestionIndex}
                              quizAnswers={quizAnswers}
                              setQuizAnswers={setQuizAnswers}
                              setSelectedAssignmentId={setSelectedAssignmentId}
                              addSubmission={addSubmission}
                              currentUserId={currentUserId}
                              displayName={displayName}
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
