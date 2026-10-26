"use server";

import { revalidatePath } from "next/cache";
import { priceRepository } from "@/src/infrastructure/container";
import { requireAdmin } from "@/src/presentation/auth/admin";

export async function setSkuLinkRejected(productId: string, itemKey: string, rejected: boolean): Promise<void> {
  await requireAdmin("products");
  await priceRepository.updateSkuLink(productId, itemKey, { isRejected: rejected });
  revalidatePath(`/admin/products/${productId}/skus`);
}

export async function setSkuLinkTypical(productId: string, itemKey: string, typical: boolean): Promise<void> {
  await requireAdmin("products");
  await priceRepository.updateSkuLink(productId, itemKey, { isTypical: typical });
  revalidatePath(`/admin/products/${productId}/skus`);
}

/**
 * "שייך": the pick becomes the product's only typical one ("קפה נמס בריסטה" is
 * that barcode). `asOption` ("כאפשרות בלבד") just adds it to the popup's
 * options, leaving the typical picks - for generic products with many.
 */
export async function addSkuLink(productId: string, itemKey: string, asOption: boolean): Promise<void> {
  await requireAdmin("products");
  await priceRepository.addManualSkuLink(productId, itemKey, { asOnlyTypical: !asOption });
  revalidatePath(`/admin/products/${productId}/skus`);
}
