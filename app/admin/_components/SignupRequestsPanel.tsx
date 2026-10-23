import { Check, Clock3, GraduationCap, UserRoundCheck, X } from "lucide-react";
import { tx } from "../../lib/theme";
import { formatThaiDate } from "../../lib/date";

export interface SignupRequest {
  id: string;
  email: string;
  username: string;
  displayName: string;
  requestedRole: "teacher" | "student";
  createdAt: number;
}

interface SignupRequestsPanelProps {
  requests: SignupRequest[];
  loading: boolean;
  onReview: (request: SignupRequest, action: "approve" | "reject") => void;
}

export function SignupRequestsPanel({ requests, loading, onReview }: SignupRequestsPanelProps) {
  return (
    <section className="rounded-3xl shadow-sm overflow-hidden" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
      <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Clock3 className="h-5 w-5 text-amber-500" /> คำขอสมัครสมาชิก</h2>
          <p className="text-xs mt-0.5" style={{ color: tx.muted }}>รอพิจารณา {requests.length} รายการ</p>
        </div>
      </div>
      {loading ? (
        <p className="p-6 text-sm" style={{ color: tx.muted }}>กำลังโหลดคำขอ...</p>
      ) : requests.length === 0 ? (
        <p className="p-6 text-sm" style={{ color: tx.muted }}>ไม่มีคำขอสมัครสมาชิกที่รออนุมัติ</p>
      ) : (
        <div className="divide-y" style={{ borderColor: tx.borderS }}>
          {requests.map((request) => (
            <div key={request.id} className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold">{request.displayName} <span className="font-mono text-xs" style={{ color: tx.muted }}>@{request.username}</span></p>
                <p className="text-xs mt-1" style={{ color: tx.muted }}>{request.email} · ส่งเมื่อ {formatThaiDate(request.createdAt)}</p>
                <span className="inline-flex items-center gap-1 mt-2 rounded-full px-2.5 py-1 text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                  {request.requestedRole === "teacher" ? <GraduationCap className="h-3.5 w-3.5" /> : <UserRoundCheck className="h-3.5 w-3.5" />}
                  สมัครเป็น{request.requestedRole === "teacher" ? "ครู" : "นักเรียน"}
                </span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => onReview(request, "reject")} className="btn-cancel px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"><X className="h-4 w-4" /> ปฏิเสธ</button>
                <button onClick={() => onReview(request, "approve")} className="btn-danger px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"><Check className="h-4 w-4" /> อนุมัติ</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
