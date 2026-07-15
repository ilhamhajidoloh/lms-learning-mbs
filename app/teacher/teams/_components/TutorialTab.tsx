import { Layers } from "lucide-react";
import { tx, card } from "../../../lib/theme";

export default function TutorialTab() {
  return (
    <div className="rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl animate-fadeIn text-left" style={card.style}>
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Layers className="h-6 w-6 text-indigo-500" /> ขั้นตอนและสถาปัตยกรรมการต่อ Graph API
      </h2>
      <div className="space-y-4 text-sm leading-relaxed" style={{ color: tx.secondary }}>
        <p>
          ในระบบบริหารจัดการโรงเรียน/การกวดวิชา (LMS) ยุคใหม่ หน้าจอครูผู้สอนจะทำหน้าที่ส่ง Request ไปยัง Microsoft Graph API เพื่อขอพื้นที่จัดตั้งห้องเรียนไลฟ์ดังนี้:
        </p>
        <ol className="list-decimal list-inside space-y-2 pl-2">
          <li>
            <strong>ลงทะเบียนแอปพลิเคชัน (Azure AD Portal)</strong>: ลงทะเบียน Client ID, Tenant ID และมอบสิทธิ์การทำงานระดับ Application/Delegated Permission ในขอบเขต <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-mono text-xs">OnlineMeetings.ReadWrite</code>
          </li>
          <li>
            <strong>รับส่งสิทธิ์ OAuth 2.0 Client Credentials</strong>: แลกเปลี่ยนข้อมูลลับเพื่อรับ Access Token ในรูปของ JWT string สำหรับยืนยันตัวตน
          </li>
          <li>
            <strong>เรียก API ของ Microsoft Teams</strong>: ยิง POST ไปยัง endpoint <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-mono text-xs">/v1.0/me/onlineMeetings</code>
          </li>
        </ol>
      </div>
    </div>
  );
}
