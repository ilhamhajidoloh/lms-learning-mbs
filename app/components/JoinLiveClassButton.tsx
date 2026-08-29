"use client";

import React, { useState } from "react";
import { Video, Loader2 } from "lucide-react";
import { generateJitsiUrl } from "@/lib/jitsi";
import { apiFetch } from "@/lib/api";

interface JoinLiveClassButtonProps {
  liveClassId: string;
  roomName: string;
  displayName: string;
  isActive?: boolean;
  isModerator?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: React.ReactNode;
}

export function JoinLiveClassButton({
  liveClassId,
  roomName,
  displayName,
  isActive = false,
  isModerator = false,
  size = "md",
  className = "",
  children,
}: JoinLiveClassButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);

    try {
      // 1. Record participant attendance
      await apiFetch(`/api/live-classes/${liveClassId}/join`, {
        method: "POST",
      });
    } catch (err) {
      console.warn("Failed to log attendance:", err);
    } finally {
      // 2. Generate direct Jitsi URL with auto-filled display name, role & bypassed prejoin
      const jitsiUrl = generateJitsiUrl(roomName, displayName || "ผู้เรียน", isModerator);

      // 3. Open in new tab/window for 100% native camera/audio experience
      window.open(jitsiUrl, "_blank");
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: "px-3.5 py-1.5 text-xs rounded-xl gap-1.5",
    md: "px-5 py-2.5 text-xs rounded-xl gap-2",
    lg: "px-7 py-3.5 text-sm rounded-2xl gap-2 font-black shadow-lg shadow-red-500/30 animate-pulseGlow",
  }[size];

  return (
    <button
      type="button"
      onClick={handleJoin}
      disabled={loading}
      className={`font-bold transition-all active:scale-95 flex items-center justify-center cursor-pointer text-white ${
        isActive
          ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-md shadow-red-500/20"
          : "bg-indigo-600 hover:bg-indigo-500 shadow-md"
      } ${sizeClasses} ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Video className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      )}
      {children || (isActive ? "เข้าห้องเรียนทันที 🔴" : "เข้าสู่ห้องเรียน")}
    </button>
  );
}

export default JoinLiveClassButton;

