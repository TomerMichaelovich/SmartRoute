"use no memo";

import { FlexWidget, TextWidget } from "react-native-android-widget";
import { he } from "@smartroute/core/i18n/he";

interface MyListWidgetProps {
  storeName?: string;
  itemCount?: number;
}

/**
 * Phase B content: mirrors HomeListWidget.tsx's in-app "my list" card, rendered as a real
 * Android home-screen widget instead. Pure/presentational on purpose - all data fetching
 * (getMyListCode + /api/lists/:code) happens in the headless task handler (index.tsx),
 * not here, since this function is excluded from the React Compiler ("use no memo") and
 * must stay hook-free per react-native-android-widget's requirements.
 */
export function MyListWidget({ storeName, itemCount }: MyListWidgetProps) {
  const hasList = itemCount !== undefined;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        borderRadius: 16,
        padding: 16,
      }}
    >
      {hasList ? (
        <FlexWidget style={{ flexDirection: "column", alignItems: "flex-end" }}>
          <TextWidget text={he.myList.widgetTitle} style={{ fontSize: 13, fontWeight: "600", color: "#0e7490" }} />
          {storeName && <TextWidget text={storeName} style={{ fontSize: 15, color: "#171717" }} />}
          <TextWidget text={he.myList.itemCount(itemCount)} style={{ fontSize: 12, color: "#737373" }} />
        </FlexWidget>
      ) : (
        <TextWidget text={he.common.appName} style={{ fontSize: 14, fontWeight: "700", color: "#0891b2" }} />
      )}
    </FlexWidget>
  );
}
