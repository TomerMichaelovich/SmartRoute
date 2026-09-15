import { requireUser } from "@/src/presentation/auth/dal";
import { getUserHousehold } from "@/src/presentation/auth/household";
import { householdRepository, shoppingListRepository } from "@/src/infrastructure/container";
import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import {
  cancelJoinRequest,
  createHousehold,
  createInvite,
  leaveHousehold,
} from "@/src/presentation/actions/household-actions";
import { InviteLink } from "@/src/presentation/components/household/InviteLink";
import { MemberRow } from "@/src/presentation/components/household/MemberRow";
import { Button } from "@/src/presentation/components/ui/Button";
import { he } from "@smartroute/core/i18n/he";

export default async function HouseholdPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser("/household");
  const { error } = await searchParams;
  const ctx = await getUserHousehold();

  // --- No household ---
  if (!ctx) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-neutral-900">{he.household.title}</h1>
          <p className="text-sm text-neutral-600">{he.household.subtitle}</p>
        </header>
        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold text-neutral-900">{he.household.none.title}</h2>
          <p className="text-sm text-neutral-600">{he.household.none.body}</p>
          <form action={createHousehold} className="flex flex-col gap-2 pt-1">
            <label htmlFor="name" className="text-sm font-medium text-neutral-700">
              {he.household.none.createLabel}
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder={he.household.none.createPlaceholder}
              className="rounded-xl border border-neutral-300 px-3 py-2.5 focus:border-cyan-500 focus:outline-none"
            />
            <Button type="submit" fullWidth>
              {he.household.none.createButton}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  const { user, membership, household } = ctx;

  // --- Pending approval ---
  if (membership.status === "pending") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-neutral-900">{he.household.title}</h1>
        </header>
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">{he.household.pending.title}</h2>
          <p className="text-sm text-amber-800">{he.household.pending.body(household.name)}</p>
          <form action={cancelJoinRequest}>
            <Button type="submit" variant="ghost">
              {he.household.pending.cancel}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  // --- Active member ---
  const isOwner = membership.role === "owner";
  const [members, invites, sharedList] = await Promise.all([
    householdRepository.listMembers(household.id),
    isOwner ? householdRepository.listActiveInvites(household.id) : Promise.resolve([]),
    shoppingListRepository.findByHousehold(household.id),
  ]);
  // Owner first, then active, then pending.
  members.sort((a, b) => {
    const rank = (m: (typeof members)[number]) =>
      m.role === "owner" ? 0 : m.status === "active" ? 1 : 2;
    return rank(a) - rank(b);
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{household.name}</h1>
        <p className="text-sm text-neutral-600">{he.household.subtitle}</p>
      </header>

      {error === "owner_leave" && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {he.household.ownerCantLeave}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">
          {he.household.sharedList.badge}
        </h2>
        {sharedList ? (
          <LinkButton href="/household/list">{he.household.sharedList.openButton}</LinkButton>
        ) : (
          <LinkButton href="/household/new-list" variant="secondary">
            {he.household.sharedList.createButton}
          </LinkButton>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">{he.household.members.heading}</h2>
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              isSelf={m.userId === user.id}
              viewerIsOwner={isOwner}
            />
          ))}
        </ul>
      </section>

      {isOwner && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-neutral-700">{he.household.invite.heading}</h2>
          <p className="text-xs text-neutral-500">{he.household.invite.expiresNote}</p>
          {invites.map((inv) => (
            <InviteLink key={inv.id} inviteId={inv.id} code={inv.code} />
          ))}
          <form action={createInvite}>
            <Button type="submit" variant="secondary">
              {he.household.invite.generate}
            </Button>
          </form>
        </section>
      )}

      <form action={leaveHousehold}>
        <Button type="submit" variant="ghost">
          {he.household.leave}
        </Button>
      </form>
    </main>
  );
}
