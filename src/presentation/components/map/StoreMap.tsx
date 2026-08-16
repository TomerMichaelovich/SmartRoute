import type { MapNode } from "@/src/domain/entities/map-node";
import type { RouteStop } from "@/src/domain/entities/route";
import { findProductIcon } from "@/src/presentation/product-icons";
import { computeFootstepPlacements, type FootstepPlacement } from "./footstep-trail";
import { MultilineSvgText } from "./MultilineSvgText";

/**
 * A single shoe-print glyph (heel + forefoot ellipses, three toe dots) drawn in a local
 * -12..11 unit box with toes at -Y, so rotating it by a placement's rotationDeg points the
 * toes along the walking direction. `size` is the glyph's approximate rendered height in px.
 */
function Footprint({ x, y, rotationDeg, size }: FootstepPlacement & { size: number }) {
  const scale = size / 24;
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotationDeg}) scale(${scale})`}
      fill="#059669"
      opacity={0.95}
    >
      <ellipse cx={0} cy={5.5} rx={3.4} ry={5.2} />
      <ellipse cx={0} cy={-3.5} rx={3.9} ry={6.2} />
      <circle cx={-2.6} cy={-10.2} r={1.3} />
      <circle cx={0} cy={-11.2} r={1.5} />
      <circle cx={2.6} cy={-10.2} r={1.3} />
    </g>
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
 * Renders the store's uploaded photo (if any) as the background, with nodes and this
 * specific route's path overlaid at their normalized 0-1 positions scaled to
 * mapWidth/mapHeight - the same coordinate scaling the admin layout editor uses. Only
 * the shopper's own route is drawn, not the store's full node graph/edge set - a
 * customer has no use for seeing every possible connection, just their path.
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
  // Marker/font sizes below were originally tuned for a 1000-unit-wide canvas (the old
  // fixed schematic size). Uploaded store photos come in at whatever resolution they
  // were shot at (e.g. 1672px wide), so sizes are scaled relative to that original
  // tuning to keep icons/text a consistent, legible size on screen regardless of the
  // photo's actual pixel dimensions.
  const scale = mapWidth / 1000;
  const stopRadius = 28 * scale;
  const minorNodeRadius = 15 * scale;
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
  // Bigger multiplier than the other markers above: the map now always renders inside a
  // narrow, fixed-max-width column (mobile and desktop alike), so a size tuned to read well
  // at near-native photo resolution was rendering the footstep trail at only a few CSS
  // pixels - effectively invisible, worse on high-DPI phone screens.
  const footstepSize = 36 * scale;
  const footsteps = computeFootstepPlacements(routePathPoints, 40 * scale, 10 * scale);

  return (
    <svg
      viewBox={`0 0 ${mapWidth} ${mapHeight}`}
      className="h-auto w-full rounded-2xl bg-white"
      role="img"
      aria-label="מפת החנות והמסלול המומלץ"
    >
      {mapImageUrl && (
        <image
          href={mapImageUrl}
          x={0}
          y={0}
          width={mapWidth}
          height={mapHeight}
          preserveAspectRatio="xMidYMid slice"
        />
      )}

      {footsteps.map((step, i) => (
        <Footprint key={i} {...step} size={footstepSize} />
      ))}

      {nodes.map((node) => {
        const cx = node.position.x * mapWidth;
        const cy = node.position.y * mapHeight;
        const icon = findProductIcon(node.iconKey);

        // Waypoints exist only to shape the walked path/footstep trail for routing purposes -
        // a customer has no use for seeing them as markers on the map.
        if (node.type === "waypoint") {
          return null;
        }

        if (node.type === "entrance" || node.type === "checkout") {
          const ringColor = node.type === "entrance" ? "#2563eb" : "#7c3aed";
          return (
            <g key={node.id}>
              {icon ? (
                <>
                  <clipPath id={`node-clip-${node.id}`}>
                    <circle cx={cx} cy={cy} r={stopRadius} />
                  </clipPath>
                  <circle cx={cx} cy={cy} r={stopRadius} fill="#ffffff" />
                  <image
                    href={icon.src}
                    x={cx - stopRadius}
                    y={cy - stopRadius}
                    width={stopRadius * 2}
                    height={stopRadius * 2}
                    clipPath={`url(#node-clip-${node.id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                  <circle cx={cx} cy={cy} r={stopRadius} fill="none" stroke={ringColor} strokeWidth={4 * scale} />
                </>
              ) : (
                <circle cx={cx} cy={cy} r={stopRadius} fill={ringColor} />
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
                paintOrder="stroke"
              />
            </g>
          );
        }

        const stop = stopByNodeId.get(node.id);
        if (!stop) {
          return (
            <g key={node.id}>
              {icon ? (
                <>
                  <clipPath id={`node-clip-${node.id}`}>
                    <circle cx={cx} cy={cy} r={minorNodeRadius} />
                  </clipPath>
                  <circle cx={cx} cy={cy} r={minorNodeRadius} fill="#f3f4f6" />
                  <image
                    href={icon.src}
                    x={cx - minorNodeRadius}
                    y={cy - minorNodeRadius}
                    width={minorNodeRadius * 2}
                    height={minorNodeRadius * 2}
                    clipPath={`url(#node-clip-${node.id})`}
                    preserveAspectRatio="xMidYMid slice"
                    opacity={0.6}
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={minorNodeRadius}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth={2 * scale}
                  />
                </>
              ) : (
                <circle
                  cx={cx}
                  cy={cy}
                  r={minorNodeRadius}
                  fill="#f3f4f6"
                  stroke="#d1d5db"
                  strokeWidth={2 * scale}
                />
              )}
              <MultilineSvgText
                text={node.label}
                x={cx}
                y={cy + minorNodeRadius + minorLabelFontSize * 0.75}
                lineHeight={minorLabelFontSize * 1.15}
                textAnchor="middle"
                fontSize={minorLabelFontSize}
                fill="#9ca3af"
                stroke="white"
                strokeWidth={minorLabelFontSize * 0.18}
                strokeLinejoin="round"
                paintOrder="stroke"
              />
            </g>
          );
        }

        const isChecked = checkedStopOrders.has(stop.order);
        const isSelected = selectedStopOrder === stop.order;
        const ringColor = isChecked ? "#9ca3af" : "#059669";
        const badgeX = cx + stopRadius * 0.75;
        const badgeY = cy - stopRadius * 0.75;

        return (
          <g
            key={node.id}
            onClick={() => onSelectStop?.(stop.order)}
            className={onSelectStop ? "cursor-pointer" : undefined}
          >
            {isSelected && (
              <circle cx={cx} cy={cy} r={stopRadius + 8 * scale} fill="none" stroke="#059669" strokeWidth={4 * scale} />
            )}
            {icon ? (
              <>
                <clipPath id={`node-clip-${node.id}`}>
                  <circle cx={cx} cy={cy} r={stopRadius} />
                </clipPath>
                <circle cx={cx} cy={cy} r={stopRadius} fill="#ffffff" />
                <image
                  href={icon.src}
                  x={cx - stopRadius}
                  y={cy - stopRadius}
                  width={stopRadius * 2}
                  height={stopRadius * 2}
                  clipPath={`url(#node-clip-${node.id})`}
                  preserveAspectRatio="xMidYMid slice"
                  opacity={isChecked ? 0.5 : 1}
                />
                <circle cx={cx} cy={cy} r={stopRadius} fill="none" stroke={ringColor} strokeWidth={4 * scale} />
                <circle cx={badgeX} cy={badgeY} r={badgeRadius} fill={ringColor} stroke="white" strokeWidth={2 * scale} />
                <text
                  x={badgeX}
                  y={badgeY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={badgeFontSize}
                  fontWeight={700}
                  fill="white"
                >
                  {stop.order}
                </text>
              </>
            ) : (
              <>
                <circle cx={cx} cy={cy} r={stopRadius} fill={ringColor} />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={labelFontSize * 0.75}
                  fontWeight={700}
                  fill="white"
                >
                  {stop.order}
                </text>
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
              paintOrder="stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}
