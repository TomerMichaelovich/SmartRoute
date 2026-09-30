import {
  toEpochMs,
  type UserLifecycleStatus,
} from "@smartroute/core/application/analytics/user-insights";
import type { UserAccountSummary } from "@/src/infrastructure/repositories/interfaces/user-admin-repository";

// Admin reads in Israel time regardless of where the server runs (Vercel is UTC).
export const ADMIN_TIME_ZONE = "Asia/Jerusalem";

export function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeZone: ADMIN_TIME_ZONE }).format(
    toEpochMs(timestamp),
  );
}

export function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ADMIN_TIME_ZONE,
  }).format(toEpochMs(timestamp));
}

/** "לפני 3 ימים" - coarse on purpose; the exact time is in the title tooltip. */
export function formatRelative(timestamp: string, now: Date): string {
  const minutes = Math.round((now.getTime() - toEpochMs(timestamp)) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("he", { numeric: "auto" });
  if (minutes < 60) return rtf.format(-Math.max(minutes, 0), "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return rtf.format(-days, "day");
  return rtf.format(-Math.round(days / 30), "month");
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? "פחות מדקה" : `${minutes} דק׳`;
}

/** The later of the last session activity and the last completed trip. */
export function lastActiveAt(summary: UserAccountSummary): string | null {
  const candidates = [summary.lastSeenAt, summary.lastTripAt].filter((t): t is string => t !== null);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (toEpochMs(a) >= toEpochMs(b) ? a : b));
}

export type SignupMethod = "google" | "password" | "both";

export function signupMethodOf(summary: UserAccountSummary): SignupMethod {
  const google = summary.oauthProviders.includes("google");
  if (google && summary.hasPassword) return "both";
  return google ? "google" : "password";
}

const SIGNUP_METHOD_LABEL: Record<SignupMethod, string> = {
  google: "Google",
  password: "אימייל וסיסמה",
  both: "Google + סיסמה",
};

export function SignupMethodBadge({ method }: { method: SignupMethod }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
      {SIGNUP_METHOD_LABEL[method]}
    </span>
  );
}

export const LIFECYCLE_LABEL: Record<UserLifecycleStatus, string> = {
  new: "חדש",
  not_activated: "ללא קנייה",
  active: "פעיל",
  at_risk: "בסיכון נטישה",
  dormant: "רדום",
};

const LIFECYCLE_CLASS: Record<UserLifecycleStatus, string> = {
  new: "bg-cyan-50 text-cyan-800",
  not_activated: "bg-amber-50 text-amber-800",
  active: "bg-emerald-50 text-emerald-800",
  at_risk: "bg-orange-50 text-orange-800",
  dormant: "bg-neutral-100 text-neutral-600",
};

export function LifecycleBadge({ status }: { status: UserLifecycleStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${LIFECYCLE_CLASS[status]}`}>
      {LIFECYCLE_LABEL[status]}
    </span>
  );
}
