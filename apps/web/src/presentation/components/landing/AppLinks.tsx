import { headers } from "next/headers";
import { he } from "@smartroute/core/i18n/he";
import { buttonClassName } from "@/src/presentation/components/ui/button-styles";
import {
  APP_STORE_URL,
  PLAY_STORE_LIVE,
  androidIntentUrl,
  playStoreUrl,
} from "@/src/presentation/app-links";

/**
 * Store download buttons, plus (on Android, when `deepPath` is given) an
 * "open in app" button for a shared link. `deepPath` also rides along on the
 * Play link as an install referrer so the app resumes it after install.
 */
export async function AppLinks({ deepPath }: { deepPath?: string }) {
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
