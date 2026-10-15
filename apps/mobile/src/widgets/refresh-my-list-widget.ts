import { requestWidgetUpdate } from "react-native-android-widget";
import { loadMyListWidget } from "./load-my-list-widget";
import { MY_LIST_WIDGET_NAME } from "./load-my-list-widget";

/** Re-renders the "my list" widget; resolves once done (the push background task awaits it). */
export async function updateMyListWidget(): Promise<void> {
  try {
    await requestWidgetUpdate({
      widgetName: MY_LIST_WIDGET_NAME,
      renderWidget: () => loadMyListWidget(),
    });
  } catch {
    // Best-effort - the in-app UI already reflects the change regardless.
  }
}

/**
 * Call after setMyListCode() (or anything else that changes what the "my list" widget
 * should show) so the home-screen widget updates immediately, instead of waiting for
 * Android's next periodic refresh tick (minimum 30 minutes). Fire-and-forget - a widget
 * that isn't added to any home screen yet is a normal, silent no-op.
 */
export function refreshMyListWidget(): void {
  void updateMyListWidget();
}
