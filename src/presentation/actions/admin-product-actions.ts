"use server";

import { revalidatePath } from "next/cache";
import { normalizeHebrewText } from "@/src/application/classification/normalize-hebrew-text";
import type { ProductCategory } from "@/src/domain/entities/product";
import { productRepository } from "@/src/infrastructure/container";
import { saveUploadedImage } from "@/src/infrastructure/image-upload";

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
    // Only touch imageUrl when a new file was actually uploaded - update()
    // merges partials, so omitting the key here (rather than setting it to
    // undefined) leaves an existing image alone when the admin just edits
    // the other fields.
    ...(saved ? { imageUrl: saved.url } : {}),
  });

  revalidatePath("/admin/products");
}
