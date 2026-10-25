import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { listAfterTrip, tripLeftovers } from "@smartroute/core/application/shopping-list/after-trip";
import { matchItemsToRemove } from "@smartroute/core/application/shopping-list/match-items";
import {
  formatListMessage,
  summarizeItems,
} from "@smartroute/core/application/shopping-list/format-list-message";
import {
  parseCarryAnswer,
  parseCommand,
  parseItemsMessage,
} from "@smartroute/core/application/shopping-list/parse-items-message";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import { verifySignature } from "@/src/infrastructure/whatsapp/client";

describe("parseItemsMessage", () => {
  it("splits on commas and new lines", () => {
    expect(parseItemsMessage("חלב, לחם\nביצים")).toEqual([
      { rawText: "חלב" },
      { rawText: "לחם" },
      { rawText: "ביצים" },
    ]);
  });

  it("reads a count before or after the item", () => {
    expect(parseItemsMessage("2 לחם, חלב x3, ביצים ×2, עגבניות 4, 2x גבינה")).toEqual([
      { rawText: "לחם", quantity: 2 },
      { rawText: "חלב", quantity: 3 },
      { rawText: "ביצים", quantity: 2 },
      { rawText: "עגבניות", quantity: 4 },
      { rawText: "גבינה", quantity: 2 },
    ]);
  });

  it("keeps sizes and percentages as part of the item", () => {
    expect(parseItemsMessage('2 ק"ג עגבניות, חלב 3%, קולה 1.5, 1.5 ליטר מים')).toEqual([
      { rawText: '2 ק"ג עגבניות' },
      { rawText: "חלב 3%" },
      { rawText: "קולה 1.5" },
      { rawText: "1.5 ליטר מים" },
    ]);
  });

  it("strips bullets, numbering and WhatsApp formatting", () => {
    expect(parseItemsMessage("- חלב\n• *לחם*\n1. ביצים\n2) גזר")).toEqual([
      { rawText: "חלב" },
      { rawText: "לחם" },
      { rawText: "ביצים" },
      { rawText: "גזר" },
    ]);
  });

  it("drops empty and number-only pieces, and a count of 1", () => {
    expect(parseItemsMessage("חלב,, ,\n 5 ,1 לחם")).toEqual([{ rawText: "חלב" }, { rawText: "לחם" }]);
  });
});

describe("parseCommand", () => {
  it("recognizes the link code", () => {
    expect(parseCommand("חיבור k7q2mx")).toEqual({ type: "link", code: "K7Q2MX" });
    expect(parseCommand("  חיבור: K7Q2MX ")).toEqual({ type: "link", code: "K7Q2MX" });
  });

  it("recognizes commands, ignoring trailing punctuation", () => {
    expect(parseCommand("רשימה")).toEqual({ type: "list" });
    expect(parseCommand("?")).toEqual({ type: "list" });
    expect(parseCommand("צא לקניות!")).toEqual({ type: "shop" });
    expect(parseCommand("צא לקניות 🛒")).toBeNull();
    expect(parseCommand("עזרה")).toEqual({ type: "help" });
    expect(parseCommand("נתק")).toEqual({ type: "unlink" });
  });

  it("treats anything else as items", () => {
    expect(parseCommand("חלב, לחם")).toBeNull();
    expect(parseCommand("רשימה של חלב")).toBeNull();
  });
});

describe("formatListMessage", () => {
  const items: ShoppingListItem[] = [
    { id: "1", rawText: "חלב", addedByUserId: "u1" },
    { id: "2", rawText: "גזר", checked: true },
    { id: "3", rawText: "לחם", quantity: 2, addedByUserId: "u2" },
  ];

  it("lists open items first and strikes through bought ones", () => {
    expect(formatListMessage("הבית", items, { u1: "עמית" })).toBe(
      ["*הבית* (2 פתוחים)", "1. חלב _(עמית)_", "2. לחם ×2", "", "נקנו:", "✓ ~גזר~"].join("\n"),
    );
  });

  it("says when the list is empty", () => {
    expect(formatListMessage("הבית", [])).toContain("הרשימה ריקה");
  });
});

describe("summarizeItems", () => {
  it("shortens long lists", () => {
    expect(summarizeItems(["א", "ב"])).toBe("א, ב");
    expect(summarizeItems(["א", "ב", "ג", "ד", "ה", "ו"], 4)).toBe("א, ב, ג, ד ועוד 2");
  });
});

describe("verifySignature", () => {
  const secret = "app-secret";
  const body = '{"entry":[]}';
  const good = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  it("accepts Meta's HMAC of the raw body", () => {
    expect(verifySignature(body, good, secret)).toBe(true);
  });

  it("rejects a missing, malformed or wrong signature", () => {
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, "abc", secret)).toBe(false);
    expect(verifySignature(body, good, "other-secret")).toBe(false);
    expect(verifySignature(`${body} `, good, secret)).toBe(false);
  });
});

describe("after a trip", () => {
  const items: ShoppingListItem[] = [
    { id: "milk", rawText: "חלב", checked: true, checkedByName: "עמית" },
    { id: "bread", rawText: "לחם" },
    { id: "eggs", rawText: "ביצים", notFound: true },
    { id: "carrot", rawText: "גזר" }, // added after the trip
  ];
  const trip = { tripItemIds: ["milk", "bread", "eggs"], leftoverItemIds: ["bread", "eggs"] };

  it("finds what wasn't bought", () => {
    expect(tripLeftovers(items, trip).map((i) => i.id)).toEqual(["bread", "eggs"]);
  });

  it("carries the leftovers over, unticked, when asked to", () => {
    expect(listAfterTrip(items, trip, true)).toEqual([
      { id: "bread", rawText: "לחם" },
      { id: "eggs", rawText: "ביצים" },
      { id: "carrot", rawText: "גזר" },
    ]);
  });

  it("starts clean otherwise, keeping only what was added after the trip", () => {
    expect(listAfterTrip(items, trip, false)).toEqual([{ id: "carrot", rawText: "גזר" }]);
  });
});

describe("parseCarryAnswer", () => {
  it("reads yes / no, including the button titles", () => {
    expect(parseCarryAnswer("כן")).toBe("yes");
    expect(parseCarryAnswer("כן, לצרף")).toBe("yes");
    expect(parseCarryAnswer("לא")).toBe("no");
    expect(parseCarryAnswer("לא, רשימה חדשה")).toBe("no");
    expect(parseCarryAnswer("חלב")).toBeNull();
  });
});

describe("removing items", () => {
  it("parses remove and undo commands", () => {
    expect(parseCommand("מחק גזר")).toEqual({ type: "remove", targets: ["גזר"] });
    expect(parseCommand("הסר גזר, חלב")).toEqual({ type: "remove", targets: ["גזר", "חלב"] });
    expect(parseCommand("מחק 3")).toEqual({ type: "remove", targets: ["3"] });
    expect(parseCommand("בטל")).toEqual({ type: "undo" });
    expect(parseCommand("מחק")).toBeNull();
  });

  const items: ShoppingListItem[] = [
    { id: "a", rawText: "חלב 3%" },
    { id: "b", rawText: "חלב סויה" },
    { id: "c", rawText: "גזר" },
    { id: "d", rawText: "לחם", checked: true },
    { id: "e", rawText: "גזר" },
  ];

  it("removes every exact copy", () => {
    expect(matchItemsToRemove(items, "גזר")).toEqual({ kind: "found", items: [items[2], items[4]] });
  });

  it("asks which one when a vague name fits several", () => {
    expect(matchItemsToRemove(items, "חלב")).toEqual({ kind: "ambiguous", items: [items[0], items[1]] });
    expect(matchItemsToRemove(items, "סויה")).toEqual({ kind: "found", items: [items[1]] });
  });

  it("uses the bot's numbering of open items", () => {
    expect(matchItemsToRemove(items, "4")).toEqual({ kind: "found", items: [items[4]] });
    expect(matchItemsToRemove(items, "9")).toEqual({ kind: "none" });
    expect(matchItemsToRemove(items, "במבה")).toEqual({ kind: "none" });
  });
});
