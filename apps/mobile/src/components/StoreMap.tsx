import { View } from "react-native";
import Svg, { ClipPath, Ellipse, G, Image as SvgImage, Rect, Circle, Text as SvgText } from "react-native-svg";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import type { RouteStop } from "@smartroute/core/domain/entities/route";
import { findProductIcon } from "@smartroute/core/map/product-icons";
import { computeFootstepPlacements, type FootstepPlacement } from "@smartroute/core/map/footstep-trail";
import { apiUrl } from "@/lib/api";
import { FONTS } from "@/constants/fonts";
import { MultilineSvgText } from "./MultilineSvgText";

/** x/y/width/height/rx for a rounded-square icon container of "radius" r centered at cx/cy. */
function squareAttrs(cx: number, cy: number, r: number) {
  return { x: cx - r, y: cy - r, width: r * 2, height: r * 2, rx: r * 0.28 };
}

function Footprint({ x, y, rotationDeg, size }: FootstepPlacement & { size: number }) {
  const scale = size / 24;
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotationDeg}) scale(${scale})`} fill="#059669" opacity={0.95}>
      <Ellipse cx={0} cy={5.5} rx={3.4} ry={5.2} />
      <Ellipse cx={0} cy={-3.5} rx={3.9} ry={6.2} />
      <Circle cx={-2.6} cy={-10.2} r={1.3} />
      <Circle cx={0} cy={-11.2} r={1.5} />
      <Circle cx={2.6} cy={-10.2} r={1.3} />
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
  selectedStopOrder: number | null;
  onSelectStop?: (order: number) => void;
}

/**
 * React Native port of apps/web's StoreMap.tsx (react-native-svg instead of DOM <svg>) - kept
 * structurally identical (same marker sizing/scale math, same footstep trail, same node-type
 * branches) so the two stay easy to diff against each other as the web version evolves.
 */
export function StoreMap({
  mapWidth,
  mapHeight,
  mapImageUrl,
  nodes,
  pathNodeIds,
  stops,
  checkedStopOrders,
  selectedStopOrder,
  onSelectStop,
}: StoreMapProps) {
  const scale = mapWidth / 1000;
  const stopRadius = 32 * scale;
  const minorNodeRadius = 17 * scale;
  const badgeRadius = 15 * scale;
  const labelFontSize = 18 * scale;
  const minorLabelFontSize = 14 * scale;
  const badgeFontSize = 16 * scale;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const stopByNodeId = new Map(stops.map((s) => [s.nodeId, s]));

  const routePathPoints = pathNodeIds
    .map((id) => nodeById.get(id))
    .filter((n): n is MapNode => Boolean(n))
    .map((n) => ({ x: n.position.x * mapWidth, y: n.position.y * mapHeight }));
  const footstepSize = 36 * scale;
  const footsteps = computeFootstepPlacements(routePathPoints, 40 * scale, 10 * scale);

  return (
    <View style={{ width: "100%", aspectRatio: mapWidth / mapHeight, borderRadius: 16, overflow: "hidden", backgroundColor: "#ffffff" }}>
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
          const icon = findProductIcon(node.iconKey);

          if (node.type === "waypoint") {
            return null;
          }

          if (node.type === "entrance" || node.type === "checkout") {
            const ringColor = node.type === "entrance" ? "#2563eb" : "#7c3aed";
            return (
              <G key={node.id}>
                {icon ? (
                  <>
                    <ClipPath id={`node-clip-${node.id}`}>
                      <Rect {...squareAttrs(cx, cy, stopRadius)} />
                    </ClipPath>
                    <Rect {...squareAttrs(cx, cy, stopRadius)} fill="#ffffff" />
                    <SvgImage
                      href={apiUrl(icon.src)}
                      x={cx - stopRadius}
                      y={cy - stopRadius}
                      width={stopRadius * 2}
                      height={stopRadius * 2}
                      clipPath={`url(#node-clip-${node.id})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                    <Rect {...squareAttrs(cx, cy, stopRadius)} fill="none" stroke={ringColor} strokeWidth={4 * scale} />
                  </>
                ) : (
                  <Rect {...squareAttrs(cx, cy, stopRadius)} fill={ringColor} />
                )}
                <MultilineSvgText
                  text={node.label}
                  x={cx}
                  y={cy + stopRadius + labelFontSize * 0.9}
                  lineHeight={labelFontSize * 1.15}
                  textAnchor="middle"
                  fontSize={labelFontSize}
                  fontFamily={FONTS.bold}
                  fill="#111827"
                  stroke="white"
                  strokeWidth={labelFontSize * 0.18}
                  strokeLinejoin="round"
                />
              </G>
            );
          }

          const stop = stopByNodeId.get(node.id);
          if (!stop) {
            return (
              <G key={node.id}>
                {icon ? (
                  <>
                    <ClipPath id={`node-clip-${node.id}`}>
                      <Rect {...squareAttrs(cx, cy, minorNodeRadius)} />
                    </ClipPath>
                    <Rect {...squareAttrs(cx, cy, minorNodeRadius)} fill="#f3f4f6" />
                    <SvgImage
                      href={apiUrl(icon.src)}
                      x={cx - minorNodeRadius}
                      y={cy - minorNodeRadius}
                      width={minorNodeRadius * 2}
                      height={minorNodeRadius * 2}
                      clipPath={`url(#node-clip-${node.id})`}
                      preserveAspectRatio="xMidYMid slice"
                      opacity={0.6}
                    />
                    <Rect {...squareAttrs(cx, cy, minorNodeRadius)} fill="none" stroke="#d1d5db" strokeWidth={2 * scale} />
                  </>
                ) : (
                  <Rect {...squareAttrs(cx, cy, minorNodeRadius)} fill="#f3f4f6" stroke="#d1d5db" strokeWidth={2 * scale} />
                )}
                <MultilineSvgText
                  text={node.label}
                  x={cx}
                  y={cy + minorNodeRadius + minorLabelFontSize * 0.75}
                  lineHeight={minorLabelFontSize * 1.15}
                  textAnchor="middle"
                  fontSize={minorLabelFontSize}
                  fontFamily={FONTS.regular}
                  fill="#9ca3af"
                  stroke="white"
                  strokeWidth={minorLabelFontSize * 0.18}
                  strokeLinejoin="round"
                />
              </G>
            );
          }

          const isChecked = checkedStopOrders.has(stop.order);
          const isSelected = selectedStopOrder === stop.order;
          const ringColor = isChecked ? "#9ca3af" : "#059669";
          const badgeX = cx + stopRadius * 0.75;
          const badgeY = cy - stopRadius * 0.75;

          return (
            <G key={node.id} onPress={onSelectStop ? () => onSelectStop(stop.order) : undefined}>
              {isSelected && (
                <Rect {...squareAttrs(cx, cy, stopRadius + 8 * scale)} fill="none" stroke="#059669" strokeWidth={4 * scale} />
              )}
              {icon ? (
                <>
                  <ClipPath id={`node-clip-${node.id}`}>
                    <Rect {...squareAttrs(cx, cy, stopRadius)} />
                  </ClipPath>
                  <Rect {...squareAttrs(cx, cy, stopRadius)} fill="#ffffff" />
                  <SvgImage
                    href={apiUrl(icon.src)}
                    x={cx - stopRadius}
                    y={cy - stopRadius}
                    width={stopRadius * 2}
                    height={stopRadius * 2}
                    clipPath={`url(#node-clip-${node.id})`}
                    preserveAspectRatio="xMidYMid slice"
                    opacity={isChecked ? 0.5 : 1}
                  />
                  <Rect {...squareAttrs(cx, cy, stopRadius)} fill="none" stroke={ringColor} strokeWidth={4 * scale} />
                  <Circle cx={badgeX} cy={badgeY} r={badgeRadius} fill={ringColor} stroke="white" strokeWidth={2 * scale} />
                  {/* react-native-svg's <Text> has no dominantBaseline; nudge y by ~0.35*fontSize to
                      approximate vertical centering on the default alphabetic baseline. */}
                  <SvgText x={badgeX} y={badgeY + badgeFontSize * 0.35} textAnchor="middle" fontSize={badgeFontSize} fontFamily={FONTS.bold} fill="white">
                    {stop.order}
                  </SvgText>
                </>
              ) : (
                <>
                  <Rect {...squareAttrs(cx, cy, stopRadius)} fill={ringColor} />
                  <SvgText x={cx} y={cy + labelFontSize * 0.75 * 0.35} textAnchor="middle" fontSize={labelFontSize * 0.75} fontFamily={FONTS.bold} fill="white">
                    {stop.order}
                  </SvgText>
                </>
              )}
              <MultilineSvgText
                text={node.label}
                x={cx}
                y={cy + stopRadius + labelFontSize * 0.9}
                lineHeight={labelFontSize * 1.15}
                textAnchor="middle"
                fontSize={labelFontSize}
                fontWeight={700}
                fill="#111827"
                stroke="white"
                strokeWidth={labelFontSize * 0.18}
                strokeLinejoin="round"
              />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
