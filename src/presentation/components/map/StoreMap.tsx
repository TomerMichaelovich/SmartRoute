import type { MapEdge } from "@/src/domain/entities/map-edge";
import type { MapNode } from "@/src/domain/entities/map-node";
import type { RouteStop } from "@/src/domain/entities/route";

interface StoreMapProps {
  mapWidth: number;
  mapHeight: number;
  nodes: MapNode[];
  edges: MapEdge[];
  pathNodeIds: string[];
  stops: RouteStop[];
  checkedStopOrders: Set<number>;
  selectedStopOrder: number | null;
  onSelectStop?: (order: number) => void;
}

const STOP_RADIUS = 30;
const MINOR_NODE_RADIUS = 14;
const WAYPOINT_RADIUS = 6;

/**
 * Renders the store as an SVG diagram generated directly from the node/edge
 * graph (normalized 0-1 positions scaled to mapWidth/mapHeight) - there's no
 * real floorplan artwork for the MVP demo store, and generating from the
 * graph means the map always matches whatever the admin panel's graph editor
 * produces, with no separate asset to keep in sync.
 */
export function StoreMap({
  mapWidth,
  mapHeight,
  nodes,
  edges,
  pathNodeIds,
  stops,
  checkedStopOrders,
  selectedStopOrder,
  onSelectStop,
}: StoreMapProps) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const stopByNodeId = new Map(stops.map((s) => [s.nodeId, s]));

  const routePoints = pathNodeIds
    .map((id) => nodeById.get(id))
    .filter((n): n is MapNode => Boolean(n))
    .map((n) => `${n.position.x * mapWidth},${n.position.y * mapHeight}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${mapWidth} ${mapHeight}`}
      className="h-auto w-full rounded-2xl bg-white"
      role="img"
      aria-label="מפת החנות והמסלול המומלץ"
    >
      {edges.map((edge) => {
        const from = nodeById.get(edge.fromNodeId);
        const to = nodeById.get(edge.toNodeId);
        if (!from || !to) return null;
        return (
          <line
            key={edge.id}
            x1={from.position.x * mapWidth}
            y1={from.position.y * mapHeight}
            x2={to.position.x * mapWidth}
            y2={to.position.y * mapHeight}
            stroke="#e5e7eb"
            strokeWidth={6}
            strokeLinecap="round"
          />
        );
      })}

      {routePoints && (
        <polyline
          points={routePoints}
          fill="none"
          stroke="#059669"
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
      )}

      {nodes.map((node) => {
        const cx = node.position.x * mapWidth;
        const cy = node.position.y * mapHeight;

        if (node.type === "intersection" || node.type === "waypoint") {
          return <circle key={node.id} cx={cx} cy={cy} r={WAYPOINT_RADIUS} fill="#d1d5db" />;
        }

        if (node.type === "entrance" || node.type === "checkout") {
          const fill = node.type === "entrance" ? "#2563eb" : "#7c3aed";
          return (
            <g key={node.id}>
              <circle cx={cx} cy={cy} r={STOP_RADIUS} fill={fill} />
              <text
                x={cx}
                y={cy + STOP_RADIUS + 26}
                textAnchor="middle"
                fontSize={26}
                fontWeight={600}
                fill="#111827"
              >
                {node.label}
              </text>
            </g>
          );
        }

        const stop = stopByNodeId.get(node.id);
        if (!stop) {
          return (
            <g key={node.id}>
              <circle
                cx={cx}
                cy={cy}
                r={MINOR_NODE_RADIUS}
                fill="#f3f4f6"
                stroke="#d1d5db"
                strokeWidth={2}
              />
              <text x={cx} y={cy + MINOR_NODE_RADIUS + 20} textAnchor="middle" fontSize={18} fill="#9ca3af">
                {node.label}
              </text>
            </g>
          );
        }

        const isChecked = checkedStopOrders.has(stop.order);
        const isSelected = selectedStopOrder === stop.order;

        return (
          <g
            key={node.id}
            onClick={() => onSelectStop?.(stop.order)}
            className={onSelectStop ? "cursor-pointer" : undefined}
          >
            {isSelected && (
              <circle cx={cx} cy={cy} r={STOP_RADIUS + 8} fill="none" stroke="#059669" strokeWidth={4} />
            )}
            <circle cx={cx} cy={cy} r={STOP_RADIUS} fill={isChecked ? "#9ca3af" : "#059669"} />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={28}
              fontWeight={700}
              fill="white"
            >
              {stop.order}
            </text>
            <text
              x={cx}
              y={cy + STOP_RADIUS + 26}
              textAnchor="middle"
              fontSize={26}
              fontWeight={600}
              fill="#111827"
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
