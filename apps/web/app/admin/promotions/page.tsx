import Link from "next/link";
import { promotionRepository, storeRepository } from "@/src/infrastructure/container";

export default async function AdminPromotionsStorePickerPage() {
  const [stores, promotions] = await Promise.all([
    storeRepository.findAll(),
    promotionRepository.findAll(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-neutral-900">מבצעים</h1>
      <p className="text-sm text-neutral-500">בחרו סניף כדי לראות ולנהל את המבצעים שלו</p>

      <div className="flex flex-col gap-2">
        {stores.map((store) => {
          // Promotions that actually surface at this store: attached directly
          // to it, or chain-wide (no storeId) for the same chain - same rule
          // promotion-service.ts uses to pick what a shopper there sees.
          const count = promotions.filter(
            (p) => p.storeId === store.id || (!p.storeId && p.chainId === store.chainId),
          ).length;
          return (
            <Link
              key={store.id}
              href={`/admin/promotions/${store.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 hover:border-cyan-400"
            >
              <div>
                <div className="text-base font-semibold text-neutral-900">
                  {store.name}
                  {!store.isActive && <span className="ms-2 text-xs text-red-500">(לא פעיל)</span>}
                </div>
                <div className="text-sm text-neutral-500">{store.address}</div>
              </div>
              <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                {count} מבצעים
              </span>
            </Link>
          );
        })}
        {stores.length === 0 && <p className="text-neutral-500">אין עדיין סניפים</p>}
      </div>
    </div>
  );
}
