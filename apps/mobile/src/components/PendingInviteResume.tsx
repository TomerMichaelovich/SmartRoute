import { usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { consumeInstallReferrerPath } from "@/lib/install-referrer";
import { getPendingInvite } from "@/lib/pending-invite";

/**
 * Resumes a shared link the user couldn't finish opening:
 * - first launch after installing from a link's Play Store button -> opens that link;
 * - signed in with a household invite still pending (e.g. registered via a
 *   path that dropped the `next` param) -> opens the join screen for it.
 * Renders nothing.
 */
export function PendingInviteResume() {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  const authReady = status !== "loading";

  useEffect(() => {
    if (!authReady) return;
    void consumeInstallReferrerPath().then((path) => {
      if (path) router.push(path);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  useEffect(() => {
    if (status !== "authenticated") return;
    // Mid-auth (login/register navigate on their own when done) or already joining.
    if (pathname === "/login" || pathname === "/register" || pathname.startsWith("/household/join")) return;
    void getPendingInvite().then((code) => {
      if (code) router.push({ pathname: "/household/join", params: { code } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pathname]);

  return null;
}
