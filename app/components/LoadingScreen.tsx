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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/5 rounded-full blur-3xl" style={{ animation: "pulse 6s ease-in-out infinite 1s" }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center px-4">
        {/* Loading Spinner with Logo */}
        <div className="relative flex items-center justify-center h-24 w-24">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 rounded-3xl border-4 border-t-transparent border-r-transparent border-indigo-500 animate-spin" />
          {/* Inner rotating ring (opposite direction) */}
          <div className="absolute inset-1 rounded-2xl border-2 border-b-transparent border-l-transparent border-purple-400 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          {/* Pulsing inner background */}
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-xl animate-float">
            <Sparkles className="h-8 w-8" />
          </div>
        </div>

        {/* Text descriptions */}
        <div className="space-y-2 animate-fadeIn">
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 bg-clip-text text-transparent">
            Math by Seng LMS
          </h2>
          <div className="flex items-center justify-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-xs font-semibold tracking-[0.1em] uppercase" style={{ color: "var(--text-muted)" }}>
            กำลังโหลดข้อมูลระบบ กรุณารอสักครู่...
          </p>
        </div>
      </div>
    </div>
  );
}
