"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Video, Calendar, Moon, Sun, ArrowLeft,
  Check, Loader2, Copy, ExternalLink, Code, Layers,
  Terminal, LogOut
} from "lucide-react";
import { Meeting, useUser } from "../../context/UserContext";

const tx = {
  primary:   "var(--text-primary)",
  secondary: "var(--text-secondary)",
  muted:     "var(--text-muted)",
  faint:     "var(--text-faint)",
  base:      "var(--bg-base)",
  surface:   "var(--bg-surface)",
  elevated:  "var(--bg-elevated)",
  border:    "var(--border-base)",
  borderS:   "var(--border-subtle)",
  accent:    "var(--color-accent)",
  accentBg:  "var(--color-accent-bg)",
};

const cardStyle = {
  backgroundColor: tx.surface,
  border: `1px solid ${tx.borderS}`,
};

export default function TeacherTeamsPage() {
  const { role, isAuthenticated, logout, addMeeting, darkMode, toggleDarkMode } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"demo" | "tutorial" | "code">("demo");
  
  // Form State
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("2026-06-05");
  const [startTime, setStartTime] = useState("13:00");
  const [endTime, setEndTime] = useState("15:00");
  
  // Demo Execution State
  const [status, setStatus] = useState<"idle" | "authenticating" | "requesting" | "success" | "error">("idle");
  const [meetingResult, setMeetingResult] = useState<Meeting | null>(null);
  const [copied, setCopied] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    } else if (role !== "teacher") {
      router.push("/student");
    }
  }, [isAuthenticated, role, router]);

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
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass-panel shadow-sm" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button onClick={() => router.push("/teacher")} className="flex items-center gap-2 font-bold hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <ArrowLeft className="h-5 w-5" /> กลับหน้าแดชบอร์ดครู
            </button>
            <div className="flex items-center gap-3">
              <button onClick={toggleDarkMode} className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors" style={{ color: tx.secondary }}>
                {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />}
              </button>
              <div className="h-8 w-px" style={{ backgroundColor: tx.borderS }} />
              <button onClick={logout} className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

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

        {/* Tab Selection */}
        <div className="flex justify-start md:justify-center border-b overflow-x-auto whitespace-nowrap scrollbar-none" style={{ borderColor: tx.borderS }}>
          <div className="flex space-x-6 text-sm font-medium pb-px">
            <button onClick={() => setActiveTab("demo")} className="pb-3 border-b-2 transition-all px-1 shrink-0" style={activeTab === "demo" ? { borderBottomColor: tx.accent, color: tx.accent, fontWeight: 700 } : { borderBottomColor: "transparent", color: tx.secondary }}>
              ตัวจำลองระบบการสร้าง (API Demo)
            </button>
            <button onClick={() => setActiveTab("tutorial")} className="pb-3 border-b-2 transition-all px-1 shrink-0" style={activeTab === "tutorial" ? { borderBottomColor: tx.accent, color: tx.accent, fontWeight: 700 } : { borderBottomColor: "transparent", color: tx.secondary }}>
              คู่มือการเชื่อมต่อ (Graph API Guide)
            </button>
            <button onClick={() => setActiveTab("code")} className="pb-3 border-b-2 transition-all px-1 shrink-0" style={activeTab === "code" ? { borderBottomColor: tx.accent, color: tx.accent, fontWeight: 700 } : { borderBottomColor: "transparent", color: tx.secondary }}>
              ชุดโค้ดโปรแกรม (Source Code)
            </button>
          </div>
        </div>

        {activeTab === "demo" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            {/* Form Container */}
            <div className="rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl" style={cardStyle}>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> ตั้งค่าการจองห้องเรียน
              </h2>
              
              <form onSubmit={handleCreateMeeting} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>หัวข้อการนัดหมาย (Subject)</label>
                  <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>วันที่ (Date)</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>เวลาเริ่ม (Start)</label>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>เวลาเลิก (End)</label>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
                  </div>
                </div>

                <button type="submit" disabled={status === "authenticating" || status === "requesting"} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
                  {(status === "authenticating" || status === "requesting") ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      กำลังสร้างและส่งข้อมูล...
                    </>
                  ) : (
                    <>
                      <Video className="h-5 w-5" />
                      จองและสร้างลิงก์ Microsoft Teams
                    </>
                  )}
                </button>
              </form>

              {/* Status Display Area */}
              {status !== "idle" && (
                <div className="rounded-2xl p-4 border" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                  <div className="flex items-center gap-3">
                    {status === "authenticating" && (
                      <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin shrink-0" />
                    )}
                    {status === "requesting" && (
                      <div className="h-6 w-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin shrink-0" />
                    )}
                    {status === "success" && (
                      <div className="h-6 w-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                    <span className="text-sm font-semibold">
                      {status === "authenticating" && "กำลังแลกเปลี่ยน Token เพื่อขอสิทธิ์การเขียนห้องเรียน..."}
                      {status === "requesting" && "ส่งคำร้องไปยัง API: https://graph.microsoft.com/..."}
                      {status === "success" && "สร้างห้องสนทนาเรียบร้อย!"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Execution logs / Results */}
            <div className="flex flex-col space-y-6">
              {/* Output Result Card */}
              {meetingResult && (
                <div className="rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl text-white bg-gradient-to-tr from-indigo-900 to-purple-950 border border-indigo-500/20">
                  <div className="flex justify-between items-center">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      MS GRAPH API RESPONSE (201)
                    </span>
                    <button onClick={copyToClipboard} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white flex items-center gap-1.5 text-xs font-semibold">
                      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      {copied ? "คัดลอกแล้ว!" : "คัดลอกข้อมูลแชร์"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">{meetingResult.subject}</h3>
                    <p className="text-xs text-indigo-200">
                      เวลาเริ่ม: {meetingResult.startDateTime} น.
                    </p>
                    <p className="text-xs text-indigo-200 font-mono">
                      Meeting ID: {meetingResult.id}
                    </p>
                  </div>

                  <div className="pt-2">
                    <a href={meetingResult.joinUrl} target="_blank" rel="noopener noreferrer" className="w-full py-3 rounded-xl bg-white text-indigo-950 font-extrabold hover:bg-slate-200 flex items-center justify-center gap-2 shadow-md">
                      เข้าร่วมทีมในฐานะครู <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* Logger Console */}
              <div className="flex-1 rounded-3xl p-6 shadow-xl flex flex-col space-y-4 font-mono text-xs" style={cardStyle}>
                <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: tx.borderS }}>
                  <span className="font-bold flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-indigo-500 dark:text-indigo-400" /> Console Logs (Real-time Flow)
                  </span>
                  <span className="text-[10px]" style={{ color: tx.faint }}>
                    Microsoft Graph SDK
                  </span>
                </div>
                
                <div className="flex-1 bg-slate-950 rounded-2xl p-4 overflow-y-auto min-h-[220px] max-h-[300px] text-indigo-400 space-y-2 text-left">
                  {logMessages.length === 0 ? (
                    <p className="text-slate-500 italic">พร้อมรอการสั่งงานสร้างจากฟอร์ม...</p>
                  ) : (
                    logMessages.map((log, idx) => (
                      <pre key={idx} className="whitespace-pre-wrap">{log}</pre>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "tutorial" && (
          <div className="rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl animate-fadeIn text-left" style={cardStyle}>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-indigo-500" /> ขั้นตอนและสถาปัตยกรรมการต่อ Graph API
            </h2>
            <div className="space-y-4 text-sm leading-relaxed" style={{ color: tx.secondary }}>
              <p>
                ในระบบบริหารจัดการโรงเรียน/การกวดวิชา (LMS) ยุคใหม่ หน้าจอครูผู้สอนจะทำหน้าที่ส่ง Request ไปยัง Microsoft Graph API เพื่อขอพื้นที่จัดตั้งห้องเรียนไลฟ์ดังนี้:
              </p>
              <ol className="list-decimal list-inside space-y-2 pl-2">
                <li>
                  <strong>ลงทะเบียนแอปพลิเคชัน (Azure AD Portal)</strong>: ลงทะเบียน Client ID, Tenant ID และมอบสิทธิ์การทำงานระดับ Application/Delegated Permission ในขอบเขต <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-mono text-xs">OnlineMeetings.ReadWrite</code>
                </li>
                <li>
                  <strong>รับส่งสิทธิ์ OAuth 2.0 Client Credentials</strong>: แลกเปลี่ยนข้อมูลลับเพื่อรับ Access Token ในรูปของ JWT string สำหรับยืนยันตัวตน
                </li>
                <li>
                  <strong>เรียก API ของ Microsoft Teams</strong>: ยิง POST ไปยัง endpoint <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-mono text-xs">/v1.0/me/onlineMeetings</code>
                </li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === "code" && (
          <div className="rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl animate-fadeIn text-left" style={cardStyle}>
            <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: tx.borderS }}>
              <span className="font-bold flex items-center gap-2 text-lg">
                <Code className="h-5 w-5 text-indigo-500" /> ชุดโค้ดสาธิตการเชื่อมโยงระบบ (TypeScript SDK)
              </span>
            </div>
            <pre className="bg-slate-950 text-indigo-400 p-5 rounded-2xl text-xs overflow-x-auto text-left font-mono">
{`import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProvider";

// 1. กำหนดรายละเอียดสิทธิ์ Azure AD 
const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID!,
  process.env.AZURE_CLIENT_ID!,
  process.env.AZURE_CLIENT_SECRET!
);

const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ["https://graph.microsoft.com/.default"],
});

// 2. เรียกเปิดการเชื่อมต่อ Graph Client
const graphClient = Client.initWithMiddleware({ authProvider });

// 3. ฟังก์ชันจองและสร้าง Meeting URL
export async function createTeamsMeeting(subject: string, start: string, end: string) {
  const onlineMeeting = {
    subject: subject,
    startDateTime: start, // รูปแบบ ISO String
    endDateTime: end,
    lobbyBypassSettings: {
      scope: "everyone"
    }
  };

  return await graphClient
    .api("/me/onlineMeetings")
    .post(onlineMeeting);
}`}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
