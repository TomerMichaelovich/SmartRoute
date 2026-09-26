import { apiFetch } from "@/lib/api";
import { loadStoredToken } from "@/lib/auth-token";
import { toggleWidgetListExpanded } from "./widget-list-state";

/**
 * Handles a WIDGET_CLICK from the native "my list" widget (see MyListWidget.tsx's
 * clickAction/clickActionData on its checkbox and expand rows). Called from index.tsx's
 * task handler, which re-renders the widget with loadMyListWidget() right after.
 */
export async function handleMyListWidgetClick(
  clickAction: string | undefined,
  clickActionData: Record<string, unknown> | undefined,
): Promise<void> {
  if (clickAction === "TOGGLE_ITEM") {
    const shareCode = typeof clickActionData?.shareCode === "string" ? clickActionData.shareCode : undefined;
    const itemId = typeof clickActionData?.itemId === "string" ? clickActionData.itemId : undefined;
    if (!shareCode || !itemId) return;
    await loadStoredToken();
    try {
      await apiFetch(`/api/lists/${shareCode}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: Boolean(clickActionData?.nextChecked) }),
      });
    } catch {
      // Best-effort - the widget just re-renders the pre-toggle state below.
    }
    return;
  }

  if (clickAction === "TOGGLE_EXPANDED") {
    await toggleWidgetListExpanded();
  }
}
