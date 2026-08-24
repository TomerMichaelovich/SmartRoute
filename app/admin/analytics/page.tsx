import {
  enumerateDays,
  filterEvents,
  getAverageSatisfactionRating,
  getAverageSatisfactionSeries,
  getAverageShoppingDurationSeconds,
  getAverageShoppingDurationSeries,
  getClassificationAccuracy,
  getClassificationAccuracySeries,
  getNotFoundRate,
  getNotFoundRateSeries,
  getPromotionClickCountSeries,
  getPromotionImpressionCountSeries,
  getPromotionStats,
  getReturningSessionCount,
  getRouteCompletedCountSeries,
  getRouteStartedCountSeries,
} from "@/src/application/analytics/analytics-service";
import { analyticsRepository, promotionRepository, storeRepository } from "@/src/infrastructure/container";
import { resetStoreAnalytics } from "@/src/presentation/actions/admin-analytics-actions";
import { AnalyticsFilterForm } from "@/src/presentation/components/admin/AnalyticsFilterForm";
import { ResetAnalyticsButton } from "@/src/presentation/components/admin/ResetAnalyticsButton";
import { TrendChart } from "@/src/presentation/components/admin/TrendChart";
import { StatTile } from "@/src/presentation/components/summary/StatTile";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; from?: string; to?: string }>;
}) {
  const { storeId, from, to } = await searchParams;

  const [events, promotions, stores] = await Promise.all([
    analyticsRepository.readAll(),
    promotionRepository.findAll(),
    storeRepository.findAll(),
  ]);

  const storeScoped = storeId ? events.filter((e) => e.storeId === storeId) : events;
  const today = new Date().toISOString().slice(0, 10);
  const effectiveFrom = from || storeScoped[0]?.timestamp.slice(0, 10) || today;
  const effectiveTo = to || storeScoped[storeScoped.length - 1]?.timestamp.slice(0, 10) || today;

  const scopedEvents = filterEvents(events, { storeId, from: effectiveFrom, to: effectiveTo });
  const days = enumerateDays(effectiveFrom, effectiveTo);
  const selectedStore = storeId ? stores.find((s) => s.id === storeId) : undefined;

  const accuracy = getClassificationAccuracy(scopedEvents);
  const notFoundRate = getNotFoundRate(scopedEvents);
  const avgDuration = getAverageShoppingDurationSeconds(scopedEvents);
  const avgSatisfaction = getAverageSatisfactionRating(scopedEvents);
  const promotionStats = getPromotionStats(scopedEvents);
  const returningSessions = getReturningSessionCount(scopedEvents);
  const promotionTitleById = new Map(promotions.map((p) => [p.id, p.title]));

  const routeStarted = scopedEvents.filter((e) => e.type === "route_started").length;
  const routeCompleted = scopedEvents.filter((e) => e.type === "route_completed").length;

  const percent = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-neutral-900">אנליטיקס</h1>

      <AnalyticsFilterForm stores={stores} selectedStoreId={storeId} from={effectiveFrom} to={effectiveTo} />

      {selectedStore && (
        <ResetAnalyticsButton
          storeName={selectedStore.name}
          resetAnalytics={resetStoreAnalytics.bind(null, selectedStore.id)}
          className="self-start"
        />
      )}

      <div className="flex flex-wrap gap-3">
        <div className="w-40">
          <StatTile label="דיוק סיווג" value={percent(accuracy)} />
        </div>
        <div className="w-40">
          <StatTile label="פריטים שלא נמצאו בפועל" value={percent(notFoundRate)} />
        </div>
        <div className="w-40">
          <StatTile label="משך קנייה ממוצע" value={`${Math.round(avgDuration)} שנ׳`} />
        </div>
        <div className="w-40">
          <StatTile label="מסלולים שהושלמו" value={`${routeCompleted}/${routeStarted}`} />
        </div>
        <div className="w-40">
          <StatTile label="משתמשים חוזרים" value={returningSessions} />
        </div>
        <div className="w-40">
          <StatTile
            label="שביעות רצון ממוצעת"
            value={avgSatisfaction > 0 ? `${avgSatisfaction.toFixed(1)}/5` : "—"}
          />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900">מגמות יומיות</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TrendChart
            title="פריטים שלא נמצאו"
            data={getNotFoundRateSeries(scopedEvents, days)}
            format="percent"
          />
          <TrendChart
            title="מסלולים שהתחילו"
            data={getRouteStartedCountSeries(scopedEvents, days)}
            format="count"
          />
          <TrendChart
            title="מסלולים שהושלמו"
            data={getRouteCompletedCountSeries(scopedEvents, days)}
            format="count"
          />
          <TrendChart
            title="משך קנייה ממוצע"
            data={getAverageShoppingDurationSeries(scopedEvents, days)}
            format="seconds"
          />
          <TrendChart
            title="שביעות רצון ממוצעת"
            data={getAverageSatisfactionSeries(scopedEvents, days)}
            format="rating"
          />
          <TrendChart
            title="דיוק סיווג"
            data={getClassificationAccuracySeries(scopedEvents, days)}
            format="percent"
          />
          <TrendChart
            title="חשיפות מבצעים"
            data={getPromotionImpressionCountSeries(scopedEvents, days)}
            format="count"
          />
          <TrendChart
            title="קליקים על מבצעים"
            data={getPromotionClickCountSeries(scopedEvents, days)}
            format="count"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900">ביצועי מבצעים</h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="p-2 text-start">מבצע</th>
                <th className="p-2 text-start">חשיפות</th>
                <th className="p-2 text-start">קליקים</th>
              </tr>
            </thead>
            <tbody>
              {promotionStats.length === 0 && (
                <tr>
                  <td className="p-2 text-neutral-400" colSpan={3}>
                    אין נתונים עדיין
                  </td>
                </tr>
              )}
              {promotionStats.map((stat) => (
                <tr key={stat.promotionId} className="border-t border-neutral-100">
                  <td className="p-2">{promotionTitleById.get(stat.promotionId) ?? stat.promotionId}</td>
                  <td className="p-2">{stat.impressions}</td>
                  <td className="p-2">{stat.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
