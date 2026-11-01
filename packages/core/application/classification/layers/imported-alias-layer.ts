import type { ClassificationLayer } from "../classification-layer.interface";
import { exactAliasMatch } from "../imported-aliases";

/**
 * After the generic catalog's exact layers, before any guessing: a line that's exactly
 * an alias of products imported from price files ("ג'ין", "יוגורט תות"), as typed or
 * without counts and brands. Recognized, but not as one product - see imported-aliases.
 * Without this, the fuzzy layer would guess a generic product that merely looks alike
 * ("פיצה" -> "ביצים").
 */
export const importedAliasLayer: ClassificationLayer = {
  name: "alias",
  acceptThreshold: 1,
  async classify(_rawText, ctx) {
    if (!ctx.aliases) return null;
    const hit = exactAliasMatch(ctx.normalized, ctx.aliases);
    return hit ? { alias: hit, confidence: 1 } : null;
  },
};
