import React from "react";
import { Shield, User, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";

interface LoginFormProps {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  handleLogin: (e: React.FormEvent) => void;
}

export default function LoginForm({
  username, setUsername, password, setPassword,
  showPassword, setShowPassword, loading, error, clearError, handleLogin,
}: LoginFormProps) {
  return (
    <div
      className="w-full max-w-md rounded-3xl p-8 sm:p-10 shadow-2xl animate-scaleIn"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="text-center mb-8 animate-slideInUp">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
          เข้าสู่ระบบ
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          กรอกข้อมูลเพื่อเข้าใช้งานระบบ Math by Seng LMS
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">

        {/* Username / Email */}
        <div className="space-y-1.5 animate-slideInUp stagger-1">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Username หรือ Email
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200" style={{ color: "var(--text-faint)" }} />
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); clearError(); }}
              autoComplete="username"
              className="w-full pl-10 pr-4 py-3 rounded-xl border bg-transparent text-sm input-glow focus:ring-0"
              style={{ borderColor: "var(--border-base)", color: "var(--text-primary)" }}
              placeholder="กรอก Username หรือ Email ของคุณ"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5 animate-slideInUp stagger-2">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200" style={{ color: "var(--text-faint)" }} />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => { setPassword(e.target.value); clearError(); }}
              autoComplete="current-password"
              className="w-full pl-10 pr-12 py-3 rounded-xl border bg-transparent text-sm input-glow focus:ring-0"
              style={{ borderColor: "var(--border-base)", color: "var(--text-primary)" }}
              placeholder="กรอก Password ของคุณ"
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-all duration-200 hover:opacity-70 active:scale-90"
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
          <div className="flex items-start gap-2 p-3 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 animate-shake">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all duration-200 disabled:opacity-60 mt-2 active:scale-[0.98] hover:shadow-xl animate-slideInUp stagger-3"
        >
          {loading ? (
            <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <>เข้าสู่ระบบ <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </form>

      {/* Signup link */}
      <div className="mt-5 text-center text-sm animate-slideInUp stagger-4">
        <span style={{ color: "var(--text-muted)" }}>ยังไม่มีบัญชี? </span>
        <a href="/signup" className="font-bold text-indigo-500 dark:text-indigo-400 hover:underline transition-colors">
          สมัครสมาชิก
        </a>
      </div>

      {/* Security note */}
      <div className="mt-4 flex items-center gap-2 justify-center animate-slideInUp stagger-5" style={{ color: "var(--text-faint)" }}>
        <Shield className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[11px]">ข้อมูลของคุณได้รับการปกป้องด้วยการเข้ารหัส JWT</span>
      </div>
    </div>
  );
}
