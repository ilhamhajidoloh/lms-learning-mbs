/**
 * Helper to generate direct Jitsi Meet URL with pre-configured display name, role, and bypassed prejoin screen.
 */
export function generateJitsiUrl(
  roomName: string,
  displayName: string,
  isModerator: boolean = false
): string {
  const domain = process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.jit.si";
  const encodedRoomName = encodeURIComponent(roomName);

  const url = new URL(`https://${domain}/${encodedRoomName}`);

  // Jitsi Meet reads configuration and user info from URL Hash
  const hashParams = new URLSearchParams();
  if (displayName) {
    hashParams.set("userInfo.displayName", displayName);
  }
  if (isModerator) {
    hashParams.set("userInfo.role", "moderator");
  }

  hashParams.set("config.prejoinPageEnabled", "false");
  hashParams.set("config.prejoinConfig.enabled", "false");
  hashParams.set("config.requireDisplayName", "false");
  hashParams.set("config.enableLobby", "false");
  hashParams.set("config.enableKnocking", "false");
  hashParams.set("config.startWithAudioMuted", "false");
  hashParams.set("config.startWithVideoMuted", "false");
  hashParams.set("config.enableWelcomePage", "false");
  hashParams.set("config.enableClosePage", "false");
  hashParams.set("config.disableDeepLinking", "true");

  url.hash = hashParams.toString();
  return url.toString();
}
