import AsyncStorage from "@react-native-async-storage/async-storage";

const WIDGET_EXPANDED_KEY = "smartroute:widgetListExpanded";

// Persists whether the native "my list" widget's item list is showing all
// items or just the collapsed preview - read by load-my-list-widget.tsx,
// flipped by handle-widget-click.ts's TOGGLE_EXPANDED action.
export async function getWidgetListExpanded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WIDGET_EXPANDED_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function toggleWidgetListExpanded(): Promise<void> {
  const next = !(await getWidgetListExpanded());
  try {
    await AsyncStorage.setItem(WIDGET_EXPANDED_KEY, next ? "1" : "0");
  } catch {
    // Best-effort - the widget just won't remember the expand/collapse state.
  }
}
