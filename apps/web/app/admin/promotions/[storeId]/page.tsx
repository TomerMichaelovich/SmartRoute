import Link from "next/link";
import { notFound } from "next/navigation";
import {
  nodeRepository,
  productListingRepository,
  productRepository,
  promotionRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import {
  createPromotion,
  updatePromotion,
} from "@/src/presentation/actions/admin-promotion-actions";

function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default async function AdminStorePromotionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { storeId } = await params;
  const { status } = await searchParams;

  const store = await storeRepository.findById(storeId);
  if (!store) notFound();

  const [allPromotions, nodes, listings, products] = await Promise.all([
    promotionRepository.findAll(),
    nodeRepository.findByStore(storeId),
    productListingRepository.findByStore(storeId),
    productRepository.findAll(),
  ]);

  // Direct-to-this-store promos, plus chain-wide ones (no storeId) for the
  // same chain - the same rule a shopper's route actually applies.
  const storePromotions = allPromotions.filter(
    (p) => p.storeId === storeId || (!p.storeId && p.chainId === store.chainId),
  );
  const promotions =
    status === "active"
      ? storePromotions.filter((p) => p.isActive)
      : status === "inactive"
        ? storePromotions.filter((p) => !p.isActive)
        : storePromotions;

  const nodeLabelById = new Map(nodes.map((n) => [n.id, n.label]));
  const departmentNodes = nodes.filter((n) => n.type === "department");
  const productNameById = new Map(products.map((p) => [p.id, p.canonicalName]));

  // Which products actually sit at a given node - what the promo will
  // literally appear next to for the shopper.
  function productNamesAtNode(nodeId: string): string[] {
    return listings
      .filter((l) => l.nodeId === nodeId)
      .map((l) => productNameById.get(l.productId))
      .filter((name): name is string => Boolean(name));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/promotions" className="text-sm text-cyan-700">
          ← כל הסניפים
        </Link>
        <h1 className="text-lg font-semibold text-neutral-900">
          מבצעים · {store.name} ({storePromotions.length})
        </h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { value: undefined, label: "הכל" },
          { value: "active", label: "פעילים" },
          { value: "inactive", label: "לא פעילים" },
        ].map((option) => (
          <a
            key={option.label}
            href={
              option.value
                ? `/admin/promotions/${storeId}?status=${option.value}`
                : `/admin/promotions/${storeId}`
            }
            className={`rounded-full px-3 py-1 text-sm ${
              status === option.value || (!status && !option.value)
                ? "bg-cyan-600 text-white"
                : "bg-white text-neutral-600"
            }`}
          >
            {option.label}
          </a>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {promotions.length === 0 && (
          <p className="text-neutral-500">אין מבצעים בסניף זה</p>
        )}
        {promotions.map((promo) => {
          const productNames = productNamesAtNode(promo.attachedNodeId);
          return (
            <details key={promo.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <summary className="flex cursor-pointer items-center justify-between font-medium text-neutral-900">
                <span>
                  {promo.title}
                  {!promo.isActive && <span className="ms-2 text-xs text-red-500">(לא פעיל)</span>}
                  {!promo.storeId && (
                    <span className="ms-2 text-xs text-neutral-400">(כל הרשת)</span>
                  )}
                </span>
              </summary>

              <div className="mt-2 flex flex-col gap-0.5 rounded-lg bg-cyan-50 p-2 text-xs text-cyan-900">
                <span>
                  📍 יקפוץ ליד: <strong>{nodeLabelById.get(promo.attachedNodeId) ?? promo.attachedNodeId}</strong>
                </span>
                {productNames.length > 0 && (
                  <span>מוצרים באזור זה: {productNames.join(", ")}</span>
                )}
              </div>

              <form
                action={updatePromotion.bind(null, promo.id)}
                className="mt-3 flex flex-col gap-2"
              >
                <input
                  name="title"
                  defaultValue={promo.title}
                  className="rounded-lg border border-neutral-300 p-2"
                />
                <textarea
                  name="description"
                  defaultValue={promo.description}
                  rows={2}
                  className="rounded-lg border border-neutral-300 p-2"
                />
                <div className="flex gap-2">
                  <input
                    name="startDate"
                    type="date"
                    defaultValue={toDateInputValue(promo.startDate)}
                    className="w-1/2 rounded-lg border border-neutral-300 p-2"
                  />
                  <input
                    name="endDate"
                    type="date"
                    defaultValue={toDateInputValue(promo.endDate)}
                    className="w-1/2 rounded-lg border border-neutral-300 p-2"
                  />
                </div>
                <input
                  name="frequencyCapPerSession"
                  type="number"
                  min="1"
                  defaultValue={promo.frequencyCapPerSession}
                  className="rounded-lg border border-neutral-300 p-2"
                />
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" name="isActive" defaultChecked={promo.isActive} /> פעיל
                </label>
                <button
                  type="submit"
                  className="self-start rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  שמור
                </button>
              </form>
            </details>
          );
        })}
      </div>

      <form
        action={createPromotion}
        className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="text-base font-semibold text-neutral-900">מבצע חדש בסניף {store.name}</h2>
        <input type="hidden" name="storeId" value={storeId} />
        <input
          name="title"
          placeholder="כותרת"
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
        <textarea
          name="description"
          placeholder="תיאור"
          rows={2}
          className="rounded-lg border border-neutral-300 p-2"
        />
        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          צומת מצורף — היכן המבצע יקפוץ ללקוח
          <select
            name="attachedNodeId"
            required
            className="rounded-lg border border-neutral-300 p-2 text-neutral-900"
          >
            <option value="">בחרו צומת...</option>
            {departmentNodes.map((node) => {
              const names = productNamesAtNode(node.id);
              return (
                <option key={node.id} value={node.id}>
                  {node.label}
                  {names.length > 0 ? ` (${names.slice(0, 3).join(", ")})` : ""}
                </option>
              );
            })}
          </select>
        </label>
        <div className="flex gap-2">
          <input name="startDate" type="date" className="w-1/2 rounded-lg border border-neutral-300 p-2" />
          <input name="endDate" type="date" className="w-1/2 rounded-lg border border-neutral-300 p-2" />
        </div>
        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          מספר הפעמים המקסימלי שהמבצע יוצג לאותו מבקר בביקור אחד
          <input
            name="frequencyCapPerSession"
            type="number"
            min="1"
            defaultValue={3}
            className="rounded-lg border border-neutral-300 p-2 text-neutral-900"
          />
        </label>
        <button
          type="submit"
          className="self-start rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white"
        >
          צור מבצע
        </button>
      </form>
    </div>
  );
}
