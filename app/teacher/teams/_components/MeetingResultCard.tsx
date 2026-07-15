import { Check, Copy, ExternalLink } from "lucide-react";
import { Meeting } from "../../../context/UserContext";

interface MeetingResultCardProps {
  meetingResult: Meeting;
  copied: boolean;
  copyToClipboard: () => void;
}

export default function MeetingResultCard({ meetingResult, copied, copyToClipboard }: MeetingResultCardProps) {
  return (
    <div className="rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl text-white bg-gradient-to-tr from-indigo-900 to-purple-950 border border-indigo-500/20">
      <div className="flex justify-between items-center">
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          MS GRAPH API RESPONSE (201)
        </span>
        <button onClick={copyToClipboard} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white flex items-center gap-1.5 text-xs font-semibold">
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          {copied ? "คัดลอกแล้ว!" : "คัดลอกข้อมูลแชร์"}
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-bold">{meetingResult.subject}</h3>
        <p className="text-xs text-indigo-200">
          เวลาเริ่ม: {meetingResult.startDateTime} น.
        </p>
        <p className="text-xs text-indigo-200 font-mono">
          Meeting ID: {meetingResult.id}
        </p>
      </div>

      <div className="pt-2">
        <a href={meetingResult.joinUrl} target="_blank" rel="noopener noreferrer" className="w-full py-3 rounded-xl bg-white text-indigo-950 font-extrabold hover:bg-slate-200 flex items-center justify-center gap-2 shadow-md">
          เข้าร่วมทีมในฐานะครู <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
