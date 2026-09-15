"use client";

import { useEffect, useState } from "react";
import type { Promotion } from "@smartroute/core/domain/entities/promotion";
import { useAnalytics } from "@/src/presentation/hooks/useAnalytics";
import { he } from "@smartroute/core/i18n/he";

interface PromotionCardProps {
  promotion: Promotion;
  routeId: string;
}

export function PromotionCard({ promotion, routeId }: PromotionCardProps) {
  const { sessionId, logEvent } = useAnalytics();
  const [taken, setTaken] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    logEvent("promotion_impression", { promotionId: promotion.id }, { routeId, storeId: promotion.storeId });
    // Fire once per mount, when sessionId first becomes available.
  }, [sessionId, logEvent, promotion.id, promotion.storeId, routeId]);

  function handleTakeIt() {
    if (taken) return;
    // "promotion_click" is the shopper's own confirmation that they actually
    // took the deal - not a tap on the card itself (the card has no other
    // interaction) - so it's a meaningful signal for "ביצועי מבצעים" in the
    // admin analytics, not just attention/accidental taps.
    logEvent("promotion_click", { promotionId: promotion.id }, { routeId, storeId: promotion.storeId });
    setTaken(true);
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-start">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
          {he.promotions.sponsored}
        </span>
        <span className="text-sm font-semibold text-neutral-900">{promotion.title}</span>
      </div>
      <p className="text-xs leading-5 text-neutral-600">{promotion.description}</p>
      {taken ? (
        <span className="self-start rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900">
          {he.promotions.taken}
        </span>
      ) : (
        <button
          type="button"
          onClick={handleTakeIt}
          className="self-start rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 active:bg-amber-100"
        >
          {he.promotions.takeIt}
        </button>
      )}
    </div>
  );
}
