"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Award, CheckCircle, Video, FileText, ChevronRight,
  Play, Trophy, BarChart2, Moon, Sun, Search, Download, Check,
  Sparkles, Book, Clock, Menu, X, LogOut, ArrowUpRight, ArrowLeft, Upload
} from "lucide-react";
import { useUser, StudentSubmission } from "../context/UserContext";

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
  const { role, isAuthenticated, displayName, logout, meetings, darkMode, toggleDarkMode, assignments, submissions, addSubmission, lessons, courses } = useUser();
  const router = useRouter();
  const [tab,          setTab]          = useState<"dashboard"|"courses"|"study"|"profile">("dashboard");
  const [search,       setSearch]       = useState("");
  const [levelFilter,  setLevelFilter]  = useState<"all"|"m4"|"m5"|"m6"|"exam">("all");
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [lesson,       setLesson]       = useState("1.3 ความต่อเนื่อง of ฟังก์ชัน");
  const [studyTab,     setStudyTab]     = useState<"overview"|"resources"|"tasks">("overview");
  
  // Student task states
  const [activeTaskTab, setActiveTaskTab] = useState<"list" | "quiz" | "file">("list");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  
  // File submission state
  const [fileNameInput, setFileNameInput] = useState("");
  
  // Interactive Quiz state
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResultScore, setQuizResultScore] = useState<number | null>(null);
  const [quizResultSubmitted, setQuizResultSubmitted] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    } else if (role !== "student") {
      router.push("/teacher");
    }
  }, [isAuthenticated, role, router]);

  if (!isAuthenticated || role !== "student") {
    return null;
  }

  const filtered = courses.filter(c =>
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
                  เป้าหมายคะแนน A-Level คณิต 1 เต็ม 100 อยู่ไม่ไกล! มาร่วมพัฒนาทักษะการทำโจทย์แนวใหม่กันวันนี้
                </p>
              </div>

              <div className="relative z-10 flex gap-3 shrink-0 w-full sm:w-auto">
                <button onClick={() => setTab("study")}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-indigo-950 hover:bg-slate-200 font-bold px-5 py-3 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5">
                  <Play className="h-4 w-4" />
                  เรียนต่อห้องจำลอง
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="rounded-2xl p-6 flex items-center justify-between shadow-sm" style={card.style}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ความคืบหน้าภาพรวม</p>
                  <p className="text-2xl font-extrabold mt-1">4 คอร์สเรียนอยู่</p>
                  <div className="w-32 bg-slate-300 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-indigo-600 h-full" style={{ width: "45%" }} />
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
                  <Book className="h-6 w-6" />
                </div>
              </div>

              <div className="rounded-2xl p-6 flex items-center justify-between shadow-sm" style={card.style}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>เวลาสะสมที่ศึกษา</p>
                  <p className="text-2xl font-extrabold mt-1">12 ชั่วโมง 35 นาที</p>
                  <p className="text-[11px] mt-1" style={{ color: tx.faint }}>เป้าหมายสัปดาห์นี้: 15 ชม.</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
              </div>

              <div className="rounded-2xl p-6 flex items-center justify-between shadow-sm" style={card.style}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ควิซที่ผ่านแล้ว</p>
                  <p className="text-2xl font-extrabold mt-1">8 ชุดทดสอบ</p>
                  <p className="text-xs text-emerald-500 flex items-center gap-1 font-bold mt-1">
                    <CheckCircle className="h-3.5 w-3.5" /> ความถูกต้องเฉลี่ย 85%
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {courses.slice(0, 3).map((course) => (
                  <div key={course.id} className="rounded-2xl overflow-hidden shadow-sm group hover:shadow-xl transition-all duration-300 flex flex-col" style={card.style}>
                    <div className={`h-24 bg-gradient-to-tr ${course.gradientClass} p-5 text-white flex flex-col justify-between relative`}>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm self-start">
                        {course.levelLabel}
                      </span>
                      <h3 className="font-bold text-sm leading-snug line-clamp-1">{course.title}</h3>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs" style={{ color: tx.muted }}>
                          <span>บทเรียน: {course.lessonsCount} ตอน</span>
                          <span>ผู้สอน: {course.instructor}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span style={{ color: tx.muted }}>ความคืบหน้า</span>
                            <span className="text-indigo-500 dark:text-indigo-400">{course.progress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${course.progress}%` }} />
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setTab("study")}
                        className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5">
                        <Play className="h-3.5 w-3.5" /> เรียนต่อจากที่ค้างไว้
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                {(["all", "m4", "m5", "m6", "exam"] as const).map((lvl) => (
                  <button key={lvl} onClick={() => setLevelFilter(lvl)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border"
                    style={levelFilter === lvl
                      ? { backgroundColor: "#6366f1", borderColor: "#6366f1", color: "#fff" }
                      : { borderColor: tx.borderS, color: tx.secondary }}
                  >
                    {lvl === "all" && "ทั้งหมด"}
                    {lvl === "m4" && "ม.4"}
                    {lvl === "m5" && "ม.5"}
                    {lvl === "m6" && "ม.6"}
                    {lvl === "exam" && "เตรียมสอบ"}
                  </button>
                ))}
              </div>
            </div>

            {/* Course Search */}
            <div className="relative rounded-2xl border" style={{ borderColor: tx.border, backgroundColor: tx.surface }}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: tx.faint }} />
              <input type="text" placeholder="ค้นหาชื่อคอร์สเรียน..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm" style={{ color: tx.primary }} />
            </div>

            {/* Course Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filtered.map((course) => (
                <div key={course.id} className="rounded-2xl overflow-hidden shadow-md flex flex-col justify-between" style={card.style}>
                  <div className={`h-32 bg-gradient-to-tr ${course.gradientClass} p-6 text-white flex flex-col justify-between`}>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm self-start">
                      {course.levelLabel}
                    </span>
                    <h3 className="font-bold text-base leading-snug">{course.title}</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center text-xs" style={{ color: tx.muted }}>
                      <span>วิดีโอรวม {course.lessonsCount} ตอน</span>
                      <span>สอนโดย {course.instructor}</span>
                    </div>
                    <button onClick={() => setTab("study")}
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2">
                      <BookOpen className="h-4 w-4" /> เริ่มเรียนวิชานี้
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── 3. TAB: STUDY (INTERACTIVE STUDY ROOM) ─── */}
        {tab === "study" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn text-left">
            {/* Left side: Main Video Player */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-3xl overflow-hidden shadow-xl" style={card.style}>
                {/* YouTube Embedded Video Player */}
                {(() => {
                  // Find which parent lesson this sub-lesson belongs to
                  const calcLessons = lessons.filter(l => l.courseId === "calc-101");
                  let parentLesson = calcLessons[0]; // default
                  for (let chIdx = 0; chIdx < calcLessons.length; chIdx++) {
                    const ch = calcLessons[chIdx];
                    if (ch.subLessons && ch.subLessons.some(sub => sub.title === lesson)) {
                      parentLesson = ch;
                      break;
                    }
                  }
                  const videoId = parentLesson?.videoUrl ? extractYouTubeId(parentLesson.videoUrl) : null;
                  
                  return videoId ? (
                    <div className="relative aspect-video bg-black">
                      <iframe
                        key={videoId}
                        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                        title={parentLesson?.title || "วิดีโอบทเรียน"}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                        style={{ border: "none" }}
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-video bg-slate-950 flex flex-col items-center justify-center text-white">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-16 w-16 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-2xl">
                          <Video className="h-7 w-7" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: tx.faint }}>
                          ยังไม่มีวิดีโอสำหรับบทเรียนนี้
                        </span>
                        <p className="text-[10px] max-w-xs text-center" style={{ color: tx.faint }}>
                          ครูยังไม่ได้เพิ่มลิงก์ YouTube สำหรับบทเรียนนี้ กรุณาติดต่อครูผู้สอน
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Lesson Details */}
                <div className="p-6 space-y-2">
                  <h2 className="text-xl font-bold tracking-tight">{lesson}</h2>
                  <p className="text-sm" style={{ color: tx.muted }}>
                    คอร์ส: แคลคูลัส 101 สำหรับ ม.ปลาย (สอนโดยครูเซ็ง)
                  </p>
                </div>
              </div>

              {/* Study Area Sub Tabs */}
              <div className="rounded-3xl p-6 shadow-sm" style={card.style}>
                <div className="flex space-x-6 border-b pb-3 mb-4 overflow-x-auto whitespace-nowrap scrollbar-none" style={{ borderColor: tx.borderS }}>
                  <button onClick={() => setStudyTab("overview")} className="text-sm font-bold pb-2 border-b-2 transition-all px-1 shrink-0"
                    style={studyTab === "overview" ? { borderColor: tx.accent, color: tx.accent } : { borderColor: "transparent", color: tx.secondary }}>
                    รายละเอียดบทเรียน
                  </button>
                  <button onClick={() => setStudyTab("resources")} className="text-sm font-bold pb-2 border-b-2 transition-all px-1 shrink-0"
                    style={studyTab === "resources" ? { borderColor: tx.accent, color: tx.accent } : { borderColor: "transparent", color: tx.secondary }}>
                    ชีทเอกสารประกอบ (PDF)
                  </button>
                  <button onClick={() => setStudyTab("tasks")} className="text-sm font-bold pb-2 border-b-2 transition-all px-1 shrink-0"
                    style={studyTab === "tasks" ? { borderColor: tx.accent, color: tx.accent } : { borderColor: "transparent", color: tx.secondary }}>
                    งาน & ควิซท้ายบท (Tasks)
                  </button>
                </div>

                {studyTab === "overview" && (
                  <div className="space-y-4 text-sm leading-relaxed" style={{ color: tx.secondary }}>
                    <p><strong>รายละเอียดการบรรยาย:</strong></p>
                    <p>
                      ในหัวข้อนี้เราจะมานิยามเรื่องความต่อเนื่องของฟังก์ชัน (Continuity of Functions) โดยละเอียด โดยฟังก์ชัน f จะต่อเนื่องที่ x = a ก็ต่อเมื่อเงื่อนไข 3 ข้อต่อไปนี้เป็นจริงทั้งหมด:
                    </p>
                    <ul className="list-disc list-inside pl-4 space-y-1">
                      <li>f(a) สามารถหาค่าได้ (มีตัวตนอยู่จริง)</li>
                      <li>lim(x→a) f(x) สามารถหาค่าได้ (ลิมิตซ้ายเท่ากับลิมิตขวา)</li>
                      <li>lim(x→a) f(x) = f(a)</li>
                    </ul>
                  </div>
                )}

                {studyTab === "resources" && (
                  <div className="space-y-3">
                    <div className="rounded-xl p-4 border flex items-center justify-between" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                      <div className="flex items-center gap-3">
                        <FileText className="h-6 w-6 text-rose-500" />
                        <div>
                          <p className="text-xs font-bold leading-tight">สไลด์บรรยาย ความต่อเนื่องของฟังก์ชัน.pdf</p>
                          <p className="text-[10px]" style={{ color: tx.faint }}>ขนาดไฟล์: 4.8 MB · อัปเดตโดยครูเซ็ง</p>
                        </div>
                      </div>
                      <button className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors" title="ดาวน์โหลด PDF">
                        <Download className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                      </button>
                    </div>
                  </div>
                )}

                {studyTab === "tasks" && (
                  <div className="space-y-6">
                    {activeTaskTab === "list" && (
                      <div className="space-y-4 text-left">
                        <div className="text-left">
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>งานและแบบทดสอบที่ครูมอบหมาย</p>
                        </div>
                        {assignments.filter(a => a.courseId === "calc-101").length === 0 ? (
                          <div className="rounded-2xl p-8 text-center border border-dashed" style={{ borderColor: tx.borderS }}>
                            <p className="text-sm font-bold">ไม่มีงานที่มอบหมายในขณะนี้</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-4">
                            {assignments.filter(a => a.courseId === "calc-101").map((a) => {
                              const mySub = submissions.find(s => s.assignmentId === a.id && s.studentId === "std-current");
                              const isFileSubmitted = mySub?.type === "file";
                              const isQuizSubmitted = mySub?.type === "quiz";
                              
                              return (
                                <div key={a.id} className="rounded-2xl p-5 border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left" style={card.style}>
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                        a.type === "file" 
                                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" 
                                          : "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                                      }`}>
                                        {a.type === "file" ? "ส่งไฟล์" : "Quiz"}
                                      </span>
                                      <span className="text-[10px]" style={{ color: tx.faint }}>กำหนดส่ง: {a.dueDate}</span>
                                    </div>
                                    <h4 className="font-bold text-sm sm:text-base">{a.title}</h4>
                                    
                                    {/* Submission Status */}
                                    <div className="text-xs">
                                      {a.type === "file" ? (
                                        isFileSubmitted ? (
                                          <span className="text-emerald-500 font-bold flex items-center gap-1">
                                            <CheckCircle className="h-3.5 w-3.5" /> ส่งแล้ว (ไฟล์: {mySub?.fileName})
                                          </span>
                                        ) : (
                                          <span className="text-amber-500 font-bold">⏳ ยังไม่ส่ง</span>
                                        )
                                      ) : (
                                        isQuizSubmitted ? (
                                          <span className="text-emerald-500 font-bold flex items-center gap-1">
                                            <CheckCircle className="h-3.5 w-3.5" /> ทำเสร็จแล้ว (คะแนนที่ได้: {mySub?.score} / {a.questions?.length})
                                          </span>
                                        ) : (
                                          <span className="text-amber-500 font-bold">⏳ ยังไม่ได้ทำ</span>
                                        )
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="shrink-0 flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                    <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400">{a.points} คะแนน</span>
                                    <button
                                      onClick={() => {
                                        setSelectedAssignmentId(a.id);
                                        if (a.type === "file") {
                                          setActiveTaskTab("file");
                                        } else {
                                          setActiveTaskTab("quiz");
                                          setCurrentQuizQuestionIndex(0);
                                          setQuizAnswers({});
                                          setQuizResultSubmitted(false);
                                          setQuizResultScore(null);
                                        }
                                      }}
                                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition-all cursor-pointer"
                                    >
                                      {a.type === "file" ? (isFileSubmitted ? "ส่งอีกครั้ง" : "ส่งงาน") : (isQuizSubmitted ? "ดูผลคะแนน" : "เริ่มทำ")}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTaskTab === "file" && (() => {
                      const activeAssignment = assignments.find(a => a.id === selectedAssignmentId)!;
                      const mySub = submissions.find(s => s.assignmentId === activeAssignment.id && s.studentId === "std-current" && s.type === "file");
                      const hasSubmitted = !!mySub;
                      return (
                        <div className="space-y-6 text-left">
                          <button onClick={() => setActiveTaskTab("list")} className="flex items-center gap-2 text-xs font-bold hover:text-indigo-500 transition-colors">
                            <ArrowLeft className="h-4 w-4" /> กลับรายการงาน
                          </button>
                          
                          <div className="space-y-2 border-b pb-4" style={{ borderColor: tx.borderS }}>
                            <h3 className="text-lg font-bold">{activeAssignment.title}</h3>
                            <div className="flex justify-between text-xs" style={{ color: tx.muted }}>
                              <span>คะแนนเต็ม: {activeAssignment.points} คะแนน</span>
                              <span>กำหนดส่ง: {activeAssignment.dueDate}</span>
                            </div>
                          </div>

                          <div className="rounded-2xl p-5 border" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                            <h4 className="font-bold text-xs uppercase tracking-wider mb-2" style={{ color: tx.muted }}>โจทย์ / คำสั่งงาน</h4>
                            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: tx.secondary }}>{activeAssignment.instructions}</p>
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-bold text-xs uppercase tracking-wider" style={{ color: tx.muted }}>ส่งการบ้านของคุณ</h4>
                            {hasSubmitted && (
                              <div className="rounded-xl p-4 border text-xs" style={{ borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.05)" }}>
                                <p className="font-bold text-emerald-600 flex items-center gap-1">
                                  <Check className="h-4 w-4" /> ส่งการบ้านเรียบร้อยแล้ว
                                </p>
                                <p className="mt-1" style={{ color: tx.secondary }}>
                                  ไฟล์ที่ส่ง: <strong>{mySub?.fileName}</strong> (ส่งเมื่อ {new Date(mySub?.submittedAt || 0).toLocaleTimeString("th-TH") + " " + new Date(mySub?.submittedAt || 0).toLocaleDateString("th-TH")})
                                </p>
                              </div>
                            )}

                            <div className="p-8 rounded-2xl border border-dashed flex flex-col items-center justify-center space-y-4" style={{ borderColor: tx.borderS }}>
                              <Upload className="h-10 w-10" style={{ color: tx.faint }} />
                              <div className="w-full max-w-xs space-y-2 text-center">
                                <label className="text-xs font-bold" style={{ color: tx.muted }}>ชื่อไฟล์เพื่อจำลองการส่ง (เช่น calculus-hw1.pdf)</label>
                                <input 
                                  type="text" 
                                  value={fileNameInput} 
                                  onChange={(e) => setFileNameInput(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border bg-transparent text-xs text-center focus:outline-none" 
                                  style={{ borderColor: tx.border, color: tx.primary }} 
                                  placeholder="พิมพ์ชื่อไฟล์การบ้าน..." 
                                />
                              </div>
                              <button
                                disabled={!fileNameInput.trim()}
                                onClick={() => {
                                  const newSub: StudentSubmission = {
                                    id: "sub-" + Math.random().toString(36).substring(2, 9),
                                    assignmentId: activeAssignment.id,
                                    studentId: "std-current",
                                    studentName: displayName,
                                    submittedAt: Date.now(),
                                    type: "file",
                                    fileName: fileNameInput
                                  };
                                  addSubmission(newSub);
                                  setFileNameInput("");
                                  setActiveTaskTab("list");
                                }}
                                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
                              >
                                กดส่งไฟล์การบ้าน
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {activeTaskTab === "quiz" && (() => {
                      const activeAssignment = assignments.find(a => a.id === selectedAssignmentId)!;
                      const totalQuestions = activeAssignment.questions?.length || 0;
                      
                      // Check if already submitted in global state
                      const mySub = submissions.find(s => s.assignmentId === activeAssignment.id && s.studentId === "std-current" && s.type === "quiz");
                      const hasSubmitted = !!mySub || quizResultSubmitted;
                      const displayScore = mySub ? mySub.score : quizResultScore;
                      const displayAnswers = mySub ? (mySub.answers || {}) : quizAnswers;

                      return (
                        <div className="space-y-6 text-left">
                          <button onClick={() => setActiveTaskTab("list")} className="flex items-center gap-2 text-xs font-bold hover:text-indigo-500 transition-colors">
                            <ArrowLeft className="h-4 w-4" /> กลับรายการควิซ
                          </button>

                          <div className="space-y-2 border-b pb-4" style={{ borderColor: tx.borderS }}>
                            <h3 className="text-lg font-bold">{activeAssignment.title}</h3>
                            <div className="flex justify-between text-xs" style={{ color: tx.muted }}>
                              <span>เวลาจำกัด: {activeAssignment.timeLimit} นาที</span>
                              <span>คะแนนเต็ม: {activeAssignment.points} คะแนน</span>
                            </div>
                          </div>

                          {!hasSubmitted ? (
                            // QUIZ TAKING INTERFACE
                            (() => {
                              const q = activeAssignment.questions![currentQuizQuestionIndex];
                              const selectedAnswerIndex = quizAnswers[currentQuizQuestionIndex];

                              return (
                                <div className="space-y-6">
                                  <div className="flex justify-between items-center text-xs font-bold" style={{ color: tx.muted }}>
                                    <span>คำถามข้อที่ {currentQuizQuestionIndex + 1} จาก {totalQuestions} ข้อ</span>
                                    <span>เวลาทำโจทย์สะสม: {activeAssignment.timeLimit} นาที</span>
                                  </div>

                                  <div className="rounded-2xl p-5 border" style={{ borderColor: tx.borderS }}>
                                    <h4 className="font-bold text-sm sm:text-base leading-snug">{q.question}</h4>
                                  </div>

                                  <div className="grid grid-cols-1 gap-3">
                                    {q.options.map((opt, oIdx) => {
                                      const isSelected = selectedAnswerIndex === oIdx;
                                      return (
                                        <button 
                                          key={oIdx} 
                                          onClick={() => setQuizAnswers(prev => ({ ...prev, [currentQuizQuestionIndex]: oIdx }))}
                                          className="w-full text-left p-3.5 rounded-xl border text-xs font-semibold hover:border-indigo-500 transition-all bg-transparent cursor-pointer"
                                          style={isSelected ? { borderColor: tx.accent, color: tx.accent, backgroundColor: tx.accentBg } : { borderColor: tx.border, color: tx.secondary }}
                                        >
                                          {opt}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: tx.borderS }}>
                                    <button
                                      disabled={currentQuizQuestionIndex === 0}
                                      onClick={() => setCurrentQuizQuestionIndex(prev => prev - 1)}
                                      className="py-2 px-4 rounded-xl border font-bold text-xs disabled:opacity-40 cursor-pointer"
                                      style={{ borderColor: tx.borderS, color: tx.secondary }}
                                    >
                                      ข้อก่อนหน้า
                                    </button>

                                    {currentQuizQuestionIndex < totalQuestions - 1 ? (
                                      <button
                                        disabled={selectedAnswerIndex === undefined}
                                        onClick={() => setCurrentQuizQuestionIndex(prev => prev + 1)}
                                        className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs disabled:opacity-50 cursor-pointer"
                                      >
                                        ข้อถัดไป
                                      </button>
                                    ) : (
                                      <button
                                        disabled={Object.keys(quizAnswers).length < totalQuestions}
                                        onClick={() => {
                                          // Calculate score
                                          let score = 0;
                                          activeAssignment.questions!.forEach((q, idx) => {
                                            if (quizAnswers[idx] === q.correctIndex) {
                                              score++;
                                            }
                                          });
                                          const newSub: StudentSubmission = {
                                            id: "sub-" + Math.random().toString(36).substring(2, 9),
                                            assignmentId: activeAssignment.id,
                                            studentId: "std-current",
                                            studentName: displayName,
                                            submittedAt: Date.now(),
                                            type: "quiz",
                                            score: score,
                                            answers: quizAnswers
                                          };
                                          addSubmission(newSub);
                                          setQuizResultScore(score);
                                          setQuizResultSubmitted(true);
                                        }}
                                        className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
                                      >
                                        ส่งคำตอบแบบทดสอบ
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            // QUIZ RESULTS INTERFACE
                            <div className="space-y-6">
                              <div className="rounded-2xl p-6 text-center space-y-2 border" style={{ borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.04)" }}>
                                <p className="font-extrabold text-lg text-emerald-600">🎉 ทำแบบทดสอบเสร็จสมบูรณ์!</p>
                                <p className="text-3xl font-extrabold">{displayScore} / {totalQuestions} คะแนน</p>
                                <p className="text-xs" style={{ color: tx.muted }}>คิดเป็น {(((displayScore || 0) / totalQuestions) * 100).toFixed(0)}% ของคะแนนทั้งหมด</p>
                              </div>

                              <div className="space-y-4">
                                <h4 className="font-bold text-xs uppercase tracking-wider" style={{ color: tx.muted }}>ตรวจสอบคำเฉลยแต่ละข้อ</h4>
                                {activeAssignment.questions!.map((q, idx) => {
                                  const studentAns = displayAnswers[idx];
                                  const isCorrect = studentAns === q.correctIndex;
                                  return (
                                    <div key={idx} className="p-5 rounded-2xl border space-y-3 text-left" style={{ borderColor: isCorrect ? "#10b981" : "#f43f5e" }}>
                                      <h5 className="font-bold text-sm flex items-center gap-1.5">
                                        <span>ข้อที่ {idx + 1}: {q.question}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                          isCorrect ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50" : "bg-rose-100 text-rose-700 dark:bg-rose-950/50"
                                        }`}>
                                          {isCorrect ? "ถูกต้อง" : "ตอบผิด"}
                                        </span>
                                      </h5>
                                      <p className="text-xs" style={{ color: tx.muted }}>
                                        คุณตอบ: <span className={isCorrect ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>{q.options[studentAns]}</span>
                                      </p>
                                      <p className="text-xs" style={{ color: tx.muted }}>
                                        คำตอบที่ถูก: <span className="text-emerald-500 font-semibold">{q.options[q.correctIndex]}</span>
                                      </p>
                                      <div className="p-3 rounded-lg border text-xs" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                                        <strong>คำอธิบายเฉลย:</strong> {q.explanation}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Course Chapter List */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold tracking-tight">เนื้อหารายวิชา</h2>
              <div className="rounded-3xl p-6 shadow-sm space-y-6" style={card.style}>
                {lessons.filter(l => l.courseId === "calc-101").map((l) => {
                  const staticChapter = l.subLessons || [];
                  return (
                    <div key={l.id} className="space-y-3">
                      <h3 className="font-bold text-xs uppercase tracking-wider" style={{ color: tx.muted }}>
                        {l.title}
                      </h3>
                      <p className="text-[10px] leading-relaxed -mt-2.5" style={{ color: tx.faint }}>
                        {l.description}
                      </p>
                      <div className="space-y-1">
                        {staticChapter.map((subL) => {
                          const active = lesson === subL.title;
                          return (
                            <button key={subL.id} onClick={() => setLesson(subL.title)}
                              className="w-full text-left p-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer"
                              style={active
                                ? { backgroundColor: tx.accentBg, color: tx.accent }
                                : { color: tx.secondary }}
                            >
                              <span className="line-clamp-1">{subL.title}</span>
                              <span className="text-[10px]" style={{ color: tx.faint }}>{subL.duration}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── 4. TAB: PROFILE (ACHIEVEMENT DASHBOARD) ─── */}
        {tab === "profile" && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn text-left">
            <h1 className="text-2xl font-extrabold tracking-tight">สรุปความสำเร็จของนักเรียน (My Achievements)</h1>
            <div className="rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl" style={card.style}>
              <div className="flex items-center gap-4 border-b pb-6" style={{ borderColor: tx.borderS }}>
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg">
                  S
                </div>
                <div>
                  <h3 className="text-lg font-bold">{displayName}</h3>
                  <p className="text-xs" style={{ color: tx.muted }}>สมาชิกระดับ Premium · สมัครเมื่อ มกราคม 2026</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-sm tracking-wide uppercase" style={{ color: tx.muted }}>ความสำเร็จและเหรียญรางวัล</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl p-4 border flex items-center gap-3" style={{ borderColor: tx.borderS }}>
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">แชมป์แก้โจทย์ลิมิต</p>
                      <p className="text-[10px]" style={{ color: tx.faint }}>ทำแบบฝึกหัดลิมิตถูกต้อง 100% ในครั้งแรก</p>
                    </div>
                  </div>

                  <div className="rounded-2xl p-4 border flex items-center gap-3" style={{ borderColor: tx.borderS }}>
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">ผู้ใฝ่รู้อย่างต่อเนื่อง</p>
                      <p className="text-[10px]" style={{ color: tx.faint }}>ล็อกอินเข้าเรียนต่อเนื่องกัน 7 วัน</p>
                    </div>
                  </div>
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
