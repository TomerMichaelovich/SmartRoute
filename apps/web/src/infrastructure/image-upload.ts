import { put } from "@vercel/blob";

const ALLOWED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);

export interface SavedImage {
  url: string;
  buffer: Buffer;
  ext: string;
}

/**
 * Saves an uploaded image to Vercel Blob under {subdir}/{entityId}.{ext}, keyed
 * only by entity id so a re-upload overwrites the previous blob rather than
 * accumulating orphans. Returns null on a missing/empty file or a disallowed
 * extension - callers treat that as "no change" rather than an error.
 */
export async function saveUploadedImage(
  subdir: string,
  entityId: string,
  file: File,
): Promise<SavedImage | null> {
  if (file.size === 0) return null;

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) return null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const blob = await put(`${subdir}/${entityId}.${ext}`, buffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return { url: blob.url, buffer, ext };
}
