import React, { useEffect } from "react";
import { tx } from "../../lib/theme";
import { extractYouTubeId } from "../../lib/youtube";
import type { Lesson } from "../../context/UserContext";
import { useUser } from "../../context/UserContext";
import { CheckCircle2 } from "lucide-react";
import { toast } from "../../../lib/swal";

type StudyTabId = "overview" | "resources" | "tasks";

interface LessonOverviewPanelProps {
  activeLesson: Lesson;
  studyTab: StudyTabId;
  setStudyTab: React.Dispatch<React.SetStateAction<StudyTabId>>;
}

export function LessonOverviewPanel({ activeLesson, studyTab, setStudyTab }: LessonOverviewPanelProps) {
  const { completedLessonIds, toggleLessonComplete } = useUser();
  const isCompleted = completedLessonIds.includes(activeLesson.id);

  const ytId = activeLesson.videoUrl ? extractYouTubeId(activeLesson.videoUrl) : null;

  useEffect(() => {
    if (!ytId) return;

    // Load the YouTube Iframe API if not loaded
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    let player: any;

    const initPlayer = () => {
      const playerEl = document.getElementById(`yt-player-${activeLesson.id}`);
      if (!playerEl) return;
      player = new (window as any).YT.Player(`yt-player-${activeLesson.id}`, {
        events: {
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED is 0
            if (event.data === (window as any).YT.PlayerState.ENDED) {
              if (!isCompleted) {
                toggleLessonComplete(activeLesson.id, true);
                toast.success("ยินดีด้วย! คุณเรียนจบบทเรียนนี้แล้วและระบบได้บันทึกความคืบหน้าให้แล้วครับ");
              }
            }
          },
        },
      });
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
    } else {
      const previousOnReady = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (previousOnReady) previousOnReady();
        initPlayer();
      };
    }

    return () => {
      if (player && typeof player.destroy === "function") {
        player.destroy();
      }
    };
  }, [ytId, activeLesson.id, isCompleted]);

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-slideInUp">
        <h2 className="text-xl font-extrabold">{activeLesson.title}</h2>
        <button
          onClick={() => {
            toggleLessonComplete(activeLesson.id, !isCompleted);
            if (!isCompleted) {
              toast.success("บันทึกว่าเรียนบทเรียนนี้แล้ว!");
            }
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm border ${
            isCompleted
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-400"
              : "bg-indigo-50/70 hover:bg-indigo-100 text-indigo-600 border-indigo-500/10 dark:bg-indigo-950/30 dark:text-indigo-400"
          }`}
        >
          <CheckCircle2 className={`h-4 w-4 ${isCompleted ? "text-emerald-500 animate-scaleIn" : ""}`} />
          {isCompleted ? "เรียนเสร็จแล้ว" : "ทำเครื่องหมายว่าเรียนแล้ว"}
        </button>
      </div>

      {/* Video player embedded */}
      {ytId ? (
        <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-lg border relative group/video" style={{ borderColor: tx.borderS }}>
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
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs animate-slideInUp">
            ลิงก์ภายนอก: <a href={activeLesson.videoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline break-all hover:text-indigo-600 transition-colors">{activeLesson.videoUrl}</a>
          </div>
        )
      )}

      {/* Subtabs selection */}
      <div className="flex space-x-6 border-b pb-2 pt-2" style={{ borderColor: tx.borderS }}>
        <button onClick={() => setStudyTab("overview")}
          className="text-xs font-bold pb-2 border-b-2 transition-all duration-200 px-1 active:scale-95"
          style={studyTab === "overview" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          รายละเอียดบทเรียน (Overview)
        </button>
        <button onClick={() => setStudyTab("tasks")}
          className="text-xs font-bold pb-2 border-b-2 transition-all duration-200 px-1 active:scale-95"
          style={studyTab === "tasks" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          งาน & ควิซแบบทดสอบ (Tasks)
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
