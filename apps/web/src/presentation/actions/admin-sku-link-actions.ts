"use server";

import { revalidatePath } from "next/cache";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { priceRepository, productRepository } from "@/src/infrastructure/container";
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
 * "שייך": the product is that barcode now - it becomes the only typical one,
 * and the product takes its name ("קפה נמס בריסטה" -> "קפה מגורען גולד בארי"),
 * the old name kept as an alias so typing it still finds the product.
 * `asOption` ("כאפשרות בלבד") just adds it to the popup's options, leaving the
 * typical picks and the name - for generic products with many.
 */
export async function addSkuLink(productId: string, itemKey: string, asOption: boolean): Promise<void> {
  await requireAdmin("products");
  await priceRepository.addManualSkuLink(productId, itemKey, { asOnlyTypical: !asOption });
  if (!asOption) {
    const [product, links] = await Promise.all([productRepository.findById(productId), priceRepository.findSkuLinks(productId)]);
    const name = links.find((l) => l.itemKey === itemKey)?.name.trim();
    if (product && name && name !== product.canonicalName) {
      const aliases = [...new Set([...product.aliases, product.canonicalName])];
      await productRepository.update(productId, {
        canonicalName: name,
        aliases,
        normalizedAliases: [...new Set([name, ...aliases].map(normalizeHebrewText))],
      });
      revalidatePath("/admin/products");
    }
  }
  revalidatePath(`/admin/products/${productId}/skus`);
}
