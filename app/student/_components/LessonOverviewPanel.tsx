import React, { useEffect } from "react";
import { tx } from "../../lib/theme";
import { extractYouTubeId } from "../../lib/youtube";
import type { Lesson } from "../../context/UserContext";
import { useUser } from "../../context/UserContext";
import { CheckCircle2, Lock } from "lucide-react";
import { toast } from "../../../lib/swal";

type StudyTabId = "overview" | "resources" | "tasks";

interface LessonOverviewPanelProps {
  activeLesson: Lesson;
  studyTab: StudyTabId;
  setStudyTab: React.Dispatch<React.SetStateAction<StudyTabId>>;
  hasTasks?: boolean;
  tasksCompleted?: boolean;
}

interface YTPlayerInstance {
  destroy?: () => void;
}

interface YTNamespace {
  Player: new (
    elementId: string,
    config: {
      events?: {
        onStateChange?: (event: { data: number }) => void;
      };
    }
  ) => YTPlayerInstance;
  PlayerState: {
    ENDED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function LessonOverviewPanel({ activeLesson, studyTab, setStudyTab, hasTasks = false, tasksCompleted = false }: LessonOverviewPanelProps) {
  const { completedLessonIds, toggleLessonComplete } = useUser();
  const isCompleted = hasTasks ? tasksCompleted : completedLessonIds.includes(activeLesson.id);

  const ytId = activeLesson.videoUrl ? extractYouTubeId(activeLesson.videoUrl) : null;

  useEffect(() => {
    if (!ytId) return;

    // Load the YouTube Iframe API if not loaded
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    let player: YTPlayerInstance | null = null;

    const initPlayer = () => {
      const playerEl = document.getElementById(`yt-player-${activeLesson.id}`);
      if (!playerEl || !window.YT) return;
      player = new window.YT.Player(`yt-player-${activeLesson.id}`, {
        events: {
          onStateChange: (event: { data: number }) => {
            // YT.PlayerState.ENDED is 0
            if (window.YT && event.data === window.YT.PlayerState.ENDED) {
              if (!isCompleted && !hasTasks) {
                toggleLessonComplete(activeLesson.id, true);
                toast.success("ยินดีด้วย! คุณเรียนจบบทเรียนนี้แล้วและระบบได้บันทึกความคืบหน้าให้แล้วครับ");
              }
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const previousOnReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previousOnReady) previousOnReady();
        initPlayer();
      };
    }

    return () => {
      if (player && typeof player.destroy === "function") {
        player.destroy();
      }
    };
  }, [ytId, activeLesson.id, isCompleted, hasTasks, toggleLessonComplete]);

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4 animate-slideInUp">
        <h2 className="text-lg md:text-xl font-extrabold">{activeLesson.title}</h2>
        {hasTasks ? (
          <div
            className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[11px] md:text-xs font-bold shadow-sm border ${
              isCompleted
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-400"
            }`}
            title={isCompleted ? "ส่งงานเรียบร้อยแล้ว" : "ต้องส่งงานหรือทำควิซในบทเรียนนี้ก่อน"}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-emerald-500 animate-scaleIn" />
                <span className="hidden sm:inline">เรียนเสร็จแล้ว (ทำภาระงานครบ)</span>
                <span className="sm:hidden">เสร็จแล้ว</span>
              </>
            ) : (
              <>
                <Lock className="h-3 w-3 md:h-3.5 md:w-3.5 text-amber-500" />
                <span className="hidden sm:inline">ต้องส่งงาน / ทำควิซในบทนี้ก่อน</span>
                <span className="sm:hidden">ต้องส่งงาน</span>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              toggleLessonComplete(activeLesson.id, !isCompleted);
              if (!isCompleted) {
                toast.success("บันทึกว่าเรียนบทเรียนนี้แล้ว!");
              }
            }}
            className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[11px] md:text-xs font-bold transition-all active:scale-95 shadow-sm border ${
              isCompleted
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "bg-indigo-50/70 hover:bg-indigo-100 text-indigo-600 border-indigo-500/10 dark:bg-indigo-950/30 dark:text-indigo-400"
            }`}
          >
            <CheckCircle2 className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isCompleted ? "text-emerald-500 animate-scaleIn" : ""}`} />
            <span className="hidden sm:inline">{isCompleted ? "เรียนเสร็จแล้ว" : "ทำเครื่องหมายว่าเรียนแล้ว"}</span>
            <span className="sm:hidden">{isCompleted ? "เรียนแล้ว" : "ทำเครื่องหมาย"}</span>
          </button>
        )}
      </div>

      {/* Video player embedded */}
      {ytId ? (
        <div className="aspect-video w-full rounded-xl md:rounded-2xl overflow-hidden shadow-lg border relative group/video" style={{ borderColor: tx.borderS }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover/video:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />
          <iframe
            id={`yt-player-${activeLesson.id}`}
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${ytId}?enablejsapi=1&rel=0`}
            title={activeLesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        activeLesson.videoUrl && (
          <div className="p-3 md:p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs animate-slideInUp">
            ลิงก์ภายนอก: <a href={activeLesson.videoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline break-all hover:text-indigo-600 transition-colors">{activeLesson.videoUrl}</a>
          </div>
        )
      )}

      {/* Subtabs selection */}
      <div className="flex space-x-4 md:space-x-6 border-b pb-2 pt-2 overflow-x-auto" style={{ borderColor: tx.borderS }}>
        <button onClick={() => setStudyTab("overview")}
          className="text-[11px] md:text-xs font-bold pb-2 border-b-2 transition-all duration-200 px-1 active:scale-95 whitespace-nowrap"
          style={studyTab === "overview" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          <span className="hidden sm:inline">รายละเอียดบทเรียน (Overview)</span>
          <span className="sm:hidden">รายละเอียด</span>
        </button>
        <button onClick={() => setStudyTab("tasks")}
          className="text-[11px] md:text-xs font-bold pb-2 border-b-2 transition-all duration-200 px-1 active:scale-95 whitespace-nowrap"
          style={studyTab === "tasks" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          <span className="hidden sm:inline">งาน & ควิซแบบทดสอบ (Tasks)</span>
          <span className="sm:hidden">งาน & ควิซ</span>
        </button>
      </div>

      {/* Tab contents */}
      {studyTab === "overview" && (
        <div className="text-sm py-2 leading-relaxed space-y-2 animate-fadeIn">
          <p className="font-bold text-xs uppercase tracking-wide" style={{ color: tx.muted }}>คำชี้แจง / รายละเอียด:</p>
          <p style={{ color: tx.secondary }} className="whitespace-pre-line text-xs sm:text-sm">{activeLesson.description || "ไม่มีรายละเอียดประกอบหัวข้อเรียนนี้"}</p>
        </div>
      )}
    </>
  );
}
