import Image from "next/image";
import Link from "next/link";
import { he } from "@smartroute/core/i18n/he";
import navioMark from "@/public/icons/navio-192.png";
import { Icon } from "./icons";

// Building blocks shared by the public pages: / (shoppers) and /business.

interface NavLink {
  href: string;
  label: string;
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={he.common.appName}>
      <Image src={navioMark} alt="" className="size-9 rounded-lg bg-white" />
      <span className="text-xl font-extrabold tracking-[0.18em] text-navy-900" dir="ltr">
        {he.common.appName}
      </span>
    </Link>
  );
}

export function SiteHeader({ nav, cta }: { nav: NavLink[]; cta?: NavLink }) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-neutral-600 lg:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="transition-colors hover:text-navy-900">
              {item.label}
            </a>
          ))}
        </nav>
        {cta && (
          <a
            href={cta.href}
            className="rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-800"
          >
            {cta.label}
          </a>
        )}
      </div>
    </header>
  );
}

export function SiteFooter({ links, rights }: { links: NavLink[]; rights: string }) {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Logo />
          <p className="text-sm text-neutral-500">{he.home.tagline}</p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500">
          {links.map((item) =>
            item.href.startsWith("/") ? (
              <Link key={item.href} href={item.href} className="hover:text-navy-900">
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={item.href} className="hover:text-navy-900">
                {item.label}
              </a>
            ),
          )}
        </nav>
      </div>
      <p className="border-t border-neutral-100 py-5 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} {he.common.appName}. {rights}
      </p>
    </footer>
  );
}

export function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-bold tracking-wide text-brand-dark">{eyebrow}</p>
      <h2 className="text-balance mt-3 text-3xl font-extrabold leading-tight text-navy-900 sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-lg leading-relaxed text-neutral-600">{body}</p>}
    </div>
  );
}

/** Dark navy hero band with the brand glow and a faint grid. */
export function HeroBand({ children }: { children: React.ReactNode }) {
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
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-white/85">
      <span className="size-2 rounded-full bg-brand" />
      {children}
    </p>
  );
}

export function FaqSection({
  eyebrow,
  title,
  items,
  tone = "slate",
}: {
  eyebrow: string;
  title: string;
  items: { q: string; a: string }[];
  /** Background, so the section contrasts with whatever sits above it. */
  tone?: "slate" | "white";
}) {
  return (
    <section id="faq" className={`${tone === "slate" ? "bg-slate-50" : "bg-white"} py-20 sm:py-28`}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className="mt-12 space-y-3">
          {items.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-neutral-200/80 bg-white px-6 py-5 shadow-sm shadow-navy-900/5"
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

/** Rounded dark call-to-action card that closes a page. */
export function ClosingCta({
  id,
  title,
  body,
  children,
}: {
  id?: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="px-4 py-20 sm:px-6 sm:py-24">
      <div
        className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-navy-900 px-6 py-14 text-center text-white sm:px-12 sm:py-16"
        style={{ backgroundImage: "radial-gradient(30rem 18rem at 50% 0%, rgba(24,180,198,0.35), transparent 70%)" }}
      >
        <h2 className="text-balance text-3xl font-extrabold sm:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-white/75">{body}</p>
        <div className="mt-8 flex justify-center">{children}</div>
      </div>
    </section>
  );
}
