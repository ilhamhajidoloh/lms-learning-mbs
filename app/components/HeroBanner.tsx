import React from "react";

interface HeroBannerProps {
  gradient?: string;
  overlay?: string;
  badge?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function HeroBanner({
  gradient = "from-indigo-900 via-purple-950 to-slate-950",
  overlay,
  badge,
  title,
  subtitle,
  action,
  children,
  className = "",
}: HeroBannerProps) {
  return (
    <div className={`rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-xl text-white bg-gradient-to-r ${gradient} ${className}`}>
      {overlay && (
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))]" style={{ backgroundImage: overlay }} />
      )}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
      <div className="relative z-10 space-y-2">
        {badge && (
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm self-start inline-block">
            {badge}
          </span>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-indigo-200 text-sm max-w-xl">{subtitle}</p>}
      </div>
      {(action || children) && (
        <div className="relative z-10 shrink-0 w-full md:w-auto">
          {action || children}
        </div>
      )}
    </div>
  );
}
