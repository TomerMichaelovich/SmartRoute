import Link from "next/link";
import {
  getUserLifecycleStatus,
  toEpochMs,
  type UserLifecycleStatus,
} from "@smartroute/core/application/analytics/user-insights";
import { userAdminRepository } from "@/src/infrastructure/container";
import {
  LIFECYCLE_LABEL,
  LifecycleBadge,
  SignupMethodBadge,
  formatDate,
  formatDateTime,
  formatRelative,
  lastActiveAt,
  signupMethodOf,
} from "@/src/presentation/components/admin/user-display";
import { StatTile } from "@/src/presentation/components/summary/StatTile";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const summaries = await userAdminRepository.listSummaries();
  const now = new Date();

  const rows = summaries.map((summary) => {
    const lastActive = lastActiveAt(summary);
    return {
      summary,
      lastActive,
      method: signupMethodOf(summary),
      lifecycle: getUserLifecycleStatus(
        { createdAt: summary.user.createdAt, lastActiveAt: lastActive, tripCount: summary.tripCount },
        now,
      ),
    };
  });

  const within = (timestamp: string | null, days: number) =>
    timestamp !== null && now.getTime() - toEpochMs(timestamp) <= days * DAY_MS;
  const total = rows.length;
  const newThisWeek = rows.filter((r) => within(r.summary.user.createdAt, 7)).length;
  const activeThisWeek = rows.filter((r) => within(r.lastActive, 7)).length;
  const shoppedOnce = rows.filter((r) => r.summary.tripCount >= 1).length;
  const returning = rows.filter((r) => r.summary.tripCount >= 2).length;
  const google = rows.filter((r) => r.method !== "password").length;
  const percentOf = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : "—");

  const query = q?.trim().toLowerCase() ?? "";
  const visible = rows.filter(
    (r) =>
      (!query ||
        r.summary.user.displayName.toLowerCase().includes(query) ||
        r.summary.user.email.includes(query)) &&
      (!status || r.lifecycle === status),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-neutral-900">משתמשים</h1>

      <div className="flex flex-wrap gap-3">
        <div className="w-32">
          <StatTile label="משתמשים רשומים" value={total} />
        </div>
        <div className="w-32">
          <StatTile label="נרשמו השבוע" value={newThisWeek} />
        </div>
        <div className="w-32">
          <StatTile label="פעילים השבוע" value={activeThisWeek} />
        </div>
        <div className="w-32">
          <StatTile label="ביצעו קנייה" value={percentOf(shoppedOnce)} />
        </div>
        <div className="w-32">
          <StatTile label="חזרו לקנייה נוספת" value={percentOf(returning)} />
        </div>
        <div className="w-32">
          <StatTile label="נרשמו עם Google" value={percentOf(google)} />
        </div>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm text-neutral-600">
          חיפוש
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="שם או אימייל"
            className="rounded-lg border border-neutral-300 p-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          סטטוס
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-neutral-300 p-2">
            <option value="">הכל</option>
            {(Object.keys(LIFECYCLE_LABEL) as UserLifecycleStatus[]).map((key) => (
              <option key={key} value={key}>
                {LIFECYCLE_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white">
          סנן
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="p-2 text-start">משתמש</th>
              <th className="p-2 text-start">הרשמה</th>
              <th className="p-2 text-start">פעילות אחרונה</th>
              <th className="p-2 text-start">קניות</th>
              <th className="p-2 text-start">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td className="p-2 text-neutral-400" colSpan={5}>
                  {total === 0 ? "אין משתמשים רשומים עדיין" : "אין משתמשים שתואמים לסינון"}
                </td>
              </tr>
            )}
            {visible.map(({ summary, lastActive, method, lifecycle }) => (
              <tr key={summary.user.id} className="border-t border-neutral-100 align-top">
                <td className="p-2">
                  <Link href={`/admin/users/${summary.user.id}`} className="font-medium text-cyan-700 hover:underline">
                    {summary.user.displayName}
                  </Link>
                  <div className="text-xs text-neutral-500">
                    <span dir="ltr">{summary.user.email}</span>
                  </div>
                </td>
                <td className="p-2">
                  <div className="whitespace-nowrap">{formatDate(summary.user.createdAt)}</div>
                  <SignupMethodBadge method={method} />
                </td>
                <td className="whitespace-nowrap p-2" title={lastActive ? formatDateTime(lastActive) : undefined}>
                  {lastActive ? formatRelative(lastActive, now) : "—"}
                </td>
                <td className="p-2">{summary.tripCount}</td>
                <td className="p-2">
                  <LifecycleBadge status={lifecycle} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
