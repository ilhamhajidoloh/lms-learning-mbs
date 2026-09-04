import React from "react";
import { ArrowLeft, Moon, Sun, LogOut } from "lucide-react";
import { tx } from "../../lib/theme";

interface ProfileHeaderProps {
  onBack: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onLogout: () => void;
}

export default function ProfileHeader({ onBack, darkMode, toggleDarkMode, onLogout }: ProfileHeaderProps) {
  return (
    <header className="sticky top-0 z-50 glass-panel shadow-sm" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <button onClick={onBack}
            className="flex items-center gap-2 font-bold hover:text-indigo-500 dark:hover:text-indigo-400 transition-all duration-200 active:scale-95">
            <ArrowLeft className="h-5 w-5" /> กลับหน้าหลัก
          </button>
          <span className="font-bold text-sm" style={{ color: tx.muted }}>โปรไฟล์ของฉัน</span>
          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} aria-label={darkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"} aria-pressed={darkMode} title={darkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
              className="btn-icon p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40"
              style={{ color: tx.secondary }}>
              {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
            <button onClick={onLogout}
              className="btn-icon p-2 rounded-xl text-rose-500 hover:bg-rose-500/10" title="ออกจากระบบ">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
