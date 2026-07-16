import React from "react";
import { tx } from "../lib/theme";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  gradient?: string;
  className?: string;
}

const SIZE_MAP: Record<AvatarSize, { container: string; text: string; ring: string }> = {
  xs: { container: "h-7 w-7 rounded-lg", text: "text-[10px]", ring: "ring-1" },
  sm: { container: "h-9 w-9 rounded-xl", text: "text-sm", ring: "ring-2" },
  md: { container: "h-12 w-12 rounded-xl", text: "text-base", ring: "ring-2" },
  lg: { container: "h-16 w-16 rounded-2xl", text: "text-xl", ring: "ring-2" },
  xl: { container: "h-24 w-24 rounded-3xl", text: "text-4xl", ring: "ring-4" },
};

const ROLE_GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-purple-500 to-pink-500",
  "from-rose-500 to-orange-400",
  "from-emerald-500 to-teal-500",
  "from-cyan-500 to-blue-500",
  "from-amber-500 to-orange-400",
  "from-violet-500 to-indigo-600",
  "from-pink-500 to-rose-500",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitial(name: string): string {
  if (!name || name.trim().length === 0) return "?";
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return trimmed.charAt(0).toUpperCase();
}

export function Avatar({ name, size = "sm", gradient, className = "" }: AvatarProps) {
  const initial = getInitial(name);
  const resolvedGradient = gradient || ROLE_GRADIENTS[hashName(name) % ROLE_GRADIENTS.length];
  const sizeConfig = SIZE_MAP[size];

  return (
    <div
      className={`${sizeConfig.container} bg-gradient-to-tr ${resolvedGradient} flex items-center justify-center text-white font-extrabold shadow-md animate-scaleIn group-hover:ring-indigo-500/30 transition-all duration-200 ${sizeConfig.ring} ring-transparent select-none ${className}`}
    >
      <span className={sizeConfig.text}>{initial}</span>
    </div>
  );
}

export function AvatarGroup({ names, size = "xs", max = 4 }: { names: string[]; size?: AvatarSize; max?: number }) {
  const shown = names.slice(0, max);
  const overflow = names.length - max;

  return (
    <div className="flex -space-x-2">
      {shown.map((name, i) => (
        <div key={i} className="relative" style={{ zIndex: max - i }}>
          <Avatar name={name} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div className={`${SIZE_MAP[size].container} rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold ring-2 ring-white dark:ring-slate-900 shadow-sm`}>
          +{overflow}
        </div>
      )}
    </div>
  );
}
