import type { AdminSection } from "@smartroute/core/domain/entities/admin-user";

export const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  stores: "סניפים (כל הסניפים, כולל יצירה ומחיקה)",
  products: "מוצרים וכינויים",
  promotions: "מבצעים",
  customers: "משתמשי האפליקציה",
  analytics: "אנליטיקס",
  // Whoever manages admin users can grant themselves anything - this one is effectively full access.
  staff: "משתמשי ניהול והרשאות (בפועל גישה מלאה: יכול להעניק לעצמו כל הרשאה)",
};
