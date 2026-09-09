"use client";

import { useState } from "react";
import { Radio, Square } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { alert, toast } from "@/lib/swal";
import Swal from "sweetalert2";

interface LessonBroadcastButtonProps {
  lessonId: string;
  lessonTitle: string;
  disabled?: boolean;
}

function getYouTubeVideoId(value: string): string | null {
  const input = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    const id = url.hostname.includes("youtu.be")
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") ?? url.pathname.match(/\/(?:embed|live)\/([A-Za-z0-9_-]{11})/)?.[1];
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Opens or closes the single OBS/YouTube broadcast for one lesson. */
export function LessonBroadcastButton({ lessonId, lessonTitle, disabled = false }: LessonBroadcastButtonProps) {
  const [isLive, setIsLive] = useState(false);
  const [saving, setSaving] = useState(false);

  const changeStatus = async () => {
    const nextIsLive = !isLive;
    let youtubeVideoId: string | undefined;
    if (nextIsLive) {
      const linkResult = await Swal.fire({
        icon: "question",
        title: `เปิดไลฟ์สำหรับ “${lessonTitle}”`,
        text: "วางลิงก์ Share ของ YouTube Live แบบไม่เป็นสาธารณะ ระบบจะแสดงเฉพาะในบทเรียนนี้",
        input: "url",
        inputPlaceholder: "https://www.youtube.com/watch?v=...",
        showCancelButton: true,
        confirmButtonText: "เปิดไลฟ์",
        cancelButtonText: "ยกเลิก",
        preConfirm: (value) => {
          const id = getYouTubeVideoId(value);
          if (!id) Swal.showValidationMessage("กรุณาวางลิงก์ YouTube Live ที่ถูกต้อง");
          return id;
        },
      });
      if (!linkResult.isConfirmed || !linkResult.value) return;
      youtubeVideoId = linkResult.value;
      const confirmed = await alert.confirm(
        `เริ่มถ่ายทอดสดในบทเรียน "${lessonTitle}"?`,
        "หากมีบทเรียนอื่นกำลังไลฟ์อยู่ ระบบจะปิดสถานะของบทเรียนนั้นให้โดยอัตโนมัติ"
      );
      if (!confirmed) return;
    }

    setSaving(true);
    const { error } = await apiFetch("/api/lesson-live", {
      method: "PUT",
      body: JSON.stringify({ lessonId, isLive: nextIsLive, youtubeVideoId }),
    });
    setSaving(false);

    if (error) {
      toast.error(error);
      return;
    }

    setIsLive(nextIsLive);
    toast.success(
      nextIsLive
        ? "เปิดไลฟ์สำหรับบทนี้แล้ว — จากนั้นกด Start Streaming ใน OBS"
        : "ปิดสถานะไลฟ์ของบทนี้แล้ว"
    );
  };

  return (
    <button
      type="button"
      onClick={changeStatus}
      disabled={disabled || saving}
      title={disabled ? "ต้องเผยแพร่บทเรียนก่อนจึงจะเปิดไลฟ์ได้" : undefined}
      className={`p-1.5 rounded-lg border text-[10px] md:text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        isLive
          ? "border-red-500/40 bg-red-500 text-white"
          : "border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
      }`}
    >
      {isLive ? <Square className="h-3 w-3 md:h-3.5 md:w-3.5" /> : <Radio className="h-3 w-3 md:h-3.5 md:w-3.5" />}
      <span className="hidden sm:inline">{isLive ? "ปิดไลฟ์" : "ไลฟ์บทนี้"}</span>
    </button>
  );
}
