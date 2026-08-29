"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useUser } from "../context/UserContext";
import { tx } from "../lib/theme";
import { alert } from "../../lib/swal";

export default function ChangePasswordPage() {
  const { isAuthenticated, passwordChanged, updatePassword } = useUser();
  const router = useRouter();
  const [newPw, setNewPw] = useState("");
  const [cPw, setCPw] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    } else if (passwordChanged) {
      router.push("/");
    }
  }, [isAuthenticated, passwordChanged, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);

    if (!newPw || !cPw) {
      setPwError("กรุณากรอกให้ครบทุกช่อง");
      return;
    }
    if (newPw.length < 6) {
      setPwError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (newPw !== cPw) {
      setPwError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setLoading(true);
    const result = await updatePassword("", newPw);
    setLoading(false);

    if (!result.success) {
      setPwError(result.error ?? "เกิดข้อผิดพลาด");
      return;
    }

    alert.success("เปลี่ยนรหัสผ่านสำเร็จ", "กำลังเข้าสู่ระบบ...");
    setNewPw("");
    setCPw("");
    router.push("/");
  };

  if (!isAuthenticated || passwordChanged) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: tx.base, color: tx.primary }}>
      <div className="w-full max-w-md rounded-3xl p-8 shadow-lg space-y-6" style={{ backgroundColor: tx.surface, border: `1px solid ${tx.borderS}` }}>
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full" style={{ backgroundColor: `${tx.border}40` }}>
              <Lock className="h-6 w-6 text-purple-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">เปลี่ยนรหัสผ่าน</h1>
          <p className="text-sm" style={{ color: tx.faint }}>
            กรุณาตั้งรหัสผ่านใหม่ของคุณเพื่อดำเนินการต่อ
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div className="relative">
            <label className="block text-xs font-semibold mb-2" style={{ color: tx.faint }}>
              รหัสผ่านใหม่
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: tx.faint }} />
              <input
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={(e) => {
                  setNewPw(e.target.value);
                  setPwError(null);
                }}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 bg-transparent text-sm"
                style={{ borderColor: tx.border, color: tx.primary }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                style={{ color: tx.faint }}
              >
                {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="relative">
            <label className="block text-xs font-semibold mb-2" style={{ color: tx.faint }}>
              ยืนยันรหัสผ่านใหม่
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: tx.faint }} />
              <input
                type="password"
                value={cPw}
                onChange={(e) => {
                  setCPw(e.target.value);
                  setPwError(null);
                }}
                placeholder="ยืนยันรหัสผ่านใหม่"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 bg-transparent text-sm"
                style={{ borderColor: tx.border, color: tx.primary }}
              />
            </div>
          </div>

          {/* Error Message */}
          {pwError && (
            <p className="text-xs text-rose-500 font-semibold flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {pwError}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md transition-all"
          >
            {loading ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-xs text-center" style={{ color: tx.faint }}>
          © 2026 Math by Seng — Premium LMS Platform
        </p>
      </div>
    </div>
  );
}
