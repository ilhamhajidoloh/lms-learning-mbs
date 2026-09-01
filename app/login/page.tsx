"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";
import { apiFetch, setToken } from "../../lib/api";
import { toast } from "../../lib/swal";
import type { Role } from "../context/UserContext";
import AuthBackground from "../components/AuthBackground";
import AuthLogo from "../components/AuthLogo";
import AuthFooter from "../components/AuthFooter";
import LoginForm from "./_components/LoginForm";

export default function LoginPage() {
  const { login, refreshData } = useUser();
  const router = useRouter();
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

  const [username,     setUsername]     = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const clearError = () => setError(null);

  // Warm up the serverless function on component mount
  React.useEffect(() => {
    // Ping health endpoint to wake up serverless functions
    fetch("/api/health").catch(() => {
      // Ignore errors - this is just a warm-up ping
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("กรุณากรอก Username และ Password ให้ครบถ้วน");
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading("กำลังเข้าสู่ระบบ...");

    const { data, error: apiError } = await apiFetch<{
      token: string;
      user: { id: string; username: string; displayName: string; role: Role; passwordChanged: boolean };
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: username.trim(), password }),
    });

    if (apiError || !data) {
      loadingToast.close();
      setLoading(false);
      const msg = apiError || "Username หรือ Password ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง";
      setError(msg);
      return;
    }

    setToken(data.token);
    login(data.user.role, data.user.displayName, data.user.username, data.user.id, data.user.passwordChanged);

    loadingToast.close();
    toast.success("เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับคุณ " + data.user.displayName);

    // Determine destination based on role and redirect param
    let dest: string;

    // First priority: change password if needed
    if (!data.user.passwordChanged) {
      dest = "/change-password";
    } else {
      // Get redirect param from URL
      const redirectParam = searchParams.get("redirect");

      // Default destinations by role
      const roleDefaults: Record<Role, string> = {
        admin: "/admin",
        teacher: "/teacher",
        student: "/student"
      };

      // Use redirect param if it matches the user's role, otherwise use role default
      if (redirectParam) {
        const isValidRedirect =
          (data.user.role === "admin" && redirectParam.startsWith("/admin")) ||
          (data.user.role === "teacher" && redirectParam.startsWith("/teacher")) ||
          (data.user.role === "student" && redirectParam.startsWith("/student"));

        dest = isValidRedirect ? redirectParam : roleDefaults[data.user.role];
      } else {
        dest = roleDefaults[data.user.role];
      }
    }

    router.push(dest);

    // Load data after navigation
    refreshData().catch(console.error);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <AuthBackground variant="login" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">

        <AuthLogo />

        <LoginForm
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          loading={loading}
          error={error}
          clearError={clearError}
          handleLogin={handleLogin}
        />

        <AuthFooter animationDelay="0.3s" />
      </div>
    </div>
  );
}
