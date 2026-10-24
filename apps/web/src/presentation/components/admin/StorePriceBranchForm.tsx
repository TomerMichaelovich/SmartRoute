import type { LinkableBranch } from "@/src/infrastructure/repositories/interfaces/price-repository";

interface StorePriceBranchFormProps {
  storeId: string;
  /** CBS code of the store's city, when its name resolves - that city's branches are listed first. */
  storeCityCode: number | null;
  branches: LinkableBranch[];
  /** Name of each other mapped store, for branches already linked elsewhere. */
  storeNameById: Map<string, string>;
  cityNameByCode: Map<number, string>;
  setStorePriceBranch: (formData: FormData) => Promise<void>;
}

/**
 * Links a mapped store to its branch in the chains' price files. A linked
 * branch opens this store's map from "the cheapest basket"; any other branch
 * shops as a plain list.
 */
export function StorePriceBranchForm({
  storeId,
  storeCityCode,
  branches,
  storeNameById,
  cityNameByCode,
  setStorePriceBranch,
}: StorePriceBranchFormProps) {
  const linked = branches.find((b) => b.navioStoreId === storeId);
  const byCity = new Map<number | null, LinkableBranch[]>();
  for (const b of branches) byCity.set(b.cityCode, [...(byCity.get(b.cityCode) ?? []), b]);
  const cities = [...byCity.keys()].sort((a, b) => Number(b === storeCityCode) - Number(a === storeCityCode));

  return (
    <form action={setStorePriceBranch} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-base font-semibold text-neutral-900">סניף ברשימות המחירים</h2>
      <p className="text-xs text-neutral-500">
        כשלקוח בוחר את הסניף הזה במסך &quot;הסל הזול ביותר&quot;, הוא יגיע למפה של הסניף. סניף שלא מקושר נפתח כרשימה.
      </p>
      {branches.length === 0 ? (
        <p className="text-sm text-neutral-500">אין עדיין סניפים עם מחירים.</p>
      ) : (
        <>
          {/* key: a saved change re-renders the select with the new default. */}
          <select
            key={linked?.id ?? "none"}
            name="branchId"
            defaultValue={linked ? String(linked.id) : ""}
            className="rounded-lg border border-neutral-300 p-2"
          >
            <option value="">לא מקושר</option>
            {cities.map((code) => (
              <optgroup key={code ?? "unknown"} label={(code !== null && cityNameByCode.get(code)) || "עיר לא ידועה"}>
                {byCity.get(code)!.map((b) => {
                  const elsewhere = b.navioStoreId && b.navioStoreId !== storeId ? storeNameById.get(b.navioStoreId) : null;
                  return (
                    <option key={b.id} value={b.id}>
                      {b.chainName} · {b.name}
                      {b.address ? ` — ${b.address}` : ""}
                      {elsewhere ? ` (מקושר כעת ל-${elsewhere})` : ""}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          <button type="submit" className="self-start rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white">
            שמור קישור
          </button>
        </>
      )}
    </form>
  );
}
