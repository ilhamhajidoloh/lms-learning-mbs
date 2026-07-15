"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Meeting, useUser } from "../../context/UserContext";
import LoadingScreen from "../../components/LoadingScreen";
import { tx } from "../../lib/theme";
import TeamsNavbar from "./_components/TeamsNavbar";
import TabNav from "./_components/TabNav";
import MeetingForm from "./_components/MeetingForm";
import MeetingResultCard from "./_components/MeetingResultCard";
import LoggerConsole from "./_components/LoggerConsole";
import TutorialTab from "./_components/TutorialTab";
import CodeTab from "./_components/CodeTab";

export default function TeacherTeamsPage() {
  const { role, isAuthenticated, logout, darkMode, toggleDarkMode, loadingData } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"demo" | "tutorial" | "code">("demo");

  // Form State
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("2026-06-05");
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("15:00");

  // Demo Execution State
  const [status, setStatus] = useState<"idle" | "authenticating" | "requesting" | "success" | "error">("idle");
  const [meetingResult] = useState<Meeting | null>(null);
  const [copied, setCopied] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  useEffect(() => {
    if (loadingData) return;
    if (!isAuthenticated) {
      router.push("/login");
    } else if (role !== "teacher") {
      router.push(role === "admin" ? "/admin" : "/student");
    }
  }, [isAuthenticated, role, router, loadingData]);

  if (loadingData) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || role !== "teacher") {
    return null;
  }

  const addLog = (msg: string) => {
    setLogMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    setStatus("authenticating");
    setLogMessages([]);
    addLog("เตรียมเชื่อมต่อกับระบบเพื่อสร้างห้องเรียน...");

    // TODO: Hook up to actual backend endpoint later
    setStatus("error");
    addLog("ยังไม่ได้เชื่อมต่อระบบ Backend (Mock ถูกลบออกแล้ว)");
  };

  const copyToClipboard = () => {
    if (!meetingResult) return;
    const shareText = `📚 เชิญชวนเข้าห้องเรียนสดออนไลน์:\nวิชา: ${meetingResult.subject}\nเวลา: ${meetingResult.startDateTime} น.\nลิงก์เข้าสอน: ${meetingResult.joinUrl}\nPasscode: ${meetingResult.passcode}`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>
      <TeamsNavbar onBack={() => router.push("/teacher")} darkMode={darkMode} toggleDarkMode={toggleDarkMode} logout={logout} />

      {/* Main content layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            ระบบสร้างห้องประชุม Microsoft Teams
          </h1>
          <p className="text-sm max-w-2xl mx-auto" style={{ color: tx.muted }}>
            สำหรับครูผู้สอนในการสั่งงานสร้าง Meeting อัตโนมัติด้วย Microsoft Graph API เพื่อให้นักเรียนของท่านกดเข้าร่วมได้ทันทีจากแดชบอร์ดหลัก
          </p>
        </div>

        <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === "demo" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            {/* Form Container */}
            <MeetingForm
              subject={subject}
              setSubject={setSubject}
              date={date}
              setDate={setDate}
              startTime={startTime}
              setStartTime={setStartTime}
              endTime={endTime}
              setEndTime={setEndTime}
              status={status}
              handleCreateMeeting={handleCreateMeeting}
            />

            {/* Execution logs / Results */}
            <div className="flex flex-col space-y-6">
              {/* Output Result Card */}
              {meetingResult && (
                <MeetingResultCard meetingResult={meetingResult} copied={copied} copyToClipboard={copyToClipboard} />
              )}

              {/* Logger Console */}
              <LoggerConsole logMessages={logMessages} />
            </div>
          </div>
        )}

        {activeTab === "tutorial" && <TutorialTab />}

        {activeTab === "code" && <CodeTab />}
      </main>
    </div>
  );
}
