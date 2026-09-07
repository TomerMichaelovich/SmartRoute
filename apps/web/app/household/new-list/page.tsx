import { redirect } from "next/navigation";
import { getUserHousehold } from "@/src/presentation/auth/household";
import { shoppingListRepository, storeRepository } from "@/src/infrastructure/container";
import { createSharedList } from "@/src/presentation/actions/shared-list-actions";
import { Card } from "@/src/presentation/components/ui/Card";
import { Button } from "@/src/presentation/components/ui/Button";
import { he } from "@smartroute/core/i18n/he";

export default async function NewSharedListPage() {
  const ctx = await getUserHousehold();
  if (!ctx || ctx.membership.status !== "active") redirect("/household");

  if (await shoppingListRepository.findByHousehold(ctx.household.id)) {
    redirect("/household/list");
  }

  const stores = await storeRepository.findActive();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">
          {he.household.sharedList.createButton}
        </h1>
        <p className="text-neutral-600">{he.household.sharedList.createHint}</p>
      </header>

      <div className="flex flex-col gap-4">
        {stores.length === 0 && <p className="text-neutral-500">{he.branches.noBranches}</p>}
        {stores.map((store) => (
          <Card key={store.id} className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">{store.name}</h2>
              <p className="text-sm text-neutral-500">{store.address}</p>
            </div>
            <form action={createSharedList}>
              <input type="hidden" name="storeId" value={store.id} />
              <Button type="submit">{he.branches.selectBranch}</Button>
            </form>
          </Card>
        ))}
      </div>
    </main>
  );
}
