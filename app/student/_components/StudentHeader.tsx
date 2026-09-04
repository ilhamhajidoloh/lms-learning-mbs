import React, { useEffect, useState } from "react";
import type { useRouter } from "next/navigation";
import {
  Sparkles, Moon, Sun, Menu, X, LogOut, Video, BarChart2, BookOpen, Trophy,
} from "lucide-react";
import { tx } from "../../lib/theme";
import { Avatar } from "../../components/Avatar";
import { JoinLiveClassButton } from "../../components/JoinLiveClassButton";
import { type LiveClassData } from "../../components/LiveClassCard";
import { apiFetch } from "@/lib/api";

type StudentTab = "dashboard" | "courses" | "study" | "profile";

const NAV = [
  { id: "dashboard", label: "หน้าแรก",            Icon: BarChart2 },
  { id: "courses",   label: "คอร์สเรียนทั้งหมด", Icon: BookOpen  },
  { id: "study",     label: "ห้องเรียนจำลอง",    Icon: Video     },
  { id: "profile",   label: "แดชบอร์ดนักเรียน",  Icon: Trophy    },
] as const;

interface StudentHeaderProps {
  displayName: string;
  darkMode: boolean;
  toggleDarkMode: () => void;
  logout: () => void;
  tab: StudentTab;
  setTab: (tab: StudentTab) => void;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  router: ReturnType<typeof useRouter>;
}

export function StudentHeader({
  displayName, darkMode, toggleDarkMode, logout, tab, setTab, mobileOpen, setMobileOpen, router,
}: StudentHeaderProps) {
  const [activeLiveClass, setActiveLiveClass] = useState<LiveClassData | null>(null);

  useEffect(() => {
    const checkLive = async () => {
      try {
        const { data } = await apiFetch<{ activeLiveClasses?: LiveClassData[]; activeLiveClass?: LiveClassData }>("/api/live-classes/active");
        const active = data?.activeLiveClasses?.[0] || data?.activeLiveClass || null;
        setActiveLiveClass(active);
      } catch (e) {
        console.warn("Failed to check active live class in header:", e);
      }
    };
    checkLive();
    // Periodically check every 20 seconds
    const interval = setInterval(checkLive, 20000);
    return () => clearInterval(interval);
  }, []);

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
                Student Portal
              </span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${active ? "nav-active" : "hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  style={active
                    ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 }
                    : { color: tx.secondary }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}

            {/* Active Live Class shortcut in header */}
            {activeLiveClass && (
              <JoinLiveClassButton
                liveClassId={activeLiveClass.id}
                roomName={activeLiveClass.room_name}
                displayName={displayName}
                isActive={true}
                size="sm"
                className="ml-2"
              >
                เข้าเรียนสด 🔴
              </JoinLiveClassButton>
            )}
          </nav>

          {/* Right Buttons */}
          <div className="flex items-center gap-3">
            <button onClick={toggleDarkMode} aria-label={darkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"} aria-pressed={darkMode} title={darkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
              className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-all duration-200 active:scale-90"
              style={{ color: tx.secondary }}>
              {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
            </button>

            <div className="h-8 w-px" style={{ backgroundColor: tx.borderS }} />

            <div className="flex items-center gap-3 pl-1">
              <button onClick={() => router.push("/profile")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity active:scale-95 group" title="ดูโปรไฟล์">
                <Avatar name={displayName} size="sm" />
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold leading-tight">{displayName}</p>
                  <p className="text-[10px]" style={{ color: tx.muted }}>ผู้เรียน</p>
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

      {/* Mobile menu */}
      <div className={`md:hidden glass-panel border-b overflow-hidden transition-all duration-300 ease-in-out ${mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0 border-b-0"}`} style={{ borderColor: tx.borderS }}>
        <div className="px-2 pt-2 pb-3 space-y-1">
          {NAV.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button key={id}
                onClick={() => { setTab(id); setMobileOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 active:scale-95"
                style={active
                  ? { backgroundColor: tx.accentBg, color: tx.accent, fontWeight: 600 }
                  : { color: tx.secondary }}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}

          {activeLiveClass && (
            <div className="pt-1" onClick={() => setMobileOpen(false)}>
              <JoinLiveClassButton
                liveClassId={activeLiveClass.id}
                roomName={activeLiveClass.room_name}
                displayName={displayName}
                isActive={true}
                size="md"
                className="w-full"
              >
                เข้าห้องเรียนสดตอนนี้ 🔴
              </JoinLiveClassButton>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
