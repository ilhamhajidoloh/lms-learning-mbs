import React from "react";
import {
  Sparkles, Play, Book, Clock, CheckCircle, Trophy, ArrowUpRight, ChevronRight, Search, Video, Award,
} from "lucide-react";
import { tx, card } from "../../lib/theme";
import type { Course, Meeting } from "../../context/UserContext";

type StudentTab = "dashboard" | "courses" | "study" | "profile";

interface DashboardTabProps {
  displayName: string;
  enrolledCourses: Course[];
  meetings: Meeting[];
  setTab: (tab: StudentTab) => void;
  setSelectedCourseId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function DashboardTab({ displayName, enrolledCourses, meetings, setTab, setSelectedCourseId }: DashboardTabProps) {
  return (
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
  );
}
