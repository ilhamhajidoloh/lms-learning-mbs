"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, User, Lock, Eye, EyeOff, ArrowRight,
  AlertCircle
} from "lucide-react";
import { useUser } from "../context/UserContext";

export default function SignupPage() {
  const { register, login } = useUser();
  const router = useRouter();

  const [username,    setUsername]    = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password,    setPassword]    = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [showCPw,     setShowCPw]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const clearError = () => setError(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !displayName.trim() || !password || !confirmPw) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง"); return;
    }
    if (username.trim().length < 3) {
      setError("Username ต้องมีอย่างน้อย 3 ตัวอักษร"); return;
    }
    if (/\s/.test(username.trim())) {
      setError("Username ต้องไม่มีช่องว่าง"); return;
    }
    if (password.length < 6) {
      setError("Password ต้องมีอย่างน้อย 6 ตัวอักษร"); return;
    }
    if (password !== confirmPw) {
      setError("Password ทั้งสองช่องไม่ตรงกัน"); return;
    }

    setLoading(true);
    await new Promise(r => setTimeout(r, 600));

    const result = register({
      username:    username.trim(),
      password,
      role: "student",
      displayName: displayName.trim(),
    });

    if (!result.success) {
      setLoading(false);
      setError(result.error ?? "เกิดข้อผิดพลาด");
      return;
    }

    // auto-login as student - admin จะเปลี่ยน role ได้
    login("student", displayName.trim(), username.trim());
    router.push("/student");
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl" style={{ animation: "pulse 4s ease-in-out infinite" }} />
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-pink-500/8 rounded-full blur-3xl" style={{ animation: "pulse 5s ease-in-out infinite 1s" }} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">

        {/* Logo */}
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

        {/* Signup Card */}
        <div
          className="w-full max-w-md rounded-3xl p-8 sm:p-10 shadow-2xl animate-fadeIn"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            animationDelay: "0.1s",
          }}
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">สมัครสมาชิก</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              สร้างบัญชีใหม่เพื่อเข้าใช้งานระบบ Math by Seng LMS
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--text-faint)" }} />
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); clearError(); }}
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: "var(--border-base)", color: "var(--text-primary)" }}
                  placeholder="อย่างน้อย 3 ตัวอักษร ไม่มีช่องว่าง"
                />
              </div>
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                ชื่อแสดงผล
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--text-faint)" }} />
                <input
                  type="text"
                  value={displayName}
                  onChange={e => { setDisplayName(e.target.value); clearError(); }}
                  autoComplete="name"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: "var(--border-base)", color: "var(--text-primary)" }}
                  placeholder="เช่น สมศรี ใจดี หรือ ครูมานี"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--text-faint)" }} />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError(); }}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-12 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: "var(--border-base)", color: "var(--text-primary)" }}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
                <button type="button" onClick={() => setShowPw(p => !p)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-faint)" }}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                ยืนยัน Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--text-faint)" }} />
                <input
                  type={showCPw ? "text" : "password"}
                  value={confirmPw}
                  onChange={e => { setConfirmPw(e.target.value); clearError(); }}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-12 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: "var(--border-base)", color: "var(--text-primary)" }}
                  placeholder="กรอก Password อีกครั้ง"
                />
                <button type="button" onClick={() => setShowCPw(p => !p)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-faint)" }}>
                  {showCPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Info: Role assignment by admin */}
            <div className="p-3.5 rounded-2xl border" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-elevated)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                ✓ บัญชีของคุณจะเป็น <strong>นักเรียน</strong> ก่อน
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                แอดมินจะตรวจสอบและเปลี่ยนบทบาทเป็นครูผู้สอนได้ตามความเหมาะสม
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-60 mt-1"
            >
              {loading ? (
                <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>สมัครสมาชิก <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          {/* Login link */}
          <div className="mt-6 text-center text-sm">
            <span style={{ color: "var(--text-muted)" }}>มีบัญชีอยู่แล้ว? </span>
            <a href="/login" className="font-bold text-indigo-500 dark:text-indigo-400 hover:underline">
              เข้าสู่ระบบ
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs animate-fadeIn" style={{ color: "var(--text-faint)", animationDelay: "0.2s" }}>
          <p>© 2026 Math by Seng — Premium LMS Platform</p>
        </div>
      </div>
    </div>
  );
}
