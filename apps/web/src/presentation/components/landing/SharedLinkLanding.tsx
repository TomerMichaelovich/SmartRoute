import { he } from "@smartroute/core/i18n/he";
import { AppLinks } from "./AppLinks";

interface SharedLinkLandingProps {
  title: string;
  body: string;
  /** App path this link opens, e.g. "/household/join/ABC123". */
  deepPath: string;
  code: string;
}

/**
 * What a shared app link (household invite, shared list) shows when it's
 * opened in a browser instead of being caught by the installed app - i.e. the
 * app isn't installed, or the device isn't Android.
 */
export function SharedLinkLanding({ title, body, deepPath, code }: SharedLinkLandingProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <p className="text-sm font-semibold tracking-wide text-neutral-400">{he.common.appName}</p>
      <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
      <p className="text-neutral-600">{body}</p>
      <AppLinks deepPath={deepPath} />
      <p className="text-sm text-neutral-500">{he.landing.manualCode(code)}</p>
    </main>
  );
}
