"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Shield, User, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { useUser } from "../context/UserContext";

export default function LoginPage() {
  const { login, credentials } = useUser();
  const router = useRouter();

  const [username,     setUsername]     = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const clearError = () => setError(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("กรุณากรอก Username และ Password ให้ครบถ้วน");
      return;
    }

    setLoading(true);
    await new Promise(r => setTimeout(r, 700));

    const user = credentials.find(
      c => c.username === username.trim() && c.password === password
    );

    if (!user) {
      setLoading(false);
      setError("Username หรือ Password ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      return;
    }

    login(user.role, user.displayName, user.username);
    const dest = user.role === "admin" ? "/admin" : user.role === "teacher" ? "/teacher" : "/student";
    router.push(dest);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl" style={{ animation: "pulse 4s ease-in-out infinite" }} />
        <div className="absolute bottom-0 left-1/3 w-[600px] h-[600px] bg-pink-500/8 rounded-full blur-3xl" style={{ animation: "pulse 5s ease-in-out infinite 1s" }} />
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

        {/* Login Card */}
        <div
          className="w-full max-w-md rounded-3xl p-8 sm:p-10 shadow-2xl animate-fadeIn"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            animationDelay: "0.1s",
          }}
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              เข้าสู่ระบบ
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              กรอกข้อมูลเพื่อเข้าใช้งานระบบ Math by Seng LMS
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">

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
                  placeholder="กรอก Username ของคุณ"
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError(); }}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: "var(--border-base)", color: "var(--text-primary)" }}
                  placeholder="กรอก Password ของคุณ"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-faint)" }}
                  tabIndex={-1}
                  aria-label={showPassword ? "ซ่อน Password" : "แสดง Password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-60 mt-2"
            >
              {loading ? (
                <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>เข้าสู่ระบบ <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          {/* Signup link */}
          <div className="mt-5 text-center text-sm">
            <span style={{ color: "var(--text-muted)" }}>ยังไม่มีบัญชี? </span>
            <a href="/signup" className="font-bold text-indigo-500 dark:text-indigo-400 hover:underline">
              สมัครสมาชิก
            </a>
          </div>

          {/* Security note */}
          <div className="mt-4 flex items-center gap-2 justify-center" style={{ color: "var(--text-faint)" }}>
            <Shield className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px]">ระบบจำลอง — ในระบบจริงจะใช้ Microsoft Entra ID</span>
          </div>
        </div>

        {/* Demo credentials hint */}
        <div
          className="w-full max-w-md mt-4 rounded-2xl px-5 py-4 animate-fadeIn"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            animationDelay: "0.2s",
          }}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            บัญชีทดสอบระบบ (Demo Accounts)
          </p>
          <div className="space-y-2 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
            <div className="flex items-center justify-between gap-4">
              <span className="font-bold text-rose-500 dark:text-rose-400 shrink-0">🛡️ แอดมิน</span>
              <span className="truncate">admin / admin@2026</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-bold text-indigo-500 dark:text-indigo-400 shrink-0">👨‍🏫 ครูผู้สอน</span>
              <span className="truncate">kruseng / math@2026</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-bold text-purple-500 dark:text-purple-400 shrink-0">👨‍🎓 นักเรียน</span>
              <span className="truncate">phumin / math@2026</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs animate-fadeIn" style={{ color: "var(--text-faint)", animationDelay: "0.3s" }}>
          <p>© 2026 Math by Seng — Premium LMS Platform</p>
        </div>
      </div>
    </div>
  );
}
