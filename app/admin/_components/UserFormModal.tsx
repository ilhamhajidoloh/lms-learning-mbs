import type { FormEvent, Dispatch, SetStateAction } from "react";
import { UserPlus, Pencil, X, Check, AlertTriangle } from "lucide-react";
import { tx } from "../../lib/theme";
import type { AppUser, Role } from "../../context/UserContext";
import { ROLE_CONFIG } from "./RoleBadge";

interface UserFormModalProps {
  editingUser: AppUser | null;
  formData: { username: string; displayName: string; role: Role };
  setFormData: Dispatch<SetStateAction<{ username: string; displayName: string; role: Role }>>;
  formError: string | null;
  setFormError: (error: string | null) => void;
  closeForm: () => void;
  handleSubmit: (e: FormEvent) => void;
  hasOtherAdmin: boolean;
}

export function UserFormModal({
  editingUser,
  formData,
  setFormData,
  formError,
  setFormError,
  closeForm,
  handleSubmit,
  hasOtherAdmin,
}: UserFormModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl animate-fadeIn"
        style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}`, color: tx.primary }}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-4" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
          <h3 className="text-lg font-bold flex items-center gap-2">
            {editingUser ? <><Pencil className="h-5 w-5 text-indigo-500" /> แก้ไขผู้ใช้</> : <><UserPlus className="h-5 w-5 text-rose-500" /> เพิ่มผู้ใช้ใหม่</>}
          </h3>
          <button type="button" onClick={closeForm} className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={e => { setFormData(p => ({ ...p, username: e.target.value })); setFormError(null); }}
            className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500 bg-transparent text-sm"
            style={{ borderColor: tx.border, color: tx.primary }}
            placeholder="เช่น student01"
            required
          />
        </div>

        {/* Display Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ชื่อแสดงผล (Display Name)</label>
          <input
            type="text"
            value={formData.displayName}
            onChange={e => { setFormData(p => ({ ...p, displayName: e.target.value })); setFormError(null); }}
            className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500 bg-transparent text-sm"
            style={{ borderColor: tx.border, color: tx.primary }}
            placeholder="เช่น สมศรี มีสุข"
            required
          />
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>บทบาท (Role)</label>
            {editingUser?.role === "admin" && (
              <span className="text-[10px] text-rose-500 font-medium">ไม่สามารถเปลี่ยนสิทธิ์ Admin ได้</span>
            )}
            {editingUser?.role !== "admin" && hasOtherAdmin && (
              <span className="text-[10px] text-rose-500 font-medium">มีผู้ดูแลระบบอยู่แล้ว จำกัดได้แค่คนเดียว</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["admin", "teacher", "student"] as Role[]).map(r => {
              const cfg = ROLE_CONFIG[r];
              const active = formData.role === r;
              const disabled = editingUser?.role === "admin" || (r === "admin" && hasOtherAdmin);

              return (
                <button
                  key={r}
                  type="button"
                  disabled={disabled}
                  onClick={() => setFormData(p => ({ ...p, role: r }))}
                  className={`py-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${disabled ? (active ? '' : 'opacity-40 cursor-not-allowed') : 'cursor-pointer'}`}
                  style={active
                    ? { borderColor: cfg.color, color: cfg.color, backgroundColor: cfg.bg }
                    : { borderColor: tx.borderS, color: tx.secondary }}
                >
                  {cfg.icon} {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {formError && (
          <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {formError}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2" style={{ borderTop: `1px solid ${tx.borderS}` }}>
          <button
            type="button"
            onClick={closeForm}
            className="py-2.5 px-5 rounded-xl border font-bold text-sm cursor-pointer"
            style={{ borderColor: tx.borderS, color: tx.secondary }}
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="py-2.5 px-6 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <Check className="h-4 w-4" />
            {editingUser ? "บันทึกการแก้ไข" : "สร้างผู้ใช้"}
          </button>
        </div>
      </form>
    </div>
  );
}
