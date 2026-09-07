"use client";

import { useEffect, useRef } from "react";

function readIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Renders nothing. On the Summary screen it POSTs the trip's collected /
 * not-found item ids (persisted per-route in localStorage by RouteView) to
 * /api/trips, which writes the immutable history entry for a logged-in owner.
 * The server is idempotent per route and no-ops for guests.
 */
export function TripRecorder({ routeId }: { routeId: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const body = JSON.stringify({
      routeId,
      collectedItemIds: readIds(`smartroute:route:${routeId}:checked`),
      notFoundItemIds: readIds(`smartroute:route:${routeId}:notfound`),
    });

    fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Best-effort - history is a bonus, never blocks the summary screen.
      sent.current = false;
    });
  }, [routeId]);

  return null;
}
