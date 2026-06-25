"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export default function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Animated background glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl" style={{ animation: "pulse 4s ease-in-out infinite" }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center px-4">
        {/* Loading Spinner with Logo */}
        <div className="relative flex items-center justify-center h-20 w-20">
          {/* Rotating gradient outer border */}
          <div className="absolute inset-0 rounded-3xl border-4 border-t-transparent border-r-transparent border-indigo-500 animate-spin" />
          {/* Pulsing inner background */}
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-xl animate-float">
            <Sparkles className="h-7 w-7" />
          </div>
        </div>

        {/* Text descriptions */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 bg-clip-text text-transparent">
            Math by Seng LMS
          </h2>
          <p className="text-xs font-semibold tracking-[0.1em] uppercase animate-pulse" style={{ color: "var(--text-muted)" }}>
            กำลังโหลดข้อมูลระบบ กรุณารอสักครู่...
          </p>
        </div>
      </div>
    </div>
  );
}
