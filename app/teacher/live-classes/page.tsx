"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Video, Radio, RefreshCw, Calendar, ArrowLeft, BookOpen } from "lucide-react";
import { useUser } from "../../context/UserContext";
import { TeacherHeader } from "../_components/TeacherHeader";
import { LiveClassCard, type LiveClassData } from "../../components/LiveClassCard";
import { CreateLiveClassModal } from "../../components/CreateLiveClassModal";
import { EmptyState } from "../../components/EmptyState";
import { StatCard } from "../../components/StatCard";
import LoadingScreen from "../../components/LoadingScreen";
import { apiFetch } from "@/lib/api";
import { toast, alert as swalAlert } from "@/lib/swal";
import { tx } from "../../lib/theme";

export default function TeacherLiveClassesPage() {
  const router = useRouter();
  const { isAuthenticated, loadingData, role, displayName, logout, darkMode, toggleDarkMode, courses, currentUserId } = useUser();

  const [liveClasses, setLiveClasses] = useState<LiveClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "scheduled">("all");
  const [selectedCourseId, setSelectedCourseId] = useState("all");

  const teacherCourses = courses.filter((c) => c.instructorId === currentUserId);

  const fetchLiveClasses = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const { data, error } = await apiFetch<{ liveClasses: LiveClassData[] }>("/api/live-classes");
      if (error || !data) {
        console.error("Failed to fetch live classes:", error);
        return;
      }
      setLiveClasses(data.liveClasses || []);
      if (showToast) {
        toast.success("อัปเดตข้อมูลห้องเรียนสดล่าสุดเรียบร้อยแล้ว!");
      }
    } catch (err) {
      console.error("fetchLiveClasses error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (loadingData) return;
    if (!isAuthenticated) {
      router.push("/login");
    } else if (role !== "teacher" && role !== "admin") {
      router.push("/student");
    } else {
      let isCancelled = false;
      apiFetch<{ liveClasses: LiveClassData[] }>("/api/live-classes")
        .then(({ data, error }) => {
          if (isCancelled) return;
          if (error || !data) {
            console.error("Failed to fetch live classes:", error);
            return;
          }
          setLiveClasses(data.liveClasses || []);
        })
        .catch((err) => {
          if (isCancelled) return;
          console.error("fetchLiveClasses error:", err);
        })
        .finally(() => {
          if (!isCancelled) setLoading(false);
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [isAuthenticated, role, loadingData, router]);

  const handleStartClass = async (id: string) => {
    try {
      const { data, error } = await apiFetch<{ liveClass: LiveClassData }>(`/api/live-classes/${id}/start`, {
        method: "POST",
      });
      if (error || !data) {
        toast.error("เริ่มห้องเรียนสดไม่สำเร็จ: " + (error || "Unknown error"));
        return;
      }
      setLiveClasses((prev) => prev.map((lc) => (lc.id === id ? { ...lc, is_active: true } : lc)));
      toast.success("เปิดห้องเรียนสดเรียบร้อยแล้ว! นักเรียนสามารถเข้าเรียนได้ทันที 🔴");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error("เกิดข้อผิดพลาด: " + msg);
    }
  };

  const handleEndClass = async (id: string) => {
    try {
      const { data, error } = await apiFetch<{ liveClass: LiveClassData }>(`/api/live-classes/${id}/end`, {
        method: "POST",
      });
      if (error || !data) {
        toast.error("ปิดห้องเรียนสดไม่สำเร็จ: " + (error || "Unknown error"));
        return;
      }
      setLiveClasses((prev) => prev.map((lc) => (lc.id === id ? { ...lc, is_active: false } : lc)));
      toast.success("ปิดห้องเรียนสดเรียบร้อยแล้ว");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error("เกิดข้อผิดพลาด: " + msg);
    }
  };

  const handleDeleteClass = async (id: string) => {
    const confirmed = await swalAlert.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบห้องเรียนสดนี้?");
    if (!confirmed) return;

    try {
      const { error } = await apiFetch(`/api/live-classes/${id}`, {
        method: "DELETE",
      });
      if (error) {
        toast.error("ลบห้องเรียนสดไม่สำเร็จ: " + error);
        return;
      }
      setLiveClasses((prev) => prev.filter((lc) => lc.id !== id));
      toast.success("ลบห้องเรียนสดเรียบร้อยแล้ว");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error("เกิดข้อผิดพลาด: " + msg);
    }
  };

  const handleCreated = (newClass: LiveClassData) => {
    setLiveClasses((prev) => [newClass, ...prev]);
    fetchLiveClasses();
  };

  if (loadingData || loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || (role !== "teacher" && role !== "admin")) {
    return null;
  }

  const activeClasses = liveClasses.filter((c) => c.is_active);
  const scheduledClasses = liveClasses.filter((c) => !c.is_active);

  const classesByStatus =
    filter === "active"
      ? activeClasses
      : filter === "scheduled"
      ? scheduledClasses
      : liveClasses;
  const filteredClasses = selectedCourseId === "all"
    ? classesByStatus
    : classesByStatus.filter((liveClass) => liveClass.course_id === selectedCourseId);

  const courseOptions = Array.from(
    new Map(
      liveClasses.map((liveClass) => [
        liveClass.course_id,
        { id: liveClass.course_id, title: liveClass.course_title || "ไม่ระบุรายวิชา" },
      ])
    ).values()
  );

  const groupedClasses = Array.from(
    filteredClasses.reduce((groups, liveClass) => {
      const courseId = liveClass.course_id;
      const group = groups.get(courseId) || {
        id: courseId,
        title: liveClass.course_title || "ไม่ระบุรายวิชา",
        liveClasses: [],
      };
      group.liveClasses.push(liveClass);
      groups.set(courseId, group);
      return groups;
    }, new Map<string, { id: string; title: string; liveClasses: LiveClassData[] }>()).values()
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>
      <TeacherHeader
        tab="courses"
        setTab={(t) => {
          if (t === "dashboard") router.push("/teacher");
          if (t === "courses") router.push("/teacher");
        }}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        displayName={displayName}
        logout={logout}
        router={router}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn text-left">
        {/* Back Link & Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slideInUp">
          <div className="space-y-1">
            <button
              onClick={() => router.push("/teacher")}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 dark:text-indigo-400 hover:underline mb-2 group"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> กลับแดชบอร์ดครูผู้สอน
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-lg">
                <Radio className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  ระบบจัดการห้องเรียนสด (Live Classroom Console)
                </h1>
                <p className="text-xs sm:text-sm" style={{ color: tx.muted }}>
                  สร้างและควบคุมห้องเรียนออนไลน์ผ่าน Jitsi Meet พร้อมระบบซิงก์นักเรียนอัตโนมัติ
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => fetchLiveClasses(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              style={{ borderColor: tx.borderS, color: tx.secondary }}
            >
              <RefreshCw className={`h-3.5 w-3.5 text-indigo-500 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "กำลังอัปเดต..." : "รีเฟรช"}</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
            >
              <Plus className="h-4 w-4" /> สร้างห้องเรียนสดใหม่
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard
            icon={<Video className="h-6 w-6" />}
            label="ห้องเรียนสดทั้งหมดที่สร้าง"
            value={`${liveClasses.length} คาบเรียน`}
            accent="indigo"
            className="animate-slideInUp stagger-1"
          />
          <StatCard
            icon={<Radio className="h-6 w-6 text-red-500" />}
            label="กำลังเปิดสอนสด (Active)"
            value={`${activeClasses.length} ห้องเรียน`}
            accent="rose"
            className="animate-slideInUp stagger-2"
          />
          <StatCard
            icon={<Calendar className="h-6 w-6" />}
            label="ห้องเรียนที่รอสอน / กำหนดการ"
            value={`${scheduledClasses.length} คาบเรียน`}
            accent="purple"
            className="animate-slideInUp stagger-3"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-3" style={{ borderColor: tx.borderS }}>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === "all"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            ทั้งหมด ({liveClasses.length})
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filter === "active"
                ? "bg-red-600 text-white shadow-md"
                : "text-red-500 hover:bg-red-500/10"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            กำลังสอนสด ({activeClasses.length})
          </button>
          <button
            onClick={() => setFilter("scheduled")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === "scheduled"
                ? "bg-purple-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            ยังไม่เริ่ม / นัดหมาย ({scheduledClasses.length})
          </button>
          <label className="ml-0 sm:ml-auto flex items-center gap-2 text-xs font-bold" style={{ color: tx.secondary }}>
            <BookOpen className="h-4 w-4 text-indigo-500" />
            รายวิชา
            <select
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              className="min-w-48 rounded-xl border px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/40"
              style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}
            >
              <option value="all">ทุกวิชา ({courseOptions.length})</option>
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Live Classes Grid */}
        {filteredClasses.length === 0 ? (
          <EmptyState
            illustration="inbox"
            variant="hero"
            accent="rose"
            title={filter === "active" ? "ไม่มีห้องเรียนที่กำลังสอนสดอยู่ขณะนี้" : "ยังไม่มีรายการห้องเรียนสด"}
            description={
              filter === "active"
                ? "คุณสามารถกดเริ่มสอนสดจากรายการห้องเรียนด้านล่าง เพื่อเปิดห้องให้นักเรียนเข้าเรียนได้ทันที"
                : "เริ่มต้นสร้างห้องเรียนสดเพื่อสอนรายวิชาแบบเรียลไทม์ให้กับนักเรียนของคุณ"
            }
            action={
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95 flex items-center gap-2"
              >
                <Plus className="h-5 w-5" /> สร้างห้องเรียนสดแรก
              </button>
            }
          />
        ) : (
          <div className="space-y-8">
            {groupedClasses.map((group) => (
              <section key={group.id} className="space-y-4" aria-labelledby={`course-${group.id}`}>
                <div className="flex items-center justify-between gap-4 border-b pb-3" style={{ borderColor: tx.borderS }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 id={`course-${group.id}`} className="font-extrabold truncate" style={{ color: tx.primary }}>
                        {group.title}
                      </h2>
                      <p className="text-xs" style={{ color: tx.muted }}>ห้องเรียนสดของรายวิชานี้</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-500">
                    {group.liveClasses.length} ห้องเรียน
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.liveClasses.map((lc) => (
              <LiveClassCard
                key={lc.id}
                liveClass={lc}
                isTeacher={true}
                displayName={displayName || "อาจารย์"}
                onStart={handleStartClass}
                onEnd={handleEndClass}
                onDelete={handleDeleteClass}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Create Live Class Modal */}
      {showCreateModal && (
        <CreateLiveClassModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
          courses={teacherCourses}
        />
      )}

      {/* Footer */}
      <footer className="py-6 mt-12 border-t text-center text-xs" style={{ borderColor: tx.borderS, color: tx.faint }}>
        <p>© 2026 Math by Seng — Live Classroom Management System</p>
      </footer>
    </div>
  );
}
