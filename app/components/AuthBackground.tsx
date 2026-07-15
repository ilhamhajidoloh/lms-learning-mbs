import React from "react";

interface AuthBackgroundProps {
  variant: "login" | "signup";
}

export default function AuthBackground({ variant }: AuthBackgroundProps) {
  if (variant === "signup") {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl" style={{ animation: "pulse 4s ease-in-out infinite" }} />
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-pink-500/8 rounded-full blur-3xl" style={{ animation: "pulse 5s ease-in-out infinite 1s" }} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-3xl animate-pulse" />
      <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl" style={{ animation: "pulse 4s ease-in-out infinite" }} />
      <div className="absolute bottom-0 left-1/3 w-[600px] h-[600px] bg-pink-500/8 rounded-full blur-3xl" style={{ animation: "pulse 5s ease-in-out infinite 1s" }} />
    </div>
  );
}
