"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { useUser } from "../../context/UserContext";
import LoadingScreen from "../../components/LoadingScreen";
import { tx } from "../../lib/theme";
import TeamsNavbar from "./_components/TeamsNavbar";
import MeetingsList from "./_components/MeetingsList";
import PolicyNotice from "./_components/PolicyNotice";

export default function StudentTeamsPage() {
  const { role, isAuthenticated, logout, meetings, darkMode, toggleDarkMode, loadingData } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loadingData) return;
    if (!isAuthenticated) {
      router.push("/login");
    } else if (role !== "student") {
      router.push(role === "admin" ? "/admin" : "/teacher");
    }
  }, [isAuthenticated, role, router, loadingData]);

  if (loadingData) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || role !== "student") {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>
      <TeamsNavbar onBack={() => router.push("/student")} darkMode={darkMode} toggleDarkMode={toggleDarkMode} logout={logout} />

      {/* Main content layout */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            ห้องเรียนสด Microsoft Teams (ผู้เรียน)
          </h1>
          <p className="text-sm max-w-2xl mx-auto" style={{ color: tx.muted }}>
            หน้ารับลิงก์การเรียนการสอนสดแบบออนไลน์ เมื่อคุณครูสร้างคลาสเรียนสด ลิงก์ห้องประชุมจะมาอัปเดตตรงนี้ให้โดยอัตโนมัติ
          </p>
        </div>

        {/* Live meetings display for students */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-500 dark:text-purple-400" /> คลาสเรียนสดของคุณวันนี้
          </h2>

          <MeetingsList meetings={meetings} />
        </div>

        {/* Informative box */}
        <PolicyNotice />
      </main>
    </div>
  );
}
