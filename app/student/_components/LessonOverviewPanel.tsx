import React from "react";
import { tx } from "../../lib/theme";
import { extractYouTubeId } from "../../lib/youtube";
import type { Lesson } from "../../context/UserContext";

type StudyTabId = "overview" | "resources" | "tasks";

interface LessonOverviewPanelProps {
  activeLesson: Lesson;
  studyTab: StudyTabId;
  setStudyTab: React.Dispatch<React.SetStateAction<StudyTabId>>;
}

export function LessonOverviewPanel({ activeLesson, studyTab, setStudyTab }: LessonOverviewPanelProps) {
  const ytId = activeLesson.videoUrl ? extractYouTubeId(activeLesson.videoUrl) : null;

  return (
    <>
      <h2 className="text-xl font-extrabold">{activeLesson.title}</h2>

      {/* Video player embedded */}
      {ytId ? (
        <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-lg border relative" style={{ borderColor: tx.borderS }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${ytId}?rel=0`}
            title={activeLesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        activeLesson.videoUrl && (
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs">
            ลิงก์ภายนอก: <a href={activeLesson.videoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline break-all">{activeLesson.videoUrl}</a>
          </div>
        )
      )}

      {/* Subtabs selection */}
      <div className="flex space-x-6 border-b pb-2 pt-2" style={{ borderColor: tx.borderS }}>
        <button onClick={() => setStudyTab("overview")} className="text-xs font-bold pb-2 border-b-2 transition-all px-1"
          style={studyTab === "overview" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          รายละเอียดบทเรียน (Overview)
        </button>
        <button onClick={() => setStudyTab("tasks")} className="text-xs font-bold pb-2 border-b-2 transition-all px-1"
          style={studyTab === "tasks" ? { borderBottomColor: tx.accent, color: tx.accent } : { borderBottomColor: "transparent", color: tx.secondary }}>
          งาน & ควิซแบบทดสอบ (Tasks)
        </button>
      </div>

      {/* Tab contents */}
      {studyTab === "overview" && (
        <div className="text-sm py-2 leading-relaxed space-y-2">
          <p className="font-bold text-xs uppercase tracking-wide" style={{ color: tx.muted }}>คำชี้แจง / รายละเอียด:</p>
          <p style={{ color: tx.secondary }} className="whitespace-pre-line text-xs sm:text-sm">{activeLesson.description || "ไม่มีรายละเอียดประกอบหัวข้อเรียนนี้"}</p>
        </div>
      )}
    </>
  );
}
