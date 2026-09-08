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
}

export function LessonLiveStream({ lessonId, lessonTitle }: LessonLiveStreamProps) {
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const channelId = process.env.NEXT_PUBLIC_YOUTUBE_CHANNEL_ID;

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await apiFetch<{ broadcast: Broadcast }>(`/api/lesson-live?lesson_id=${encodeURIComponent(lessonId)}`);
    setIsLive(data?.broadcast.is_live === true);
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

  if (!channelId) {
    return (
      <div className="rounded-xl border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        ไลฟ์ของบทนี้กำลังเริ่มแล้ว แต่ยังไม่ได้ตั้งค่า YouTube Channel ID
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
          src={`https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(channelId)}&autoplay=1&rel=0`}
          title={`ไลฟ์สอน: ${lessonTitle}`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    </section>
  );
}
