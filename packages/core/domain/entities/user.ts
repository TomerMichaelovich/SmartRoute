/**
 * An authenticated NAVIO account. Distinct from the anonymous analytics
 * `sessionId` (see useAnalytics) - that one groups events for guests too;
 * this one only exists once someone registers or signs in.
 *
 * `email` is always stored lowercased/trimmed so lookups are case-insensitive
 * without a citext column. `displayName` is what other household members see.
 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export type AuthProvider = "google";
