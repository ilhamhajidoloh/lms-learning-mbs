import React, { useState, type FormEvent } from "react";
import { X, Video, Plus } from "lucide-react";
import { tx } from "../../lib/theme";
import type { Chapter, Topic } from "../../context/UserContext";
import { Portal } from "@/app/components/Portal";

interface AddLessonModalProps {
  setShowAddLessonModal: (show: boolean) => void;
  addLessonTitle: string;
  setAddLessonTitle: (v: string) => void;
  addLessonDescription: string;
  setAddLessonDescription: (v: string) => void;
  addLessonVideoUrl: string;
  setAddLessonVideoUrl: (v: string) => void;
  handleCreateLesson: (e: FormEvent, customTopicId?: string) => void;
  topics: Topic[];
  chapters: Chapter[];
  selectedCourseId: string | null;
  selectedTopicId: string;
  setSelectedTopicId: (id: string) => void;
  addChapter: (courseId: string, title: string) => Promise<{ success: boolean; id?: string; error?: string }>;
  addTopic: (chapterId: string, title: string) => Promise<{ success: boolean; id?: string; error?: string }>;
}

export function AddLessonModal({
  setShowAddLessonModal,
  addLessonTitle,
  setAddLessonTitle,
  addLessonDescription,
  setAddLessonDescription,
  addLessonVideoUrl,
  setAddLessonVideoUrl,
  handleCreateLesson,
  topics,
  chapters,
  selectedCourseId,
  selectedTopicId,
  setSelectedTopicId,
  addChapter,
  addTopic,
}: AddLessonModalProps) {
  // Filter topics and chapters by selected course
  const courseChapters = selectedCourseId
    ? chapters.filter(c => c.courseId === selectedCourseId)
    : [];

  const courseTopics = selectedCourseId
    ? topics.filter(t => {
        const chap = chapters.find(c => c.id === t.chapterId);
        return chap?.courseId === selectedCourseId;
      })
    : [];

  // Toggle for creating a new topic mode
  const [isNewTopicMode, setIsNewTopicMode] = useState<boolean>(courseTopics.length === 0);
  const [newTopicTitle, setNewTopicTitle] = useState<string>("");
  const selectedChapterId = courseChapters.length > 0 ? courseChapters[0].id : "";
  const [newChapterTitle, setNewChapterTitle] = useState<string>("หน่วยการเรียนรู้ที่ 1");
  const [isCreatingTopic, setIsCreatingTopic] = useState<boolean>(false);
  const [topicError, setTopicError] = useState<string>("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTopicError("");

    if (!selectedCourseId) {
      setTopicError("กรุณาเลือกคอร์สเรียนก่อน");
      return;
    }

    let finalTopicId = selectedTopicId;

    if (isNewTopicMode || !finalTopicId) {
      if (!newTopicTitle.trim()) {
        setTopicError("กรุณาระบุชื่อหัวข้อ / เรื่องใหม่");
        return;
      }

      setIsCreatingTopic(true);
      try {
        let chapId = selectedChapterId;

        // If no chapter exists or user entered a chapter title, create chapter first
        if (!chapId) {
          const chapRes = await addChapter(selectedCourseId, newChapterTitle.trim() || "หน่วยการเรียนรู้ที่ 1");
          if (!chapRes.success || !chapRes.id) {
            setTopicError(chapRes.error || "สร้างหน่วยเรียนไม่สำเร็จ");
            setIsCreatingTopic(false);
            return;
          }
          chapId = chapRes.id;
        }

        // Create the topic under chapter
        const topicRes = await addTopic(chapId, newTopicTitle.trim());
        if (!topicRes.success || !topicRes.id) {
          setTopicError(topicRes.error || "สร้างหัวข้อ/เรื่องไม่สำเร็จ");
          setIsCreatingTopic(false);
          return;
        }
        finalTopicId = topicRes.id;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error creating topic";
        setTopicError(message);
        setIsCreatingTopic(false);
        return;
      }
      setIsCreatingTopic(false);
    }

    if (!finalTopicId) {
      setTopicError("กรุณาเลือกหรือสร้างหัวข้อ / เรื่อง");
      return;
    }

    handleCreateLesson(e, finalTopicId);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
        <div className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
        <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
          <h3 className="text-xl font-bold">เพิ่มบทเรียนใหม่</h3>
          <button
            type="button"
            onClick={() => setShowAddLessonModal(false)}
            className="btn-icon p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-left space-y-4">
          <form id="addLessonForm" onSubmit={handleSubmit} className="space-y-4">
            {topicError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold">
                {topicError}
              </div>
            )}

            {/* Topic Selection / Creation Section */}
            <div className="space-y-2 p-4 rounded-2xl border" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                  หัวข้อ / เรื่อง <span className="text-rose-500">*</span>
                </label>
                {courseTopics.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewTopicMode(!isNewTopicMode);
                      setTopicError("");
                    }}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {isNewTopicMode ? (
                      <>เลือกหัวข้อที่มีอยู่</>
                    ) : (
                      <><Plus className="h-3.5 w-3.5" /> สร้างหัวข้อ/เรื่องใหม่</>
                    )}
                  </button>
                )}
              </div>

              {!isNewTopicMode && courseTopics.length > 0 ? (
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  required={!isNewTopicMode}
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: tx.border, color: tx.primary }}
                >
                  <option value="">-- เลือกหัวข้อ / เรื่องที่ต้องการเพิ่มบทเรียน --</option>
                  {courseTopics.map(topic => (
                    <option key={topic.id} value={topic.id}>{topic.title}</option>
                  ))}
                </select>
              ) : (
                <div className="space-y-3 pt-1">
                  {courseChapters.length === 0 && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold" style={{ color: tx.muted }}>ชื่อหน่วยเรียน (Chapter)</label>
                      <input
                        type="text"
                        value={newChapterTitle}
                        onChange={(e) => setNewChapterTitle(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                        style={{ borderColor: tx.border, color: tx.primary }}
                        placeholder="เช่น หน่วยการเรียนรู้ที่ 1: พีชคณิต"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold" style={{ color: tx.muted }}>ชื่อหัวข้อ / เรื่องใหม่ (Topic)</label>
                    <input
                      type="text"
                      value={newTopicTitle}
                      onChange={(e) => setNewTopicTitle(e.target.value)}
                      required={isNewTopicMode}
                      className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                      style={{ borderColor: tx.border, color: tx.primary }}
                      placeholder="เช่น เรื่องที่ 1.1 เซตและการดำเนินการ"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>หัวข้อบทเรียน <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={addLessonTitle}
                onChange={(e) => setAddLessonTitle(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                style={{ borderColor: tx.border, color: tx.primary }}
                placeholder="เช่น แคลคูลัสเบื้องต้น ตอนที่ 1"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>รายละเอียด / คำอธิบายบทเรียน</label>
              <textarea
                value={addLessonDescription}
                onChange={(e) => setAddLessonDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                style={{ borderColor: tx.border, color: tx.primary }}
                placeholder="ระบุเนื้อหาคร่าวๆ ของบทเรียนนี้..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: tx.muted }}>
                <Video className="h-3.5 w-3.5 text-red-500" />
                ลิงก์วิดีโอ YouTube (ไม่บังคับ)
              </label>
              <input
                type="url"
                value={addLessonVideoUrl}
                onChange={(e) => setAddLessonVideoUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 bg-transparent text-sm"
                style={{ borderColor: tx.border, color: tx.primary }}
                placeholder="https://www.youtube.com/watch?v=xxxxx"
              />
              <p className="text-[10px]" style={{ color: tx.faint }}>วางลิงก์ YouTube เพื่อให้นักเรียนสามารถดูวิดีโอในระบบได้</p>
            </div>
          </form>
        </div>

        <div className="p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <button
            type="button"
            onClick={() => setShowAddLessonModal(false)}
            className="btn-cancel py-2.5 px-5 rounded-xl font-bold text-sm cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            form="addLessonForm"
            disabled={isCreatingTopic}
            className="btn-primary py-2.5 px-6 rounded-xl text-sm shadow-md cursor-pointer disabled:opacity-50"
          >
            {isCreatingTopic ? "กำลังสร้างหัวข้อ..." : "เพิ่มบทเรียน"}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
