import React, { useState } from "react";
import { Plus, Video, Edit2, Trash2, FolderPlus, BookOpen, Layers, ChevronDown, ChevronRight, Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import { tx, card } from "@/app/lib/theme";
import { alert } from "@/lib/swal";
import { useUser, type Chapter, type Lesson, type Topic } from "@/app/context/UserContext";

interface LessonsPanelProps {
  lessons: Lesson[];
  chapters: Chapter[];
  topics: Topic[];
  courseId: string;
  setShowAddLessonModal: (show: boolean) => void;
  setEditingLesson: (lesson: Lesson | null) => void;
  setEditLessonTitle: (v: string) => void;
  setEditLessonDescription: (v: string) => void;
  setEditLessonVideoUrl: (v: string) => void;
}

export function LessonsPanel({
  lessons,
  chapters,
  topics,
  courseId,
  setShowAddLessonModal,
  setEditingLesson,
  setEditLessonTitle,
  setEditLessonDescription,
  setEditLessonVideoUrl,
}: LessonsPanelProps) {
  const {
    addChapter,
    updateChapter,
    deleteChapter,
    addTopic,
    updateTopic,
    deleteTopic,
    deleteLesson,
    toggleLessonPublished,
    toggleLessonLocked,
  } = useUser();

  // State for modals / inline editing
  const [showAddChapterModal, setShowAddChapterModal] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState("");

  const [addingTopicChapterId, setAddingTopicChapterId] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState("");

  // Collapsible state for chapters
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});

  const toggleChapterCollapse = (chapId: string) => {
    setCollapsedChapters((prev) => ({ ...prev, [chapId]: !prev[chapId] }));
  };

  // Filter chapters for this course
  const courseChapters = chapters.filter((c) => c.courseId === courseId);

  // Unassigned lessons or direct course lessons
  const allCourseTopics = topics.filter((t) =>
    chapters.some((c) => c.id === t.chapterId && c.courseId === courseId)
  );

  const courseLessons = lessons.filter((l) =>
    allCourseTopics.some((t) => t.id === l.topicId)
  );

  // Handlers for Chapter
  const handleAddChapterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim()) return;
    const res = await addChapter(courseId, newChapterTitle.trim());
    if (res.success) {
      setNewChapterTitle("");
      setShowAddChapterModal(false);
    }
  };

  const handleUpdateChapterSubmit = async (chapId: string) => {
    if (!editChapterTitle.trim()) return;
    const res = await updateChapter(chapId, editChapterTitle.trim());
    if (res.success) {
      setEditingChapterId(null);
    }
  };

  const handleDeleteChapter = async (chapId: string, chapTitle: string) => {
    const confirmed = await alert.confirm(
      `ยืนยันการลบหน่วยเรียน "${chapTitle}"?`,
      "หัวข้อ/เรื่อง และบทเรียนทั้งหมดภายใต้หน่วยนี้จะถูกลบออกด้วย"
    );
    if (confirmed) {
      await deleteChapter(chapId);
    }
  };

  // Handlers for Topic
  const handleAddTopicSubmit = async (chapId: string) => {
    if (!newTopicTitle.trim()) return;
    const res = await addTopic(chapId, newTopicTitle.trim());
    if (res.success) {
      setNewTopicTitle("");
      setAddingTopicChapterId(null);
    }
  };

  const handleUpdateTopicSubmit = async (topicId: string) => {
    if (!editTopicTitle.trim()) return;
    const res = await updateTopic(topicId, editTopicTitle.trim());
    if (res.success) {
      setEditingTopicId(null);
    }
  };

  const handleDeleteTopic = async (topicId: string, topicTitle: string) => {
    const confirmed = await alert.confirm(
      `ยืนยันการลบเรื่อง "${topicTitle}"?`,
      "บทเรียนทั้งหมดภายใต้เรื่องนี้จะถูกลบออกด้วย"
    );
    if (confirmed) {
      await deleteTopic(topicId);
    }
  };

  // Handlers for Lesson
  const handleDeleteLesson = async (lessonId: string, lessonTitle: string) => {
    const confirmed = await alert.confirm(`ยืนยันการลบบทเรียน "${lessonTitle}"?`);
    if (confirmed) {
      await deleteLesson(lessonId);
    }
  };

  return (
    <div className="rounded-3xl p-6 shadow-sm border space-y-6" style={card.style}>
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-3" style={{ borderColor: tx.borderS }}>
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            โครงสร้างบทเรียนหลักสูตร
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {courseChapters.length} หน่วยเรียน
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
              {courseLessons.length} บทเรียน
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddChapterModal(true)}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FolderPlus className="h-4 w-4" /> + เพิ่มหน่วยเรียน (Chapter)
          </button>
          <button
            type="button"
            onClick={() => setShowAddLessonModal(true)}
            className="btn-primary px-4 py-2 text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> เพิ่มบทเรียนใหม่
          </button>
        </div>
      </div>

      {/* Chapters Tree List */}
      {courseChapters.length === 0 ? (
        <div className="p-10 text-center rounded-2xl border border-dashed space-y-3" style={{ borderColor: tx.border }}>
          <Layers className="h-10 w-10 mx-auto text-slate-400" />
          <p className="text-sm font-semibold" style={{ color: tx.muted }}>
            ยังไม่มีหน่วยเรียนในหลักสูตรนี้
          </p>
          <button
            type="button"
            onClick={() => setShowAddChapterModal(true)}
            className="btn-primary px-4 py-2 text-xs rounded-xl cursor-pointer"
          >
            + สร้างหน่วยเรียนแรก
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {courseChapters.map((chap, chapIdx) => {
            const chapTopics = topics.filter((t) => t.chapterId === chap.id);
            const isCollapsed = collapsedChapters[chap.id];

            return (
              <div
                key={chap.id}
                className="rounded-2xl border overflow-hidden transition-all shadow-sm"
                style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}
              >
                {/* Chapter Header */}
                <div
                  className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b"
                  style={{ backgroundColor: tx.elevated, borderColor: tx.borderS }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleChapterCollapse(chap.id)}
                      className="p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/40 text-slate-500 cursor-pointer"
                    >
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {editingChapterId === chap.id ? (
                      <div className="flex items-center gap-2 flex-1 max-w-md">
                        <input
                          type="text"
                          value={editChapterTitle}
                          onChange={(e) => setEditChapterTitle(e.target.value)}
                          className="px-3 py-1.5 rounded-lg border text-sm font-bold w-full bg-transparent"
                          style={{ borderColor: tx.border }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateChapterSubmit(chap.id)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingChapterId(null)}
                          className="px-2 py-1.5 text-xs text-slate-400 cursor-pointer"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          หน่วยที่ {chapIdx + 1}
                        </span>
                        <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 truncate">
                          {chap.title}
                        </h4>
                      </div>
                    )}
                  </div>

                  {/* Chapter Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setAddingTopicChapterId(addingTopicChapterId === chap.id ? null : chap.id);
                        setNewTopicTitle("");
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 cursor-pointer flex items-center gap-1"
                      title="เพิ่มเรื่องย่อย"
                    >
                      <Plus className="h-3.5 w-3.5" /> เพิ่มเรื่อง
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingChapterId(chap.id);
                        setEditChapterTitle(chap.title);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="แก้ไขชื่อหน่วยเรียน"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteChapter(chap.id, chap.title)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="ลบหน่วยเรียน"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Add Topic Form */}
                {addingTopicChapterId === chap.id && (
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border-b flex items-center gap-2" style={{ borderColor: tx.borderS }}>
                    <input
                      type="text"
                      value={newTopicTitle}
                      onChange={(e) => setNewTopicTitle(e.target.value)}
                      placeholder="ระบุชื่อหัวข้อ / เรื่องย่อย..."
                      className="px-3 py-1.5 rounded-xl border text-xs flex-1 bg-transparent"
                      style={{ borderColor: tx.border }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTopicSubmit(chap.id)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      เพิ่มเรื่อง
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingTopicChapterId(null)}
                      className="px-2 py-1.5 text-xs text-slate-400 cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                )}

                {/* Chapter Body (Topics & Lessons) */}
                {!isCollapsed && (
                  <div className="p-4 space-y-4">
                    {chapTopics.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-2">
                        ยังไม่มีหัวข้อ/เรื่องในหน่วยนี้ (กด &ldquo;+ เพิ่มเรื่อง&rdquo; ด้านบนเพื่อเพิ่ม)
                      </p>
                    ) : (
                      chapTopics.map((top, topIdx) => {
                        const topicLessons = lessons.filter((l) => l.topicId === top.id);

                        return (
                          <div key={top.id} className="space-y-2 border-l-2 border-indigo-500/30 pl-3 sm:pl-4">
                            {/* Topic Sub-header */}
                            <div className="flex items-center justify-between gap-2 py-1">
                              {editingTopicId === top.id ? (
                                <div className="flex items-center gap-2 flex-1 max-w-md">
                                  <input
                                    type="text"
                                    value={editTopicTitle}
                                    onChange={(e) => setEditTopicTitle(e.target.value)}
                                    className="px-3 py-1 rounded-lg border text-xs font-bold w-full bg-transparent"
                                    style={{ borderColor: tx.border }}
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateTopicSubmit(top.id)}
                                    className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                                  >
                                    บันทึก
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingTopicId(null)}
                                    className="px-2 py-1 text-xs text-slate-400 cursor-pointer"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                    เรื่องที่ {chapIdx + 1}.{topIdx + 1}
                                  </span>
                                  <h5 className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">
                                    {top.title}
                                  </h5>
                                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    {topicLessons.length} บทเรียน
                                  </span>
                                </div>
                              )}

                              {/* Topic Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddLessonModal(true);
                                  }}
                                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-0.5 cursor-pointer"
                                >
                                  + บทเรียน
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTopicId(top.id);
                                    setEditTopicTitle(top.title);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-indigo-500 cursor-pointer"
                                  title="แก้ไขชื่อเรื่อง"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTopic(top.id, top.title)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                                  title="ลบเรื่อง"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {/* Topic Lessons List */}
                            <div className="space-y-2 pt-1">
                              {topicLessons.length === 0 ? (
                                <div className="p-3 rounded-xl border border-dashed text-left text-xs text-slate-400 italic">
                                  ยังไม่มีบทเรียนย่อยในเรื่องนี้
                                </div>
                              ) : (
                                topicLessons.map((l) => {
                                  const isPub = l.isPublished !== false;
                                  const isLocked = l.isLocked === true;
                                  return (
                                    <div
                                      key={l.id}
                                      className={`p-3.5 rounded-xl border text-left flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-all ${
                                        isPub ? "hover:border-indigo-500/30" : "opacity-60 bg-slate-50 dark:bg-slate-900/50"
                                      }`}
                                      style={{ borderColor: tx.borderS, backgroundColor: isPub ? tx.surface : undefined }}
                                    >
                                      <div className="space-y-1 flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h6 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                                            {l.title}
                                          </h6>
                                          {!isPub && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                              ซ่อนอยู่
                                            </span>
                                          )}
                                          {isLocked && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                              ล็อกอยู่
                                            </span>
                                          )}
                                        </div>
                                        {l.description && (
                                          <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: tx.muted }}>
                                            {l.description}
                                          </p>
                                        )}
                                        {l.videoUrl && (
                                          <div className="flex items-center gap-1.5 mt-1">
                                            <Video className="h-3 w-3 text-red-500 shrink-0" />
                                            <span className="text-[10px] font-mono truncate max-w-[250px]" style={{ color: tx.faint }}>
                                              {l.videoUrl}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Lesson Control Actions */}
                                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                        <button
                                          type="button"
                                          onClick={() => toggleLessonLocked(l.id, !isLocked)}
                                          className={`p-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                            isLocked
                                              ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                              : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400"
                                          }`}
                                          title={isLocked ? "คลิกเพื่อปลดล็อกบทเรียน" : "คลิกเพื่อล็อกบทเรียน (นักเรียนจะเข้าดูไม่ได้)"}
                                        >
                                          {isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                                          <span className="hidden sm:inline">{isLocked ? "ล็อกอยู่" : "ล็อก"}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleLessonPublished(l.id, !isPub)}
                                          className={`p-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                            isPub
                                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                              : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400"
                                          }`}
                                          title={isPub ? "คลิกเพื่อซ่อนบทเรียน" : "คลิกเพื่อเปิดให้มองเห็น"}
                                        >
                                          {isPub ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                          <span className="hidden sm:inline">{isPub ? "เปิดอยู่" : "ซ่อน"}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingLesson(l);
                                            setEditLessonTitle(l.title);
                                            setEditLessonDescription(l.description);
                                            setEditLessonVideoUrl(l.videoUrl || "");
                                          }}
                                          className="py-1 px-2.5 rounded-lg border border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/10 font-bold text-xs transition-all cursor-pointer"
                                        >
                                          แก้ไข
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteLesson(l.id, l.title)}
                                          className="py-1 px-2 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-bold text-xs transition-all cursor-pointer"
                                          title="ลบบทเรียน"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Chapter Modal */}
      {showAddChapterModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl shadow-2xl p-6 border space-y-4"
            style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}
          >
            <h4 className="text-lg font-bold">เพิ่มหน่วยเรียนใหม่ (Chapter)</h4>
            <form onSubmit={handleAddChapterSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                  ชื่อหน่วยเรียน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  required
                  placeholder="เช่น หน่วยการเรียนรู้ที่ 1: แคลคูลัสเบื้องต้น"
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: tx.border, color: tx.primary }}
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddChapterModal(false)}
                  className="btn-cancel py-2 px-4 rounded-xl font-bold text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  เพิ่มหน่วยเรียน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
