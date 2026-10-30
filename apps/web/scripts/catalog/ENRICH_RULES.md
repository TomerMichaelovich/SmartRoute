# Enriching a chunk of price-file items

Each chunk (`work/<chain>-<store>/in/chunk-NNN.jsonl`) holds up to 200 items from a
supermarket branch's price-transparency file, one JSON object per line:
`{itemKey, name, manufacturer, quantity, unitQty, isWeighted}`. The names are the
chain's own: abbreviated, often cut off at about 22 characters, sometimes with promo
marks.

Write `work/<chain>-<store>/out/chunk-NNN.json`: a JSON array with exactly one
object per input line, in the same order:

```json
[{ "itemKey": "...", "name": "...", "aliases": ["...", "..."], "group": "..." }]
```

Then check it: `npx tsx scripts/catalog/validate-enrichment.ts --chain=<chain> --store-code=<store> --chunk=NNN`
(run from `apps/web`) and fix anything it reports.

## name: what the item is, readable

- Full Hebrew name in this order: type, variant, brand, size.
  "חלב טרי 3% 1 ל תנובה" -> "חלב טרי 3% תנובה 1 ליטר".
- Expand abbreviations and finish words cut off at the end, using the manufacturer,
  quantity and unitQty fields. Don't invent what you can't tell: if a flavor or
  variant is cut off and can't be inferred, leave it out rather than guess.
- Drop promo marks (`*מבצע*`), internal codes and stray punctuation.
- The chain's own brand is a brand: "אורז בסמטי 1ק"ג רמי" -> "אורז בסמטי רמי לוי 1 ק"ג".
- Weighted items (`isWeighted: true`) are sold by weight: no size ("עגבניות", "גבינה צהובה עמק במשקל").
- At most 60 characters.

## aliases: what a shopper writes in a shopping list to mean this item

3 to 8 short phrases, the way people actually write lists:

- The type a shopper would write: "חלב", "חלב 3%", "קוטג'", "שמפו".
- **The bare type word only for the ordinary version of that type.** Plain 3% milk
  gets "חלב"; chocolate milk gets "שוקו", lactose-free milk gets "חלב נטול לקטוז",
  never the bare "חלב". Strawberry yogurt gets "יוגורט תות", not just "יוגורט" -
  unless it's the plain one.
- Brand + type ("חלב תנובה", "שמפו הד אנד שולדרס"), and the brand alone where people
  use it as the product's name ("במבה", "ביסלי", "נס קפה", "קוטג'").
- Common spelling variants and abbreviations ("קוטג", "שוקו", "עגבניות שרי" / "שרי").
- The colloquial name, even when it isn't literally true: malt is "בירה שחורה" (though
  it has no alcohol), Bamba is "במבה", disposable cups are "כוסות חד פעמי".
- Hebrew, the way it's spoken - not English, unless that's how people write it.
- Not the size alone, not the barcode, not a repeat of the name.
- **Test every alias: if a shopper writes exactly this, is this item a sensible answer?**
  If they'd mean something else, drop it:
  - Never a company name alone: "שטראוס", "תנובה", "אסם", "יכין", "עסיס", "מימונס",
    "פרסקו" each name hundreds of products. Brand + type is fine ("עוגיות הגביע").
  - Never a whole category word: "חטיף", "חטיפים", "חומר ניקוי", "עשבי תיבול",
    "ממתקים", "שוקולד" alone on a filled wafer.
  - Never a word that names a different, more usual product: a date bar is not
    "תמרים", Mentos is not "מנטה", a cooler box is not "קולר", a niddah cloth is
    not "פדים".
- Many items share aliases ("חלב" will name many milks). That's expected: the app
  asks the shopper when it matters.

## group: where it stands in the store

Exactly one id from `SHELF_GROUPS` in
`packages/core/domain/value-objects/shelf-group.ts`. Choose by where the item
physically sits in an Israeli supermarket, not just what it is:

- Refrigerated vs. shelf vs. frozen are different places: fresh milk `fresh-milk`,
  long-life milk `long-life-milk` (only when the name says so: "עמיד", "UHT",
  "לאורך זמן" - milk in a carton, bag or bottle is fresh); refrigerated hummus `chilled-salads-dips`, canned
  chickpeas `canned-legumes`; frozen schnitzel `frozen-chicken`.
- Weighted items are usually produce, the deli or butcher counter, fresh bread, or
  nuts/dried fruit sold by weight.
- Non-food has groups too (clothing, toys, small appliances, garden, tools...).
- Not something taken off a shelf - delivery fees, coupons ("ה.נ קופון"), deposits,
  club sign-up, "פריט כללי" - is `not-a-product`, with `aliases: []`.

## Examples

```json
[
  { "itemKey": "7290004131074", "name": "חלב טרי 3% תנובה 1 ליטר",
    "aliases": ["חלב", "חלב 3%", "חלב תנובה", "חלב טרי", "חלב בקרטון"], "group": "fresh-milk" },
  { "itemKey": "7290000066318", "name": "במבה אסם 80 גרם",
    "aliases": ["במבה", "חטיף במבה", "במבה אסם", "במבה קטנה"], "group": "salty-snacks" },
  { "itemKey": "7290119672073", "name": "אורז בסמטי רמי לוי 1 ק\"ג",
    "aliases": ["אורז", "אורז בסמטי", "בסמטי", "אורז רמי לוי"], "group": "rice" },
  { "itemKey": "7290008757034", "name": "שוקו תנובה בקבוק 1 ליטר",
    "aliases": ["שוקו", "שוקו תנובה", "משקה שוקו", "שוקו בקבוק"], "group": "flavored-milk-drinks" },
  { "itemKey": "rami-levy:7290000000123", "name": "עגבניות שרי במשקל",
    "aliases": ["עגבניות שרי", "שרי", "עגבניות"], "group": "vegetables" },
  { "itemKey": "rami-levy:9900000000045", "name": "דמי משלוח אתר אינטרנט",
    "aliases": [], "group": "not-a-product" }
]
```

("עגבניות שרי" gets the plain "עגבניות" because cherry tomatoes are a usual answer
to "עגבניות"; "שוקו" never gets the bare "חלב".)
