"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/src/presentation/components/ui/Button";
import { useAnalytics } from "@/src/presentation/hooks/useAnalytics";
import { he } from "@/src/presentation/i18n/he";

interface ShoppingListInputProps {
  storeId: string;
  initialText?: string;
}

export function ShoppingListInput({ storeId, initialText = "" }: ShoppingListInputProps) {
  const router = useRouter();
  const { sessionId } = useAnalytics();
  const [text, setText] = useState(initialText);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawItems = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  async function handleSubmit() {
    if (rawItems.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, rawItems, sessionId: sessionId ?? undefined }),
      });
      if (!res.ok) throw new Error("classify failed");
      const shoppingList: { id: string } = await res.json();
      router.push(`/review/${shoppingList.id}`);
    } catch {
      setError(he.common.error);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={he.list.placeholder}
        rows={10}
        dir="rtl"
        className="w-full flex-1 resize-none rounded-2xl border border-neutral-200 bg-white p-4 text-base leading-7 focus:border-emerald-500 focus:outline-none"
      />
      <p className="text-sm text-neutral-500">{he.list.itemCount(rawItems.length)}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={handleSubmit} disabled={rawItems.length === 0 || isSubmitting} fullWidth>
        {isSubmitting ? he.common.loading : he.list.continueToReview}
      </Button>
    </div>
  );
}
