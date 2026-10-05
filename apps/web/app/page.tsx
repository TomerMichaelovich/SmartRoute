import type { Metadata } from "next";
import Image from "next/image";
import { he } from "@smartroute/core/i18n/he";
import { AppLinks } from "@/src/presentation/components/landing/AppLinks";
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
import { landingContent as c } from "@/src/presentation/components/landing/content";
import { Icon } from "@/src/presentation/components/landing/icons";
import storeAerial from "@/public/images/store-aerial.jpg";

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

// The public site's landing page, for shoppers - shopping happens in the
// mobile app. Retailers have their own page at /business; the web app
// otherwise serves just /admin and the API the app talks to.
export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <SiteHeader nav={c.nav} cta={{ href: "#download", label: c.headerCta }} />
      <main className="flex-1">
        <Hero />
        <Mission />
        <Problem />
        <HowItWorks />
        <Features />
        <FaqSection eyebrow={c.faq.eyebrow} title={c.faq.title} items={c.faq.items} tone="white" />
        <ClosingCta id="download" title={c.finalCta.title} body={c.finalCta.body}>
          <AppLinks tone="dark" />
        </ClosingCta>
      </main>
      <SiteFooter
        links={[...c.nav, { href: "/business", label: c.footer.business }]}
        rights={c.footer.rights}
      />
    </div>
  );
}

function Hero() {
  return (
    <HeroBand>
      <div>
        <Eyebrow>{c.hero.eyebrow}</Eyebrow>
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
    </HeroBand>
  );
}

// Soft per-card accents for the audience grid, cycled by index.
const AUDIENCE_TONES = [
  "bg-rose-50 text-rose-500",
  "bg-amber-50 text-amber-600",
  "bg-cyan-50 text-brand-dark",
  "bg-violet-50 text-violet-500",
  "bg-emerald-50 text-emerald-600",
  "bg-sky-50 text-sky-600",
];

function Mission() {
  return (
    <section id="mission" className="bg-gradient-to-b from-cyan-50/70 to-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-lg shadow-rose-500/10">
            <Icon name="heart" className="size-7" />
          </span>
          <p className="mt-6 text-sm font-bold tracking-wide text-brand-dark">{c.mission.eyebrow}</p>
          <h2 className="mt-3 text-4xl font-extrabold text-navy-900 sm:text-6xl">{c.mission.title}</h2>
          <p className="mt-6 text-lg leading-relaxed text-neutral-600 sm:text-xl sm:leading-relaxed">{c.mission.body}</p>
        </div>
        <h3 className="mt-16 text-center text-xl font-bold text-navy-900">{c.mission.audiencesTitle}</h3>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {c.mission.audiences.map((item, i) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm shadow-navy-900/5"
            >
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${AUDIENCE_TONES[i % AUDIENCE_TONES.length]}`}
              >
                <Icon name={item.icon} />
              </span>
              <div>
                <h4 className="text-lg font-bold text-navy-900">{item.title}</h4>
                <p className="mt-1.5 leading-relaxed text-neutral-600">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
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

// Layout and colors follow the design spec for this section (exact px values).
function HowItWorks() {
  return (
    <section id="how" className="bg-[#081a37] text-white">
      <div className="mx-auto grid max-w-6xl px-4 sm:px-6 min-[800px]:grid-cols-2 min-[800px]:gap-[65px]">
        <div className="py-[70px]">
          <p className="text-[14px] font-extrabold text-[#64e2c6]">{c.how.eyebrow}</p>
          <h2 className="text-balance mt-3 text-[clamp(32px,4vw,48px)] font-extrabold leading-tight">{c.how.title}</h2>
          <p className="mt-5 max-w-[500px] text-[18px] leading-[1.85] text-[#c4d2e2]">{c.how.body}</p>
          <ol className="mt-8 flex flex-col gap-[17px]">
            {c.how.steps.map((step, i) => (
              <li key={step.title} className="flex items-center gap-3.5 text-[17px] font-semibold">
                <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-[#214365] text-[15px] font-bold text-[#64e2c6]">
                  {i + 1}
                </span>
                {step.title}
              </li>
            ))}
          </ol>
        </div>

        {/* Store photo filling its column, fading into the dark background. */}
        <div className="relative h-[290px] max-[799px]:-mx-4 sm:max-[799px]:-mx-6 min-[800px]:h-auto">
          <Image
            src={storeAerial}
            alt={c.how.imageAlt}
            fill
            sizes="(min-width: 800px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[#081a37] to-transparent min-[800px]:hidden" />
          <div className="absolute inset-y-0 left-0 hidden w-1/3 bg-gradient-to-r from-[#081a37] to-transparent min-[800px]:block" />
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
