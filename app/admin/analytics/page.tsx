import {
  getAverageSatisfactionRating,
  getAverageShoppingDurationSeconds,
  getClassificationAccuracy,
  getNotFoundRate,
  getPromotionStats,
  getReturningSessionCount,
} from "@/src/application/analytics/analytics-service";
import { analyticsRepository, promotionRepository } from "@/src/infrastructure/container";
import { StatTile } from "@/src/presentation/components/summary/StatTile";

export default async function AdminAnalyticsPage() {
  const [events, promotions] = await Promise.all([
    analyticsRepository.readAll(),
    promotionRepository.findAll(),
  ]);

  const accuracy = getClassificationAccuracy(events);
  const notFoundRate = getNotFoundRate(events);
  const avgDuration = getAverageShoppingDurationSeconds(events);
  const avgSatisfaction = getAverageSatisfactionRating(events);
  const promotionStats = getPromotionStats(events);
  const returningSessions = getReturningSessionCount(events);
  const promotionTitleById = new Map(promotions.map((p) => [p.id, p.title]));

  const routeStarted = events.filter((e) => e.type === "route_started").length;
  const routeCompleted = events.filter((e) => e.type === "route_completed").length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-neutral-900">אנליטיקס</h1>

      <div className="flex flex-wrap gap-3">
        <div className="w-40">
          <StatTile label="דיוק סיווג" value={`${Math.round(accuracy * 100)}%`} />
        </div>
        <div className="w-40">
          <StatTile label="פריטים שלא נמצאו בפועל" value={`${Math.round(notFoundRate * 100)}%`} />
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
