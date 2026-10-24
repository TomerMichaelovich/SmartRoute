import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSection } from "@smartroute/core/domain/entities/admin-user";
import { storeRepository } from "@/src/infrastructure/container";
import { createStore, deleteStore } from "@/src/presentation/actions/admin-store-actions";
import { requireAdminPage } from "@/src/presentation/auth/admin";
import { DeleteStoreButton } from "@/src/presentation/components/admin/DeleteStoreButton";
import { NewStoreForm } from "@/src/presentation/components/admin/NewStoreForm";

export default async function AdminStoresPage() {
  const principal = await requireAdminPage();
  // Full store access sees and manages every store; mapping access only lists its own.
  const manages = hasSection(principal, "stores");
  const allStores = await storeRepository.findAll();
  const stores = manages
    ? allStores
    : allStores.filter((s) => principal.kind === "user" && principal.permissions.storeIds.includes(s.id));
  if (!manages && stores.length === 0) redirect("/admin");
  const existingChainIds = Array.from(new Set(allStores.map((store) => store.chainId))).sort();

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
            {manages && (
              <DeleteStoreButton
                storeName={store.name}
                deleteStore={deleteStore.bind(null, store.id)}
                className="shrink-0 text-sm"
              />
            )}
          </div>
        ))}
      </div>

      {manages && <NewStoreForm existingChainIds={existingChainIds} createStore={createStore} />}
    </div>
  );
}
