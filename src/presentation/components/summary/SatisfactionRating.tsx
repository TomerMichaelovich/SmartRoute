"use client";

import { useState } from "react";
import { useAnalytics } from "@/src/presentation/hooks/useAnalytics";
import { he } from "@/src/presentation/i18n/he";

const RATINGS = [
  { value: 1, emoji: "😞" },
  { value: 2, emoji: "🙁" },
  { value: 3, emoji: "😐" },
  { value: 4, emoji: "🙂" },
  { value: 5, emoji: "😄" },
] as const;

export function SatisfactionRating({ routeId }: { routeId: string }) {
  const { logEvent } = useAnalytics();
  const [selected, setSelected] = useState<number | null>(null);

  function handleSelect(rating: number) {
    setSelected(rating);
    logEvent("satisfaction_rating", { rating }, { routeId });
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <p className="font-medium text-neutral-900">{he.summary.satisfactionQuestion}</p>
      {selected ? (
        <p className="text-sm text-cyan-700">{he.summary.satisfactionThanks}</p>
      ) : (
        <div className="flex gap-2">
          {RATINGS.map((rating) => (
            <button
              key={rating.value}
              type="button"
              onClick={() => handleSelect(rating.value)}
              aria-label={`${rating.value}/5`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-transform active:scale-90"
            >
              {rating.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
