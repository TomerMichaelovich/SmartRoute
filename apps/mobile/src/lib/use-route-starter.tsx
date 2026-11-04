import { useRef, useState } from "react";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import type { ShoppingListItemPlaceChoice } from "@smartroute/core/domain/entities/shopping-list";
import { he } from "@smartroute/core/i18n/he";
import { ChoicePickerModal } from "@/components/ChoicePickerModal";
import { apiFetch } from "@/lib/api";
import { startRouteAtStore } from "@/lib/start-route";

interface PlaceQuestion {
  itemId: string;
  rawText: string;
  options: { productId: string; name: string; location: string | null }[];
}

/**
 * Starting a route at a mapped store, asking first which product each item
 * means where the store carries several for it on different shelves ("טחינה":
 * generic or the chain's own). Answers are saved on the items (asked once,
 * shared with the household); "לא משנה לי" lets the route take whichever is on
 * the way. Render `choiceModal` in the screen.
 */
export function useRouteStarter(listCode: string | undefined) {
  const [asking, setAsking] = useState<{ questions: PlaceQuestion[]; index: number } | null>(null);
  const answers = useRef(new Map<string, ShoppingListItemPlaceChoice>());
  const finish = useRef<(() => void) | null>(null);

  async function startRoute(storeId: string): Promise<{ routeId: string } | { error: string }> {
    if (!listCode) return { error: he.common.error };
    answers.current = new Map();
    // Questions failing to load never block the route: the server then takes what's on the way.
    const questions: PlaceQuestion[] = await apiFetch(`/api/lists/${listCode}/place-options?storeId=${encodeURIComponent(storeId)}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body: { items: PlaceQuestion[] }) => body.items)
      .catch(() => []);
    if (questions.length > 0) {
      await new Promise<void>((resolve) => {
        finish.current = resolve;
        setAsking({ questions, index: 0 });
      });
    }
    return startRouteAtStore(listCode, storeId, answers.current);
  }

  function answer(from: number, to: number, productIdFor: (q: PlaceQuestion) => string | null) {
    if (!asking) return;
    for (const q of asking.questions.slice(from, to)) {
      const placeChoice = { productId: productIdFor(q), text: normalizeHebrewText(q.rawText), chosenAt: new Date().toISOString() };
      answers.current.set(q.itemId, placeChoice);
      apiFetch(`/api/lists/${listCode}/items/${q.itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeChoice }),
      }).catch(() => {});
    }
    if (to >= asking.questions.length) {
      setAsking(null);
      finish.current?.();
      finish.current = null;
    } else {
      setAsking({ ...asking, index: to });
    }
  }

  const t = he.placeChoice;
  const question = asking ? asking.questions[asking.index] : null;
  const total = asking?.questions.length ?? 0;
  const index = asking?.index ?? 0;
  const choiceModal = (
    <ChoicePickerModal
      title={question ? t.title(question.rawText) : null}
      progress={total > 1 ? he.cheapest.variant.progress(index + 1, total) : null}
      options={(question?.options ?? []).map((o) => ({ key: o.productId, title: o.name, meta: o.location }))}
      anyLabel={t.any}
      anyForRestLabel={total - index > 1 ? t.anyForRest : null}
      onPick={(productId) => answer(index, index + 1, () => productId)}
      onAny={() => answer(index, index + 1, () => null)}
      onAnyForRest={() => answer(index, total, () => null)}
    />
  );

  return { startRoute, choiceModal };
}
