"use client";

import { useEffect } from "react";
import { useAnalytics } from "@/src/presentation/hooks/useAnalytics";

interface SummaryAnalyticsProps {
  routeId: string;
  storeId: string;
  durationSeconds: number;
  totalDistanceMeters: number;
  backtrackCount: number;
}

/** Renders nothing - just fires route_completed once the session id is ready. */
export function SummaryAnalytics({
  routeId,
  storeId,
  durationSeconds,
  totalDistanceMeters,
  backtrackCount,
}: SummaryAnalyticsProps) {
  const { sessionId, logEvent } = useAnalytics();

  useEffect(() => {
    if (!sessionId) return;
    logEvent(
      "route_completed",
      { durationSeconds, totalDistanceMeters, backtrackCount },
      { routeId, storeId },
    );
  }, [sessionId, logEvent, routeId, storeId, durationSeconds, totalDistanceMeters, backtrackCount]);

  return null;
}
