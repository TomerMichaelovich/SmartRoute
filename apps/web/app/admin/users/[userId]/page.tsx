import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getPromotionStats } from "@smartroute/core/application/analytics/analytics-service";
import {
  getNotFoundItems,
  getShoppingTimeProfile,
  getStoreBreakdown,
  getTopProducts,
  getTripStats,
  getUnmatchedItems,
  getUserLifecycleStatus,
  toEpochMs,
  type DayPart,
  type ItemFrequency,
} from "@smartroute/core/application/analytics/user-insights";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import {
  analyticsRepository,
  promotionRepository,
  shoppingListRepository,
  shoppingTripRepository,
  storeRepository,
  userAdminRepository,
} from "@/src/infrastructure/container";
import {
  ADMIN_TIME_ZONE,
  LifecycleBadge,
  SignupMethodBadge,
  formatDate,
  formatDateTime,
  formatDuration,
  formatRelative,
  lastActiveAt,
  signupMethodOf,
} from "@/src/presentation/components/admin/user-display";
import { StatTile } from "@/src/presentation/components/summary/StatTile";

const WEEKDAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DAY_PART_LABELS: Record<DayPart, string> = {
  morning: "בוקר",
  noon: "צהריים",
  evening: "ערב",
  night: "לילה",
};

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const summary = await userAdminRepository.findSummary(userId);
  if (!summary) notFound();

  const [trips, ownLists, sharedLists, events, promotions, stores] = await Promise.all([
    shoppingTripRepository.findByUser(userId),
    shoppingListRepository.findByOwner(userId),
    shoppingListRepository.findSharedWithUser(userId),
    analyticsRepository.findByUser(userId),
    promotionRepository.findAll(),
    storeRepository.findAll(),
  ]);

  const now = new Date();
  const { user } = summary;
  const lastActive = lastActiveAt(summary);
  const lifecycle = getUserLifecycleStatus(
    { createdAt: user.createdAt, lastActiveAt: lastActive, tripCount: summary.tripCount },
    now,
  );

  const stats = getTripStats(trips);
  const topProducts = getTopProducts(trips, 15);
  const notFoundItems = getNotFoundItems(trips, 10);
  const unmatchedItems = getUnmatchedItems(trips, 10);
  const storeVisits = getStoreBreakdown(trips);
  const timeProfile = getShoppingTimeProfile(trips, ADMIN_TIME_ZONE);

  const promotionById = new Map(promotions.map((p) => [p.id, p]));
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  const promotionStats = getPromotionStats(events);
  const promoImpressions = promotionStats.reduce((sum, s) => sum + s.impressions, 0);
  const promoClicks = events
    .filter((e) => e.type === "promotion_click")
    .sort((a, b) => toEpochMs(b.timestamp) - toEpochMs(a.timestamp));

  const percent = (v: number) => `${Math.round(v * 100)}%`;
  const busiestWeekday = maxIndex(timeProfile.byWeekday);
  const busiestDayPart = (Object.keys(timeProfile.byDayPart) as DayPart[]).reduce((a, b) =>
    timeProfile.byDayPart[b] > timeProfile.byDayPart[a] ? b : a,
  );

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/users" className="text-xs text-cyan-700 hover:underline">
        → כל המשתמשים
      </Link>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-neutral-900">{user.displayName}</h1>
          <LifecycleBadge status={lifecycle} />
          <SignupMethodBadge method={signupMethodOf(summary)} />
        </div>
        <div className="text-neutral-600">
          <span dir="ltr">{user.email}</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-600 sm:grid-cols-4">
          <div>
            <dt className="text-neutral-400">הרשמה</dt>
            <dd>{formatDateTime(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">פעילות אחרונה</dt>
            <dd title={lastActive ? formatDateTime(lastActive) : undefined}>
              {lastActive ? formatRelative(lastActive, now) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-400">התחברויות פעילות</dt>
            <dd>{summary.activeSessionCount}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">רשימות</dt>
            <dd>
              {ownLists.length} בבעלות · {sharedLists.length} ששותפו
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        <div className="w-32">
          <StatTile label="קניות שהושלמו" value={stats.tripCount} />
        </div>
        <div className="w-32">
          <StatTile
            label="משך קנייה ממוצע"
            value={stats.avgDurationSeconds !== null ? formatDuration(stats.avgDurationSeconds) : "—"}
          />
        </div>
        <div className="w-32">
          <StatTile label="פריטים לקנייה" value={stats.tripCount > 0 ? stats.avgItemsPerTrip.toFixed(1) : "—"} />
        </div>
        <div className="w-32">
          <StatTile label="פריטים שלא נמצאו" value={stats.tripCount > 0 ? percent(stats.notFoundRate) : "—"} />
        </div>
        <div className="w-32">
          <StatTile
            label="תדירות קנייה"
            value={
              stats.avgDaysBetweenTrips === null
                ? "—"
                : stats.avgDaysBetweenTrips < 1.5
                  ? "כל יום"
                  : `כל ${Math.round(stats.avgDaysBetweenTrips)} ימים`
            }
          />
        </div>
        <div className="w-32">
          <StatTile label="סניף מועדף" value={<span className="text-base">{storeVisits[0]?.storeName ?? "—"}</span>} />
        </div>
      </div>

      <Section title="מוצרים מובילים">
        <FrequencyTable
          rows={topProducts}
          tripCount={stats.tripCount}
          empty="אין עדיין קניות שהושלמו"
          note="לפי פריטים שסומנו כנאספו. מוצר שמופיע ברוב הקניות הוא מוצר קבוע - מועמד טוב למבצע ממוקד."
        />
      </Section>

      <Section title="מבצעים">
        <div className="flex flex-wrap gap-3">
          <div className="w-32">
            <StatTile label="חשיפות" value={promoImpressions} />
          </div>
          <div className="w-32">
            <StatTile label="״לקחתי״" value={promoClicks.length} />
          </div>
          <div className="w-32">
            <StatTile
              label="שיעור המרה"
              value={promoImpressions > 0 ? percent(promoClicks.length / promoImpressions) : "—"}
            />
          </div>
        </div>
        <Table headers={["תאריך", "מבצע", "סניף"]} emptyText="לא נרשמו לחיצות על מבצעים עבור המשתמש">
          {promoClicks.map((event) => {
            const promotionId = typeof event.payload.promotionId === "string" ? event.payload.promotionId : "";
            return (
              <tr key={event.id} className="border-t border-neutral-100">
                <td className="whitespace-nowrap p-2">{formatDateTime(event.timestamp)}</td>
                <td className="p-2">{promotionById.get(promotionId)?.title ?? promotionId}</td>
                <td className="p-2">{event.storeId ? (storeNameById.get(event.storeId) ?? "—") : "—"}</td>
              </tr>
            );
          })}
        </Table>
      </Section>

      {stats.tripCount > 0 && (
        <Section title="זמני קנייה וסניפים">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Table headers={WEEKDAY_LABELS}>
              <tr className="border-t border-neutral-100">
                {timeProfile.byWeekday.map((n, day) => (
                  <td key={day} className={`p-2 ${day === busiestWeekday ? "font-semibold text-cyan-700" : ""}`}>
                    {n}
                  </td>
                ))}
              </tr>
            </Table>
            <Table headers={(Object.keys(DAY_PART_LABELS) as DayPart[]).map((k) => DAY_PART_LABELS[k])}>
              <tr className="border-t border-neutral-100">
                {(Object.keys(DAY_PART_LABELS) as DayPart[]).map((part) => (
                  <td key={part} className={`p-2 ${part === busiestDayPart ? "font-semibold text-cyan-700" : ""}`}>
                    {timeProfile.byDayPart[part]}
                  </td>
                ))}
              </tr>
            </Table>
          </div>
          <Table headers={["סניף", "קניות"]}>
            {storeVisits.map((visit) => (
              <tr key={visit.storeId} className="border-t border-neutral-100">
                <td className="p-2">{visit.storeName}</td>
                <td className="p-2">{visit.tripCount}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {(notFoundItems.length > 0 || unmatchedItems.length > 0) && (
        <Section title="נקודות תקלה">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-medium text-neutral-500">לא נמצא על המדף</h3>
              <FrequencyTable rows={notFoundItems} tripCount={stats.tripCount} empty="—" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-medium text-neutral-500">טקסט שלא זוהה כמוצר</h3>
              <FrequencyTable rows={unmatchedItems} tripCount={stats.tripCount} empty="—" />
            </div>
          </div>
        </Section>
      )}

      <Section title="רשימות">
        <Table headers={["רשימה", "פריטים", "מצב", "עודכנה"]} emptyText="אין רשימות">
          {[...ownLists.map((l) => ({ list: l, own: true })), ...sharedLists.map((l) => ({ list: l, own: false }))].map(
            ({ list, own }) => (
              <tr key={list.id} className="border-t border-neutral-100">
                <td className="p-2">{list.name ?? "ללא שם"}</td>
                <td className="p-2">{list.items.length}</td>
                <td className="p-2 text-xs text-neutral-600">{listStateLabel(list, own)}</td>
                <td className="whitespace-nowrap p-2">{formatDate(list.updatedAt)}</td>
              </tr>
            ),
          )}
        </Table>
      </Section>

      <Section title="היסטוריית קניות">
        {trips.length === 0 && <p className="text-neutral-400">אין עדיין קניות שהושלמו</p>}
        <div className="flex flex-col gap-2">
          {trips.map((trip) => {
            const collected = trip.items.filter((i) => i.collected).length;
            const missing = trip.items.filter((i) => i.notFound).length;
            const durationSeconds = (toEpochMs(trip.completedAt) - toEpochMs(trip.startedAt)) / 1000;
            return (
              <details key={trip.id} className="rounded-xl border border-neutral-200 bg-white">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3">
                  <span className="font-medium">{formatDateTime(trip.completedAt)}</span>
                  <span className="text-neutral-600">{trip.storeName}</span>
                  <span className="text-xs text-neutral-500">
                    {collected}/{trip.items.length} נאספו
                    {missing > 0 && ` · ${missing} לא נמצאו`}
                    {durationSeconds > 0 && ` · ${formatDuration(durationSeconds)}`}
                  </span>
                </summary>
                <ul className="flex flex-col gap-1 border-t border-neutral-100 p-3">
                  {trip.items.map((item, index) => (
                    <li key={index} className="flex items-center justify-between gap-2">
                      <span>
                        {item.productName ?? item.rawText}
                        {item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ""}
                        {item.productName && item.productName !== item.rawText && (
                          <span className="text-xs text-neutral-400"> ({item.rawText})</span>
                        )}
                      </span>
                      <span
                        className={`text-xs ${item.collected ? "text-emerald-700" : item.notFound ? "text-red-600" : "text-neutral-400"}`}
                      >
                        {item.collected ? "נאסף" : item.notFound ? "לא נמצא" : "לא סומן"}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function maxIndex(values: number[]): number {
  return values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
}

function listStateLabel(list: ShoppingList, own: boolean): string {
  const parts = [own ? "בבעלות" : "שותפה עם המשתמש"];
  if (own && list.householdId) parts.push("משותפת");
  parts.push(list.isActive ? "פתוחה" : "סגורה");
  return parts.join(" · ");
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

function Table({
  headers,
  emptyText,
  children,
}: {
  headers: string[];
  emptyText?: string;
  children: ReactNode;
}) {
  const isEmpty = Array.isArray(children) && children.length === 0;
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="p-2 text-start">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty && emptyText ? (
            <tr>
              <td className="p-2 text-neutral-400" colSpan={headers.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function FrequencyTable({
  rows,
  tripCount,
  empty,
  note,
}: {
  rows: ItemFrequency[];
  tripCount: number;
  empty: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Table headers={["פריט", "בכמה קניות"]} emptyText={empty}>
        {rows.map((row) => (
          <tr key={row.name} className="border-t border-neutral-100">
            <td className="p-2">{row.name}</td>
            <td className="p-2 whitespace-nowrap">
              {row.tripCount}/{tripCount}
              {tripCount > 0 && (
                <span className="text-xs text-neutral-400"> ({Math.round((row.tripCount / tripCount) * 100)}%)</span>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {note && rows.length > 0 && <p className="text-xs text-neutral-400">{note}</p>}
    </div>
  );
}
