import React from "react";

interface AuthFooterProps {
  animationDelay?: string;
}

export default function AuthFooter({ animationDelay = "0.3s" }: AuthFooterProps) {
  return (
    <div className="mt-6 text-center text-xs animate-fadeIn" style={{ color: "var(--text-faint)", animationDelay }}>
      <p>© 2026 Math by Seng — Learning Management System</p>
    </div>
  );
}
