import { NextResponse } from "next/server";
import { recognizeShoppingListText } from "@/src/infrastructure/llm/anthropic-ocr";

export async function POST(request: Request) {
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

  const bytes = await image.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  try {
    const text = await recognizeShoppingListText(base64, image.type);
    return NextResponse.json({ text });
  } catch (err) {
    console.error("OCR failed:", err);
    return NextResponse.json({ error: "ocr failed" }, { status: 502 });
  }
}
