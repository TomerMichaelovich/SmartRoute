import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import { he } from "@/src/presentation/i18n/he";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600 text-2xl font-bold text-white">
          SR
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-neutral-900">{he.common.appName}</h1>
          <p className="text-sm font-medium text-emerald-700">{he.home.tagline}</p>
        </div>
        <p className="max-w-xs text-neutral-600">{he.home.heroSubtitle}</p>
      </div>
      <LinkButton href="/branches" fullWidth className="max-w-xs">
        {he.home.startShopping}
      </LinkButton>
    </main>
  );
}
