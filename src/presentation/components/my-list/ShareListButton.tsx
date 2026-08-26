"use client";

import { useState } from "react";
import { Button } from "@/src/presentation/components/ui/Button";
import { he } from "@/src/presentation/i18n/he";

interface ShareListButtonProps {
  shareCode: string;
}

export function ShareListButton({ shareCode }: ShareListButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/my-list/${shareCode}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // User cancelled the native share sheet, or it failed - fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable - the raw code below is still shown as a fallback.
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Button variant="secondary" onClick={handleShare} fullWidth>
        {copied ? he.myList.share.copied : he.myList.share.button}
      </Button>
      <span className="text-xs text-neutral-500" dir="ltr">
        {he.myList.share.codeLabel(shareCode)}
      </span>
    </div>
  );
}
