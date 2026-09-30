export type AnalyticsEventType =
  | "route_started"
  | "route_completed"
  | "route_abandoned"
  | "item_classified"
  | "item_checked"
  | "item_not_found"
  | "classification_corrected"
  | "promotion_impression"
  | "promotion_click"
  | "satisfaction_rating";

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  sessionId: string;
  /**
   * The signed-in account that produced the event, attached server-side from
   * the request's session - never trusted from the client body. Absent for
   * guests and for events recorded before per-user attribution existed.
   */
  userId?: string;
  storeId?: string;
  routeId?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
