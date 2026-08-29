"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser, type AppUser, type Role } from "../context/UserContext";
import { apiFetch } from "../../lib/api";
import { toast, alert as swalAlert } from "../../lib/swal";
import LoadingScreen from "../components/LoadingScreen";
import { tx } from "../lib/theme";
import { AdminHeader } from "./_components/AdminHeader";
import { StatsOverview } from "./_components/StatsOverview";
import { CourseLevelsPanel } from "./_components/CourseLevelsPanel";
import { UserTable } from "./_components/UserTable";
import { UserFormModal } from "./_components/UserFormModal";
import { DeleteConfirmModal } from "./_components/DeleteConfirmModal";

const EMPTY_FORM = { username: "", displayName: "", role: "student" as Role };

export default function AdminPage() {
  const { role, isAuthenticated, displayName, logout, darkMode, toggleDarkMode, loadingData, courses, refreshData, levels, addLevel, deleteLevel, currentUserId } = useUser();
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
      queueMicrotask(() => {
        void fetchUsers();
      });
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

  const hasOtherAdmin = dbUsers.some(u => u.role === "admin" && u.id !== editingUser?.id);

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
      // สร้าง user ใหม่จากแอดมิน
      const { data, error } = await apiFetch<{ generatedPassword?: string; message?: string }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: formData.username.trim(),
          displayName: formData.displayName.trim(),
          role: formData.role,
        }),
      });

      if (error) {
        setFormError("สร้างผู้ใช้งานไม่สำเร็จ: " + error);
        return;
      }
      
      if (data?.generatedPassword) {
        swalAlert.success(
          "สร้างผู้ใช้งานสำเร็จ",
          `Username: ${formData.username.trim()}\nรหัสผ่านชั่วคราว: ${data.generatedPassword}\n\nกรุณาบอกให้ผู้ใช้งานทราบรหัสผ่านนี้`
        );
      } else {
        toast.success("สร้างผู้ใช้งานสำเร็จ!");
      }
      fetchUsers();
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
      <AdminHeader
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        displayName={displayName}
        onProfileClick={() => router.push("/profile")}
        logout={logout}
      />

      {/* ── MAIN ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        <StatsOverview displayName={displayName} counts={counts} />

        <CourseLevelsPanel courses={courses} levels={levels} addLevel={addLevel} deleteLevel={deleteLevel} refreshData={refreshData} />

        <UserTable
          dbUsers={dbUsers}
          filtered={filtered}
          loadingUsers={loadingUsers}
          search={search}
          setSearch={setSearch}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          openCreate={openCreate}
          openEdit={openEdit}
          setDeleteId={setDeleteId}
          currentUserId={currentUserId}
        />
      </main>

      <footer className="py-6 mt-4 border-t text-center text-xs" style={{ borderColor: tx.borderS, color: tx.faint }}>
        © 2026 Math by Seng — Admin Console
      </footer>

      {/* ── CREATE / EDIT MODAL ──────────────────────────────── */}
      {showForm && (
        <UserFormModal
          editingUser={editingUser}
          formData={formData}
          setFormData={setFormData}
          formError={formError}
          setFormError={setFormError}
          closeForm={closeForm}
          handleSubmit={handleSubmit}
          hasOtherAdmin={hasOtherAdmin}
        />
      )}

      {/* ── DELETE CONFIRM MODAL ─────────────────────────────── */}
      {deleteId && (() => {
        const target = dbUsers.find(u => u.id === deleteId);
        return (
          <DeleteConfirmModal
            target={target}
            onCancel={() => setDeleteId(null)}
            onConfirm={handleDelete}
          />
        );
      })()}
    </div>
  );
}
