import { Shield, Users, BookOpen, GraduationCap } from "lucide-react";
import { tx } from "../../lib/theme";

interface StatsOverviewProps {
  displayName: string;
  counts: {
    total: number;
    admin: number;
    teacher: number;
    student: number;
  };
}

export function StatsOverview({ displayName, counts }: StatsOverviewProps) {
  return (
    <>
      {/* Welcome Banner */}
      <div className="rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl text-white bg-gradient-to-r from-rose-900 via-pink-950 to-slate-950">
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-300 via-pink-900 to-rose-950" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <Shield className="h-3 w-3" /> Admin Console
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">สวัสดีครับ, {displayName} 🛡️</h1>
          <p className="text-rose-200 text-sm max-w-xl">
            จัดการผู้ใช้งานในระบบ Math by Seng LMS — เพิ่ม แก้ไข หรือลบบัญชีผู้ใช้ได้จากหน้านี้
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "ผู้ใช้ทั้งหมด",  value: counts.total,   icon: <Users className="h-6 w-6" />,         color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
          { label: "Admin",           value: counts.admin,   icon: <Shield className="h-6 w-6" />,        color: "#f43f5e", bg: "rgba(244,63,94,0.1)"   },
          { label: "ครูผู้สอน",      value: counts.teacher, icon: <BookOpen className="h-6 w-6" />,      color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
          { label: "นักเรียน",        value: counts.student, icon: <GraduationCap className="h-6 w-6" />, color: "#a855f7", bg: "rgba(168,85,247,0.1)"  },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5 flex items-center justify-between shadow-sm"
            style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>{s.label}</p>
              <p className="text-3xl font-extrabold mt-0.5">{s.value}</p>
            </div>
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.bg, color: s.color }}>
              {s.icon}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
