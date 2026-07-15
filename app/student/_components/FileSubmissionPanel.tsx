import React from "react";
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
  return (
    <div className="p-4 rounded-xl border space-y-4 animate-fadeIn" style={{ borderColor: tx.borderS }}>
      <div className="flex justify-between items-center">
        <h5 className="font-bold text-sm">ส่งไฟล์การบ้าน: {activeTask.title}</h5>
        <button onClick={() => setSelectedAssignmentId(null)} className="text-xs text-rose-500 hover:underline font-bold">ย้อนกลับ</button>
      </div>

      <div className="p-3.5 rounded-xl border text-xs leading-relaxed" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
        <strong style={{ color: tx.secondary }}>คำสั่งการบ้าน:</strong>
        <p className="mt-1 whitespace-pre-line" style={{ color: tx.muted }}>{activeTask.instructions || "ไม่มีคำสั่งเฉพาะ"}</p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ระบุชื่อไฟล์ หรือลิงก์ไฟล์ส่งงาน</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={fileNameInput}
            onChange={(e) => setFileNameInput(e.target.value)}
            placeholder="เช่น homework_lesson1.pdf หรือ ลิงก์ไดรฟ์..."
            className="flex-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent"
            style={{ borderColor: tx.border, color: tx.primary }}
          />
          <button
            onClick={async () => {
              const name = fileNameInput.trim();
              if (!name) return;
              await addSubmission({
                id: Math.random().toString(),
                studentId: currentUserId || "",
                studentName: displayName,
                assignmentId: activeTask.id,
                type: "file",
                fileName: name,
                submittedAt: Date.now()
              });
              setFileNameInput("");
              setSelectedAssignmentId(null);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-transform"
          >
            ส่งการบ้าน
          </button>
        </div>
      </div>
    </div>
  );
}
