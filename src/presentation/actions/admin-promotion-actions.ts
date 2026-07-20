"use server";

import { revalidatePath } from "next/cache";
import { promotionRepository } from "@/src/infrastructure/container";

function toIsoOrUndefined(raw: string): string | undefined {
  const trimmed = raw.trim();
  return trimmed ? new Date(trimmed).toISOString() : undefined;
}

export async function createPromotion(formData: FormData): Promise<void> {
  const chainId = String(formData.get("chainId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const frequencyCapPerSession = Number(formData.get("frequencyCapPerSession") ?? 3);
  const [storeId, attachedNodeId] = String(formData.get("location") ?? "").split("::");
  const startDate = toIsoOrUndefined(String(formData.get("startDate") ?? ""));
  const endDate = toIsoOrUndefined(String(formData.get("endDate") ?? ""));
  if (!chainId || !title || !storeId || !attachedNodeId) return;

  await promotionRepository.create({
    id: crypto.randomUUID(),
    chainId,
    storeId,
    title,
    description,
    attachedNodeId,
    isSponsored: true,
    isActive: true,
    frequencyCapPerSession,
    startDate,
    endDate,
  });

  revalidatePath("/admin/promotions");
}

export async function updatePromotion(promotionId: string, formData: FormData): Promise<void> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const isActive = formData.get("isActive") === "on";
  const frequencyCapPerSession = Number(formData.get("frequencyCapPerSession") ?? 3);
  const startDate = toIsoOrUndefined(String(formData.get("startDate") ?? ""));
  const endDate = toIsoOrUndefined(String(formData.get("endDate") ?? ""));
  if (!title) return;

  await promotionRepository.update(promotionId, {
    title,
    description,
    isActive,
    frequencyCapPerSession,
    startDate,
    endDate,
  });

  revalidatePath("/admin/promotions");
}
