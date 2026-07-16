import React, { useState } from "react";
import { BookOpen, Check, ChevronDown, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { alert as swalAlert, toast } from "../../../lib/swal";
import { tx } from "../../lib/theme";
import type { Course, CourseLevelOption } from "../../context/UserContext";
import { EmptyState } from "../../components/EmptyState";

interface CourseLevelsPanelProps {
  courses: Course[];
  levels: CourseLevelOption[];
  addLevel: (value: string, label: string) => Promise<{ success: boolean; error?: string }>;
  deleteLevel: (id: string) => Promise<{ success: boolean; error?: string }>;
  refreshData: () => Promise<void>;
}

interface CourseLevelFormState {
  id: string;
  level: string;
  levelLabel: string;
}

export function CourseLevelsPanel({ courses, levels, addLevel, deleteLevel, refreshData }: CourseLevelsPanelProps) {
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseLevelFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newLevelValue, setNewLevelValue] = useState("");
  const [newLevelLabel, setNewLevelLabel] = useState("");
  const [addingLevel, setAddingLevel] = useState(false);

  const filteredCourses = courses.filter((course) => {
    const query = search.toLowerCase();
    return (
      course.title.toLowerCase().includes(query) ||
      course.instructor.toLowerCase().includes(query) ||
      course.levelLabel.toLowerCase().includes(query) ||
      course.level.toLowerCase().includes(query)
    );
  });

  const openEditor = (course: Course) => {
    setSelectedCourse(course);
    setForm({
      id: course.id,
      level: course.level,
      levelLabel: course.levelLabel || course.title,
    });
    setError("");
  };

  const closeEditor = () => {
    setSelectedCourse(null);
    setForm(null);
    setError("");
  };

  const handleLevelChange = (level: string) => {
    const preset = levels.find((item) => item.value === level);
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        level,
        levelLabel: preset?.label ?? current.levelLabel,
      };
    });
  };

  const handleAddLevel = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = newLevelValue.trim();
    const label = newLevelLabel.trim();
    if (!value || !label) return;

    setAddingLevel(true);
    const { success } = await addLevel(value, label);
    setAddingLevel(false);
    if (success) {
      setNewLevelValue("");
      setNewLevelLabel("");
    }
  };

  const handleDeleteLevel = async (id: string) => {
    const confirmed = await swalAlert.confirm(
      "ลบระดับชั้นเรียนนี้?",
      "คอร์สที่ใช้ระดับนี้อยู่จะไม่ถูกลบ แต่จะไม่แสดงในรายการเลือกอีกต่อไป"
    );
    if (!confirmed) return;
    await deleteLevel(id);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    const levelValue = form.level.trim();
    const levelLabel = form.levelLabel.trim();

    if (!levelValue || !levelLabel) {
      setError("กรุณากำหนดระดับและชื่อที่แสดงให้ครบ");
      return;
    }

    setSaving(true);
    setError("");
    const loadingToast = toast.loading("กำลังบันทึกระดับคอร์ส...");

    try {
      const { error: requestError } = await apiFetch("/api/courses", {
        method: "PUT",
        body: JSON.stringify({
          id: form.id,
          level: levelValue,
          levelLabel,
        }),
      });

      loadingToast.close();

      if (requestError) {
        setError("บันทึกไม่สำเร็จ: " + requestError);
        return;
      }

      toast.success("บันทึกระดับคอร์สสำเร็จ!");
      await refreshData();
      closeEditor();
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      setError("บันทึกไม่สำเร็จ: " + message);
      swalAlert.error("บันทึกไม่สำเร็จ", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl shadow-sm" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
      <div className="px-6 pt-6 pb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" /> จัดการประเภทชั้นเรียน
          </h2>
          <p className="text-xs mt-0.5" style={{ color: tx.muted }}>แอดมินสามารถปรับระดับและชื่อที่แสดงของคอร์สได้</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: tx.faint }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาคอร์ส ชื่อครู หรือระดับ"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ borderColor: tx.border, color: tx.primary }}
          />
        </div>
      </div>

      <div className="p-6 space-y-3" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
        <h3 className="text-sm font-bold">รายการระดับชั้นเรียน</h3>
        <p className="text-xs" style={{ color: tx.muted }}>เพิ่มระดับที่นี่ก่อน แล้วครูจะเลือกระดับนี้ได้ตอนสร้างคอร์สใหม่</p>

        <div className="flex flex-wrap gap-2">
          {levels.length === 0 ? (
            <p className="text-xs" style={{ color: tx.faint }}>ยังไม่มีระดับชั้นเรียน กรุณาเพิ่มระดับด้านล่าง</p>
          ) : (
            levels.map((lvl) => (
              <span
                key={lvl.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800"
                style={{ color: tx.secondary }}
              >
                {lvl.label}
                <span className="opacity-60">({lvl.value})</span>
                <button
                  type="button"
                  onClick={() => handleDeleteLevel(lvl.id)}
                  className="hover:text-rose-500 transition-colors cursor-pointer btn-icon"
                  aria-label={`ลบระดับ ${lvl.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))
          )}
        </div>

        <form onSubmit={handleAddLevel} className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="text"
            value={newLevelValue}
            onChange={(e) => setNewLevelValue(e.target.value)}
            placeholder="รหัสระดับ เช่น m4"
            className="flex-1 px-3 py-2 rounded-xl border bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ borderColor: tx.border, color: tx.primary }}
          />
          <input
            type="text"
            value={newLevelLabel}
            onChange={(e) => setNewLevelLabel(e.target.value)}
            placeholder="ชื่อที่แสดง เช่น ม.4"
            className="flex-1 px-3 py-2 rounded-xl border bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ borderColor: tx.border, color: tx.primary }}
          />
          <button
            type="submit"
            disabled={addingLevel || !newLevelValue.trim() || !newLevelLabel.trim()}
            className="btn-primary inline-flex items-center justify-center gap-1.5 text-xs px-4 py-2 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> เพิ่มระดับ
          </button>
        </form>
      </div>

      <div className="p-6">
        {filteredCourses.length === 0 ? (
          <EmptyState
            illustration="search"
            variant="compact"
            accent="slate"
            title="ไม่พบคอร์สที่ตรงกับเงื่อนไข"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCourses.map((course) => (
              <div key={course.id} className="rounded-2xl p-4 border flex flex-col justify-between gap-4" style={{ borderColor: tx.borderS }}>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold leading-snug line-clamp-2">{course.title}</h3>
                      <p className="text-xs mt-1" style={{ color: tx.muted }}>{course.instructor}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 whitespace-nowrap">
                      {course.levelLabel}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                    <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800" style={{ color: tx.secondary }}>
                      รหัสระดับ: {course.level}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800" style={{ color: tx.secondary }}>
                      {course.lessonsCount} บทเรียน
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openEditor(course)}
                  className="btn-primary inline-flex items-center justify-center gap-1.5 text-xs px-4 py-2.5"
                >
                  <Pencil className="h-4 w-4" /> แก้ไขระดับ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedCourse && form && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-3xl shadow-2xl border overflow-hidden" style={{ backgroundColor: tx.surface, borderColor: tx.borderS, color: tx.primary }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: tx.borderS }}>
              <h3 className="text-lg font-bold">แก้ไขประเภทชั้นเรียน</h3>
              <p className="text-xs mt-1" style={{ color: tx.muted }}>{selectedCourse.title}</p>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-bold border border-rose-500/20">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ระดับหลัก</label>
                {levels.length === 0 ? (
                  <p className="text-xs p-3 rounded-xl bg-amber-500/10 text-amber-600 font-bold">
                    ยังไม่มีระดับชั้นเรียนในระบบ กรุณาเพิ่มระดับด้านบนก่อน
                  </p>
                ) : (
                  <div className="relative">
                    <select
                      value={form.level}
                      onChange={(e) => handleLevelChange(e.target.value)}
                      className="w-full appearance-none px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                      style={{ borderColor: tx.border, color: tx.primary }}
                    >
                      {!levels.some((lvl) => lvl.value === form.level) && (
                        <option value={form.level} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          {form.levelLabel} (ไม่อยู่ในรายการ)
                        </option>
                      )}
                      {levels.map((lvl) => (
                        <option key={lvl.id} value={lvl.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          {lvl.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: tx.faint }} />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ชื่อที่แสดง</label>
                <input
                  type="text"
                  value={form.levelLabel}
                  onChange={(e) => setForm((current) => current ? { ...current, levelLabel: e.target.value } : current)}
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-sm"
                  style={{ borderColor: tx.border, color: tx.primary }}
                  placeholder="เช่น ม.4, ม.5, ม.6 หรือชื่อระดับที่กำหนดเอง"
                />
              </div>

              <div className="rounded-2xl p-4 border" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ตัวอย่างผลลัพธ์</p>
                <p className="mt-2 font-bold">{form.levelLabel || "-"}</p>
                <p className="text-xs mt-1" style={{ color: tx.muted }}>รหัสระดับ: {form.level || "-"}</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="btn-cancel px-4 py-2.5 rounded-xl text-sm font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <Check className="h-4 w-4" /> {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}