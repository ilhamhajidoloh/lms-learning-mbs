import React from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, BarChart2, BookOpen, CalendarClock, Moon, Sun, LogOut, Menu, X,
} from "lucide-react";
import { tx } from "../../lib/theme";
import { Avatar } from "../../components/Avatar";

type AppRouter = ReturnType<typeof useRouter>;
type TeacherTab = "dashboard" | "courses" | "students" | "availability";

interface TeacherHeaderProps {
  tab: TeacherTab;
  setTab: (tab: TeacherTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  displayName: string;
  logout: () => void;
  router: AppRouter;
}

export function TeacherHeader({ tab, setTab, mobileOpen, setMobileOpen, darkMode, toggleDarkMode, displayName, logout, router }: TeacherHeaderProps) {
  return (
    <header className="sticky top-0 z-50 glass-panel shadow-sm animate-slideInDown" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
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
                Teacher Workspace
              </span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <button onClick={() => { if (tab !== "dashboard") router.push("/teacher"); setTab("dashboard"); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${tab === "dashboard" ? "nav-active" : "hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
              style={tab === "dashboard" ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 } : { color: tx.secondary }}>
              <BarChart2 className="h-4 w-4" />
              แดชบอร์ดหลัก
            </button>
            <button onClick={() => { if (tab !== "courses") router.push("/teacher"); setTab("courses"); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${tab === "courses" ? "nav-active" : "hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
              style={tab === "courses" ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 } : { color: tx.secondary }}>
              <BookOpen className="h-4 w-4" />
              คอร์สที่ฉันสอน
            </button>
            <button onClick={() => { router.push("/teacher?tab=availability"); setTab("availability"); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${tab === "availability" ? "nav-active" : "hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
              style={tab === "availability" ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 } : { color: tx.secondary }}>
              <CalendarClock className="h-4 w-4" />
              เวลาสอนส่วนตัว
            </button>
            <button onClick={() => router.push("/teacher/live-classes")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-all duration-200 active:scale-95">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              ห้องเรียนสด (Live)
            </button>
          </nav>

          {/* Settings & Profile */}
          <div className="flex items-center gap-3">
            <button onClick={toggleDarkMode} aria-label={darkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"} aria-pressed={darkMode} title={darkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"} className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-all duration-200 active:scale-90" style={{ color: tx.secondary }}>
              {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
            </button>

            <div className="h-8 w-px" style={{ backgroundColor: tx.borderS }} />

            <div className="flex items-center gap-3 pl-1">
              <button onClick={() => router.push("/profile")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity active:scale-95 group" title="ดูโปรไฟล์">
                <Avatar name={displayName} size="sm" />
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold leading-tight">{displayName}</p>
                  <p className="text-[10px]" style={{ color: tx.muted }}>ผู้จัดการระบบผู้สอน</p>
                </div>
              </button>
              <button onClick={logout} className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all duration-200 active:scale-90" title="ออกจากระบบ">
                <LogOut className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile menu button */}
            <button onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-all duration-200 active:scale-90"
              style={{ color: tx.secondary }}>
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu drawer */}
      <div className={`md:hidden glass-panel border-b overflow-hidden transition-all duration-300 ease-in-out ${mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0 border-b-0"}`} style={{ borderColor: tx.borderS }}>
        <div className="px-2 pt-2 pb-3 space-y-1">
          <button onClick={() => { if (tab !== "dashboard") router.push("/teacher"); setTab("dashboard"); setMobileOpen(false); }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 active:scale-95"
            style={tab === "dashboard" ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 } : { color: tx.secondary }}
          >
            <BarChart2 className="h-5 w-5" />
            แดชบอร์ดหลัก
          </button>
          <button onClick={() => { if (tab !== "courses") router.push("/teacher"); setTab("courses"); setMobileOpen(false); }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 active:scale-95"
            style={tab === "courses" ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 } : { color: tx.secondary }}
          >
            <BookOpen className="h-5 w-5" />
            คอร์สที่ฉันสอน
          </button>
          <button onClick={() => { router.push("/teacher?tab=availability"); setTab("availability"); setMobileOpen(false); }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 active:scale-95"
            style={tab === "availability" ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 } : { color: tx.secondary }}
          >
            <CalendarClock className="h-5 w-5" />
            เวลาสอนส่วนตัว
          </button>
          <button onClick={() => { router.push("/teacher/live-classes"); setMobileOpen(false); }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium text-red-500 hover:bg-red-500/10 transition-all duration-200 active:scale-95"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            ห้องเรียนสด (Live)
          </button>
        </div>
      </div>
    </header>
  );
}
