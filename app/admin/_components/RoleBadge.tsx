import { Shield, BookOpen, GraduationCap } from "lucide-react";
import type { Role } from "../../context/UserContext";

export const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  admin:   { label: "Admin",   color: "#f43f5e", bg: "rgba(244,63,94,0.1)",   icon: <Shield        className="h-3.5 w-3.5" /> },
  teacher: { label: "Teacher", color: "#6366f1", bg: "rgba(99,102,241,0.1)",  icon: <BookOpen      className="h-3.5 w-3.5" /> },
  student: { label: "Student", color: "#a855f7", bg: "rgba(168,85,247,0.1)",  icon: <GraduationCap className="h-3.5 w-3.5" /> },
};

export function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}
