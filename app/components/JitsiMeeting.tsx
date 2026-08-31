"use client";

import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Loader2 } from "lucide-react";

export interface JitsiMeetExternalAPIInstance {
  dispose: () => void;
  addEventListener: (event: string, handler: () => void) => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: unknown) => JitsiMeetExternalAPIInstance;
  }
}

export interface JitsiMeetingProps {
  roomName: string;
  displayName: string;
  onJoin?: () => void;
  onLeave?: () => void;
  className?: string;
}

export function JitsiMeeting({
  roomName,
  displayName,
  onJoin,
  onLeave,
  className = "",
}: JitsiMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiMeetExternalAPIInstance | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(
    () => typeof window !== "undefined" && Boolean(window.JitsiMeetExternalAPI)
  );
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !roomName || !window.JitsiMeetExternalAPI) return;

    // Clean up any previous instance before creating a new one
    if (apiRef.current) {
      try {
        apiRef.current.dispose();
      } catch (e) {
        console.warn("Failed to dispose previous Jitsi API:", e);
      }
      apiRef.current = null;
    }

    setIsInitializing(true);

    try {
      const domain = process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.jit.si";
      const options = {
        roomName: roomName,
        width: "100%",
        height: "100%",
        parentNode: containerRef.current,
        userInfo: {
          displayName: displayName || "ผู้เรียน",
        },
        configOverwrite: {
          prejoinConfig: {
            enabled: false, // Bypass pre-join screen
          },
          prejoinPageEnabled: false,
          enableLobby: false,
          enableKnocking: false,
          disableLobbyPassword: true,
          disableDeepLinking: true,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          enableClosePage: false,
          defaultRemoteDisplayName: "ผู้เข้าร่วม",
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_CHROME_EXTENSION_BANNER: false,
          DEFAULT_REMOTE_DISPLAY_NAME: "ผู้เข้าร่วม",
          TOOLBAR_BUTTONS: [
            "microphone",
            "camera",
            "desktop",
            "fullscreen",
            "hangup",
            "chat",
            "raisehand",
            "tileview",
            "participants-pane",
            "settings",
            "stats",
          ],
        },
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);
      apiRef.current = api;

      api.addEventListener("videoConferenceJoined", () => {
        setIsInitializing(false);
        onJoin?.();
      });

      api.addEventListener("videoConferenceLeft", () => {
        onLeave?.();
      });

      api.addEventListener("readyToClose", () => {
        onLeave?.();
      });

      // Set timeout in case joined event doesn't fire immediately
      const timer = setTimeout(() => {
        setIsInitializing(false);
      }, 3500);

      return () => {
        clearTimeout(timer);
        if (apiRef.current) {
          try {
            apiRef.current.dispose();
          } catch (e) {
            console.warn("Jitsi dispose error on unmount:", e);
          }
          apiRef.current = null;
        }
      };
    } catch (err) {
      console.error("Error initializing Jitsi Meet:", err);
      setTimeout(() => {
        setIsInitializing(false);
      }, 0);
    }
  }, [scriptLoaded, roomName, displayName, onJoin, onLeave]);

  const jitsiDomain = typeof window !== "undefined" && process.env.NEXT_PUBLIC_JITSI_DOMAIN
    ? process.env.NEXT_PUBLIC_JITSI_DOMAIN
    : "meet.jit.si";

  return (
    <div className={`relative w-full h-full min-h-[500px] overflow-hidden rounded-2xl bg-slate-950 ${className}`}>
      {/* Jitsi CDN External API Script */}
      <Script
        src={`https://${jitsiDomain}/external_api.js`}
        strategy="lazyOnload"
        onLoad={() => setScriptLoaded(true)}
        onError={(e) => console.error("Error loading Jitsi API script:", e)}
      />

      {/* Loading Overlay */}
      {(!scriptLoaded || isInitializing) && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 text-white backdrop-blur-sm space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <div className="text-center">
            <p className="text-base font-bold">กำลังเชื่อมต่อไปยังห้องเรียนสด...</p>
            <p className="text-xs text-slate-400 mt-1">เตรียมความพร้อมของกล้องและไมโครโฟนสำหรับ {displayName}</p>
          </div>
        </div>
      )}

      {/* Jitsi Meeting Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0 [&>iframe]:block"
      />
    </div>
  );
}

export default JitsiMeeting;

