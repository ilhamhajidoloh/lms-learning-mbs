import { Users, Search, UserPlus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { tx } from "../../lib/theme";
import type { AppUser, Role } from "../../context/UserContext";
import { RoleBadge } from "./RoleBadge";

interface UserTableProps {
  dbUsers: AppUser[];
  filtered: AppUser[];
  loadingUsers: boolean;
  search: string;
  setSearch: (value: string) => void;
  roleFilter: "all" | Role;
  setRoleFilter: (value: "all" | Role) => void;
  openCreate: () => void;
  openEdit: (user: AppUser) => void;
  setDeleteId: (id: string | null) => void;
  currentUserId: string | null;
}

export function UserTable({
  dbUsers,
  filtered,
  loadingUsers,
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  openCreate,
  openEdit,
  setDeleteId,
  currentUserId,
}: UserTableProps) {
  return (
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
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => setDeleteId(u.id)}
                        className="p-1.5 rounded-lg transition-colors text-rose-500 hover:bg-rose-500/10"
                        title="ลบ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
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
  );
}
