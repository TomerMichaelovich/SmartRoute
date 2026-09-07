import Link from "next/link";
import { requireUser } from "@/src/presentation/auth/dal";
import { shoppingTripRepository } from "@/src/infrastructure/container";
import { he } from "@smartroute/core/i18n/he";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(new Date(iso));
}

export default async function HistoryPage() {
  const user = await requireUser("/history");
  const trips = await shoppingTripRepository.findByUser(user.id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{he.history.title}</h1>
        <p className="text-sm text-neutral-600">{he.history.subtitle}</p>
      </header>

      {trips.length === 0 ? (
        <p className="text-neutral-500">{he.history.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {trips.map((trip) => {
            const collected = trip.items.filter((i) => i.collected).length;
            return (
              <li key={trip.id}>
                <Link
                  href={`/history/${trip.id}`}
                  className="flex flex-col gap-1 rounded-2xl border border-neutral-200 bg-white p-4"
                >
                  <span className="font-semibold text-neutral-900">{trip.storeName}</span>
                  <span className="text-xs text-neutral-500">
                    {formatDate(trip.completedAt)} ·{" "}
                    {he.history.collectedCount(collected, trip.items.length)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
