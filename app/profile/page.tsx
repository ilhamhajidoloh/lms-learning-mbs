"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Moon, Sun, LogOut, Pencil, Check, X,
  Lock, Eye, EyeOff, Shield, BookOpen, GraduationCap,
  Users, FileText, Trophy, Clock, AlertCircle, CheckCircle2
} from "lucide-react";
import { useUser } from "../context/UserContext";

const tx = {
  primary:  "var(--text-primary)",
  secondary:"var(--text-secondary)",
  muted:    "var(--text-muted)",
  faint:    "var(--text-faint)",
  base:     "var(--bg-base)",
  surface:  "var(--bg-surface)",
  elevated: "var(--bg-elevated)",
  border:   "var(--border-base)",
  borderS:  "var(--border-subtle)",
  accent:   "var(--color-accent)",
  accentBg: "var(--color-accent-bg)",
};

const ROLE_META = {
  admin:   { label: "Admin",      gradient: "from-rose-500 to-orange-400",   icon: <Shield className="h-5 w-5" />,        desc: "System Administrator" },
  teacher: { label: "Teacher",    gradient: "from-indigo-500 to-purple-600", icon: <BookOpen className="h-5 w-5" />,       desc: "ผู้สอนในระบบ" },
  student: { label: "Student",    gradient: "from-purple-500 to-pink-500",   icon: <GraduationCap className="h-5 w-5" />,  desc: "ผู้เรียนในระบบ" },
};

export default function ProfilePage() {
  const {
    role, isAuthenticated, displayName, currentUsername,
    darkMode, toggleDarkMode, logout,
    updateDisplayName, updatePassword,
    assignments, submissions, courses, appUsers,
  } = useUser();
  const router = useRouter();

  const backPath = role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";

  useEffect(() => {
    if (!isAuthenticated) router.push("/login");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const meta = ROLE_META[role];

  // ── Edit display name ──────────────────────────────────────
  const [editingName, setEditingName]   = useState(false);
  const [nameInput,   setNameInput]     = useState(displayName);
  const [nameSuccess, setNameSuccess]   = useState(false);

  const handleSaveName = () => {
    if (!nameInput.trim()) return;
    updateDisplayName(nameInput.trim());
    setEditingName(false);
    setNameSuccess(true);
    setTimeout(() => setNameSuccess(false), 3000);
  };

  // ── Change password ────────────────────────────────────────
  const [oldPw,    setOldPw]    = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [cPw,      setCPw]      = useState("");
  const [showOld,  setShowOld]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [pwError,  setPwError]  = useState<string | null>(null);
  const [pwOk,     setPwOk]     = useState(false);

  const handleSavePw = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (!oldPw || !newPw || !cPw) { setPwError("กรุณากรอกให้ครบทุกช่อง"); return; }
    if (newPw.length < 6)          { setPwError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (newPw !== cPw)             { setPwError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน"); return; }
    const result = updatePassword(oldPw, newPw);
    if (!result.success) { setPwError(result.error ?? "เกิดข้อผิดพลาด"); return; }
    setOldPw(""); setNewPw(""); setCPw("");
    setPwOk(true);
    setTimeout(() => setPwOk(false), 3000);
  };

  // ── Role-specific stats ────────────────────────────────────
  const stats = role === "student" ? [
    { label: "คอร์สที่ลงทะเบียน",  value: courses.length,                                              icon: <BookOpen className="h-5 w-5" />,  color: "#6366f1" },
    { label: "งานที่ส่งแล้ว",       value: submissions.filter(s => s.studentId === "std-current").length, icon: <FileText className="h-5 w-5" />,  color: "#a855f7" },
    { label: "ควิซที่ทำเสร็จ",      value: submissions.filter(s => s.studentId === "std-current" && s.type === "quiz").length, icon: <Trophy className="h-5 w-5" />, color: "#10b981" },
  ] : role === "teacher" ? [
    { label: "คอร์สที่สอน",         value: 3,                 icon: <BookOpen className="h-5 w-5" />,  color: "#6366f1" },
    { label: "งานที่มอบหมาย",       value: assignments.length, icon: <FileText className="h-5 w-5" />,  color: "#a855f7" },
    { label: "นักเรียนทั้งหมด",     value: 261,               icon: <Users className="h-5 w-5" />,     color: "#f59e0b" },
  ] : [
    { label: "ผู้ใช้ทั้งหมด",       value: appUsers.length,                                    icon: <Users className="h-5 w-5" />,    color: "#6366f1" },
    { label: "ครูผู้สอน",           value: appUsers.filter(u => u.role === "teacher").length,  icon: <BookOpen className="h-5 w-5" />,  color: "#a855f7" },
    { label: "นักเรียน",             value: appUsers.filter(u => u.role === "student").length,  icon: <GraduationCap className="h-5 w-5" />, color: "#10b981" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass-panel shadow-sm" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button onClick={() => router.push(backPath)}
              className="flex items-center gap-2 font-bold hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
              <ArrowLeft className="h-5 w-5" /> กลับหน้าหลัก
            </button>
            <span className="font-bold text-sm" style={{ color: tx.muted }}>โปรไฟล์ของฉัน</span>
            <div className="flex items-center gap-2">
              <button onClick={toggleDarkMode}
                className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors"
                style={{ color: tx.secondary }}>
                {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500" />}
              </button>
              <button onClick={() => { logout(); router.push("/login"); }}
                className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors" title="ออกจากระบบ">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── PROFILE CARD ───────────────────────────────────── */}
        <div className="rounded-3xl p-6 sm:p-8 shadow-sm" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

            {/* Avatar */}
            <div className={`h-24 w-24 rounded-3xl bg-gradient-to-tr ${meta.gradient} flex items-center justify-center text-white text-4xl font-extrabold shadow-xl shrink-0`}>
              {displayName.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left space-y-3">
              {/* Display Name + edit */}
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2">
                {editingName ? (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      autoFocus
                      className="px-3 py-1.5 rounded-xl border text-lg font-bold bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
                      style={{ borderColor: tx.border, color: tx.primary }}
                    />
                    <button onClick={handleSaveName} className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-colors">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setEditingName(false); setNameInput(displayName); }} className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors" style={{ color: tx.faint }}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-extrabold tracking-tight">{displayName}</h1>
                    <button onClick={() => { setEditingName(true); setNameInput(displayName); }}
                      className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors"
                      style={{ color: tx.faint }} title="แก้ไขชื่อ">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {nameSuccess && (
                  <span className="flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> บันทึกแล้ว
                  </span>
                )}
              </div>

              {/* Username */}
              <p className="font-mono text-sm" style={{ color: tx.muted }}>@{currentUsername || "—"}</p>

              {/* Role badge */}
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${meta.gradient}`}>
                  {meta.icon} {meta.label}
                </span>
                <span className="text-xs" style={{ color: tx.muted }}>{meta.desc}</span>
              </div>

              {/* Member since */}
              <p className="flex items-center justify-center sm:justify-start gap-1.5 text-xs" style={{ color: tx.faint }}>
                <Clock className="h-3.5 w-3.5" /> สมาชิกตั้งแต่ มกราคม 2026
              </p>
            </div>
          </div>
        </div>

        {/* ── STATS ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map(s => (
            <div key={s.label} className="rounded-2xl p-5 text-center shadow-sm"
              style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: `${s.color}18`, color: s.color }}>
                {s.icon}
              </div>
              <p className="text-2xl font-extrabold">{s.value}</p>
              <p className="text-[11px] mt-0.5 font-medium" style={{ color: tx.muted }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* ── EDIT DISPLAY NAME ────────────────────────────── */}
          <div className="rounded-3xl p-6 shadow-sm space-y-4" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
            <h2 className="font-bold text-base flex items-center gap-2">
              <Pencil className="h-4 w-4 text-indigo-500" /> แก้ไขชื่อแสดงผล
            </h2>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                ชื่อแสดงผลปัจจุบัน
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onFocus={() => setEditingName(false)}
                  className="flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: tx.border, color: tx.primary }}
                  placeholder="ชื่อที่แสดงในระบบ"
                />
                <button
                  onClick={handleSaveName}
                  disabled={!nameInput.trim() || nameInput.trim() === displayName}
                  className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm disabled:opacity-40 transition-all"
                >
                  บันทึก
                </button>
              </div>
            </div>
            {nameSuccess && (
              <p className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> อัปเดตชื่อเรียบร้อยแล้ว
              </p>
            )}
          </div>

          {/* ── CHANGE PASSWORD ──────────────────────────────── */}
          <div className="rounded-3xl p-6 shadow-sm space-y-4" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
            <h2 className="font-bold text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-purple-500" /> เปลี่ยนรหัสผ่าน
            </h2>
            <form onSubmit={handleSavePw} className="space-y-3">
              {/* Old PW */}
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: tx.faint }} />
                <input
                  type={showOld ? "text" : "password"}
                  value={oldPw}
                  onChange={e => { setOldPw(e.target.value); setPwError(null); }}
                  placeholder="รหัสผ่านเดิม"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 bg-transparent text-sm"
                  style={{ borderColor: tx.border, color: tx.primary }}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowOld(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                  style={{ color: tx.faint }}>
                  {showOld ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* New PW */}
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: tx.faint }} />
                <input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={e => { setNewPw(e.target.value); setPwError(null); }}
                  placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 bg-transparent text-sm"
                  style={{ borderColor: tx.border, color: tx.primary }}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowNew(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                  style={{ color: tx.faint }}>
                  {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Confirm PW */}
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: tx.faint }} />
                <input
                  type="password"
                  value={cPw}
                  onChange={e => { setCPw(e.target.value); setPwError(null); }}
                  placeholder="ยืนยันรหัสผ่านใหม่"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 bg-transparent text-sm"
                  style={{ borderColor: tx.border, color: tx.primary }}
                />
              </div>

              {pwError && (
                <p className="text-xs text-rose-500 font-semibold flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {pwError}
                </p>
              )}
              {pwOk && (
                <p className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> เปลี่ยนรหัสผ่านเรียบร้อยแล้ว
                </p>
              )}

              <button type="submit"
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-md transition-all">
                เปลี่ยนรหัสผ่าน
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="py-6 mt-4 border-t text-center text-xs" style={{ borderColor: tx.borderS, color: tx.faint }}>
        © 2026 Math by Seng — Premium LMS Platform
      </footer>
    </div>
  );
}
