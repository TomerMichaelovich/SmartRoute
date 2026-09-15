import { nodeRepository, promotionRepository, storeRepository } from "@/src/infrastructure/container";
import {
  createPromotion,
  updatePromotion,
} from "@/src/presentation/actions/admin-promotion-actions";

function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const [allPromotions, stores] = await Promise.all([
    promotionRepository.findAll(),
    storeRepository.findAll(),
  ]);
  const promotions =
    status === "active"
      ? allPromotions.filter((p) => p.isActive)
      : status === "inactive"
        ? allPromotions.filter((p) => !p.isActive)
        : allPromotions;

  const nodesByStore = await Promise.all(stores.map((s) => nodeRepository.findByStore(s.id)));
  const nodeLabelById = new Map(nodesByStore.flat().map((n) => [n.id, n.label]));
  const locationOptions = stores.flatMap((store, i) =>
    nodesByStore[i]
      .filter((n) => n.type === "department")
      .map((n) => ({ value: `${store.id}::${n.id}`, label: `${store.name} — ${n.label}` })),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-neutral-900">מבצעים ({allPromotions.length})</h1>

      <div className="flex flex-wrap gap-2">
        {[
          { value: undefined, label: "הכל" },
          { value: "active", label: "פעילים" },
          { value: "inactive", label: "לא פעילים" },
        ].map((option) => (
          <a
            key={option.label}
            href={option.value ? `/admin/promotions?status=${option.value}` : "/admin/promotions"}
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
        {promotions.map((promo) => (
          <details key={promo.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <summary className="flex cursor-pointer items-center justify-between font-medium text-neutral-900">
              <span>
                {promo.title}
                {!promo.isActive && <span className="ms-2 text-xs text-red-500">(לא פעיל)</span>}
              </span>
              <span className="text-sm text-neutral-400">
                {nodeLabelById.get(promo.attachedNodeId) ?? promo.attachedNodeId}
              </span>
            </summary>
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
        ))}
      </div>

      <form
        action={createPromotion}
        className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="text-base font-semibold text-neutral-900">מבצע חדש</h2>
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
          חנות וצומת מצורף (הרשת נקבעת אוטומטית לפי החנות שנבחרה)
          <select name="location" required className="rounded-lg border border-neutral-300 p-2 text-neutral-900">
            <option value="">בחרו חנות וצומת...</option>
            {locationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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
