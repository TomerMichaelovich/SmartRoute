import Link from "next/link";
import { storeRepository } from "@/src/infrastructure/container";
import { createStore, deleteStore } from "@/src/presentation/actions/admin-store-actions";
import { DeleteStoreButton } from "@/src/presentation/components/admin/DeleteStoreButton";
import { NewStoreForm } from "@/src/presentation/components/admin/NewStoreForm";

export default async function AdminStoresPage() {
  const stores = await storeRepository.findAll();
  const existingChainIds = Array.from(new Set(stores.map((store) => store.chainId))).sort();

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

      <NewStoreForm existingChainIds={existingChainIds} createStore={createStore} />
    </div>
  );
}
