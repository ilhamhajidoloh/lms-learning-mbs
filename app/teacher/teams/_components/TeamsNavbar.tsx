import { Moon, Sun, ArrowLeft, LogOut } from "lucide-react";
import { tx } from "../../../lib/theme";

interface TeamsNavbarProps {
  onBack: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  logout: () => void;
}

export default function TeamsNavbar({ onBack, darkMode, toggleDarkMode, logout }: TeamsNavbarProps) {
  return (
    <header className="sticky top-0 z-50 glass-panel shadow-sm" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <button onClick={onBack} className="flex items-center gap-2 font-bold hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            <ArrowLeft className="h-5 w-5" /> กลับหน้าแดชบอร์ดครู
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
  );
}
