import React from "react";
import { tx } from "../lib/theme";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
  className?: string;
}

const ACCENT_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  indigo:  { bg: "bg-indigo-500/10",  text: "text-indigo-500",  ring: "ring-indigo-500/20" },
  purple:  { bg: "bg-purple-500/10",  text: "text-purple-500",  ring: "ring-purple-500/20" },
  pink:    { bg: "bg-pink-500/10",    text: "text-pink-500",    ring: "ring-pink-500/20" },
  blue:    { bg: "bg-blue-500/10",    text: "text-blue-500",    ring: "ring-blue-500/20" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500", ring: "ring-emerald-500/20" },
  amber:   { bg: "bg-amber-500/10",   text: "text-amber-500",   ring: "ring-amber-500/20" },
  rose:    { bg: "bg-rose-500/10",    text: "text-rose-500",    ring: "ring-rose-500/20" },
  cyan:    { bg: "bg-cyan-500/10",    text: "text-cyan-500",    ring: "ring-cyan-500/20" },
};

export function StatCard({ icon, label, value, accent = "indigo", className = "" }: StatCardProps) {
  const a = ACCENT_MAP[accent] || ACCENT_MAP.indigo;

  return (
    <div
      className={`rounded-2xl p-5 flex items-center justify-between shadow-sm card-hover-sm transition-all duration-200 ${className}`}
      style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}
    >
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: tx.muted }}>{label}</p>
        <p className="text-2xl font-black" style={{ color: tx.primary }}>{value}</p>
      </div>
      <div className={`h-12 w-12 rounded-xl ${a.bg} ${a.text} flex items-center justify-center ring-1 ${a.ring}`}>
        {icon}
      </div>
    </div>
  );
}

interface StatCardCompactProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
}

export function StatCardCompact({ icon, label, value, accent = "indigo" }: StatCardCompactProps) {
  const a = ACCENT_MAP[accent] || ACCENT_MAP.indigo;

  return (
    <div className="p-4 rounded-2xl border text-center" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>{label}</p>
      <p className="text-2xl font-black mt-1" style={{ color: tx.accent }}>{value}</p>
    </div>
  );
}
