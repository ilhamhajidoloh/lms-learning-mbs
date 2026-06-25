"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Award, CheckCircle, Video, FileText, ChevronRight,
  Play, Trophy, BarChart2, Moon, Sun, Search, Download, Check,
  Sparkles, Book, Clock, Menu, X, LogOut, ArrowUpRight, ArrowLeft, Upload, Inbox, SearchX
} from "lucide-react";
import { useUser, StudentSubmission } from "../context/UserContext";
import LoadingScreen from "../components/LoadingScreen";
import Swal from "sweetalert2";

/** Extract YouTube video ID from various URL formats */
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  // youtube.com/watch?v=ID
  const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (longMatch) return longMatch[1];
  // youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  // youtube.com/embed/ID
  const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  return null;
}



const tx = {
  primary:   "var(--text-primary)",
  secondary: "var(--text-secondary)",
  muted:     "var(--text-muted)",
  faint:     "var(--text-faint)",
  base:      "var(--bg-base)",
  surface:   "var(--bg-surface)",
  elevated:  "var(--bg-elevated)",
  border:    "var(--border-base)",
  borderS:   "var(--border-subtle)",
  accent:    "var(--color-accent)",
  accentBg:  "var(--color-accent-bg)",
};

const card = {
  style: {
    backgroundColor: tx.surface,
    border: `1px solid ${tx.borderS}`,
  } as React.CSSProperties,
};

export default function StudentDashboard() {
  const { role, isAuthenticated, displayName, logout, meetings, darkMode, toggleDarkMode, assignments, submissions, addSubmission, lessons, courses, loadingData, enrollInCourse, currentUserId } = useUser();
  const router = useRouter();
  const [tab,          setTab]          = useState<"dashboard"|"courses"|"study"|"profile">("dashboard");
  const [search,       setSearch]       = useState("");
  const [levelFilter,  setLevelFilter]  = useState<string>("all");
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [lesson,       setLesson]       = useState("1.3 ความต่อเนื่อง of ฟังก์ชัน");
  const [studyTab,     setStudyTab]     = useState<"overview"|"resources"|"tasks">("overview");
  
  // Student task states
  const [activeTaskTab, setActiveTaskTab] = useState<"list" | "quiz" | "file">("list");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  
  // File submission state
  const [fileNameInput, setFileNameInput] = useState("");
  
  // Interactive Quiz state
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResultScore, setQuizResultScore] = useState<number | null>(null);
  const [quizResultSubmitted, setQuizResultSubmitted] = useState(false);

  const enrolledCourses = courses.filter(c => c.isEnrolled);

  const handleEnroll = async (courseId: string, requiresCode: boolean) => {
    if (requiresCode) {
      const { value: code } = await Swal.fire({
        title: 'ป้อนรหัสเข้าเรียน (Enroll Code)',
        text: 'วิชานี้ต้องใส่รหัสเข้าเรียนจากครูผู้สอนในการลงทะเบียน',
        input: 'text',
        inputPlaceholder: 'กรอกรหัสเข้าเรียน...',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันการลงทะเบียน',
        cancelButtonText: 'ยกเลิก',
        inputValidator: (value) => {
          if (!value) {
            return 'กรุณากรอกรหัสผ่านก่อนลงทะเบียนครับ';
          }
        }
      });
      if (code) {
        await enrollInCourse(courseId, code);
      }
    } else {
      const result = await Swal.fire({
        title: 'ยืนยันการลงทะเบียน',
        text: 'คุณต้องการลงทะเบียนเข้าเรียนในวิชานี้ใช่หรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
      });
      if (result.isConfirmed) {
        await enrollInCourse(courseId);
      }
    }
  };

  useEffect(() => {
    if (loadingData) return;
    if (!isAuthenticated) {
      router.push("/login");
    } else if (role !== "student") {
      router.push(role === "admin" ? "/admin" : "/teacher");
    }
  }, [isAuthenticated, role, router, loadingData]);

  if (loadingData) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || role !== "student") {
    return null;
  }

  const visibleCourses = courses.filter(c => c.isEnrolled || c.isOpen || c.enrollCodeRequired);

  const filtered = visibleCourses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) &&
    (levelFilter === "all" || c.level === levelFilter)
  );

  const NAV = [
    { id: "dashboard", label: "หน้าแรก",            Icon: BarChart2 },
    { id: "courses",   label: "คอร์สเรียนทั้งหมด", Icon: BookOpen  },
    { id: "study",     label: "ห้องเรียนจำลอง",    Icon: Video     },
    { id: "profile",   label: "แดชบอร์ดนักเรียน",  Icon: Trophy    },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>

      {/* HEADER */}
      <header className="sticky top-0 z-50 glass-panel shadow-sm" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg animate-float">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 bg-clip-text text-transparent text-xl font-bold tracking-tight">
                  Math by Seng
                </span>
                <span className="block text-[10px] font-bold tracking-widest uppercase -mt-1" style={{ color: tx.muted }}>
                  Student Portal
                </span>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-1">
              {NAV.map(({ id, label, Icon }) => {
                const active = tab === id;
                return (
                  <button key={id} onClick={() => setTab(id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                    style={active
                      ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 }
                      : { color: tx.secondary }}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
              <button onClick={() => router.push("/student/teams")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                style={{ color: tx.secondary }}
              >
                <Video className="h-4 w-4" />
                Teams ประชุม
              </button>
            </nav>

            {/* Right Buttons */}
            <div className="flex items-center gap-3">
              <button onClick={toggleDarkMode}
                className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors"
                style={{ color: tx.secondary }}>
                {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
              </button>

              <div className="h-8 w-px" style={{ backgroundColor: tx.borderS }} />

              <div className="flex items-center gap-3 pl-1">
                <button onClick={() => router.push("/profile")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity" title="ดูโปรไฟล์">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-md">
                    S
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-bold leading-tight">{displayName}</p>
                    <p className="text-[10px]" style={{ color: tx.muted }}>ผู้เรียน</p>
                  </div>
                </button>
                <button onClick={logout} className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors" title="ออกจากระบบ">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile menu button */}
              <button onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors"
                style={{ color: tx.secondary }}>
                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden glass-panel border-b" style={{ borderColor: tx.borderS }}>
            <div className="px-2 pt-2 pb-3 space-y-1">
              {NAV.map(({ id, label, Icon }) => {
                const active = tab === id;
                return (
                  <button key={id}
                    onClick={() => { setTab(id); setMobileOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium transition-all"
                    style={active
                      ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 }
                      : { color: tx.secondary }}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                );
              })}
              <button onClick={() => { router.push("/student/teams"); setMobileOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium transition-all"
                style={{ color: tx.secondary }}
              >
                <Video className="h-5 w-5" />
                Teams ประชุม
              </button>
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ─── 1. TAB: DASHBOARD ─── */}
        {tab === "dashboard" && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* Banner Section */}
            <div className="rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-xl text-white bg-gradient-to-r from-indigo-900 via-purple-950 to-slate-950">
              <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-300 via-purple-900 to-indigo-950" />
              
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <Sparkles className="h-3 w-3" /> ยินดีต้อนรับผู้เรียนระดับพรีเมียม
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight">ยินดีต้อนรับครับ, {displayName} 📖</h1>
                <p className="text-indigo-200 text-sm max-w-xl">
                  เริ่มต้นการเรียนรู้และพัฒนาทักษะคณิตศาสตร์ไปพร้อมกัน
                </p>
              </div>

              <div className="relative z-10 flex gap-3 shrink-0 w-full sm:w-auto">
                <button onClick={() => {
                  if (enrolledCourses.length > 0) {
                    setSelectedCourseId(enrolledCourses[0].id);
                  }
                  setTab("study");
                }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-indigo-950 hover:bg-slate-200 font-bold px-5 py-3 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5">
                  <Play className="h-4 w-4" />
                  เริ่มเรียนกันเลย
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="rounded-2xl p-6 flex items-center justify-between shadow-sm" style={card.style}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ความคืบหน้าภาพรวม</p>
                  <p className="text-2xl font-extrabold mt-1">0 คอร์สเรียนอยู่</p>
                  <div className="w-32 bg-slate-300 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-indigo-600 h-full" style={{ width: "0%" }} />
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
                  <Book className="h-6 w-6" />
                </div>
              </div>

              <div className="rounded-2xl p-6 flex items-center justify-between shadow-sm" style={card.style}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>เวลาสะสมที่ศึกษา</p>
                  <p className="text-2xl font-extrabold mt-1">0 ชั่วโมง 0 นาที</p>
                  <p className="text-[11px] mt-1" style={{ color: tx.faint }}>เป้าหมายสัปดาห์นี้: 0 ชม.</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
              </div>

              <div className="rounded-2xl p-6 flex items-center justify-between shadow-sm" style={card.style}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ควิซที่ผ่านแล้ว</p>
                  <p className="text-2xl font-extrabold mt-1">0 ชุดทดสอบ</p>
                  <p className="text-xs text-emerald-500 flex items-center gap-1 font-bold mt-1">
                    <CheckCircle className="h-3.5 w-3.5" /> ความถูกต้องเฉลี่ย 0%
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Trophy className="h-6 w-6" />
                </div>
              </div>
            </div>

            {/* Microsoft Teams meetings live schedule */}
            {meetings.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <h2 className="text-xl font-bold tracking-tight">คลาสเรียนสดออนไลน์ทาง Teams ตอนนี้</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {meetings.map((m) => (
                    <div key={m.id} className="rounded-2xl p-5 flex flex-col justify-between shadow-md" style={card.style}>
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                            เข้าเรียนสด
                          </span>
                          <span className="text-xs" style={{ color: tx.faint }}>
                            ครูเซ็ง กำลังรอสอน
                          </span>
                        </div>
                        <h4 className="font-bold text-sm line-clamp-1">{m.subject}</h4>
                        <p className="text-xs flex items-center gap-1.5" style={{ color: tx.muted }}>
                          <Clock className="h-3.5 w-3.5" /> {m.startDateTime} น.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-300 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-mono" style={{ color: tx.muted }}>Passcode: {m.passcode}</span>
                        <a href={m.joinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline">
                          กดเข้าร่วม (Join) <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
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
                <button onClick={() => setTab("courses")} className="text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1">
                  ดูทั้งหมด <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {enrolledCourses.length === 0 ? (
                <div className="rounded-3xl p-10 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden" style={card.style}>
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 pointer-events-none" />
                  <div className="h-24 w-24 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-6 shadow-inner animate-float">
                    <Book className="h-12 w-12" />
                  </div>
                  <h3 className="text-2xl font-extrabold mb-2 bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">ยังไม่มีวิชาที่กำลังเรียน</h3>
                  <p className="max-w-md text-sm mb-6" style={{ color: tx.secondary }}>
                    คุณยังไม่ได้ลงทะเบียนเรียนในรายวิชาใดๆ เริ่มต้นค้นหาและเลือกเรียนคอร์สที่น่าสนใจเพื่อพัฒนาทักษะของคุณได้เลย
                  </p>
                  <button onClick={() => setTab("courses")} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2">
                    <Search className="h-5 w-5" /> สำรวจคอร์สเรียนทั้งหมด
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {enrolledCourses.slice(0, 3).map((course) => (
                    <div key={course.id} className="rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col relative group" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
                      <div className={`h-28 bg-gradient-to-tr ${course.gradientClass} p-5 text-white flex flex-col justify-between relative`}>
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="text-[10px] font-extrabold uppercase px-3 py-1 rounded-full bg-white/20 backdrop-blur-md shadow-sm self-start">
                          {course.levelLabel}
                        </span>
                        <h3 className="font-extrabold text-base leading-snug line-clamp-2 drop-shadow-md z-10">{course.title}</h3>
                      </div>
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-5 bg-white/5 backdrop-blur-xl">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-xs font-medium" style={{ color: tx.secondary }}>
                            <span className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5" /> {course.lessonsCount} ตอน</span>
                            <span className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-amber-500" /> {course.instructor}</span>
                          </div>
                          <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                            <div className="flex justify-between text-[11px] font-extrabold uppercase tracking-wide">
                              <span style={{ color: tx.muted }}>Progress</span>
                              <span className="text-indigo-600 dark:text-indigo-400">{course.progress}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-1000" style={{ width: `${course.progress}%` }} />
                            </div>
                          </div>
                        </div>
                        <button onClick={() => {
                          setSelectedCourseId(course.id);
                          setTab("study");
                        }}
                          className="w-full py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-indigo-700 dark:text-indigo-300 hover:text-white dark:hover:text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-2 ring-1 ring-indigo-500/20">
                          <Play className="h-4 w-4" /> เรียนต่อจากที่ค้างไว้
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── 2. TAB: COURSES ─── */}
        {tab === "courses" && (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">คอร์สเรียนทั้งหมด (All Courses)</h1>
                <p className="text-sm mt-1" style={{ color: tx.muted }}>หลักสูตรระดับ Premium ม.4-ม.6 และเทคนิคการเตรียมสอบเข้มข้น</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const uniqueLevelsMap: Record<string, string> = {};
                  uniqueLevelsMap["m4"] = "ม.4";
                  uniqueLevelsMap["m5"] = "ม.5";
                  uniqueLevelsMap["m6"] = "ม.6";
                  uniqueLevelsMap["exam"] = "เตรียมสอบ";
                  
                  courses.forEach(c => {
                    if (c.level) {
                      uniqueLevelsMap[c.level] = c.levelLabel || c.level;
                    }
                  });

                  const levelsList = [{ code: "all", label: "ทั้งหมด" }, ...Object.entries(uniqueLevelsMap).map(([code, label]) => ({ code, label }))];

                  return levelsList.map(({ code, label }) => (
                    <button key={code} onClick={() => setLevelFilter(code)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border"
                      style={levelFilter === code
                        ? { backgroundColor: "#6366f1", borderColor: "#6366f1", color: "#fff" }
                        : { borderColor: tx.borderS, color: tx.secondary }}
                    >
                      {label}
                    </button>
                  ));
                })()}
              </div>
            </div>

            {/* Course Search */}
            <div className="relative rounded-2xl border" style={{ borderColor: tx.border, backgroundColor: tx.surface }}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: tx.faint }} />
              <input type="text" placeholder="ค้นหาชื่อคอร์สเรียน..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm" style={{ color: tx.primary }} />
            </div>

            {/* Course Grid */}
            {filtered.length === 0 ? (
              <div className="rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm border border-dashed relative overflow-hidden" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
                <div className="h-20 w-20 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
                  <SearchX className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-extrabold mb-2" style={{ color: tx.primary }}>ไม่พบคอร์สเรียน</h3>
                <p className="max-w-sm text-sm" style={{ color: tx.secondary }}>
                  ไม่มีคอร์สเรียนที่ตรงกับคำค้นหาหรือตัวกรองที่คุณเลือก ลองเปลี่ยนคำค้นหาใหม่ดูนะครับ
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filtered.map((course) => (
                  <div key={course.id} className="rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group relative" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
                    <div className={`h-36 bg-gradient-to-tr ${course.gradientClass} p-6 text-white flex flex-col justify-between relative`}>
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-[10px] font-extrabold uppercase px-3 py-1 rounded-full bg-white/20 backdrop-blur-md shadow self-start">
                        {course.levelLabel}
                      </span>
                      <h3 className="font-extrabold text-lg leading-snug drop-shadow-md z-10">{course.title}</h3>
                    </div>
                    <div className="p-6 space-y-5 bg-white/5 backdrop-blur-sm">
                      <div className="flex justify-between items-center text-xs font-semibold" style={{ color: tx.muted }}>
                        <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300"><Video className="h-4 w-4" /> {course.lessonsCount} ตอน</span>
                        <span className="flex items-center gap-1.5"><Award className="h-4 w-4 text-amber-500" /> {course.instructor}</span>
                      </div>
                      {course.isEnrolled ? (
                        <button onClick={() => {
                          setSelectedCourseId(course.id);
                          setTab("study");
                        }}
                          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                          <BookOpen className="h-4 w-4" /> เริ่มเรียนวิชานี้เลย
                        </button>
                      ) : course.isOpen ? (
                        <button onClick={() => handleEnroll(course.id, false)}
                          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                          <BookOpen className="h-4 w-4" /> ลงทะเบียนเรียนทันที
                        </button>
                      ) : course.enrollCodeRequired ? (
                        <button onClick={() => handleEnroll(course.id, true)}
                          className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                          <BookOpen className="h-4 w-4" /> กรอกรหัสลงทะเบียน
                        </button>
                      ) : (
                        <div className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs text-slate-400 font-bold border border-dashed border-slate-300 dark:border-slate-700">
                          วิชานี้เข้าเรียนได้เฉพาะคำเชิญเท่านั้น
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── 3. TAB: STUDY (INTERACTIVE STUDY ROOM) ─── */}
        {tab === "study" && (
          selectedCourseId === null ? (
            // COURSE SELECTOR
            <div className="space-y-6 text-left animate-fadeIn">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">ห้องเรียนจำลอง (LMS Study Area)</h1>
                <p className="text-sm mt-1" style={{ color: tx.muted }}>เลือกวิชาที่คุณลงทะเบียนเรียนไว้ เพื่อเข้าสู่ห้องเรียน ทบทวนบทเรียน และทำแบบฝึกหัด</p>
              </div>

              {enrolledCourses.length === 0 ? (
                <div className="rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm border border-dashed mt-6" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
                  <div className="h-20 w-20 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-6 shadow-inner">
                    <BookOpen className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-extrabold mb-2" style={{ color: tx.primary }}>คุณยังไม่ได้ลงเรียนวิชาใดๆ</h3>
                  <p className="max-w-md text-sm mb-6" style={{ color: tx.secondary }}>
                    กรุณาลงทะเบียนเข้าเรียนในคอร์สต่างๆ ก่อน เพื่อเข้าศึกษาเนื้อหาบทเรียนและการบ้านในระบบครับ
                  </p>
                  <button onClick={() => setTab("courses")} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5 flex items-center gap-2">
                    <Search className="h-5 w-5" /> ไปที่หน้ารายการคอร์สเรียน
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {enrolledCourses.map((course) => (
                    <div key={course.id} onClick={() => { setSelectedCourseId(course.id); setActiveLessonId(null); }} className="rounded-3xl overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
                      <div className={`h-24 bg-gradient-to-tr ${course.gradientClass} p-5 text-white flex flex-col justify-between`}>
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm self-start">
                          {course.levelLabel}
                        </span>
                        <h3 className="font-extrabold text-base drop-shadow-md truncate">{course.title}</h3>
                      </div>
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <p className="text-xs" style={{ color: tx.muted }}>ผู้สอน: {course.instructor}</p>
                        <div className="mt-4 flex justify-between items-center">
                          <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400">เข้าเรียนวิชานี้</span>
                          <ChevronRight className="h-4 w-4 text-indigo-500" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // STUDY AREA ROOM
            (() => {
              const currentCourse = courses.find(c => c.id === selectedCourseId);
              if (!currentCourse) return null;

              const courseLessons = lessons.filter(l => l.courseId === selectedCourseId);
              const courseAssignments = assignments.filter(a => a.courseId === selectedCourseId);
              
              // Find active lesson
              const activeLesson = lessons.find(l => l.id === activeLessonId) || courseLessons[0];
              const ytId = activeLesson?.videoUrl ? extractYouTubeId(activeLesson.videoUrl) : null;

              return (
                <div className="space-y-6 text-left animate-fadeIn">
                  {/* Navigation Back */}
                  <button onClick={() => { setSelectedCourseId(null); setActiveLessonId(null); setSelectedAssignmentId(null); }} className="flex items-center gap-2 font-bold hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors mb-4">
                    <ArrowLeft className="h-5 w-5" /> กลับหน้ารายการคอร์สเรียน
                  </button>

                  {/* Course Banner */}
                  <div className="rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-xl text-white bg-gradient-to-r from-indigo-900 via-purple-950 to-slate-950">
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
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl border flex flex-col space-y-3" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
                        <h3 className="font-extrabold text-sm uppercase tracking-wider" style={{ color: tx.muted }}>บทเรียนทั้งหมด ({courseLessons.length})</h3>
                        {courseLessons.length === 0 ? (
                          <p className="text-xs text-slate-400 py-4 font-bold text-center">วิชานี้ยังไม่มีหัวข้อบทเรียน</p>
                        ) : (
                          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                            {courseLessons.map((l, index) => {
                              const isActive = activeLesson && l.id === activeLesson.id;
                              return (
                                <button key={l.id} onClick={() => { setActiveLessonId(l.id); setSelectedAssignmentId(null); }}
                                  className="w-full text-left p-3.5 rounded-xl border transition-all text-xs font-bold flex gap-3 items-center"
                                  style={isActive 
                                    ? { borderColor: tx.accent, backgroundColor: tx.accentBg, color: tx.accent } 
                                    : { borderColor: tx.borderS, color: tx.secondary }}
                                >
                                  <span className="flex h-5 w-5 rounded-full bg-indigo-500/10 text-indigo-500 items-center justify-center text-[10px] font-mono shrink-0">{index + 1}</span>
                                  <span className="truncate">{l.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side: Video player & Subtabs */}
                    <div className="lg:col-span-2 space-y-6">
                      {!activeLesson ? (
                        <div className="rounded-3xl p-12 text-center border border-dashed flex flex-col items-center justify-center" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
                          <Inbox className="h-10 w-10 mb-2" style={{ color: tx.faint }} />
                          <p className="font-bold text-sm">ไม่มีเนื้อหาบทเรียน</p>
                          <p className="text-xs mt-1" style={{ color: tx.muted }}>หลักสูตรนี้กำลังอัพเดทเนื้อหาการสอนโดยครูผู้ดูแลระบบ</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          
                          {/* Active Lesson details */}
                          <div className="rounded-3xl p-6 shadow-sm border space-y-4" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
                            <h2 className="text-xl font-extrabold">{activeLesson.title}</h2>
                            
                            {/* Video player embedded */}
                            {ytId ? (
                              <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-lg border relative" style={{ borderColor: tx.borderS }}>
                                <iframe
                                  className="absolute inset-0 w-full h-full"
                                  src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                                  title={activeLesson.title}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            ) : (
                              activeLesson.videoUrl && (
                                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs">
                                  ลิงก์ภายนอก: <a href={activeLesson.videoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline break-all">{activeLesson.videoUrl}</a>
                                </div>
                              )
                            )}

                            {/* Subtabs selection */}
                            <div className="flex space-x-6 border-b pb-2 pt-2" style={{ borderColor: tx.borderS }}>
                              <button onClick={() => setStudyTab("overview")} className="text-xs font-bold pb-2 border-b-2 transition-all px-1"
                                style={studyTab === "overview" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
                                รายละเอียดบทเรียน (Overview)
                              </button>
                              <button onClick={() => setStudyTab("tasks")} className="text-xs font-bold pb-2 border-b-2 transition-all px-1"
                                style={studyTab === "tasks" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
                                งาน & ควิซแบบทดสอบ (Tasks)
                              </button>
                            </div>

                            {/* Tab contents */}
                            {studyTab === "overview" && (
                              <div className="text-sm py-2 leading-relaxed space-y-2">
                                <p className="font-bold text-xs uppercase tracking-wide" style={{ color: tx.muted }}>คำชี้แจง / รายละเอียด:</p>
                                <p style={{ color: tx.secondary }} className="whitespace-pre-line text-xs sm:text-sm">{activeLesson.description || "ไม่มีรายละเอียดประกอบหัวข้อเรียนนี้"}</p>
                              </div>
                            )}

                            {studyTab === "tasks" && (
                              <div className="space-y-4 py-2">
                                {selectedAssignmentId === null ? (
                                  // ASSIGNMENT LIST
                                  <div className="space-y-3">
                                    <h4 className="font-bold text-xs uppercase tracking-wide" style={{ color: tx.muted }}>งานและข้อสอบสำหรับวิชานี้</h4>
                                    {courseAssignments.length === 0 ? (
                                      <p className="text-xs text-slate-400 py-4 font-bold text-center">ไม่มีภาระงานหรือข้อสอบให้ดำเนินการส่งในบทเรียนนี้</p>
                                    ) : (
                                      courseAssignments.map((a) => {
                                        const sub = submissions.find(s => s.assignmentId === a.id && s.studentId === currentUserId);
                                        return (
                                          <div key={a.id} className="p-4 rounded-xl border flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs" style={{ borderColor: tx.borderS }}>
                                            <div className="space-y-1.5">
                                              <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                                  a.type === 'file' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50' : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50'
                                                }`}>
                                                  {a.type === 'file' ? 'ส่งไฟล์' : 'Quiz'}
                                                </span>
                                                <span className="font-bold" style={{ color: tx.primary }}>{a.title}</span>
                                              </div>
                                              <p className="text-[10px]" style={{ color: tx.muted }}>กำหนดส่ง: {a.dueDate} · คะแนนเต็ม: {a.points} คะแนน</p>
                                            </div>

                                            <div className="flex items-center gap-3 self-end sm:self-center">
                                              <span className={`px-2 py-1 rounded-[8px] text-[10px] font-bold ${
                                                sub ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50"
                                              }`}>
                                                {sub ? (sub.type === "quiz" ? `ทำแล้ว (ได้ ${sub.score}/${a.points})` : "ส่งการบ้านแล้ว") : "ค้างส่งงาน"}
                                              </span>
                                              
                                              {a.type === "quiz" ? (
                                                sub ? (
                                                  <button onClick={() => { setSelectedAssignmentId(a.id); }} className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-indigo-500 font-bold transition-all text-[11px] cursor-pointer">
                                                    ดูผลคะแนน & เฉลย
                                                  </button>
                                                ) : (
                                                  <button onClick={() => {
                                                    setSelectedAssignmentId(a.id);
                                                    setCurrentQuizQuestionIndex(0);
                                                    setQuizAnswers({});
                                                  }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-[11px] cursor-pointer shadow-md">
                                                    เริ่มทำข้อสอบ
                                                  </button>
                                                )
                                              ) : (
                                                sub ? (
                                                  <span className="text-[10px]" style={{ color: tx.muted }}>ส่งไฟล์: <span className="font-mono">{sub.fileName}</span></span>
                                                ) : (
                                                  <button onClick={() => { setSelectedAssignmentId(a.id); setFileNameInput(""); }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-[11px] cursor-pointer shadow-md">
                                                    อัพโหลดส่งการบ้าน
                                                  </button>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                ) : (
                                  // ACTIVE TASK VIEW (FILE OR QUIZ)
                                  (() => {
                                    const activeTask = courseAssignments.find(a => a.id === selectedAssignmentId)!;
                                    const sub = submissions.find(s => s.assignmentId === activeTask.id && s.studentId === currentUserId);

                                    if (activeTask.type === "file") {
                                      return (
                                        <div className="p-4 rounded-xl border space-y-4 animate-fadeIn" style={{ borderColor: tx.borderS }}>
                                          <div className="flex justify-between items-center">
                                            <h5 className="font-bold text-sm">ส่งไฟล์การบ้าน: {activeTask.title}</h5>
                                            <button onClick={() => setSelectedAssignmentId(null)} className="text-xs text-rose-500 hover:underline font-bold">ย้อนกลับ</button>
                                          </div>
                                          
                                          <div className="p-3.5 rounded-xl border text-xs leading-relaxed" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                                            <strong style={{ color: tx.secondary }}>คำสั่งการบ้าน:</strong>
                                            <p className="mt-1 whitespace-pre-line" style={{ color: tx.muted }}>{activeTask.instructions || "ไม่มีคำสั่งเฉพาะ"}</p>
                                          </div>

                                          <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ระบุชื่อไฟล์ หรือลิงก์ไฟล์ส่งงาน</label>
                                            <div className="flex gap-2">
                                              <input
                                                type="text"
                                                value={fileNameInput}
                                                onChange={(e) => setFileNameInput(e.target.value)}
                                                placeholder="เช่น homework_lesson1.pdf หรือ ลิงก์ไดรฟ์..."
                                                className="flex-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent"
                                                style={{ borderColor: tx.border, color: tx.primary }}
                                              />
                                              <button
                                                onClick={async () => {
                                                  const name = fileNameInput.trim();
                                                  if (!name) return;
                                                  await addSubmission({
                                                    id: Math.random().toString(),
                                                    studentId: currentUserId || "",
                                                    studentName: displayName,
                                                    assignmentId: activeTask.id,
                                                    type: "file",
                                                    fileName: name,
                                                    submittedAt: Date.now()
                                                  });
                                                  setFileNameInput("");
                                                  setSelectedAssignmentId(null);
                                                }}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-transform"
                                              >
                                                ส่งการบ้าน
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    } else {
                                      // QUIZ TYPE
                                      if (sub) {
                                        // QUIZ REVIEW (SUBMITTED)
                                        return (
                                          <div className="p-4 rounded-xl border space-y-4 animate-fadeIn" style={{ borderColor: tx.borderS }}>
                                            <div className="flex justify-between items-center">
                                              <div>
                                                <h5 className="font-bold text-sm">ผลลัพธ์คำตอบควิซ: {activeTask.title}</h5>
                                                <p className="text-[10px]" style={{ color: tx.muted }}>ได้คะแนน {sub.score} / {activeTask.questions?.length} ข้อ</p>
                                              </div>
                                              <button onClick={() => setSelectedAssignmentId(null)} className="text-xs text-rose-500 hover:underline font-bold">ย้อนกลับ</button>
                                            </div>

                                            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 text-left">
                                              {activeTask.questions?.map((q, idx) => {
                                                const studentAns = sub.answers?.[idx];
                                                const isCorrect = studentAns === q.correctIndex;
                                                return (
                                                  <div key={idx} className="p-3.5 rounded-xl border text-xs space-y-2" style={{ borderColor: isCorrect ? "#10b981" : "#f43f5e" }}>
                                                    <h6 className="font-bold">ข้อที่ {idx + 1}: {q.question}</h6>
                                                    <p className={isCorrect ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>
                                                      คุณตอบ: {studentAns !== undefined ? q.options[studentAns] : "ไม่ได้ตอบ"}
                                                    </p>
                                                    <p className="text-emerald-500">คำตอบที่ถูก: {q.options[q.correctIndex]}</p>
                                                    {q.explanation && (
                                                      <div className="p-2.5 rounded-lg border text-[11px]" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                                                        <strong>อธิบาย:</strong> {q.explanation}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        // ACTIVE INTERACTIVE QUIZ
                                        const q = activeTask.questions?.[currentQuizQuestionIndex];
                                        if (!q) return <p className="text-xs text-slate-400">ไม่มีคำถามในชุดแบบทดสอบนี้</p>;
                                        const chosenIndex = quizAnswers[currentQuizQuestionIndex];

                                        return (
                                          <div className="p-5 rounded-2xl border space-y-5 animate-fadeIn" style={{ borderColor: tx.borderS }}>
                                            <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: tx.borderS }}>
                                              <span className="text-xs font-bold text-indigo-500">แบบทดสอบ: {activeTask.title}</span>
                                              <span className="text-xs font-extrabold" style={{ color: tx.muted }}>ข้อที่ {currentQuizQuestionIndex + 1} / {activeTask.questions?.length}</span>
                                            </div>

                                            <div className="space-y-4">
                                              <h5 className="font-bold text-sm">{q.question}</h5>
                                              
                                              <div className="grid grid-cols-1 gap-2.5">
                                                {q.options.map((opt, oIdx) => {
                                                  const isSelected = chosenIndex === oIdx;
                                                  return (
                                                    <button
                                                      key={oIdx}
                                                      onClick={() => {
                                                        setQuizAnswers(prev => ({
                                                          ...prev,
                                                          [currentQuizQuestionIndex]: oIdx
                                                        }));
                                                      }}
                                                      className="w-full text-left p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between"
                                                      style={isSelected
                                                        ? { borderColor: tx.accent, backgroundColor: tx.accentBg, color: tx.accent }
                                                        : { borderColor: tx.borderS, color: tx.secondary }}
                                                    >
                                                      <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                                                      {isSelected && <Check className="h-4 w-4 shrink-0" />}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>

                                            <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: tx.borderS }}>
                                              <button
                                                disabled={currentQuizQuestionIndex === 0}
                                                onClick={() => setCurrentQuizQuestionIndex(prev => prev - 1)}
                                                className="px-4 py-2 border rounded-xl font-bold text-xs transition-colors disabled:opacity-30 cursor-pointer"
                                                style={{ borderColor: tx.borderS, color: tx.secondary }}
                                              >
                                                ข้อก่อนหน้า
                                              </button>

                                              {currentQuizQuestionIndex < activeTask.questions!.length - 1 ? (
                                                <button
                                                  onClick={() => setCurrentQuizQuestionIndex(prev => prev + 1)}
                                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-transform"
                                                >
                                                  ข้อถัดไป
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={async () => {
                                                    const confirmed = await Swal.fire({
                                                      title: "ยืนยันการส่งคำตอบ",
                                                      text: "คุณกรอกคำตอบครบและยืนยันที่จะส่งข้อสอบใช่หรือไม่?",
                                                      icon: "question",
                                                      showCancelButton: true,
                                                      confirmButtonText: "ส่งข้อสอบ",
                                                      cancelButtonText: "ตรวจสอบอีกครั้ง"
                                                    });
                                                    if (confirmed.isConfirmed) {
                                                      // Calculate score
                                                      let finalScore = 0;
                                                      activeTask.questions!.forEach((question, idx) => {
                                                        if (quizAnswers[idx] === question.correctIndex) {
                                                          finalScore++;
                                                        }
                                                      });

                                                      const submissionAnswers = activeTask.questions!.map((_, idx) => quizAnswers[idx] !== undefined ? quizAnswers[idx] : -1);

                                                      await addSubmission({
                                                        id: Math.random().toString(),
                                                        studentId: currentUserId || "",
                                                        studentName: displayName,
                                                        assignmentId: activeTask.id,
                                                        type: "quiz",
                                                        score: finalScore,
                                                        answers: submissionAnswers,
                                                        submittedAt: Date.now()
                                                      });

                                                      setQuizAnswers({});
                                                      setSelectedAssignmentId(null);
                                                    }
                                                  }}
                                                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-transform"
                                                >
                                                  ส่งข้อสอบ
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      }
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
            })()
          )
        )}

        {/* ─── 4. TAB: PROFILE (ACHIEVEMENT DASHBOARD) ─── */}
        {tab === "profile" && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn text-left mt-6">
            <h1 className="text-2xl font-extrabold tracking-tight">สรุปความสำเร็จของนักเรียน (My Achievements)</h1>
            <div className="rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
              <div className="flex items-center gap-4 border-b pb-6" style={{ borderColor: tx.borderS }}>
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg uppercase">
                  {displayName ? displayName.charAt(0) : "S"}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{displayName}</h3>
                  <p className="text-xs" style={{ color: tx.muted }}>สมาชิกระดับทั่วไป</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-sm tracking-wide uppercase" style={{ color: tx.muted }}>ความสำเร็จและเหรียญรางวัล</h4>
                <div className="rounded-2xl p-8 text-center border border-dashed" style={{ borderColor: tx.borderS }}>
                  <p className="text-sm font-bold" style={{ color: tx.secondary }}>ยังไม่มีเหรียญรางวัล</p>
                  <p className="text-xs mt-1" style={{ color: tx.faint }}>เข้าเรียนและทำแบบทดสอบเพื่อปลดล็อกเหรียญรางวัล!</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="py-8 border-t text-center text-xs mt-12" style={{ borderColor: tx.borderS, color: tx.faint }}>
        <p>© 2026 Math by Seng — Premium Student Area Platform</p>
      </footer>
    </div>
  );
}
