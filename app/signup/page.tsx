"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";
import AuthBackground from "../components/AuthBackground";
import AuthLogo from "../components/AuthLogo";
import AuthFooter from "../components/AuthFooter";
import SignupForm from "./_components/SignupForm";

export default function SignupPage() {
  const { register } = useUser();
  const router = useRouter();

  const [username,    setUsername]    = useState("");
  const [email,       setEmail]       = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password,    setPassword]    = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [showCPw,     setShowCPw]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const clearError = () => setError(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !displayName.trim() || !password || !confirmPw) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง"); return;
    }
    if (username.trim().length < 3) {
      setError("Username ต้องมีอย่างน้อย 3 ตัวอักษร"); return;
    }
    if (/\s/.test(username.trim())) {
      setError("Username ต้องไม่มีช่องว่าง"); return;
    }
    if (password.length < 6) {
      setError("Password ต้องมีอย่างน้อย 6 ตัวอักษร"); return;
    }
    if (password !== confirmPw) {
      setError("Password ทั้งสองช่องไม่ตรงกัน"); return;
    }

    setLoading(true);

    const result = await register({
      username:    username.trim(),
      email:       email.trim() || undefined,
      password,
      role: "student",
      displayName: displayName.trim(),
    });

    if (!result.success) {
      setLoading(false);
      setError(result.error ?? "เกิดข้อผิดพลาด");
      return;
    }

    router.push("/student");
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <AuthBackground variant="signup" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">

        <AuthLogo />

        <SignupForm
          username={username}
          setUsername={setUsername}
          email={email}
          setEmail={setEmail}
          displayName={displayName}
          setDisplayName={setDisplayName}
          password={password}
          setPassword={setPassword}
          confirmPw={confirmPw}
          setConfirmPw={setConfirmPw}
          showPw={showPw}
          setShowPw={setShowPw}
          showCPw={showCPw}
          setShowCPw={setShowCPw}
          loading={loading}
          error={error}
          clearError={clearError}
          handleSubmit={handleSubmit}
        />

        <AuthFooter animationDelay="0.2s" />
      </div>
    </div>
  );
}
