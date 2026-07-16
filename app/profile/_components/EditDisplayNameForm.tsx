import React from "react";
import { Pencil } from "lucide-react";
import { tx } from "../../lib/theme";

interface EditDisplayNameFormProps {
  displayName: string;
  nameInput: string;
  setNameInput: (v: string) => void;
  setEditingName: (v: boolean) => void;
  handleSaveName: () => void;
}

export default function EditDisplayNameForm({
  displayName, nameInput, setNameInput, setEditingName, handleSaveName,
}: EditDisplayNameFormProps) {
  return (
    <div className="rounded-3xl p-6 shadow-sm space-y-4" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
      <h2 className="font-bold text-base flex items-center gap-2">
        <Pencil className="h-4 w-4 text-indigo-500" /> แก้ไขชื่อแสดงผล
      </h2>
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
          ชื่อแสดงผลปัจจุบัน
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onFocus={() => setEditingName(false)}
            className="flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
            style={{ borderColor: tx.border, color: tx.primary }}
            placeholder="ชื่อที่แสดงในระบบ"
          />
          <button
            onClick={handleSaveName}
            disabled={!nameInput.trim() || nameInput.trim() === displayName}
            className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm disabled:opacity-40 transition-all btn-press"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
