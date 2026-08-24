import { notFound } from "next/navigation";
import { routeRepository } from "@/src/infrastructure/container";
import { SatisfactionRating } from "@/src/presentation/components/summary/SatisfactionRating";
import { StatTile } from "@/src/presentation/components/summary/StatTile";
import { SummaryAnalytics } from "@/src/presentation/components/summary/SummaryAnalytics";
import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import { he } from "@/src/presentation/i18n/he";

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return he.summary.secondsShort(Math.round(totalSeconds));
  return he.summary.minutesShort(Math.round(totalSeconds / 60));
}

/**
 * Isolated from the component body on purpose: this Server Component is
 * request-scoped (a fresh render per request, not memoized like a client
 * component), so reading the clock here is safe - but the lint rule can't
 * tell request-scoped RSC render from a memoizable client render, so the
 * impure Date.now() call is kept out of the component function itself.
 */
function computeDurationSeconds(createdAt: string): number {
  return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 1000);
}

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { routeId } = await params;
  const route = await routeRepository.findById(routeId);
  if (!route) notFound();

  const durationSeconds = computeDurationSeconds(route.createdAt);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <SummaryAnalytics
        routeId={route.id}
        storeId={route.storeId}
        durationSeconds={durationSeconds}
        totalDistanceMeters={route.totalDistanceMeters}
        backtrackCount={route.backtrackCount}
      />
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold text-neutral-900">{he.summary.title}</h1>
        <p className="text-neutral-600">{he.summary.subtitle}</p>
      </header>

      <div className="flex gap-3">
        <div className="flex-1">
          <StatTile label={he.summary.duration} value={formatDuration(durationSeconds)} />
        </div>
        <div className="flex-1">
          <StatTile label={he.summary.distance} value={Math.round(route.totalDistanceMeters)} />
        </div>
        <div className="flex-1">
          <StatTile label={he.summary.backtracks} value={route.backtrackCount} />
        </div>
      </div>

      <SatisfactionRating routeId={route.id} storeId={route.storeId} />

      <LinkButton href="/branches" fullWidth>
        {he.summary.startNewRoute}
      </LinkButton>
    </main>
  );
}
