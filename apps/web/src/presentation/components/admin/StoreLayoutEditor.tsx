"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode, MapNodeType } from "@smartroute/core/domain/entities/map-node";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ProductListing } from "@smartroute/core/domain/entities/product-listing";
import { distanceBetweenNodes } from "@smartroute/core/domain/value-objects/geo-point";
import { findUnroutableNodeIds } from "@smartroute/core/application/routing/reachability";
import { MINOR_LABEL_FONT_FRACTION } from "@smartroute/core/map/map-labels";
import { NODE_TYPE_LABELS } from "@/src/presentation/node-type-labels";
import type { MapChanges } from "@/src/infrastructure/repositories/interfaces/node-repository";
import {
  EMPTY_LINE_DRAFT,
  type LineDraft,
  addPoint,
  cancelPending,
  connect,
  detachFromNode,
  hitDraft,
  hitDraftLine,
  innerPoints,
  joinTouching,
  moveSegment,
  nearestOnSegment,
  pointByKey,
  removeLastSegment,
  splitAt,
  splitAtPosition,
  undoLastLineStep,
  uniformCount,
  withUniformSpacing,
} from "./waypoint-line-draft";
import {
  type MapState,
  type WaypointLinePoint,
  addWaypointLines,
  leaveShelf,
  markSameShelf,
  removeFromMap,
  removeWaypoints,
} from "./map-draft";
import { useMapDraft } from "./use-map-draft";
import {
  type AlignMode,
  type Guides,
  alignPositions,
  autoStraighten,
  snapToGuides,
  straightOntoSegment,
} from "./map-editor-snapping";
import { type ConnectionProposal, proposeConnections } from "./auto-connect";
import type { StoreMapVideo } from "@/src/infrastructure/repositories/interfaces/map-video-repository";
import { ProductAutocomplete } from "./ProductAutocomplete";
import { AliasPlacePanel } from "./AliasPlacePanel";
import { type ShelfGroupOption, ShelfGroupPanel } from "./ShelfGroupPanel";
import { MapVideoPlayer, MapVideoUploadPopup } from "./MapVideoPanels";

interface StoreLayoutEditorProps {
  storeId: string;
  mapWidth: number;
  mapHeight: number;
  mapImageUrl: string;
  nodes: MapNode[];
  edges: MapEdge[];
  nodeTypes: MapNodeType[];
  /** Hand-made products placed in the store; imported ones are shown by shelf group. */
  products: Product[];
  listings: ProductListing[];
  /** The store's shelf groups: what's left to place, and where each group stands. */
  shelfGroups: Array<ShelfGroupOption & { nodes: Array<{ nodeId: string; count: number }> }>;
  /** Aliases whose products stand at more than one node - usually one kind of product split by mistake. */
  splitAliases: Array<{ alias: string; nodes: Array<{ nodeId: string; count: number }> }>;
  hasPriceBranch: boolean;
  canEditProducts: boolean;
  /** Writes everything drafted in the editor, in one transaction. */
  saveMapChanges: (changes: MapChanges) => Promise<void>;
  /** Nodes products or promotions are placed on: the waypoint reset leaves these. */
  referencedNodeIds: string[];
  addProductToNode: (storeId: string, nodeId: string, formData: FormData) => Promise<void>;
  removeProductFromNode: (storeId: string, nodeId: string, productId: string) => Promise<void>;
  placeShelfGroupOnNode: (storeId: string, nodeId: string, groupId: string) => Promise<number>;
  placeAliasOnNode: (
    storeId: string,
    nodeId: string,
    alias: string,
    moveOthers: boolean,
  ) => Promise<{ placed: number; moved: number }>;
  removeShelfGroupFromNode: (storeId: string, nodeId: string, groupId: string) => Promise<void>;
  moveProductsToNode: (storeId: string, productIds: string[], nodeId: string) => Promise<void>;
  moveAliasToNode: (storeId: string, alias: string, fromNodeId: string, toNodeId: string) => Promise<number>;
  removeProductsFromNode: (storeId: string, nodeId: string, productIds: string[]) => Promise<void>;
  markProductsNotSold: (storeId: string, productIds: string[]) => Promise<void>;
  setProductsShelfGroup: (productIds: string[], groupId: string) => Promise<void>;
  uploadStoreImage: (formData: FormData) => Promise<void>;
  /** Videos of store areas pinned on the map - admin reference only, never part of the route graph. */
  videos: StoreMapVideo[];
  addMapVideo: (video: { videoUrl: string; title: string; x: number; y: number }) => Promise<void>;
  deleteMapVideo: (videoId: string) => Promise<void>;
}

const NODE_COLORS: Record<MapNodeType, string> = {
  entrance: "#2563eb",
  checkout: "#7c3aed",
  exit: "#0f766e",
  waypoint: "#9ca3af",
  department: "#059669",
};

function nodeRadius(type: MapNodeType): number {
  if (type === "waypoint") return 5;
  if (type === "entrance" || type === "checkout" || type === "exit") return 28;
  return 21;
}

const LABEL_FONT_SIZE = 18;
const VIDEO_PIN_RADIUS = 20;
const DISCONNECTED_COLOR = "#dc2626";
// A department's area: light blue (the shopper's map lights it up the same way).
const AREA_FILL = "#38bdf8";
const AREA_STROKE = "#0284c7";
// The dashed line joining departments marked as one shelf.
const SHARED_SHELF_COLOR = "#7c3aed";
// The waypoint-line tool's one spacing between points on every line (fraction of map width).
const WAYPOINT_LINE_SPACING = 0.04;
const LINE_COLOR = "#0891b2";
// How close (screen pixels) a click must land to an existing point to use it - kept tight, so a
// click on a line beside a point adds a new point there instead of jumping to that one.
const POINT_HIT_PX = 7;
// How close (screen pixels) a click must land to a line to put a new point on it.
const LINE_HIT_PX = 8;
// A drawn line this close (screen pixels) to the walking graph looks like it touches it, and joins it.
const LINE_TOUCH_PX = 4;

// Smart alignment guides catch a point this many screen pixels from another point's x or y.
const GUIDE_SNAP_PX = 8;
// A line drawn within this many degrees of horizontal/vertical comes out straight (Shift: free angle).
const AUTO_STRAIGHTEN_DEGREES = 7;
const GUIDE_COLOR = "#db2777";
// Auto-connect: corridors farther than this (fraction of map width) aren't proposed, and a spot
// this close to a corridor's waypoint joins that waypoint instead of adding one.
const AUTO_CONNECT_MAX_DISTANCE = 0.2;
const AUTO_CONNECT_JOIN_POINT = 0.005;
const PROPOSAL_COLOR = "#16a34a";

// Arrow key → direction to nudge the last drafted line.
const ARROW_NUDGES: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

// Alignment grid: how many columns (across the width) and rows (down the height) - each has
// its own density slider with this range.
const GRID_CELLS_MIN = 5;
const GRID_CELLS_MAX = 100;
const GRID_CELLS_DEFAULT = 40;

interface GridSettings {
  visible: boolean;
  cols: number;
  rows: number;
  snap: boolean;
}

const clampGridCells = (n: unknown, fallback: number) =>
  Math.min(GRID_CELLS_MAX, Math.max(GRID_CELLS_MIN, Math.round(Number(n)) || fallback));

/**
 * What a click of the waypoint-line tool lands on, in this order: a point of the draft (an end,
 * or a point between that then splits its line), an existing node, a drafted line or an
 * existing edge (a new point is added on it there), or else the empty spot.
 */
type LineTarget = { point: { x: number; y: number }; guides?: Guides } & (
  | { kind: "draftEnd"; key: string }
  | { kind: "draftInner"; segment: number; index: number }
  | { kind: "node"; nodeId: string }
  | { kind: "draftLine"; segment: number; t: number }
  | { kind: "edge"; edgeId: string }
  | { kind: "free" }
);

// Clicking this close to the first point of an area being drawn closes it (fraction of map width).
const AREA_CLOSE_DISTANCE = 0.015;

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
  fontSize = LABEL_FONT_SIZE,
  mapWidth,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  selected: boolean;
  disconnected: boolean;
  /** Defaults to the editor's own label size; entrance/exit/checkout pass the app's. */
  fontSize?: number;
  /** When given, the box is kept inside the map like the app does. */
  mapWidth?: number;
}) {
  const lines = (text || "?").split("\n").map((l) => l.trim()).filter(Boolean);
  const lineHeight = fontSize * 1.2;
  const width = Math.max(...lines.map((l) => l.length)) * fontSize * LABEL_CHAR_WIDTH_EM + fontSize;
  const height = lines.length * lineHeight + fontSize * 0.5;
  const top = y - height / 2;
  // The app nudges a label that would stick out past the map's edge back inside it.
  const cx = mapWidth === undefined ? x : Math.min(Math.max(x, width / 2), mapWidth - width / 2);
  return (
    <>
      {selected && (
        <rect x={cx - width / 2 - 5} y={top - 5} width={width + 10} height={height + 10} rx={12} fill="none" stroke="#059669" strokeWidth={3} />
      )}
      <rect
        x={cx - width / 2}
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
          x={cx}
          y={top + fontSize * 0.25 + lineHeight * i + fontSize * 0.95}
          textAnchor="middle"
          fontSize={fontSize}
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
  nodes: savedNodes,
  edges: savedEdges,
  nodeTypes,
  products,
  listings,
  shelfGroups,
  splitAliases,
  hasPriceBranch,
  canEditProducts,
  saveMapChanges,
  referencedNodeIds,
  addProductToNode,
  removeProductFromNode,
  placeShelfGroupOnNode,
  placeAliasOnNode,
  removeShelfGroupFromNode,
  moveProductsToNode,
  moveAliasToNode,
  removeProductsFromNode,
  markProductsNotSold,
  setProductsShelfGroup,
  uploadStoreImage,
  videos,
  addMapVideo,
  deleteMapVideo,
}: StoreLayoutEditorProps) {
  // Every edit of the map is a draft in this browser until "save changes".
  const savedMap = useMemo<MapState>(
    () => ({
      nodes: savedNodes,
      edges: savedEdges,
      videoPositions: Object.fromEntries(videos.map((v) => [v.id, v.position])),
    }),
    [savedNodes, savedEdges, videos],
  );
  const { map, isDirty, canUndo, saving, saveError, change, undo, save } = useMapDraft(savedMap);
  const { nodes, edges, videoPositions } = map;
  // Waypoint-line tool: click a start and an end (on empty map or on a node, which the line then
  // joins); points go between them at one uniform spacing. A click on a point of a drawn line
  // stretches the next one from there. All the lines are created together, along straight lines.
  const [lineMode, setLineMode] = useState(false);
  const [lineDraftState, setLineDraft] = useState<LineDraft>(EMPTY_LINE_DRAFT);
  const lineDraft = useMemo(
    () => withUniformSpacing(lineDraftState, mapWidth, mapHeight, WAYPOINT_LINE_SPACING),
    [lineDraftState, mapWidth, mapHeight],
  );
  const [lineCursor, setLineCursor] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  // "Edit walking points" opens the waypoint tools: the line tool and the reset.
  const [waypointToolsOpen, setWaypointToolsOpen] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  // "Connect departments automatically": proposed links under review (a click drops one) until approved.
  const [autoConnect, setAutoConnect] = useState<{
    proposals: ConnectionProposal[];
    rejected: Set<string>;
    tooFar: string[];
  } | null>(null);
  useEffect(() => {
    if (!autoConnect) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAutoConnect(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [autoConnect]);
  // Alignment grid, remembered per store in this browser only (it's an editing aid, not map data).
  const gridStorageKey = `navio.mapGrid.${storeId}`;
  // Rows default to whatever makes the cells square on this map.
  const squareRows = (cols: number) => clampGridCells((cols * mapHeight) / mapWidth, GRID_CELLS_DEFAULT);
  const [grid, setGrid] = useState<GridSettings>(() => ({
    visible: false,
    cols: GRID_CELLS_DEFAULT,
    rows: squareRows(GRID_CELLS_DEFAULT),
    snap: true,
  }));
  const gridLoadedRef = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(gridStorageKey) ?? "null") as
        | (Partial<GridSettings> & { cells?: number })
        | null;
      if (saved) {
        // localStorage isn't available during SSR, so the saved settings can only load after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGrid({
          visible: saved.visible === true,
          // `cells` is the older single density (square cells).
          cols: clampGridCells(saved.cols ?? saved.cells, GRID_CELLS_DEFAULT),
          rows: clampGridCells(saved.rows, squareRows(clampGridCells(saved.cols ?? saved.cells, GRID_CELLS_DEFAULT))),
          snap: saved.snap !== false,
        });
      }
    } catch {
      // No storage (private window, blocked site data): the defaults do.
    }
    gridLoadedRef.current = true;
    // squareRows only depends on the map's size, which doesn't change while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridStorageKey]);
  useEffect(() => {
    if (!gridLoadedRef.current) return;
    try {
      window.localStorage.setItem(gridStorageKey, JSON.stringify(grid));
    } catch {
      // Not remembered - fine.
    }
  }, [grid, gridStorageKey]);
  // Alignment guides shown while dragging a node.
  const [dragGuides, setDragGuides] = useState<Guides | null>(null);
  // The map's on-screen width, so snapping distances can be set in screen pixels.
  const [svgWidthPx, setSvgWidthPx] = useState(0);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(() => setSvgWidthPx(svg.getBoundingClientRect().width));
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const gridSpacingX = mapWidth / grid.cols;
  const gridSpacingY = mapHeight / grid.rows;
  // While drawing a line: Shift draws at a free angle (no auto-straightening) and Alt places
  // freely (no guides or grid). Tracked from the keyboard too, so the preview follows them
  // without moving the mouse.
  const [shiftHeld, setShiftHeld] = useState(false);
  const [altHeld, setAltHeld] = useState(false);
  useEffect(() => {
    if (!lineMode) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Shift") setShiftHeld(true);
      if (e.key === "Alt") {
        e.preventDefault(); // keeps the browser's menu bar from taking focus
        setAltHeld(true);
      }
      // Enter ends the chain being drawn; the lines stay in the draft.
      if (e.key === "Enter" && lineDraft.pendingFrom) setLineDraft(cancelPending(lineDraft));
      // Arrow keys nudge the last drafted line, parallel to itself: 1 screen pixel, 10 with Shift.
      // Not while a field has focus - the arrows are its own there.
      const nudge = ARROW_NUDGES[e.key];
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select");
      if (nudge && !typing && lineDraft.segments.length > 0) {
        e.preventDefault();
        const widthPx = svgRef.current?.getBoundingClientRect().width || mapWidth;
        const stepPx = e.shiftKey ? 10 : 1;
        const units = (stepPx * mapWidth) / widthPx;
        setLineDraft(
          moveSegment(
            lineDraft,
            lineDraft.segments.length - 1,
            (nudge[0] * units) / mapWidth,
            (nudge[1] * units) / mapHeight,
          ),
        );
        return;
      }
      if (e.key !== "Escape") return;
      if (lineDraft.points.length > 0) setLineDraft(EMPTY_LINE_DRAFT);
      else setLineMode(false);
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift") setShiftHeld(false);
      if (e.key === "Alt") setAltHeld(false);
    }
    const releaseShift = () => {
      setShiftHeld(false);
      setAltHeld(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseShift);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseShift);
    };
  }, [lineMode, lineDraft, mapWidth, mapHeight]);
  // A department's area being drawn: each click on the map adds a corner; the lines follow the cursor.
  const [areaDraft, setAreaDraft] = useState<{ nodeId: string; points: Array<{ x: number; y: number }> } | null>(null);
  const [areaCursor, setAreaCursor] = useState<{ x: number; y: number } | null>(null);
  // Read by the Esc handler, which is registered once.
  useEffect(() => {
    if (!areaDraft) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Shift") setShiftHeld(e.type === "keydown");
      if (e.key === "Alt") {
        if (e.type === "keydown") e.preventDefault(); // keeps the browser's menu bar from taking focus
        setAltHeld(e.type === "keydown");
      }
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
    };
  }, [areaDraft]);
  const areaDraftRef = useRef(areaDraft);
  useEffect(() => {
    areaDraftRef.current = areaDraft;
  }, [areaDraft]);
  // The split alias being moved to another node, while its move runs.
  const [movingAlias, setMovingAlias] = useState<string | null>(null);
  const [, startMoveTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStartRef = useRef<{ nodeId: string; clientX: number; clientY: number; moved: boolean } | null>(
    null,
  );
  const justDraggedRef = useRef(false);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [addPopup, setAddPopup] = useState<AddNodePopup | null>(null);
  // "Add department" armed: the next click on the map places a named node there.
  const [placingNode, setPlacingNode] = useState(false);
  // "move": clicks only select and drags only move - nothing gets added or connected by
  // accident. "build": a click on the map adds a waypoint, a click on a second node connects.
  const [editMode, setEditMode] = useState<"move" | "build">("move");
  // Departments shrink to small dots, so their label boxes don't cover the corridors being edited.
  // The dots still drag, select and connect like waypoints. View-only: nothing about the map changes.
  const [hideDepartments, setHideDepartments] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());
  const marqueeStartRef = useRef<{ clientX: number; clientY: number; active: boolean } | null>(null);
  const justMarqueedRef = useRef(false);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // "Add video" armed: the next click on the map opens the upload popup there (in either mode).
  const [placingVideo, setPlacingVideo] = useState(false);
  const [videoPopup, setVideoPopup] = useState<{ screenLeft: number; screenTop: number; normX: number; normY: number } | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const videoDragStartRef = useRef<{ videoId: string; clientX: number; clientY: number; moved: boolean } | null>(null);
  const [videoDrag, setVideoDrag] = useState<{ videoId: string; x: number; y: number } | null>(null);

  // Clicking empty space now adds a waypoint instead of clearing the selection, so Escape is the
  // way to stop a corridor chain.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // While drawing an area, Esc only drops the drawing - the department stays selected.
      if (areaDraftRef.current) {
        setAreaDraft(null);
        setAreaCursor(null);
        return;
      }
      setAddPopup(null);
      setPlacingNode(false);
      setPlacingVideo(false);
      setPlayingVideoId(null);
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

  /**
   * Snaps a normalized point to the nearest grid line while the grid is shown with snapping on.
   * Holding Alt places freely.
   */
  function snapToGrid(point: { x: number; y: number }, altKey: boolean): { x: number; y: number } {
    if (!grid.visible || !grid.snap || altKey) return point;
    // Onto the nearest grid line - vertical or horizontal, whichever is closer - not a crossing:
    // only that one coordinate moves, the point slides freely along the line.
    const nearest = (value: number, size: number, spacing: number) =>
      Math.max(0, Math.min(1, (Math.round((value * size) / spacing) * spacing) / size));
    const x = nearest(point.x, mapWidth, gridSpacingX);
    const y = nearest(point.y, mapHeight, gridSpacingY);
    const toVertical = Math.abs(x - point.x) * mapWidth;
    const toHorizontal = Math.abs(y - point.y) * mapHeight;
    return toVertical <= toHorizontal ? { x, y: point.y } : { x: point.x, y };
  }

  /**
   * Where a dragged or placed point lands: lined up with another point's x/y when one is within
   * a few pixels (smart guides), else on the grid. Alt places freely.
   */
  function placePoint(raw: { x: number; y: number }, others: readonly { x: number; y: number }[], altKey: boolean) {
    if (altKey) return { point: raw, guides: {} as Guides };
    const threshold = svgWidthPx > 0 ? (GUIDE_SNAP_PX * mapWidth) / svgWidthPx : 0;
    const guided = snapToGuides(raw, others, threshold, mapWidth, mapHeight);
    if (guided.guides.x !== undefined || guided.guides.y !== undefined) return guided;
    return { point: snapToGrid(raw, false), guides: {} as Guides };
  }

  /** A free line end: guides/grid, then straightened when nearly horizontal or vertical (unless Shift). */
  function placeLineEnd(
    cursor: { x: number; y: number },
    pendingPoint: { x: number; y: number } | undefined,
    altKey: boolean,
    shiftKey: boolean,
  ) {
    return placeStraight(cursor, pendingPoint, [...nodes.map((n) => n.position), ...lineDraft.points], altKey, shiftKey);
  }

  /**
   * A point drawn on from `previous`: guides/grid (Alt: free), then straightened when the line
   * from `previous` is nearly horizontal or vertical (Shift: free angle).
   */
  function placeStraight(
    cursor: { x: number; y: number },
    previous: { x: number; y: number } | undefined,
    others: readonly { x: number; y: number }[],
    altKey: boolean,
    shiftKey: boolean,
  ) {
    const placed = placePoint(cursor, others, altKey);
    if (!previous || shiftKey) return placed;
    const point = autoStraighten(previous, placed.point, mapWidth, mapHeight, AUTO_STRAIGHTEN_DEGREES);
    return {
      point,
      guides: {
        x: placed.guides.x === point.x ? placed.guides.x : undefined,
        y: placed.guides.y === point.y ? placed.guides.y : undefined,
      },
    };
  }

  function otherNodePositions(nodeId: string) {
    return nodes.filter((n) => n.id !== nodeId).map((n) => n.position);
  }

  function handleAlign(mode: AlignMode) {
    const selected = nodes
      .filter((n) => selectedNodeIds.has(n.id))
      .map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }));
    const positions = new Map(alignPositions(selected, mode, mapWidth, mapHeight).map((p) => [p.id, p]));
    if (positions.size === 0) return;
    change((m) => ({
      ...m,
      nodes: m.nodes.map((n) => {
        const p = positions.get(n.id);
        return p ? { ...n, position: { x: p.x, y: p.y } } : n;
      }),
    }));
  }

  function containerOffset(clientX: number, clientY: number): { left: number; top: number } {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { left: 0, top: 0 };
    return { left: clientX - rect.left, top: clientY - rect.top };
  }

  function closePopups() {
    setAddPopup(null);
  }

  function newEdge(fromNodeId: string, toNodeId: string): MapEdge {
    return { id: crypto.randomUUID(), storeId, fromNodeId, toNodeId, bidirectional: true };
  }

  function connectNodes(fromNodeId: string, toNodeId: string) {
    const edge = newEdge(fromNodeId, toNodeId);
    change((m) => ({ ...m, edges: [...m.edges, edge] }));
  }

  function moveNode(nodeId: string, position: { x: number; y: number }) {
    change((m) => ({ ...m, nodes: m.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)) }));
  }

  /** The add-node popup's form: a name is a must for a department only. */
  function addNodeFromPopup(formData: FormData) {
    const type = String(formData.get("type") ?? "waypoint") as MapNodeType;
    const typed = String(formData.get("label") ?? "").trim();
    const label = typed || (type === "department" ? "" : NODE_TYPE_LABELS[type]);
    closePopups();
    if (!label) return;
    const node: MapNode = {
      id: crypto.randomUUID(),
      storeId,
      type,
      label,
      position: { x: Number(formData.get("x") ?? 0), y: Number(formData.get("y") ?? 0) },
      zone: String(formData.get("zone") ?? "").trim() || undefined,
    };
    change((m) => ({ ...m, nodes: [...m.nodes, node] }));
  }

  function renameNode(nodeId: string, formData: FormData) {
    const label = String(formData.get("label") ?? "").replace(/\r\n/g, "\n").trim();
    if (!label) return;
    change((m) => ({ ...m, nodes: m.nodes.map((n) => (n.id === nodeId && n.label !== label ? { ...n, label } : n)) }));
  }

  function markSelectedAsOneShelf() {
    const chosen = new Set(selectedNodeIds);
    const shelfId = crypto.randomUUID();
    change((m) => markSameShelf(m, chosen, () => shelfId));
  }

  function takeOffShelf(nodeIds: Iterable<string>) {
    const leaving = new Set(nodeIds);
    change((m) => leaveShelf(m, leaving));
  }

  function deleteFromMap(nodeIds: Iterable<string>, edgeIds: Iterable<string>) {
    const nodesToGo = new Set(nodeIds);
    const edgesToGo = new Set(edgeIds);
    change((m) => removeFromMap(m, nodesToGo, edgesToGo));
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
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
    if (placingVideo) {
      const { left, top } = containerOffset(e.clientX, e.clientY);
      setPlacingVideo(false);
      setVideoPopup({ screenLeft: left, screenTop: top, normX: x, normY: y });
      return;
    }
    if (editMode === "move") {
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
      return;
    }
    // New departments and waypoints land on the grid too.
    const placed = snapToGrid({ x, y }, e.altKey);
    if (placingNode) {
      const { left, top } = containerOffset(e.clientX, e.clientY);
      setPlacingNode(false);
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
      setAddPopup({ screenLeft: left, screenTop: top, normX: placed.x, normY: placed.y, presetType: "department" });
      return;
    }
    const waypoint: MapNode = {
      id: crypto.randomUUID(),
      storeId,
      type: "waypoint",
      label: NODE_TYPE_LABELS.waypoint,
      position: placed,
    };
    // The point and its link to the selected node are one step to undo.
    const chained = selectedNodeIds.size === 1 && selectedEdgeIds.size === 0;
    const link = chained ? [newEdge(Array.from(selectedNodeIds)[0], waypoint.id)] : [];
    change((m) => ({ ...m, nodes: [...m.nodes, waypoint], edges: [...m.edges, ...link] }));
    setSelectedNodeIds(chained ? new Set([waypoint.id]) : new Set());
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
    const { point, guides } = placePoint(screenToNormalized(e.clientX, e.clientY), otherNodePositions(node.id), e.altKey);
    setDragState({ nodeId: node.id, ...point });
    setDragGuides(guides);
  }

  function handleNodePointerUp(e: React.PointerEvent<SVGGElement>, node: MapNode) {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start || start.nodeId !== node.id) return;

    if (start.moved) {
      justDraggedRef.current = true;
      const { point } = placePoint(screenToNormalized(e.clientX, e.clientY), otherNodePositions(node.id), e.altKey);
      setDragState(null);
      setDragGuides(null);
      moveNode(node.id, point);
    }
  }

  // A video pin drags like a node; a press without dragging plays the video.
  function handleVideoPointerDown(e: React.PointerEvent<SVGGElement>, video: StoreMapVideo) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    videoDragStartRef.current = { videoId: video.id, clientX: e.clientX, clientY: e.clientY, moved: false };
  }

  function handleVideoPointerMove(e: React.PointerEvent<SVGGElement>, video: StoreMapVideo) {
    const start = videoDragStartRef.current;
    if (!start || start.videoId !== video.id) return;
    if (!start.moved && Math.hypot(e.clientX - start.clientX, e.clientY - start.clientY) < DRAG_THRESHOLD_PX) return;
    start.moved = true;
    const { x, y } = screenToNormalized(e.clientX, e.clientY);
    setVideoDrag({ videoId: video.id, x, y });
  }

  function handleVideoPointerUp(e: React.PointerEvent<SVGGElement>, video: StoreMapVideo) {
    const start = videoDragStartRef.current;
    videoDragStartRef.current = null;
    if (!start || start.videoId !== video.id) return;
    if (!start.moved) {
      closePopups();
      setPlayingVideoId(video.id);
      return;
    }
    const position = screenToNormalized(e.clientX, e.clientY);
    change((m) => ({ ...m, videoPositions: { ...m.videoPositions, [video.id]: position } }));
    setVideoDrag(null);
  }

  function startAreaDrawing(nodeId: string) {
    closePopups();
    setPlacingNode(false);
    setPlacingVideo(false);
    setAreaCursor(null);
    setAreaDraft({ nodeId, points: [] });
  }

  function cancelAreaDrawing() {
    setAreaDraft(null);
    setAreaCursor(null);
  }

  function saveArea(nodeId: string, area: Array<{ x: number; y: number }> | null) {
    change((m) => ({
      ...m,
      nodes: m.nodes.map((n) => (n.id === nodeId ? { ...n, area: area ?? undefined } : n)),
    }));
    cancelAreaDrawing();
  }

  /**
   * Where the next corner of the area being drawn lands: right where clicked - no guides or grid
   * (a map full of nodes would catch nearly every click) - except that a side within a few
   * degrees of horizontal or vertical comes out straight (Shift: exactly as clicked).
   */
  function placeAreaCorner(cursor: { x: number; y: number }, shiftKey: boolean) {
    const previous = areaDraft?.points.at(-1);
    const point =
      previous && !shiftKey ? autoStraighten(previous, cursor, mapWidth, mapHeight, AUTO_STRAIGHTEN_DEGREES) : cursor;
    return { point };
  }

  function handleAreaClick(e: React.MouseEvent) {
    if (!areaDraft || saving) return;
    const cursor = screenToNormalized(e.clientX, e.clientY);
    const first = areaDraft.points[0];
    // A click back on the first corner closes the shape and saves it.
    if (
      first &&
      areaDraft.points.length >= 3 &&
      Math.hypot((cursor.x - first.x) * mapWidth, (cursor.y - first.y) * mapHeight) <= AREA_CLOSE_DISTANCE * mapWidth
    ) {
      saveArea(areaDraft.nodeId, areaDraft.points);
      return;
    }
    const { point } = placeAreaCorner(cursor, e.shiftKey);
    setAreaDraft({ ...areaDraft, points: [...areaDraft.points, point] });
  }

  function undoAreaPoint() {
    if (!areaDraft) return;
    setAreaDraft({ ...areaDraft, points: areaDraft.points.slice(0, -1) });
  }

  /**
   * The node drawn under the cursor - a department's whole label box counts, not just a small
   * radius around its center. The line tool's overlay is on top, so look through every layer.
   */
  function nodeUnderCursor(clientX: number, clientY: number): MapNode | undefined {
    for (const element of document.elementsFromPoint(clientX, clientY)) {
      const nodeId = element.closest("[data-node-id]")?.getAttribute("data-node-id");
      const node = nodeId ? nodeById.get(nodeId) : undefined;
      if (node) return node;
    }
    return undefined;
  }

  /** What a click at this spot would land on (see LineTarget), and where exactly. */
  function resolveLineTarget(
    cursor: { x: number; y: number },
    clientX: number,
    clientY: number,
    pendingPoint: { x: number; y: number } | undefined,
    altKey: boolean,
    shiftKey: boolean,
  ): LineTarget {
    const unitsPerPx = svgWidthPx > 0 ? mapWidth / svgWidthPx : 1;
    const pointTolerance = POINT_HIT_PX * unitsPerPx;
    const lineTolerance = LINE_HIT_PX * unitsPerPx;

    const hit = hitDraft(lineDraft, cursor, pointTolerance, mapWidth, mapHeight);
    if (hit?.kind === "end") return { kind: "draftEnd", key: hit.key, point: pointByKey(lineDraft, hit.key)! };
    if (hit?.kind === "inner") {
      const s = lineDraft.segments[hit.segment];
      const at = innerPoints(pointByKey(lineDraft, s.from)!, pointByKey(lineDraft, s.to)!, s.count)[hit.index - 1];
      return { kind: "draftInner", segment: hit.segment, index: hit.index, point: at };
    }

    // A node drawn under the cursor (a department's whole label counts), or one right beside it.
    let node = nodeUnderCursor(clientX, clientY);
    if (!node) {
      let best: { node: MapNode; d: number } | null = null;
      for (const n of nodes) {
        const d = Math.hypot((n.position.x - cursor.x) * mapWidth, (n.position.y - cursor.y) * mapHeight);
        if (d <= pointTolerance && (!best || d < best.d)) best = { node: n, d };
      }
      node = best?.node;
    }
    if (node) return { kind: "node", nodeId: node.id, point: node.position };

    // On a line: a new point exactly on it - slid along it to keep a nearly straight line straight.
    const onLine = (a: { x: number; y: number }, b: { x: number; y: number }, at: { x: number; y: number }) => {
      const point =
        pendingPoint && !shiftKey
          ? straightOntoSegment(pendingPoint, at, a, b, mapWidth, mapHeight, AUTO_STRAIGHTEN_DEGREES)
          : at;
      return { point, t: nearestOnSegment(a, b, point, mapWidth, mapHeight).t };
    };
    const draftLine = hitDraftLine(lineDraft, cursor, lineTolerance, mapWidth, mapHeight);
    if (draftLine) {
      const s = lineDraft.segments[draftLine.segment];
      const a = pointByKey(lineDraft, s.from)!;
      const b = pointByKey(lineDraft, s.to)!;
      const { point, t } = onLine(a, b, nearestOnSegment(a, b, cursor, mapWidth, mapHeight).point);
      if (t > 0 && t < 1) return { kind: "draftLine", segment: draftLine.segment, t, point };
    }
    let bestEdge: { edgeId: string; a: MapNode; b: MapNode; at: { x: number; y: number }; d: number } | null = null;
    for (const edge of edges) {
      const a = nodeById.get(edge.fromNodeId);
      const b = nodeById.get(edge.toNodeId);
      if (!a || !b) continue;
      const near = nearestOnSegment(a.position, b.position, cursor, mapWidth, mapHeight);
      if (near.t <= 0 || near.t >= 1 || near.distance > lineTolerance) continue;
      if (!bestEdge || near.distance < bestEdge.d) bestEdge = { edgeId: edge.id, a, b, at: near.point, d: near.distance };
    }
    if (bestEdge) {
      const { point, t } = onLine(bestEdge.a.position, bestEdge.b.position, bestEdge.at);
      if (t > 0 && t < 1) return { kind: "edge", edgeId: bestEdge.edgeId, point };
    }

    const placed = placeLineEnd(cursor, pendingPoint, altKey, shiftKey);
    return { kind: "free", point: placed.point, guides: placed.guides };
  }

  // A click starts a line or ends the one being stretched - on whatever resolveLineTarget finds.
  // Nothing joins the map until "create".
  function handleLineClick(e: React.MouseEvent) {
    if (saving) return;
    // A second click on a department (or entrance/checkout) a line already joins unhooks it:
    // that end stays put as a plain new waypoint, not connected to the department.
    const under = nodeUnderCursor(e.clientX, e.clientY);
    if (under && under.type !== "waypoint" && lineDraft.points.some((p) => p.nodeId === under.id)) {
      setLineDraft(detachFromNode(lineDraft, under.id));
      return;
    }
    const cursor = screenToNormalized(e.clientX, e.clientY);
    const pendingFrom = lineDraft.pendingFrom;
    const pendingPoint = pendingFrom ? pointByKey(lineDraft, pendingFrom) : undefined;
    const target = resolveLineTarget(cursor, e.clientX, e.clientY, pendingPoint, e.altKey, e.shiftKey);
    const newKey = crypto.randomUUID();
    let draft = lineDraft;
    let key: string;
    switch (target.kind) {
      case "draftEnd":
        key = target.key;
        break;
      case "draftInner":
        ({ draft, key } = splitAt(draft, target.segment, target.index, newKey));
        break;
      case "draftLine":
        ({ draft, key } = splitAtPosition(draft, target.segment, target.t, newKey));
        break;
      case "node":
        ({ draft, key } = addPoint(draft, { nodeId: target.nodeId, ...target.point }, newKey));
        break;
      case "edge":
        ({ draft, key } = addPoint(draft, { edgeId: target.edgeId, ...target.point }, newKey));
        break;
      default:
        ({ draft, key } = addPoint(draft, target.point, newKey));
    }
    if (!pendingFrom || !pendingPoint) {
      setLineDraft({ ...draft, pendingFrom: key });
      return;
    }
    if (key === pendingFrom) return;
    const end = pointByKey(draft, key)!;
    const count = uniformCount(pendingPoint, end, mapWidth, mapHeight, WAYPOINT_LINE_SPACING);
    // Drawing goes on from the end just placed: the next click stretches the next line from it.
    setLineDraft({ ...connect(draft, pendingFrom, key, count), pendingFrom: key });
  }

  /** The map with the lines still in the line tool's draft drawn on it. */
  function withDrawnLines(onto: MapState) {
    if (lineDraft.segments.length === 0) return onto;
    const unitsPerPx = svgWidthPx > 0 ? mapWidth / svgWidthPx : 1;
    const joined = withUniformSpacing(
      joinTouching(lineDraft, onto.nodes, onto.edges, mapWidth, mapHeight, LINE_TOUCH_PX * unitsPerPx),
      mapWidth,
      mapHeight,
      WAYPOINT_LINE_SPACING,
    );
    const points: WaypointLinePoint[] = joined.points.map((p) =>
      p.nodeId ? { key: p.key, nodeId: p.nodeId } : { key: p.key, x: p.x, y: p.y, edgeId: p.edgeId },
    );
    return addWaypointLines(onto, storeId, points, joined.segments);
  }

  function saveLines() {
    if (lineDraft.segments.length === 0 || saving) return;
    const next = withDrawnLines(map);
    change(() => next);
    setLineDraft(EMPTY_LINE_DRAFT);
  }

  function handleSave() {
    const final = withDrawnLines(map);
    setLineDraft(EMPTY_LINE_DRAFT);
    save(final, saveMapChanges);
  }

  /** One step back: first whatever is being drawn right now, then the map's edits, newest first. */
  function handleUndo() {
    if (saving) return;
    if (autoConnect) {
      setAutoConnect(null);
      return;
    }
    if (areaDraft) {
      if (areaDraft.points.length > 0) undoAreaPoint();
      else cancelAreaDrawing();
      return;
    }
    if (lineDraft.points.length > 0) {
      setLineDraft(undoLastLineStep(lineDraft));
      return;
    }
    const previous = undo();
    if (!previous) return;
    const nodeIds = new Set(previous.nodes.map((n) => n.id));
    const edgeIds = new Set(previous.edges.map((e) => e.id));
    setSelectedNodeIds((ids) => new Set([...ids].filter((id) => nodeIds.has(id))));
    setSelectedEdgeIds((ids) => new Set([...ids].filter((id) => edgeIds.has(id))));
  }

  // Ctrl+Z, by the physical key so it works on a Hebrew layout too. Inside a text field it stays
  // the field's own undo.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.code !== "KeyZ") return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      handleUndo();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const hasUnsavedChanges = isDirty || lineDraft.segments.length > 0;
  const hasUndoStep = canUndo || lineDraft.points.length > 0 || (areaDraft?.points.length ?? 0) > 0;
  // Leaving the page drops the draft, so it asks first - on a reload or close, and on a link.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    function handleLinkClick(e: MouseEvent) {
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!link || link.getAttribute("target") === "_blank") return;
      if (!window.confirm("יש שינויים במפה שלא נשמרו. לצאת בלי לשמור?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("click", handleLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasUnsavedChanges]);

  function startAutoConnect() {
    exitLineMode();
    setResetMessage(null);
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    closePopups();
    cancelAreaDrawing();
    setPlacingNode(false);
    setPlacingVideo(false);
    const { proposals, tooFar } = proposeConnections(nodes, edges, mapWidth, mapHeight, {
      maxDistance: AUTO_CONNECT_MAX_DISTANCE * mapWidth,
      joinPointDistance: AUTO_CONNECT_JOIN_POINT * mapWidth,
    });
    setAutoConnect({ proposals, rejected: new Set(), tooFar });
  }

  function toggleProposal(nodeId: string) {
    if (!autoConnect) return;
    const rejected = new Set(autoConnect.rejected);
    if (rejected.has(nodeId)) rejected.delete(nodeId);
    else rejected.add(nodeId);
    setAutoConnect({ ...autoConnect, rejected });
  }

  /** Drafts the approved links: each department joined to its corridor (splitting that edge there). */
  function approveAutoConnect() {
    if (!autoConnect || saving) return;
    const accepted = autoConnect.proposals.filter((p) => !autoConnect.rejected.has(p.nodeId));
    if (accepted.length === 0) {
      setAutoConnect(null);
      return;
    }
    const points: WaypointLinePoint[] = accepted.flatMap((p, i) => [
      { key: `d${i}`, nodeId: p.nodeId },
      p.target.kind === "node"
        ? { key: `t${i}`, nodeId: p.target.nodeId }
        : { key: `t${i}`, x: p.target.x, y: p.target.y, edgeId: p.target.edgeId },
    ]);
    const segments = accepted.map((_, i) => ({ from: `d${i}`, to: `t${i}`, count: 0 }));
    const next = addWaypointLines(map, storeId, points, segments);
    change(() => next);
    setAutoConnect(null);
  }

  function exitLineMode() {
    setLineMode(false);
    setLineDraft(EMPTY_LINE_DRAFT);
    setLineCursor(null);
  }

  function handleResetWaypoints() {
    const count = nodes.filter((n) => n.type === "waypoint").length;
    if (count === 0) {
      setResetMessage("אין נקודות הליכה למחיקה.");
      return;
    }
    if (
      !window.confirm(
        `למחוק את כל ${count} נקודות ההליכה ואת החיבורים שלהן?\nמחלקות, כניסות וקופות לא יימחקו. אפשר לחזור אחורה עד שלוחצים על שמור שינויים.`,
      )
    ) {
      return;
    }
    exitLineMode();
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    const result = removeWaypoints(map, new Set(referencedNodeIds));
    change(() => result.map);
    setResetMessage(
      `${result.deleted} נקודות הליכה הוסרו מהטיוטה.` +
        (result.kept > 0 ? ` ${result.kept} נקודות נשארו כי משויכים אליהן מוצרים או מבצעים.` : ""),
    );
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

  function handleDeleteSelected() {
    deleteFromMap(selectedNodeIds, selectedEdgeIds);
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const playingVideo = videos.find((v) => v.id === playingVideoId) ?? null;
  // Painted red: what a route can't reach, judged exactly as route building does it.
  const disconnectedNodeIds = findUnroutableNodeIds(nodes, edges);
  const entranceCount = nodes.filter((n) => n.type === "entrance").length;
  const hasEntrance = entranceCount > 0;
  const totalSelected = selectedNodeIds.size + selectedEdgeIds.size;

  const singleSelectedNode =
    totalSelected === 1 && selectedNodeIds.size === 1
      ? (nodeById.get(Array.from(selectedNodeIds)[0]) ?? null)
      : null;
  const singleSelectedEdge =
    totalSelected === 1 && selectedEdgeIds.size === 1
      ? (edges.find((e) => e.id === Array.from(selectedEdgeIds)[0]) ?? null)
      : null;

  // Departments marked as one physical shelf, by shelf.
  const sharedShelves = new Map<string, MapNode[]>();
  for (const node of nodes) {
    if (node.type === "department" && node.shelfId) {
      sharedShelves.set(node.shelfId, [...(sharedShelves.get(node.shelfId) ?? []), node]);
    }
  }
  const selectedDepartments = nodes.filter((n) => n.type === "department" && selectedNodeIds.has(n.id));
  const selectedAreOneShelf =
    selectedDepartments.length >= 2 &&
    !!selectedDepartments[0].shelfId &&
    selectedDepartments.every((n) => n.shelfId === selectedDepartments[0].shelfId);
  const shelfMates = singleSelectedNode?.shelfId
    ? (sharedShelves.get(singleSelectedNode.shelfId) ?? []).filter((n) => n.id !== singleSelectedNode.id)
    : [];

  const showsProductPanel = singleSelectedNode?.type === "department";
  // The drawing only lives while its department is the one selected.
  const activeAreaDraft = areaDraft && singleSelectedNode?.id === areaDraft.nodeId ? areaDraft : null;
  // The line being stretched: from its start to where a click would put its end.
  const linePendingPoint = lineDraft.pendingFrom ? pointByKey(lineDraft, lineDraft.pendingFrom) : undefined;
  const lineTarget =
    lineMode && lineCursor
      ? resolveLineTarget(lineCursor, lineCursor.clientX, lineCursor.clientY, linePendingPoint, altHeld, shiftHeld)
      : null;
  const lineEndPreview = linePendingPoint && lineTarget ? lineTarget.point : null;
  // The next corner of the area being drawn, where a click would put it.
  const areaPlacement = areaDraft && areaCursor ? placeAreaCorner(areaCursor, shiftHeld) : null;
  const shownGuides = dragGuides ?? lineTarget?.guides ?? null;
  const lastLine = lineDraft.segments.at(-1);
  const lineNodeIds = new Set(lineDraft.points.flatMap((p) => (p.nodeId ? [p.nodeId] : [])));
  const toSvgPoints = (points: Array<{ x: number; y: number }>) =>
    points.map((p) => `${p.x * mapWidth},${p.y * mapHeight}`).join(" ");
  const listedProductIdsAtNode = new Set(
    showsProductPanel
      ? listings.filter((l) => l.nodeId === singleSelectedNode!.id).map((l) => l.productId)
      : [],
  );
  const productsAtNode = showsProductPanel
    ? products
        .filter((p) => listedProductIdsAtNode.has(p.id))
        .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, "he"))
    : [];
  const groupsAtNode = showsProductPanel
    ? shelfGroups
        .flatMap((g) => {
          const here = g.nodes.find((n) => n.nodeId === singleSelectedNode!.id);
          return here ? [{ groupId: g.groupId, name: g.name, count: here.count }] : [];
        })
        .sort((a, b) => a.name.localeCompare(b.name, "he"))
    : [];
  // Products can only be placed on a node the database already has.
  const savedNodeIds = new Set(savedNodes.map((n) => n.id));
  const isUnsavedNode = singleSelectedNode !== null && !savedNodeIds.has(singleSelectedNode.id);
  const departmentNodes = nodes
    .filter((n) => n.type === "department" && savedNodeIds.has(n.id))
    .map((n) => ({ id: n.id, label: n.label }))
    .sort((a, b) => a.label.localeCompare(b.label, "he"));
  // The aliases standing here that also stand elsewhere, and where else.
  const splitHere = showsProductPanel
    ? splitAliases.flatMap((split) => {
        const here = split.nodes.find((n) => n.nodeId === singleSelectedNode!.id);
        if (!here) return [];
        const elsewhere = split.nodes
          .filter((n) => n.nodeId !== singleSelectedNode!.id)
          .map((n) => ({
            ...n,
            label: nodeById.get(n.nodeId)?.label.replace(/\s*\n\s*/g, " ") ?? "נקודה אחרת",
          }));
        return [{ alias: split.alias, count: here.count, elsewhere }];
      })
    : [];
  const splitAliasesHere = new Map(
    splitHere.map((s) => [s.alias, s.elsewhere.map((n) => `${n.label} (${n.count})`).join(" · ")]),
  );

  function moveSplitAlias(alias: string, toNodeId: string) {
    const fromNodeId = singleSelectedNode!.id;
    setMovingAlias(alias);
    startMoveTransition(async () => {
      await moveAliasToNode(storeId, alias, fromNodeId, toNodeId);
      setMovingAlias(null);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-neutral-900">עריכת פריסה חזותית</h2>
        <div className="flex flex-wrap items-center gap-2">
          {waypointToolsOpen && (
            <>
              <button
                type="button"
                onClick={() => {
                  setResetMessage(null);
                  if (lineMode) {
                    exitLineMode();
                    return;
                  }
                  setSelectedNodeIds(new Set());
                  setSelectedEdgeIds(new Set());
                  closePopups();
                  cancelAreaDrawing();
                  setPlacingNode(false);
                  setPlacingVideo(false);
                  setAutoConnect(null);
                  setLineMode(true);
                }}
                aria-pressed={lineMode}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  lineMode ? "bg-cyan-600 text-white" : "border border-cyan-600 bg-white text-cyan-700"
                }`}
              >
                {lineMode ? "סיום הוספת קו" : "הוספת קו נקודות"}
              </button>
              <button
                type="button"
                onClick={handleResetWaypoints}
                disabled={saving}
                className="rounded-full border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                ריסט
              </button>
              <button
                type="button"
                onClick={() => (autoConnect ? setAutoConnect(null) : startAutoConnect())}
                aria-pressed={autoConnect !== null}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  autoConnect ? "bg-green-600 text-white" : "border border-green-600 bg-white text-green-700"
                }`}
              >
                {autoConnect ? "ביטול חיבור אוטומטי" : "חיבור אוטומטי של מחלקות"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              if (waypointToolsOpen) exitLineMode();
              setResetMessage(null);
              setWaypointToolsOpen((v) => !v);
            }}
            aria-expanded={waypointToolsOpen}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              waypointToolsOpen ? "border border-cyan-600 bg-white text-cyan-700" : "bg-cyan-600 text-white"
            }`}
          >
            {waypointToolsOpen ? "סגירת עריכת נקודות הליכה" : "עריכת נקודות הליכה"}
          </button>
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
      {/* Floats over the page, so the map doesn't shift under the cursor when it appears. */}
      {hasUndoStep && (
        <div className="fixed bottom-4 left-1/2 z-30 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
          <button
            type="button"
            onClick={handleUndo}
            disabled={saving}
            title="חזרה אחורה (Ctrl+Z)"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40"
          >
            ↶ חזרה אחורה
          </button>
          {hasUnsavedChanges && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "שומר…" : "שמור שינויים"}
              </button>
              <span className="text-sm text-amber-700">יש שינויים שלא נשמרו - הלקוחות עדיין רואים את המפה השמורה</span>
            </>
          )}
          {saveError && <span className="text-sm font-medium text-red-700">{saveError}</span>}
        </div>
      )}
      {(
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
                      cancelAreaDrawing();
                      exitLineMode();
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
                  setPlacingVideo(false);
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
              {mapImageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    closePopups();
                    setVideoPopup(null);
                    setPlacingNode(false);
                    setPlacingVideo((v) => !v);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    placingVideo ? "bg-cyan-600 text-white" : "border border-neutral-300 bg-white text-neutral-700"
                  }`}
                >
                  {placingVideo ? "ביטול הוספת סרטון" : "▶ הוספת סרטון"}
                </button>
              )}
              {placingVideo && <span className="text-sm text-cyan-700">לחצו על המפה במקום שצולם בסרטון</span>}
              <button
                type="button"
                onClick={() => {
                  closePopups();
                  setHideDepartments((v) => !v);
                }}
                aria-pressed={hideDepartments}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  hideDepartments ? "bg-cyan-600 text-white" : "border border-neutral-300 bg-white text-neutral-700"
                }`}
              >
                {hideDepartments ? "הצגת מחלקות" : "הסתרת מחלקות"}
              </button>
              <button
                type="button"
                onClick={() => setGrid((g) => ({ ...g, visible: !g.visible }))}
                aria-pressed={grid.visible}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  grid.visible ? "bg-cyan-600 text-white" : "border border-neutral-300 bg-white text-neutral-700"
                }`}
              >
                {grid.visible ? "הסתרת רשת" : "# רשת"}
              </button>
              {grid.visible && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1 text-sm text-neutral-700">
                  {(
                    [
                      ["cols", "קווי אורך"],
                      ["rows", "קווי רוחב"],
                    ] as const
                  ).map(([axis, label]) => (
                    <span key={axis} className="flex items-center gap-1.5">
                      <label htmlFor={`grid-${axis}`}>{label}</label>
                      <input
                        id={`grid-${axis}`}
                        type="range"
                        min={GRID_CELLS_MIN}
                        max={GRID_CELLS_MAX}
                        step={1}
                        value={grid[axis]}
                        onChange={(e) => setGrid((g) => ({ ...g, [axis]: Number(e.target.value) }))}
                        className="w-28 accent-cyan-600"
                      />
                      <span className="w-7 tabular-nums">{grid[axis]}</span>
                    </span>
                  ))}
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={grid.snap}
                      onChange={(e) => setGrid((g) => ({ ...g, snap: e.target.checked }))}
                      className="accent-cyan-600"
                    />
                    הצמדה לרשת
                  </label>
                  {grid.snap && <span className="text-xs text-neutral-500">(Alt למיקום חופשי)</span>}
                </div>
              )}
            </div>

            <p className="text-xs text-neutral-500">
              {editMode === "move"
                ? "גררו צומת כדי להזיז אותו · לחצו על צומת כדי לבחור אותו (מחלקה: שיוך מוצרים) · גררו על שטח ריק כדי לסמן כמה צמתים · Ctrl+לחיצה לבחירה מרובה · Esc לביטול בחירה"
                : "לחצו על המפה להוספת נקודת ציון · כשצומת נבחר, לחיצה על המפה מוסיפה נקודה ומחברת אליה (לחיצות ברצף = מסדרון) · לחצו על צומת ואז על צומת נוסף כדי לחבר ביניהם · \"הוספת מחלקה\" ואז לחיצה על המפה מוסיפה מחלקה/כניסה/קופה · Esc לביטול בחירה"}
            </p>

            {autoConnect && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm">
                {autoConnect.proposals.length === 0 && autoConnect.tooFar.length === 0 ? (
                  <span className="font-medium text-green-900">כל המחלקות כבר מחוברות - אין מה לחבר.</span>
                ) : (
                  <span className="font-medium text-green-900">
                    {autoConnect.proposals.length > 0
                      ? `הוצעו ${autoConnect.proposals.length} חיבורים (מקווקו ירוק). לחצו על חיבור כדי לבטל אותו או להחזיר אותו, ואז אשרו.`
                      : "לא נמצא מסדרון קרוב לאף מחלקה לא מחוברת."}
                  </span>
                )}
                {autoConnect.proposals.length > 0 && (
                  <button
                    type="button"
                    onClick={approveAutoConnect}
                    disabled={saving}
                    className="rounded-lg bg-green-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                  >
                    {`אישור (${autoConnect.proposals.length - autoConnect.rejected.size})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAutoConnect(null)}
                  disabled={saving}
                  className="text-green-800 hover:underline"
                >
                  {autoConnect.proposals.length > 0 ? "ביטול" : "סגירה"}
                </button>
                {autoConnect.tooFar.length > 0 && (
                  <span className="basis-full text-xs text-amber-800">
                    רחוקות מכל מסדרון, לא הוצע להן חיבור:{" "}
                    {autoConnect.tooFar.map((id) => nodeById.get(id)?.label.replace(/\s*\n\s*/g, " ") ?? id).join(" · ")}
                  </span>
                )}
                <span className="basis-full text-xs text-neutral-500">
                  לכל מחלקה (או כניסה/קופה) שאין לה אף חיבור, הוצע הקו הקצר אל המסדרון הקרוב - בניצב אליו. המערכת לא
                  רואה מדפים בתמונה, אז בדקו שאף חיבור לא עובר דרך מדף. Esc סוגר בלי לשמור.
                </span>
              </div>
            )}

            {resetMessage && (
              <p className="flex items-center justify-between gap-2 rounded-lg bg-neutral-100 p-2 text-sm text-neutral-700">
                {resetMessage}
                <button type="button" onClick={() => setResetMessage(null)} className="text-neutral-400 hover:text-neutral-700">
                  ✕
                </button>
              </p>
            )}

            {lineMode && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm">
                <span className="font-medium text-cyan-900">
                  {linePendingPoint
                    ? "לחצו על נקודת הסיום - הקו ממשיך ברצף (קליק ימני או Enter מסיימים את הרצף)"
                    : lineDraft.segments.length === 0
                      ? "1. לחצו על נקודת ההתחלה של הקו"
                      : "לחצו על נקודה בקו כדי להמשיך ממנה, או על צור קו לסיום"}
                </span>
                {lastLine && (
                  <button
                    type="button"
                    onClick={saveLines}
                    disabled={saving}
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                  >
                    {lineDraft.segments.length === 1 ? "צור קו" : `צור ${lineDraft.segments.length} קווים`}
                  </button>
                )}
                {lineDraft.points.length > 0 && !saving && (
                  <button
                    type="button"
                    onClick={() => setLineDraft(EMPTY_LINE_DRAFT)}
                    className="text-cyan-700 hover:underline"
                  >
                    ניקוי
                  </button>
                )}
                <span className="basis-full text-xs text-neutral-500">
                  נקודות הביניים נוצרות אוטומטית במרווח אחיד לפי אורך הקו. קו שקרוב לאופקי או לאנכי מתיישר לבד (Shift: זווית חופשית). הקצה נצמד לגובה/לרוחב של נקודות
                  אחרות (קו עזר ורוד) או לרשת; Alt: מיקום חופשי. לחיצה על צומת קיים מחברת את הקו אליו; לחיצה על
                  שטח ריק יוצרת שם נקודה חדשה. כל לחיצה ממשיכה את הרצף; קליק ימני או Enter מסיימים אותו, ולחיצה על
                  נקודה של קו (קצה או נקודת ביניים) מתחילה ממנה רצף חדש. כל הקווים נוצרים יחד בלחיצה על צור. לחיצה
                  נוספת על מחלקה שהקו מחובר אליה מבטלת את החיבור ומשאירה שם נקודת ציון. קליק ימני בלי רצף פעיל מבטל
                  את הקו האחרון, Esc מנקה הכל, Esc נוסף יוצא מהמצב. החצים במקלדת מזיזים את הקו האחרון במקביל לעצמו
                  (Shift: צעד גדול); קצה שלו שמחובר למחלקה או לקו קיים מתנתק וזז איתו. בלחיצה על צור, קו שנוגע בקו
                  הליכה קיים מתחבר אליו אוטומטית.
                </span>
              </div>
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

                {grid.visible && (
                  <g pointerEvents="none" stroke="#0e7490" strokeOpacity={0.35} strokeWidth={1}>
                    {Array.from({ length: grid.cols - 1 }, (_, i) => (
                      <line
                        key={`gx-${i}`}
                        x1={(i + 1) * gridSpacingX}
                        y1={0}
                        x2={(i + 1) * gridSpacingX}
                        y2={mapHeight}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {Array.from({ length: grid.rows - 1 }, (_, i) => (
                      <line
                        key={`gy-${i}`}
                        x1={0}
                        y1={(i + 1) * gridSpacingY}
                        x2={mapWidth}
                        y2={(i + 1) * gridSpacingY}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </g>
                )}

                {nodes.map((node) =>
                  node.type === "department" && node.area && node.id !== activeAreaDraft?.nodeId ? (
                    <polygon
                      key={`area-${node.id}`}
                      points={toSvgPoints(node.area)}
                      fill={AREA_FILL}
                      fillOpacity={selectedNodeIds.has(node.id) ? 0.4 : 0.15}
                      stroke={AREA_STROKE}
                      strokeOpacity={selectedNodeIds.has(node.id) ? 1 : 0.5}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  ) : null,
                )}

                {[...sharedShelves].map(([shelfId, members]) => (
                  <polyline
                    key={`shelf-${shelfId}`}
                    points={[...members]
                      .map((n) => (dragState?.nodeId === n.id ? { x: dragState.x, y: dragState.y } : n.position))
                      .sort((a, b) => a.x - b.x || a.y - b.y)
                      .map((p) => `${p.x * mapWidth},${p.y * mapHeight}`)
                      .join(" ")}
                    fill="none"
                    stroke={SHARED_SHELF_COLOR}
                    strokeWidth={3}
                    strokeDasharray="7 5"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                ))}

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
                  const isHiddenDepartment = hideDepartments && node.type === "department";
                  const radius = nodeRadius(isHiddenDepartment ? "waypoint" : node.type);
                  // A node a line being drawn starts or ends at shows as selected, so it's clear the line joins it.
                  const isSelected =
                    selectedNodeIds.has(node.id) ||
                    (lineMode && lineNodeIds.has(node.id));
                  // A hidden department is drawn as a waypoint-sized dot, but stays draggable and connectable.
                  const isDot = node.type === "waypoint" || isHiddenDepartment;

                  return (
                    <g
                      key={node.id}
                      data-node-id={node.id}
                      className="cursor-grab active:cursor-grabbing"
                      onPointerDown={(e) => handleNodePointerDown(e, node)}
                      onPointerMove={(e) => handleNodePointerMove(e, node)}
                      onPointerUp={(e) => handleNodePointerUp(e, node)}
                      onClick={(e) => handleNodeClick(e, node)}
                    >
                      {isDot ? (
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
                          // Entrance, exit and checkout at the size the shopper's app shows them.
                          {...(node.type === "entrance" || node.type === "exit" || node.type === "checkout"
                            ? { fontSize: MINOR_LABEL_FONT_FRACTION * mapWidth, mapWidth }
                            : {})}
                        />
                      )}
                    </g>
                  );
                })}

                {videos.map((video) => {
                  const isDragging = videoDrag?.videoId === video.id;
                  const pin = videoPositions[video.id] ?? video.position;
                  const x = (isDragging ? videoDrag!.x : pin.x) * mapWidth;
                  const y = (isDragging ? videoDrag!.y : pin.y) * mapHeight;
                  const r = VIDEO_PIN_RADIUS;
                  return (
                    <g
                      key={video.id}
                      className="cursor-pointer"
                      onPointerDown={(e) => handleVideoPointerDown(e, video)}
                      onPointerMove={(e) => handleVideoPointerMove(e, video)}
                      onPointerUp={(e) => handleVideoPointerUp(e, video)}
                    >
                      <title>{video.title}</title>
                      <circle cx={x} cy={y} r={r} fill="#dc2626" stroke="#ffffff" strokeWidth={3} />
                      <path
                        d={`M${x - r * 0.3} ${y - r * 0.42} L${x + r * 0.45} ${y} L${x - r * 0.3} ${y + r * 0.42} Z`}
                        fill="#ffffff"
                      />
                    </g>
                  );
                })}

                {shownGuides && (
                  <g pointerEvents="none" stroke={GUIDE_COLOR} strokeWidth={1.5} strokeDasharray="6 4">
                    {shownGuides.x !== undefined && (
                      <line
                        x1={shownGuides.x * mapWidth}
                        y1={0}
                        x2={shownGuides.x * mapWidth}
                        y2={mapHeight}
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {shownGuides.y !== undefined && (
                      <line
                        x1={0}
                        y1={shownGuides.y * mapHeight}
                        x2={mapWidth}
                        y2={shownGuides.y * mapHeight}
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </g>
                )}

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

                {activeAreaDraft && (
                  <g>
                    {activeAreaDraft.points.length >= 3 && (
                      <polygon
                        points={toSvgPoints(activeAreaDraft.points)}
                        fill={AREA_FILL}
                        fillOpacity={0.3}
                        stroke="none"
                        pointerEvents="none"
                      />
                    )}
                    <polyline
                      points={toSvgPoints(
                        areaPlacement ? [...activeAreaDraft.points, areaPlacement.point] : activeAreaDraft.points,
                      )}
                      fill="none"
                      stroke={AREA_STROKE}
                      strokeWidth={3}
                      strokeDasharray="8 5"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                    {activeAreaDraft.points.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x * mapWidth}
                        cy={p.y * mapHeight}
                        r={i === 0 && activeAreaDraft.points.length >= 3 ? AREA_CLOSE_DISTANCE * mapWidth : 6}
                        fill={i === 0 ? "#ffffff" : AREA_STROKE}
                        fillOpacity={i === 0 ? 0.8 : 1}
                        stroke={AREA_STROKE}
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                      />
                    ))}
                    {/* Over everything while drawing, so a click on a node or line adds a corner too. */}
                    <rect
                      x={0}
                      y={0}
                      width={mapWidth}
                      height={mapHeight}
                      fill="transparent"
                      className="cursor-crosshair"
                      onClick={handleAreaClick}
                      onPointerMove={(e) => {
                        setAreaCursor(screenToNormalized(e.clientX, e.clientY));
                        setShiftHeld(e.shiftKey);
                        setAltHeld(e.altKey);
                      }}
                      onPointerLeave={() => setAreaCursor(null)}
                    />
                  </g>
                )}
                {autoConnect && (
                  <g>
                    {/* Over the map, so clicks only toggle proposals while reviewing. */}
                    <rect x={0} y={0} width={mapWidth} height={mapHeight} fill="transparent" />
                    {autoConnect.proposals.map((p) => {
                      const rejected = autoConnect.rejected.has(p.nodeId);
                      const x1 = p.from.x * mapWidth;
                      const y1 = p.from.y * mapHeight;
                      const x2 = p.target.x * mapWidth;
                      const y2 = p.target.y * mapHeight;
                      return (
                        <g key={p.nodeId} className="cursor-pointer" onClick={() => toggleProposal(p.nodeId)}>
                          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={22} />
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={rejected ? DISCONNECTED_COLOR : PROPOSAL_COLOR}
                            strokeOpacity={rejected ? 0.45 : 1}
                            strokeWidth={4}
                            strokeDasharray="10 6"
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                          />
                          <circle
                            cx={x2}
                            cy={y2}
                            r={7}
                            fill={rejected ? "#ffffff" : PROPOSAL_COLOR}
                            stroke={rejected ? DISCONNECTED_COLOR : "#ffffff"}
                            strokeWidth={2}
                          />
                        </g>
                      );
                    })}
                  </g>
                )}

                {lineMode && (
                  <g>
                    {lineDraft.segments.map((segment, s) => {
                      const a = pointByKey(lineDraft, segment.from);
                      const b = pointByKey(lineDraft, segment.to);
                      if (!a || !b) return null;
                      return (
                        <g key={`${segment.from}-${segment.to}-${s}`} pointerEvents="none">
                          <line
                            x1={a.x * mapWidth}
                            y1={a.y * mapHeight}
                            x2={b.x * mapWidth}
                            y2={b.y * mapHeight}
                            stroke={LINE_COLOR}
                            strokeWidth={3}
                            vectorEffect="non-scaling-stroke"
                          />
                          {innerPoints(a, b, segment.count).map((p, i) => (
                            <circle
                              key={i}
                              cx={p.x * mapWidth}
                              cy={p.y * mapHeight}
                              r={6}
                              fill={LINE_COLOR}
                              stroke="#ffffff"
                              strokeWidth={1.5}
                            />
                          ))}
                        </g>
                      );
                    })}
                    {/* On a line: a ring where the new point will be added on it. */}
                    {lineTarget && (lineTarget.kind === "edge" || lineTarget.kind === "draftLine") && (
                      <circle
                        cx={lineTarget.point.x * mapWidth}
                        cy={lineTarget.point.y * mapHeight}
                        r={9}
                        fill="#ffffff"
                        fillOpacity={0.7}
                        stroke={GUIDE_COLOR}
                        strokeWidth={3}
                        pointerEvents="none"
                      />
                    )}
                    {linePendingPoint && lineEndPreview && (
                      <line
                        x1={linePendingPoint.x * mapWidth}
                        y1={linePendingPoint.y * mapHeight}
                        x2={lineEndPreview.x * mapWidth}
                        y2={lineEndPreview.y * mapHeight}
                        stroke={LINE_COLOR}
                        strokeWidth={3}
                        strokeDasharray="8 5"
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                      />
                    )}
                    {lineDraft.points.map((p) => (
                      <circle
                        key={p.key}
                        cx={p.x * mapWidth}
                        cy={p.y * mapHeight}
                        r={p.nodeId ? 18 : p.key === lineDraft.pendingFrom ? 10 : 8}
                        fill={p.nodeId ? "none" : LINE_COLOR}
                        stroke={p.nodeId ? LINE_COLOR : p.key === lineDraft.pendingFrom ? "#facc15" : "#ffffff"}
                        strokeWidth={p.nodeId ? 4 : p.key === lineDraft.pendingFrom ? 3 : 2}
                        pointerEvents="none"
                      />
                    ))}
                    {/* Over everything, so a click on a node becomes a line end instead of a selection. */}
                    <rect
                      x={0}
                      y={0}
                      width={mapWidth}
                      height={mapHeight}
                      fill="transparent"
                      className="cursor-crosshair"
                      onClick={handleLineClick}
                      // Right click (instead of the browser's menu) drops the line being stretched,
                      // or with none, the line drawn last.
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (saving) return;
                        setLineDraft(lineDraft.pendingFrom ? cancelPending(lineDraft) : removeLastSegment(lineDraft));
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerMove={(e) => {
                        setLineCursor({ ...screenToNormalized(e.clientX, e.clientY), clientX: e.clientX, clientY: e.clientY });
                        setAltHeld(e.altKey);
                        setShiftHeld(e.shiftKey);
                      }}
                      onPointerLeave={() => setLineCursor(null)}
                    />
                  </g>
                )}
              </svg>

              {videoPopup && (
                <MapVideoUploadPopup
                  storeId={storeId}
                  {...videoPopup}
                  addMapVideo={addMapVideo}
                  onClose={() => setVideoPopup(null)}
                />
              )}

              {addPopup && (
                <div
                  style={{ left: addPopup.screenLeft, top: addPopup.screenTop }}
                  className="absolute z-10 flex w-56 -translate-x-1/2 flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg"
                >
                  <form action={addNodeFromPopup} className="flex flex-col gap-2">
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

            {/* Under the map: these come and go with each edit, and mustn't move it mid-drawing. */}
            {!hasEntrance && nodes.length > 0 && (
              <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
                אין כניסה במפה - בלי כניסה אי אפשר לבנות מסלול. הוסיפו צומת מסוג כניסה.
              </p>
            )}
            {entranceCount > 1 && (
              <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
                יש במפה {entranceCount} צמתים מסוג כניסה - מסלול יוצא רק מאחד מהם, אז השאירו כניסה אחת. ליציאה מהחנות
                יש סוג משלה: &quot;יציאה&quot;.
              </p>
            )}
            {disconnectedNodeIds.size > 0 && (
              <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
                {disconnectedNodeIds.size === 1 ? "צומת אחד" : `${disconnectedNodeIds.size} צמתים`} שמסלול מהכניסה לא
                יכול להגיע אליהם (מסלול לא ממשיך הלאה מקופה או מיציאה). הם מסומנים באדום - חברו אותם במצב &quot;הוספה
                וחיבור&quot;.
              </p>
            )}
          </div>

          {playingVideo && (
            <MapVideoPlayer video={playingVideo} deleteMapVideo={deleteMapVideo} onClose={() => setPlayingVideoId(null)} />
          )}

          {singleSelectedNode && !showsProductPanel && (
            <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3">
              <span className="text-sm text-neutral-700">
                נבחר: <strong>{singleSelectedNode.label}</strong> ({NODE_TYPE_LABELS[singleSelectedNode.type]})
              </span>
              <button
                type="button"
                onClick={() => deleteFromMap([singleSelectedNode.id], [])}
                className="text-sm text-red-600 hover:underline"
              >
                מחק צומת
              </button>
            </div>
          )}

          {singleSelectedNode && showsProductPanel && (
            <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
              <form
                key={`${singleSelectedNode.id}:${singleSelectedNode.label}`}
                action={(formData) => renameNode(singleSelectedNode.id, formData)}
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
                  עדכן שם
                </button>
                <span className="text-xs text-neutral-400">{NODE_TYPE_LABELS[singleSelectedNode.type]}</span>
              </form>

              <div className="flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50 p-2 text-sm">
                {activeAreaDraft ? (
                  <>
                    <p className="text-sky-900">
                      לחצו על המפה בפינות האזור, אחת אחרי השנייה. לסיום - לחצו שוב על הנקודה הראשונה או על
                      &quot;סיום&quot; · Esc לביטול ({activeAreaDraft.points.length} נקודות)
                    </p>
                    <p className="text-xs text-sky-800">
                      הפינה נוצרת בדיוק במקום הלחיצה. צלע שקרובה מאוד לאופקי או לאנכי מתיישרת לבד (Shift: בלי
                      יישור).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={activeAreaDraft.points.length < 3 || saving}
                        onClick={() => saveArea(activeAreaDraft.nodeId, activeAreaDraft.points)}
                        className="rounded-lg bg-sky-600 px-3 py-1 font-semibold text-white disabled:opacity-40"
                      >
                        סיום
                      </button>
                      <button
                        type="button"
                        disabled={activeAreaDraft.points.length === 0 || saving}
                        onClick={undoAreaPoint}
                        className="rounded-lg border border-sky-300 bg-white px-3 py-1 text-sky-800 disabled:opacity-40"
                      >
                        ביטול נקודה אחרונה
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={cancelAreaDrawing}
                        className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-neutral-600"
                      >
                        ביטול
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sky-900">אזור המחלקה:</span>
                    <span className="text-sky-800">
                      {singleSelectedNode.area ? "מוגדר - יואר בתכלת כשהלקוח צריך להגיע לכאן" : "לא מוגדר"}
                    </span>
                    <button
                      type="button"
                      onClick={() => startAreaDrawing(singleSelectedNode.id)}
                      className="rounded-lg bg-sky-600 px-3 py-1 font-semibold text-white"
                    >
                      {singleSelectedNode.area ? "סימון מחדש" : "סימון אזור"}
                    </button>
                    {singleSelectedNode.area && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveArea(singleSelectedNode.id, null)}
                        className="text-red-600 hover:underline disabled:opacity-40"
                      >
                        מחיקת אזור
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 p-2 text-sm">
                <span className="font-semibold text-violet-900">אותו מדף:</span>
                {shelfMates.length > 0 ? (
                  <>
                    <span className="text-violet-800">
                      {shelfMates.map((n) => n.label.replace(/\s*\n\s*/g, " ")).join(" · ")}
                    </span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => takeOffShelf([singleSelectedNode.id])}
                      className="text-red-600 hover:underline disabled:opacity-40"
                    >
                      הוצאה מהמדף המשותף
                    </button>
                  </>
                ) : (
                  <span className="text-violet-800">לא מסומן. כדי לחבר מחלקות: Ctrl+לחיצה על כל אחת מהן</span>
                )}
              </div>

              {splitHere.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                  <p className="font-semibold">⚠ כינויים בנקודה זו שממוקמים גם בנקודות אחרות ({splitHere.length})</p>
                  <ul className="mt-1 flex max-h-60 flex-col divide-y divide-amber-200 overflow-y-auto">
                    {splitHere.map((split) => (
                      <li key={split.alias} className="flex flex-col gap-1 py-1.5">
                        <span>
                          <strong>{split.alias}</strong> ({split.count} כאן) - גם ב:{" "}
                          {split.elsewhere.map((n) => `${n.label} (${n.count})`).join(" · ")}
                        </span>
                        <span className="flex flex-wrap gap-1.5">
                          {split.elsewhere.map((n) => (
                            <button
                              key={n.nodeId}
                              type="button"
                              disabled={movingAlias !== null}
                              onClick={() => moveSplitAlias(split.alias, n.nodeId)}
                              title={`להעביר את ${split.count} הפריטים עם הכינוי "${split.alias}" מכאן ל${n.label}`}
                              className="rounded-md border border-amber-500 bg-white px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40"
                            >
                              {movingAlias === split.alias ? "מעביר..." : `העבר ${split.count} ל${n.label} ←`}
                            </button>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isUnsavedNode ? (
                <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
                  המחלקה עדיין בטיוטה. לחצו על &quot;שמור שינויים&quot; כדי לשייך אליה מוצרים.
                </p>
              ) : (
                <>
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

              <ProductAutocomplete
                key={singleSelectedNode.id}
                storeId={storeId}
                nodeId={singleSelectedNode.id}
                departmentNodes={departmentNodes}
                onAdd={async (productId) => {
                  const formData = new FormData();
                  formData.set("productId", productId);
                  await addProductToNode(storeId, singleSelectedNode.id, formData);
                }}
              />

              <ShelfGroupPanel
                key={`groups-${singleSelectedNode.id}`}
                storeId={storeId}
                nodeId={singleSelectedNode.id}
                departmentNodes={departmentNodes}
                groupsHere={groupsAtNode}
                splitAliases={splitAliasesHere}
                groupOptions={shelfGroups.filter((g) => g.unplaced > 0)}
                hasPriceBranch={hasPriceBranch}
                canEditProducts={canEditProducts}
                placeShelfGroupOnNode={placeShelfGroupOnNode}
                addProductToNode={addProductToNode}
                removeShelfGroupFromNode={removeShelfGroupFromNode}
                moveProductsToNode={moveProductsToNode}
                removeProductsFromNode={removeProductsFromNode}
                markProductsNotSold={markProductsNotSold}
                setProductsShelfGroup={setProductsShelfGroup}
              />

              {hasPriceBranch && (
                <AliasPlacePanel
                  key={`alias-${singleSelectedNode.id}`}
                  storeId={storeId}
                  nodeId={singleSelectedNode.id}
                  departmentNodes={departmentNodes}
                  canEditProducts={canEditProducts}
                  placeAliasOnNode={placeAliasOnNode}
                  addProductToNode={addProductToNode}
                  moveProductsToNode={moveProductsToNode}
                />
              )}
                </>
              )}

              <button
                type="button"
                onClick={() => deleteFromMap([singleSelectedNode.id], [])}
                className="self-start text-sm text-red-600 hover:underline"
              >
                מחק צומת
              </button>
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
              <button
                type="button"
                onClick={() => deleteFromMap([], [singleSelectedEdge.id])}
                className="text-sm text-red-600 hover:underline"
              >
                מחק קשת
              </button>
            </div>
          )}

          {totalSelected > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-3">
              <span className="text-sm text-neutral-700">
                נבחרו{" "}
                {selectedNodeIds.size > 0 && <strong>{selectedNodeIds.size} צמתים</strong>}
                {selectedNodeIds.size > 0 && selectedEdgeIds.size > 0 && " ו-"}
                {selectedEdgeIds.size > 0 && <strong>{selectedEdgeIds.size} קשתות</strong>}
              </span>
              {selectedNodeIds.size >= 2 && (
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["row", "⇔ יישור לשורה"],
                      ["column", "⇕ יישור לעמודה"],
                      ["distribute", "↔ פיזור שווה"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={saving || (mode === "distribute" && selectedNodeIds.size < 3)}
                      onClick={() => handleAlign(mode)}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-sm font-medium text-neutral-700 hover:border-cyan-600 hover:text-cyan-700 disabled:opacity-40"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {selectedDepartments.length >= 2 &&
                (selectedAreOneShelf ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-violet-800">מסומנות כאותו מדף</span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => takeOffShelf(selectedDepartments.map((n) => n.id))}
                      className="text-red-600 hover:underline disabled:opacity-40"
                    >
                      ביטול הסימון
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={markSelectedAsOneShelf}
                    title="הלקוח יישלח לשם ויחליט מול המדף, בלי שאלה מראש"
                    className="rounded-lg bg-violet-600 px-3 py-1 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
                  >
                    סימון {selectedDepartments.length} מחלקות כאותו מדף
                  </button>
                ))}
              <button
                type="button"
                onClick={handleDeleteSelected}
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
