"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import type { ProductCategory } from "@smartroute/core/domain/entities/product";
import { productRepository } from "@/src/infrastructure/container";
import { saveUploadedImage } from "@/src/infrastructure/image-upload";
import { requireAdmin } from "@/src/presentation/auth/admin";

function parseAliases(raw: string): string[] {
  return raw
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

// "" (the form's "generic" option) => null: a product every chain may carry.
function parseChainId(formData: FormData): string | null {
  return String(formData.get("chainId") ?? "").trim() || null;
}

function computeNormalizedAliases(canonicalName: string, aliases: string[]): string[] {
  return Array.from(new Set([canonicalName, ...aliases].map(normalizeHebrewText)));
}

export async function createProduct(formData: FormData): Promise<void> {
  await requireAdmin("products");
  const canonicalName = String(formData.get("canonicalName") ?? "").trim();
  const category = String(formData.get("category") ?? "other") as ProductCategory;
  const department = String(formData.get("department") ?? "").trim();
  const aliases = parseAliases(String(formData.get("aliases") ?? ""));
  if (!canonicalName || !department) return;

  const id = crypto.randomUUID();
  const imageFile = formData.get("image");
  const saved = imageFile instanceof File ? await saveUploadedImage("products", id, imageFile) : null;

  await productRepository.create({
    id,
    canonicalName,
    aliases,
    normalizedAliases: computeNormalizedAliases(canonicalName, aliases),
    category,
    department,
    imageUrl: saved?.url,
    isActive: true,
    chainId: parseChainId(formData),
  });

  revalidatePath("/admin/products");
  // "צור ועבור למוצרים ברשתות": straight to linking its barcodes, searching by its name.
  if (formData.get("then") === "skus") {
    redirect(`/admin/products/${id}/skus?q=${encodeURIComponent(canonicalName)}`);
  }
}

export async function updateProduct(productId: string, formData: FormData): Promise<void> {
  await requireAdmin("products");
  const canonicalName = String(formData.get("canonicalName") ?? "").trim();
  const category = String(formData.get("category") ?? "other") as ProductCategory;
  const department = String(formData.get("department") ?? "").trim();
  const aliases = parseAliases(String(formData.get("aliases") ?? ""));
  const isActive = formData.get("isActive") === "on";
  if (!canonicalName || !department) return;

  const imageFile = formData.get("image");
  const saved =
    imageFile instanceof File ? await saveUploadedImage("products", productId, imageFile) : null;

  await productRepository.update(productId, {
    canonicalName,
    category,
    department,
    aliases,
    normalizedAliases: computeNormalizedAliases(canonicalName, aliases),
    isActive,
    chainId: parseChainId(formData),
    // Only touch imageUrl when a new file was actually uploaded - update()
    // merges partials, so omitting the key here (rather than setting it to
    // undefined) leaves an existing image alone when the admin just edits
    // the other fields.
    ...(saved ? { imageUrl: saved.url } : {}),
  });

  revalidatePath("/admin/products");
}
