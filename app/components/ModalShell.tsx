import React from "react";
import { X } from "lucide-react";
import { tx } from "../lib/theme";

interface ModalShellProps {
  onClose: () => void;
  title?: string;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function ModalShell({ onClose, title, subtitle, maxWidth = "max-w-3xl", children, footer, className = "" }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
      <div
        className={`w-full ${maxWidth} rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border animate-scaleIn ${className}`}
        style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}
      >
        {(title || subtitle) && (
          <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.surface }}>
            <div>
              {title && <h2 className="text-xl font-bold">{title}</h2>}
              {subtitle && <p className="text-xs mt-0.5" style={{ color: tx.muted }}>{subtitle}</p>}
            </div>
            <button onClick={onClose} className="btn-icon p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer">
              <X className="h-5 w-5" style={{ color: tx.secondary }} />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1 text-left space-y-5">
          {children}
        </div>
        {footer && (
          <div className="p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
