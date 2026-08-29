import React, { useState } from "react";
import { Upload, FileText, Check, PencilLine, Undo2, Lock, Clock } from "lucide-react";
import { tx, card } from "../../lib/theme";
import { useUser, type Assignment, type StudentSubmission } from "../../context/UserContext";
import Swal from "sweetalert2";

interface FileSubmissionPanelProps {
  activeTask: Assignment;
  fileNameInput: string;
  setFileNameInput: React.Dispatch<React.SetStateAction<string>>;
  setSelectedAssignmentId: React.Dispatch<React.SetStateAction<string | null>>;
  addSubmission: (submission: StudentSubmission) => void;
  currentUserId: string | null;
  displayName: string;
  activeLessonId?: string | null;
}

export function FileSubmissionPanel({
  activeTask, fileNameInput, setFileNameInput, setSelectedAssignmentId, addSubmission, currentUserId, displayName, activeLessonId,
}: FileSubmissionPanelProps) {
  const { toggleLessonComplete, submissions, editFileSubmission, cancelFileSubmission } = useUser();
  const [isDragging, setIsDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const existingSub = submissions.find(s => s.assignmentId === activeTask.id && s.studentId === currentUserId);
  const isEdit = !!existingSub;

  const nowMs = Date.now();
  const openAtMs = activeTask.openAt ? new Date(activeTask.openAt).getTime() : null;
  const closeAtMs = activeTask.closeAt ? new Date(activeTask.closeAt).getTime() : null;
  const notOpenYet = openAtMs !== null && nowMs < openAtMs;
  const alreadyClosed = closeAtMs !== null && nowMs > closeAtMs;
  const isOpen = activeTask.isOpen !== false && !notOpenYet && !alreadyClosed;

  const canEdit = !isEdit || activeTask.allowEditSubmission === true;

  const handleSubmit = async () => {
    if (!isOpen || !canEdit) return;
    const name = fileNameInput.trim();
    if (!name) return;
    setSubmitted(true);
    if (isEdit) {
      await editFileSubmission(existingSub.id, name);
    } else {
      await addSubmission({
        id: Math.random().toString(),
        studentId: currentUserId || "",
        studentName: displayName,
        assignmentId: activeTask.id,
        type: "file",
        fileName: name,
        submittedAt: Date.now()
      });
      const targetLessonId = activeTask.lessonId || activeLessonId;
      if (targetLessonId) {
        toggleLessonComplete(targetLessonId, true);
      }
    }
    setTimeout(() => {
      setFileNameInput("");
      setSelectedAssignmentId(null);
    }, 600);
  };

  return (
    <div className="p-4 rounded-xl border space-y-4 animate-scaleIn" style={{ borderColor: tx.borderS }}>
      <div className="flex justify-between items-center">
        <h5 className="font-bold text-sm flex items-center gap-1.5">
          {isEdit ? <PencilLine className="h-4 w-4 text-indigo-500" /> : <Upload className="h-4 w-4 text-indigo-500" />}
          {isEdit ? `แก้ไขไฟล์ที่ส่งแล้ว: ${activeTask.title}` : `ส่งไฟล์การบ้าน: ${activeTask.title}`}
        </h5>
        <button onClick={() => setSelectedAssignmentId(null)} className="text-xs text-rose-500 hover:underline font-bold active:scale-95 transition-transform">ย้อนกลับ</button>
      </div>

      {!isOpen && (
        <div className="p-3 rounded-xl border bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          {notOpenYet ? <Clock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          <span>{notOpenYet ? `งานนี้จะเปิดรับส่งในวันที่ ${new Date(activeTask.openAt!).toLocaleString("th-TH")}` : "งานนี้ปิดรับการส่งแล้ว (หมดเวลาส่ง หรือผู้สอนปิดการรับส่ง)"}</span>
        </div>
      )}

      {isEdit && !activeTask.allowEditSubmission && (
        <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span>ผู้สอนไม่อนุญาตให้แก้ไขไฟล์ที่ส่งแล้ว</span>
        </div>
      )}

      {isEdit && existingSub.fileName && (
        <div className="p-3 rounded-xl border text-[11px] flex items-center justify-between gap-2 animate-slideInUp" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
            <span style={{ color: tx.muted }}>ไฟล์ที่ส่งอยู่ตอนนี้:</span>
            <span className="font-mono font-bold truncate" style={{ color: tx.primary }}>{existingSub.fileName}</span>
          </div>
          {activeTask.allowCancelSubmission && isOpen && (
            <button
              type="button"
              onClick={async () => {
                const confirmed = await Swal.fire({
                  title: "ยกเลิกการส่งไฟล์?",
                  text: "ไฟล์ที่ส่งไว้จะถูกลบออก และต้องส่งใหม่อีกครั้ง",
                  icon: "warning",
                  showCancelButton: true,
                  confirmButtonText: "ยกเลิกการส่ง",
                  cancelButtonText: "กลับ",
                  confirmButtonColor: "#ef4444",
                  background: card.style.background ? String(card.style.background) : undefined,
                  color: tx.primary,
                });
                if (confirmed.isConfirmed) {
                  await cancelFileSubmission(existingSub.id);
                  setFileNameInput("");
                  setSelectedAssignmentId(null);
                }
              }}
              className="px-3 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 font-bold text-[10px] hover:bg-rose-200 shrink-0 cursor-pointer flex items-center gap-1"
            >
              <Undo2 className="h-3 w-3" /> ยกเลิกการส่ง
            </button>
          )}
        </div>
      )}

      <div className="p-3.5 rounded-xl border text-xs leading-relaxed animate-slideInUp stagger-1" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
        <strong style={{ color: tx.secondary }}>คำสั่งการบ้าน:</strong>
        <p className="mt-1 whitespace-pre-line" style={{ color: tx.muted }}>{activeTask.instructions || "ไม่มีคำสั่งเฉพาะ"}</p>
      </div>

      <div className="space-y-3 animate-slideInUp stagger-2">
        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const text = e.dataTransfer.getData("text");
            if (text) setFileNameInput(text);
          }}
          className={`relative p-6 rounded-2xl border-2 border-dashed text-center transition-all duration-300 ${
            isDragging
              ? "border-indigo-500 bg-indigo-500/5 scale-[1.02]"
              : "border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-500/5"
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isDragging
                ? "bg-indigo-500 text-white scale-110"
                : "bg-indigo-500/10 text-indigo-500"
            }`}>
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: tx.secondary }}>ลากไฟล์มาวางที่นี่ หรือกรอกชื่อไฟล์ด้านล่าง</p>
              <p className="text-[10px] mt-1" style={{ color: tx.faint }}>รองรับทุกนามสกุลไฟล์ (.pdf, .docx, .jpg, ฯลฯ)</p>
            </div>
          </div>
        </div>

        {/* File Name Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ระบุชื่อไฟล์ หรือลิงก์ไฟล์ส่งงาน</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200" style={{ color: tx.faint }} />
              <input
                type="text"
                value={fileNameInput}
                onChange={(e) => setFileNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && fileNameInput.trim()) handleSubmit(); }}
                placeholder="เช่น homework_lesson1.pdf หรือ ลิงก์ไดรฟ์..."
                className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border bg-transparent input-glow focus:ring-0"
                style={{ borderColor: tx.border, color: tx.primary }}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!fileNameInput.trim() || submitted}
              className={`px-4 py-2 font-bold text-xs rounded-xl shadow transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
                submitted
                  ? "bg-emerald-500 text-white"
                  : isEdit
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-lg disabled:opacity-40"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-lg disabled:opacity-40"
              }`}
            >
              {submitted ? (
                <>
                  <Check className="h-3.5 w-3.5 animate-scaleIn" /> {isEdit ? "บันทึกแล้ว!" : "ส่งแล้ว!"}
                </>
              ) : isEdit ? (
                "บันทึกการแก้ไข"
              ) : (
                "ส่งการบ้าน"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
