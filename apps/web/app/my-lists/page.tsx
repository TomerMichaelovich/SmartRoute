import { requireUser } from "@/src/presentation/auth/dal";
import { shoppingListRepository, storeRepository } from "@/src/infrastructure/container";
import { GuestListClaim } from "@/src/presentation/components/my-list/GuestListClaim";
import { MyListRow } from "@/src/presentation/components/my-list/MyListRow";
import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import { he } from "@smartroute/core/i18n/he";

export default async function MyListsPage() {
  const user = await requireUser("/my-lists");
  const lists = await shoppingListRepository.findByOwner(user.id);

  const storeIds = [...new Set(lists.map((l) => l.storeId))];
  const stores = await Promise.all(storeIds.map((id) => storeRepository.findById(id)));
  const storeNameById = new Map(
    stores.filter((s) => s !== null).map((s) => [s.id, s.name]),
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <GuestListClaim loggedIn />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{he.myList.manage.title}</h1>
        <p className="text-sm text-neutral-600">{he.myList.manage.subtitle}</p>
      </header>

      {lists.length === 0 ? (
        <p className="text-neutral-500">{he.myList.manage.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lists.map((list) => (
            <MyListRow
              key={list.id}
              list={list}
              storeName={storeNameById.get(list.storeId)}
            />
          ))}
        </ul>
      )}

      <LinkButton href="/branches" fullWidth>
        {he.myList.manage.newList}
      </LinkButton>
    </main>
  );
}
