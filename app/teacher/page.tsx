"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Users, BarChart2, BookOpen, Video, LogOut, Moon, Sun,
  Plus, Calendar, Shield, Award, ChevronRight,
  Sparkles, ArrowUpRight, TrendingUp,
  Clipboard, Menu, X, ArrowLeft, Trash2, FileText
} from "lucide-react";
import { useUser, QuizQuestion, Assignment, StudentSubmission, Lesson } from "../context/UserContext";

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

// Mock data for teacher
const TEACHER_COURSES = [
  { id: "calc-101", title: "แคลคูลัส 101 สำหรับ ม.ปลาย", students: 48, rating: 4.9, activeMeetings: 1, gradient: "from-indigo-500 to-purple-600" },
  { id: "math-m4-t1", title: "สรุปเนื้อหาคณิตศาสตร์ ม.4 เทอม 1 & 2", students: 124, rating: 4.8, activeMeetings: 0, gradient: "from-blue-500 to-indigo-600" },
  { id: "alevel-math1", title: "ตะลุยโจทย์ A-Level คณิต 1 เข้มข้น", students: 89, rating: 5.0, activeMeetings: 2, gradient: "from-fuchsia-500 to-pink-600" },
];

const RECENT_STUDENT_ACTIVITIES = [
  { id: 1, name: "สมชาย ใจดี", course: "แคลคูลัส 101", action: "ส่งการบ้านบทที่ 1", time: "10 นาทีที่แล้ว", score: "9/10" },
  { id: 2, name: "กัญญา รักเรียน", course: "A-Level คณิต 1", action: "ทำควิซลิมิตและความต่อเนื่อง", time: "25 นาทีที่แล้ว", score: "8/10" },
  { id: 3, name: "วิชัย เพียรพยายาม", course: "คณิตศาสตร์ ม.4", action: "เข้าดูวิดีโอจำลอง", time: "1 ชั่วโมงที่แล้ว", score: null },
  { id: 4, name: "นภา ลอยฟ้า", course: "แคลคูลัส 101", action: "ทำควิซอนุพันธ์", time: "2 ชั่วโมงที่แล้ว", score: "10/10" },
];

const CURRENT_STUDENT = {
  id: "std-current",
  name: "น้องภูมินทร์ (ม.6)",
  status: "ส่งงานครบ",
  avgScore: "9.5/10",
};

export default function TeacherDashboard() {
  const { role, isAuthenticated, displayName, logout, meetings, darkMode, toggleDarkMode, assignments, addAssignment, submissions, lessons, updateLesson } = useUser();
  const router = useRouter();
  const [tab, setTab] = useState<"dashboard" | "courses" | "students">("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Course Detail states
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"assignments" | "lessons" | "students">("assignments");
  const [viewingAssignmentId, setViewingAssignmentId] = useState<string | null>(null);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [viewingQuizSub, setViewingQuizSub] = useState<StudentSubmission | null>(null);

  // Lesson Edit states
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState("");
  const [editLessonDescription, setEditLessonDescription] = useState("");
  const [editLessonVideoUrl, setEditLessonVideoUrl] = useState("");

  // Assignment Form state
  const [showForm, setShowForm] = useState(false);
  const [assignType, setAssignType] = useState<"file" | "quiz">("file");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignPoints, setAssignPoints] = useState(10);
  const [assignDueDate, setAssignDueDate] = useState("2026-06-15");
  const [assignInstructions, setAssignInstructions] = useState("");
  const [assignTimeLimit, setAssignTimeLimit] = useState(15);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([
    { question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" }
  ]);

  const handleUpdateQuestionText = (index: number, val: string) => {
    setQuizQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], question: val };
      return copy;
    });
  };

  const handleUpdateOptionText = (qIndex: number, optIndex: number, val: string) => {
    setQuizQuestions(prev => {
      const copy = [...prev];
      const qCopy = { ...copy[qIndex] };
      qCopy.options = [...qCopy.options];
      qCopy.options[optIndex] = val;
      copy[qIndex] = qCopy;
      return copy;
    });
  };

  const handleUpdateCorrectIndex = (qIndex: number, val: number) => {
    setQuizQuestions(prev => {
      const copy = [...prev];
      copy[qIndex] = { ...copy[qIndex], correctIndex: val };
      return copy;
    });
  };

  const handleUpdateExplanation = (qIndex: number, val: string) => {
    setQuizQuestions(prev => {
      const copy = [...prev];
      copy[qIndex] = { ...copy[qIndex], explanation: val };
      return copy;
    });
  };

  const handleAddQuestion = () => {
    setQuizQuestions(prev => [
      ...prev,
      { question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" }
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuizQuestions(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateAssignment = (e: FormEvent) => {
    e.preventDefault();
    if (!assignTitle.trim()) return;

    const newAssignment: Assignment = {
      id: "assign-" + Math.random().toString(36).substring(2, 9),
      courseId: selectedCourseId || "",
      type: assignType,
      title: assignTitle,
      dueDate: assignDueDate,
      points: Number(assignPoints),
      createdAt: Date.now(),
      ...(assignType === "file" 
        ? { instructions: assignInstructions } 
        : { timeLimit: Number(assignTimeLimit), questions: quizQuestions }
      )
    };

    addAssignment(newAssignment);
    
    // Reset Form
    setAssignTitle("");
    setAssignPoints(10);
    setAssignDueDate("2026-06-15");
    setAssignInstructions("");
    setAssignTimeLimit(15);
    setQuizQuestions([{ question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" }]);
    setShowForm(false);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    } else if (role !== "teacher") {
      router.push("/student");
    }
  }, [isAuthenticated, role, router]);



  const MOCK_STUDENTS = [
    { id: "std-1", name: "สมชาย ใจดี", status: "ส่งงานครบ", avgScore: "8.5/10" },
    { id: "std-2", name: "กัญญา รักเรียน", status: "ส่งงานครบ", avgScore: "9.0/10" },
    { id: "std-3", name: "วิชัย เพียรพยายาม", status: "ค้างส่ง 1 งาน", avgScore: "7.0/10" },
    { id: "std-4", name: "นภา ลอยฟ้า", status: "ส่งงานครบ", avgScore: "9.5/10" }
  ];

  if (!isAuthenticated || role !== "teacher") {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>
      {/* HEADER */}
      <header className="sticky top-0 z-50 glass-panel shadow-sm" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 bg-clip-text text-transparent text-xl font-bold tracking-tight">
                  Math by Seng
                </span>
                <span className="block text-[10px] font-bold tracking-widest uppercase -mt-1" style={{ color: tx.muted }}>
                  Teacher Workspace
                </span>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-1">
              <button onClick={() => setTab("dashboard")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all" style={tab === "dashboard" ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 } : { color: tx.secondary }}>
                <BarChart2 className="h-4 w-4" />
                แดชบอร์ดหลัก
              </button>
              <button onClick={() => setTab("courses")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all" style={tab === "courses" ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 } : { color: tx.secondary }}>
                <BookOpen className="h-4 w-4" />
                คอร์สที่ฉันสอน
              </button>
              <button onClick={() => router.push("/teacher/teams")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all" style={{ color: tx.secondary }}>
                <Video className="h-4 w-4" />
                สร้าง Teams Meeting
              </button>
            </nav>

            {/* Settings & Profile */}
            <div className="flex items-center gap-3">
              <button onClick={toggleDarkMode} className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors" style={{ color: tx.secondary }}>
                {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
              </button>
              
              <div className="h-8 w-px" style={{ backgroundColor: tx.borderS }} />

              <div className="flex items-center gap-3 pl-1">
                <button onClick={() => router.push("/profile")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity" title="ดูโปรไฟล์">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                    T
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-bold leading-tight">{displayName}</p>
                    <p className="text-[10px]" style={{ color: tx.muted }}>ผู้จัดการระบบผู้สอน</p>
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

        {/* Mobile menu drawer */}
        {mobileOpen && (
          <div className="md:hidden glass-panel border-b animate-fadeIn" style={{ borderColor: tx.borderS }}>
            <div className="px-2 pt-2 pb-3 space-y-1">
              <button onClick={() => { setTab("dashboard"); setMobileOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium transition-all"
                style={tab === "dashboard" ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 } : { color: tx.secondary }}
              >
                <BarChart2 className="h-5 w-5" />
                แดชบอร์ดหลัก
              </button>
              <button onClick={() => { setTab("courses"); setMobileOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium transition-all"
                style={tab === "courses" ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 } : { color: tx.secondary }}
              >
                <BookOpen className="h-5 w-5" />
                คอร์สที่ฉันสอน
              </button>
              <button onClick={() => { router.push("/teacher/teams"); setMobileOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium transition-all"
                style={{ color: tx.secondary }}
              >
                <Video className="h-5 w-5" />
                สร้าง Teams Meeting
              </button>
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tab === "dashboard" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Hero / Welcome */}
            <div className="rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-xl text-white bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950">
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Shield className="h-3 w-3" /> Teacher Dashboard
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight">สวัสดีครับ, {displayName} 👨‍🏫</h1>
                <p className="text-indigo-200 text-sm max-w-xl">
                  ยินดีต้อนรับกลับสู่ระบบจัดการคอร์สและการเรียนการสอนของ Math by Seng วันนี้มีห้องเรียนและข้อมูลกิจกรรมใหม่ให้ตรวจสอบ
                </p>
              </div>
              <div className="relative z-10 flex gap-3 shrink-0 w-full sm:w-auto">
                <button onClick={() => router.push("/teacher/teams")} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-5 py-3 rounded-2xl shadow-lg transition-transform hover:-translate-y-0.5">
                  <Plus className="h-5 w-5" />
                  สร้างห้องเรียน Teams
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="rounded-2xl p-6 flex items-center justify-between shadow-sm transition-all" style={card.style}>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>นักเรียนทั้งหมด</p>
                  <p className="text-3xl font-extrabold">261 คน</p>
                  <p className="text-xs text-emerald-500 flex items-center gap-1 font-bold">
                    <TrendingUp className="h-3 w-3" /> +12% เดือนนี้
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
              </div>

              <div className="rounded-2xl p-6 flex items-center justify-between shadow-sm transition-all" style={card.style}>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ชั่วโมงสอนสะสม</p>
                  <p className="text-3xl font-extrabold">95 ชม.</p>
                  <p className="text-xs flex items-center gap-1 font-medium" style={{ color: tx.muted }}>
                    จากวิดีโอและไลฟ์
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 flex items-center justify-center">
                  <Video className="h-6 w-6" />
                </div>
              </div>

              <div className="rounded-2xl p-6 flex items-center justify-between shadow-sm transition-all" style={card.style}>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>คอร์สที่เปิดสอน</p>
                  <p className="text-3xl font-extrabold">3 คอร์ส</p>
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 font-bold">
                    มีสตรีมไลฟ์สดอยู่
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <BookOpen className="h-6 w-6" />
                </div>
              </div>

              <div className="rounded-2xl p-6 flex items-center justify-between shadow-sm transition-all" style={card.style}>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>การส่งการบ้านสะสม</p>
                  <p className="text-3xl font-extrabold">88.5%</p>
                  <p className="text-xs text-emerald-500 flex items-center gap-1 font-bold">
                    สูงกว่าเกณฑ์เฉลี่ย
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
                  <Clipboard className="h-6 w-6" />
                </div>
              </div>
            </div>

            {/* Main Area: Course List & Student Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Courses overview list */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold tracking-tight">คอร์สเรียนหลักที่ครูดูแล</h2>
                  <button onClick={() => setTab("courses")} className="text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1">
                    ดูคอร์สทั้งหมด <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {TEACHER_COURSES.map((course) => (
                    <div key={course.id} className="rounded-2xl p-5 relative overflow-hidden shadow-md group hover:shadow-xl transition-all" style={card.style}>
                      <div className={`h-2 w-full bg-gradient-to-r ${course.gradient} absolute top-0 left-0`} />
                      <div className="space-y-4 pt-2">
                        <h3 className="font-bold text-base leading-snug line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {course.title}
                        </h3>
                        <div className="flex items-center justify-between text-xs" style={{ color: tx.muted }}>
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> นักเรียน {course.students} คน</span>
                          <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5 text-amber-500" /> คะแนนเฉลี่ย {course.rating}</span>
                        </div>
                        <div className="pt-2 flex justify-between items-center border-t border-slate-300 dark:border-slate-700">
                          {course.activeMeetings > 0 ? (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 flex items-center gap-1 animate-pulse">
                              ● Live Active ({course.activeMeetings})
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium" style={{ color: tx.faint }}>ไม่มีไลฟ์ตอนนี้</span>
                          )}
                          <button onClick={() => router.push("/teacher/teams")} className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-950/40 hover:bg-indigo-500 dark:hover:bg-indigo-500 hover:text-white dark:hover:text-white transition-colors" title="สร้างห้องประชุม Teams">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real-time Student activities feed */}
              <div className="space-y-6">
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

            {/* Created Meetings List */}
            {meetings.length > 0 && (
              <div className="space-y-4 pt-4">
                <h2 className="text-xl font-bold tracking-tight">Microsoft Teams Meeting ที่คุณเพิ่งสร้างขึ้น</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {meetings.map((m) => (
                    <div key={m.id} className="rounded-2xl p-5 flex flex-col justify-between shadow-md" style={card.style}>
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                            ID: {m.id}
                          </span>
                          <span className="text-xs" style={{ color: tx.faint }}>
                            สร้างผ่าน API
                          </span>
                        </div>
                        <h4 className="font-bold text-sm line-clamp-1">{m.subject}</h4>
                        <p className="text-xs flex items-center gap-1.5" style={{ color: tx.muted }}>
                          <Calendar className="h-3.5 w-3.5" /> {m.startDateTime} น.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-300 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-mono" style={{ color: tx.muted }}>Passcode: {m.passcode}</span>
                        <a href={m.joinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline">
                          เปิด Teams <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "courses" && (
          selectedCourseId && TEACHER_COURSES.find(c => c.id === selectedCourseId) ? (
            // COURSE DETAILS SUBVIEW
            (() => {
              const selectedCourse = TEACHER_COURSES.find(c => c.id === selectedCourseId)!;
              const courseAssignments = assignments.filter(a => a.courseId === selectedCourseId);
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
                        {selectedCourse.title.includes("ม.4") ? "มัธยมศึกษาปีที่ 4" : selectedCourse.title.includes("ม.5") ? "มัธยมศึกษาปีที่ 5" : "เตรียมสอบเข้ามหาวิทยาลัย"}
                      </span>
                      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{selectedCourse.title}</h1>
                      <p className="text-indigo-200 text-sm max-w-xl">
                        ผู้สอน: ครูเซ็ง · ห้องเรียน: {selectedCourse.students} คน
                      </p>
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
                      รายชื่อนักเรียน ({selectedCourse.students})
                    </button>
                  </div>

                  {/* Tab 1: Assignments */}
                  {detailTab === "assignments" && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">งานที่มอบหมายทั้งหมดในวิชานี้</h3>
                        {!showForm && (
                          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all">
                            <Plus className="h-4 w-4" /> สร้างงาน / ควิซใหม่
                          </button>
                        )}
                      </div>

                      {/* Creation Form */}
                      {showForm && (
                        <form onSubmit={handleCreateAssignment} className="rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl border" style={card.style}>
                          <h3 className="font-extrabold text-lg">แบบฟอร์มสร้างภารกิจใหม่</h3>
                          
                          {/* Type Select */}
                          <div className="grid grid-cols-2 gap-4">
                            <button type="button" onClick={() => setAssignType("file")} className="py-3 px-4 rounded-xl border text-center font-bold text-sm transition-all cursor-pointer"
                              style={assignType === "file" ? { borderColor: tx.accent, color: tx.accent, backgroundColor: tx.accentBg } : { borderColor: tx.borderS, color: tx.secondary }}>
                              แบบส่งไฟล์ (File Submission)
                            </button>
                            <button type="button" onClick={() => setAssignType("quiz")} className="py-3 px-4 rounded-xl border text-center font-bold text-sm transition-all cursor-pointer"
                              style={assignType === "quiz" ? { borderColor: tx.accent, color: tx.accent, backgroundColor: tx.accentBg } : { borderColor: tx.borderS, color: tx.secondary }}>
                              แบบทดสอบตอบคำถาม (Quiz)
                            </button>
                          </div>

                          {/* Title */}
                          <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>หัวข้อการสั่งงาน / แบบทดสอบ</label>
                            <input type="text" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} placeholder="เช่น การบ้านบทที่ 1 หรือ ควิซย่อยความต่อเนื่อง" />
                          </div>

                          {/* Points & Due Date */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>คะแนนเต็ม (Points)</label>
                              <input type="number" min={1} value={assignPoints} onChange={(e) => setAssignPoints(Number(e.target.value))} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>กำหนดส่งงาน (Due Date)</label>
                              <input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
                            </div>
                          </div>

                          {/* Render Sub Form based on type */}
                          {assignType === "file" ? (
                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>คำชี้แจงโจทย์การบ้าน</label>
                              <textarea value={assignInstructions} onChange={(e) => setAssignInstructions(e.target.value)} required rows={4} className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} placeholder="ระบุสิ่งที่นักเรียนต้องทำ พร้อมรายละเอียดการส่งไฟล์..." />
                            </div>
                          ) : (
                            <div className="space-y-6">
                              <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>จำกัดเวลาในการทำควิซ (นาที)</label>
                                <input type="number" min={1} value={assignTimeLimit} onChange={(e) => setAssignTimeLimit(Number(e.target.value))} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
                              </div>

                              <div className="space-y-4">
                                <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: tx.borderS }}>
                                  <label className="text-sm font-bold uppercase tracking-wider" style={{ color: tx.secondary }}>ตั้งโจทย์แบบทดสอบ ({quizQuestions.length} ข้อ)</label>
                                  <button type="button" onClick={handleAddQuestion} className="text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline">
                                    + เพิ่มข้อสอบใหม่
                                  </button>
                                </div>

                                {quizQuestions.map((q, idx) => (
                                  <div key={idx} className="p-5 rounded-2xl border space-y-4 text-left" style={{ borderColor: tx.borderS }}>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400">ข้อสอบข้อที่ {idx + 1}</span>
                                      {quizQuestions.length > 1 && (
                                        <button type="button" onClick={() => handleRemoveQuestion(idx)} className="text-xs text-rose-500 font-bold hover:underline flex items-center gap-1">
                                          <Trash2 className="h-4 w-4" /> ลบข้อสอบข้อนี้
                                        </button>
                                      )}
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-xs font-bold" style={{ color: tx.muted }}>โจทย์ข้อสอบ</label>
                                      <input type="text" value={q.question} onChange={(e) => handleUpdateQuestionText(idx, e.target.value)} required className="w-full px-3 py-2 rounded-xl border bg-transparent text-xs" style={{ borderColor: tx.border, color: tx.primary }} placeholder="เช่น lim(x->2) (x-2) มีค่าเท่ากับเท่าใด?" />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {q.options.map((opt, oIdx) => (
                                        <div key={oIdx} className="space-y-1">
                                          <label className="text-[10px] font-bold" style={{ color: tx.muted }}>ตัวเลือก {oIdx + 1} ({String.fromCharCode(65 + oIdx)})</label>
                                          <input type="text" value={opt} onChange={(e) => handleUpdateOptionText(idx, oIdx, e.target.value)} required className="w-full px-3 py-2 rounded-xl border bg-transparent text-xs" style={{ borderColor: tx.border, color: tx.primary }} placeholder={`ตัวเลือก ${oIdx + 1}`} />
                                        </div>
                                      ))}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                        <label className="text-xs font-bold" style={{ color: tx.muted }}>เฉลยตัวเลือกที่ถูกต้อง</label>
                                        <select value={q.correctIndex} onChange={(e) => handleUpdateCorrectIndex(idx, Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border bg-transparent text-xs" style={{ borderColor: tx.border, color: tx.primary }}>
                                          {q.options.map((_, oIdx) => (
                                            <option key={oIdx} value={oIdx}>ตัวเลือกที่ {oIdx + 1} ({String.fromCharCode(65 + oIdx)})</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs font-bold" style={{ color: tx.muted }}>คำเฉลยอธิบายเพิ่มเติม</label>
                                        <input type="text" value={q.explanation} onChange={(e) => handleUpdateExplanation(idx, e.target.value)} className="w-full px-3 py-2 rounded-xl border bg-transparent text-xs" style={{ borderColor: tx.border, color: tx.primary }} placeholder="เช่น เพราะต้องหาลิมิตซ้ายขวา..." />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Submit / Cancel buttons */}
                          <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: tx.borderS }}>
                            <button type="button" onClick={() => setShowForm(false)} className="py-2.5 px-4 rounded-xl border font-bold text-xs cursor-pointer" style={{ borderColor: tx.borderS, color: tx.secondary }}>
                              ยกเลิก
                            </button>
                            <button type="submit" className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md cursor-pointer">
                              เผยแพร่งานสู่คอร์สเรียน
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Assignments List */}
                      {viewingAssignmentId ? (
                        (() => {
                          const activeAssignment = assignments.find(a => a.id === viewingAssignmentId)!;
                          const activeSubmissions = submissions.filter(s => s.assignmentId === viewingAssignmentId);
                          
                          const totalStudents = MOCK_STUDENTS.length + 1;
                          const submissionsCount = activeSubmissions.length;
                          const submissionRate = ((submissionsCount / totalStudents) * 100).toFixed(0);
                          
                          const quizSubs = activeSubmissions.filter(s => s.type === "quiz");
                          const classAverage = quizSubs.length > 0
                            ? (quizSubs.reduce((acc, curr) => acc + (curr.score || 0), 0) / quizSubs.length).toFixed(1)
                            : null;

                          return (
                            <div className="space-y-6 text-left animate-fadeIn">
                              <button onClick={() => setViewingAssignmentId(null)} className="flex items-center gap-2 text-xs font-bold hover:text-indigo-500 transition-colors">
                                <ArrowLeft className="h-4 w-4" /> กลับรายการงานทั้งหมด
                              </button>

                              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b pb-4" style={{ borderColor: tx.borderS }}>
                                <div>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    activeAssignment.type === 'file' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50' : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50'
                                  }`}>
                                    {activeAssignment.type === 'file' ? 'ส่งไฟล์' : 'Quiz'}
                                  </span>
                                  <h3 className="text-xl font-bold mt-1">{activeAssignment.title}</h3>
                                  <p className="text-xs mt-1" style={{ color: tx.muted }}>
                                    คะแนนเต็ม {activeAssignment.points} คะแนน · กำหนดส่ง {activeAssignment.dueDate}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 rounded-2xl border text-center" style={card.style}>
                                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ส่งแล้ว / ทั้งหมด</p>
                                  <p className="text-2xl font-black text-indigo-500 mt-1">{submissionsCount} / {totalStudents} คน</p>
                                </div>
                                <div className="p-4 rounded-2xl border text-center" style={card.style}>
                                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>อัตราการส่งงาน</p>
                                  <p className="text-2xl font-black text-emerald-500 mt-1">{submissionRate}%</p>
                                </div>
                                <div className="p-4 rounded-2xl border text-center" style={card.style}>
                                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                                    {activeAssignment.type === 'file' ? 'ประเภทการส่ง' : 'คะแนนเฉลี่ย'}
                                  </p>
                                  <p className="text-2xl font-black text-purple-500 mt-1">
                                    {activeAssignment.type === 'file' ? 'ไฟล์ PDF / รูปภาพ' : (classAverage !== null ? `${classAverage} / ${activeAssignment.questions?.length}` : '-')}
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-3xl p-6 shadow-sm border space-y-4" style={card.style}>
                                <h4 className="font-bold text-base">บันทึกการส่งงานของนักเรียน</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs sm:text-sm text-left">
                                    <thead>
                                      <tr className="border-b" style={{ borderColor: tx.borderS }}>
                                        <th className="pb-2 font-bold" style={{ color: tx.muted }}>นักเรียน</th>
                                        <th className="pb-2 font-bold" style={{ color: tx.muted }}>วันที่ส่ง</th>
                                        <th className="pb-2 font-bold" style={{ color: tx.muted }}>สถานะ</th>
                                        <th className="pb-2 font-bold" style={{ color: tx.muted }}>ผลงาน / คะแนน</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[
                                        ...MOCK_STUDENTS,
                                        CURRENT_STUDENT
                                      ].map((student) => {
                                        const sub = activeSubmissions.find(s => s.studentId === student.id);
                                        return (
                                          <tr key={student.id} className="border-b last:border-b-0" style={{ borderColor: tx.borderS }}>
                                            <td className="py-3">
                                              <p className="font-bold">{student.name}</p>
                                              <p className="text-[10px]" style={{ color: tx.faint }}>รหัส: {student.id}</p>
                                            </td>
                                            <td className="py-3">
                                              {sub ? new Date(sub.submittedAt).toLocaleString("th-TH") : "-"}
                                            </td>
                                            <td className="py-3">
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                sub ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50"
                                              }`}>
                                                {sub ? "ส่งแล้ว" : "ยังไม่ส่ง"}
                                              </span>
                                            </td>
                                            <td className="py-3 font-semibold">
                                              {sub ? (
                                                sub.type === "file" ? (
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-xs line-clamp-1 max-w-[150px] font-mono" style={{ color: tx.muted }}>{sub.fileName}</span>
                                                    <button type="button" onClick={() => alert(`จำลองการเปิดไฟล์: ${sub.fileName}`)} className="text-[10px] text-indigo-500 hover:underline cursor-pointer">เปิดดูไฟล์</button>
                                                  </div>
                                                ) : (
                                                  <div className="flex items-center gap-3">
                                                    <span className="text-emerald-600 font-bold">{sub.score} / {activeAssignment.questions?.length} คะแนน</span>
                                                    <button type="button" onClick={() => setViewingQuizSub(sub)} className="text-[10px] text-indigo-500 hover:underline cursor-pointer">ตรวจคำตอบ</button>
                                                  </div>
                                                )
                                              ) : (
                                                <span style={{ color: tx.faint }} className="font-normal">-</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        courseAssignments.length === 0 ? (
                          <div className="rounded-3xl p-12 text-center border border-dashed flex flex-col items-center justify-center" style={{ borderColor: tx.borderS }}>
                            <FileText className="h-10 w-10 mb-2" style={{ color: tx.faint }} />
                            <p className="font-bold text-sm">ยังไม่มีงานหรือควิซการทดสอบ</p>
                            <p className="text-xs mt-1" style={{ color: tx.muted }}>คุณครูสามารถกดสร้างงานใหม่ เพื่อมอบหมายโจทย์ต่างๆ หรือทำชุดคำถามให้เรียนรู้ได้</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-4">
                            {courseAssignments.map((a) => (
                              <div key={a.id} className="rounded-2xl p-5 shadow-sm border text-left flex justify-between items-start" style={card.style}>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      a.type === 'file' 
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' 
                                        : 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
                                    }`}>
                                      {a.type === 'file' ? 'ส่งไฟล์' : 'Quiz แบบทดสอบ'}
                                    </span>
                                    <span className="text-[10px]" style={{ color: tx.faint }}>
                                      สร้างเมื่อ {new Date(a.createdAt).toLocaleDateString("th-TH")}
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-sm sm:text-base">{a.title}</h4>
                                  {a.type === 'file' ? (
                                    <p className="text-xs line-clamp-2" style={{ color: tx.muted }}><strong>คำสั่ง:</strong> {a.instructions}</p>
                                  ) : (
                                    <p className="text-xs" style={{ color: tx.muted }}>
                                      <strong>ข้อสอบ:</strong> {a.questions?.length} ข้อ · <strong>เวลาทำ:</strong> {a.timeLimit} นาที
                                    </p>
                                  )}
                                </div>
                                
                                <div className="text-right shrink-0 flex flex-col justify-between items-end min-h-[70px]">
                                  <div>
                                    <p className="text-xs sm:text-sm font-bold text-indigo-500 dark:text-indigo-400">{a.points} คะแนนเต็ม</p>
                                    <p className="text-[10px] mt-1" style={{ color: tx.faint }}>ครบกำหนด: {a.dueDate}</p>
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => setViewingAssignmentId(a.id)}
                                    className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <Users className="h-3 w-3" /> ดูการส่งงาน
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Tab 2: Lessons */}
                  {detailTab === "lessons" && (
                    <div className="rounded-3xl p-6 shadow-sm border space-y-4" style={card.style}>
                      <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: tx.borderS }}>
                        <h3 className="font-bold text-lg">โครงสร้างบทเรียนหลักสูตร</h3>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                          {lessons.filter(l => l.courseId === selectedCourseId).length} บทเรียน
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {lessons.filter(l => l.courseId === selectedCourseId).map((l) => (
                          <div key={l.id} className="p-5 rounded-2xl border text-left flex flex-col sm:flex-row justify-between sm:items-start gap-4 transition-all" style={{ borderColor: tx.borderS }}>
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <h4 className="font-bold text-sm sm:text-base text-indigo-600 dark:text-indigo-400">{l.title}</h4>
                              <p className="text-xs leading-relaxed max-w-2xl" style={{ color: tx.muted }}>{l.description}</p>
                              {l.videoUrl && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Video className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                  <span className="text-[10px] font-mono truncate max-w-[300px]" style={{ color: tx.faint }}>{l.videoUrl}</span>
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLesson(l);
                                setEditLessonTitle(l.title);
                                setEditLessonDescription(l.description);
                                setEditLessonVideoUrl(l.videoUrl || "");
                              }}
                              className="py-1.5 px-3 rounded-lg border border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/10 font-bold text-xs transition-all shrink-0 cursor-pointer self-start sm:self-center"
                            >
                              แก้ไขรายละเอียด
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Students */}
                  {detailTab === "students" && (
                    viewingStudentId ? (
                      (() => {
                        const studentName = [
                          ...MOCK_STUDENTS,
                          CURRENT_STUDENT
                        ].find(s => s.id === viewingStudentId)?.name || "นักเรียน";
                        
                        const studentSubs = submissions.filter(s => s.studentId === viewingStudentId);

                        return (
                          <div className="space-y-6 text-left animate-fadeIn">
                            <button onClick={() => setViewingStudentId(null)} className="flex items-center gap-2 text-xs font-bold hover:text-indigo-500 transition-colors">
                              <ArrowLeft className="h-4 w-4" /> กลับรายชื่อนักเรียนทั้งหมด
                            </button>

                            <div className="rounded-3xl p-6 shadow-sm border space-y-6" style={card.style}>
                              <div className="flex items-center gap-4 border-b pb-4" style={{ borderColor: tx.borderS }}>
                                <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                                  {studentName.charAt(0)}
                                </div>
                                <div>
                                  <h3 className="font-extrabold text-base sm:text-lg">{studentName}</h3>
                                  <p className="text-xs" style={{ color: tx.muted }}>รหัสนักเรียน: {viewingStudentId}</p>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <h4 className="font-bold text-sm">รายการงานและประวัติการส่ง</h4>
                                {courseAssignments.length === 0 ? (
                                  <p className="text-xs" style={{ color: tx.muted }}>ยังไม่มีงานมอบหมายในระบบ</p>
                                ) : (
                                  <div className="grid grid-cols-1 gap-3">
                                    {courseAssignments.map((a) => {
                                      const sub = studentSubs.find(s => s.assignmentId === a.id);
                                      return (
                                        <div key={a.id} className="p-4 rounded-xl border flex justify-between items-center text-xs" style={{ borderColor: tx.borderS }}>
                                          <div className="space-y-1">
                                            <p className="font-bold">{a.title}</p>
                                            <p className="text-[10px]" style={{ color: tx.muted }}>กำหนดส่ง: {a.dueDate}</p>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                              sub ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50"
                                            }`}>
                                              {sub ? "ส่งแล้ว" : "ยังไม่ส่ง"}
                                            </span>
                                            {sub && (
                                              sub.type === "file" ? (
                                                <button type="button" onClick={() => alert(`จำลองการเปิดไฟล์: ${sub.fileName}`)} className="text-[10px] text-indigo-500 hover:underline cursor-pointer">ดูไฟล์ที่ส่ง</button>
                                              ) : (
                                                <button type="button" onClick={() => setViewingQuizSub(sub)} className="text-[10px] text-indigo-500 hover:underline cursor-pointer">ตรวจคำตอบ ({sub.score} คะแนน)</button>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="rounded-3xl p-6 shadow-sm border space-y-4" style={card.style}>
                        <h3 className="font-bold text-lg">นักเรียนที่กำลังเรียนในขณะนี้</h3>
                        <p className="text-xs" style={{ color: tx.muted }}>* คลิกที่ชื่อนักเรียนแต่ละคนเพื่อดูประวัติการส่งงานและคะแนนอย่างละเอียด</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs sm:text-sm text-left">
                            <thead>
                              <tr className="border-b" style={{ borderColor: tx.borderS }}>
                                <th className="pb-2 font-bold" style={{ color: tx.muted }}>รหัสนักเรียน</th>
                                <th className="pb-2 font-bold" style={{ color: tx.muted }}>ชื่อ-นามสกุล</th>
                                <th className="pb-2 font-bold" style={{ color: tx.muted }}>สถานะการส่งงาน</th>
                                <th className="pb-2 font-bold" style={{ color: tx.muted }}>คะแนนเฉลี่ย</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                ...MOCK_STUDENTS,
                                CURRENT_STUDENT
                              ].map((s, idx) => {
                                const studentAssignments = assignments.filter(a => a.courseId === selectedCourseId);
                                const studentSubs = submissions.filter(sub => sub.studentId === s.id && studentAssignments.some(a => a.id === sub.assignmentId));
                                const hasPending = studentAssignments.some(a => !studentSubs.some(sub => sub.assignmentId === a.id));
                                const displayStatus = hasPending ? "ค้างส่งงาน" : "ส่งงานครบ";
                                
                                return (
                                  <tr key={idx} 
                                    onClick={() => setViewingStudentId(s.id)}
                                    className="border-b last:border-b-0 hover:bg-slate-200/40 dark:hover:bg-slate-700/30 cursor-pointer transition-colors" 
                                    style={{ borderColor: tx.borderS }}>
                                    <td className="py-3 font-mono">{s.id}</td>
                                    <td className="py-3 font-bold">{s.name}</td>
                                    <td className="py-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        displayStatus === "ส่งงานครบ" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                      }`}>
                                        {displayStatus}
                                      </span>
                                    </td>
                                    <td className="py-3 text-indigo-500 font-bold">
                                      {s.avgScore}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  )}
                </div>
              );
            })()
          ) : (
            // ORIGINAL COURSE LIST VIEW
            <div className="space-y-6 animate-fadeIn">
              <div className="text-left">
                <h2 className="text-2xl font-bold tracking-tight">การจัดการคอร์สเรียน (Course Dashboard)</h2>
                <p className="text-sm mt-1" style={{ color: tx.muted }}>เลือกจัดการหลักสูตร เนื้อหา วิดีโอ และแบบทดสอบสำหรับแต่ละรายวิชาที่รับผิดชอบ</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TEACHER_COURSES.map((course) => (
                  <div key={course.id} className="rounded-2xl p-6 flex flex-col justify-between shadow-md text-left" style={card.style}>
                    <div className="space-y-4">
                      <div className={`h-12 w-12 rounded-xl bg-gradient-to-tr ${course.gradient} text-white flex items-center justify-center shadow-md`}>
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <h3 className="font-bold text-lg leading-snug">{course.title}</h3>
                      <p className="text-xs" style={{ color: tx.muted }}>
                        เป็นอาจารย์ผู้สอนหลัก จัดทำสื่อ สไลด์ วิดีโอ และแบบทดสอบ
                      </p>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-300 dark:border-slate-700 flex justify-between items-center">
                      <span className="text-xs font-bold" style={{ color: tx.muted }}>
                        {course.students} คนที่กำลังเรียน
                      </span>
                      <button onClick={() => setSelectedCourseId(course.id)} className="flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline cursor-pointer">
                        แก้ไขเนื้อหาบทเรียน <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </main>

      {/* FOOTER */}
      <footer className="py-6 mt-12 border-t text-center text-xs" style={{ borderColor: tx.borderS, color: tx.faint }}>
        <p>© 2026 Math by Seng — Teacher Workspace Console</p>
      </footer>

      {/* Quiz Answers Review Modal */}
      {viewingQuizSub && (() => {
        const activeAssignment = assignments.find(a => a.id === viewingQuizSub.assignmentId)!;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl border max-h-[85vh] overflow-y-auto text-left"
              style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
              <div className="flex justify-between items-start border-b pb-4" style={{ borderColor: tx.borderS }}>
                <div>
                  <h3 className="text-lg font-bold">ผลการตรวจข้อสอบ: {viewingQuizSub.studentName}</h3>
                  <p className="text-xs" style={{ color: tx.muted }}>
                    แบบทดสอบ: {activeAssignment.title} · ได้คะแนน {viewingQuizSub.score} / {activeAssignment.questions?.length}
                  </p>
                </div>
                <button onClick={() => setViewingQuizSub(null)} className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {activeAssignment.questions!.map((q, idx) => {
                  const studentAns = viewingQuizSub.answers?.[idx];
                  const isCorrect = studentAns === q.correctIndex;
                  return (
                    <div key={idx} className="p-4 rounded-xl border space-y-2" style={{ borderColor: isCorrect ? "#10b981" : "#f43f5e" }}>
                      <h4 className="font-bold text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                        <span>ข้อที่ {idx + 1}: {q.question}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isCorrect ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50" : "bg-rose-100 text-rose-700 dark:bg-rose-950/50"
                        }`}>
                          {isCorrect ? "ตอบถูก" : "ตอบผิด"}
                        </span>
                      </h4>
                      <p className="text-xs">
                        นักเรียนตอบ: <span className={isCorrect ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                          {studentAns !== undefined ? q.options[studentAns] : "ไม่ได้ตอบ"}
                        </span>
                      </p>
                      <p className="text-xs" style={{ color: tx.muted }}>
                        คำตอบที่ถูกต้อง: <span className="text-emerald-500 font-bold">{q.options[q.correctIndex]}</span>
                      </p>
                      <div className="p-2.5 rounded-lg border text-xs" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                        <strong>คำอธิบาย:</strong> {q.explanation}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4 border-t" style={{ borderColor: tx.borderS }}>
                <button type="button" onClick={() => setViewingQuizSub(null)} className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md cursor-pointer">
                  ปิดหน้าต่างนี้
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lesson Edit Modal */}
      {editingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (!editLessonTitle.trim()) return;
              updateLesson({
                ...editingLesson,
                title: editLessonTitle,
                description: editLessonDescription,
                videoUrl: editLessonVideoUrl.trim() || undefined
              });
              setEditingLesson(null);
            }}
            className="w-full max-w-xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl border text-left animate-fadeIn"
            style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}
          >
            <div className="flex justify-between items-center border-b pb-4" style={{ borderColor: tx.borderS }}>
              <h3 className="text-lg font-bold">แก้ไขรายละเอียดหัวข้อเรียน</h3>
              <button 
                type="button" 
                onClick={() => setEditingLesson(null)} 
                className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>หัวข้อบทเรียน</label>
                <input 
                  type="text" 
                  value={editLessonTitle} 
                  onChange={(e) => setEditLessonTitle(e.target.value)} 
                  required 
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" 
                  style={{ borderColor: tx.border, color: tx.primary }} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>รายละเอียด / คำอธิบายบทเรียน</label>
                <textarea 
                  value={editLessonDescription} 
                  onChange={(e) => setEditLessonDescription(e.target.value)} 
                  rows={3} 
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" 
                  style={{ borderColor: tx.border, color: tx.primary }} 
                  placeholder="ระบุคำอธิบายย่อยสำหรับบทเรียนนี้..." 
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: tx.muted }}>
                  <Video className="h-3.5 w-3.5 text-red-500" />
                  ลิงก์วิดีโอ YouTube (ไม่บังคับ)
                </label>
                <input 
                  type="url" 
                  value={editLessonVideoUrl} 
                  onChange={(e) => setEditLessonVideoUrl(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 bg-transparent text-sm" 
                  style={{ borderColor: tx.border, color: tx.primary }} 
                  placeholder="https://www.youtube.com/watch?v=xxxxx" 
                />
                <p className="text-[10px]" style={{ color: tx.faint }}>วางลิงก์ YouTube เพื่อให้นักเรียนสามารถดูวิดีโอได้ในเว็บโดยไม่ต้องไปหน้า YouTube</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: tx.borderS }}>
              <button 
                type="button" 
                onClick={() => setEditingLesson(null)} 
                className="py-2 px-4 rounded-xl border font-bold text-xs cursor-pointer" 
                style={{ borderColor: tx.borderS, color: tx.secondary }}
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md cursor-pointer"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
