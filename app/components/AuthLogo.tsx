import React from "react";
import { Sparkles } from "lucide-react";

export default function AuthLogo() {
  return (
    <div className="flex items-center gap-3 mb-8 animate-fadeIn">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-xl animate-float">
        <Sparkles className="h-7 w-7" />
      </div>
      <div>
        <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 bg-clip-text text-transparent text-3xl font-bold tracking-tight block">
          Math by Seng
        </span>
        <span className="block text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: "var(--text-muted)" }}>
          Premium Learning Management System
        </span>
      </div>
    </div>
  );
}
