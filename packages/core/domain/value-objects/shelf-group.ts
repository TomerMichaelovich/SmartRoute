import type { ProductCategory } from "../entities/product";

/**
 * Where an item stands in a store: a set of items an admin places on one map node
 * at once ("חלב טרי" -> the milk fridge). Groups follow how stores keep things, not
 * just what they are - fresh milk and long-life milk, packaged bread and the bakery,
 * packaged cheese and the deli counter are different groups - so one group rarely
 * spans two places. Only chain products imported from a branch's price file have one
 * (Product.shelfGroup); department/category of those products come from the group.
 *
 * Ids are stable: imported products and enrichment files store them.
 */
export interface ShelfGroup {
  id: string;
  name: string;
  department: string;
  category: ProductCategory;
}

/** Not something a shopper picks off a shelf (delivery fees, coupons, deposits, club sign-up): never imported. */
export const NOT_A_PRODUCT_GROUP = "not-a-product";

type GroupDef = [id: string, name: string, category?: ProductCategory];

function department(name: string, category: ProductCategory, groups: GroupDef[]): ShelfGroup[] {
  return groups.map(([id, groupName, groupCategory]) => ({
    id,
    name: groupName,
    department: name,
    category: groupCategory ?? category,
  }));
}

export const SHELF_GROUPS: readonly ShelfGroup[] = [
  ...department("ירקות ופירות", "produce", [
    ["vegetables", "ירקות טריים"],
    ["fruits", "פירות טריים"],
    ["fresh-herbs-leaves", "עשבי תיבול ועלים טריים"],
    ["mushrooms", "פטריות טריות"],
    ["cut-vegetables-sprouts", "ירקות חתוכים, סלטים ארוזים ונבטים"],
  ]),
  ...department("מאפייה", "bakery", [
    ["fresh-bread", "לחם טרי מהמאפייה"],
    ["packaged-bread", "לחם ארוז ופרוס"],
    ["rolls-buns", "לחמניות ובאגטים"],
    ["pita-wraps", "פיתות, לאפות וטורטיות"],
    ["bakery-cakes-pastries", "עוגות ומאפים טריים מהמאפייה"],
  ]),
  ...department("מוצרי חלב", "dairy", [
    ["fresh-milk", "חלב טרי"],
    ["flavored-milk-drinks", "שוקו ומשקאות חלב בטעמים"],
    ["plant-milk", "משקאות צמחיים (סויה, שקדים, שיבולת שועל)"],
    ["yogurt", "יוגורטים ומשקאות יוגורט"],
    ["dairy-desserts", "מעדנים ופודינגים"],
    ["white-cheese", "גבינות לבנות, קוטג' ושמנת לבישול"],
    ["yellow-cheese", "גבינות צהובות ארוזות"],
    ["salty-cheese", "גבינות מלוחות, בולגרית ופטה"],
    ["specialty-cheese", "גבינות משובחות ומיובאות"],
    ["cream", "שמנת מתוקה וחמוצה"],
    ["butter-margarine", "חמאה ומרגרינה"],
    ["eggs", "ביצים"],
    ["vegan-dairy-alternatives", "תחליפי גבינה ויוגורט טבעוניים"],
  ]),
  ...department("מעדנייה", "meat_fish", [
    ["deli-counter", "דלפק מעדנייה (במשקל)"],
    ["packaged-cold-cuts", "נקניקים ופסטרמות ארוזים"],
    ["sausages-hotdogs", "נקניקיות"],
    ["chilled-salads-dips", "חומוס, טחינה וסלטים מקוררים"],
    ["smoked-pickled-fish", "דגים מעושנים, מלוחים וכבושים"],
    ["chilled-tofu-meat-alternatives", "טופו ותחליפי בשר מקוררים"],
    ["chilled-ready-meals", "מנות מוכנות ופסטה טרייה מקוררות"],
  ]),
  ...department("בשר ודגים", "meat_fish", [
    ["butcher-counter", "קצבייה - בשר טרי בהזמנה"],
    ["packaged-fresh-meat", "בשר בקר וטלה טרי ארוז"],
    ["fresh-poultry", "עוף והודו טריים"],
    ["fresh-ground-meat-kebab", "בשר טחון, קבבים והמבורגרים טריים"],
    ["fresh-fish", "דגים טריים"],
  ]),
  ...department("קפואים", "frozen", [
    ["frozen-vegetables", "ירקות קפואים"],
    ["frozen-fruit", "פירות קפואים"],
    ["frozen-potatoes", "צ'יפס ותפוחי אדמה קפואים"],
    ["frozen-chicken", "עוף ומוצרי עוף קפואים (שניצל, נאגטס)"],
    ["frozen-meat", "בשר, המבורגרים וקבבים קפואים"],
    ["frozen-fish", "דגים ופירות ים קפואים"],
    ["frozen-meat-alternatives", "תחליפי בשר קפואים"],
    ["frozen-dough-pastries", "בצקים ומאפים קפואים (בורקס, מלאווח, בצק עלים)"],
    ["frozen-pizza-meals", "פיצות ומנות מוכנות קפואות"],
    ["ice-cream", "גלידות וארטיקים"],
    ["frozen-desserts", "עוגות וקינוחים קפואים"],
    ["ice", "קרח"],
  ]),
  ...department("מזון יבש ושימורים", "pantry", [
    ["rice", "אורז"],
    ["pasta-noodles", "פסטה, פתיתים ואטריות"],
    ["legumes-grains", "קטניות ודגנים (עדשים, שעועית, בורגול, קינואה)"],
    ["flour-baking", "קמח ומוצרי אפייה (שמרים, אבקת אפייה)"],
    ["dessert-mixes", "אבקות פודינג, ג'לי, תערובות עוגה וקישוטים"],
    ["sugar-sweeteners", "סוכר וממתיקים"],
    ["oil", "שמן"],
    ["vinegar-lemon-juice", "חומץ ומיץ לימון"],
    ["spices", "תבלינים ומלח"],
    ["soup-powders", "אבקות מרק ותיבול"],
    ["sauces", "רטבים לבישול ורוטב עגבניות"],
    ["condiments", "קטשופ, מיונז, חרדל ורטבי סלט"],
    ["asian-cooking", "מטבח אסייתי (רוטב סויה, דפי אורז, חלב קוקוס)"],
    ["canned-vegetables", "שימורי ירקות ועגבניות"],
    ["canned-legumes", "שימורי קטניות וחומוס"],
    ["pickles-olives", "חמוצים וזיתים"],
    ["canned-fish", "טונה ושימורי דגים"],
    ["canned-fruit", "שימורי פירות"],
    ["canned-ready-meals", "תבשילים ומנות מוכנות בשימורים"],
    ["tahini-halva", "טחינה גולמית וחלבה"],
    ["sweet-spreads", "ריבות, דבש, סילאן וממרחים מתוקים"],
    ["peanut-butter-spreads", "חמאת בוטנים וממרחי אגוזים"],
    ["breakfast-cereals", "דגני בוקר"],
    ["oats-granola", "שיבולת שועל וגרנולה"],
    ["crackers-rice-cakes", "קרקרים ופריכיות"],
    ["breadcrumbs-croutons", "פירורי לחם וקרוטונים"],
    ["instant-meals", "מנות חמות ונודלס אינסטנט"],
    ["coffee", "קפה טחון, נמס ושחור"],
    ["coffee-capsules", "קפסולות קפה"],
    ["tea", "תה וחליטות"],
    ["cocoa-creamers", "אבקות שוקו ומלבין קפה"],
    ["long-life-milk", "חלב עמיד ואבקת חלב"],
    ["health-food", "מזון בריאות, אורגני וזרעים (צ'יה, פשתן)"],
    ["gluten-free", "מוצרים ללא גלוטן"],
    ["matza", "מצות ומוצרי פסח"],
  ]),
  ...department("פיצוחים ופירות יבשים", "snacks", [
    ["nuts-seeds", "אגוזים, בוטנים ופיצוחים"],
    ["dried-fruit", "פירות יבשים"],
  ]),
  ...department("חטיפים וממתקים", "snacks", [
    ["salty-snacks", "חטיפים מלוחים (במבה, ביסלי, צ'יפס, פופקורן)"],
    ["pretzels", "בייגלה ומקלות"],
    ["chocolate", "שוקולד וטבלאות"],
    ["chocolate-bars", "חטיפי שוקולד"],
    ["candy-gummies", "סוכריות וגומי"],
    ["gum-mints", "מסטיקים ומנטות"],
    ["cookies-biscuits", "עוגיות וביסקוויטים"],
    ["wafers", "ופלים"],
    ["packaged-cakes", "עוגות ארוזות ועוגיות מאפה"],
    ["cereal-protein-bars", "חטיפי דגנים וחלבון"],
  ]),
  ...department("משקאות", "beverages", [
    ["water", "מים מינרליים"],
    ["soda-water", "סודה ומים מוגזים"],
    ["soft-drinks", "משקאות קלים מוגזים"],
    ["juices", "מיצים ונקטרים"],
    ["chilled-fresh-juices", "מיצים טריים סחוטים (מקורר)"],
    ["syrups", "תרכיזים וסירופים"],
    ["iced-tea-flavored-water", "תה קר ומים בטעמים"],
    ["energy-sports-drinks", "משקאות אנרגיה וספורט"],
    ["beer", "בירה ובירה שחורה"],
    ["wine", "יין"],
    ["spirits", "משקאות חריפים וליקרים"],
  ]),
  ...department("ניקיון וכלי בית", "household", [
    ["laundry-detergent", "אבקות וג'לים לכביסה"],
    ["fabric-softener", "מרככי כביסה ובשמים לכביסה"],
    ["stain-removers-bleach", "מסירי כתמים ואקונומיקה"],
    ["dishwashing", "נוזל כלים ומוצרי מדיח"],
    ["surface-floor-cleaners", "חומרי ניקוי למשטחים ולרצפה"],
    ["bathroom-cleaners", "ניקוי אמבטיה ושירותים ומסירי אבנית"],
    ["air-fresheners", "מטהרי אוויר"],
    ["insecticides", "קוטלי חרקים"],
    ["cleaning-tools", "מטליות, ספוגים, מגבים וכפפות"],
    ["toilet-paper", "נייר טואלט"],
    ["paper-towels-napkins", "מגבות נייר, מפיות וממחטות"],
    ["garbage-bags", "שקיות אשפה"],
    ["foil-wrap-bags", "נייר כסף, ניילון נצמד, נייר אפייה ושקיות אחסון"],
    ["disposable-tableware", "כלים חד פעמיים ותבניות אלומיניום"],
    ["candles-matches", "נרות, גפרורים ומצתים"],
    ["batteries-bulbs", "סוללות ונורות"],
    ["laundry-accessories", "אביזרי כביסה וגיהוץ (אטבים, קולבים, סלים)"],
  ]),
  ...department("כלי בית ומטבח", "household", [
    ["cookware", "סירים, מחבתות וכלי בישול"],
    ["kitchen-utensils", "סכינים ואביזרי מטבח"],
    ["tableware", "צלחות, כוסות וכלי הגשה"],
    ["food-storage", "קופסאות אחסון ובקבוקים"],
    ["small-appliances", "מוצרי חשמל קטנים"],
    ["electronics-accessories", "אלקטרוניקה ואביזרים (אוזניות, כבלים, מטענים)"],
    ["home-textile", "מגבות, מצעים וטקסטיל לבית"],
    ["bathroom-accessories", "אביזרי אמבטיה"],
    ["home-storage", "אחסון וארגון לבית"],
  ]),
  ...department("בית וגן", "other", [
    ["tools-hardware", "כלי עבודה ותחזוקה"],
    ["garden", "גינה, זרעים ועציצים"],
    ["bbq-camping", "מנגל, פחמים וקמפינג"],
    ["seasonal-holiday", "מוצרי חג ועונה"],
  ]),
  ...department("טיפוח וקוסמטיקה", "personal_care", [
    ["shampoo-conditioner", "שמפו ומרכך"],
    ["hair-styling", "עיצוב שיער ומסכות לשיער"],
    ["hair-color", "צבעי שיער"],
    ["hair-accessories", "אביזרי שיער ומסרקים"],
    ["body-wash-soap", "סבונים ותחליבי רחצה"],
    ["deodorants", "דאודורנטים"],
    ["oral-care", "משחות שיניים, מברשות ומי פה"],
    ["shaving-hair-removal", "גילוח והסרת שיער"],
    ["feminine-hygiene", "היגיינה נשית"],
    ["skin-care", "קרמים וטיפוח העור"],
    ["sun-care", "הגנה מהשמש"],
    ["makeup-face-care", "איפור וטיפוח פנים"],
    ["cotton-pads", "צמר גפן, מקלוני אוזניים ופדים"],
    ["perfume", "בשמים"],
    ["grooming-tools", "אביזרי טיפוח (ציפורניים, פינצטות)"],
    ["adult-incontinence", "סופגים ותחתונים למבוגרים"],
    ["vitamins-supplements", "ויטמינים ותוספי תזונה"],
    ["pharmacy-first-aid", "פארם ועזרה ראשונה (פלסטרים, בדיקות, קונדומים)"],
  ]),
  ...department("תינוקות", "personal_care", [
    ["diapers", "חיתולים"],
    ["wipes", "מגבונים לחים"],
    ["infant-formula", "תמ\"ל"],
    ["baby-food", "מזון תינוקות ודייסות", "pantry"],
    ["baby-care", "טיפוח תינוקות"],
    ["baby-accessories", "אביזרי תינוקות (בקבוקים, מוצצים)"],
  ]),
  ...department("חיות מחמד", "other", [
    ["dog-food", "מזון וחטיפים לכלבים"],
    ["cat-food", "מזון וחטיפים לחתולים"],
    ["pet-supplies", "חול לחתולים ואביזרים לחיות"],
  ]),
  ...department("ביגוד והנעלה", "other", [
    ["clothing", "ביגוד"],
    ["socks-underwear", "גרביים והלבשה תחתונה"],
    ["footwear", "הנעלה"],
  ]),
  ...department("פנאי ומשרד", "other", [
    ["toys-games", "צעצועים ומשחקים"],
    ["stationery", "כלי כתיבה וציוד משרדי"],
    ["party-supplies", "מוצרי מסיבה ויום הולדת"],
    ["sports-leisure", "ספורט, פנאי ותיקים"],
    ["tobacco", "סיגריות וטבק"],
  ]),
  ...department("לא מוצר", "other", [[NOT_A_PRODUCT_GROUP, "לא מוצר (דמי משלוח, קופונים, פיקדון)"]]),
];

const byId = new Map(SHELF_GROUPS.map((group) => [group.id, group]));

export function findShelfGroup(id: string): ShelfGroup | undefined {
  return byId.get(id);
}
