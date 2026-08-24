import type { Store } from "@/src/domain/entities/store";

interface AnalyticsFilterFormProps {
  stores: Store[];
  selectedStoreId?: string;
  from: string;
  to: string;
}

export function AnalyticsFilterForm({ stores, selectedStoreId, from, to }: AnalyticsFilterFormProps) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <label className="flex flex-col gap-1 text-sm text-neutral-600">
        סניף
        <select
          name="storeId"
          defaultValue={selectedStoreId ?? ""}
          className="rounded-lg border border-neutral-300 p-2"
        >
          <option value="">כל הסניפים</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-600">
        מתאריך
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-600">
        עד תאריך
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="rounded-lg border border-neutral-300 p-2"
        />
      </label>
      <button type="submit" className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white">
        סנן
      </button>
    </form>
  );
}
