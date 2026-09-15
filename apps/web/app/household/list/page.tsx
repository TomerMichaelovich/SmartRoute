import { redirect } from "next/navigation";
import { getUserHousehold } from "@/src/presentation/auth/household";
import {
  productRepository,
  shoppingListRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import { SharedListEditor } from "@/src/presentation/components/household/SharedListEditor";
import { he } from "@smartroute/core/i18n/he";

export default async function HouseholdListPage() {
  const ctx = await getUserHousehold();
  if (!ctx || ctx.membership.status !== "active") redirect("/household");

  const list = await shoppingListRepository.findByHousehold(ctx.household.id);
  if (!list) redirect("/household");

  const [store, products] = await Promise.all([
    storeRepository.findById(list.storeId),
    productRepository.findAllActive(),
  ]);
  const productNameById: Record<string, string> = {};
  for (const p of products) productNameById[p.id] = p.canonicalName;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">
          {he.household.sharedList.heading}
        </h1>
        <p className="text-sm text-neutral-600">{he.household.sharedList.subtitle}</p>
      </header>
      <SharedListEditor initialList={list} store={store} productNameById={productNameById} />
    </main>
  );
}
