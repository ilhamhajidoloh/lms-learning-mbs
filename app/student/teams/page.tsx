"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Video, Calendar, Clock, Moon, Sun, ArrowLeft,
  ExternalLink, LogOut, ShieldAlert
} from "lucide-react";
import { useUser } from "../../context/UserContext";

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

const cardStyle = {
  backgroundColor: tx.surface,
  border: `1px solid ${tx.borderS}`,
};

export default function StudentTeamsPage() {
  const { role, isAuthenticated, logout, meetings, darkMode, toggleDarkMode } = useUser();
  const router = useRouter();

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

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass-panel shadow-sm" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button onClick={() => router.push("/student")} className="flex items-center gap-2 font-bold hover:text-indigo-500 transition-colors">
              <ArrowLeft className="h-5 w-5" /> กลับหน้าแดชบอร์ดนักเรียน
            </button>
            <div className="flex items-center gap-3">
              <button onClick={toggleDarkMode} className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors" style={{ color: tx.secondary }}>
                {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
              </button>
              <div className="h-8 w-px" style={{ backgroundColor: tx.borderS }} />
              <button onClick={logout} className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content layout */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            ห้องเรียนสด Microsoft Teams (ผู้เรียน)
          </h1>
          <p className="text-sm max-w-2xl mx-auto" style={{ color: tx.muted }}>
            หน้ารับลิงก์การเรียนการสอนสดแบบออนไลน์ เมื่อคุณครูสร้างคลาสเรียนสด ลิงก์ห้องประชุมจะมาอัปเดตตรงนี้ให้โดยอัตโนมัติ
          </p>
        </div>

        {/* Live meetings display for students */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-500 dark:text-purple-400" /> คลาสเรียนสดของคุณวันนี้
          </h2>

          {meetings.length === 0 ? (
            <div className="rounded-3xl p-12 text-center space-y-4 border border-dashed flex flex-col items-center justify-center" style={{ borderColor: tx.borderS }}>
              <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ backgroundColor: tx.elevated, color: tx.faint }}>
                <Video className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-base">ตอนนี้ยังไม่มีการสร้างคลาสสดโดยคุณครู</p>
                <p className="text-xs" style={{ color: tx.muted }}>หากถึงเวลาเรียนสดแล้วแต่ยังไม่เห็นลิงก์ ให้ติดต่อคุณครูผู้สอนเพื่อตรวจสอบสัญญาณ</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {meetings.map((m) => (
                <div key={m.id} className="rounded-3xl p-6 flex flex-col justify-between shadow-xl" style={cardStyle}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                        Online Class
                      </span>
                      <span className="text-xs flex items-center gap-1" style={{ color: tx.muted }}>
                        <Clock className="h-3 w-3" /> {m.startDateTime} น.
                      </span>
                    </div>

                    <div className="space-y-1 text-left">
                      <h4 className="font-bold text-base">{m.subject}</h4>
                      <p className="text-xs" style={{ color: tx.muted }}>สอนโดย ครูเซ็ง (Seng)</p>
                    </div>

                    <div className="rounded-xl p-3 border text-left flex justify-between items-center" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                      <span className="text-xs font-semibold" style={{ color: tx.secondary }}>Passcode สำหรับเข้าห้อง</span>
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-950/50">{m.passcode}</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <a href={m.joinUrl} target="_blank" rel="noopener noreferrer" className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-white font-extrabold hover:shadow-lg transition-all flex items-center justify-center gap-2">
                      กดเข้าร่วมคลาสเรียนสด <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Informative box */}
        <div className="rounded-3xl p-6 border flex gap-4 text-left items-start" style={{ borderColor: "rgba(168,85,247,0.15)", backgroundColor: "rgba(168,85,247,0.03)" }}>
          <ShieldAlert className="h-6 w-6 text-purple-500 dark:text-purple-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold">ข้อมูลความปลอดภัยและบทบาท (Student Policy)</h4>
            <p className="text-xs leading-relaxed" style={{ color: tx.secondary }}>
              เนื่องจากสิทธิ์ของคุณเป็น <strong>ผู้เรียน (Student)</strong> ระบบจะไม่มีความสามารถในการแก้ไข ลบ หรือสร้างห้องสนทนาใหม่ได้ คุณมีสิทธิ์เข้าศึกษาและทำงานตามตารางเวลาที่คุณครูเป็นผู้จัดการเท่านั้น
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
