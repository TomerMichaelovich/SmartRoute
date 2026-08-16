import { promises as fs } from "fs";
import path from "path";

const ALLOWED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);

export interface SavedImage {
  url: string;
  buffer: Buffer;
  ext: string;
}

/**
 * Saves an uploaded image under public/uploads/{subdir}/{entityId}.{ext}, keyed
 * only by entity id so a re-upload overwrites the previous file rather than
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
  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${entityId}.${ext}`), buffer);

  return { url: `/uploads/${subdir}/${entityId}.${ext}`, buffer, ext };
}
