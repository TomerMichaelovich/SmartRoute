import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { he } from "@smartroute/core/i18n/he";
import { AppLinks } from "@/src/presentation/components/landing/AppLinks";
import { DashboardMockup } from "@/src/presentation/components/landing/DashboardMockup";
import { PhoneMockup } from "@/src/presentation/components/landing/PhoneMockup";
import { landingContent as c } from "@/src/presentation/components/landing/content";
import { Icon } from "@/src/presentation/components/landing/icons";
import { CONTACT_EMAIL } from "@/src/presentation/app-links";
import navioMark from "@/public/icons/navio-192.png";

const DESCRIPTION =
  "NAVIO הופכת את רשימת הקניות למסלול מדויק על מפת הסניף: רשימה משותפת לכל הבית, זיהוי רשימה מצילום ומבצעים בדיוק בדרך.";

export const metadata: Metadata = {
  metadataBase: new URL("https://navio.co.il"),
  title: `${he.common.appName} – ניווט חכם בתוך הסופרמרקט`,
  description: DESCRIPTION,
  openGraph: {
    title: `${he.common.appName} – ${he.home.tagline}`,
    description: DESCRIPTION,
    url: "/",
    siteName: he.common.appName,
    locale: "he_IL",
    type: "website",
    images: [{ url: "/navio-logo.png", width: 1130, height: 1130 }],
  },
};

// The public site is a landing page only - shopping happens in the mobile app,
// and the web app otherwise serves just /admin and the API the app talks to.
export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <Header />
      <main className="flex-1">
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <Retailers />
        <Vision />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2.5" aria-label={he.common.appName}>
      <Image src={navioMark} alt="" className="size-9 rounded-lg bg-white" />
      <span className="text-xl font-extrabold tracking-[0.18em] text-navy-900" dir="ltr">
        {he.common.appName}
      </span>
    </a>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-neutral-600 lg:flex">
          {c.nav.map((item) => (
            <a key={item.href} href={item.href} className="transition-colors hover:text-navy-900">
              {item.label}
            </a>
          ))}
        </nav>
        <a
          href="#download"
          className="rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-800"
        >
          {c.headerCta}
        </a>
      </div>
    </header>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-bold tracking-wide text-brand-dark">{eyebrow}</p>
      <h2 className="text-balance mt-3 text-3xl font-extrabold leading-tight text-navy-900 sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-lg leading-relaxed text-neutral-600">{body}</p>}
    </div>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-navy-900 text-white"
      style={{
        backgroundImage:
          "radial-gradient(60rem 30rem at 15% 10%, rgba(24,180,198,0.28), transparent 60%), radial-gradient(40rem 30rem at 90% 100%, rgba(22,63,134,0.9), transparent 70%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-white/85">
            <span className="size-2 rounded-full bg-brand" />
            {c.hero.eyebrow}
          </p>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.15] sm:text-5xl lg:text-6xl">
            {c.hero.titleLead}
            <br />
            <span className="bg-gradient-to-l from-brand to-cyan-200 bg-clip-text text-transparent">
              {c.hero.titleAccent}
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">{c.hero.body}</p>
          <div className="mt-8">
            <AppLinks tone="dark" />
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/80">
            {c.hero.highlights.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-brand/20 text-brand">
                  <Icon name="check" className="size-3.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <PhoneMockup />
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.problem.eyebrow} title={c.problem.title} body={c.problem.body} />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {c.problem.items.map((item) => (
            <div key={item.title} className="rounded-2xl border border-neutral-200/80 bg-white p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                <Icon name={item.icon} />
              </span>
              <h3 className="mt-5 text-lg font-bold text-navy-900">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-neutral-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.how.eyebrow} title={c.how.title} body={c.how.body} />
        <div className="relative mt-16">
          <div
            className="absolute inset-x-[12%] top-7 hidden h-px bg-gradient-to-l from-brand/0 via-brand/50 to-brand/0 lg:block"
            aria-hidden
          />
          <ol className="relative grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {c.how.steps.map((step, i) => (
              <li key={step.title} className="relative text-center">
                <div className="relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-navy-900 text-white shadow-lg shadow-navy-900/20">
                  <Icon name={step.icon} />
                  <span className="absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white ring-4 ring-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-bold text-navy-900">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-xs leading-relaxed text-neutral-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.features.eyebrow} title={c.features.title} />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {c.features.items.map((item) => (
            <div
              key={item.title}
              className="group rounded-2xl border border-neutral-200/80 bg-white p-7 transition-shadow hover:shadow-xl hover:shadow-navy-900/5"
            >
              <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand/15 to-navy-700/10 text-navy-800 transition-colors group-hover:from-brand group-hover:to-navy-700 group-hover:text-white">
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

function Retailers() {
  return (
    <section id="retailers" className="relative overflow-hidden bg-navy-950 py-20 text-white sm:py-28">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "radial-gradient(50rem 25rem at 85% 0%, rgba(24,180,198,0.18), transparent 60%)" }}
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold tracking-wide text-brand">{c.retailers.eyebrow}</p>
          <h2 className="text-balance mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">{c.retailers.title}</h2>
          <p className="mt-4 text-lg leading-relaxed text-white/70">{c.retailers.body}</p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {c.retailers.items.map((item) => (
              <li key={item.title}>
                <span className="flex size-10 items-center justify-center rounded-lg bg-white/10 text-brand">
                  <Icon name={item.icon} className="size-5" />
                </span>
                <h3 className="mt-4 font-bold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">{item.body}</p>
              </li>
            ))}
          </ul>
          {CONTACT_EMAIL && (
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(c.retailers.contactSubject)}`}
              className="mt-10 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-navy-950 transition-colors hover:bg-cyan-300"
            >
              {c.retailers.cta}
              <Icon name="arrow" className="size-5" />
            </a>
          )}
        </div>
        <DashboardMockup />
      </div>
    </section>
  );
}

function Vision() {
  return (
    <section id="vision" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold tracking-wide text-brand-dark">{c.vision.eyebrow}</p>
          <h2 className="text-balance mt-4 text-2xl font-extrabold leading-snug text-navy-900 sm:text-4xl sm:leading-snug">
            {c.vision.title}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-neutral-600">{c.vision.body}</p>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 md:grid-cols-3">
          {c.vision.pillars.map((pillar) => (
            <div key={pillar.title} className="bg-white p-8">
              <h3 className="text-lg font-bold text-navy-900">{pillar.title}</h3>
              <p className="mt-2 leading-relaxed text-neutral-600">{pillar.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-neutral-500">
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

function Faq() {
  return (
    <section id="faq" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.faq.eyebrow} title={c.faq.title} />
        <div className="mt-12 space-y-3">
          {c.faq.items.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-neutral-200/80 bg-white px-6 py-5 open:shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-navy-900 [&::-webkit-details-marker]:hidden">
                {item.q}
                <Icon
                  name="chevron"
                  className="size-5 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mt-3 leading-relaxed text-neutral-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="download" className="px-4 py-20 sm:px-6 sm:py-24">
      <div
        className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-navy-900 px-6 py-14 text-center text-white sm:px-12 sm:py-16"
        style={{
          backgroundImage:
            "radial-gradient(30rem 18rem at 50% 0%, rgba(24,180,198,0.35), transparent 70%)",
        }}
      >
        <h2 className="text-balance text-3xl font-extrabold sm:text-4xl">{c.finalCta.title}</h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-white/75">{c.finalCta.body}</p>
        <div className="mt-8 flex justify-center">
          <AppLinks tone="dark" />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Logo />
          <p className="text-sm text-neutral-500">{he.home.tagline}</p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500">
          {c.nav.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-navy-900">
              {item.label}
            </a>
          ))}
          {CONTACT_EMAIL && (
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-navy-900" dir="ltr">
              {CONTACT_EMAIL}
            </a>
          )}
          <Link href="/admin/login" className="hover:text-navy-900">
            {c.footer.adminLogin}
          </Link>
        </nav>
      </div>
      <p className="border-t border-neutral-100 py-5 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} {he.common.appName}. {c.footer.rights}
      </p>
    </footer>
  );
}
