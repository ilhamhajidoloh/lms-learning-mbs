"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, BookOpen, GraduationCap, Users, FileText, Trophy,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import { tx } from "../lib/theme";
import ProfileHeader from "./_components/ProfileHeader";
import ProfileCard from "./_components/ProfileCard";
import StatsGrid from "./_components/StatsGrid";
import EditDisplayNameForm from "./_components/EditDisplayNameForm";
import ChangePasswordForm from "./_components/ChangePasswordForm";

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

  // ── Edit display name ──────────────────────────────────────
  const [editingName, setEditingName]   = useState(false);
  const [nameInput,   setNameInput]     = useState(displayName);

  const handleSaveName = () => {
    if (!nameInput.trim()) return;
    updateDisplayName(nameInput.trim());
    setEditingName(false);
  };

  // ── Change password ────────────────────────────────────────
  const [oldPw,    setOldPw]    = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [cPw,      setCPw]      = useState("");
  const [showOld,  setShowOld]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [pwError,  setPwError]  = useState<string | null>(null);

  if (!isAuthenticated) return null;

  const meta = ROLE_META[role];

  const handleSavePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (!oldPw || !newPw || !cPw) { setPwError("กรุณากรอกให้ครบทุกช่อง"); return; }
    if (newPw.length < 6)          { setPwError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (newPw !== cPw)             { setPwError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน"); return; }
    const result = await updatePassword(oldPw, newPw);
    if (!result.success) { setPwError(result.error ?? "เกิดข้อผิดพลาด"); return; }
    setOldPw(""); setNewPw(""); setCPw("");
  };

  // ── Role-specific stats ────────────────────────────────────
  const stats = role === "student" ? [
    { label: "คอร์สที่ลงทะเบียน",  value: courses.length,                                              icon: <BookOpen className="h-5 w-5" />,  accent: "indigo" },
    { label: "งานที่ส่งแล้ว",       value: submissions.filter(s => s.studentId === "std-current").length, icon: <FileText className="h-5 w-5" />,  accent: "purple" },
    { label: "ควิซที่ทำเสร็จ",      value: submissions.filter(s => s.studentId === "std-current" && s.type === "quiz").length, icon: <Trophy className="h-5 w-5" />, accent: "emerald" },
  ] : role === "teacher" ? [
    { label: "คอร์สที่สอน",         value: 3,                 icon: <BookOpen className="h-5 w-5" />,  accent: "indigo" },
    { label: "งานที่มอบหมาย",       value: assignments.length, icon: <FileText className="h-5 w-5" />,  accent: "purple" },
    { label: "นักเรียนทั้งหมด",     value: 261,               icon: <Users className="h-5 w-5" />,     accent: "amber" },
  ] : [
    { label: "ผู้ใช้ทั้งหมด",       value: appUsers.length,                                    icon: <Users className="h-5 w-5" />,    accent: "indigo" },
    { label: "ครูผู้สอน",           value: appUsers.filter(u => u.role === "teacher").length,  icon: <BookOpen className="h-5 w-5" />,  accent: "purple" },
    { label: "นักเรียน",             value: appUsers.filter(u => u.role === "student").length,  icon: <GraduationCap className="h-5 w-5" />, accent: "emerald" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>

      <ProfileHeader
        onBack={() => router.push(backPath)}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onLogout={() => { logout(); router.push("/login"); }}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        <ProfileCard
          meta={meta}
          displayName={displayName}
          currentUsername={currentUsername}
          editingName={editingName}
          setEditingName={setEditingName}
          nameInput={nameInput}
          setNameInput={setNameInput}
          handleSaveName={handleSaveName}
        />

        <StatsGrid stats={stats} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          <EditDisplayNameForm
            displayName={displayName}
            nameInput={nameInput}
            setNameInput={setNameInput}
            setEditingName={setEditingName}
            handleSaveName={handleSaveName}
          />

          <ChangePasswordForm
            oldPw={oldPw}
            setOldPw={setOldPw}
            newPw={newPw}
            setNewPw={setNewPw}
            cPw={cPw}
            setCPw={setCPw}
            showOld={showOld}
            setShowOld={setShowOld}
            showNew={showNew}
            setShowNew={setShowNew}
            pwError={pwError}
            setPwError={setPwError}
            handleSavePw={handleSavePw}
          />
        </div>
      </main>

      <footer className="py-6 mt-4 border-t text-center text-xs" style={{ borderColor: tx.borderS, color: tx.faint }}>
        © 2026 Math by Seng — Premium LMS Platform
      </footer>
    </div>
  );
}
