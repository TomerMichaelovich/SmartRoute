import { householdRepository } from "@/src/infrastructure/container";
import { SharedLinkLanding } from "@/src/presentation/components/landing/SharedLinkLanding";
import { he } from "@smartroute/core/i18n/he";

// Landing for a household invite link opened outside the app. Joining itself
// happens in the mobile app; deliberately doesn't reveal the household's name,
// since this page is public.
export default async function HouseholdJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await householdRepository.findValidInviteByCode(code);

  if (!invite) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-10 text-center">
        <h1 className="text-xl font-bold text-neutral-900">{he.household.join.title}</h1>
        <p className="text-neutral-600">{he.household.join.invalid}</p>
      </main>
    );
  }

  return (
    <SharedLinkLanding
      title={he.landing.invite.title}
      body={he.landing.invite.body}
      deepPath={`/household/join/${code}`}
      code={code}
    />
  );
}
