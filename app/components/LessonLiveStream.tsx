"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface LessonLiveStreamProps {
  lessonId: string;
  lessonTitle: string;
}

interface Broadcast {
  is_live: boolean;
  youtube_video_id: string | null;
}

export function LessonLiveStream({ lessonId, lessonTitle }: LessonLiveStreamProps) {
  const [isLive, setIsLive] = useState(false);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await apiFetch<{ broadcast: Broadcast }>(`/api/lesson-live?lesson_id=${encodeURIComponent(lessonId)}`);
    setIsLive(data?.broadcast.is_live === true);
    setYoutubeVideoId(data?.broadcast.youtube_video_id ?? null);
    setLoading(false);
  }, [lessonId]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh]);

  if (loading || !isLive) return null;

  if (!youtubeVideoId) {
    return (
      <div className="rounded-xl border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        ไลฟ์บทนี้ยังไม่มีลิงก์ YouTube สำหรับรับชม กรุณาแจ้งผู้สอนให้ปิดและเปิดไลฟ์ใหม่พร้อมลิงก์ไลฟ์
      </div>
    );
  }

  return (
    <section className="space-y-3" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-xs font-extrabold text-red-600 dark:text-red-400">
          <Radio className="h-4 w-4 animate-pulse" /> ถ่ายทอดสดอยู่: {lessonTitle}
        </div>
        <button type="button" onClick={refresh} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="ตรวจสอบสถานะไลฟ์อีกครั้ง">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-lg">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeVideoId)}?autoplay=1&rel=0`}
          title={`ไลฟ์สอน: ${lessonTitle}`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    </section>
  );
}
