import { parsePriceFileName } from "./parse";

/**
 * Download adapters for the price-transparency portals. Each chain publishes on
 * one of a handful of portals; `retail_chains.portal` picks the adapter and
 * `portal_config` holds its per-chain settings.
 *
 * Only portals reachable from GitHub Actions runners are here (see the phase-0
 * probe): Laib (Victory, Mahsanei Hashuk) and Hazi Hinam block non-Israeli IPs.
 */

const USER_AGENT = "NAVIO-prices/1.0 (+https://navio.co.il)";
const TIMEOUT_MS = 90_000;
// Shufersal's listing pages can take over a minute to render.
const SLOW_TIMEOUT_MS = 180_000;
const ATTEMPTS = 3;
const RETRY_DELAYS_MS = [3_000, 10_000];

/**
 * Undici reports every network failure as "fetch failed"; the reason
 * (ETIMEDOUT, ECONNRESET, a TLS error...) is in `cause`. Keep it, with the
 * host, so the ingest log says what actually went wrong.
 */
function describeFetchError(url: string, error: unknown): Error {
  const e = error as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  const reason =
    e.name === "TimeoutError" ? "timeout" : (e.cause?.code ?? e.cause?.message ?? e.message ?? String(error));
  return new Error(`${new URL(url).host}: ${reason}`);
}

async function request(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "user-agent": USER_AGENT, ...(init.headers as Record<string, string> | undefined) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status >= 500 && attempt < ATTEMPTS) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastError = e;
      if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
    }
  }
  throw describeFetchError(url, lastError);
}

async function download(url: string, init?: RequestInit): Promise<Buffer> {
  const res = await request(url, init);
  if (!res.ok) throw new Error(`download ${url.split("?")[0]}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export interface PriceFileRef {
  name: string;
  storeCode: string;
  /** Israel-local time from the file name, "YYYY-MM-DD HH:mm:ss". */
  timestamp: string;
  fetch(): Promise<Buffer>;
}

export interface PortalAdapter {
  fetchStoresFile(): Promise<Buffer>;
  /** The newest PriceFull file of each requested branch (by the time in its name). */
  listPriceFullFiles(storeCodes: string[]): Promise<PriceFileRef[]>;
}

function newestPerStore(refs: PriceFileRef[], storeCodes: string[]): PriceFileRef[] {
  const wanted = new Set(storeCodes);
  const newest = new Map<string, PriceFileRef>();
  for (const ref of refs) {
    if (!wanted.has(ref.storeCode)) continue;
    const current = newest.get(ref.storeCode);
    if (!current || ref.timestamp > current.timestamp) newest.set(ref.storeCode, ref);
  }
  return [...newest.values()];
}

function priceFullRef(name: string, fetchFile: () => Promise<Buffer>): PriceFileRef | null {
  const parsed = parsePriceFileName(name);
  if (!parsed || parsed.kind !== "PriceFull" || !parsed.storeCode) return null;
  return { name, storeCode: parsed.storeCode, timestamp: parsed.timestamp, fetch: fetchFile };
}

// --- Shufersal: prices.shufersal.co.il -------------------------------------
// An HTML table per category/branch whose links are signed Azure blob URLs that
// expire within the hour, so each file is downloaded right after it's listed.

function shufersal(): PortalAdapter {
  const base = "https://prices.shufersal.co.il/FileObject/UpdateCategory";
  const links = async (catId: number, storeId: string) => {
    const html = await (await request(`${base}?catID=${catId}&storeId=${storeId}`, {}, SLOW_TIMEOUT_MS)).text();
    return [...html.matchAll(/href="(https:\/\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  };
  const nameOf = (url: string) => decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  return {
    async fetchStoresFile() {
      const url = (await links(5, "0"))[0];
      if (!url) throw new Error("shufersal: no Stores file listed");
      return download(url);
    },
    async listPriceFullFiles(storeCodes) {
      const refs: PriceFileRef[] = [];
      for (const code of storeCodes) {
        for (const url of await links(2, code)) {
          const ref = priceFullRef(nameOf(url), () => download(url));
          if (ref) refs.push(ref);
        }
      }
      return newestPerStore(refs, storeCodes);
    },
  };
}

// --- Cerberus: url.publishedprices.co.il -----------------------------------
// One login per chain with a public username and an empty password, then a
// JSON directory listing. Listings also hold months-old files in other naming
// schemes; newestPerStore picks by the parsed timestamp.

function cerberus(config: Record<string, string>): PortalAdapter {
  const base = "https://url.publishedprices.co.il";
  const username = config.username;
  if (!username) throw new Error("cerberus portal needs portal_config.username");
  const cookies = new Map<string, string>();
  const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  const call = async (path: string, init: RequestInit = {}) => {
    const res = await request(base + path, {
      ...init,
      redirect: "manual",
      headers: { ...(init.headers as Record<string, string> | undefined), cookie: cookieHeader() },
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
    return res;
  };
  const csrfOf = (html: string) => html.match(/name="csrftoken"\s+content="([^"]+)"/)?.[1] ?? "";
  const form = { "content-type": "application/x-www-form-urlencoded" };

  let listing: Promise<string[]> | null = null;
  const list = () =>
    (listing ??= (async () => {
      const csrf = csrfOf(await (await call("/login")).text());
      const login = await call("/login/user", {
        method: "POST",
        headers: form,
        body: new URLSearchParams({ r: "", username, password: "", Submit: "Sign in", csrftoken: csrf }),
      });
      if (login.status !== 302) throw new Error(`cerberus ${username}: login HTTP ${login.status}`);
      const csrf2 = csrfOf(await (await call("/file")).text()) || csrf;
      const dir = await call("/file/json/dir", {
        method: "POST",
        headers: form,
        body: new URLSearchParams({ iDisplayStart: "0", iDisplayLength: "100000", sSearch: "", cd: "/", csrftoken: csrf2 }),
      });
      if (!dir.ok) throw new Error(`cerberus ${username}: listing HTTP ${dir.status}`);
      const body = (await dir.json()) as { aaData: { fname?: string; name?: string }[] };
      return body.aaData.map((f) => f.fname ?? f.name ?? "").filter(Boolean);
    })());
  const fetchFile = (name: string) => () => download(`${base}/file/d/${name}`, { headers: { cookie: cookieHeader() } });

  return {
    async fetchStoresFile() {
      const stores = (await list())
        .map((name) => ({ name, parsed: parsePriceFileName(name) }))
        .filter((f) => f.parsed?.kind === "Stores")
        .sort((a, b) => (a.parsed!.timestamp < b.parsed!.timestamp ? 1 : -1));
      if (!stores[0]) throw new Error(`cerberus ${username}: no Stores file listed`);
      return fetchFile(stores[0].name)();
    },
    async listPriceFullFiles(storeCodes) {
      const refs = (await list())
        .map((name) => priceFullRef(name, fetchFile(name)))
        .filter((r): r is PriceFileRef => r !== null);
      return newestPerStore(refs, storeCodes);
    },
  };
}

// --- Carrefour: prices.carrefour.co.il -------------------------------------
// A page per day (`?date=YYYYMMDD`, default today) that embeds that day's file
// list as JSON plus its `path` (the date folder); files are served at
// /<path>/<name>. Right after midnight today's page is nearly empty, so both
// today and yesterday are listed and the newest file per branch wins.

function carrefour(): PortalAdapter {
  const origin = "https://prices.carrefour.co.il";
  const pages = new Map<string, Promise<{ path: string; names: string[] }>>();
  const load = (date = "") => {
    let page = pages.get(date);
    if (!page) {
      page = (async () => {
        const html = await (await request(`${origin}/${date ? `?date=${date}` : ""}`)).text();
        const path = html.match(/const path = '(\d{8})'/)?.[1];
        if (!path) throw new Error("carrefour: no date path on the page");
        const names = [...new Set([...html.matchAll(/"name":"([^"]+)"/g)].map((m) => m[1]))];
        return { path, names };
      })();
      pages.set(date, page);
    }
    return page;
  };
  const dayBefore = (yyyymmdd: string) => {
    const d = new Date(Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8) - 1));
    return d.toISOString().slice(0, 10).replace(/-/g, "");
  };
  const loadRecent = async () => {
    const today = await load();
    return [today, await load(dayBefore(today.path))];
  };
  const fetchFile = (path: string, name: string) => () => download(`${origin}/${path}/${name}`);
  return {
    async fetchStoresFile() {
      for (const { path, names } of await loadRecent()) {
        const name = names.find((n) => parsePriceFileName(n)?.kind === "Stores");
        if (name) return fetchFile(path, name)();
      }
      throw new Error("carrefour: no Stores file listed today or yesterday");
    },
    async listPriceFullFiles(storeCodes) {
      const refs = (await loadRecent()).flatMap(({ path, names }) =>
        names.map((name) => priceFullRef(name, fetchFile(path, name))).filter((r): r is PriceFileRef => r !== null),
      );
      return newestPerStore(refs, storeCodes);
    },
  };
}

export function portalAdapter(portal: string, config: Record<string, string>): PortalAdapter {
  switch (portal) {
    case "shufersal":
      return shufersal();
    case "cerberus":
      return cerberus(config);
    case "carrefour":
      return carrefour();
    default:
      throw new Error(`unknown price portal "${portal}"`);
  }
}
