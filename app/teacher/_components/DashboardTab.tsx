import React from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Plus, Users, TrendingUp, Video, BookOpen, Clipboard,
  ArrowUpRight, BookDashed, Award, Calendar,
} from "lucide-react";
import { tx, card } from "../../lib/theme";
import type { Course, Meeting } from "../../context/UserContext";
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
      <HeroBanner
        gradient="from-indigo-900 via-indigo-950 to-slate-950"
        badge="Teacher Dashboard"
        title={`สวัสดีครับ, ${displayName}`}
        subtitle="ยินดีต้อนรับกลับสู่ระบบจัดการคอร์สและการเรียนการสอนของ Math by Seng วันนี้มีห้องเรียนและข้อมูลกิจกรรมใหม่ให้ตรวจสอบ"
        action={
          <button onClick={() => router.push("/teacher/teams")}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-5 py-3 rounded-2xl shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95">
            <Plus className="h-5 w-5" />
            สร้างห้องเรียน Teams
          </button>
        }
        className="animate-slideInUp"
      />

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<Users className="h-6 w-6" />} label="นักเรียนทั้งหมด" value="0 คน" accent="indigo" className="animate-slideInUp stagger-1" />
        <StatCard icon={<Video className="h-6 w-6" />} label="ชั่วโมงสอนสะสม" value="0 ชม." accent="purple" className="animate-slideInUp stagger-2" />
        <StatCard icon={<BookOpen className="h-6 w-6" />} label="คอร์สที่เปิดสอน" value="0 คอร์ส" accent="blue" className="animate-slideInUp stagger-3" />
        <StatCard icon={<Clipboard className="h-6 w-6" />} label="การส่งการบ้านสะสม" value="0%" accent="pink" className="animate-slideInUp stagger-4" />
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
                      <button onClick={() => router.push("/teacher/teams")}
                        className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white dark:hover:text-white transition-all duration-200 shadow-sm group-hover:scale-110 active:scale-95" title="สร้างห้องประชุม Teams">
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

      {/* Created Meetings List */}
      {meetings.length > 0 && (
        <div className="space-y-4 pt-4 animate-slideInUp">
          <h2 className="text-xl font-bold tracking-tight">Microsoft Teams Meeting ที่คุณเพิ่งสร้างขึ้น</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {meetings.map((m, i) => (
              <div key={m.id} className={`rounded-2xl p-5 flex flex-col justify-between shadow-md card-hover-sm animate-slideInUp stagger-${Math.min(i + 1, 6)}`} style={card.style}>
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
                  <a href={m.joinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:underline transition-colors">
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
