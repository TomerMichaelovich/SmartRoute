import { redirect } from "next/navigation";
import { requireUser } from "@/src/presentation/auth/dal";
import { householdRepository } from "@/src/infrastructure/container";
import { requestJoin } from "@/src/presentation/actions/household-actions";
import { Button } from "@/src/presentation/components/ui/Button";
import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import { he } from "@smartroute/core/i18n/he";

export default async function HouseholdJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { code } = await params;
  const { error } = await searchParams;
  const user = await requireUser(`/household/join/${code}`);

  const invite = code === "invalid" ? null : await householdRepository.findValidInviteByCode(code);

  if (!invite) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-10 text-center">
        <h1 className="text-xl font-bold text-neutral-900">{he.household.join.title}</h1>
        <p className="text-neutral-600">{he.household.join.invalid}</p>
        <LinkButton href="/household">{he.household.title}</LinkButton>
      </main>
    );
  }

  const [household, membership] = await Promise.all([
    householdRepository.findById(invite.householdId),
    householdRepository.findMembershipForUser(user.id),
  ]);

  if (membership?.householdId === invite.householdId) redirect("/household");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-6 py-10 text-center">
      <h1 className="text-2xl font-bold text-neutral-900">{he.household.join.title}</h1>
      <p className="text-neutral-600">{he.household.join.prompt(household?.name ?? "")}</p>

      {membership || error === "already_in_other" ? (
        <>
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            {he.household.join.alreadyInOther}
          </p>
          <LinkButton href="/household" variant="secondary">
            {he.household.title}
          </LinkButton>
        </>
      ) : (
        <form action={requestJoin}>
          <input type="hidden" name="code" value={code} />
          <Button type="submit" fullWidth>
            {he.household.join.confirm}
          </Button>
        </form>
      )}
    </main>
  );
}
