import { requireUser } from "@/src/presentation/auth/dal";
import { LogoutButton } from "@/src/presentation/components/auth/LogoutButton";
import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import { he } from "@smartroute/core/i18n/he";

export default async function AccountPage() {
  const user = await requireUser("/account");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">{he.account.title}</h1>
      </header>

      <dl className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium text-neutral-500">{he.account.nameLabel}</dt>
          <dd className="text-neutral-900">{user.displayName}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium text-neutral-500">{he.account.emailLabel}</dt>
          <dd className="text-neutral-900" dir="ltr">
            {user.email}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3">
        <LinkButton href="/my-lists" fullWidth>
          {he.myList.manage.title}
        </LinkButton>
        <LinkButton href="/history" variant="secondary" fullWidth>
          {he.history.title}
        </LinkButton>
        <LinkButton href="/household" variant="secondary" fullWidth>
          {he.household.title}
        </LinkButton>
        <LinkButton href="/branches" variant="secondary" fullWidth>
          {he.home.startShopping}
        </LinkButton>
        <LogoutButton />
      </div>
    </main>
  );
}
