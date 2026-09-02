"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, GraduationCap, Layers, LogIn, Sparkles, UserRound } from "lucide-react";

interface PublicCourse {
  id: string;
  title: string;
  level: string;
  levelLabel: string;
  gradientClass: string;
  instructor: string;
}

interface PublicLevel {
  id: string;
  value: string;
  label: string;
}

export function PublicHome() {
  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [levels, setLevels] = useState<PublicLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState("all");

  const filteredCourses = selectedLevel === "all"
    ? courses
    : courses.filter((course) => course.level === selectedLevel);
  const selectedLevelLabel = levels.find((level) => level.value === selectedLevel)?.label;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/catalog")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load catalog");
        return response.json() as Promise<{ courses: PublicCourse[]; levels: PublicLevel[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setCourses(data.courses);
        setLevels(data.levels);
      })
      .catch(() => {
        if (cancelled) return;
        setCourses([]);
        setLevels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-white">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-fuchsia-500 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-6">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center"><Sparkles className="h-5 w-5" /></div>
              <div>
                <p className="font-black tracking-tight">Math by Seng</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-indigo-200">Learning Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/signup" className="hidden sm:inline-flex px-4 py-2 text-xs font-bold rounded-xl hover:bg-white/10 transition-colors">สมัครสมาชิก</Link>
              <Link href="/login" className="inline-flex items-center gap-2 bg-white text-indigo-950 hover:bg-indigo-100 px-4 py-2 rounded-xl text-xs font-black transition-colors"><LogIn className="h-4 w-4" /> เข้าสู่ระบบ</Link>
            </div>
          </header>

          <div className="py-16 sm:py-24 max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/15 text-indigo-100"><GraduationCap className="h-4 w-4" /> เรียนรู้ได้หลากหลายรายวิชา</span>
            <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight">พื้นที่เรียนออนไลน์<br />สำหรับทุกความสนใจ</h1>
            <p className="mt-5 max-w-2xl text-base sm:text-lg text-indigo-100 leading-relaxed">เลือกดูรายวิชาและระดับชั้นที่เปิดสอน แล้วเข้าสู่ระบบเพื่อเริ่มต้นการเรียนรู้ ติดตามบทเรียน ส่งงาน และทำแบบทดสอบได้ในที่เดียว</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-500 hover:bg-indigo-400 rounded-2xl font-black text-sm shadow-lg shadow-indigo-950/30 transition-all hover:-translate-y-0.5">เริ่มต้นใช้งาน <ArrowRight className="h-4 w-4" /></Link>
              <a href="#courses" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/20 hover:bg-white/10 font-bold text-sm transition-colors">ดูรายวิชาทั้งหมด</a>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 sm:px-8 -mt-8 relative z-10"><div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<BookOpen className="h-5 w-5 text-indigo-500" />} value={loading ? "—" : String(courses.length)} label="รายวิชาที่เปิดสอน" />
        <StatCard icon={<Layers className="h-5 w-5 text-purple-500" />} value={loading ? "—" : String(levels.length)} label="ระดับชั้น" />
        <StatCard icon={<UserRound className="h-5 w-5 text-emerald-500" />} value="พร้อมเรียน" label="สมัครและเข้าสู่ระบบได้ทันที" />
      </div></section>

      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-14 pb-8">
        <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Levels</p>
        <h2 className="mt-1 text-2xl sm:text-3xl font-black">ระดับชั้นที่มีในระบบ</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          {loading ? <span className="text-sm text-slate-500">กำลังโหลดระดับชั้น…</span> : levels.length > 0 ? <>
            <button type="button" onClick={() => setSelectedLevel("all")} className={`px-4 py-2 rounded-xl border text-sm font-bold transition-all ${selectedLevel === "all" ? "bg-indigo-600 border-indigo-600 text-white shadow" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"}`}>ทั้งหมด</button>
            {levels.map((level) => (
              <button key={level.id} type="button" onClick={() => setSelectedLevel(level.value)} className={`px-4 py-2 rounded-xl border text-sm font-bold transition-all ${selectedLevel === level.value ? "bg-indigo-600 border-indigo-600 text-white shadow" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"}`}>{level.label}</button>
            ))}
          </> : <span className="text-sm text-slate-500">ยังไม่มีระดับชั้นที่ประกาศ</span>}
        </div>
      </section>

      <section id="courses" className="max-w-7xl mx-auto px-5 sm:px-8 py-10 pb-20 scroll-mt-8">
        <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Courses</p>
        <h2 className="mt-1 text-2xl sm:text-3xl font-black">{selectedLevelLabel ? `รายวิชาระดับ ${selectedLevelLabel}` : "รายวิชาที่เปิดสอน"}</h2>
        <p className="mt-2 text-sm text-slate-500">เข้าสู่ระบบหรือลงทะเบียนเพื่อดูเนื้อหาในรายวิชา</p>
        {loading ? <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{[0, 1, 2].map((item) => <div key={item} className="h-44 rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>
          : filteredCourses.length > 0 ? <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{filteredCourses.map((course) => (
            <article key={course.id} className="rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-shadow">
              <div className={`h-24 bg-gradient-to-r ${course.gradientClass || "from-indigo-600 to-purple-600"} p-5 text-white flex items-start justify-between`}><span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-[10px] font-black">{course.levelLabel}</span><BookOpen className="h-5 w-5" /></div>
              <div className="p-5"><h3 className="font-black text-lg line-clamp-2">{course.title}</h3><p className="mt-2 text-xs text-slate-500">ผู้สอน: {course.instructor}</p><Link href="/login" className="mt-5 inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline">เข้าสู่ระบบเพื่อเรียน <ArrowRight className="h-3.5 w-3.5" /></Link></div>
            </article>
          ))}</div> : <div className="mt-6 rounded-3xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">ยังไม่มีรายวิชาในระดับชั้นที่เลือก</div>}
      </section>
    </main>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-900/5">{icon}<p className="mt-3 text-2xl font-black">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p></div>;
}
