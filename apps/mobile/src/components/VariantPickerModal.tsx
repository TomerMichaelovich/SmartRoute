import { he } from "@smartroute/core/i18n/he";
import { ChoicePickerModal } from "@/components/ChoicePickerModal";

export interface VariantOption {
  itemKey: string;
  name: string;
  label: string | null;
  manufacturer: string | null;
  isTypical: boolean;
  branchCount: number;
}

export interface VariantQuestion {
  itemId: string;
  rawText: string;
  productId: string;
  options: VariantOption[];
}

interface VariantPickerModalProps {
  /** The item being asked about; null hides the dialog. */
  question: VariantQuestion | null;
  index: number;
  total: number;
  onPick: (option: VariantOption) => void;
  onAny: () => void;
  onAnyForRest: () => void;
}

/**
 * "What did you mean by 'חלב'?" — one list item at a time, before comparing
 * basket prices. Every answer is saved on the list item, so it's asked once.
 */
export function VariantPickerModal({ question, index, total, onPick, onAny, onAnyForRest }: VariantPickerModalProps) {
  const t = he.cheapest.variant;
  const options = question?.options ?? [];
  return (
    <ChoicePickerModal
      title={question ? t.title(question.rawText) : null}
      progress={total > 1 ? t.progress(index + 1, total) : null}
      options={options.map((o) => ({
        key: o.itemKey,
        title: o.label || o.name,
        meta: `${o.label ? `${o.name} · ` : ""}${t.branchCount(o.branchCount)}`,
      }))}
      anyLabel={t.any}
      anyForRestLabel={total - index > 1 ? t.anyForRest : null}
      searchPlaceholder={t.search}
      onPick={(key) => {
        const option = options.find((o) => o.itemKey === key);
        if (option) onPick(option);
      }}
      onAny={onAny}
      onAnyForRest={onAnyForRest}
    />
  );
}
