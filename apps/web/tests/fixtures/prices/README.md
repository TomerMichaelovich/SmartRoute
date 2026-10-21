# Price-transparency fixtures

Trimmed real files (downloaded 2026-10-21) that keep the original container
and encoding byte-for-byte in style. Use them for parser tests.

| File | Source | Format |
|---|---|---|
| `shufersal-stores.xml.gz` | prices.shufersal.co.il, catID=5 | gzip, UTF-8 + BOM, `<Chain>` root |
| `shufersal-pricefull.xml.gz` | store 374 | gzip, UTF-8 + BOM, `<Root>` |
| `ramilevy-stores.xml` | url.publishedprices.co.il (Cerberus) | **plain, UTF-16LE + BOM**, `<Root>` |
| `ramilevy-pricefull.xml.gz` | store 001 | gzip, UTF-8 + BOM |

PriceFull samples include the first items plus all "חלב…" items,
"שוקולד חלב…" items and weighted produce (עגבניה/מלפפון/בננה).

## Quirks observed

- **Stores root differs** by portal: `<Chain>` (Shufersal) vs `<Root>` (Cerberus).
- **Encoding differs**: Cerberus Stores is UTF-16LE (BOM `fffe`), everything else UTF-8 with BOM.
- **Container differs**: Cerberus Stores is plain `.xml`, the rest `.gz`. Laib uses `StoresFull…xml.gz`.
- **`<City>` is a CBS settlement code** (e.g. `3000` = ירושלים), not a name — needs a lookup table.
- Tag is `ManufactureName` (not `ManufacturerName`); values may be `---`, `undefined`, `לא ידוע`.
- **Rami Levy truncates `ItemName` to ~20 chars** (`חלב תנובה 3% שומן 2`). Shufersal names are abbreviated (`חלב נטו.לקטוז מועשר2% 1ל`).
- `UnitQty`/`QtyInPackage` may be `לא ידוע`.
- **Barcodes are shared across chains** for packaged goods (49% of a Shufersal branch's items
  appear in a Rami Levy branch with the same `ItemCode`).
- **Produce uses chain-internal codes that look like barcodes** (`7290000000046` מלפפון at Shufersal vs
  `7290000001014` at Rami Levy), `ItemType` is still `1`. Rule: `bIsWeighted=1` or prefix `729000000`
  → key as `chain:code`, match produce by name within each chain.
- **Cerberus listings contain stale files** in other naming schemes (lower-case `pricefull…-039-…` from
  months ago, Yohananof `PriceFull…-7999-2024…`). Pick the newest per store by the timestamp parsed
  from the file name, never by lexical sort.
- Shufersal file links are signed Azure blob URLs that expire (~40 min) — download right after listing.
- `*.publishedprices.co.il` chains to "SSL.com TLS RSA Root CA 2022": Node 22+ accepts it, older curl CA bundles don't.
