import { headers } from "next/headers";
import { he } from "@smartroute/core/i18n/he";
import { buttonClassName } from "@/src/presentation/components/ui/button-styles";
import {
  APP_STORE_URL,
  PLAY_STORE_LIVE,
  androidIntentUrl,
  playStoreUrl,
} from "@/src/presentation/app-links";
import { PlayGlyph } from "./icons";

/**
 * Store download buttons, plus (on Android, when `deepPath` is given) an
 * "open in app" button for a shared link. `deepPath` also rides along on the
 * Play link as an install referrer so the app resumes it after install.
 *
 * `tone="dark"` is the landing page's variant for dark backgrounds: a row of
 * store-badge buttons instead of the stacked full-width ones.
 */
export async function AppLinks({ deepPath, tone = "light" }: { deepPath?: string; tone?: "light" | "dark" }) {
  if (tone === "dark") return <DarkStoreButtons />;

  const userAgent = (await headers()).get("user-agent") ?? "";
  const isAndroid = /android/i.test(userAgent);

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-3">
      {deepPath && isAndroid && (
        <a href={androidIntentUrl(deepPath)} className={buttonClassName("primary", true)}>
          {he.landing.openInApp}
        </a>
      )}
      {PLAY_STORE_LIVE ? (
        <a
          href={playStoreUrl(deepPath)}
          className={buttonClassName(deepPath && isAndroid ? "secondary" : "primary", true)}
        >
          {he.landing.googlePlay}
        </a>
      ) : (
        <span className={buttonClassName("secondary", true, "pointer-events-none opacity-60")}>
          {he.landing.googlePlaySoon}
        </span>
      )}
      {APP_STORE_URL && (
        <a href={APP_STORE_URL} className={buttonClassName("secondary", true)}>
          {he.landing.appStore}
        </a>
      )}
    </div>
  );
}

const DARK_BASE =
  "inline-flex items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-base font-semibold transition-colors";

function DarkStoreButtons() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {PLAY_STORE_LIVE ? (
        <a href={playStoreUrl()} className={`${DARK_BASE} bg-white text-navy-900 hover:bg-cyan-50`}>
          <PlayGlyph />
          {he.landing.googlePlay}
        </a>
      ) : (
        <span className={`${DARK_BASE} border border-white/25 bg-white/5 text-white/80`}>
          <PlayGlyph />
          {he.landing.googlePlaySoon}
        </span>
      )}
      {APP_STORE_URL && (
        <a href={APP_STORE_URL} className={`${DARK_BASE} border border-white/30 text-white hover:bg-white/10`}>
          {he.landing.appStore}
        </a>
      )}
    </div>
  );
}
