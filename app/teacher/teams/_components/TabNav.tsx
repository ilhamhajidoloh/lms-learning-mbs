import { tx } from "../../../lib/theme";

type TabKey = "demo" | "tutorial" | "code";

interface TabNavProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

export default function TabNav({ activeTab, setActiveTab }: TabNavProps) {
  return (
    <div className="flex justify-start md:justify-center border-b overflow-x-auto whitespace-nowrap scrollbar-none" style={{ borderColor: tx.borderS }}>
      <div className="flex space-x-6 text-sm font-medium pb-px">
        <button onClick={() => setActiveTab("demo")} className="pb-3 border-b-2 transition-all px-1 shrink-0" style={activeTab === "demo" ? { borderBottomColor: tx.accent, color: tx.accent, fontWeight: 700 } : { borderBottomColor: "transparent", color: tx.secondary }}>
          ตัวจำลองระบบการสร้าง (API Demo)
        </button>
        <button onClick={() => setActiveTab("tutorial")} className="pb-3 border-b-2 transition-all px-1 shrink-0" style={activeTab === "tutorial" ? { borderBottomColor: tx.accent, color: tx.accent, fontWeight: 700 } : { borderBottomColor: "transparent", color: tx.secondary }}>
          คู่มือการเชื่อมต่อ (Graph API Guide)
        </button>
        <button onClick={() => setActiveTab("code")} className="pb-3 border-b-2 transition-all px-1 shrink-0" style={activeTab === "code" ? { borderBottomColor: tx.accent, color: tx.accent, fontWeight: 700 } : { borderBottomColor: "transparent", color: tx.secondary }}>
          ชุดโค้ดโปรแกรม (Source Code)
        </button>
      </div>
    </div>
  );
}
