import Link from "next/link";
import { storeRepository } from "@/src/infrastructure/container";
import { createStore, deleteStore } from "@/src/presentation/actions/admin-store-actions";
import { DeleteStoreButton } from "@/src/presentation/components/admin/DeleteStoreButton";

export default async function AdminStoresPage() {
  const stores = await storeRepository.findAll();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-neutral-900">סניפים</h1>

      <div className="flex flex-col gap-2">
        {stores.map((store) => (
          <div
            key={store.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 hover:border-cyan-400"
          >
            <Link href={`/admin/stores/${store.id}`} className="min-w-0 flex-1">
              <div className="text-base font-semibold text-neutral-900">
                {store.name}
                {!store.isActive && <span className="ms-2 text-xs text-red-500">(לא פעיל)</span>}
              </div>
              <div className="text-sm text-neutral-500">{store.address}</div>
            </Link>
            <DeleteStoreButton
              storeName={store.name}
              deleteStore={deleteStore.bind(null, store.id)}
              className="shrink-0 text-sm"
            />
          </div>
        ))}
      </div>

      <form
        action={createStore}
        className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="text-base font-semibold text-neutral-900">סניף חדש</h2>
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
          className="self-start rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white"
        >
          צור סניף
        </button>
      </form>
    </div>
  );
}
