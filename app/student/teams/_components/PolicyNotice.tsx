import { ShieldAlert } from "lucide-react";
import { tx } from "../../../lib/theme";

export default function PolicyNotice() {
  return (
    <div className="rounded-3xl p-6 border flex gap-4 text-left items-start" style={{ borderColor: "rgba(168,85,247,0.15)", backgroundColor: "rgba(168,85,247,0.03)" }}>
      <ShieldAlert className="h-6 w-6 text-purple-500 dark:text-purple-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <h4 className="text-sm font-bold">ข้อมูลความปลอดภัยและบทบาท (Student Policy)</h4>
        <p className="text-xs leading-relaxed" style={{ color: tx.secondary }}>
          เนื่องจากสิทธิ์ของคุณเป็น <strong>ผู้เรียน (Student)</strong> ระบบจะไม่มีความสามารถในการแก้ไข ลบ หรือสร้างห้องสนทนาใหม่ได้ คุณมีสิทธิ์เข้าศึกษาและทำงานตามตารางเวลาที่คุณครูเป็นผู้จัดการเท่านั้น
        </p>
      </div>
    </div>
  );
}
