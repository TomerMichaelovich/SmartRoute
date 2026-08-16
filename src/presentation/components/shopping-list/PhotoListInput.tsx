"use client";

import { useRef, useState } from "react";
import { ShoppingListInput } from "@/src/presentation/components/shopping-list/ShoppingListInput";
import { Button } from "@/src/presentation/components/ui/Button";
import { he } from "@/src/presentation/i18n/he";

interface PhotoListInputProps {
  storeId: string;
}

function linesFromOcrText(rawText: string): string {
  return rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * OCR runs server-side via /api/ocr (Claude Haiku 4.5 vision) rather than
 * client-side, since it needs the account's Anthropic API key. Recognized
 * text is handed to ShoppingListInput as a pre-filled, still-editable draft -
 * OCR on a handwritten or crowded list is expected to make mistakes, so the
 * shopper always reviews and corrects before it's submitted to /api/classify,
 * same as manual entry.
 */
export function PhotoListInput({ storeId }: PhotoListInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRecognizedText(null);
    setError(null);
  }

  async function handleRecognize() {
    if (!imageFile) return;
    setIsRecognizing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      if (!res.ok) throw new Error("ocr failed");
      const { text }: { text: string } = await res.json();
      const lines = linesFromOcrText(text);
      if (!lines) {
        setError(he.list.photo.recognizeError);
      } else {
        setRecognizedText(lines);
      }
    } catch {
      setError(he.list.photo.recognizeError);
    } finally {
      setIsRecognizing(false);
    }
  }

  if (recognizedText !== null) {
    return (
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-sm text-neutral-500">{he.list.photo.reviewHint}</p>
        <ShoppingListInput storeId={storeId} initialText={recognizedText} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {previewUrl ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote asset next/image can optimize */}
            <img src={previewUrl} alt="" className="max-h-80 w-full object-contain" />
          </button>
          <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()}>
            {he.list.photo.retake}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-8 text-neutral-500"
        >
          {he.list.photo.pickImage}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="button" onClick={handleRecognize} disabled={!imageFile || isRecognizing} fullWidth>
        {isRecognizing ? he.list.photo.recognizing : he.list.photo.recognizeButton}
      </Button>
    </div>
  );
}
