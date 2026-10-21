// Phase-0 spike: checks that each price-transparency portal is reachable from
// the current machine (local PC or a GitHub Actions runner) and that one
// Stores file and one PriceFull file can actually be downloaded.
// No dependencies, no secrets — safe to run in a public CI log.
//
//   node apps/web/scripts/prices/probe-portals.mjs

import { gunzipSync } from "node:zlib";

const UA = "NAVIO-price-probe/0.1 (+https://navio.co.il)";
const TIMEOUT_MS = 30_000;

async function get(url, init = {}) {
  return fetch(url, {
    ...init,
    headers: { "user-agent": UA, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

function describe(buf) {
  const magic = buf.subarray(0, 4).toString("hex");
  let format = "plain";
  if (magic.startsWith("1f8b")) format = "gzip";
  else if (magic.startsWith("504b")) format = "zip";
  let text = buf;
  if (format === "gzip") text = gunzipSync(buf);
  const head = text.subarray(0, 4).toString("hex");
  const encoding = head.startsWith("fffe")
    ? "utf16le"
    : head.startsWith("efbbbf")
      ? "utf8-bom"
      : "utf8";
  const str = encoding === "utf16le" ? text.toString("utf16le") : text.toString("utf8");
  const items = (str.match(/<item>/gi) ?? []).length;
  const stores = (str.match(/<store>/gi) ?? []).length;
  return `${buf.length}B ${format}/${encoding} items=${items} stores=${stores}`;
}

async function download(label, url, init) {
  const r = await get(url, init);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!r.ok) throw new Error(`${label}: HTTP ${r.status}`);
  return `${label}: ${describe(buf)}`;
}

function unescapeHref(href) {
  return href.replace(/&amp;/g, "&");
}

async function shufersal() {
  const list = async (catId, storeId) => {
    const html = await (
      await get(`https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=${catId}&storeId=${storeId}`)
    ).text();
    const href = html.match(/href="(https:\/\/[^"]+)"/)?.[1];
    if (!href) throw new Error(`no file link for catID=${catId}`);
    return unescapeHref(href);
  };
  return [
    await download("Stores", await list(5, 0)),
    await download("PriceFull", await list(2, 374)),
  ];
}

async function cerberus(username) {
  const base = "https://url.publishedprices.co.il";
  const cookies = new Map();
  const req = async (path, init = {}) => {
    const r = await get(base + path, {
      ...init,
      redirect: "manual",
      headers: { ...(init.headers ?? {}), cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
    });
    for (const c of r.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
    return r;
  };
  const form = { "content-type": "application/x-www-form-urlencoded" };
  const loginHtml = await (await req("/login")).text();
  const csrf = loginHtml.match(/name="csrftoken"\s+content="([^"]+)"/)?.[1] ?? "";
  const login = await req("/login/user", {
    method: "POST",
    headers: form,
    body: new URLSearchParams({ r: "", username, password: "", Submit: "Sign in", csrftoken: csrf }),
  });
  if (login.status !== 302) throw new Error(`login HTTP ${login.status}`);
  const fileHtml = await (await req("/file")).text();
  const csrf2 = fileHtml.match(/name="csrftoken"\s+content="([^"]+)"/)?.[1] ?? csrf;
  const dir = await req("/file/json/dir", {
    method: "POST",
    headers: form,
    body: new URLSearchParams({ iDisplayStart: "0", iDisplayLength: "100000", sSearch: "", cd: "/", csrftoken: csrf2 }),
  });
  const names = (await dir.json()).aaData.map((f) => f.fname ?? f.name);
  const newest = (prefix) => names.filter((n) => n.startsWith(prefix)).sort().at(-1);
  const out = [`listing: ${names.length} files`];
  for (const prefix of ["Stores", "PriceFull"]) {
    const name = newest(prefix);
    if (!name) throw new Error(`no ${prefix} file`);
    out.push(await download(`${prefix} ${name}`, `${base}/file/d/${name}`, {
      headers: { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
    }));
  }
  return out;
}

async function linksOnPage(url, re, base = url) {
  const html = await (await get(url)).text();
  return [...html.matchAll(re)].map((m) => new URL(unescapeHref(m[1]), base).href);
}

async function carrefour() {
  const html = await (await get("https://prices.carrefour.co.il/")).text();
  const names = [...new Set(html.match(/PriceFull[0-9\-]+\.gz/g) ?? [])];
  return [`page lists ${names.length} PriceFull files (download path TBD)`];
}

async function laib() {
  const html = await (await get("https://laibcatalog.co.il/")).text();
  const n = (html.match(/(PriceFull|StoresFull)[^"'<\s]+/g) ?? []).length;
  return [`page lists ${n} Stores/PriceFull mentions (download path TBD)`];
}

async function haziHinam() {
  const links = await linksOnPage("https://shop.hazi-hinam.co.il/Prices", /href="([^"]*PriceFull[^"]*\.gz[^"]*)"/gi);
  if (!links.length) throw new Error("no PriceFull link");
  return [await download("PriceFull", links[0])];
}

async function superPharm() {
  const links = await linksOnPage("https://prices.super-pharm.co.il/", /href="([^"]*\/Download\/[^"]+)"/gi);
  return [`page lists ${links.length} download links`];
}

const probes = {
  "shufersal": shufersal,
  "cerberus:RamiLevi": () => cerberus("RamiLevi"),
  "cerberus:yohananof": () => cerberus("yohananof"),
  "cerberus:osherad": () => cerberus("osherad"),
  "carrefour": carrefour,
  "laib (victory/mahsanei hashuk)": laib,
  "hazi-hinam": haziHinam,
  "super-pharm": superPharm,
};

let failed = 0;
for (const [name, probe] of Object.entries(probes)) {
  const started = Date.now();
  try {
    const lines = await probe();
    console.log(`OK   ${name} (${Date.now() - started}ms)`);
    for (const l of lines) console.log(`       ${l}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} (${Date.now() - started}ms): ${e.cause?.code ?? e.message}`);
  }
}
console.log(`\n${Object.keys(probes).length - failed}/${Object.keys(probes).length} portals reachable`);
