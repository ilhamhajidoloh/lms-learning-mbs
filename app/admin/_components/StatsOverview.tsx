import { Shield, Users, BookOpen, GraduationCap } from "lucide-react";
import { StatCard } from "../../components/StatCard";
import { HeroBanner } from "../../components/HeroBanner";

interface StatsOverviewProps {
  displayName: string;
  counts: {
    total: number;
    admin: number;
    teacher: number;
    student: number;
  };
}

export function StatsOverview({ displayName, counts }: StatsOverviewProps) {
  return (
    <>
      <HeroBanner
        gradient="from-rose-900 via-pink-950 to-slate-950"
        badge="Admin Console"
        title={`สวัสดีครับ, ${displayName}`}
        subtitle="จัดการผู้ใช้งานในระบบ Math by Seng LMS — เพิ่ม แก้ไข หรือลบบัญชีผู้ใช้ได้จากหน้านี้"
        className="animate-slideInUp"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-6 w-6" />} label="ผู้ใช้ทั้งหมด" value={counts.total} accent="indigo" className="animate-slideInUp stagger-1" />
        <StatCard icon={<Shield className="h-6 w-6" />} label="Admin" value={counts.admin} accent="rose" className="animate-slideInUp stagger-2" />
        <StatCard icon={<BookOpen className="h-6 w-6" />} label="ครูผู้สอน" value={counts.teacher} accent="indigo" className="animate-slideInUp stagger-3" />
        <StatCard icon={<GraduationCap className="h-6 w-6" />} label="นักเรียน" value={counts.student} accent="purple" className="animate-slideInUp stagger-4" />
      </div>
    </>
  );
}
