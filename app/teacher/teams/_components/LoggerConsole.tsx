import { Terminal } from "lucide-react";
import { tx, card } from "../../../lib/theme";

interface LoggerConsoleProps {
  logMessages: string[];
}

export default function LoggerConsole({ logMessages }: LoggerConsoleProps) {
  return (
    <div className="flex-1 rounded-3xl p-6 shadow-xl flex flex-col space-y-4 font-mono text-xs" style={card.style}>
      <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: tx.borderS }}>
        <span className="font-bold flex items-center gap-2">
          <Terminal className="h-4 w-4 text-indigo-500 dark:text-indigo-400" /> Console Logs (Real-time Flow)
        </span>
        <span className="text-[10px]" style={{ color: tx.faint }}>
          Microsoft Graph SDK
        </span>
      </div>

      <div className="flex-1 bg-slate-950 rounded-2xl p-4 overflow-y-auto min-h-[220px] max-h-[300px] text-indigo-400 space-y-2 text-left">
        {logMessages.length === 0 ? (
          <p className="text-slate-500 italic">พร้อมรอการสั่งงานสร้างจากฟอร์ม...</p>
        ) : (
          logMessages.map((log, idx) => (
            <pre key={idx} className="whitespace-pre-wrap">{log}</pre>
          ))
        )}
      </div>
    </div>
  );
}
