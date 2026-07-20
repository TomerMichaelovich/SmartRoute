"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MapNodeType } from "@/src/domain/entities/map-node";
import { edgeRepository, nodeRepository, storeRepository } from "@/src/infrastructure/container";

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

export async function createNode(storeId: string, formData: FormData): Promise<void> {
  const type = String(formData.get("type") ?? "waypoint") as MapNodeType;
  const label = String(formData.get("label") ?? "").trim();
  const x = Number(formData.get("x") ?? 0);
  const y = Number(formData.get("y") ?? 0);
  const zone = String(formData.get("zone") ?? "").trim() || undefined;
  if (!label) return;

  await nodeRepository.create({
    id: crypto.randomUUID(),
    storeId,
    type,
    label,
    position: { x, y },
    zone,
  });

  revalidatePath(`/admin/stores/${storeId}`);
}

export async function deleteNode(storeId: string, nodeId: string): Promise<void> {
  await nodeRepository.delete(nodeId);
  revalidatePath(`/admin/stores/${storeId}`);
}

export async function createEdge(storeId: string, formData: FormData): Promise<void> {
  const fromNodeId = String(formData.get("fromNodeId") ?? "");
  const toNodeId = String(formData.get("toNodeId") ?? "");
  const distanceMeters = Number(formData.get("distanceMeters") ?? 0);
  const bidirectional = formData.get("bidirectional") === "on";
  if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) return;

  await edgeRepository.create({
    id: crypto.randomUUID(),
    storeId,
    fromNodeId,
    toNodeId,
    distanceMeters,
    bidirectional,
  });

  revalidatePath(`/admin/stores/${storeId}`);
}

export async function deleteEdge(storeId: string, edgeId: string): Promise<void> {
  await edgeRepository.delete(edgeId);
  revalidatePath(`/admin/stores/${storeId}`);
}
