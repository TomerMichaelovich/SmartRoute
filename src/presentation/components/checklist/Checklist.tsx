import type { Promotion } from "@/src/domain/entities/promotion";
import type { RouteStop } from "@/src/domain/entities/route";
import { PromotionCard } from "@/src/presentation/components/promotions/PromotionCard";
import { ChecklistItem } from "./ChecklistItem";

export interface ChecklistStopView {
  stop: RouteStop;
  items: Array<{ id: string; displayName: string; imageUrl?: string }>;
  promotion?: Promotion;
}

interface ChecklistProps {
  stopViews: ChecklistStopView[];
  checkedItemIds: Set<string>;
  selectedStopOrder: number | null;
  onToggleItem: (itemId: string) => void;
  onSelectStop: (order: number) => void;
  routeId: string;
}

export function Checklist({
  stopViews,
  checkedItemIds,
  selectedStopOrder,
  onToggleItem,
  onSelectStop,
  routeId,
}: ChecklistProps) {
  return (
    <div className="flex flex-col gap-3">
      {stopViews.map(({ stop, items, promotion }) => {
        const allChecked = items.length > 0 && items.every((item) => checkedItemIds.has(item.id));
        const isSelected = selectedStopOrder === stop.order;

        return (
          <div
            key={stop.nodeId}
            onClick={() => onSelectStop(stop.order)}
            className={`flex flex-col gap-2 rounded-2xl border p-4 shadow-sm transition-colors ${
              isSelected ? "border-emerald-400 bg-emerald-50" : "border-transparent bg-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                  allChecked ? "bg-neutral-400" : "bg-emerald-600"
                }`}
              >
                {stop.order}
              </span>
              <h3 className="font-semibold text-neutral-900">{stop.label}</h3>
            </div>
            <div className="flex flex-col divide-y divide-neutral-100 ps-11">
              {items.map((item) => (
                <ChecklistItem
                  key={item.id}
                  id={item.id}
                  displayName={item.displayName}
                  imageUrl={item.imageUrl}
                  checked={checkedItemIds.has(item.id)}
                  onToggle={onToggleItem}
                />
              ))}
            </div>
            {promotion && (
              <div className="ps-11">
                <PromotionCard promotion={promotion} routeId={routeId} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
