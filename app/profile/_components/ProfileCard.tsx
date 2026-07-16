import React from "react";
import { Pencil, Check, X, Clock } from "lucide-react";
import { tx } from "../../lib/theme";
import { Avatar } from "../../components/Avatar";

export interface RoleMeta {
  label: string;
  gradient: string;
  icon: React.ReactNode;
  desc: string;
}

interface ProfileCardProps {
  meta: RoleMeta;
  displayName: string;
  currentUsername: string;
  editingName: boolean;
  setEditingName: (v: boolean) => void;
  nameInput: string;
  setNameInput: (v: string) => void;
  handleSaveName: () => void;
}

export default function ProfileCard({
  meta, displayName, currentUsername,
  editingName, setEditingName, nameInput, setNameInput,
  handleSaveName,
}: ProfileCardProps) {
  return (
    <div className="rounded-3xl p-6 sm:p-8 shadow-sm" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

        {/* Avatar */}
        <Avatar name={displayName} size="xl" gradient={meta.gradient} />

        {/* Info */}
        <div className="flex-1 min-w-0 text-center sm:text-left space-y-3">
          {/* Display Name + edit */}
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2">
            {editingName ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  autoFocus
                  className="px-3 py-1.5 rounded-xl border text-lg font-bold bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
                  style={{ borderColor: tx.border, color: tx.primary }}
                />
                <button onClick={handleSaveName} className="btn-icon p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-colors">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => { setEditingName(false); setNameInput(displayName); }} className="btn-icon p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors" style={{ color: tx.faint }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight">{displayName}</h1>
                <button onClick={() => { setEditingName(true); setNameInput(displayName); }}
                  className="btn-icon p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors"
                  style={{ color: tx.faint }} title="แก้ไขชื่อ">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Username */}
          <p className="font-mono text-sm" style={{ color: tx.muted }}>@{currentUsername || "—"}</p>

          {/* Role badge */}
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${meta.gradient}`}>
              {meta.icon} {meta.label}
            </span>
            <span className="text-xs" style={{ color: tx.muted }}>{meta.desc}</span>
          </div>

          {/* Member since */}
          <p className="flex items-center justify-center sm:justify-start gap-1.5 text-xs" style={{ color: tx.faint }}>
            <Clock className="h-3.5 w-3.5" /> สมาชิกตั้งแต่ มกราคม 2026
          </p>
        </div>
      </div>
    </div>
  );
}
