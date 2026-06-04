"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "./context/UserContext";

export default function Home() {
  const { role, isAuthenticated } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    } else if (role === "admin") {
      router.push("/admin");
    } else if (role === "teacher") {
      router.push("/teacher");
    } else {
      router.push("/student");
    }
  }, [isAuthenticated, role, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-base)" }}>
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
}
