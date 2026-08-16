"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MapNodeType } from "@/src/domain/entities/map-node";
import {
  edgeRepository,
  nodeRepository,
  productListingRepository,
  promotionRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import { readImageDimensions } from "@/src/infrastructure/image-dimensions";
import { saveUploadedImage } from "@/src/infrastructure/image-upload";
import { NODE_TYPE_LABELS } from "@/src/presentation/node-type-labels";

export async function createStore(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const chainId = String(formData.get("chainId") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const mapWidth = Number(formData.get("mapWidth") ?? 1000);
  const mapHeight = Number(formData.get("mapHeight") ?? 1000);
  if (!name || !chainId) return;

  const now = new Date().toISOString();
  const store = await storeRepository.create({
    id: crypto.randomUUID(),
    chainId,
    name,
    address,
    city,
    mapImageUrl: "",
    mapWidth,
    mapHeight,
    isActive: true,
    promotionsEnabled: true,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/admin/stores");
  redirect(`/admin/stores/${store.id}`);
}

export async function updateStore(storeId: string, formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const isActive = formData.get("isActive") === "on";
  const promotionsEnabled = formData.get("promotionsEnabled") === "on";

  await storeRepository.update(storeId, {
    name,
    address,
    city,
    isActive,
    promotionsEnabled,
    updatedAt: new Date().toISOString(),
  });

  revalidatePath(`/admin/stores/${storeId}`);
}

/**
 * Hard delete, not a soft-delete via isActive (which already exists via
 * updateStore for hiding a store from customers without losing data). Cascades
 * to the store's layout (nodes/edges/product listings) and any promotion whose
 * attachedNodeId points at one of those nodes - such a promotion is dead the
 * moment its node is gone, regardless of the promotion's own storeId (a
 * chain-wide promotion with no storeId still targets one specific node).
 * Historical records (routes, shopping lists, analytics events) are left as
 * orphaned rows - they're past-session data, not live configuration, and
 * nothing in the admin UI lists them by store.
 */
export async function deleteStore(storeId: string): Promise<void> {
  const store = await storeRepository.findById(storeId);
  if (!store) return;

  const [nodes, edges, listings, promotions] = await Promise.all([
    nodeRepository.findByStore(storeId),
    edgeRepository.findByStore(storeId),
    productListingRepository.findByStore(storeId),
    promotionRepository.findAll(),
  ]);

  const nodeIds = new Set(nodes.map((n) => n.id));
  const orphanedPromotions = promotions.filter(
    (p) => p.storeId === storeId || nodeIds.has(p.attachedNodeId),
  );

  await Promise.all([
    ...listings.map((l) => productListingRepository.delete(l.id)),
    ...edges.map((e) => edgeRepository.delete(e.id)),
    ...nodes.map((n) => nodeRepository.delete(n.id)),
    ...orphanedPromotions.map((p) => promotionRepository.delete(p.id)),
  ]);

  if (store.mapImageUrl) {
    await del(store.mapImageUrl).catch(() => {});
  }

  await storeRepository.delete(storeId);

  revalidatePath("/admin/stores");
  redirect("/admin/stores");
}

export async function createNode(storeId: string, formData: FormData): Promise<void> {
  const type = String(formData.get("type") ?? "waypoint") as MapNodeType;
  const rawLabel = String(formData.get("label") ?? "").trim();
  // Only "department" is customer-facing (shown on the shopper's map/checklist), so it's the
  // only type that requires a real typed label - entrance/checkout/waypoint fall back to their
  // generic type name when left blank, matching the "no need to name them" admin UX.
  const label = rawLabel || (type === "department" ? "" : NODE_TYPE_LABELS[type]);
  const x = Number(formData.get("x") ?? 0);
  const y = Number(formData.get("y") ?? 0);
  const zone = String(formData.get("zone") ?? "").trim() || undefined;
  const iconKey = String(formData.get("iconKey") ?? "").trim() || undefined;
  if (!label) return;

  await nodeRepository.create({
    id: crypto.randomUUID(),
    storeId,
    type,
    label,
    position: { x, y },
    zone,
    iconKey,
  });

  revalidatePath(`/admin/stores/${storeId}`);
}

export async function deleteNode(storeId: string, nodeId: string): Promise<void> {
  await nodeRepository.delete(nodeId);
  revalidatePath(`/admin/stores/${storeId}`);
}

export async function updateNodePosition(
  storeId: string,
  nodeId: string,
  x: number,
  y: number,
): Promise<void> {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  await nodeRepository.update(nodeId, { position: { x: clamp(x), y: clamp(y) } });
  revalidatePath(`/admin/stores/${storeId}`);
}

export async function updateNodeIcon(storeId: string, nodeId: string, iconKey: string): Promise<void> {
  await nodeRepository.update(nodeId, { iconKey });
  revalidatePath(`/admin/stores/${storeId}`);
}

export async function updateNodeLabel(storeId: string, nodeId: string, formData: FormData): Promise<void> {
  // Textareas normalize line breaks to \r\n on submit in some browsers - collapse to a
  // plain \n so the stored label and MultilineSvgText's split both only ever see one form.
  const label = String(formData.get("label") ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!label) return;
  await nodeRepository.update(nodeId, { label });
  revalidatePath(`/admin/stores/${storeId}`);
}

export async function addProductToNode(storeId: string, nodeId: string, formData: FormData): Promise<void> {
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return;
  // One product, one node, per store - guard against it already being listed anywhere
  // else in this store (not just this exact node) before adding a second listing.
  const storeListings = await productListingRepository.findByStore(storeId);
  if (storeListings.some((l) => l.productId === productId)) return;
  await productListingRepository.create({ id: crypto.randomUUID(), productId, storeId, nodeId });
  revalidatePath(`/admin/stores/${storeId}`);
}

export async function removeProductFromNode(storeId: string, nodeId: string, productId: string): Promise<void> {
  const storeListings = await productListingRepository.findByStore(storeId);
  const match = storeListings.find((l) => l.productId === productId && l.nodeId === nodeId);
  if (!match) return;
  await productListingRepository.delete(match.id);
  revalidatePath(`/admin/stores/${storeId}`);
}

export async function createEdge(storeId: string, formData: FormData): Promise<void> {
  const fromNodeId = String(formData.get("fromNodeId") ?? "");
  const toNodeId = String(formData.get("toNodeId") ?? "");
  const bidirectional = formData.get("bidirectional") === "on";
  if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) return;

  await edgeRepository.create({
    id: crypto.randomUUID(),
    storeId,
    fromNodeId,
    toNodeId,
    bidirectional,
  });

  revalidatePath(`/admin/stores/${storeId}`);
}

export async function deleteEdge(storeId: string, edgeId: string): Promise<void> {
  await edgeRepository.delete(edgeId);
  revalidatePath(`/admin/stores/${storeId}`);
}

/**
 * The manager uploads a real photo/floorplan of the store instead of building one in-app; this
 * saves the file, points the store's mapImageUrl at it, and - this is the important part - resizes
 * mapWidth/mapHeight to match the photo's own pixel aspect ratio. Node positions are stored as
 * 0-1 fractions of mapWidth/mapHeight, so changing those doesn't move any node relative to the
 * image; what it does fix is the canvas's aspect ratio matching the photo's, so the photo renders
 * at its natural proportions instead of being cropped/stretched to fit a leftover square canvas.
 * Filename is always `{storeId}.{ext}` so a re-upload overwrites the previous image rather than
 * accumulating orphaned files.
 */
export async function uploadStoreImage(storeId: string, formData: FormData): Promise<void> {
  const file = formData.get("image");
  if (!(file instanceof File)) return;
  const saved = await saveUploadedImage("stores", storeId, file);
  if (!saved) return;

  const dimensions = readImageDimensions(saved.buffer, saved.ext);

  await storeRepository.update(storeId, {
    mapImageUrl: saved.url,
    updatedAt: new Date().toISOString(),
    ...(dimensions ? { mapWidth: dimensions.width, mapHeight: dimensions.height } : {}),
  });

  revalidatePath(`/admin/stores/${storeId}`);
}
