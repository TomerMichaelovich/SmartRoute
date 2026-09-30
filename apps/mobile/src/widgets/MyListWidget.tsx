"use no memo";

import { FlexWidget, ImageWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import type { ProductCategory } from "@smartroute/core/domain/entities/product";
import { he } from "@smartroute/core/i18n/he";
import { COLORS } from "@/constants/colors";
import { CATEGORY_ICON, COLLAPSED_ITEM_COUNT } from "@/lib/list-widget-shared";
import { NAVIO_MARK_DATA_URI } from "./navio-mark";

export interface MyListWidgetItem {
  id: string;
  name: string;
  category: ProductCategory;
}

interface MyListWidgetProps {
  shareCode?: string;
  /** The displayed list's name - a user may have several lists. */
  title?: string;
  items?: MyListWidgetItem[];
  expanded?: boolean;
}

// Brand colors sampled from the NAVIO logo (navy "N" + teal route/pin).
const NAVY = "#0b2a5b";
const TEAL = "#0e9fb5";
const DIVIDER = "#eef1f3";

const MIC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" fill="none"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`;

/**
 * Real Android home-screen widget (react-native-android-widget/RemoteViews), not the
 * in-app HomeListWidget.tsx card - different rendering engine, so it's re-implemented
 * here rather than shared: no textDecorationLine (no strikethrough for checked items),
 * no custom fontFamily (system font only), and SvgWidget wants raw SVG markup instead of
 * react-native-svg components. Pure/presentational on purpose - all data fetching and the
 * TOGGLE_EXPANDED click handling happen outside this function (see
 * load-my-list-widget.tsx / handle-widget-click.ts / index.tsx's task handler), since this
 * function is excluded from the React Compiler ("use no memo") and must stay hook-free per
 * react-native-android-widget's requirements.
 *
 * Layout is mirrored for Hebrew by hand: children are listed in visual left-to-right order
 * (icon/logo on the right, text right-aligned) instead of relying on RN's
 * I18nManager RTL auto-mirroring the in-app screens use - that doesn't apply inside this
 * separate RemoteViews rendering path, and FlexWidget has no row-reverse.
 */
export function MyListWidget({ shareCode, title, items, expanded = false }: MyListWidgetProps) {
  // No active list (none created yet, or the last one was finished) - say so
  // instead of just showing the logo; tapping opens the app to start a new one.
  if (!items) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          height: "match_parent",
          width: "match_parent",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexGap: 6,
          backgroundColor: "#ffffff",
          borderRadius: 20,
          padding: 16,
        }}
      >
        <ImageWidget image={NAVIO_MARK_DATA_URI} imageWidth={44} imageHeight={44} />
        <TextWidget
          text={he.myList.widget.noActiveList}
          style={{ fontSize: 16, fontWeight: "700", color: NAVY, textAlign: "center" }}
        />
        <TextWidget
          text={he.myList.widget.noActiveListHint}
          style={{ fontSize: 12, color: COLORS.neutral500, textAlign: "center" }}
        />
      </FlexWidget>
    );
  }

  const openListUri = shareCode ? `smartroute://my-list/${shareCode}` : undefined;
  const openAction = openListUri ? "OPEN_URI" : "OPEN_APP";
  const openActionData = openListUri ? { uri: openListUri } : undefined;

  const visibleItems = expanded ? items : items.slice(0, COLLAPSED_ITEM_COUNT);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        borderRadius: 20,
        overflow: "hidden",
      }}
      clickAction="NOOP"
    >
      <FlexWidget
        clickAction={openAction}
        clickActionData={openActionData}
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexGap: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          backgroundGradient: { from: NAVY, to: TEAL, orientation: "RIGHT_LEFT" },
        }}
      >
        <FlexWidget
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.22)",
            borderRadius: 10,
            paddingHorizontal: 9,
            paddingVertical: 3,
          }}
        >
          <TextWidget
            text={he.myList.widget.productCount(items.length)}
            style={{ fontSize: 11, fontWeight: "600", color: "#ffffff" }}
          />
        </FlexWidget>
        {/* flex: 1 so a long list name truncates instead of pushing the count pill off. */}
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexGap: 8 }}>
          <TextWidget
            text={title ?? he.myList.widgetTitle}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 16, fontWeight: "700", color: "#ffffff", textAlign: "right" }}
          />
          <FlexWidget
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ImageWidget image={NAVIO_MARK_DATA_URI} imageWidth={24} imageHeight={24} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ width: "match_parent", flexDirection: "column", padding: 14, flexGap: 10 }}>
        <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 8 }}>
          <FlexWidget
            clickAction={openAction}
            clickActionData={openActionData}
            accessibilityLabel={he.myList.widget.micAccessibilityLabel}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: COLORS.cyan600,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SvgWidget svg={MIC_SVG} style={{ width: 18, height: 18 }} />
          </FlexWidget>
          <FlexWidget
            clickAction={openAction}
            clickActionData={openActionData}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 12,
              backgroundColor: COLORS.cyan600,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TextWidget
              text={`+ ${he.myList.widget.addProduct}`}
              style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}
            />
          </FlexWidget>
        </FlexWidget>

        {items.length === 0 ? (
          <TextWidget
            text={he.myList.itemCount(0)}
            style={{ width: "match_parent", fontSize: 12, color: COLORS.neutral500, textAlign: "center" }}
          />
        ) : (
          <FlexWidget
            style={{ width: "match_parent", flexDirection: "column", flexGap: 1, flexGapColor: DIVIDER }}
          >
            {/* No checkboxes: the list is for writing only - items are marked
                as collected on the route screen, whose progress is separate. */}
            {visibleItems.map((item) => (
              <FlexWidget
                key={item.id}
                clickAction={openAction}
                clickActionData={openActionData}
                style={{
                  width: "match_parent",
                  flexDirection: "row",
                  alignItems: "center",
                  flexGap: 10,
                  paddingVertical: 7,
                }}
              >
                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget
                    text={item.name}
                    maxLines={1}
                    truncate="END"
                    style={{ width: "match_parent", textAlign: "right", fontSize: 14, color: COLORS.neutral900 }}
                  />
                </FlexWidget>
                <FlexWidget
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: COLORS.cyan50,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TextWidget text={CATEGORY_ICON[item.category]} style={{ fontSize: 14 }} />
                </FlexWidget>
              </FlexWidget>
            ))}
          </FlexWidget>
        )}

        {items.length > COLLAPSED_ITEM_COUNT && (
          <FlexWidget
            clickAction="TOGGLE_EXPANDED"
            style={{
              width: "match_parent",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              flexGap: 4,
            }}
          >
            <TextWidget
              text={expanded ? he.myList.widget.showLess : he.myList.widget.moreCount(hiddenCount)}
              style={{ fontSize: 12, fontWeight: "600", color: COLORS.cyan700 }}
            />
            <TextWidget text={expanded ? "︿" : "⌄"} style={{ fontSize: 12, color: COLORS.cyan700 }} />
          </FlexWidget>
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
