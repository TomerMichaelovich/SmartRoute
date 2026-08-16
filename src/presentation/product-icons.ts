import type { MapNodeType } from "@/src/domain/entities/map-node";

export interface ProductIcon {
  key: string;
  labelHe: string;
  src: string;
  /** If set, dropping this icon on empty canvas defaults the new node's type to this instead of "department". */
  defaultNodeType?: MapNodeType;
}

/**
 * Catalog of product-class icons for the admin store-layout editor. Presentation-layer only
 * (not domain/application) - routing and classification never depend on which icon a node has.
 */
export const PRODUCT_ICONS: ProductIcon[] = [
  { key: "entrance", labelHe: "כניסה", src: "/icons/products/entrance.png", defaultNodeType: "entrance" },
  { key: "checkout", labelHe: "קופה", src: "/icons/products/checkout.png", defaultNodeType: "checkout" },
  { key: "dairy", labelHe: "מוצרי חלב", src: "/icons/products/dairy.png" },
  { key: "vegetables", labelHe: "ירקות", src: "/icons/products/vegetables.png" },
  { key: "fruit", labelHe: "פירות", src: "/icons/products/fruit.png" },
  { key: "bakery", labelHe: "מאפיה", src: "/icons/products/bakery.png" },
  { key: "meat", labelHe: "בשרים", src: "/icons/products/meat.png" },
  { key: "poultry", labelHe: "עופות", src: "/icons/products/poultry.png" },
  { key: "fish", labelHe: "דגים", src: "/icons/products/fish.png" },
  { key: "eggs", labelHe: "ביצים", src: "/icons/products/eggs.png" },
  { key: "grains", labelHe: "דגנים", src: "/icons/products/grains.png" },
  { key: "dry-staples", labelHe: "מזון יבש ומוצרי בסיס", src: "/icons/products/dry-staples.png" },
  { key: "snacks", labelHe: "חטיפים ונשנושים", src: "/icons/products/snacks.png" },
  { key: "beverages", labelHe: "משקאות", src: "/icons/products/beverages.png" },
  { key: "wine-alcohol", labelHe: "יינות ואלכוהול", src: "/icons/products/wine-alcohol.png" },
  { key: "organic-natural", labelHe: "מזון אורגני וטבעי", src: "/icons/products/organic-natural.png" },
  { key: "gluten-free", labelHe: "ללא גלוטן", src: "/icons/products/gluten-free.png" },
  { key: "baby-products", labelHe: "מוצרי תינוקות", src: "/icons/products/baby-products.png" },
  { key: "pet-products", labelHe: "מוצרי בעלי חיים", src: "/icons/products/pet-products.png" },
  { key: "personal-care", labelHe: "טיפוח אישי", src: "/icons/products/personal-care.png" },
  { key: "toiletries", labelHe: "טואליטיקה", src: "/icons/products/toiletries.png" },
  { key: "pharmacy", labelHe: "פארם", src: "/icons/products/pharmacy.png" },
  { key: "cleaning", labelHe: "מוצרי ניקיון", src: "/icons/products/cleaning.png" },
  { key: "kitchenware", labelHe: "כלי בית ומטבח", src: "/icons/products/kitchenware.png" },
  { key: "cakes-cookies", labelHe: "עוגות ועוגיות", src: "/icons/products/cakes-cookies.png" },
  { key: "chocolate-sweets", labelHe: "שוקולדים ומתוקים", src: "/icons/products/chocolate-sweets.png" },
  { key: "cold-drinks", labelHe: "שתייה קרה", src: "/icons/products/cold-drinks.png" },
  { key: "disposable", labelHe: "חד פעמי", src: "/icons/products/disposable.png" },
  { key: "mail", labelHe: "דואר", src: "/icons/products/mail.png" },
];

const PRODUCT_ICONS_BY_KEY = new Map(PRODUCT_ICONS.map((icon) => [icon.key, icon]));

export function findProductIcon(key: string | undefined): ProductIcon | undefined {
  return key ? PRODUCT_ICONS_BY_KEY.get(key) : undefined;
}
