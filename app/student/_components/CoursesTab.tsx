import React from "react";
import { Search, SearchX, Video, Award, BookOpen } from "lucide-react";
import { tx } from "../../lib/theme";
import type { Course } from "../../context/UserContext";

type StudentTab = "dashboard" | "courses" | "study" | "profile";

interface CoursesTabProps {
  courses: Course[];
  filtered: Course[];
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  levelFilter: string;
  setLevelFilter: React.Dispatch<React.SetStateAction<string>>;
  setSelectedCourseId: React.Dispatch<React.SetStateAction<string | null>>;
  setTab: (tab: StudentTab) => void;
  handleEnroll: (courseId: string, requiresCode: boolean) => Promise<void>;
}

export function CoursesTab({
  courses, filtered, search, setSearch, levelFilter, setLevelFilter, setSelectedCourseId, setTab, handleEnroll,
}: CoursesTabProps) {
  return (
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
  );
}
