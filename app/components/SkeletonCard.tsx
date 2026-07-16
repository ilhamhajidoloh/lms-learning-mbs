import React from "react";

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`skeleton-card ${className}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="skeleton-header skeleton" />
      <div className="skeleton-body">
        <div className="skeleton skeleton-title w-3/4" />
        <div className="skeleton skeleton-text w-full" />
        <div className="skeleton skeleton-text w-1/2" />
        <div className="skeleton skeleton-text w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonStatsRow({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl p-6 flex items-center justify-between shadow-sm animate-slideInUp"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", animationDelay: `${i * 80}ms` }}>
          <div className="space-y-2.5 flex-1">
            <div className="skeleton skeleton-text w-2/3 h-3" />
            <div className="skeleton skeleton-text w-1/2 h-6" />
            <div className="skeleton skeleton-text w-1/3 h-3" />
          </div>
          <div className="skeleton h-12 w-12 rounded-xl shrink-0 ml-4" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTeacherStatsRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl p-6 flex items-center justify-between shadow-sm animate-slideInUp"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", animationDelay: `${i * 80}ms` }}>
          <div className="space-y-2.5 flex-1">
            <div className="skeleton skeleton-text w-2/3 h-3" />
            <div className="skeleton skeleton-text w-1/2 h-7" />
            <div className="skeleton skeleton-text w-1/3 h-3" />
          </div>
          <div className="skeleton h-12 w-12 rounded-xl shrink-0 ml-4" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCourseGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-slideInUp" style={{ animationDelay: `${i * 80}ms` }}>
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}

export function SkeletonLessonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl animate-slideInLeft" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="skeleton h-5 w-5 rounded-full shrink-0" />
          <div className="skeleton skeleton-text flex-1 h-3" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonVideoPlayer() {
  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden skeleton" />
  );
}

export function SkeletonBanner() {
  return (
    <div className="rounded-3xl p-6 sm:p-8 relative overflow-hidden animate-slideInUp"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="space-y-3">
        <div className="skeleton skeleton-text w-1/3 h-4" />
        <div className="skeleton skeleton-title w-2/3 h-8" />
        <div className="skeleton skeleton-text w-1/2 h-4" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl animate-slideInUp" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="skeleton skeleton-avatar" />
          <div className="flex-1 space-y-2">
            <div className="skeleton skeleton-text w-1/3 h-3" />
            <div className="skeleton skeleton-text w-1/4 h-3" />
          </div>
          <div className="skeleton skeleton-text w-16 h-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}
