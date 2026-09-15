import { he } from "@smartroute/core/i18n/he";

/**
 * Plain <a> (not a client component) - it's a full-page navigation to the
 * OAuth start route, which then 302s to Google. `next` is carried through so
 * the callback lands the user back where they started.
 */
export function GoogleButton({ next }: { next?: string }) {
  const href = next
    ? `/api/auth/google?next=${encodeURIComponent(next)}`
    : "/api/auth/google";
  return (
    <a
      href={href}
      className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-300 bg-white px-5 py-3 text-base font-semibold text-neutral-700 transition-colors active:bg-neutral-100"
    >
      <svg viewBox="0 0 18 18" className="h-5 w-5" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.06l3.01-2.34z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
        />
      </svg>
      {he.auth.google.continueWith}
    </a>
  );
}
