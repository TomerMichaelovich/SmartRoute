import Image from "next/image";
import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import { he } from "@/src/presentation/i18n/he";
import navioLogo from "@/public/navio-logo.png";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-10 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="sr-only">{he.common.appName}</h1>
        <Image src={navioLogo} alt={`${he.common.appName} – ${he.home.tagline}`} className="w-64 max-w-full" priority />
        <p className="max-w-xs text-neutral-600">{he.home.heroSubtitle}</p>
      </div>
      <LinkButton href="/branches" fullWidth className="max-w-xs">
        {he.home.startShopping}
      </LinkButton>
    </main>
  );
}
