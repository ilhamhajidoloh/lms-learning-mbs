import React, { useState } from "react";
import { Upload, FileText, Check } from "lucide-react";
import { tx } from "../../lib/theme";
import type { Assignment, StudentSubmission } from "../../context/UserContext";

interface FileSubmissionPanelProps {
  activeTask: Assignment;
  fileNameInput: string;
  setFileNameInput: React.Dispatch<React.SetStateAction<string>>;
  setSelectedAssignmentId: React.Dispatch<React.SetStateAction<string | null>>;
  addSubmission: (submission: StudentSubmission) => void;
  currentUserId: string | null;
  displayName: string;
}

export function FileSubmissionPanel({
  activeTask, fileNameInput, setFileNameInput, setSelectedAssignmentId, addSubmission, currentUserId, displayName,
}: FileSubmissionPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    const name = fileNameInput.trim();
    if (!name) return;
    setSubmitted(true);
    await addSubmission({
      id: Math.random().toString(),
      studentId: currentUserId || "",
      studentName: displayName,
      assignmentId: activeTask.id,
      type: "file",
      fileName: name,
      submittedAt: Date.now()
    });
    setTimeout(() => {
      setFileNameInput("");
      setSelectedAssignmentId(null);
    }, 600);
  };

  return (
    <div className="p-4 rounded-xl border space-y-4 animate-scaleIn" style={{ borderColor: tx.borderS }}>
      <div className="flex justify-between items-center">
        <h5 className="font-bold text-sm">ส่งไฟล์การบ้าน: {activeTask.title}</h5>
        <button onClick={() => setSelectedAssignmentId(null)} className="text-xs text-rose-500 hover:underline font-bold active:scale-95 transition-transform">ย้อนกลับ</button>
      </div>

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
                  : "bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-lg disabled:opacity-40"
              }`}
            >
              {submitted ? (
                <>
                  <Check className="h-3.5 w-3.5 animate-scaleIn" /> ส่งแล้ว!
                </>
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
