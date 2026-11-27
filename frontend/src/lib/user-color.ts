/**
 * Deterministic color for a user, derived from their id/email so the same
 * person always gets the same color across the app. Used for audit/activity
 * avatars so "who did this" is instantly recognizable.
 */

const PALETTE = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ef4444", // red
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#84cc16", // lime
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function userColor(seed?: string | null): string {
  const key = (seed || "unknown").trim().toLowerCase();
  return PALETTE[hashString(key) % PALETTE.length];
}

/** Short display name derived from an email or id. */
export function userDisplayName(
  userName?: string | null,
  userEmail?: string | null,
  userId?: string | null,
): string {
  if (userName) return userName;
  if (userEmail) {
    const local = userEmail.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  if (userId) return `User ${userId.slice(0, 6)}`;
  return "System";
}

/** Initials for the avatar circle. */
export function userInitials(
  userName?: string | null,
  userEmail?: string | null,
): string {
  const name = userDisplayName(userName, userEmail);
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
