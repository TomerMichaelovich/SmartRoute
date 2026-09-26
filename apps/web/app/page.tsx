import Image from "next/image";
import { he } from "@smartroute/core/i18n/he";
import { AppLinks } from "@/src/presentation/components/landing/AppLinks";
import navioLogo from "@/public/navio-logo.png";

// The public site is a landing page only - shopping happens in the mobile app,
// and the web app otherwise serves just /admin and the API the app talks to.
export default function LandingPage() {
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

      <ul className="flex w-full max-w-xs flex-col gap-2 text-neutral-700">
        {he.landing.features.map((feature) => (
          <li key={feature} className="rounded-xl bg-white px-4 py-3 shadow-sm">
            {feature}
          </li>
        ))}
      </ul>

      <AppLinks />
    </main>
  );
}
