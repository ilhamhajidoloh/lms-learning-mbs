"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Video, Users, Power, Play, AlertCircle, ShieldAlert, Sparkles, Loader2, ExternalLink } from "lucide-react";
import { useUser } from "../../context/UserContext";
import { JitsiMeeting } from "../../components/JitsiMeeting";
import { generateJitsiUrl } from "@/lib/jitsi";
import { apiFetch } from "@/lib/api";
import { toast } from "@/lib/swal";
import { tx } from "../../lib/theme";
import LoadingScreen from "../../components/LoadingScreen";

interface LiveClassDetail {
  id: string;
  course_id: string;
  lesson_id?: string | null;
  room_name: string;
  title: string;
  description?: string | null;
  scheduled_at?: string | null;
  duration_minutes: number;
  host_id: string;
  host_name?: string;
  is_active: boolean;
  course_title?: string;
  participant_count?: number;
}

export default function LiveClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const classId = resolvedParams.id;

  const router = useRouter();
  const { isAuthenticated, loadingData, displayName, role, currentUserId } = useUser();

  const [liveClass, setLiveClass] = useState<LiveClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  // Fetch live class details
  const fetchLiveClass = async () => {
    try {
      const { data, error } = await apiFetch<{ liveClass: LiveClassDetail }>(`/api/live-classes/${classId}`);
      if (error || !data) {
        setError(error || "ไม่พบข้อมูลห้องเรียนสดนี้");
        return;
      }
      setLiveClass(data.liveClass);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดห้องเรียน";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loadingData) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchLiveClass();
  }, [isAuthenticated, loadingData, classId, router]);

  // Handle participant join event
  const handleJoin = async () => {
    setHasJoined(true);
    try {
      await apiFetch(`/api/live-classes/${classId}/join`, {
        method: "POST",
      });
    } catch (e) {
      console.warn("Failed to log participant join:", e);
    }
  };

  // Handle leave event
  const handleLeave = () => {
    if (role === "teacher") {
      router.push("/teacher/live-classes");
    } else {
      router.push("/student");
    }
  };

  // Teacher start class
  const handleStartClass = async () => {
    setActionLoading(true);
    try {
      const { data, error } = await apiFetch<{ liveClass: LiveClassDetail }>(`/api/live-classes/${classId}/start`, {
        method: "POST",
      });
      if (error || !data) {
        toast.error("เปิดห้องเรียนไม่สำเร็จ: " + (error || "Unknown error"));
        return;
      }
      setLiveClass(data.liveClass);
      toast.success("เปิดห้องเรียนสดสำเร็จแล้ว! นักเรียนสามารถเข้าร่วมได้ทันที");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error("เปิดห้องเรียนไม่สำเร็จ: " + msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Teacher end class
  const handleEndClass = async () => {
    setActionLoading(true);
    try {
      const { data, error } = await apiFetch<{ liveClass: LiveClassDetail }>(`/api/live-classes/${classId}/end`, {
        method: "POST",
      });
      if (error || !data) {
        toast.error("ปิดห้องเรียนไม่สำเร็จ: " + (error || "Unknown error"));
        return;
      }
      setLiveClass(data.liveClass);
      toast.success("ปิดห้องเรียนสดเรียบร้อยแล้ว");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error("ปิดห้องเรียนไม่สำเร็จ: " + msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (loadingData || loading) {
    return <LoadingScreen />;
  }

  if (error || !liveClass) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: tx.base, color: tx.primary }}>
        <div className="max-w-md w-full rounded-3xl p-8 border shadow-xl text-center space-y-6" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
          <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold">ไม่สามารถเข้าสู่ห้องเรียนได้</h2>
            <p className="text-sm mt-2" style={{ color: tx.muted }}>
              {error || "ไม่พบห้องเรียน หรือคุณไม่มีสิทธิ์เข้าถึงรายวิชานี้"}
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> ย้อนกลับ
          </button>
        </div>
      </div>
    );
  }

  const isHost = role === "admin" || liveClass.host_id === currentUserId;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleLeave}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            title="ออกจากห้องเรียน"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {liveClass.course_title && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 truncate">
                  {liveClass.course_title}
                </span>
              )}
              {liveClass.is_active ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-red-400">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  🔴 สด
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-400">
                  ⚪ ยังไม่เริ่ม
                </span>
              )}
            </div>
            <h1 className="text-sm sm:text-base font-bold truncate max-w-[200px] sm:max-w-md md:max-w-lg">
              {liveClass.title}
            </h1>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-3">
          {liveClass.host_name && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/50">
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              <span>ผู้สอน: {liveClass.host_name}</span>
            </div>
          )}

          {isHost && (
            <>
              {liveClass.is_active ? (
                <button
                  onClick={handleEndClass}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                  title="ปิดห้องเรียนสด"
                >
                  <Power className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">ปิดห้องเรียน</span>
                </button>
              ) : (
                <button
                  onClick={handleStartClass}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                  title="เริ่มเปิดห้องเรียนสด"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">เริ่มสอนสด</span>
                </button>
              )}
            </>
          )}

          {/* Open Native Jitsi in New Window */}
          <button
            onClick={() => {
              if (liveClass) {
                const url = generateJitsiUrl(liveClass.room_name, displayName || "ผู้เรียน", isHost || role === "teacher");
                window.open(url, "_blank");
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold transition-all active:scale-95 shadow"
            title="เปิดห้องเรียน Jitsi ในหน้าต่างใหม่แบบเต็มจอ 100%"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">เปิดหน้าต่างใหม่ ↗</span>
          </button>

          <button
            onClick={handleLeave}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600/20 hover:text-rose-400 text-slate-300 text-xs font-bold transition-colors"
          >
            ออกจากห้อง
          </button>
        </div>
      </header>

      {/* Main Room Viewport */}
      <main className="flex-1 flex flex-col relative w-full h-[calc(100vh-4rem)] p-2 sm:p-4 overflow-hidden">
        {/* Notice for Inactive Class */}
        {!liveClass.is_active && !isHost ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div className="max-w-md w-full rounded-3xl p-8 bg-slate-900 border border-slate-800 shadow-2xl space-y-5 animate-scaleIn">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">ห้องเรียนยังไม่เปิดการสอน</h2>
                <p className="text-xs text-slate-400 mt-2">
                  คุณครูผู้สอนยังไม่ได้กดเริ่มห้องเรียนสดนี้ กรุณารออาจารย์เปิดห้อง หรือกลับมาเข้าเรียนอีกครั้งตามเวลานัดหมายครับ
                </p>
                {liveClass.scheduled_at && (
                  <p className="text-xs font-mono text-indigo-400 mt-3 bg-indigo-500/10 py-1.5 px-3 rounded-lg inline-block border border-indigo-500/20">
                    เวลานัดหมาย: {new Date(liveClass.scheduled_at).toLocaleString("th-TH")}
                  </p>
                )}
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={fetchLiveClass}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition-all"
                >
                  กดเพื่อตรวจสอบสถานะห้องอีกครั้ง
                </button>
                <button
                  onClick={() => router.push("/student")}
                  className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs transition-all"
                >
                  กลับสู่หน้าหลัก
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative flex-1 w-full h-full min-h-0 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950">
            {/* Host Banner if class not active yet */}
            {!liveClass.is_active && isHost && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-500/90 text-slate-950 px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-3 text-xs font-extrabold animate-bounce">
                <AlertCircle className="h-4 w-4" />
                <span>สถานะ: ยังไม่เปิดห้องเรียนสด — คุณครูกดปุ่ม "เริ่มสอนสด" ด้านบนเพื่อให้นักเรียนเข้าห้องได้ครับ</span>
                <button
                  onClick={handleStartClass}
                  className="px-3 py-1 rounded-xl bg-slate-950 text-white text-xs hover:bg-slate-800 transition-colors"
                >
                  เริ่มทันที
                </button>
              </div>
            )}

            {/* Embedded Jitsi Meeting */}
            <JitsiMeeting
              roomName={liveClass.room_name}
              displayName={displayName}
              onJoin={handleJoin}
              onLeave={handleLeave}
              className="w-full h-full"
            />
          </div>
        )}
      </main>
    </div>
  );
}

