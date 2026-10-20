import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { apiFetch } from "@/lib/api";

// Plenty for reading handwriting, and keeps the upload well under the server's request limit.
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.7;

/**
 * Takes a photo of a shopping list (camera) or picks one (gallery). Resolves to a resized
 * JPEG's uri, or null when cancelled or permission was refused.
 */
export async function pickListPhoto(source: "camera" | "gallery"): Promise<string | null> {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return saved.uri;
}

/** Reads the list's lines from a photo (server OCR - see apps/web/app/api/ocr). */
export async function recognizeListPhoto(uri: string): Promise<string[]> {
  const form = new FormData();
  // React Native's FormData takes a { uri, name, type } file descriptor.
  form.append("image", { uri, name: "list.jpg", type: "image/jpeg" } as unknown as Blob);
  const res = await apiFetch("/api/ocr", { method: "POST", body: form });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { text }: { text: string } = await res.json();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
