/**
 * Which chains and cities the price ingestion covers. Comparison only ever
 * happens between branches in the shopper's own city, so expanding the pilot
 * means adding CBS city codes here (and chains whose portals are reachable from
 * the runner).
 */

/** CBS settlement codes whose branches get prices. 9000 = באר שבע. */
export const PRICE_CITY_CODES: readonly number[] = [9000];

export interface ChainConfig {
  id: string;
  govChainId: string;
  name: string;
  portal: "shufersal" | "cerberus" | "carrefour";
  portalConfig: Record<string, string>;
  /**
   * The portal refuses connections from outside Israel, so GitHub-hosted
   * runners (US) can't reach it: CI skips the chain; it's ingested from an
   * Israeli machine (`ingest.ts --chain=<id> --prod`, or a runner in Israel
   * started with PRICES_RUNNER_IN_ISRAEL=1).
   */
  israelOnly?: boolean;
}

export const PRICE_CHAINS: readonly ChainConfig[] = [
  { id: "shufersal", govChainId: "7290027600007", name: "שופרסל", portal: "shufersal", portalConfig: {} },
  { id: "rami-levy", govChainId: "7290058140886", name: "רמי לוי", portal: "cerberus", portalConfig: { username: "RamiLevi" } },
  { id: "yohananof", govChainId: "7290803800003", name: "יוחננוף", portal: "cerberus", portalConfig: { username: "yohananof" } },
  { id: "osher-ad", govChainId: "7290103152017", name: "אושר עד", portal: "cerberus", portalConfig: { username: "osherad" } },
  // Blocks non-Israeli IPs since 2026-10-22 (UND_ERR_CONNECT_TIMEOUT from GitHub runners).
  { id: "carrefour", govChainId: "7290055700007", name: "קרפור", portal: "carrefour", portalConfig: {}, israelOnly: true },
];

/** Wholesale / cash & carry branches that publish prices but aren't for shoppers. */
export function isRetailBranch(branch: { name: string; subChainName: string | null }): boolean {
  const text = `${branch.subChainName ?? ""} ${branch.name}`;
  return !/cash\s*&?\s*carry|סיטונאות|המפיץ/i.test(text);
}

/** A PriceFull file older than this is treated as missing (the branch drops out of quotes). */
export const MAX_PRICE_FILE_AGE_HOURS = 72;
