"use client";

import { useEffect, useRef, useState } from "react";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import type { GeoPoint } from "@smartroute/core/domain/value-objects/geo-point";
import { detectFloor } from "@smartroute/core/map/walkable/detect-floor";
import { type NavGraph, generateNavGraph } from "@smartroute/core/map/walkable/generate-graph";
import {
  type StoredWalkableMask,
  type WalkableMask,
  cloneMask,
  decodeRle,
  encodeRle,
  normalizedToCell,
  paintStroke,
} from "@smartroute/core/map/walkable/mask";
import type { WalkableMapSaveResult } from "@/src/presentation/actions/admin-store-actions";

interface WalkableAreaEditorProps {
  mapWidth: number;
  mapHeight: number;
  mapImageUrl: string;
  /** Same image, but readable by a canvas (same-origin). */
  pixelSourceUrl: string;
  nodes: MapNode[];
  initialMask: StoredWalkableMask | null;
  saveWalkableMap: (mask: StoredWalkableMask) => Promise<WalkableMapSaveResult>;
  onClose: () => void;
}

type Tool = "seed" | "walkable" | "blocked";

interface ImagePixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const MAX_UNDO = 20;
const ANCHOR_COLORS: Record<string, string> = {
  entrance: "#2563eb",
  checkout: "#7c3aed",
  department: "#059669",
  waypoint: "#059669",
};

/**
 * "Walkable area" mode of the store layout editor: the admin clicks once on the floor, the floor
 * is detected from the photo's colors, they fix mistakes with a brush, and saving regenerates all
 * waypoints and edges from the mask (see packages/core/map/walkable).
 */
export function WalkableAreaEditor({
  mapWidth,
  mapHeight,
  mapImageUrl,
  pixelSourceUrl,
  nodes,
  initialMask,
  saveWalkableMap,
  onClose,
}: WalkableAreaEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [initialDecodedMask] = useState(() => (initialMask ? decodeRle(initialMask) : null));
  const maskRef = useRef<WalkableMask | null>(initialDecodedMask);
  const [hasMask, setHasMask] = useState(initialDecodedMask !== null);
  const undoStackRef = useRef<WalkableMask[]>([]);
  const strokeRef = useRef<{ row: number; col: number } | null>(null);
  const overlayFrameRef = useRef<number | null>(null);

  const [pixels, setPixels] = useState<ImagePixels | null>(null);
  const [pixelError, setPixelError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>(initialMask ? "walkable" : "seed");
  const [brushRadius, setBrushRadius] = useState(4);
  const [sensitivity, setSensitivity] = useState(1);
  const [seed, setSeed] = useState<GeoPoint | null>(null);
  const [maskVersion, setMaskVersion] = useState(0);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(true);
  const [preview, setPreview] = useState<NavGraph | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<WalkableMapSaveResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const anchors = nodes.filter((n) => n.type !== "waypoint");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(pixelSourceUrl);
        if (!response.ok) throw new Error(String(response.status));
        const bitmap = await createImageBitmap(await response.blob());
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        if (!cancelled) setPixels({ data: imageData.data, width: bitmap.width, height: bitmap.height });
      } catch {
        if (!cancelled) setPixelError("לא ניתן לקרוא את תמונת המפה לזיהוי אוטומטי (קבצי SVG אינם נתמכים). אפשר עדיין לצייר במברשת.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pixelSourceUrl]);

  function redrawOverlay() {
    if (overlayFrameRef.current !== null) return;
    overlayFrameRef.current = requestAnimationFrame(() => {
      overlayFrameRef.current = null;
      const mask = maskRef.current;
      if (!mask) {
        setOverlayUrl(null);
        return;
      }
      const canvas = overlayCanvasRef.current ?? document.createElement("canvas");
      overlayCanvasRef.current = canvas;
      canvas.width = mask.cols;
      canvas.height = mask.rows;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const image = ctx.createImageData(mask.cols, mask.rows);
      for (let i = 0; i < mask.data.length; i++) {
        const walkable = mask.data[i] === 1;
        image.data[i * 4] = walkable ? 0 : 220;
        image.data[i * 4 + 1] = walkable ? 170 : 40;
        image.data[i * 4 + 2] = walkable ? 170 : 40;
        image.data[i * 4 + 3] = walkable ? 100 : 70;
      }
      ctx.putImageData(image, 0, 0);
      setOverlayUrl(canvas.toDataURL());
    });
  }

  // Redraw on every committed mask change (detection, stroke end, undo).
  useEffect(() => {
    redrawOverlay();
  }, [maskVersion]);

  // The graph preview runs the same generator the server runs on save.
  useEffect(() => {
    if (!showGraph || !maskRef.current) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      const mask = maskRef.current;
      if (!mask) return;
      setPreview(
        generateNavGraph(
          mask,
          anchors.map((n) => ({ id: n.id, position: n.position, isEntrance: n.type === "entrance" })),
        ),
      );
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maskVersion, showGraph, nodes]);

  function commitMask(next: WalkableMask | null, pushUndo = true) {
    if (pushUndo && maskRef.current) {
      undoStackRef.current.push(cloneMask(maskRef.current));
      if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift();
    }
    maskRef.current = next;
    setHasMask(next !== null);
    setSaveResult(null);
    setMaskVersion((v) => v + 1);
  }

  function undo() {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    commitMask(previous, false);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function detect(at: GeoPoint, withSensitivity: number) {
    if (!pixels) return;
    commitMask(detectFloor(pixels.data, pixels.width, pixels.height, at, { sensitivity: withSensitivity }));
  }

  function screenToNormalized(clientX: number, clientY: number): GeoPoint {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const t = point.matrixTransform(ctm.inverse());
    return { x: Math.max(0, Math.min(1, t.x / mapWidth)), y: Math.max(0, Math.min(1, t.y / mapHeight)) };
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    const point = screenToNormalized(e.clientX, e.clientY);
    if (tool === "seed") {
      setSeed(point);
      detect(point, sensitivity);
      return;
    }
    const mask = maskRef.current;
    if (!mask) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    undoStackRef.current.push(cloneMask(mask));
    if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift();
    const cell = normalizedToCell(mask, point);
    paintStroke(mask, cell, cell, brushRadius, tool === "walkable" ? 1 : 0);
    strokeRef.current = cell;
    redrawOverlay();
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const last = strokeRef.current;
    const mask = maskRef.current;
    if (!last || !mask) return;
    const cell = normalizedToCell(mask, screenToNormalized(e.clientX, e.clientY));
    paintStroke(mask, last, cell, brushRadius, tool === "walkable" ? 1 : 0);
    strokeRef.current = cell;
    redrawOverlay();
  }

  function handlePointerUp() {
    if (!strokeRef.current) return;
    strokeRef.current = null;
    setSaveResult(null);
    setMaskVersion((v) => v + 1);
  }

  async function handleSave() {
    const mask = maskRef.current;
    if (!mask) return;
    const ok = window.confirm(
      "השמירה תחליף את כל נקודות הציון והקשתות הקיימות בסניף בגרף שנוצר מהשטח העביר. מחלקות, כניסה וקופות יישארו. להמשיך?",
    );
    if (!ok) return;
    setSaving(true);
    setSaveError(null);
    try {
      setSaveResult(await saveWalkableMap(encodeRle(mask)));
    } catch (error) {
      console.error(error);
      setSaveError("השמירה נכשלה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  const previewPositions = new Map<string, GeoPoint>(anchors.map((n) => [n.id, n.position]));
  preview?.waypoints.forEach((w) => previewPositions.set(w.key, w.position));
  const unreachableIds = new Set(preview?.unreachableAnchorIds ?? []);
  const unitScale = Math.max(mapWidth, mapHeight) / 1000;
  const toolButton = (value: Tool, label: string) => (
    <button
      type="button"
      onClick={() => setTool(value)}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        tool === value ? "bg-cyan-600 text-white" : "border border-neutral-300 bg-white text-neutral-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          {toolButton("seed", "1. לחצו על הרצפה לזיהוי")}
          {toolButton("walkable", "מברשת: עביר")}
          {toolButton("blocked", "מברשת: חסום")}
          <button
            type="button"
            onClick={undo}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700"
          >
            בטל (Ctrl+Z)
          </button>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={showGraph} onChange={(e) => setShowGraph(e.target.checked)} />
            הצג גרף שייווצר
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-sm text-neutral-700">
          <label className="flex items-center gap-2">
            רגישות זיהוי
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              onPointerUp={() => seed && detect(seed, sensitivity)}
              onKeyUp={() => seed && detect(seed, sensitivity)}
            />
            <span className="w-8 tabular-nums">{sensitivity.toFixed(1)}</span>
          </label>
          <label className="flex items-center gap-2">
            גודל מברשת
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={brushRadius}
              onChange={(e) => setBrushRadius(Number(e.target.value))}
            />
            <span className="w-8 tabular-nums">{brushRadius}</span>
          </label>
        </div>
        <p className="text-xs text-neutral-500">
          טורקיז = אפשר ללכת · אדום = חסום. לחצו פעם אחת על הרצפה כדי לזהות אותה אוטומטית, ותקנו במברשת אזורים
          שזוהו לא נכון (למשל דלתות כניסה). מחלקות, כניסה וקופות מתחברות אוטומטית לנקודה העבירה הקרובה.
        </p>
        {pixelError && <p className="text-sm text-amber-700">{pixelError}</p>}
        {!pixels && !pixelError && <p className="text-sm text-neutral-500">טוען את תמונת המפה…</p>}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
        className={`h-auto w-full select-none rounded-2xl border border-neutral-200 bg-white touch-none ${
          tool === "seed" ? "cursor-crosshair" : "cursor-cell"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {mapImageUrl && (
          <image href={mapImageUrl} x={0} y={0} width={mapWidth} height={mapHeight} preserveAspectRatio="xMidYMid slice" />
        )}
        {overlayUrl && hasMask && (
          <image
            href={overlayUrl}
            x={0}
            y={0}
            width={mapWidth}
            height={mapHeight}
            preserveAspectRatio="none"
            style={{ imageRendering: "pixelated" }}
          />
        )}
        {preview && (
          <g pointerEvents="none">
            {preview.edges.map((edge, i) => {
              const a = previewPositions.get(edge.from);
              const b = previewPositions.get(edge.to);
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x * mapWidth}
                  y1={a.y * mapHeight}
                  x2={b.x * mapWidth}
                  y2={b.y * mapHeight}
                  stroke="#0e5a6e"
                  strokeWidth={2 * unitScale}
                />
              );
            })}
            {preview.waypoints.map((w) => (
              <circle
                key={w.key}
                cx={w.position.x * mapWidth}
                cy={w.position.y * mapHeight}
                r={4 * unitScale}
                fill="#f59e0b"
                stroke="white"
                strokeWidth={1}
              />
            ))}
          </g>
        )}
        <g pointerEvents="none">
          {anchors.map((n) => {
            const size = 11 * unitScale;
            const x = n.position.x * mapWidth;
            const y = n.position.y * mapHeight;
            return (
              <rect
                key={n.id}
                x={x - size}
                y={y - size}
                width={size * 2}
                height={size * 2}
                rx={size * 0.3}
                fill={unreachableIds.has(n.id) ? "#dc2626" : ANCHOR_COLORS[n.type]}
                stroke="white"
                strokeWidth={2}
              />
            );
          })}
        </g>
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3">
        <div className="text-sm text-neutral-700">
          {preview ? (
            <>
              ייווצרו <strong>{preview.waypoints.length}</strong> נקודות ציון ו-<strong>{preview.edges.length}</strong>{" "}
              קשתות.
              {preview.unreachableAnchorIds.length > 0 && (
                <span className="text-red-700">
                  {" "}
                  לא נגישים מהכניסה (מסומנים באדום):{" "}
                  {anchors
                    .filter((n) => unreachableIds.has(n.id))
                    .map((n) => n.label)
                    .join(", ")}
                </span>
              )}
            </>
          ) : hasMask ? (
            "מחשב גרף…"
          ) : (
            "עדיין אין שטח עביר - לחצו על הרצפה במפה."
          )}
          {saveResult && (
            <p className="mt-1 text-emerald-700">
              נשמר: {saveResult.waypointCount} נקודות ציון ו-{saveResult.edgeCount} קשתות.
              {saveResult.unreachable.length > 0 &&
                ` שימו לב - לא נגישים: ${saveResult.unreachable.map((u) => u.label).join(", ")}`}
            </p>
          )}
          {saveError && <p className="mt-1 text-red-700">{saveError}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
          >
            חזרה לעריכת הפריסה
          </button>
          <button
            type="button"
            disabled={!hasMask || saving}
            onClick={() => void handleSave()}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "שומר…" : "שמור וצור מסלולים"}
          </button>
        </div>
      </div>
    </div>
  );
}
