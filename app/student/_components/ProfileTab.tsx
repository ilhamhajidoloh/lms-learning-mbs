import React from "react";
import { tx } from "../../lib/theme";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";

interface ProfileTabProps {
  displayName: string;
}

export function ProfileTab({ displayName }: ProfileTabProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn text-left mt-6">
      <h1 className="text-2xl font-extrabold tracking-tight animate-slideInUp">สรุปความสำเร็จของนักเรียน (My Achievements)</h1>
      <div className="rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl animate-slideInUp stagger-1" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
        <div className="flex items-center gap-4 border-b pb-6" style={{ borderColor: tx.borderS }}>
          <Avatar name={displayName} size="lg" />
          <div>
            <h3 className="text-lg font-bold">{displayName}</h3>
            <p className="text-xs" style={{ color: tx.muted }}>สมาชิกระดับทั่วไป</p>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-sm tracking-wide uppercase" style={{ color: tx.muted }}>ความสำเร็จและเหรียญรางวัล</h4>
          <div className="rounded-2xl border border-dashed animate-scaleIn" style={{ borderColor: tx.borderS }}>
            <EmptyState
              illustration="trophy"
              variant="compact"
              accent="amber"
              title="ยังไม่มีเหรียญรางวัล"
              description="เข้าเรียนและทำแบบทดสอบเพื่อปลดล็อกเหรียญรางวัล!"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
