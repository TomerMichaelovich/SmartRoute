import Image from "next/image";
import Link from "next/link";
import { HomeListWidget } from "@/src/presentation/components/home/HomeListWidget";
import { GuestListClaim } from "@/src/presentation/components/my-list/GuestListClaim";
import { getCurrentUser } from "@/src/presentation/auth/dal";
import { shoppingListRepository, storeRepository } from "@/src/infrastructure/container";
import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import { he } from "@smartroute/core/i18n/he";
import navioLogo from "@/public/navio-logo.png";

export default async function HomePage() {
  const user = await getCurrentUser();

  // For a logged-in user the account's active list is authoritative for the
  // widget (works across devices); guests fall back to the localStorage code.
  let serverMyList = null;
  if (user) {
    const activeList = await shoppingListRepository.findActiveByOwner(user.id);
    if (activeList) {
      serverMyList = { list: activeList, store: await storeRepository.findById(activeList.storeId) };
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-10 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="sr-only">{he.common.appName}</h1>
        <Image
          src={navioLogo}
          alt={`${he.common.appName} – ${he.home.tagline}`}
          className="w-64 max-w-full"
          priority
        />
        <p className="max-w-xs text-neutral-600">{he.home.heroSubtitle}</p>
      </div>

      <GuestListClaim loggedIn={Boolean(user)} />
      <HomeListWidget serverMyList={serverMyList} loggedIn={Boolean(user)} />

      {user ? (
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <LinkButton href="/branches" fullWidth>
            {he.home.startShopping}
          </LinkButton>
          <LinkButton href="/my-lists" variant="secondary" fullWidth>
            {he.myList.manage.title}
          </LinkButton>
          <LinkButton href="/history" variant="ghost" fullWidth>
            {he.history.title}
          </LinkButton>
          <Link href="/account" className="text-sm text-neutral-500">
            {he.home.loggedInAs(user.displayName)} · {he.home.myAccount}
          </Link>
        </div>
      ) : (
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <LinkButton href="/register" fullWidth>
            {he.home.register}
          </LinkButton>
          <LinkButton href="/login" variant="secondary" fullWidth>
            {he.home.login}
          </LinkButton>
          <LinkButton href="/branches" variant="ghost" fullWidth>
            {he.home.continueAsGuest}
          </LinkButton>
        </div>
      )}
    </main>
  );
}
