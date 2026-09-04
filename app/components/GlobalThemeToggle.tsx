"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useUser } from "../context/UserContext";

// These areas already place the same control in their application header.
// All remaining routes receive this compact floating control from RootLayout.
const hasHeaderThemeToggle = (pathname: string) =>
  pathname === "/student" ||
  pathname.startsWith("/teacher") ||
  pathname === "/admin" ||
  pathname === "/profile";

export function GlobalThemeToggle() {
  const pathname = usePathname();
  const { darkMode, toggleDarkMode } = useUser();

  if (hasHeaderThemeToggle(pathname)) return null;

  const isLiveRoom = pathname.startsWith("/live/");

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      aria-label={darkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
      aria-pressed={darkMode}
      title={darkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
      className={`fixed right-4 z-[70] inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-lg backdrop-blur transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
        isLiveRoom ? "bottom-4 bg-slate-900/90 border-slate-700 text-slate-100 hover:bg-slate-800" : "top-4 glass-panel"
      }`}
      style={isLiveRoom ? undefined : { color: "var(--text-secondary)" }}
    >
      {darkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
      <span className="sr-only">{darkMode ? "โหมดสว่าง" : "โหมดมืด"}</span>
    </button>
  );
}
