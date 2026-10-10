import React, { useMemo, useState } from "react";
import { X, Users, UserPlus } from "lucide-react";
import { tx } from "../../lib/theme";
import type { AppUser, CourseLevelOption, Enrollment } from "../../context/UserContext";
import { Portal } from "@/app/components/Portal";

interface AddStudentModalProps {
  setShowAddStudentModal: (show: boolean) => void;
  appUsers: AppUser[];
  enrollments: Enrollment[];
  selectedCourseId: string | null;
  levels: CourseLevelOption[];
  teacherAddStudents: (courseId: string, studentIds: string[]) => Promise<{ success: boolean; error?: string }>;
}

export function AddStudentModal({ setShowAddStudentModal, appUsers, enrollments, selectedCourseId, levels, teacherAddStudents }: AddStudentModalProps) {
  const [mode, setMode] = useState<"individual" | "class">("individual");
  const [levelFilter, setLevelFilter] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [classLevel, setClassLevel] = useState("");
  const [saving, setSaving] = useState(false);

  const availableStudents = useMemo(() => {
    const enrolledIds = new Set(enrollments.filter((item) => item.courseId === selectedCourseId).map((item) => item.studentId));
    return appUsers.filter((user) => user.role === "student" && !enrolledIds.has(user.id));
  }, [appUsers, enrollments, selectedCourseId]);
  const filteredStudents = useMemo(() => availableStudents.filter((student) => !levelFilter || student.studentLevel === levelFilter), [availableStudents, levelFilter]);

  const studentsInSelectedClass = useMemo(() => availableStudents.filter((student) => student.studentLevel === classLevel), [availableStudents, classLevel]);
  const availableStudentIds = new Set(availableStudents.map((student) => student.id));
  const selectedAvailableStudentIds = selectedStudentIds.filter((id) => availableStudentIds.has(id));
  const studentIdsToEnroll = mode === "individual" ? selectedAvailableStudentIds : studentsInSelectedClass.map((student) => student.id);
  const toggleStudent = (studentId: string) => setSelectedStudentIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  const close = () => setShowAddStudentModal(false);

  const handleEnroll = async () => {
    if (!selectedCourseId || studentIdsToEnroll.length === 0) return;
    setSaving(true);
    const result = await teacherAddStudents(selectedCourseId, studentIdsToEnroll);
    setSaving(false);
    if (result.success) close();
  };

  return <Portal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
        <div className="p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: tx.borderS }}>
          <h2 className="text-xl font-bold">ดึงนักเรียนเข้าคอร์สเรียน</h2>
          <button onClick={close} disabled={saving} className="btn-icon p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"><X className="h-5 w-5" style={{ color: tx.secondary }} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 text-left space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setMode("individual")} className={`rounded-xl border p-4 text-left transition-colors ${mode === "individual" ? "border-indigo-500 bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`} style={mode === "individual" ? undefined : { borderColor: tx.borderS }}><UserPlus className="h-5 w-5 mb-2 text-indigo-500" /><p className="text-sm font-bold">รายบุคคล</p><p className="mt-1 text-xs" style={{ color: tx.muted }}>เลือกนักเรียนได้หลายคน และกรองตามชั้นเรียน</p></button>
            <button type="button" onClick={() => setMode("class")} className={`rounded-xl border p-4 text-left transition-colors ${mode === "class" ? "border-indigo-500 bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`} style={mode === "class" ? undefined : { borderColor: tx.borderS }}><Users className="h-5 w-5 mb-2 text-indigo-500" /><p className="text-sm font-bold">รายชั้นเรียน</p><p className="mt-1 text-xs" style={{ color: tx.muted }}>เพิ่มนักเรียนที่ยังไม่อยู่ในคอร์สทั้งหมดของชั้นที่เลือก</p></button>
          </div>
          {mode === "individual" ? <>
            <div className="space-y-1.5"><label className="text-xs font-bold" style={{ color: tx.muted }}>กรองชั้นเรียน</label><select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="w-full px-4 py-3 rounded-xl border bg-transparent text-sm" style={{ borderColor: tx.borderS, color: tx.primary }}><option value="">ทุกชั้นเรียน</option>{levels.map((level) => <option key={level.id} value={level.value}>{level.label}</option>)}</select></div>
            <div className="space-y-2"><div className="flex items-center justify-between text-xs" style={{ color: tx.muted }}><span>เลือกแล้ว {selectedAvailableStudentIds.length} คน</span><button type="button" onClick={() => setSelectedStudentIds(filteredStudents.map((student) => student.id))} className="font-bold text-indigo-500">เลือกทั้งหมด</button></div>
              <div className="max-h-64 overflow-y-auto rounded-xl border divide-y" style={{ borderColor: tx.borderS }}>{filteredStudents.map((student) => <label key={student.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"><input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} className="h-4 w-4 rounded text-indigo-600" /><span className="flex-1 text-sm font-medium">{student.displayName} <span className="font-normal" style={{ color: tx.muted }}>({student.username})</span></span><span className="text-xs" style={{ color: tx.muted }}>{levels.find((level) => level.value === student.studentLevel)?.label ?? student.studentLevel ?? "ไม่ระบุชั้น"}</span></label>)}{filteredStudents.length === 0 && <p className="p-5 text-center text-sm" style={{ color: tx.muted }}>ไม่พบนักเรียนที่ยังไม่ได้อยู่ในคอร์ส</p>}</div>
            </div>
          </> : <div className="space-y-3"><label className="text-xs font-bold" style={{ color: tx.muted }}>เลือกชั้นเรียนที่จะดึงเข้าคอร์ส</label><select value={classLevel} onChange={(event) => setClassLevel(event.target.value)} className="w-full px-4 py-3 rounded-xl border bg-transparent text-sm" style={{ borderColor: tx.borderS, color: tx.primary }}><option value="" disabled>-- เลือกชั้นเรียน --</option>{levels.map((level) => <option key={level.id} value={level.value}>{level.label}</option>)}</select>{classLevel && <div className="rounded-xl p-4 bg-indigo-500/10 text-sm text-indigo-700 dark:text-indigo-300">จะเพิ่มนักเรียนที่ยังไม่อยู่ในคอร์สจำนวน <strong>{studentsInSelectedClass.length}</strong> คน</div>}</div>}
        </div>
        <div className="p-6 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}><button type="button" onClick={close} disabled={saving} className="btn-cancel px-5 py-2.5 rounded-xl text-sm font-bold">ยกเลิก</button><button type="button" disabled={saving || studentIdsToEnroll.length === 0} onClick={handleEnroll} className="btn-primary px-6 py-2.5 rounded-xl text-sm shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer">{saving ? "กำลังเพิ่ม..." : `ยืนยันเพิ่ม ${studentIdsToEnroll.length} คน`}</button></div>
      </div>
    </div>
  </Portal>;
}
