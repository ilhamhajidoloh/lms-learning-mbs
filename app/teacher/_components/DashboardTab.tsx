import React from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Plus, Users, TrendingUp, Video, BookOpen, Clipboard,
  ArrowUpRight, Inbox, BookDashed, Award, Calendar,
} from "lucide-react";
import { tx, card } from "../../lib/theme";
import type { Course, Meeting } from "../../context/UserContext";

interface StudentActivity {
  id: string;
  name: string;
  action: string;
  course: string;
  time: string;
  score?: string;
}

const RECENT_STUDENT_ACTIVITIES: StudentActivity[] = [];

type AppRouter = ReturnType<typeof useRouter>;

interface DashboardTabProps {
  displayName: string;
  router: AppRouter;
  teacherCourses: Course[];
  meetings: Meeting[];
  setShowCourseForm: (show: boolean) => void;
  setTab: (tab: "dashboard" | "courses" | "students") => void;
}

export function DashboardTab({ displayName, router, teacherCourses, meetings, setShowCourseForm, setTab }: DashboardTabProps) {
  return (
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
            <p className="text-3xl font-extrabold">0 คน</p>
            <p className="text-xs text-emerald-500 flex items-center gap-1 font-bold">
              <TrendingUp className="h-3 w-3" /> +0% เดือนนี้
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl p-6 flex items-center justify-between shadow-sm transition-all" style={card.style}>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ชั่วโมงสอนสะสม</p>
            <p className="text-3xl font-extrabold">0 ชม.</p>
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
            <p className="text-3xl font-extrabold">0 คอร์ส</p>
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
            <p className="text-3xl font-extrabold">0%</p>
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
            <div className="flex items-center gap-3">
              <button onClick={() => setShowCourseForm(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow transition-transform hover:-translate-y-0.5 cursor-pointer">
                <Plus className="h-4 w-4" /> สร้างคอร์สใหม่
              </button>
              <button onClick={() => setTab("courses")} className="text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1">
                ดูคอร์สทั้งหมด <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>


          {teacherCourses.length === 0 ? (
            <div className="rounded-3xl p-10 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden border border-dashed" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
              <div className="h-20 w-20 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-5 shadow-inner">
                <Inbox className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-extrabold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">ยังไม่มีคอร์สเรียนที่เปิดสอน</h3>
              <p className="max-w-md text-sm mb-6" style={{ color: tx.secondary }}>
                คุณยังไม่ได้สร้างคอร์สเรียนใดๆ เริ่มต้นสร้างคอร์สแรกเพื่อเชิญนักเรียนเข้ามาเรียนด้วยกันเลยครับ
              </p>
              <button onClick={() => setShowCourseForm(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2 cursor-pointer">
                <Plus className="h-5 w-5" /> สร้างคอร์สใหม่
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {teacherCourses.map((course) => (
                <div key={course.id} className="rounded-3xl p-6 relative overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 group flex flex-col justify-between border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
                  <div className={`h-2.5 w-full bg-gradient-to-r ${course.gradientClass} absolute top-0 left-0`} />
                  <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  <div className="space-y-5 pt-2 relative z-10">
                    <h3 className="font-extrabold text-lg leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {course.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs font-semibold" style={{ color: tx.secondary }}>
                      <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300"><BookDashed className="h-4 w-4" /> {course.lessonsCount} บทเรียน</span>
                      <span className="flex items-center gap-1.5 text-amber-500"><Award className="h-4 w-4" /> จัดการโดยแอดมิน</span>
                    </div>
                    <div className="pt-4 flex justify-between items-center border-t border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-medium" style={{ color: tx.muted }}>ไม่มีไลฟ์ตอนนี้</span>
                      <button onClick={() => router.push("/teacher/teams")} className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white dark:hover:text-white transition-all shadow-sm group-hover:scale-105" title="สร้างห้องประชุม Teams">
                        <Video className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
  );
}
