import { Video, Clock, ExternalLink } from "lucide-react";
import { Meeting } from "../../../context/UserContext";
import { tx, card } from "../../../lib/theme";

interface MeetingsListProps {
  meetings: Meeting[];
}

export default function MeetingsList({ meetings }: MeetingsListProps) {
  if (meetings.length === 0) {
    return (
      <div className="rounded-3xl p-12 text-center space-y-4 border border-dashed flex flex-col items-center justify-center" style={{ borderColor: tx.borderS }}>
        <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ backgroundColor: tx.elevated, color: tx.faint }}>
          <Video className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-base">ตอนนี้ยังไม่มีการสร้างคลาสสดโดยคุณครู</p>
          <p className="text-xs" style={{ color: tx.muted }}>หากถึงเวลาเรียนสดแล้วแต่ยังไม่เห็นลิงก์ ให้ติดต่อคุณครูผู้สอนเพื่อตรวจสอบสัญญาณ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {meetings.map((m) => (
        <div key={m.id} className="rounded-3xl p-6 flex flex-col justify-between shadow-xl" style={card.style}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                Online Class
              </span>
              <span className="text-xs flex items-center gap-1" style={{ color: tx.muted }}>
                <Clock className="h-3 w-3" /> {m.startDateTime} น.
              </span>
            </div>

            <div className="space-y-1 text-left">
              <h4 className="font-bold text-base">{m.subject}</h4>
              <p className="text-xs" style={{ color: tx.muted }}>สอนโดย ครูเซ็ง (Seng)</p>
            </div>

            <div className="rounded-xl p-3 border text-left flex justify-between items-center" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
              <span className="text-xs font-semibold" style={{ color: tx.secondary }}>Passcode สำหรับเข้าห้อง</span>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-950/50">{m.passcode}</span>
            </div>
          </div>

          <div className="mt-6">
            <a href={m.joinUrl} target="_blank" rel="noopener noreferrer" className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-white font-extrabold hover:shadow-lg transition-all flex items-center justify-center gap-2">
              กดเข้าร่วมคลาสเรียนสด <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
