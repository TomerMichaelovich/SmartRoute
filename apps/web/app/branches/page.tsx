import { Card } from "@/src/presentation/components/ui/Card";
import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import { he } from "@smartroute/core/i18n/he";
import { storeRepository } from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";
import { GuestListClaim } from "@/src/presentation/components/my-list/GuestListClaim";

export default async function BranchesPage() {
  const [stores, user] = await Promise.all([
    storeRepository.findActive(),
    getCurrentUser(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <GuestListClaim loggedIn={Boolean(user)} />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{he.branches.title}</h1>
        <p className="text-neutral-600">{he.branches.subtitle}</p>
      </header>

      <div className="flex flex-col gap-4">
        {stores.length === 0 && <p className="text-neutral-500">{he.branches.noBranches}</p>}
        {stores.map((store) => (
          <Card key={store.id} className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">{store.name}</h2>
              <p className="text-sm text-neutral-500">{store.address}</p>
            </div>
            <LinkButton href={`/list/${store.id}`}>{he.branches.selectBranch}</LinkButton>
          </Card>
        ))}
      </div>
    </main>
  );
}
