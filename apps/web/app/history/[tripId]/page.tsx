import { notFound } from "next/navigation";
import { requireUser } from "@/src/presentation/auth/dal";
import { shoppingTripRepository } from "@/src/infrastructure/container";
import { repeatTrip } from "@/src/presentation/actions/trip-actions";
import { Button } from "@/src/presentation/components/ui/Button";
import { he } from "@smartroute/core/i18n/he";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(iso),
  );
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const user = await requireUser(`/history/${tripId}`);
  const trip = await shoppingTripRepository.findById(tripId);
  if (!trip) notFound();
  if (trip.userId !== user.id) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-8">
        <p className="text-neutral-600">{he.history.notMine}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{he.history.detailTitle}</h1>
        <p className="text-sm text-neutral-600">
          {trip.storeName} · {formatDateTime(trip.completedAt)}
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">{he.history.itemsHeading}</h2>
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
          {trip.items.map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-neutral-900">
                {item.productName || item.rawText}
                {item.quantity ? ` ×${item.quantity}` : ""}
              </span>
              <span
                className={
                  "shrink-0 text-xs " +
                  (item.notFound
                    ? "text-amber-700"
                    : item.collected
                      ? "text-cyan-700"
                      : "text-neutral-400")
                }
              >
                {item.notFound
                  ? he.history.notFound
                  : item.collected
                    ? he.history.collected
                    : he.history.notCollected}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <form action={repeatTrip}>
        <input type="hidden" name="tripId" value={trip.id} />
        <Button type="submit" fullWidth>
          {he.history.repeat}
        </Button>
      </form>
    </main>
  );
}
