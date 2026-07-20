import type { Promotion } from "@/src/domain/entities/promotion";
import { he } from "@/src/presentation/i18n/he";

export function PromotionCard({ promotion }: { promotion: Promotion }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
          {he.promotions.sponsored}
        </span>
        <span className="text-sm font-semibold text-neutral-900">{promotion.title}</span>
      </div>
      <p className="text-xs leading-5 text-neutral-600">{promotion.description}</p>
    </div>
  );
}
