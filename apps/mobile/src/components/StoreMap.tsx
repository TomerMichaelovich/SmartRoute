import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, G, Image as SvgImage, Path, Rect, Text as SvgText } from "react-native-svg";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import type { RouteStop } from "@smartroute/core/domain/entities/route";
import {
  computeFootstepPlacements,
  FOOTPRINT_SOLE_PATH,
  FOOTPRINT_TOES,
  footprintTransform,
  type FootstepPlacement,
} from "@smartroute/core/map/footstep-trail";
import { he } from "@smartroute/core/i18n/he";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { ZoomableView } from "./ZoomableView";

// Heebo Bold averages a bit over half an em per Hebrew letter; SVG text can't
// be measured here, so the label's white box is sized from this estimate.
const CHAR_WIDTH_EM = 0.6;

/**
 * A map label as dark text on a white rounded box, readable over any floor
 * photo. Centered on x; `above` puts the box's bottom edge at y (over a
 * marker), otherwise it's centered on y. Kept inside the map horizontally.
 */
function LabelPill({
  text,
  x,
  y,
  fontSize,
  color,
  mapWidth,
  scale,
  above = false,
}: {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  mapWidth: number;
  scale: number;
  above?: boolean;
}) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const lineHeight = fontSize * 1.2;
  const padX = fontSize * 0.5;
  const padY = fontSize * 0.25;
  const width = Math.max(...lines.map((l) => l.length)) * fontSize * CHAR_WIDTH_EM + padX * 2;
  const height = lines.length * lineHeight + padY * 2;
  const left = Math.min(Math.max(x - width / 2, 2 * scale), mapWidth - width - 2 * scale);
  const top = above ? Math.max(y - height, 2 * scale) : y - height / 2;
  const centerX = left + width / 2;
  return (
    <G>
      <Rect
        x={left}
        y={top}
        width={width}
        height={height}
        rx={Math.min(height / 2, fontSize * 0.6)}
        fill="#ffffff"
        fillOpacity={0.95}
        stroke="#000000"
        strokeOpacity={0.12}
        strokeWidth={1.5 * scale}
      />
      {lines.map((line, i) => (
        <SvgText
          key={i}
          x={centerX}
          y={top + padY + lineHeight * i + fontSize * 0.95}
          textAnchor="middle"
          fontSize={fontSize}
          fontFamily={FONTS.bold}
          fill={color}
        >
          {line}
        </SvgText>
      ))}
    </G>
  );
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
  // Arrows pointing out of the corners to enlarge, into the center to shrink back.
  const d = expanded
    ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
    : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5";
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={COLORS.neutral900} strokeWidth={2.2}>
      <Path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Footprint({ size, ...step }: FootstepPlacement & { size: number }) {
  return (
    <G
      transform={footprintTransform(step, size)}
      fill={COLORS.brand}
      fillOpacity={0.92}
      stroke={COLORS.brandDark}
      strokeWidth={0.45}
      strokeOpacity={0.8}
    >
      <Path d={FOOTPRINT_SOLE_PATH} />
      {FOOTPRINT_TOES.map(([cx, cy, rx, ry], i) => (
        <Ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} />
      ))}
    </G>
  );
}

interface StoreMapProps {
  mapWidth: number;
  mapHeight: number;
  mapImageUrl?: string;
  nodes: MapNode[];
  pathNodeIds: string[];
  stops: RouteStop[];
  checkedStopOrders: Set<number>;
  /** Full-screen mode: the map fills its parent (flex: 1), zoomed in to cover it and centered
   * on the current stop. Inline, the whole map shows at its own proportions. */
  expanded: boolean;
  onToggleExpanded: () => void;
}

/**
 * The shopping route's map. Started as a port of apps/web's StoreMap.tsx but now
 * deliberately lighter, so the floor photo stays visible: no department images,
 * only the stop the shopper is heading to and the one after it (numbered
 * circles with a white name label), plus small entrance/checkout labels.
 */
export function StoreMap({
  mapWidth,
  mapHeight,
  mapImageUrl,
  nodes,
  pathNodeIds,
  stops,
  checkedStopOrders,
  expanded,
  onToggleExpanded,
}: StoreMapProps) {
  // Marker/label sizes are fractions of the map's width, so they read the same on a phone
  // whatever resolution the store's floor photo has.
  const scale = mapWidth / 1000;
  const markerRadius = mapWidth * 0.022;
  const markerFontSize = mapWidth * 0.025;
  const labelFontSize = mapWidth * 0.025;
  const minorLabelFontSize = mapWidth * 0.019;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const stopByNodeId = new Map(stops.map((s) => [s.nodeId, s]));

  // Only where to go now and right after that - every stop at once crowds the map.
  const upcoming = [...stops].sort((a, b) => a.order - b.order).filter((s) => !checkedStopOrders.has(s.order));
  const currentStop = upcoming[0];
  const visibleStopOrders = new Set(upcoming.slice(0, 2).map((s) => s.order));

  const currentNode = currentStop ? nodeById.get(currentStop.nodeId) : undefined;

  const routePathPoints = pathNodeIds
    .map((id) => nodeById.get(id))
    .filter((n): n is MapNode => Boolean(n))
    .map((n) => ({ x: n.position.x * mapWidth, y: n.position.y * mapHeight }));
  const footstepSize = 36 * scale;
  const footsteps = computeFootstepPlacements(routePathPoints, 40 * scale, 10 * scale);

  return (
    <View style={[styles.frame, expanded ? styles.frameExpanded : { aspectRatio: mapWidth / mapHeight }]}>
      <ZoomableView contentAspect={mapWidth / mapHeight} cover={expanded} focus={currentNode?.position}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
          {mapImageUrl && (
            <SvgImage href={mapImageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="xMidYMid slice" />
          )}

          {footsteps.map((step, i) => (
            <Footprint key={i} {...step} size={footstepSize} />
          ))}

          {nodes.map((node) => {
            const cx = node.position.x * mapWidth;
            const cy = node.position.y * mapHeight;

            // Entrance/checkout: a small label for orientation, nothing more.
            if (node.type === "entrance" || node.type === "checkout") {
              return (
                <LabelPill
                  key={node.id}
                  text={node.label}
                  x={cx}
                  y={cy}
                  fontSize={minorLabelFontSize}
                  color={node.type === "entrance" ? "#1d4ed8" : "#6d28d9"}
                  mapWidth={mapWidth}
                  scale={scale}
                />
              );
            }

            const stop = stopByNodeId.get(node.id);
            if (!stop || !visibleStopOrders.has(stop.order)) return null;

            const isCurrent = stop.order === currentStop?.order;
            const isChecked = checkedStopOrders.has(stop.order);
            const accent = isChecked ? "#9ca3af" : COLORS.brandDark;

            return (
              <G key={node.id}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={markerRadius}
                  fill={isCurrent ? accent : "#ffffff"}
                  stroke={isCurrent ? "#ffffff" : accent}
                  strokeWidth={3 * scale}
                />
                {/* react-native-svg's <Text> has no dominantBaseline; nudge y by ~0.35*fontSize to
                    approximate vertical centering on the default alphabetic baseline. */}
                <SvgText
                  x={cx}
                  y={cy + markerFontSize * 0.35}
                  textAnchor="middle"
                  fontSize={markerFontSize}
                  fontFamily={FONTS.bold}
                  fill={isCurrent ? "#ffffff" : accent}
                >
                  {stop.order}
                </SvgText>
                <LabelPill
                  text={stop.label}
                  x={cx}
                  y={cy - markerRadius - 6 * scale}
                  fontSize={labelFontSize}
                  color={isCurrent ? COLORS.neutral900 : COLORS.neutral600}
                  mapWidth={mapWidth}
                  scale={scale}
                  above
                />
              </G>
            );
          })}
        </Svg>
      </ZoomableView>
      <Pressable
        onPress={onToggleExpanded}
        style={styles.expandButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={expanded ? he.route.shrinkMap : he.route.expandMap}
      >
        <ExpandIcon expanded={expanded} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  frameExpanded: {
    flex: 1,
  },
  expandButton: {
    position: "absolute",
    top: 8,
    end: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
});
