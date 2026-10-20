import { NextResponse } from "next/server";
import { ocrUsageRepository } from "@/src/infrastructure/container";
import { recognizeShoppingListText } from "@/src/infrastructure/llm/anthropic-ocr";
import { getCurrentUser } from "@/src/presentation/auth/dal";

/** Photos each user may have read per 24 hours - every read is a paid Anthropic call. */
const DAILY_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The app sends ~300-600 KB JPEGs; anything this big isn't from it. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Reads a shopping list from a photo. Signed-in users only, and at most DAILY_LIMIT photos
 * per user per 24 hours - both are checked before anything is sent to Anthropic, so a
 * rejected request costs nothing.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - DAY_MS).toISOString();
  if ((await ocrUsageRepository.countSince(user.id, since)) >= DAILY_LIMIT) {
    return NextResponse.json({ error: "daily_limit", limit: DAILY_LIMIT }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const image = formData.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "missing image" }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }

  const bytes = await image.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  try {
    const text = await recognizeShoppingListText(base64, image.type);
    // Counted only once a read actually went through - a failed one doesn't use up the quota.
    await ocrUsageRepository.record(user.id);
    return NextResponse.json({ text });
  } catch (err) {
    console.error("OCR failed:", err);
    return NextResponse.json({ error: "ocr failed" }, { status: 502 });
  }
}
