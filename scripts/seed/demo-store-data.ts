import { normalizeHebrewText } from "@/src/application/classification/normalize-hebrew-text";
import type { MapEdge } from "@/src/domain/entities/map-edge";
import type { MapNode } from "@/src/domain/entities/map-node";
import type { Product, ProductCategory } from "@/src/domain/entities/product";
import type { ProductListing } from "@/src/domain/entities/product-listing";
import type { Promotion } from "@/src/domain/entities/promotion";
import type { Store } from "@/src/domain/entities/store";

export const CHAIN_ID = "supertov";
export const STORE_ID = "store-ramat-gan-1";

const SEEDED_AT = "2026-07-20T00:00:00.000Z";

export const demoStore: Store = {
  id: STORE_ID,
  chainId: CHAIN_ID,
  name: "סופר טוב – רמת גן",
  address: "רחוב ביאליק 15, רמת גן",
  city: "רמת גן",
  mapImageUrl: "/store-maps/ramat-gan-1.svg",
  mapWidth: 1000,
  mapHeight: 1000,
  isActive: true,
  promotionsEnabled: true,
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
};

function node(
  id: string,
  type: MapNode["type"],
  label: string,
  x: number,
  y: number,
  zone?: string,
): MapNode {
  return { id, storeId: STORE_ID, type, label, position: { x, y }, zone };
}

export const demoNodes: MapNode[] = [
  node("n-entrance", "entrance", "כניסה", 0.05, 0.9),
  node("n-produce", "department", "ירקות ופירות", 0.15, 0.9, "produce"),
  node("n-bakery", "department", "מאפייה", 0.3, 0.9, "bakery"),
  node("n-int-1", "waypoint", "צומת 1", 0.3, 0.6),
  node("n-dairy", "department", "מוצרי חלב", 0.3, 0.3, "dairy"),
  node("n-int-2", "waypoint", "צומת 2", 0.3, 0.1),
  node("n-frozen", "department", "קפואים", 0.5, 0.1, "frozen"),
  node("n-int-3", "waypoint", "צומת 3", 0.5, 0.6),
  node("n-meat-fish", "department", "בשר ודגים", 0.5, 0.9, "meat_fish"),
  node("n-pantry", "department", "מזון יבש ושימורים", 0.65, 0.55, "pantry"),
  node("n-beverages", "department", "משקאות", 0.75, 0.55, "beverages"),
  node("n-snacks", "department", "חטיפים", 0.85, 0.55, "snacks"),
  node("n-household", "department", "ניקיון וכלי בית", 0.85, 0.85, "household"),
  node("n-personal-care", "department", "טיפוח וקוסמטיקה", 0.7, 0.85, "personal_care"),
  node("n-checkout", "checkout", "קופות", 0.05, 0.55),
];

let edgeCounter = 0;
function edge(fromNodeId: string, toNodeId: string): MapEdge {
  edgeCounter += 1;
  return {
    id: `e-${edgeCounter}`,
    storeId: STORE_ID,
    fromNodeId,
    toNodeId,
    bidirectional: true,
  };
}

export const demoEdges: MapEdge[] = [
  edge("n-entrance", "n-produce"),
  edge("n-produce", "n-bakery"),
  edge("n-bakery", "n-int-1"),
  edge("n-int-1", "n-dairy"),
  edge("n-dairy", "n-int-2"),
  edge("n-int-2", "n-frozen"),
  edge("n-frozen", "n-int-3"),
  edge("n-int-3", "n-meat-fish"),
  edge("n-int-3", "n-pantry"),
  edge("n-pantry", "n-beverages"),
  edge("n-beverages", "n-snacks"),
  edge("n-snacks", "n-household"),
  edge("n-household", "n-personal-care"),
  edge("n-personal-care", "n-int-1"),
  edge("n-meat-fish", "n-checkout"),
  edge("n-int-1", "n-checkout"),
  edge("n-entrance", "n-checkout"),
];

let productCounter = 0;
const demoProductListingsBuilder: ProductListing[] = [];
function product(params: {
  canonicalName: string;
  aliases?: string[];
  category: ProductCategory;
  department: string;
  nodeId: string;
}): Product {
  productCounter += 1;
  const id = `prod-${productCounter}`;
  const aliases = params.aliases ?? [];
  const normalizedAliases = Array.from(
    new Set([params.canonicalName, ...aliases].map(normalizeHebrewText)),
  );
  demoProductListingsBuilder.push({
    id: `listing-${productCounter}`,
    productId: id,
    storeId: STORE_ID,
    nodeId: params.nodeId,
  });
  return {
    id,
    canonicalName: params.canonicalName,
    aliases,
    normalizedAliases,
    category: params.category,
    department: params.department,
    isActive: true,
  };
}

export const demoProducts: Product[] = [
  // ירקות ופירות
  product({
    canonicalName: "עגבניות",
    aliases: ["עגבניה"],
    category: "produce",
    department: "ירקות ופירות",
    nodeId: "n-produce",
  }),
  product({
    canonicalName: "מלפפונים",
    aliases: ["מלפפון"],
    category: "produce",
    department: "ירקות ופירות",
    nodeId: "n-produce",
  }),
  product({
    canonicalName: "תפוחי עץ",
    aliases: ["תפוח עץ", "תפוח"],
    category: "produce",
    department: "ירקות ופירות",
    nodeId: "n-produce",
  }),
  product({
    canonicalName: "בננות",
    aliases: ["בננה"],
    category: "produce",
    department: "ירקות ופירות",
    nodeId: "n-produce",
  }),
  product({
    canonicalName: "בצל יבש",
    aliases: ["בצל"],
    category: "produce",
    department: "ירקות ופירות",
    nodeId: "n-produce",
  }),
  product({
    canonicalName: "תפוחי אדמה",
    aliases: ["תפוד", "תפודים", "תפוח אדמה"],
    category: "produce",
    department: "ירקות ופירות",
    nodeId: "n-produce",
  }),
  // מאפייה
  product({
    canonicalName: "לחם אחיד פרוס",
    aliases: ["לחם"],
    category: "bakery",
    department: "מאפייה",
    nodeId: "n-bakery",
  }),
  product({
    canonicalName: "חלה",
    category: "bakery",
    department: "מאפייה",
    nodeId: "n-bakery",
  }),
  product({
    canonicalName: "בגט",
    category: "bakery",
    department: "מאפייה",
    nodeId: "n-bakery",
  }),
  product({
    canonicalName: "פיתות",
    aliases: ["פיתה"],
    category: "bakery",
    department: "מאפייה",
    nodeId: "n-bakery",
  }),
  product({
    canonicalName: "לחמניות המבורגר",
    aliases: ["לחמניות"],
    category: "bakery",
    department: "מאפייה",
    nodeId: "n-bakery",
  }),
  // מוצרי חלב
  product({
    canonicalName: "חלב 3% תנובה 1 ליטר",
    aliases: ["חלב תנובה", "חלב 3 אחוז", "חלב"],
    category: "dairy",
    department: "מוצרי חלב",
    nodeId: "n-dairy",
  }),
  product({
    canonicalName: "גבינה לבנה 5%",
    aliases: ["גבינה לבנה"],
    category: "dairy",
    department: "מוצרי חלב",
    nodeId: "n-dairy",
  }),
  product({
    canonicalName: "יוגורט טבעי",
    aliases: ["יוגורט"],
    category: "dairy",
    department: "מוצרי חלב",
    nodeId: "n-dairy",
  }),
  product({
    canonicalName: "גבינה צהובה פרוסה",
    aliases: ["גבינה צהובה"],
    category: "dairy",
    department: "מוצרי חלב",
    nodeId: "n-dairy",
  }),
  product({
    canonicalName: "חמאה",
    category: "dairy",
    department: "מוצרי חלב",
    nodeId: "n-dairy",
  }),
  product({
    canonicalName: "קוטג'",
    aliases: ["קוטג"],
    category: "dairy",
    department: "מוצרי חלב",
    nodeId: "n-dairy",
  }),
  // קפואים
  product({
    canonicalName: "אפונה קפואה",
    category: "frozen",
    department: "קפואים",
    nodeId: "n-frozen",
  }),
  product({
    canonicalName: "פיצה קפואה",
    category: "frozen",
    department: "קפואים",
    nodeId: "n-frozen",
  }),
  product({
    canonicalName: "שניצל עוף קפוא",
    aliases: ["שניצל"],
    category: "frozen",
    department: "קפואים",
    nodeId: "n-frozen",
  }),
  product({
    canonicalName: "גלידה",
    category: "frozen",
    department: "קפואים",
    nodeId: "n-frozen",
  }),
  product({
    canonicalName: "תירס קפוא",
    category: "frozen",
    department: "קפואים",
    nodeId: "n-frozen",
  }),
  // בשר ודגים
  product({
    canonicalName: "חזה עוף",
    aliases: ["עוף"],
    category: "meat_fish",
    department: "בשר ודגים",
    nodeId: "n-meat-fish",
  }),
  product({
    canonicalName: "קציצות בקר",
    aliases: ["קציצות"],
    category: "meat_fish",
    department: "בשר ודגים",
    nodeId: "n-meat-fish",
  }),
  product({
    canonicalName: "נקניקיות",
    category: "meat_fish",
    department: "בשר ודגים",
    nodeId: "n-meat-fish",
  }),
  product({
    canonicalName: "פילה סלמון",
    aliases: ["סלמון"],
    category: "meat_fish",
    department: "בשר ודגים",
    nodeId: "n-meat-fish",
  }),
  product({
    canonicalName: "טונה בקופסה",
    aliases: ["טונה"],
    category: "meat_fish",
    department: "בשר ודגים",
    nodeId: "n-meat-fish",
  }),
  // מזון יבש ושימורים
  product({
    canonicalName: "אורז",
    category: "pantry",
    department: "מזון יבש ושימורים",
    nodeId: "n-pantry",
  }),
  product({
    canonicalName: "פסטה פנה",
    aliases: ["פסטה"],
    category: "pantry",
    department: "מזון יבש ושימורים",
    nodeId: "n-pantry",
  }),
  product({
    canonicalName: "קמח לבן",
    aliases: ["קמח"],
    category: "pantry",
    department: "מזון יבש ושימורים",
    nodeId: "n-pantry",
  }),
  product({
    canonicalName: "סוכר",
    category: "pantry",
    department: "מזון יבש ושימורים",
    nodeId: "n-pantry",
  }),
  product({
    canonicalName: "שימורי תירס",
    category: "pantry",
    department: "מזון יבש ושימורים",
    nodeId: "n-pantry",
  }),
  product({
    canonicalName: "טחינה גולמית",
    aliases: ["טחינה"],
    category: "pantry",
    department: "מזון יבש ושימורים",
    nodeId: "n-pantry",
  }),
  product({
    canonicalName: "רסק עגבניות",
    category: "pantry",
    department: "מזון יבש ושימורים",
    nodeId: "n-pantry",
  }),
  // משקאות
  product({
    canonicalName: "קוקה קולה 1.5 ליטר",
    aliases: ["קולה", "קוקה קולה", "Coke", "Coca Cola"],
    category: "beverages",
    department: "משקאות",
    nodeId: "n-beverages",
  }),
  product({
    canonicalName: "מים מינרליים",
    aliases: ["מים"],
    category: "beverages",
    department: "משקאות",
    nodeId: "n-beverages",
  }),
  product({
    canonicalName: "מיץ תפוזים",
    category: "beverages",
    department: "משקאות",
    nodeId: "n-beverages",
  }),
  product({
    canonicalName: "בירה",
    category: "beverages",
    department: "משקאות",
    nodeId: "n-beverages",
  }),
  product({
    canonicalName: "קפה נמס",
    aliases: ["קפה"],
    category: "beverages",
    department: "משקאות",
    nodeId: "n-beverages",
  }),
  // חטיפים
  product({
    canonicalName: "ביסלי גריל",
    aliases: ["ביסלי"],
    category: "snacks",
    department: "חטיפים",
    nodeId: "n-snacks",
  }),
  product({
    canonicalName: "במבה",
    category: "snacks",
    department: "חטיפים",
    nodeId: "n-snacks",
  }),
  product({
    canonicalName: "שוקולד חלב",
    aliases: ["שוקולד"],
    category: "snacks",
    department: "חטיפים",
    nodeId: "n-snacks",
  }),
  product({
    canonicalName: "עוגיות פתי בר",
    aliases: ["עוגיות"],
    category: "snacks",
    department: "חטיפים",
    nodeId: "n-snacks",
  }),
  product({
    canonicalName: "פופקורן",
    category: "snacks",
    department: "חטיפים",
    nodeId: "n-snacks",
  }),
  // ניקיון וכלי בית
  product({
    canonicalName: "נייר טואלט",
    category: "household",
    department: "ניקיון וכלי בית",
    nodeId: "n-household",
  }),
  product({
    canonicalName: "אקונומיקה",
    category: "household",
    department: "ניקיון וכלי בית",
    nodeId: "n-household",
  }),
  product({
    canonicalName: "סבון כלים",
    category: "household",
    department: "ניקיון וכלי בית",
    nodeId: "n-household",
  }),
  product({
    canonicalName: "שקיות אשפה",
    category: "household",
    department: "ניקיון וכלי בית",
    nodeId: "n-household",
  }),
  product({
    canonicalName: "מגבות נייר",
    category: "household",
    department: "ניקיון וכלי בית",
    nodeId: "n-household",
  }),
  // טיפוח וקוסמטיקה
  product({
    canonicalName: "שמפו",
    category: "personal_care",
    department: "טיפוח וקוסמטיקה",
    nodeId: "n-personal-care",
  }),
  product({
    canonicalName: "משחת שיניים",
    category: "personal_care",
    department: "טיפוח וקוסמטיקה",
    nodeId: "n-personal-care",
  }),
  product({
    canonicalName: "סבון גוף",
    category: "personal_care",
    department: "טיפוח וקוסמטיקה",
    nodeId: "n-personal-care",
  }),
  product({
    canonicalName: "דאודורנט",
    category: "personal_care",
    department: "טיפוח וקוסמטיקה",
    nodeId: "n-personal-care",
  }),
  product({
    canonicalName: "מברשת שיניים",
    category: "personal_care",
    department: "טיפוח וקוסמטיקה",
    nodeId: "n-personal-care",
  }),
];

export const demoProductListings: ProductListing[] = demoProductListingsBuilder;

export const demoPromotions: Promotion[] = [
  {
    id: "promo-yogurt-tnuva",
    chainId: CHAIN_ID,
    storeId: STORE_ID,
    title: "יוגורט טבעי תנובה — 2 ב-10 ₪",
    description: "על הדרך שלכם: יוגורט טבעי תנובה במבצע 2 יחידות ב-10 ש\"ח.",
    attachedNodeId: "n-dairy",
    isSponsored: true,
    isActive: true,
    frequencyCapPerSession: 3,
  },
  {
    id: "promo-cola-family",
    chainId: CHAIN_ID,
    storeId: STORE_ID,
    title: "קוקה קולה משפחתי — מבצע השבוע",
    description: "בקבוק קוקה קולה 1.5 ליטר במחיר מיוחד השבוע בלבד.",
    attachedNodeId: "n-beverages",
    isSponsored: true,
    isActive: true,
    frequencyCapPerSession: 3,
  },
  {
    id: "promo-bamba",
    chainId: CHAIN_ID,
    storeId: STORE_ID,
    title: "במבה אוסם — קנה 2 קבל 1",
    description: "אתם כבר עוברים כאן: במבה אוסם בקנה 2 קבל 1 מתנה.",
    attachedNodeId: "n-snacks",
    isSponsored: true,
    isActive: true,
    frequencyCapPerSession: 1,
  },
  {
    id: "promo-fresh-bread",
    chainId: CHAIN_ID,
    storeId: STORE_ID,
    title: "לחם טרי מהתנור — 20% הנחה עד 10:00",
    description: "לחם טרי שיצא הבוקר מהתנור, 20% הנחה עד השעה 10:00.",
    attachedNodeId: "n-bakery",
    isSponsored: true,
    isActive: true,
    frequencyCapPerSession: 3,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-12-31T23:59:59.000Z",
  },
  {
    id: "promo-shampoo",
    chainId: CHAIN_ID,
    storeId: STORE_ID,
    title: "שמפו הד אנד שולדרס — מבצע",
    description: "שמפו הד אנד שולדרס במחיר מבצע.",
    attachedNodeId: "n-personal-care",
    isSponsored: true,
    isActive: false,
    frequencyCapPerSession: 3,
  },
];
