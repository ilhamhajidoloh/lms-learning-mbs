import React from "react";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { tx } from "../../lib/theme";

interface ChangePasswordFormProps {
  oldPw: string;
  setOldPw: (v: string) => void;
  newPw: string;
  setNewPw: (v: string) => void;
  cPw: string;
  setCPw: (v: string) => void;
  showOld: boolean;
  setShowOld: React.Dispatch<React.SetStateAction<boolean>>;
  showNew: boolean;
  setShowNew: React.Dispatch<React.SetStateAction<boolean>>;
  pwError: string | null;
  setPwError: (v: string | null) => void;
  handleSavePw: (e: React.FormEvent) => void;
}

export default function ChangePasswordForm({
  oldPw, setOldPw, newPw, setNewPw, cPw, setCPw,
  showOld, setShowOld, showNew, setShowNew,
  pwError, setPwError, handleSavePw,
}: ChangePasswordFormProps) {
  return (
    <div className="rounded-3xl p-6 shadow-sm space-y-4" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
      <h2 className="font-bold text-base flex items-center gap-2">
        <Lock className="h-4 w-4 text-purple-500" /> เปลี่ยนรหัสผ่าน
      </h2>
      <form onSubmit={handleSavePw} className="space-y-3">
        {/* Old PW */}
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: tx.faint }} />
          <input
            type={showOld ? "text" : "password"}
            value={oldPw}
            onChange={e => { setOldPw(e.target.value); setPwError(null); }}
            placeholder="รหัสผ่านเดิม"
            className="w-full pl-9 pr-10 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 bg-transparent text-sm"
            style={{ borderColor: tx.border, color: tx.primary }}
          />
          <button type="button" tabIndex={-1} onClick={() => setShowOld(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon hover:opacity-70 transition-opacity"
            style={{ color: tx.faint }}>
            {showOld ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* New PW */}
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: tx.faint }} />
          <input
            type={showNew ? "text" : "password"}
            value={newPw}
            onChange={e => { setNewPw(e.target.value); setPwError(null); }}
            placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
            className="w-full pl-9 pr-10 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 bg-transparent text-sm"
            style={{ borderColor: tx.border, color: tx.primary }}
          />
          <button type="button" tabIndex={-1} onClick={() => setShowNew(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon hover:opacity-70 transition-opacity"
            style={{ color: tx.faint }}>
            {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Confirm PW */}
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: tx.faint }} />
          <input
            type="password"
            value={cPw}
            onChange={e => { setCPw(e.target.value); setPwError(null); }}
            placeholder="ยืนยันรหัสผ่านใหม่"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 bg-transparent text-sm"
            style={{ borderColor: tx.border, color: tx.primary }}
          />
        </div>

        {pwError && (
          <p className="text-xs text-rose-500 font-semibold flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {pwError}
          </p>
        )}

        <button type="submit"
          className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-md transition-all btn-press">
          เปลี่ยนรหัสผ่าน
        </button>
      </form>
    </div>
  );
}
