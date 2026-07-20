"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalyticsEventType } from "@/src/domain/entities/analytics-event";

const SESSION_STORAGE_KEY = "smartroute:sessionId";
export const SESSION_COOKIE_NAME = "smartroute_session";
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function readOrCreateSessionId(): string {
  let sessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  // Mirrored into a cookie so Server Components (e.g. the Route Screen,
  // which filters promotions by this session's prior impressions) can read
  // the same session id - localStorage isn't available server-side.
  document.cookie = `${SESSION_COOKIE_NAME}=${sessionId}; path=/; max-age=${SESSION_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  return sessionId;
}

interface LogEventExtra {
  storeId?: string;
  routeId?: string;
}

/**
 * Fires analytics events to POST /api/analytics/events. sessionId is null
 * until the mount effect runs (localStorage isn't available during SSR);
 * logEvent silently no-ops until then - fine in practice since events are
 * fired either from mount effects gated on sessionId, or from user
 * interactions that happen well after mount.
 */
export function useAnalytics() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  // localStorage/cookies aren't available during SSR, so the session id
  // necessarily gets read/created after mount rather than via a lazy
  // useState initializer.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionId(readOrCreateSessionId());
  }, []);

  const logEvent = useCallback(
    (type: AnalyticsEventType, payload: Record<string, unknown> = {}, extra: LogEventExtra = {}) => {
      if (!sessionId) return;
      const body = JSON.stringify({ type, sessionId, payload, ...extra });

      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/analytics/events", new Blob([body], { type: "application/json" }));
        return;
      }
      fetch("/api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        // Best-effort - analytics failures should never disrupt the shopping flow.
      });
    },
    [sessionId],
  );

  return { sessionId, logEvent };
}
