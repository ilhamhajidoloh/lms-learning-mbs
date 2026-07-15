import React from "react";
import { tx } from "../../lib/theme";

interface ProfileTabProps {
  displayName: string;
}

export function ProfileTab({ displayName }: ProfileTabProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn text-left mt-6">
      <h1 className="text-2xl font-extrabold tracking-tight">สรุปความสำเร็จของนักเรียน (My Achievements)</h1>
      <div className="rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
        <div className="flex items-center gap-4 border-b pb-6" style={{ borderColor: tx.borderS }}>
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg uppercase">
            {displayName ? displayName.charAt(0) : "S"}
          </div>
          <div>
            <h3 className="text-lg font-bold">{displayName}</h3>
            <p className="text-xs" style={{ color: tx.muted }}>สมาชิกระดับทั่วไป</p>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-sm tracking-wide uppercase" style={{ color: tx.muted }}>ความสำเร็จและเหรียญรางวัล</h4>
          <div className="rounded-2xl p-8 text-center border border-dashed" style={{ borderColor: tx.borderS }}>
            <p className="text-sm font-bold" style={{ color: tx.secondary }}>ยังไม่มีเหรียญรางวัล</p>
            <p className="text-xs mt-1" style={{ color: tx.faint }}>เข้าเรียนและทำแบบทดสอบเพื่อปลดล็อกเหรียญรางวัล!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
