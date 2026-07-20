"use server";

import { revalidatePath } from "next/cache";
import { normalizeHebrewText } from "@/src/application/classification/normalize-hebrew-text";
import type { ProductCategory } from "@/src/domain/entities/product";
import { productRepository } from "@/src/infrastructure/container";

function parseAliases(raw: string): string[] {
  return raw
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

function computeNormalizedAliases(canonicalName: string, aliases: string[]): string[] {
  return Array.from(new Set([canonicalName, ...aliases].map(normalizeHebrewText)));
}

export async function createProduct(formData: FormData): Promise<void> {
  const canonicalName = String(formData.get("canonicalName") ?? "").trim();
  const chainId = String(formData.get("chainId") ?? "").trim();
  const category = String(formData.get("category") ?? "other") as ProductCategory;
  const department = String(formData.get("department") ?? "").trim();
  const aliases = parseAliases(String(formData.get("aliases") ?? ""));
  const [storeId, nodeId] = String(formData.get("location") ?? "").split("::");
  if (!canonicalName || !chainId || !storeId || !nodeId) return;

  await productRepository.create({
    id: crypto.randomUUID(),
    chainId,
    canonicalName,
    aliases,
    normalizedAliases: computeNormalizedAliases(canonicalName, aliases),
    category,
    department,
    locations: [{ storeId, nodeId }],
    isActive: true,
  });

  revalidatePath("/admin/products");
}

export async function updateProduct(productId: string, formData: FormData): Promise<void> {
  const canonicalName = String(formData.get("canonicalName") ?? "").trim();
  const category = String(formData.get("category") ?? "other") as ProductCategory;
  const department = String(formData.get("department") ?? "").trim();
  const aliases = parseAliases(String(formData.get("aliases") ?? ""));
  const isActive = formData.get("isActive") === "on";
  if (!canonicalName || !department) return;

  await productRepository.update(productId, {
    canonicalName,
    category,
    department,
    aliases,
    normalizedAliases: computeNormalizedAliases(canonicalName, aliases),
    isActive,
  });

  revalidatePath("/admin/products");
}
