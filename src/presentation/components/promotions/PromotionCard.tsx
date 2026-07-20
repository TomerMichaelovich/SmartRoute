"use client";

import { useEffect } from "react";
import type { Promotion } from "@/src/domain/entities/promotion";
import { useAnalytics } from "@/src/presentation/hooks/useAnalytics";
import { he } from "@/src/presentation/i18n/he";

interface PromotionCardProps {
  promotion: Promotion;
  routeId: string;
}

export function PromotionCard({ promotion, routeId }: PromotionCardProps) {
  const { sessionId, logEvent } = useAnalytics();

  useEffect(() => {
    if (!sessionId) return;
    logEvent("promotion_impression", { promotionId: promotion.id }, { routeId, storeId: promotion.storeId });
    // Fire once per mount, when sessionId first becomes available.
  }, [sessionId, logEvent, promotion.id, promotion.storeId, routeId]);

  function handleClick() {
    logEvent("promotion_click", { promotionId: promotion.id }, { routeId, storeId: promotion.storeId });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-start"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
          {he.promotions.sponsored}
        </span>
        <span className="text-sm font-semibold text-neutral-900">{promotion.title}</span>
      </div>
      <p className="text-xs leading-5 text-neutral-600">{promotion.description}</p>
    </button>
  );
}
