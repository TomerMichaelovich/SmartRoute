import { toggleWidgetListExpanded } from "./widget-list-state";

/**
 * Handles a WIDGET_CLICK from the native "my list" widget (see MyListWidget.tsx's
 * clickAction on its expand row). Called from index.tsx's task handler, which
 * re-renders the widget with loadMyListWidget() right after. Items have no
 * checkboxes (the list is for writing only), so an old TOGGLE_ITEM tap from a
 * not-yet-redrawn widget is simply ignored and the redraw removes them.
 */
export async function handleMyListWidgetClick(
  clickAction: string | undefined,
  _clickActionData: Record<string, unknown> | undefined,
): Promise<void> {
  if (clickAction === "TOGGLE_EXPANDED") {
    await toggleWidgetListExpanded();
  }
}
