import React from "react";
import { tx } from "../lib/theme";

/* ── Illustration SVGs ────────────────────────────── */

function IllustrationBookshelf({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <rect x="15" y="85" width="90" height="5" rx="2.5" fill={color} opacity={0.25} />
      <rect x="22" y="45" width="14" height="40" rx="3" fill={color} opacity={0.35} />
      <rect x="38" y="35" width="12" height="50" rx="3" fill={color} opacity={0.5} />
      <rect x="52" y="50" width="16" height="35" rx="3" fill={color} opacity={0.3} />
      <rect x="70" y="40" width="10" height="45" rx="3" fill={color} opacity={0.45} />
      <rect x="82" y="52" width="14" height="33" rx="3" fill={color} opacity={0.28} />
      <circle cx="60" cy="28" r="3" fill={color} opacity={0.15}>
        <animate attributeName="opacity" values="0.15;0.3;0.15" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="55" cy="22" r="2" fill={color} opacity={0.1}>
        <animate attributeName="opacity" values="0.1;0.25;0.1" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="65" cy="24" r="1.5" fill={color} opacity={0.1}>
        <animate attributeName="opacity" values="0.1;0.2;0.1" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function IllustrationClipboard({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <rect x="28" y="20" width="64" height="80" rx="8" fill={color} fillOpacity={0.12} stroke={color} strokeWidth="2" strokeOpacity={0.2} />
      <rect x="42" y="14" width="36" height="14" rx="5" fill={color} opacity={0.2} />
      <circle cx="60" cy="21" r="3" fill={color} opacity={0.3} />
      <rect x="40" y="44" width="28" height="3" rx="1.5" fill={color} opacity={0.15} />
      <rect x="40" y="54" width="20" height="3" rx="1.5" fill={color} opacity={0.1} />
      <rect x="40" y="64" width="32" height="3" rx="1.5" fill={color} opacity={0.12} />
      <circle cx="78" cy="38" r="2" fill={color} opacity={0.2}>
        <animate attributeName="r" values="2;3;2" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.2;0.4;0.2" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function IllustrationTrophy({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <path d="M40 30h40l-5 45a20 20 0 01-30 0L40 30z" fill={color} fillOpacity={0.12} stroke={color} strokeWidth="2" strokeOpacity={0.2} />
      <path d="M40 38H28a8 8 0 000 16h12" stroke={color} strokeWidth="2" strokeOpacity={0.2} fill="none" />
      <path d="M80 38h12a8 8 0 010 16H80" stroke={color} strokeWidth="2" strokeOpacity={0.2} fill="none" />
      <rect x="55" y="75" width="10" height="12" rx="2" fill={color} opacity={0.2} />
      <rect x="42" y="87" width="36" height="6" rx="3" fill={color} opacity={0.15} />
      <path d="M60 42l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" stroke={color} strokeWidth="1.5" strokeOpacity={0.2} fill="none" strokeDasharray="3 2" />
      <circle cx="30" cy="28" r="1.5" fill={color} opacity={0.15}>
        <animate attributeName="opacity" values="0.15;0.35;0.15" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="90" cy="32" r="2" fill={color} opacity={0.1}>
        <animate attributeName="opacity" values="0.1;0.3;0.1" dur="2.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function IllustrationVideo({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <rect x="20" y="25" width="80" height="52" rx="8" fill={color} fillOpacity={0.1} stroke={color} strokeWidth="2" strokeOpacity={0.18} />
      <rect x="48" y="77" width="24" height="6" rx="2" fill={color} opacity={0.15} />
      <rect x="42" y="83" width="36" height="5" rx="2.5" fill={color} opacity={0.12} />
      <path d="M52 42l16 12-16 12V42z" fill={color} opacity={0.15} />
      <path d="M88 35a18 18 0 010 22" stroke={color} strokeWidth="1.5" strokeOpacity={0.15} strokeDasharray="3 3" />
      <path d="M94 30a25 25 0 010 32" stroke={color} strokeWidth="1.5" strokeOpacity={0.1} strokeDasharray="3 3" />
    </svg>
  );
}

function IllustrationMagnifier({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <circle cx="50" cy="50" r="28" fill={color} fillOpacity={0.08} stroke={color} strokeWidth="2.5" strokeOpacity={0.2} />
      <line x1="70" y1="70" x2="95" y2="95" stroke={color} strokeWidth="4" strokeLinecap="round" strokeOpacity={0.2} />
      <text x="50" y="58" textAnchor="middle" fill={color} fontSize="28" fontWeight="bold" opacity={0.18}>?</text>
      <circle cx="35" cy="30" r="2" fill={color} opacity={0.12}>
        <animate attributeName="opacity" values="0.12;0.25;0.12" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="62" cy="34" r="1.5" fill={color} opacity={0.1}>
        <animate attributeName="opacity" values="0.1;0.2;0.1" dur="2.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function IllustrationInbox({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <rect x="22" y="35" width="76" height="50" rx="8" fill={color} fillOpacity={0.1} stroke={color} strokeWidth="2" strokeOpacity={0.18} />
      <path d="M22 42l38-18 38 18" stroke={color} strokeWidth="2" strokeOpacity={0.2} fill="none" />
      <path d="M60 52v16M52 60l8-8 8 8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.18} />
    </svg>
  );
}

function IllustrationQuiz({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <rect x="28" y="18" width="64" height="84" rx="8" fill={color} fillOpacity={0.08} stroke={color} strokeWidth="2" strokeOpacity={0.18} />
      <circle cx="48" cy="42" r="10" fill={color} fillOpacity={0.12} stroke={color} strokeWidth="1.5" strokeOpacity={0.15} />
      <text x="48" y="47" textAnchor="middle" fill={color} fontSize="14" fontWeight="bold" opacity={0.2}>A</text>
      <circle cx="72" cy="42" r="10" fill={color} fillOpacity={0.08} stroke={color} strokeWidth="1.5" strokeOpacity={0.12} />
      <text x="72" y="47" textAnchor="middle" fill={color} fontSize="14" fontWeight="bold" opacity={0.15}>B</text>
      <rect x="38" y="62" width="44" height="3" rx="1.5" fill={color} opacity={0.1} />
      <rect x="38" y="72" width="36" height="3" rx="1.5" fill={color} opacity={0.08} />
      <rect x="38" y="82" width="40" height="3" rx="1.5" fill={color} opacity={0.1} />
    </svg>
  );
}

function IllustrationUsers({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <rect x="15" y="75" width="90" height="4" rx="2" fill={color} opacity={0.12} />
      <rect x="25" y="55" width="24" height="20" rx="4" fill={color} fillOpacity={0.08} stroke={color} strokeWidth="1.5" strokeOpacity={0.12} />
      <rect x="71" y="55" width="24" height="20" rx="4" fill={color} fillOpacity={0.08} stroke={color} strokeWidth="1.5" strokeOpacity={0.12} />
      <text x="37" y="69" textAnchor="middle" fill={color} fontSize="10" opacity={0.15}>?</text>
      <text x="83" y="69" textAnchor="middle" fill={color} fontSize="10" opacity={0.15}>?</text>
      <rect x="46" y="48" width="28" height="27" rx="5" fill={color} fillOpacity={0.06} stroke={color} strokeWidth="1.5" strokeOpacity={0.1} strokeDasharray="4 3" />
    </svg>
  );
}

function IllustrationFile({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <path d="M20 35h20l8-10h42a8 8 0 018 8v54a8 8 0 01-8 8H28a8 8 0 01-8-8V35z" fill={color} fillOpacity={0.1} stroke={color} strokeWidth="2" strokeOpacity={0.18} />
      <rect x="34" y="48" width="52" height="36" rx="4" fill={color} fillOpacity={0.06} stroke={color} strokeWidth="1" strokeOpacity={0.1} />
      <rect x="42" y="56" width="28" height="2" rx="1" fill={color} opacity={0.1} />
      <rect x="42" y="62" width="20" height="2" rx="1" fill={color} opacity={0.08} />
      <rect x="42" y="68" width="24" height="2" rx="1" fill={color} opacity={0.08} />
    </svg>
  );
}

function IllustrationSearch({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <circle cx="48" cy="48" r="26" fill={color} fillOpacity={0.08} stroke={color} strokeWidth="2.5" strokeOpacity={0.2} />
      <line x1="67" y1="67" x2="92" y2="92" stroke={color} strokeWidth="4" strokeLinecap="round" strokeOpacity={0.18} />
      <line x1="38" y1="38" x2="58" y2="58" stroke={color} strokeWidth="2" strokeLinecap="round" strokeOpacity={0.15} />
      <line x1="58" y1="38" x2="38" y2="58" stroke={color} strokeWidth="2" strokeLinecap="round" strokeOpacity={0.15} />
      <circle cx="82" cy="30" r="2" fill={color} opacity={0.12}>
        <animate attributeName="opacity" values="0.12;0.3;0.12" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="30" cy="22" r="1.5" fill={color} opacity={0.1}>
        <animate attributeName="opacity" values="0.1;0.22;0.1" dur="2.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function IllustrationGeneric({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
      <circle cx="60" cy="55" r="30" fill={color} fillOpacity={0.08} stroke={color} strokeWidth="2" strokeOpacity={0.15} />
      <circle cx="48" cy="48" r="2.5" fill={color} opacity={0.15} />
      <circle cx="60" cy="48" r="2.5" fill={color} opacity={0.12} />
      <circle cx="72" cy="48" r="2.5" fill={color} opacity={0.15} />
      <circle cx="48" cy="60" r="2.5" fill={color} opacity={0.12} />
      <circle cx="60" cy="60" r="2.5" fill={color} opacity={0.15} />
      <circle cx="72" cy="60" r="2.5" fill={color} opacity={0.12} />
      <circle cx="48" cy="72" r="2.5" fill={color} opacity={0.15} />
      <circle cx="60" cy="72" r="2.5" fill={color} opacity={0.12} />
      <circle cx="72" cy="72" r="2.5" fill={color} opacity={0.15} />
      <circle cx="88" cy="32" r="2" fill={color} opacity={0.1}>
        <animate attributeName="opacity" values="0.1;0.25;0.1" dur="2.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ── Illustration map ──────────────────────────────── */

const ILLUSTRATIONS: Record<string, React.FC<{ color: string }>> = {
  bookshelf:  IllustrationBookshelf,
  clipboard:  IllustrationClipboard,
  trophy:     IllustrationTrophy,
  video:      IllustrationVideo,
  magnifier:  IllustrationMagnifier,
  inbox:      IllustrationInbox,
  quiz:       IllustrationQuiz,
  users:      IllustrationUsers,
  file:       IllustrationFile,
  search:     IllustrationSearch,
  generic:    IllustrationGeneric,
};

/* ── Accent tint map ───────────────────────────────── */

const TINT_MAP: Record<string, { bg: string; text: string; hex: string }> = {
  default: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-400",       hex: "#94a3b8" },
  indigo:  { bg: "bg-indigo-500/10",               text: "text-indigo-500",      hex: "#6366f1" },
  purple:  { bg: "bg-purple-500/10",               text: "text-purple-500",      hex: "#a855f7" },
  amber:   { bg: "bg-amber-500/10",                text: "text-amber-500",       hex: "#f59e0b" },
  emerald: { bg: "bg-emerald-500/10",              text: "text-emerald-500",     hex: "#10b981" },
  rose:    { bg: "bg-rose-500/10",                 text: "text-rose-500",        hex: "#f43f5e" },
  blue:    { bg: "bg-blue-500/10",                 text: "text-blue-500",        hex: "#3b82f6" },
  cyan:    { bg: "bg-cyan-500/10",                 text: "text-cyan-500",        hex: "#06b6d4" },
  teal:    { bg: "bg-teal-500/10",                 text: "text-teal-500",        hex: "#14b8a6" },
  slate:   { bg: "bg-slate-500/10",                text: "text-slate-500",       hex: "#64748b" },
};

/* ── Component ─────────────────────────────────────── */

interface EmptyStateProps {
  /** Icon shown in fallback (when no illustration). If `illustration` is set, icon is ignored. */
  icon?: React.ReactNode;
  /** SVG illustration key — renders a characterful SVG instead of the icon circle */
  illustration?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  accent?: string;
  /** Visual variant: default (centered card), compact (small inline), hero (large gradient) */
  variant?: "default" | "compact" | "hero";
  className?: string;
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  accent = "default",
  variant = "default",
  className = "",
}: EmptyStateProps) {
  const t = TINT_MAP[accent] || TINT_MAP.default;
  const IllustrationComponent = illustration ? ILLUSTRATIONS[illustration] || ILLUSTRATIONS.generic : null;

  /* ── COMPACT: small inline empty state for tables / tight spaces ── */
  if (variant === "compact") {
    return (
      <div className={`py-6 flex flex-col items-center justify-center text-center animate-fadeIn ${className}`}>
        {IllustrationComponent ? (
          <div className="w-10 h-10 mb-2 animate-float">
            <IllustrationComponent color={t.hex} />
          </div>
        ) : icon ? (
          <div className={`h-9 w-9 rounded-full ${t.bg} ${t.text} flex items-center justify-center mb-2 animate-bounceSubtle`}>
            {icon}
          </div>
        ) : null}
        <p className="font-bold text-xs" style={{ color: tx.secondary }}>{title}</p>
        {description && (
          <p className="text-[11px] mt-0.5 max-w-xs" style={{ color: tx.muted }}>{description}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    );
  }

  /* ── HERO: large banner style with gradient bg ── */
  if (variant === "hero") {
    return (
      <div
        className={`rounded-3xl p-10 sm:p-14 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden animate-scaleIn ${className}`}
        style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${t.hex}08 0%, transparent 70%)`,
          }}
        />
        <div className="relative z-10">
          {IllustrationComponent ? (
            <div className="w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-6 animate-float">
              <IllustrationComponent color={t.hex} />
            </div>
          ) : (
            <div className={`h-20 w-20 rounded-full ${t.bg} ${t.text} flex items-center justify-center mb-5 shadow-inner animate-bounceSubtle`}>
              {icon}
            </div>
          )}
          <h3 className="text-xl sm:text-2xl font-extrabold mb-2" style={{ color: tx.primary }}>{title}</h3>
          {description && (
            <p className="max-w-md text-sm mb-6" style={{ color: tx.secondary }}>{description}</p>
          )}
          {action && <div>{action}</div>}
        </div>
      </div>
    );
  }

  /* ── DEFAULT: standard centered card ── */
  return (
    <div
      className={`rounded-3xl p-10 sm:p-12 text-center border border-dashed flex flex-col items-center justify-center animate-fadeIn ${className}`}
      style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}
    >
      {IllustrationComponent ? (
        <div className="w-20 h-20 sm:w-24 sm:h-24 mb-4 animate-float">
          <IllustrationComponent color={t.hex} />
        </div>
      ) : (
        <div className={`h-14 w-14 rounded-full ${t.bg} ${t.text} flex items-center justify-center mb-3 animate-bounceSubtle`}>
          {icon}
        </div>
      )}
      <p className="font-bold text-sm" style={{ color: tx.primary }}>{title}</p>
      {description && (
        <p className="text-xs mt-1 max-w-sm" style={{ color: tx.muted }}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
