import React from "react";
import { StatCard } from "../../components/StatCard";

export interface ProfileStat {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}

interface StatsGridProps {
  stats: ProfileStat[];
}

export default function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map(s => (
        <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} accent={s.accent} />
      ))}
    </div>
  );
}
