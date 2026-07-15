import React from "react";
import { tx } from "../../lib/theme";

export interface ProfileStat {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

interface StatsGridProps {
  stats: ProfileStat[];
}

export default function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map(s => (
        <div key={s.label} className="rounded-2xl p-5 text-center shadow-sm"
          style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center mx-auto mb-2"
            style={{ backgroundColor: `${s.color}18`, color: s.color }}>
            {s.icon}
          </div>
          <p className="text-2xl font-extrabold">{s.value}</p>
          <p className="text-[11px] mt-0.5 font-medium" style={{ color: tx.muted }}>{s.label}</p>
        </div>
      ))}
    </div>
  );
}
