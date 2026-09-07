"use client";

import { useState } from "react";
import { logout } from "@/src/presentation/actions/auth-actions";
import { Button } from "@/src/presentation/components/ui/Button";
import { clearLocalUserData } from "@/src/presentation/lib/local-cleanup";
import { he } from "@smartroute/core/i18n/he";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    // Clear device-local list/route state BEFORE the server drops the session
    // and redirects, so nothing survives for the next person on this device.
    clearLocalUserData();
    await logout();
  }

  return (
    <Button variant="secondary" fullWidth onClick={handleLogout} disabled={pending}>
      {pending ? he.account.loggingOut : he.account.logout}
    </Button>
  );
}
