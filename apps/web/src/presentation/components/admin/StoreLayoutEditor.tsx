"use client";

import { useEffect, useRef, useState } from "react";
import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode, MapNodeType } from "@smartroute/core/domain/entities/map-node";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ProductListing } from "@smartroute/core/domain/entities/product-listing";
import { distanceBetweenNodes } from "@smartroute/core/domain/value-objects/geo-point";
import { NODE_TYPE_LABELS } from "@/src/presentation/node-type-labels";
import type { StoredWalkableMask } from "@smartroute/core/map/walkable/mask";
import type { WalkableMapSaveResult } from "@/src/presentation/actions/admin-store-actions";
import { ProductAutocomplete } from "./ProductAutocomplete";
import { WalkableAreaEditor } from "./WalkableAreaEditor";

interface StoreLayoutEditorProps {
  storeId: string;
  mapWidth: number;
  mapHeight: number;
  mapImageUrl: string;
  nodes: MapNode[];
  edges: MapEdge[];
  nodeTypes: MapNodeType[];
  products: Product[];
  listings: ProductListing[];
  createNode: (formData: FormData) => Promise<void>;
  createEdge: (formData: FormData) => Promise<void>;
  deleteNode: (storeId: string, nodeId: string) => Promise<void>;
  deleteEdge: (storeId: string, edgeId: string) => Promise<void>;
  updateNodePosition: (nodeId: string, x: number, y: number) => Promise<void>;
  updateNodeLabel: (storeId: string, nodeId: string, formData: FormData) => Promise<void>;
  addProductToNode: (storeId: string, nodeId: string, formData: FormData) => Promise<void>;
  removeProductFromNode: (storeId: string, nodeId: string, productId: string) => Promise<void>;
  uploadStoreImage: (formData: FormData) => Promise<void>;
  /** Same-origin URL of the map image, for reading its pixels in the walkable-area mode. */
  mapPixelSourceUrl: string;
  walkableMask: StoredWalkableMask | null;
  saveWalkableMap: (mask: StoredWalkableMask) => Promise<WalkableMapSaveResult>;
}

const NODE_COLORS: Record<MapNodeType, string> = {
  entrance: "#2563eb",
  checkout: "#7c3aed",
  waypoint: "#9ca3af",
  department: "#059669",
};

function nodeRadius(type: MapNodeType): number {
  if (type === "waypoint") return 5;
  if (type === "entrance" || type === "checkout") return 28;
  return 21;
}

const LABEL_FONT_SIZE = 18;
const DISCONNECTED_COLOR = "#dc2626";

/**
 * Nodes a route can never reach: everything outside the part of the graph that's connected
 * (either direction) to an entrance. These are what make route building fail, so the editor
 * paints them red. With no entrance at all, nothing is flagged here (the page says so instead).
 */
function findDisconnectedNodeIds(nodes: MapNode[], edges: MapEdge[]): Set<string> {
  const entrances = nodes.filter((n) => n.type === "entrance");
  if (entrances.length === 0) return new Set();
  const nodeIds = new Set(nodes.map((n) => n.id));
  const neighbours = new Map<string, string[]>();
  // Edges left pointing at a deleted node don't count - the route graph skips them too.
  for (const edge of edges.filter((e) => nodeIds.has(e.fromNodeId) && nodeIds.has(e.toNodeId))) {
    neighbours.set(edge.fromNodeId, [...(neighbours.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    neighbours.set(edge.toNodeId, [...(neighbours.get(edge.toNodeId) ?? []), edge.fromNodeId]);
  }
  const reached = new Set(entrances.map((n) => n.id));
  const queue = [...reached];
  while (queue.length > 0) {
    for (const next of neighbours.get(queue.pop()!) ?? []) {
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  return new Set(nodes.filter((n) => !reached.has(n.id)).map((n) => n.id));
}
// Rough Heebo width per Hebrew letter, to size the label's box without measuring.
const LABEL_CHAR_WIDTH_EM = 0.6;

/**
 * A named node (department/entrance/checkout) as its name on a white box - the
 * same look the app's route map uses - centered on the node's position, with a
 * type-colored border (green ring when selected).
 */
function NodeLabel({
  x,
  y,
  text,
  color,
  selected,
  disconnected,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  selected: boolean;
  disconnected: boolean;
}) {
  const lines = (text || "?").split("\n").map((l) => l.trim()).filter(Boolean);
  const lineHeight = LABEL_FONT_SIZE * 1.2;
  const width = Math.max(...lines.map((l) => l.length)) * LABEL_FONT_SIZE * LABEL_CHAR_WIDTH_EM + LABEL_FONT_SIZE;
  const height = lines.length * lineHeight + LABEL_FONT_SIZE * 0.5;
  const top = y - height / 2;
  return (
    <>
      {selected && (
        <rect x={x - width / 2 - 5} y={top - 5} width={width + 10} height={height + 10} rx={12} fill="none" stroke="#059669" strokeWidth={3} />
      )}
      <rect
        x={x - width / 2}
        y={top}
        width={width}
        height={height}
        rx={8}
        fill={disconnected ? "#fee2e2" : "#ffffff"}
        stroke={disconnected ? DISCONNECTED_COLOR : color}
        strokeWidth={disconnected ? 3 : 2}
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x={x}
          y={top + LABEL_FONT_SIZE * 0.25 + lineHeight * i + LABEL_FONT_SIZE * 0.95}
          textAnchor="middle"
          fontSize={LABEL_FONT_SIZE}
          fontWeight={700}
          fill="#111827"
        >
          {line}
        </text>
      ))}
    </>
  );
}

const DRAG_THRESHOLD_PX = 6;

interface AddNodePopup {
  screenLeft: number;
  screenTop: number;
  normX: number;
  normY: number;
  presetType?: MapNodeType;
}

interface DragState {
  nodeId: string;
  x: number;
  y: number;
}

export function StoreLayoutEditor({
  storeId,
  mapWidth,
  mapHeight,
  mapImageUrl,
  nodes,
  edges,
  nodeTypes,
  products,
  listings,
  createNode,
  createEdge,
  deleteNode,
  deleteEdge,
  updateNodePosition,
  updateNodeLabel,
  addProductToNode,
  removeProductFromNode,
  uploadStoreImage,
  mapPixelSourceUrl,
  walkableMask,
  saveWalkableMap,
}: StoreLayoutEditorProps) {
  const [walkableMode, setWalkableMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStartRef = useRef<{ nodeId: string; clientX: number; clientY: number; moved: boolean } | null>(
    null,
  );
  const justDraggedRef = useRef(false);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [addPopup, setAddPopup] = useState<AddNodePopup | null>(null);
  // "Add department" armed: the next click on the map places a named node there.
  const [placingNode, setPlacingNode] = useState(false);
  // "move": clicks only select and drags only move - nothing gets added or connected by
  // accident. "build": a click on the map adds a waypoint, a click on a second node connects.
  const [editMode, setEditMode] = useState<"move" | "build">("move");
  // Departments shrink to small dots that can't be clicked, selected or dragged, so their label
  // boxes don't cover the corridors being edited. View-only: nothing about the map changes.
  const [hideDepartments, setHideDepartments] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());
  const marqueeStartRef = useRef<{ clientX: number; clientY: number; active: boolean } | null>(null);
  const justMarqueedRef = useRef(false);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Clicking empty space now adds a waypoint instead of clearing the selection, so Escape is the
  // way to stop a corridor chain.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setAddPopup(null);
      setPlacingNode(false);
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function screenToNormalized(clientX: number, clientY: number): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = point.matrixTransform(ctm.inverse());
    return {
      x: Math.max(0, Math.min(1, transformed.x / mapWidth)),
      y: Math.max(0, Math.min(1, transformed.y / mapHeight)),
    };
  }

  function containerOffset(clientX: number, clientY: number): { left: number; top: number } {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { left: 0, top: 0 };
    return { left: clientX - rect.left, top: clientY - rect.top };
  }

  function closePopups() {
    setAddPopup(null);
  }

  /** Runs map mutations one after another, so an edge is never written before its new waypoint. */
  function enqueueMutation(mutation: () => Promise<void>) {
    mutationQueueRef.current = mutationQueueRef.current.then(mutation).catch((error) => console.error(error));
  }

  function connectNodes(fromNodeId: string, toNodeId: string) {
    const formData = new FormData();
    formData.set("fromNodeId", fromNodeId);
    formData.set("toNodeId", toNodeId);
    formData.set("bidirectional", "on");
    enqueueMutation(() => createEdge(formData));
  }

  // A click on empty map space drops a waypoint right there - no popup. If exactly one node is
  // selected, the new waypoint is also connected to it and becomes the selection, so clicking
  // along an aisle lays out the whole corridor. Named nodes (departments, entrance, checkout) are
  // added with the "add department" button: it arms placingNode, and the next click opens the
  // label popup there instead.
  function handleBackgroundClick(e: React.MouseEvent) {
    if (justMarqueedRef.current) {
      justMarqueedRef.current = false;
      return;
    }
    closePopups();
    const { x, y } = screenToNormalized(e.clientX, e.clientY);
    if (editMode === "move") {
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
      return;
    }
    if (placingNode) {
      const { left, top } = containerOffset(e.clientX, e.clientY);
      setPlacingNode(false);
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
      setAddPopup({ screenLeft: left, screenTop: top, normX: x, normY: y, presetType: "department" });
      return;
    }
    const newNodeId = crypto.randomUUID();
    const formData = new FormData();
    formData.set("id", newNodeId);
    formData.set("type", "waypoint");
    formData.set("x", String(x));
    formData.set("y", String(y));
    enqueueMutation(() => createNode(formData));

    if (selectedNodeIds.size === 1 && selectedEdgeIds.size === 0) {
      connectNodes(Array.from(selectedNodeIds)[0], newNodeId);
      setSelectedNodeIds(new Set([newNodeId]));
    } else {
      setSelectedNodeIds(new Set());
    }
    setSelectedEdgeIds(new Set());
  }

  // Pressing on empty map space and dragging draws a selection box; every node inside it is
  // selected on release (Ctrl/Shift adds to the current selection). A press without dragging
  // stays a plain click, which adds a waypoint. Pointer capture is only taken once the drag
  // starts, so a plain click still lands on the background element's onClick.
  function handleMapPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    justMarqueedRef.current = false;
    if (e.button !== 0 || !(e.target as Element).hasAttribute("data-map-background")) return;
    marqueeStartRef.current = { clientX: e.clientX, clientY: e.clientY, active: false };
  }

  function handleMapPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const start = marqueeStartRef.current;
    if (!start) return;
    if (!start.active) {
      if (Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) < DRAG_THRESHOLD_PX) return;
      start.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      closePopups();
    }
    const from = screenToNormalized(start.clientX, start.clientY);
    const to = screenToNormalized(e.clientX, e.clientY);
    setMarquee({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
  }

  function handleMapPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const start = marqueeStartRef.current;
    marqueeStartRef.current = null;
    if (!start?.active) return;
    justMarqueedRef.current = true;
    setMarquee(null);

    const from = screenToNormalized(start.clientX, start.clientY);
    const to = screenToNormalized(e.clientX, e.clientY);
    const [minX, maxX] = [Math.min(from.x, to.x), Math.max(from.x, to.x)];
    const [minY, maxY] = [Math.min(from.y, to.y), Math.max(from.y, to.y)];
    const insideIds = nodes
      .filter((n) => !(hideDepartments && n.type === "department"))
      .filter((n) => n.position.x >= minX && n.position.x <= maxX && n.position.y >= minY && n.position.y <= maxY)
      .map((n) => n.id);

    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      setSelectedNodeIds((prev) => new Set([...prev, ...insideIds]));
    } else {
      setSelectedNodeIds(new Set(insideIds));
      setSelectedEdgeIds(new Set());
    }
  }

  function handleMapPointerCancel() {
    marqueeStartRef.current = null;
    setMarquee(null);
  }

  function handleNodeClick(e: React.MouseEvent, node: MapNode) {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    closePopups();

    if (e.ctrlKey || e.metaKey) {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      return;
    }

    // A plain click on a different node while exactly one node is already selected connects
    // them with a (bidirectional) edge immediately - no confirmation popup. The just-connected
    // node becomes the new selection, so clicking through several nodes in a row lays out a
    // whole corridor in one pass.
    if (
      editMode === "build" &&
      selectedNodeIds.size === 1 &&
      selectedEdgeIds.size === 0 &&
      !selectedNodeIds.has(node.id)
    ) {
      connectNodes(Array.from(selectedNodeIds)[0], node.id);
      setSelectedNodeIds(new Set([node.id]));
      return;
    }

    setSelectedEdgeIds(new Set());
    setSelectedNodeIds((prev) => (prev.size === 1 && prev.has(node.id) ? new Set() : new Set([node.id])));
  }

  function handleNodePointerDown(e: React.PointerEvent<SVGGElement>, node: MapNode) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { nodeId: node.id, clientX: e.clientX, clientY: e.clientY, moved: false };
  }

  function handleNodePointerMove(e: React.PointerEvent<SVGGElement>, node: MapNode) {
    const start = dragStartRef.current;
    if (!start || start.nodeId !== node.id) return;
    const dx = e.clientX - start.clientX;
    const dy = e.clientY - start.clientY;
    if (!start.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    start.moved = true;
    const { x, y } = screenToNormalized(e.clientX, e.clientY);
    setDragState({ nodeId: node.id, x, y });
  }

  async function handleNodePointerUp(e: React.PointerEvent<SVGGElement>, node: MapNode) {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start || start.nodeId !== node.id) return;

    if (start.moved) {
      justDraggedRef.current = true;
      const { x, y } = screenToNormalized(e.clientX, e.clientY);
      setDragState(null);
      await updateNodePosition(node.id, x, y);
    }
  }

  function handleEdgeClick(e: React.MouseEvent, edge: MapEdge) {
    closePopups();

    if (e.ctrlKey || e.metaKey) {
      setSelectedEdgeIds((prev) => {
        const next = new Set(prev);
        if (next.has(edge.id)) next.delete(edge.id);
        else next.add(edge.id);
        return next;
      });
      return;
    }

    setSelectedNodeIds(new Set());
    setSelectedEdgeIds((prev) => (prev.size === 1 && prev.has(edge.id) ? new Set() : new Set([edge.id])));
  }

  async function handleDeleteSelected() {
    await Promise.all([
      ...Array.from(selectedNodeIds).map((id) => deleteNode(storeId, id)),
      ...Array.from(selectedEdgeIds).map((id) => deleteEdge(storeId, id)),
    ]);
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const disconnectedNodeIds = findDisconnectedNodeIds(nodes, edges);
  const hasEntrance = nodes.some((n) => n.type === "entrance");
  const totalSelected = selectedNodeIds.size + selectedEdgeIds.size;
  const singleSelectedNode =
    totalSelected === 1 && selectedNodeIds.size === 1
      ? (nodeById.get(Array.from(selectedNodeIds)[0]) ?? null)
      : null;
  const singleSelectedEdge =
    totalSelected === 1 && selectedEdgeIds.size === 1
      ? (edges.find((e) => e.id === Array.from(selectedEdgeIds)[0]) ?? null)
      : null;

  const showsProductPanel = singleSelectedNode?.type === "department";
  const listedProductIdsAtNode = new Set(
    showsProductPanel
      ? listings.filter((l) => l.nodeId === singleSelectedNode!.id).map((l) => l.productId)
      : [],
  );
  const listedProductIdsInStore = new Set(listings.map((l) => l.productId));
  const productsAtNode = showsProductPanel
    ? products
        .filter((p) => listedProductIdsAtNode.has(p.id))
        .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, "he"))
    : [];
  const availableProducts = showsProductPanel
    ? products
        .filter((p) => !listedProductIdsInStore.has(p.id))
        .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, "he"))
    : [];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-neutral-900">עריכת פריסה חזותית</h2>
        <div className="flex flex-wrap items-center gap-2">
          {mapImageUrl && !walkableMode && (
            <button
              type="button"
              onClick={() => {
                setSelectedNodeIds(new Set());
                setSelectedEdgeIds(new Set());
                closePopups();
                setWalkableMode(true);
              }}
              className="rounded-full bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white"
            >
              מיפוי אוטומטי של שטח עביר
            </button>
          )}
          <form
            action={uploadStoreImage}
            className="flex items-center gap-2 rounded-full border border-neutral-300 bg-white ps-1 pe-3 py-1"
          >
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              required
              className="w-40 text-xs text-neutral-600 file:me-2 file:rounded-full file:border-0 file:bg-neutral-100 file:px-2 file:py-1 file:text-xs"
            />
            <button type="submit" className="text-sm font-medium text-cyan-700 hover:underline">
              {mapImageUrl ? "החלף תמונה" : "העלה תמונת מפה"}
            </button>
          </form>
        </div>
      </div>
      {walkableMode ? (
        <WalkableAreaEditor
          mapWidth={mapWidth}
          mapHeight={mapHeight}
          mapImageUrl={mapImageUrl}
          pixelSourceUrl={mapPixelSourceUrl}
          nodes={nodes}
          initialMask={walkableMask}
          saveWalkableMap={saveWalkableMap}
          onClose={() => setWalkableMode(false)}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-neutral-300 bg-white p-0.5 text-sm font-semibold">
                {(
                  [
                    ["move", "הזזה ובחירה"],
                    ["build", "הוספה וחיבור"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      closePopups();
                      setPlacingNode(false);
                      setSelectedNodeIds(new Set());
                      setSelectedEdgeIds(new Set());
                      setEditMode(mode);
                    }}
                    className={`rounded-md px-3 py-1 ${
                      editMode === mode ? "bg-cyan-600 text-white" : "text-neutral-600 hover:text-neutral-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {editMode === "build" && (
              <button
                type="button"
                onClick={() => {
                  closePopups();
                  setPlacingNode((v) => !v);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  placingNode ? "bg-cyan-600 text-white" : "border border-neutral-300 bg-white text-neutral-700"
                }`}
              >
                {placingNode ? "ביטול הוספה" : "+ הוספת מחלקה"}
              </button>
              )}
              {placingNode && <span className="text-sm text-cyan-700">לחצו על המפה במיקום המחלקה</span>}
              <button
                type="button"
                onClick={() => {
                  closePopups();
                  if (!hideDepartments) {
                    // A hidden department can't stay selected - "delete" would remove what isn't shown.
                    setSelectedNodeIds(
                      (prev) => new Set([...prev].filter((id) => nodeById.get(id)?.type !== "department")),
                    );
                  }
                  setHideDepartments((v) => !v);
                }}
                aria-pressed={hideDepartments}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  hideDepartments ? "bg-cyan-600 text-white" : "border border-neutral-300 bg-white text-neutral-700"
                }`}
              >
                {hideDepartments ? "הצגת מחלקות" : "הסתרת מחלקות"}
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              {editMode === "move"
                ? "גררו צומת כדי להזיז אותו · לחצו על צומת כדי לבחור אותו (מחלקה: שיוך מוצרים) · גררו על שטח ריק כדי לסמן כמה צמתים · Ctrl+לחיצה לבחירה מרובה · Esc לביטול בחירה"
                : "לחצו על המפה להוספת נקודת ציון · כשצומת נבחר, לחיצה על המפה מוסיפה נקודה ומחברת אליה (לחיצות ברצף = מסדרון) · לחצו על צומת ואז על צומת נוסף כדי לחבר ביניהם · \"הוספת מחלקה\" ואז לחיצה על המפה מוסיפה מחלקה/כניסה/קופה · Esc לביטול בחירה"}
            </p>

            {!hasEntrance && nodes.length > 0 && (
              <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
                אין כניסה במפה - בלי כניסה אי אפשר לבנות מסלול. הוסיפו צומת מסוג כניסה.
              </p>
            )}
            {disconnectedNodeIds.size > 0 && (
              <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
                {disconnectedNodeIds.size === 1 ? "צומת אחד לא מחובר" : `${disconnectedNodeIds.size} צמתים לא מחוברים`}{" "}
                לכניסה, ולכן מסלול לא יכול להגיע אליהם. הם מסומנים באדום - חברו אותם במצב &quot;הוספה וחיבור&quot;.
              </p>
            )}

            <div ref={containerRef} className="relative">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                className="h-auto w-full select-none rounded-2xl border border-neutral-200 bg-white touch-none"
                onPointerDown={handleMapPointerDown}
                onPointerMove={handleMapPointerMove}
                onPointerUp={handleMapPointerUp}
                onPointerCancel={handleMapPointerCancel}
              >
                {mapImageUrl ? (
                  <image
                    href={mapImageUrl}
                    x={0}
                    y={0}
                    width={mapWidth}
                    height={mapHeight}
                    preserveAspectRatio="xMidYMid slice"
                    onClick={handleBackgroundClick}
                    data-map-background
                  />
                ) : (
                  <>
                    <rect x={0} y={0} width={mapWidth} height={mapHeight} fill="#f3f4f6"
                      onClick={handleBackgroundClick}
                      data-map-background
                    />
                    <text
                      x={mapWidth / 2}
                      y={mapHeight / 2}
                      textAnchor="middle"
                      fontSize={Math.min(mapWidth, mapHeight) * 0.04}
                      fill="#9ca3af"
                      pointerEvents="none"
                    >
                      העלו תמונת מפה כדי להתחיל
                    </text>
                  </>
                )}

                {edges.map((edge) => {
                  const from = nodeById.get(edge.fromNodeId);
                  const to = nodeById.get(edge.toNodeId);
                  if (!from || !to) return null;
                  const isSelected = selectedEdgeIds.has(edge.id);
                  const x1 = from.position.x * mapWidth;
                  const y1 = from.position.y * mapHeight;
                  const x2 = to.position.x * mapWidth;
                  const y2 = to.position.y * mapHeight;
                  return (
                    <g key={edge.id}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="transparent"
                        strokeWidth={20}
                        className="cursor-pointer"
                        onClick={(e) => handleEdgeClick(e, edge)}
                      />
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isSelected ? "#059669" : "#d1d5db"}
                        strokeWidth={isSelected ? 6 : 4}
                        strokeLinecap="round"
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}

                {nodes.map((node) => {
                  const isDragging = dragState?.nodeId === node.id;
                  const x = (isDragging ? dragState!.x : node.position.x) * mapWidth;
                  const y = (isDragging ? dragState!.y : node.position.y) * mapHeight;
                  const radius = nodeRadius(node.type);
                  const isSelected = selectedNodeIds.has(node.id);
                  const isWaypoint = node.type === "waypoint";

                  if (hideDepartments && node.type === "department") {
                    return (
                      <circle
                        key={node.id}
                        cx={x}
                        cy={y}
                        r={nodeRadius("waypoint")}
                        fill={disconnectedNodeIds.has(node.id) ? DISCONNECTED_COLOR : NODE_COLORS.department}
                        opacity={0.6}
                        pointerEvents="none"
                      />
                    );
                  }

                  return (
                    <g
                      key={node.id}
                      className="cursor-grab active:cursor-grabbing"
                      onPointerDown={(e) => handleNodePointerDown(e, node)}
                      onPointerMove={(e) => handleNodePointerMove(e, node)}
                      onPointerUp={(e) => void handleNodePointerUp(e, node)}
                      onClick={(e) => handleNodeClick(e, node)}
                    >
                      {isWaypoint ? (
                        <>
                          {isSelected && <circle cx={x} cy={y} r={radius + 6} fill="none" stroke="#059669" strokeWidth={3} />}
                          {/* Invisible, larger hit area so the small dot is still easy to click and drag. */}
                          <circle cx={x} cy={y} r={14} fill="transparent" />
                          <circle
                            cx={x}
                            cy={y}
                            r={disconnectedNodeIds.has(node.id) ? radius + 2 : radius}
                            fill={disconnectedNodeIds.has(node.id) ? DISCONNECTED_COLOR : NODE_COLORS[node.type]}
                          />
                        </>
                      ) : (
                        <NodeLabel
                          x={x}
                          y={y}
                          text={node.label}
                          color={NODE_COLORS[node.type]}
                          selected={isSelected}
                          disconnected={disconnectedNodeIds.has(node.id)}
                        />
                      )}
                    </g>
                  );
                })}

                {marquee && (
                  <rect
                    x={Math.min(marquee.x1, marquee.x2) * mapWidth}
                    y={Math.min(marquee.y1, marquee.y2) * mapHeight}
                    width={Math.abs(marquee.x2 - marquee.x1) * mapWidth}
                    height={Math.abs(marquee.y2 - marquee.y1) * mapHeight}
                    fill="#0891b2"
                    fillOpacity={0.12}
                    stroke="#0891b2"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                )}
              </svg>

              {addPopup && (
                <div
                  style={{ left: addPopup.screenLeft, top: addPopup.screenTop }}
                  className="absolute z-10 flex w-56 -translate-x-1/2 flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg"
                >
                  <form
                    action={async (formData) => {
                      await createNode(formData);
                      closePopups();
                    }}
                    className="flex flex-col gap-2"
                  >
                    <input type="hidden" name="x" value={addPopup.normX} />
                    <input type="hidden" name="y" value={addPopup.normY} />
                    <input
                      name="label"
                      placeholder="תווית (חובה למחלקה בלבד)"
                      autoFocus
                      className="rounded-lg border border-neutral-300 p-1.5 text-sm"
                    />
                    <select
                      name="type"
                      defaultValue={addPopup.presetType}
                      className="rounded-lg border border-neutral-300 p-1.5 text-sm"
                    >
                      {nodeTypes.map((t) => (
                        <option key={t} value={t}>
                          {NODE_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <input
                      name="zone"
                      placeholder="אזור (אופציונלי)"
                      className="rounded-lg border border-neutral-300 p-1.5 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white"
                      >
                        הוסף צומת
                      </button>
                      <button
                        type="button"
                        onClick={closePopups}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600"
                      >
                        ביטול
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>

          {singleSelectedNode && !showsProductPanel && (
            <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3">
              <span className="text-sm text-neutral-700">
                נבחר: <strong>{singleSelectedNode.label}</strong> ({NODE_TYPE_LABELS[singleSelectedNode.type]})
              </span>
              <form action={deleteNode.bind(null, storeId, singleSelectedNode.id)}>
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  מחק צומת
                </button>
              </form>
            </div>
          )}

          {singleSelectedNode && showsProductPanel && (
            <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
              <form
                key={singleSelectedNode.id}
                action={updateNodeLabel.bind(null, storeId, singleSelectedNode.id)}
                className="flex items-start gap-2"
              >
                <textarea
                  name="label"
                  defaultValue={singleSelectedNode.label}
                  rows={2}
                  placeholder="לרדת שורה: Enter"
                  className="flex-1 resize-y rounded-lg border border-neutral-300 p-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  שמור שם
                </button>
                <span className="text-xs text-neutral-400">{NODE_TYPE_LABELS[singleSelectedNode.type]}</span>
              </form>

              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-neutral-700">
                  מוצרים בנקודה זו ({productsAtNode.length})
                </h3>
                {productsAtNode.length === 0 ? (
                  <p className="text-xs text-neutral-400">אין עדיין מוצרים משויכים</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-neutral-100">
                    {productsAtNode.map((product) => (
                      <li key={product.id} className="flex items-center justify-between py-1.5 text-sm">
                        <span>{product.canonicalName}</span>
                        <form action={removeProductFromNode.bind(null, storeId, singleSelectedNode.id, product.id)}>
                          <button type="submit" className="text-red-600 hover:underline" title="הסר מהנקודה">
                            ✕
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {availableProducts.length > 0 && (
                <ProductAutocomplete
                  key={singleSelectedNode.id}
                  products={availableProducts}
                  onAdd={async (productId) => {
                    const formData = new FormData();
                    formData.set("productId", productId);
                    await addProductToNode(storeId, singleSelectedNode.id, formData);
                  }}
                />
              )}

              <form action={deleteNode.bind(null, storeId, singleSelectedNode.id)}>
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  מחק צומת
                </button>
              </form>
            </div>
          )}

          {singleSelectedEdge && (
            <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3">
              <span className="text-sm text-neutral-700">
                נבחרה קשת:{" "}
                <strong>{nodeById.get(singleSelectedEdge.fromNodeId)?.label ?? singleSelectedEdge.fromNodeId}</strong>{" "}
                → <strong>{nodeById.get(singleSelectedEdge.toNodeId)?.label ?? singleSelectedEdge.toNodeId}</strong> (
                {(() => {
                  const from = nodeById.get(singleSelectedEdge.fromNodeId);
                  const to = nodeById.get(singleSelectedEdge.toNodeId);
                  return from && to ? Math.round(distanceBetweenNodes(from.position, to.position, mapWidth, mapHeight)) : "—";
                })()}
                )
              </span>
              <form action={deleteEdge.bind(null, storeId, singleSelectedEdge.id)}>
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  מחק קשת
                </button>
              </form>
            </div>
          )}

          {totalSelected > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3">
              <span className="text-sm text-neutral-700">
                נבחרו{" "}
                {selectedNodeIds.size > 0 && <strong>{selectedNodeIds.size} צמתים</strong>}
                {selectedNodeIds.size > 0 && selectedEdgeIds.size > 0 && " ו-"}
                {selectedEdgeIds.size > 0 && <strong>{selectedEdgeIds.size} קשתות</strong>}
              </span>
              <button
                type="button"
                onClick={() => void handleDeleteSelected()}
                className="text-sm text-red-600 hover:underline"
              >
                מחק את הנבחרים
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
