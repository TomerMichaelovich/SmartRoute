import "server-only";
import { listAfterTrip, tripLeftovers } from "@smartroute/core/application/shopping-list/after-trip";
import { formatListMessage, summarizeItems } from "@smartroute/core/application/shopping-list/format-list-message";
import {
  type BotCommand,
  parseCarryAnswer,
  parseCommand,
  parseItemsMessage,
} from "@smartroute/core/application/shopping-list/parse-items-message";
import {
  findOpenItemByName,
  matchItemsToRemove,
  openItems,
} from "@smartroute/core/application/shopping-list/match-items";
import type { ShoppingList, ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import type { User } from "@smartroute/core/domain/entities/user";
import {
  shoppingListRepository,
  userRepository,
  whatsappRepository,
} from "@/src/infrastructure/container";
import type {
  PendingDuplicate,
  WhatsAppLink,
  WhatsAppListReset,
} from "@/src/infrastructure/repositories/interfaces/whatsapp-repository";
import { sendButtons, sendCtaUrl, sendText } from "@/src/infrastructure/whatsapp/client";
import { resolveListAccessForUser } from "@/src/presentation/auth/list-access";
import { classifyLines } from "./create-list";
import { notifyItemsAdded, notifyListChanged } from "./list-push";

/**
 * The WhatsApp bot: people "throw" items at it during the week and they land in
 * their (shared) list; "צא לקניות" sends them to the list in the app, where
 * everything else (cheapest basket, route, checking items off) happens.
 * Each number is linked to one user + one list via a one-time code from the app.
 */

/** The parts of a webhook message the bot uses. */
export interface IncomingWhatsAppMessage {
  id: string;
  from: string;
  /** Text of a text message (or a tapped button's title); null for images, voice notes, etc. */
  text: string | null;
  /** Id of a tapped quick-reply button. */
  buttonId?: string | null;
}

export const BOT_NAME = "רשימת קניות - NAVIO";
const CARRY_YES = "carry_yes";
const CARRY_NO = "carry_no";
const DUP_YES = "dup_yes";
const DUP_NO = "dup_no";

const SHOP_BUTTON = "צא לקניות 🛒";

function siteBase(): string {
  return (process.env.NAVIO_APP_URL || "https://navio.co.il").replace(/\/$/, "");
}

function listUrl(list: ShoppingList): string {
  return `${siteBase()}/my-list/${list.shareCode}`;
}

function listName(list: ShoppingList): string {
  return list.name ?? "רשימת הקניות";
}

const HELP_TEXT = [
  "שלחו לי מוצרים ואוסיף אותם לרשימה.",
  "כמה מוצרים ביחד? *הפרידו בפסיק*, או כתבו כל מוצר בשורה נפרדת / בהודעה נפרדת:",
  "_חלב, 2 לחם, ביצים_",
  "",
  "פקודות:",
  "• *רשימה* - מה יש ברשימה (עם מספרים)",
  "• *מחק גזר* - הסרת מוצר (או *מחק 3* לפי המספר ברשימה)",
  "• *בטל* - ביטול ההוספה האחרונה שלך",
  "• *צא לקניות* - פתיחת הרשימה באפליקציה",
  "• *נתק* - ניתוק הוואטסאפ מהרשימה",
].join("\n");

const NOT_LINKED_TEXT = [
  `היי! 👋 כאן *${BOT_NAME}*.`,
  "כדי להתחבר, פתחו את הרשימה באפליקציה ולחצו *הוסף מוצרים מוואטסאפ*.",
].join("\n");

export async function handleIncomingMessage(message: IncomingWhatsAppMessage): Promise<void> {
  if (!(await whatsappRepository.markMessageProcessed(message.id))) return;

  const phone = message.from;
  const text = message.text?.trim() ?? "";
  const command = text ? parseCommand(text) : null;

  if (command?.type === "link") {
    await linkNumber(phone, command.code);
    return;
  }

  const link = await whatsappRepository.findLinkByPhone(phone);
  if (!link) {
    await sendText(phone, NOT_LINKED_TEXT);
    return;
  }
  await whatsappRepository.touchInbound(phone);

  const context = await loadLinkedContext(link);
  if (!context) {
    await whatsappRepository.deleteLink(phone);
    await sendText(
      phone,
      "כבר אין לך גישה לרשימה שהייתה מחוברת, אז ניתקתי אותה. אפשר להתחבר לרשימה אחרת מתוך האפליקציה.",
    );
    return;
  }
  const { user } = context;
  let { list } = context;

  if (!text) {
    await sendText(phone, "כרגע אפשר לשלוח לי רק הודעות טקסט. כתבו את המוצרים ואוסיף אותם 🙂");
    return;
  }

  if (command?.type !== "unlink") {
    const reset = await whatsappRepository.findListReset(list.id);
    if (reset) {
      if (await handleFinishedTrip(phone, user, list, reset, text, command, message.buttonId ?? null)) return;
      // Nothing to ask about - the fresh list is ready, carry on with the message.
      list = (await shoppingListRepository.findById(list.id)) ?? list;
    } else if (message.buttonId?.startsWith(REMOVE_BUTTON_PREFIX)) {
      // "למה התכוונת?" answered with a tap.
      await removeItems(phone, user, list, [], message.buttonId.slice(REMOVE_BUTTON_PREFIX.length));
      return;
    } else if (message.buttonId === CARRY_YES || message.buttonId === CARRY_NO) {
      // Someone else on the list already answered.
      await sendCtaUrl(phone, "כבר התחלנו רשימה חדשה ✓", SHOP_BUTTON, listUrl(list));
      return;
    }
  }

  // "כבר קיים ברשימה - להוסיף לכמות?" is waiting for an answer.
  if (link.pendingDuplicates.length > 0) {
    const answer =
      message.buttonId === DUP_YES ? "yes" : message.buttonId === DUP_NO ? "no" : command ? null : parseCarryAnswer(text);
    await whatsappRepository.setPendingDuplicates(phone, []);
    if (answer) {
      await answerDuplicates(phone, user, list, link.pendingDuplicates, answer === "yes");
      return;
    }
    // Anything else drops the question (nothing added) and is handled as usual.
  } else if (message.buttonId === DUP_YES || message.buttonId === DUP_NO) {
    await sendText(phone, "כבר טיפלתי בזה ✓");
    return;
  }

  switch (command?.type) {
    case "help":
      await sendCtaUrl(phone, `מחובר לרשימה "${listName(list)}".\n\n${HELP_TEXT}`, SHOP_BUTTON, listUrl(list));
      return;
    case "list":
      await sendList(phone, list);
      return;
    case "shop":
      await sendCtaUrl(phone, `הרשימה "${listName(list)}" מחכה לך באפליקציה. קניות נעימות!`, SHOP_BUTTON, listUrl(list));
      return;
    case "unlink":
      await whatsappRepository.deleteLink(phone);
      await sendText(phone, "ניתקתי את הוואטסאפ מהרשימה. אפשר להתחבר שוב מתוך האפליקציה בכל זמן.");
      return;
    case "remove":
      await removeItems(phone, user, list, command.targets);
      return;
    case "undo":
      await undoLastAdd(phone, user, list, link);
      return;
  }

  await addItems(phone, user, list, text);
}

const REMOVE_BUTTON_PREFIX = "rm:";

/**
 * "מחק גזר, חלב" / "מחק 3", or a tapped "which one?" button (`itemId`). Exact
 * names remove every copy; a vague name matching several items asks which one.
 */
async function removeItems(
  phone: string,
  user: User,
  list: ShoppingList,
  targets: string[],
  itemId?: string,
): Promise<void> {
  const toRemove = new Map<string, ShoppingListItem>();
  const notFound: string[] = [];
  let ambiguous: { target: string; items: ShoppingListItem[] } | null = null;

  if (itemId) {
    const item = list.items.find((i) => i.id === itemId);
    if (item) toRemove.set(item.id, item);
    else notFound.push("המוצר שבחרת");
  }
  for (const target of targets) {
    const match = matchItemsToRemove(list.items, target);
    if (match.kind === "found") for (const item of match.items) toRemove.set(item.id, item);
    else if (match.kind === "ambiguous") ambiguous ??= { target, items: match.items };
    else notFound.push(target);
  }

  for (const id of toRemove.keys()) await shoppingListRepository.removeItem(list.id, id);
  if (toRemove.size > 0) notifyListChanged(list, user.id);

  const lines: string[] = [];
  if (toRemove.size > 0) {
    lines.push(`🗑️ הוסר מהרשימה: ${summarizeItems([...toRemove.values()].map((i) => i.rawText), 6)}`);
  }
  if (notFound.length > 0) lines.push(`לא מצאתי ברשימה: ${notFound.join(", ")}`);

  if (ambiguous) {
    lines.push(`יש ברשימה כמה מוצרים שמתאימים ל"${ambiguous.target}". למה התכוונת?`);
    if (ambiguous.items.length <= 3) {
      await sendButtons(
        phone,
        lines.join("\n"),
        ambiguous.items.map((item) => ({ id: `${REMOVE_BUTTON_PREFIX}${item.id}`, title: item.rawText })),
      );
      return;
    }
    // More than WhatsApp's 3 buttons: point at the numbered list instead.
    const numbered = openItems(list.items);
    for (const item of ambiguous.items) {
      const n = numbered.indexOf(item) + 1;
      if (n > 0) lines.push(`${n}. ${item.rawText}`);
    }
    lines.push("", "כתבו *מחק* ואת המספר, למשל: מחק 2");
    await sendText(phone, lines.join("\n"));
    return;
  }

  if (toRemove.size === 0) lines.push("כתבו *רשימה* כדי לראות מה יש בה.");
  await sendCtaUrl(phone, lines.join("\n"), SHOP_BUTTON, listUrl(list));
}

/** "בטל": takes back exactly what this number's last message added. */
async function undoLastAdd(phone: string, user: User, list: ShoppingList, link: WhatsAppLink): Promise<void> {
  const ids = new Set(link.lastAddedItemIds);
  const items = list.items.filter((item) => ids.has(item.id));
  if (items.length === 0) {
    await sendText(phone, "אין הוספה אחרונה לבטל. כדי להסיר מוצר כתבו למשל *מחק גזר*.");
    return;
  }
  for (const item of items) await shoppingListRepository.removeItem(list.id, item.id);
  await whatsappRepository.setLastAdded(phone, []);
  notifyListChanged(list, user.id);
  await sendCtaUrl(
    phone,
    `↩️ ביטלתי את ההוספה האחרונה: ${summarizeItems(items.map((i) => i.rawText), 6)}`,
    SHOP_BUTTON,
    listUrl(list),
  );
}

/**
 * A trip on this list finished since the bot last saw it: start the next round.
 * Bought items go; if some weren't bought, ask whether to carry them over (items
 * sent meanwhile are kept and added after the answer). Returns false when there
 * was nothing to ask, so the caller handles the message as usual.
 */
async function handleFinishedTrip(
  phone: string,
  user: User,
  list: ShoppingList,
  reset: WhatsAppListReset,
  text: string,
  command: BotCommand | null,
  buttonId: string | null,
): Promise<boolean> {
  const leftovers = tripLeftovers(list.items, reset);
  if (leftovers.length === 0) {
    // Everything was bought: start fresh, show the rules again, then handle the message.
    if (await startNextRound(list.id, user.id, false)) {
      await sendText(phone, `🎉 הקנייה האחרונה הסתיימה, ומתחילים רשימה חדשה.\n\n${HELP_TEXT}`);
    }
    return false;
  }

  const answer =
    buttonId === CARRY_YES ? "yes" : buttonId === CARRY_NO ? "no" : reset.askedAt ? parseCarryAnswer(text) : null;

  if (answer) {
    const fresh = await startNextRound(list.id, user.id, answer === "yes");
    if (!fresh) return false; // Someone else answered a moment earlier - just handle the message.
    const confirmation =
      answer === "yes"
        ? `✅ צירפתי לרשימה החדשה ${leftovers.length} מוצרים שלא נקנו: ${summarizeItems(leftovers.map((i) => i.rawText))}`
        : "✨ מתחילים רשימה חדשה ונקייה.";
    // A new list starts with the rules, like the first time.
    if (reset.pendingText) {
      await sendText(phone, `${confirmation}\n\n${HELP_TEXT}`);
      await addItems(phone, user, fresh, reset.pendingText);
    } else {
      await sendCtaUrl(phone, `${confirmation}\n\n${HELP_TEXT}`, SHOP_BUTTON, listUrl(fresh));
    }
    return true;
  }

  // Not answered yet: remember any items sent meanwhile, and (re-)ask.
  const sentItems = command === null ? text : null;
  const pendingText = [reset.pendingText, sentItems].filter(Boolean).join("\n") || null;
  await whatsappRepository.markListResetAsked(list.id, pendingText);
  const lines = [
    "🎉 הקנייה האחרונה הסתיימה, ומתחילים רשימה חדשה.",
    `לא נקנו ${leftovers.length} מוצרים: ${summarizeItems(leftovers.map((i) => i.rawText), 6)}`,
    "",
    "לצרף את המוצרים שלא נקנו בפעם הקודמת לרשימה החדשה?",
  ];
  if (sentItems) lines.push("", "(את מה ששלחת עכשיו אוסיף מיד אחרי התשובה)");
  await sendButtons(phone, lines.join("\n"), [
    { id: CARRY_YES, title: "כן, לצרף" },
    { id: CARRY_NO, title: "לא, רשימה חדשה" },
  ]);
  return true;
}

/** Applies the fresh list (bought items dropped, leftovers kept or not) once - null if already done. */
async function startNextRound(listId: string, userId: string, carryLeftovers: boolean): Promise<ShoppingList | null> {
  const reset = await whatsappRepository.findListReset(listId);
  if (!reset || !(await whatsappRepository.deleteListReset(listId))) return null;
  const list = await shoppingListRepository.findById(listId);
  if (!list) return null;

  await shoppingListRepository.updateItems(list.id, listAfterTrip(list.items, reset, carryLeftovers), new Date().toISOString());
  // A finished (unpinned) list leaves the home screen; the new round brings it back.
  if (!list.isActive) await shoppingListRepository.reactivate(list.id);
  notifyListChanged(list, userId);
  return shoppingListRepository.findById(list.id);
}

async function linkNumber(phone: string, code: string): Promise<void> {
  const target = await whatsappRepository.consumeLinkCode(code);
  if (!target) {
    await sendText(phone, "הקוד לא תקין או שפג תוקפו. לחצו שוב על *הוסף מוצרים מוואטסאפ* באפליקציה כדי לקבל קוד חדש.");
    return;
  }
  const [user, list] = await Promise.all([
    userRepository.findById(target.userId),
    shoppingListRepository.findById(target.listId),
  ]);
  if (!user || !list || list.deletedAt || !(await resolveListAccessForUser(list, user))) {
    await sendText(phone, "לא הצלחתי לחבר את הרשימה - אולי היא נמחקה או שכבר אין לך גישה אליה.");
    return;
  }

  await whatsappRepository.upsertLink(phone, user.id, list.id);
  await sendCtaUrl(
    phone,
    `מעולה ${user.displayName}, מחובר לרשימה "${listName(list)}" ✅\n\n${HELP_TEXT}`,
    SHOP_BUTTON,
    listUrl(list),
  );
}

/** The link's user + list, re-checked on every message so removed members lose access immediately. */
async function loadLinkedContext(link: WhatsAppLink): Promise<{ user: User; list: ShoppingList } | null> {
  const [user, list] = await Promise.all([
    userRepository.findById(link.userId),
    shoppingListRepository.findById(link.listId),
  ]);
  if (!user || !list || list.deletedAt || !list.shareCode) return null;
  return (await resolveListAccessForUser(list, user)) ? { user, list } : null;
}

async function sendList(phone: string, list: ShoppingList): Promise<void> {
  const adderIds = [...new Set(list.items.map((item) => item.addedByUserId).filter((id): id is string => !!id))];
  const names: Record<string, string> = {};
  // Only worth naming people on a shared list.
  if (list.householdId && adderIds.length > 1) {
    const users = await Promise.all(adderIds.map((id) => userRepository.findById(id)));
    for (const user of users) if (user) names[user.id] = user.displayName;
  }
  await sendCtaUrl(phone, formatListMessage(listName(list), list.items, names), SHOP_BUTTON, listUrl(list));
}

async function addItems(phone: string, user: User, list: ShoppingList, text: string): Promise<void> {
  const lines = parseItemsMessage(text);
  if (lines.length === 0) {
    await sendText(phone, `לא זיהיתי מוצרים בהודעה.

${HELP_TEXT}`);
    return;
  }

  // Already on the list (and not bought yet)? Ask before touching those; add the rest now.
  const duplicates: PendingDuplicate[] = [];
  const fresh = lines.filter((line) => {
    const existing = findOpenItemByName(list.items, line.rawText);
    if (!existing) return true;
    duplicates.push({ itemId: existing.id, rawText: existing.rawText, addQuantity: line.quantity ?? 1 });
    return false;
  });

  let updated: ShoppingList = list;
  if (fresh.length > 0) {
    const classified = await classifyLines(
      list.storeId,
      fresh.map((line) => line.rawText),
      user.id,
    );
    const items = classified.map((item, i) => ({ ...item, quantity: fresh[i].quantity }));
    await shoppingListRepository.appendItems(list.id, items);
    await whatsappRepository.setLastAdded(phone, items.map((item) => item.id));
    notifyListChanged(list, user.id);
    notifyItemsAdded(list, user, fresh.map((line) => line.rawText));
    updated = (await shoppingListRepository.findById(list.id)) ?? list;

    const openCount = openItems(updated.items).length;
    const added = summarizeItems(fresh.map((l) => (l.quantity ? `${l.rawText} ×${l.quantity}` : l.rawText)), 6);
    await sendCtaUrl(
      phone,
      [
        `✅ נוסף${fresh.length > 1 ? "ו" : ""} לרשימה: ${added}`,
        `סה"כ ${openCount} מוצרים פתוחים ברשימה.`,
        "להצגת הרשימה עד כה כתבו *רשימה*",
        "_טעית? כתבו *בטל* · כל הפקודות: *עזרה*_",
      ].join("\n"),
      SHOP_BUTTON,
      listUrl(updated),
    );
  }

  if (duplicates.length > 0) {
    await whatsappRepository.setPendingDuplicates(phone, duplicates);
    const described = duplicates.map((d) => {
      const item = updated.items.find((i) => i.id === d.itemId);
      return `*${d.rawText}* (כבר יש ${item?.quantity ?? 1})`;
    });
    const question =
      duplicates.length === 1
        ? `המוצר ${described[0]} כבר קיים ברשימה. האם תרצה להוסיף לכמות?`
        : `המוצרים האלה כבר קיימים ברשימה:\n${described.map((d) => `• ${d}`).join("\n")}\n\nהאם תרצה להוסיף לכמות שלהם?`;
    await sendButtons(phone, question, [
      { id: DUP_YES, title: "כן, להוסיף" },
      { id: DUP_NO, title: "לא" },
    ]);
  }
}

/** "כן": adds to the existing items' quantities and says the new totals; "לא": nothing changes. */
async function answerDuplicates(
  phone: string,
  user: User,
  list: ShoppingList,
  duplicates: PendingDuplicate[],
  addToQuantity: boolean,
): Promise<void> {
  if (!addToQuantity) {
    await sendText(phone, "בסדר, לא הוספתי. להצגת הרשימה עד כה כתבו *רשימה*");
    return;
  }

  const totals: string[] = [];
  for (const dup of duplicates) {
    // The item may have been bought or removed since the question - then there's nothing to add to.
    const item = list.items.find((i) => i.id === dup.itemId && !i.checked);
    if (!item) continue;
    const total = (item.quantity ?? 1) + dup.addQuantity;
    await shoppingListRepository.setItemQuantity(list.id, item.id, total);
    totals.push(`${item.rawText} – סה"כ ${total}`);
  }
  if (totals.length === 0) {
    await sendText(phone, "המוצרים כבר לא ברשימה (אולי נקנו או נמחקו). אפשר לשלוח אותם שוב.");
    return;
  }

  notifyListChanged(list, user.id);
  await sendCtaUrl(
    phone,
    `✅ עודכנה הכמות:\n${totals.map((t) => `• ${t}`).join("\n")}\n\nלהצגת הרשימה עד כה כתבו *רשימה*`,
    SHOP_BUTTON,
    listUrl(list),
  );
}
