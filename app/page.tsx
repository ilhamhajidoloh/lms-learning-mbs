"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "./context/UserContext";
import { PublicHome } from "./_components/PublicHome";

export default function Home() {
  const { role, isAuthenticated, passwordChanged } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!passwordChanged) {
      router.replace("/change-password");
    } else if (role === "admin") {
      router.replace("/admin");
    } else if (role === "teacher") {
      router.replace("/teacher");
    } else {
      router.replace("/student");
    }
  }, [isAuthenticated, passwordChanged, role, router]);

  if (!isAuthenticated) {
    return <PublicHome />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-base)" }}>
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
}
