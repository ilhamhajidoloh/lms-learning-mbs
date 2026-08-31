"use client";

import React from "react";
import { Calendar, Clock, User, Users, Play, Power, Trash2 } from "lucide-react";
import { tx } from "../lib/theme";
import { JoinLiveClassButton } from "./JoinLiveClassButton";

export interface LiveClassData {
  id: string;
  course_id: string;
  course_title?: string;
  lesson_id?: string | null;
  room_name: string;
  title: string;
  description?: string | null;
  scheduled_at?: string | null;
  duration_minutes: number;
  host_id: string;
  host_name?: string;
  is_active: boolean;
  participant_count?: number;
  created_at?: string;
}

interface LiveClassCardProps {
  liveClass: LiveClassData;
  isTeacher?: boolean;
  displayName?: string;
  onStart?: (id: string) => void;
  onEnd?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function LiveClassCard({
  liveClass,
  isTeacher = false,
  displayName = "ผู้ใช้งาน",
  onStart,
  onEnd,
  onDelete,
}: LiveClassCardProps) {
  const formattedDate = liveClass.scheduled_at
    ? new Date(liveClass.scheduled_at).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "ไม่ระบุเวลา";

  return (
    <div
      className={`rounded-3xl p-6 border transition-all duration-300 shadow-md flex flex-col justify-between relative overflow-hidden ${
        liveClass.is_active
          ? "border-red-500/50 bg-gradient-to-br from-red-950/20 via-slate-900/40 to-slate-950 shadow-red-500/10"
          : "hover:shadow-lg"
      }`}
      style={{
        backgroundColor: liveClass.is_active ? undefined : tx.surface,
        borderColor: liveClass.is_active ? undefined : tx.borderS,
      }}
    >
      {/* Active Ambient Glow */}
      {liveClass.is_active && (
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-red-500/20 rounded-full blur-2xl pointer-events-none" />
      )}

      {/* Header Info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          {liveClass.is_active ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-500 text-xs font-black animate-pulse">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              🔴 กำลังสอนสดอยู่ตอนนี้
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold">
              <Clock className="h-3.5 w-3.5" />
              {liveClass.duration_minutes} นาที
            </div>
          )}

          {isTeacher && onDelete && (
            <button
              onClick={() => onDelete(liveClass.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="ลบห้องเรียนสดนี้"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div>
          {liveClass.course_title && (
            <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-500 mb-1 truncate">
              {liveClass.course_title}
            </p>
          )}
          <h3 className="text-lg font-black tracking-tight line-clamp-2" style={{ color: tx.primary }}>
            {liveClass.title}
          </h3>
          {liveClass.description && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: tx.muted }}>
              {liveClass.description}
            </p>
          )}
        </div>
      </div>

      {/* Meta details */}
      <div className="mt-5 pt-4 border-t space-y-3" style={{ borderColor: tx.borderS }}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: tx.secondary }}>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-indigo-500" />
            <span>{formattedDate}</span>
          </div>

          {liveClass.host_name && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-amber-500" />
              <span>ครู {liveClass.host_name}</span>
            </div>
          )}
        </div>

        {liveClass.participant_count !== undefined && (
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: tx.muted }}>
            <Users className="h-3.5 w-3.5" />
            <span>ผู้เข้าร่วมทั้งหมด {liveClass.participant_count} คน</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-2">
          {/* Join button */}
          <JoinLiveClassButton
            liveClassId={liveClass.id}
            roomName={liveClass.room_name}
            displayName={displayName}
            isActive={liveClass.is_active}
            isModerator={isTeacher}
            size="md"
            className="flex-1"
          />

          {/* Teacher start/end controls */}
          {isTeacher && (
            <>
              {liveClass.is_active ? (
                <button
                  type="button"
                  onClick={() => onEnd?.(liveClass.id)}
                  className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 font-bold text-xs transition-all active:scale-95"
                  title="ปิดห้องเรียนสด"
                >
                  <Power className="h-4 w-4" />
                  ปิดห้อง
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onStart?.(liveClass.id)}
                  className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all active:scale-95"
                  title="เริ่มห้องเรียนสด"
                >
                  <Play className="h-4 w-4" />
                  เริ่มสอนสด
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveClassCard;

