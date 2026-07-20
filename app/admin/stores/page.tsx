import Link from "next/link";
import { storeRepository } from "@/src/infrastructure/container";
import { createStore } from "@/src/presentation/actions/admin-store-actions";

export default async function AdminStoresPage() {
  const stores = await storeRepository.findAll();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-neutral-900">סניפים</h1>

      <div className="flex flex-col gap-2">
        {stores.map((store) => (
          <Link
            key={store.id}
            href={`/admin/stores/${store.id}`}
            className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-emerald-400"
          >
            <div className="font-semibold text-neutral-900">
              {store.name}
              {!store.isActive && <span className="ms-2 text-xs text-red-500">(לא פעיל)</span>}
            </div>
            <div className="text-sm text-neutral-500">{store.address}</div>
          </Link>
        ))}
      </div>

      <form
        action={createStore}
        className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="font-semibold text-neutral-900">סניף חדש</h2>
        <input
          name="name"
          placeholder="שם הסניף"
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
        <input
          name="chainId"
          placeholder="מזהה רשת (chainId)"
          required
          className="rounded-lg border border-neutral-300 p-2"
        />
        <input
          name="address"
          placeholder="כתובת"
          className="rounded-lg border border-neutral-300 p-2"
        />
        <input name="city" placeholder="עיר" className="rounded-lg border border-neutral-300 p-2" />
        <div className="flex gap-2">
          <input
            name="mapWidth"
            type="number"
            defaultValue={1000}
            className="w-1/2 rounded-lg border border-neutral-300 p-2"
          />
          <input
            name="mapHeight"
            type="number"
            defaultValue={1000}
            className="w-1/2 rounded-lg border border-neutral-300 p-2"
          />
        </div>
        <button
          type="submit"
          className="self-start rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
        >
          צור סניף
        </button>
      </form>
    </div>
  );
}
