"use client";

import { useRef, useState } from "react";
import type { MapEdge } from "@/src/domain/entities/map-edge";
import type { MapNode, MapNodeType } from "@/src/domain/entities/map-node";
import type { Product } from "@/src/domain/entities/product";
import type { ProductListing } from "@/src/domain/entities/product-listing";
import { distanceBetweenNodes } from "@/src/domain/value-objects/geo-point";
import { NODE_TYPE_LABELS } from "@/src/presentation/node-type-labels";
import { findProductIcon, type ProductIcon } from "@/src/presentation/product-icons";
import { MultilineSvgText } from "../map/MultilineSvgText";
import { ProductIconSidebar } from "./ProductIconSidebar";

interface StoreLayoutEditorProps {
  storeId: string;
  mapWidth: number;
  mapHeight: number;
  mapImageUrl: string;
  nodes: MapNode[];
  edges: MapEdge[];
  nodeTypes: MapNodeType[];
  productIcons: ProductIcon[];
  products: Product[];
  listings: ProductListing[];
  createNode: (formData: FormData) => Promise<void>;
  createEdge: (formData: FormData) => Promise<void>;
  deleteNode: (storeId: string, nodeId: string) => Promise<void>;
  deleteEdge: (storeId: string, edgeId: string) => Promise<void>;
  updateNodePosition: (nodeId: string, x: number, y: number) => Promise<void>;
  updateNodeIcon: (nodeId: string, iconKey: string) => Promise<void>;
  updateNodeLabel: (storeId: string, nodeId: string, formData: FormData) => Promise<void>;
  addProductToNode: (storeId: string, nodeId: string, formData: FormData) => Promise<void>;
  removeProductFromNode: (storeId: string, nodeId: string, productId: string) => Promise<void>;
  uploadStoreImage: (formData: FormData) => Promise<void>;
}

const ICON_DROP_HIT_RADIUS_PX = 26;

const NODE_COLORS: Record<MapNodeType, string> = {
  entrance: "#2563eb",
  checkout: "#7c3aed",
  waypoint: "#9ca3af",
  department: "#059669",
};

function nodeRadius(type: MapNodeType): number {
  if (type === "waypoint") return 8;
  if (type === "entrance" || type === "checkout") return 24;
  return 18;
}

const DRAG_THRESHOLD_PX = 6;

interface AddNodePopup {
  screenLeft: number;
  screenTop: number;
  normX: number;
  normY: number;
  presetLabel?: string;
  presetIconKey?: string;
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
  productIcons,
  products,
  listings,
  createNode,
  createEdge,
  deleteNode,
  deleteEdge,
  updateNodePosition,
  updateNodeIcon,
  updateNodeLabel,
  addProductToNode,
  removeProductFromNode,
  uploadStoreImage,
}: StoreLayoutEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStartRef = useRef<{ nodeId: string; clientX: number; clientY: number; moved: boolean } | null>(
    null,
  );
  const justDraggedRef = useRef(false);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [addPopup, setAddPopup] = useState<AddNodePopup | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());

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

  function normalizedToScreen(normX: number, normY: number): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = normX * mapWidth;
    point.y = normY * mapHeight;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = point.matrixTransform(ctm);
    return { x: transformed.x, y: transformed.y };
  }

  function containerOffset(clientX: number, clientY: number): { left: number; top: number } {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { left: 0, top: 0 };
    return { left: clientX - rect.left, top: clientY - rect.top };
  }

  function handleIconDropped(icon: ProductIcon, clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const svgRect = svg.getBoundingClientRect();
    const isOverCanvas =
      clientX >= svgRect.left && clientX <= svgRect.right && clientY >= svgRect.top && clientY <= svgRect.bottom;
    if (!isOverCanvas) return;

    let nearestNode: MapNode | null = null;
    let nearestDist = Infinity;
    for (const node of nodes) {
      const screen = normalizedToScreen(node.position.x, node.position.y);
      const dist = Math.hypot(screen.x - clientX, screen.y - clientY);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestNode = node;
      }
    }

    if (nearestNode && nearestDist <= ICON_DROP_HIT_RADIUS_PX) {
      void updateNodeIcon(nearestNode.id, icon.key);
      return;
    }

    const { x, y } = screenToNormalized(clientX, clientY);
    const { left, top } = containerOffset(clientX, clientY);
    closePopups();
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    setAddPopup({
      screenLeft: left,
      screenTop: top,
      normX: x,
      normY: y,
      presetLabel: icon.labelHe,
      presetIconKey: icon.key,
      presetType: icon.defaultNodeType,
    });
  }

  function closePopups() {
    setAddPopup(null);
  }

  function handleBackgroundClick(e: React.MouseEvent) {
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    const { x, y } = screenToNormalized(e.clientX, e.clientY);
    const { left, top } = containerOffset(e.clientX, e.clientY);
    setAddPopup({ screenLeft: left, screenTop: top, normX: x, normY: y });
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
    if (selectedNodeIds.size === 1 && selectedEdgeIds.size === 0 && !selectedNodeIds.has(node.id)) {
      const fromNodeId = Array.from(selectedNodeIds)[0];
      const formData = new FormData();
      formData.set("fromNodeId", fromNodeId);
      formData.set("toNodeId", node.id);
      formData.set("bidirectional", "on");
      void createEdge(formData);
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
      <p className="text-xs text-neutral-500">
        לחצו על שטח ריק להוספת צומת · גררו צומת קיים כדי להזיז אותו · לחצו על צומת ואז על צומת נוסף כדי לחבר ביניהם
        קשת מיידית · לחצו על צומת/קשת כדי לבחור · גררו אייקון מהרשימה כדי להוסיף/לעדכן צומת · Ctrl+לחיצה לבחירה מרובה
      </p>

      <div className="flex flex-col gap-3">
        <ProductIconSidebar icons={productIcons} onIconDropped={handleIconDropped} />

        <div ref={containerRef} className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            className="h-auto w-full rounded-2xl border border-neutral-200 bg-white touch-none"
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
              />
            ) : (
              <>
                <rect x={0} y={0} width={mapWidth} height={mapHeight} fill="#f3f4f6" onClick={handleBackgroundClick} />
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
              const icon = findProductIcon(node.iconKey);

              return (
                <g
                  key={node.id}
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => handleNodePointerDown(e, node)}
                  onPointerMove={(e) => handleNodePointerMove(e, node)}
                  onPointerUp={(e) => void handleNodePointerUp(e, node)}
                  onClick={(e) => handleNodeClick(e, node)}
                >
                  {isSelected && (
                    <circle cx={x} cy={y} r={radius + 6} fill="none" stroke="#059669" strokeWidth={3} />
                  )}
                  {icon ? (
                    <>
                      <clipPath id={`node-clip-${node.id}`}>
                        <circle cx={x} cy={y} r={radius} />
                      </clipPath>
                      <circle cx={x} cy={y} r={radius} fill="#f3f4f6" />
                      <image
                        href={icon.src}
                        x={x - radius}
                        y={y - radius}
                        width={radius * 2}
                        height={radius * 2}
                        clipPath={`url(#node-clip-${node.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                      <circle cx={x} cy={y} r={radius} fill="none" stroke="#ffffff" strokeWidth={2} />
                    </>
                  ) : (
                    <circle cx={x} cy={y} r={radius} fill={NODE_COLORS[node.type]} />
                  )}
                  <MultilineSvgText
                    text={node.label}
                    x={x}
                    y={y + radius + 18}
                    lineHeight={21}
                    textAnchor="middle"
                    fontSize={18}
                    fontWeight={600}
                    fill="#111827"
                    stroke="white"
                    strokeWidth={3.5}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                  />
                </g>
              );
            })}
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
                <input type="hidden" name="iconKey" value={addPopup.presetIconKey ?? ""} />
                {addPopup.presetIconKey && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={findProductIcon(addPopup.presetIconKey)?.src}
                    alt=""
                    className="mx-auto h-10 w-10 rounded-full object-cover"
                  />
                )}
                <input
                  name="label"
                  placeholder="תווית (חובה למחלקה בלבד)"
                  autoFocus
                  defaultValue={addPopup.presetLabel ?? ""}
                  className="rounded-lg border border-neutral-300 p-1.5 text-sm"
                />
                <select
                  name="type"
                  defaultValue={addPopup.presetType ?? (addPopup.presetIconKey ? "department" : undefined)}
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
            <form action={addProductToNode.bind(null, storeId, singleSelectedNode.id)} className="flex gap-2">
              <select name="productId" required className="flex-1 rounded-lg border border-neutral-300 p-1.5 text-sm">
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.canonicalName} ({product.department})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
              >
                הוסף
              </button>
            </form>
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
    </section>
  );
}
