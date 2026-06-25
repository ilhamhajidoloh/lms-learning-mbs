"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, Users, BookOpen, GraduationCap, Moon, Sun, LogOut,
  Search, UserPlus, Pencil, Trash2, X, Check, AlertTriangle,
  Sparkles, ChevronDown
} from "lucide-react";
import { useUser, type AppUser, type Role } from "../context/UserContext";
import { apiFetch } from "../../lib/api";
import { toast, alert as swalAlert } from "../../lib/swal";
import LoadingScreen from "../components/LoadingScreen";

const tx = {
  primary:   "var(--text-primary)",
  secondary: "var(--text-secondary)",
  muted:     "var(--text-muted)",
  faint:     "var(--text-faint)",
  base:      "var(--bg-base)",
  surface:   "var(--bg-surface)",
  elevated:  "var(--bg-elevated)",
  border:    "var(--border-base)",
  borderS:   "var(--border-subtle)",
  accent:    "var(--color-accent)",
  accentBg:  "var(--color-accent-bg)",
};

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  admin:   { label: "Admin",   color: "#f43f5e", bg: "rgba(244,63,94,0.1)",   icon: <Shield        className="h-3.5 w-3.5" /> },
  teacher: { label: "Teacher", color: "#6366f1", bg: "rgba(99,102,241,0.1)",  icon: <BookOpen      className="h-3.5 w-3.5" /> },
  student: { label: "Student", color: "#a855f7", bg: "rgba(168,85,247,0.1)",  icon: <GraduationCap className="h-3.5 w-3.5" /> },
};

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

const EMPTY_FORM = { username: "", displayName: "", role: "student" as Role };

export default function AdminPage() {
  const { role, isAuthenticated, displayName, logout, darkMode, toggleDarkMode, loadingData } = useUser();
  const router = useRouter();

  const [search,      setSearch]      = useState("");
  const [roleFilter,  setRoleFilter]  = useState<"all" | Role>("all");
  const [showForm,    setShowForm]    = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [formData,    setFormData]    = useState(EMPTY_FORM);
  const [formError,   setFormError]   = useState<string | null>(null);

  const [dbUsers, setDbUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data } = await apiFetch<AppUser[]>("/api/profiles");
    if (data) {
      setDbUsers(data);
    }
    setLoadingUsers(false);
  };

  useEffect(() => {
    if (isAuthenticated && role === "admin") {
      fetchUsers();
    }
  }, [isAuthenticated, role]);

  useEffect(() => {
    if (loadingData) return;
    if (!isAuthenticated) router.push("/login");
    else if (role !== "admin") router.push("/");
  }, [isAuthenticated, role, router, loadingData]);

  if (loadingData) return <LoadingScreen />;

  if (!isAuthenticated || role !== "admin") return null;

  // ── Derived data ─────────────────────────────────────────────
  const filtered = dbUsers.filter(u => {
    const matchSearch =
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const counts = {
    total:   dbUsers.length,
    admin:   dbUsers.filter(u => u.role === "admin").length,
    teacher: dbUsers.filter(u => u.role === "teacher").length,
    student: dbUsers.filter(u => u.role === "student").length,
  };

  // ── Form handlers ─────────────────────────────────────────────
  const openCreate = () => {
    setEditingUser(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormData({ username: user.username, displayName: user.displayName, role: user.role });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingUser(null); setFormData(EMPTY_FORM); setFormError(null); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.displayName.trim()) {
      setFormError("กรุณากรอก Username และชื่อแสดงผลให้ครบ");
      return;
    }
    const duplicate = dbUsers.find(
      u => u.username === formData.username.trim() && u.id !== editingUser?.id
    );
    if (duplicate) { setFormError("Username นี้มีในระบบแล้ว"); return; }

    if (editingUser) {
      const { error } = await apiFetch("/api/profiles", {
        method: "PUT",
        body: JSON.stringify({
          id: editingUser.id,
          username: formData.username.trim(),
          displayName: formData.displayName.trim(),
          role: formData.role,
        }),
      });

      if (error) {
        setFormError("อัปเดตข้อมูลไม่สำเร็จ: " + error);
        return;
      }
      toast.success("อัปเดตข้อมูลสำเร็จ!");
      fetchUsers();
    } else {
      swalAlert.warning("ไม่สามารถเพิ่มผู้ใช้งาน", "การเพิ่มผู้ใช้งานใหม่จากหน้า Admin จะต้องให้ผู้ใช้งานสมัครสมาชิกด้วยตัวเอง");
      return;
    }
    closeForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      const loadingToast = toast.loading("กำลังลบผู้ใช้งาน...");
      const { error } = await apiFetch("/api/profiles", {
        method: "DELETE",
        body: JSON.stringify({ id: deleteId }),
      });
      loadingToast.close();
      if (!error) {
        toast.success("ลบผู้ใช้งานสำเร็จ!");
        fetchUsers();
      } else {
        swalAlert.error("ลบข้อมูลไม่สำเร็จ", error);
      }
      setDeleteId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass-panel shadow-sm" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-orange-400 flex items-center justify-center text-white shadow-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400 bg-clip-text text-transparent text-xl font-bold tracking-tight">
                  Math by Seng
                </span>
                <span className="block text-[10px] font-bold tracking-widest uppercase -mt-1" style={{ color: tx.muted }}>
                  Admin Console
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={toggleDarkMode} className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors" style={{ color: tx.secondary }}>
                {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-rose-500" />}
              </button>
              <div className="h-8 w-px" style={{ backgroundColor: tx.borderS }} />
              <div className="flex items-center gap-3 pl-1">
                <button onClick={() => router.push("/profile")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity" title="ดูโปรไฟล์">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-rose-500 to-orange-400 flex items-center justify-center text-white font-bold shadow-md">
                    A
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-bold leading-tight">{displayName}</p>
                    <p className="text-[10px]" style={{ color: tx.muted }}>System Administrator</p>
                  </div>
                </button>
                <button onClick={logout} className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors" title="ออกจากระบบ">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ── MAIN ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Welcome Banner */}
        <div className="rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl text-white bg-gradient-to-r from-rose-900 via-pink-950 to-slate-950">
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-300 via-pink-900 to-rose-950" />
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <Shield className="h-3 w-3" /> Admin Console
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">สวัสดีครับ, {displayName} 🛡️</h1>
            <p className="text-rose-200 text-sm max-w-xl">
              จัดการผู้ใช้งานในระบบ Math by Seng LMS — เพิ่ม แก้ไข หรือลบบัญชีผู้ใช้ได้จากหน้านี้
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "ผู้ใช้ทั้งหมด",  value: counts.total,   icon: <Users className="h-6 w-6" />,         color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
            { label: "Admin",           value: counts.admin,   icon: <Shield className="h-6 w-6" />,        color: "#f43f5e", bg: "rgba(244,63,94,0.1)"   },
            { label: "ครูผู้สอน",      value: counts.teacher, icon: <BookOpen className="h-6 w-6" />,      color: "#6366f1", bg: "rgba(99,102,241,0.1)"  },
            { label: "นักเรียน",        value: counts.student, icon: <GraduationCap className="h-6 w-6" />, color: "#a855f7", bg: "rgba(168,85,247,0.1)"  },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-5 flex items-center justify-between shadow-sm"
              style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>{s.label}</p>
                <p className="text-3xl font-extrabold mt-0.5">{s.value}</p>
              </div>
              <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.bg, color: s.color }}>
                {s.icon}
              </div>
            </div>
          ))}
        </div>

        {/* User Management */}
        <div className="rounded-3xl shadow-sm" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>

          {/* Table Header */}
          <div className="px-6 pt-6 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            style={{ borderBottom: `1px solid ${tx.borderS}` }}>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-rose-500" /> จัดการผู้ใช้งาน
              </h2>
              <p className="text-xs mt-0.5" style={{ color: tx.muted }}>ทั้งหมด {dbUsers.length} บัญชี</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all"
            >
              <UserPlus className="h-4 w-4" /> เพิ่มผู้ใช้ใหม่
            </button>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 flex flex-col sm:flex-row gap-3" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: tx.faint }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหา Username หรือชื่อผู้ใช้..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                style={{ borderColor: tx.border, color: tx.primary }}
              />
            </div>

            {/* Role Filter */}
            <div className="relative">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value as typeof roleFilter)}
                className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border bg-transparent text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                style={{ borderColor: tx.border, color: tx.primary }}
              >
                <option value="all">ทุก Role</option>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: tx.faint }} />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr style={{ borderBottom: `1px solid ${tx.borderS}` }}>
                  {["#", "Username", "ชื่อแสดงผล", "Role", "วันที่สร้าง", "จัดการ"].map(h => (
                    <th key={h} className="px-6 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm" style={{ color: tx.muted }}>
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                        กำลังโหลดข้อมูลผู้ใช้...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm" style={{ color: tx.muted }}>
                      ไม่พบผู้ใช้งานที่ตรงกับเงื่อนไข
                    </td>
                  </tr>
                ) : filtered.map((u, idx) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-200/30 dark:hover:bg-slate-700/20 transition-colors"
                    style={{ borderBottom: `1px solid ${tx.borderS}` }}
                  >
                    <td className="px-6 py-4 text-xs font-mono" style={{ color: tx.faint }}>{idx + 1}</td>
                    <td className="px-6 py-4 font-mono font-semibold text-xs">{u.username}</td>
                    <td className="px-6 py-4 font-semibold">{u.displayName}</td>
                    <td className="px-6 py-4"><RoleBadge role={u.role} /></td>
                    <td className="px-6 py-4 text-xs" style={{ color: tx.muted }}>
                      {new Date(u.createdAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg transition-colors text-indigo-500 hover:bg-indigo-500/10"
                          title="แก้ไข"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(u.id)}
                          className="p-1.5 rounded-lg transition-colors text-rose-500 hover:bg-rose-500/10"
                          title="ลบ"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-6 py-3 text-xs" style={{ borderTop: `1px solid ${tx.borderS}`, color: tx.faint }}>
            แสดง {filtered.length} จาก {dbUsers.length} บัญชี
          </div>
        </div>
      </main>

      <footer className="py-6 mt-4 border-t text-center text-xs" style={{ borderColor: tx.borderS, color: tx.faint }}>
        © 2026 Math by Seng — Admin Console
      </footer>

      {/* ── CREATE / EDIT MODAL ──────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl animate-fadeIn"
            style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}`, color: tx.primary }}
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-4" style={{ borderBottom: `1px solid ${tx.borderS}` }}>
              <h3 className="text-lg font-bold flex items-center gap-2">
                {editingUser ? <><Pencil className="h-5 w-5 text-indigo-500" /> แก้ไขผู้ใช้</> : <><UserPlus className="h-5 w-5 text-rose-500" /> เพิ่มผู้ใช้ใหม่</>}
              </h3>
              <button type="button" onClick={closeForm} className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/40 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={e => { setFormData(p => ({ ...p, username: e.target.value })); setFormError(null); }}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500 bg-transparent text-sm"
                style={{ borderColor: tx.border, color: tx.primary }}
                placeholder="เช่น student01"
                required
              />
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>ชื่อแสดงผล (Display Name)</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={e => { setFormData(p => ({ ...p, displayName: e.target.value })); setFormError(null); }}
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500 bg-transparent text-sm"
                style={{ borderColor: tx.border, color: tx.primary }}
                placeholder="เช่น สมศรี มีสุข"
                required
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: tx.muted }}>บทบาท (Role)</label>
                {editingUser?.role === "admin" && (
                  <span className="text-[10px] text-rose-500 font-medium">ไม่สามารถเปลี่ยนสิทธิ์ Admin ได้</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(["admin", "teacher", "student"] as Role[]).map(r => {
                  const cfg = ROLE_CONFIG[r];
                  const active = formData.role === r;
                  const disabled = editingUser?.role === "admin";

                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={disabled}
                      onClick={() => setFormData(p => ({ ...p, role: r }))}
                      className={`py-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${disabled ? (active ? '' : 'opacity-40 cursor-not-allowed') : 'cursor-pointer'}`}
                      style={active
                        ? { borderColor: cfg.color, color: cfg.color, backgroundColor: cfg.bg }
                        : { borderColor: tx.borderS, color: tx.secondary }}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error */}
            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {formError}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2" style={{ borderTop: `1px solid ${tx.borderS}` }}>
              <button
                type="button"
                onClick={closeForm}
                className="py-2.5 px-5 rounded-xl border font-bold text-sm cursor-pointer"
                style={{ borderColor: tx.borderS, color: tx.secondary }}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                {editingUser ? "บันทึกการแก้ไข" : "สร้างผู้ใช้"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ─────────────────────────────── */}
      {deleteId && (() => {
        const target = dbUsers.find(u => u.id === deleteId);
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
                  onClick={() => setDeleteId(null)}
                  className="py-2.5 px-5 rounded-xl border font-bold text-sm cursor-pointer"
                  style={{ borderColor: tx.borderS, color: tx.secondary }}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleDelete}
                  className="py-2.5 px-6 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="h-4 w-4" /> ลบบัญชี
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
