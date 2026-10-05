import type { Metadata } from "next";
import Link from "next/link";
import { he } from "@smartroute/core/i18n/he";
import { CONTACT_EMAIL } from "@/src/presentation/app-links";
import { DashboardMockup } from "@/src/presentation/components/landing/DashboardMockup";
import { PhoneMockup } from "@/src/presentation/components/landing/PhoneMockup";
import {
  ClosingCta,
  Eyebrow,
  FaqSection,
  HeroBand,
  SectionHeading,
  SiteFooter,
  SiteHeader,
} from "@/src/presentation/components/landing/SiteChrome";
import { businessContent as c } from "@/src/presentation/components/landing/content";
import { Icon } from "@/src/presentation/components/landing/icons";

const DESCRIPTION =
  "NAVIO לרשתות: עורך מפות סניף, מבצעים שממוקמים על המפה ולוח בקרה עם תובנות על התנהגות הקונים בתוך הסניף.";

export const metadata: Metadata = {
  metadataBase: new URL("https://navio.co.il"),
  title: `${he.common.appName} לרשתות ולסניפים`,
  description: DESCRIPTION,
  openGraph: {
    title: `${he.common.appName} לרשתות – ${c.hero.title}`,
    description: DESCRIPTION,
    url: "/business",
    siteName: he.common.appName,
    locale: "he_IL",
    type: "website",
    images: [{ url: "/navio-logo.png", width: 1130, height: 1130 }],
  },
};

/** mailto link for the demo CTA, or null until NAVIO_CONTACT_EMAIL is set. */
const demoHref = CONTACT_EMAIL
  ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(c.contactSubject)}`
  : null;

// The retailer-facing page: the admin platform, the vision, and a way to
// book a demo. Kept off the shopper landing page on purpose.
export default function BusinessPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <SiteHeader nav={c.nav} cta={demoHref ? { href: demoHref, label: c.cta } : undefined} />
      <main className="flex-1">
        <Hero />
        <Platform />
        <Shoppers />
        <Vision />
        <FaqSection eyebrow={c.faq.eyebrow} title={c.faq.title} items={c.faq.items} />
        {demoHref && (
          <ClosingCta title={c.finalCta.title} body={c.finalCta.body}>
            <DemoButton href={demoHref} />
          </ClosingCta>
        )}
      </main>
      <SiteFooter
        links={[
          ...c.nav,
          { href: "/", label: c.footer.shoppers },
          ...(CONTACT_EMAIL ? [{ href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL }] : []),
          { href: "/admin/login", label: c.footer.adminLogin },
        ]}
        rights={c.footer.rights}
      />
    </div>
  );
}

function DemoButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-navy-950 transition-colors hover:bg-cyan-300"
    >
      {c.cta}
      <Icon name="arrow" className="size-5" />
    </a>
  );
}

function Hero() {
  return (
    <HeroBand>
      <div>
        <Eyebrow>{c.hero.eyebrow}</Eyebrow>
        <h1 className="text-balance mt-6 text-4xl font-extrabold leading-[1.15] sm:text-5xl lg:text-6xl">
          {c.hero.title}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">{c.hero.body}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {demoHref && <DemoButton href={demoHref} />}
          <Link
            href="/"
            className="inline-flex items-center rounded-xl border border-white/30 px-6 py-3.5 font-semibold text-white transition-colors hover:bg-white/10"
          >
            {c.hero.secondaryCta}
          </Link>
        </div>
      </div>
      <DashboardMockup />
    </HeroBand>
  );
}

function Platform() {
  return (
    <section id="platform" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.platform.eyebrow} title={c.platform.title} />
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {c.platform.items.map((item) => (
            <div key={item.title} className="rounded-2xl border border-neutral-200/80 bg-white p-7">
              <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand/15 to-navy-700/10 text-navy-800">
                <Icon name={item.icon} />
              </span>
              <h3 className="mt-5 text-xl font-bold text-navy-900">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-neutral-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Shoppers() {
  return (
    <section id="shoppers" className="overflow-hidden py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold tracking-wide text-brand-dark">{c.shoppers.eyebrow}</p>
          <h2 className="text-balance mt-3 text-3xl font-extrabold leading-tight text-navy-900 sm:text-4xl">
            {c.shoppers.title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">{c.shoppers.body}</p>
          <ul className="mt-8 space-y-3">
            {c.shoppers.points.map((point) => (
              <li key={point} className="flex items-center gap-3 text-neutral-700">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-dark">
                  <Icon name="check" className="size-4" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <PhoneMockup />
      </div>
    </section>
  );
}

function Vision() {
  return (
    <section id="vision" className="bg-navy-950 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold tracking-wide text-brand">{c.vision.eyebrow}</p>
          <h2 className="text-balance mt-4 text-2xl font-extrabold leading-snug sm:text-4xl sm:leading-snug">
            {c.vision.title}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/70">{c.vision.body}</p>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
          {c.vision.pillars.map((pillar) => (
            <div key={pillar.title} className="bg-navy-950 p-8">
              <h3 className="text-lg font-bold text-brand">{pillar.title}</h3>
              <p className="mt-2 leading-relaxed text-white/70">{pillar.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-white/60">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          {c.vision.status}
        </p>
      </div>
    </section>
  );
}
