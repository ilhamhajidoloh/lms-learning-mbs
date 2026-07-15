import type React from "react";
import { Video, Calendar, Check, Loader2 } from "lucide-react";
import { tx, card } from "../../../lib/theme";

type Status = "idle" | "authenticating" | "requesting" | "success" | "error";

interface MeetingFormProps {
  subject: string;
  setSubject: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  status: Status;
  handleCreateMeeting: (e: React.FormEvent) => void;
}

export default function MeetingForm({
  subject, setSubject,
  date, setDate,
  startTime, setStartTime,
  endTime, setEndTime,
  status,
  handleCreateMeeting,
}: MeetingFormProps) {
  return (
    <div className="rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl" style={card.style}>
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Calendar className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> ตั้งค่าการจองห้องเรียน
      </h2>

      <form onSubmit={handleCreateMeeting} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>หัวข้อการนัดหมาย (Subject)</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>วันที่ (Date)</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>เวลาเริ่ม (Start)</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>เวลาเลิก (End)</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm" style={{ borderColor: tx.border, color: tx.primary }} />
          </div>
        </div>

        <button type="submit" disabled={status === "authenticating" || status === "requesting"} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
          {(status === "authenticating" || status === "requesting") ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              กำลังสร้างและส่งข้อมูล...
            </>
          ) : (
            <>
              <Video className="h-5 w-5" />
              จองและสร้างลิงก์ Microsoft Teams
            </>
          )}
        </button>
      </form>

      {/* Status Display Area */}
      {status !== "idle" && (
        <div className="rounded-2xl p-4 border" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
          <div className="flex items-center gap-3">
            {status === "authenticating" && (
              <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin shrink-0" />
            )}
            {status === "requesting" && (
              <div className="h-6 w-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin shrink-0" />
            )}
            {status === "success" && (
              <div className="h-6 w-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Check className="h-4 w-4" />
              </div>
            )}
            <span className="text-sm font-semibold">
              {status === "authenticating" && "กำลังแลกเปลี่ยน Token เพื่อขอสิทธิ์การเขียนห้องเรียน..."}
              {status === "requesting" && "ส่งคำร้องไปยัง API: https://graph.microsoft.com/..."}
              {status === "success" && "สร้างห้องสนทนาเรียบร้อย!"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
