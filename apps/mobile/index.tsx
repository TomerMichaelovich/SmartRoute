import { registerWidgetTaskHandler, type WidgetTaskHandler } from "react-native-android-widget";
import { handleMyListWidgetClick } from "@/widgets/handle-widget-click";
import { loadMyListWidget } from "@/widgets/load-my-list-widget";

// Handles Android widget lifecycle events (add/update/resize/click) in a headless JS task -
// separate from the main app's UI tree. Runs in the same JS runtime as the app, so
// AsyncStorage (getMyListCode, via loadMyListWidget) is shared with it.
const widgetTaskHandler: WidgetTaskHandler = async (props) => {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      props.renderWidget(await loadMyListWidget());
      break;
    case "WIDGET_CLICK":
      // NOOP = MyListWidget's root swallows taps on empty areas so Android's default
      // "tap a widget -> open the app" doesn't fire; nothing to do or re-render.
      if (props.clickAction === "NOOP") break;
      await handleMyListWidgetClick(props.clickAction, props.clickActionData);
      props.renderWidget(await loadMyListWidget());
      break;
    default:
      break;
  }
};

registerWidgetTaskHandler(widgetTaskHandler);

// Boots the actual app (expo-router's own entry, normally set as "main" directly -
// this file replaces that in package.json so the widget handler above registers too).
import "expo-router/entry";
