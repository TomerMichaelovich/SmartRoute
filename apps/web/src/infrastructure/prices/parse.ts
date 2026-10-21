import { gunzipSync } from "zlib";

/**
 * Parsers for the price-transparency files (Stores / PriceFull). The format is
 * nominally standard but differs per portal — see tests/fixtures/prices/README.md:
 * gzip or plain, UTF-8 or UTF-16LE, <Chain> or <Root>, tag casing.
 * Files are at most a few tens of MB uncompressed, so they're decoded in memory.
 */

/** gzip/plain + UTF-8/UTF-16LE (with or without BOM) -> string. */
export function decodePriceFile(raw: Buffer): string {
  let buf = raw;
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  else if (buf[0] === 0x50 && buf[1] === 0x4b) throw new Error("zip price files are not supported");
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString("utf8");
  return buf.toString("utf8");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function unescapeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Leaf elements of one block, keyed by lower-cased tag name. */
function fields(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) out[m[1].toLowerCase()] = unescapeXml(m[2]).trim();
  return out;
}

function blocks(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => m[1]);
}

function firstValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return m ? unescapeXml(m[1]).trim() : null;
}

/** "001" -> "1", so Stores and PriceFull files agree on a branch's id. */
export function normalizeStoreCode(code: string): string {
  const trimmed = code.trim().replace(/^0+(?=\d)/, "");
  return trimmed || "0";
}

/** Meaningless placeholder values chains put in optional fields. */
function meaningful(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v || v === "---" || v === "undefined" || v === "לא ידוע" || v.toLowerCase() === "unknown") return null;
  return v;
}

export interface ParsedBranch {
  storeCode: string;
  subChainId: string | null;
  subChainName: string | null;
  name: string;
  address: string | null;
  cityRaw: string | null;
}

export function parseStoresXml(xml: string): { govChainId: string; chainName: string | null; branches: ParsedBranch[] } {
  const govChainId = firstValue(xml, "ChainID");
  if (!govChainId) throw new Error("Stores file has no ChainID");
  const branches: ParsedBranch[] = [];
  const toBranch = (store: string, sub: { id: string | null; name: string | null }): ParsedBranch | null => {
    const f = fields(store);
    if (!f.storeid) return null;
    return {
      storeCode: normalizeStoreCode(f.storeid),
      subChainId: f.subchainid ?? sub.id,
      subChainName: f.subchainname ?? sub.name,
      name: f.storename ?? f.storeid,
      address: meaningful(f.address),
      cityRaw: meaningful(f.city),
    };
  };
  const subChains = blocks(xml, "SubChain");
  if (subChains.length > 0) {
    for (const sub of subChains) {
      const ctx = { id: firstValue(sub, "SubChainID"), name: firstValue(sub, "SubChainName") };
      for (const store of blocks(sub, "Store")) {
        const b = toBranch(store, ctx);
        if (b) branches.push(b);
      }
    }
  } else {
    for (const store of blocks(xml, "Store")) {
      const b = toBranch(store, { id: null, name: null });
      if (b) branches.push(b);
    }
  }
  return { govChainId, chainName: firstValue(xml, "ChainName"), branches };
}

export interface ParsedPriceItem {
  itemCode: string;
  itemType: string | null;
  name: string;
  manufacturer: string | null;
  quantity: number | null;
  unitQty: string | null;
  unitOfMeasure: string | null;
  isWeighted: boolean;
  priceAgorot: number;
  unitPriceAgorot: number | null;
  priceUpdatedAt: string | null;
}

function toNumber(value: string | undefined): number | null {
  const n = value === undefined ? NaN : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function toAgorot(value: string | undefined): number | null {
  const n = toNumber(value);
  return n === null ? null : Math.round(n * 100);
}

/** "2026-10-21T05:39:00.000" / "2026-10-21 05:39" -> ISO-ish string without zone, as the DB stores it. */
function toTimestamp(value: string | undefined): string | null {
  const m = value?.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/);
  return m ? `${m[1]} ${m[2].length === 5 ? `${m[2]}:00` : m[2]}` : null;
}

export function parsePriceFullXml(xml: string): { govChainId: string; storeCode: string; items: ParsedPriceItem[] } {
  const govChainId = firstValue(xml, "ChainID");
  const storeId = firstValue(xml, "StoreID");
  if (!govChainId || !storeId) throw new Error("PriceFull file has no ChainID/StoreID");
  const items: ParsedPriceItem[] = [];
  for (const block of blocks(xml, "Item")) {
    const f = fields(block);
    const price = toAgorot(f.itemprice);
    const code = f.itemcode?.trim();
    const name = f.itemname ?? f.itemnm;
    // Items without a positive price or a code can't be compared; skip them.
    if (!code || !name || price === null || price <= 0) continue;
    items.push({
      itemCode: code,
      itemType: f.itemtype ?? null,
      name,
      manufacturer: meaningful(f.manufacturename ?? f.manufacturername),
      quantity: toNumber(f.quantity),
      unitQty: meaningful(f.unitqty),
      unitOfMeasure: meaningful(f.unitofmeasure),
      isWeighted: f.bisweighted === "1",
      priceAgorot: price,
      unitPriceAgorot: toAgorot(f.unitofmeasureprice),
      priceUpdatedAt: toTimestamp(f.priceupdatetime ?? f.priceupdatedate),
    });
  }
  return { govChainId, storeCode: normalizeStoreCode(storeId), items };
}

/**
 * The cross-chain identity of an item. Packaged goods carry a real barcode that
 * every chain shares. Weighted produce and in-store items use chain-internal codes —
 * often 729000000xxxx, which look like barcodes but mean different things at
 * different chains (cucumber is 7290000000046 at Shufersal, 7290000001014 at Rami
 * Levy) — so those are keyed per chain.
 */
export function itemKeyFor(chainId: string, item: Pick<ParsedPriceItem, "itemCode" | "itemType" | "isWeighted">): {
  itemKey: string;
  internal: boolean;
} {
  const code = item.itemCode;
  const internal = item.isWeighted || item.itemType === "0" || code.length < 8 || code.startsWith("729000000");
  return { itemKey: internal ? `${chainId}:${code}` : code, internal };
}

export interface PriceFileName {
  kind: "PriceFull" | "Price" | "Stores" | "PromoFull" | "Promo";
  govChainId: string;
  storeCode: string | null;
  /** Local (Israel) time encoded in the name, "YYYY-MM-DD HH:mm:ss". */
  timestamp: string;
}

/**
 * PriceFull7290027600007-001-374-20261021-043100.gz   (chain-sub-store-date-time)
 * PriceFull7290803800003-7999-202412271528.gz         (chain-store-datetime, legacy)
 * Stores7290058140886-000-20261021-050501.xml
 */
export function parsePriceFileName(name: string): PriceFileName | null {
  const m = name.match(/^(PriceFull|PromoFull|Price|Promo|StoresFull|Stores)(\d{13})-(.+?)(?:\.\w+)*$/i);
  if (!m) return null;
  const kinds: Record<string, PriceFileName["kind"]> = {
    pricefull: "PriceFull",
    price: "Price",
    promofull: "PromoFull",
    promo: "Promo",
    stores: "Stores",
    storesfull: "Stores",
  };
  const kind = kinds[m[1].toLowerCase()];
  const parts = m[3].split("-");
  let storeCode: string | null = null;
  let date: string;
  let time: string;
  const last = parts.at(-1)!;
  const prev = parts.at(-2);
  if (prev && /^\d{8}$/.test(prev) && /^\d{4,6}$/.test(last)) {
    date = prev;
    time = last;
    if (kind !== "Stores") storeCode = parts.length >= 4 ? parts[parts.length - 3] : parts[0];
  } else if (/^\d{12,14}$/.test(last)) {
    date = last.slice(0, 8);
    time = last.slice(8);
    if (kind !== "Stores") storeCode = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
  } else {
    return null;
  }
  const t = time.padEnd(6, "0");
  return {
    kind,
    govChainId: m[2],
    storeCode: storeCode === null ? null : normalizeStoreCode(storeCode),
    timestamp: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)} ${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`,
  };
}
