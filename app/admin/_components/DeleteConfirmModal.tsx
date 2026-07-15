import { AlertTriangle, Trash2 } from "lucide-react";
import { tx } from "../../lib/theme";
import type { AppUser } from "../../context/UserContext";

interface DeleteConfirmModalProps {
  target: AppUser | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ target, onCancel, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl animate-fadeIn text-center"
        style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}`, color: tx.primary }}
      >
        <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold">ยืนยันการลบผู้ใช้</h3>
          <p className="text-sm" style={{ color: tx.muted }}>
            คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี{" "}
            <strong style={{ color: tx.primary }}>{target?.displayName}</strong>
            {" "}({target?.username}) ออกจากระบบ?
          </p>
          <p className="text-xs text-rose-500 font-semibold">การดำเนินการนี้ไม่สามารถเรียกคืนได้</p>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={onCancel}
            className="py-2.5 px-5 rounded-xl border font-bold text-sm cursor-pointer"
            style={{ borderColor: tx.borderS, color: tx.secondary }}
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="py-2.5 px-6 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="h-4 w-4" /> ลบบัญชี
          </button>
        </div>
      </div>
    </div>
  );
}
