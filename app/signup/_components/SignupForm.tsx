import React from "react";
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Mail } from "lucide-react";

interface SignupFormProps {
  username: string;
  setUsername: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPw: string;
  setConfirmPw: (v: string) => void;
  showPw: boolean;
  setShowPw: React.Dispatch<React.SetStateAction<boolean>>;
  showCPw: boolean;
  setShowCPw: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  handleSubmit: (e: React.FormEvent) => void;
}

export default function SignupForm({
  username, setUsername, email, setEmail, displayName, setDisplayName,
  password, setPassword, confirmPw, setConfirmPw,
  showPw, setShowPw, showCPw, setShowCPw,
  loading, error, clearError, handleSubmit,
}: SignupFormProps) {
  return (
    <div
      className="w-full max-w-md rounded-3xl p-8 sm:p-10 shadow-2xl animate-scaleIn"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="text-center mb-8 animate-slideInUp">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">สมัครสมาชิก</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          สร้างบัญชีใหม่เพื่อเข้าใช้งานระบบ Math by Seng LMS
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Username */}
        <div className="space-y-1.5 animate-slideInUp stagger-1">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Username
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
              placeholder="อย่างน้อย 3 ตัวอักษร ไม่มีช่องว่าง"
            />
          </div>
        </div>

        {/* Email (Optional) */}
        <div className="space-y-1.5 animate-slideInUp stagger-2">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Email <span className="text-[10px] font-normal lowercase opacity-70">(ไม่บังคับ)</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200" style={{ color: "var(--text-faint)" }} />
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); clearError(); }}
              autoComplete="email"
              className="w-full pl-10 pr-4 py-3 rounded-xl border bg-transparent text-sm input-glow focus:ring-0"
              style={{ borderColor: "var(--border-base)", color: "var(--text-primary)" }}
              placeholder="name@example.com"
            />
          </div>
        </div>

        {/* Display Name */}
        <div className="space-y-1.5 animate-slideInUp stagger-3">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            ชื่อแสดงผล
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200" style={{ color: "var(--text-faint)" }} />
            <input
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); clearError(); }}
              autoComplete="name"
              className="w-full pl-10 pr-4 py-3 rounded-xl border bg-transparent text-sm input-glow focus:ring-0"
              style={{ borderColor: "var(--border-base)", color: "var(--text-primary)" }}
              placeholder="เช่น สมศรี ใจดี หรือ ครูมานี"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5 animate-slideInUp stagger-4">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200" style={{ color: "var(--text-faint)" }} />
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => { setPassword(e.target.value); clearError(); }}
              autoComplete="new-password"
              className="w-full pl-10 pr-12 py-3 rounded-xl border bg-transparent text-sm input-glow focus:ring-0"
              style={{ borderColor: "var(--border-base)", color: "var(--text-primary)" }}
              placeholder="อย่างน้อย 6 ตัวอักษร"
            />
            <button type="button" onClick={() => setShowPw(p => !p)} tabIndex={-1}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-all duration-200 hover:opacity-70 active:scale-90"
              style={{ color: "var(--text-faint)" }}>
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5 animate-slideInUp stagger-5">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            ยืนยัน Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200" style={{ color: "var(--text-faint)" }} />
            <input
              type={showCPw ? "text" : "password"}
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); clearError(); }}
              autoComplete="new-password"
              className="w-full pl-10 pr-12 py-3 rounded-xl border bg-transparent text-sm input-glow focus:ring-0"
              style={{ borderColor: "var(--border-base)", color: "var(--text-primary)" }}
              placeholder="กรอก Password อีกครั้ง"
            />
            <button type="button" onClick={() => setShowCPw(p => !p)} tabIndex={-1}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-all duration-200 hover:opacity-70 active:scale-90"
              style={{ color: "var(--text-faint)" }}>
              {showCPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Info: Role assignment by admin */}
        <div className="p-3.5 rounded-2xl border animate-slideInUp stagger-5" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-elevated)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            ✓ บัญชีของคุณจะเป็น <strong>นักเรียน</strong> ก่อน
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            แอดมินจะตรวจสอบและเปลี่ยนบทบาทเป็นครูผู้สอนได้ตามความเหมาะสม
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 animate-shake">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all duration-200 disabled:opacity-60 mt-1 active:scale-[0.98] hover:shadow-xl"
        >
          {loading ? (
            <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <>สมัครสมาชิก <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </form>

      {/* Login link */}
      <div className="mt-6 text-center text-sm animate-slideInUp stagger-6">
        <span style={{ color: "var(--text-muted)" }}>มีบัญชีอยู่แล้ว? </span>
        <a href="/login" className="font-bold text-indigo-500 dark:text-indigo-400 hover:underline transition-colors">
          เข้าสู่ระบบ
        </a>
      </div>
    </div>
  );
}
