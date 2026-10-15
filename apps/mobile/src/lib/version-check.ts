import * as Application from "expo-application";
import { apiFetch } from "@/lib/api";

export interface RequiredUpdate {
  updateUrl: string;
}

/** Compares dotted numeric versions ("0.1.0" vs "0.2.0"); missing parts count as 0. */
export function isVersionBelow(current: string, minimum: string): boolean {
  const a = current.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const b = minimum.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}

/**
 * Asks the server for the oldest app version it still supports (apps/web's
 * /api/app-version) and returns where to update if this install is older.
 * Fails open - offline, server error or an unknown native version never
 * locks anyone out of the app.
 */
export async function checkRequiredUpdate(): Promise<RequiredUpdate | null> {
  const currentVersion = Application.nativeApplicationVersion;
  if (!currentVersion) return null;
  try {
    const res = await apiFetch("/api/app-version");
    if (!res.ok) return null;
    const { minimumVersion, updateUrl } = (await res.json()) as { minimumVersion?: string; updateUrl?: string };
    if (!minimumVersion || !updateUrl) return null;
    return isVersionBelow(currentVersion, minimumVersion) ? { updateUrl } : null;
  } catch {
    return null;
  }
}
