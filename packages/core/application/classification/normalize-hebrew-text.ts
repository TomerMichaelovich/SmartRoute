// Hebrew niqqud (vowel points) and cantillation marks (U+0591-U+05C7) - purely decorative for matching.
const NIQQUD_REGEX = /[֑-ׇ]/g;
// Punctuation that shows up in pasted shopping lists but carries no matching signal, incl.
// Hebrew geresh/gershayim (U+05F3, U+05F4). Deliberately keeps "%" - meaningful in "חלב 3%".
const PUNCTUATION_REGEX = /["'.,;:!?()[\]{}\-_/\\׳״]/g;

/**
 * Base normalization shared by every classification layer: strips niqqud and
 * punctuation, lowercases, and collapses whitespace. Does not touch prefixes,
 * plural/singular suffixes, or synonyms - that's the normalization layer's job.
 */
export function normalizeHebrewText(text: string): string {
  return text
    .replace(NIQQUD_REGEX, "")
    .replace(PUNCTUATION_REGEX, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
