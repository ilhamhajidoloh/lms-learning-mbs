import { Moon, Sun, LogOut, Sparkles } from "lucide-react";
import { tx } from "../../lib/theme";

interface AdminHeaderProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  displayName: string;
  onProfileClick: () => void;
  logout: () => void;
}

export function AdminHeader({ darkMode, toggleDarkMode, displayName, onProfileClick, logout }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-50 glass-panel shadow-sm" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-orange-400 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400 bg-clip-text text-transparent text-xl font-bold tracking-tight">
                Math by Seng
              </span>
              <span className="block text-[10px] font-bold tracking-widest uppercase -mt-1" style={{ color: tx.muted }}>
                Admin Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={toggleDarkMode} className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors" style={{ color: tx.secondary }}>
              {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-rose-500" />}
            </button>
            <div className="h-8 w-px" style={{ backgroundColor: tx.borderS }} />
            <div className="flex items-center gap-3 pl-1">
              <button onClick={onProfileClick} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity" title="ดูโปรไฟล์">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-rose-500 to-orange-400 flex items-center justify-center text-white font-bold shadow-md">
                  A
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold leading-tight">{displayName}</p>
                  <p className="text-[10px]" style={{ color: tx.muted }}>System Administrator</p>
                </div>
              </button>
              <button onClick={logout} className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors" title="ออกจากระบบ">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
