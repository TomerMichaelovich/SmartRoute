/**
 * Turns a free-text chat message ("חלב, 2 לחם\nביצים x3") into list lines.
 * Pure, so the WhatsApp bot's parsing is unit-testable without any I/O.
 */

export interface ParsedLine {
  rawText: string;
  quantity?: number;
}

export type BotCommand =
  | { type: "link"; code: string }
  | { type: "list" }
  | { type: "shop" }
  | { type: "help" }
  | { type: "unlink" }
  | { type: "remove"; targets: string[] }
  | { type: "undo" }
  | { type: "done" };

/** New lines, commas and semicolons (incl. the Arabic comma) separate items. */
const PIECE_SEPARATORS = /[\n\r,;،]+/;
const MAX_LINES = 50;
const MAX_LINE_LENGTH = 80;
const MAX_QUANTITY = 99;

// A leading number followed by one of these is a size ("2 ק"ג עגבניות"), not a count.
const UNIT_WORDS = /^(ק"ג|קג|קילו|ק״ג|גרם|גר'|גר|ג'|ליטר|ל'|מ"ל|מ״ל|מל|יח'|יחידות|kg|g|l|ml)(\s|$)/i;

// Counts written as words: "שתי קולה", "שלושה לחמים".
const NUMBER_WORDS: Record<string, number> = {
  אחד: 1, אחת: 1,
  שניים: 2, שתיים: 2, שני: 2, שתי: 2,
  שלוש: 3, שלושה: 3, שלושת: 3,
  ארבע: 4, ארבעה: 4, ארבעת: 4,
  חמש: 5, חמישה: 5, חמשת: 5,
  שש: 6, שישה: 6, ששת: 6,
  שבע: 7, שבעה: 7, שבעת: 7,
  שמונה: 8, שמונת: 8,
  תשע: 9, תשעה: 9, תשעת: 9,
  עשר: 10, עשרה: 10, עשרת: 10,
};
// Longest first, so "שלושה" isn't read as "שלוש" + "ה".
const NUMBER_WORD = Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join("|");
const COUNT = `(?:\\d{1,2}|${NUMBER_WORD})`;

// "8 לחם ושתי קולה" / "חלב ו-2 לחם": a "ו" right before a count starts a new item.
// Only before a count - "וופל" or "ורדים" must stay whole.
const AND_BEFORE_COUNT = new RegExp(`\\s+ו[-־]?(?=${COUNT}(?:\\s|$))`);
const LEADING_WORD_COUNT = new RegExp(`^(${NUMBER_WORD})\\s+(.+)$`);
const TRAILING_WORD_COUNT = new RegExp(`^(.+?)\\s+(${NUMBER_WORD})$`);

/**
 * Splits on new lines, commas, semicolons and "ו" before a count; strips list
 * bullets; pulls out a count (digits or a Hebrew number word).
 */
export function parseItemsMessage(text: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  const pieces = text.split(PIECE_SEPARATORS).flatMap((piece) => piece.split(AND_BEFORE_COUNT));
  for (const piece of pieces) {
    const line = parseLine(piece);
    if (line) lines.push(line);
    if (lines.length >= MAX_LINES) break;
  }
  return lines;
}

function parseLine(piece: string): ParsedLine | null {
  let text = piece
    .replace(/[*_~`]/g, "") // WhatsApp formatting marks
    .replace(/^\s*(?:[-–—•·▪●◦]+|\d{1,2}[.)](?=\s))\s*/, "") // "- חלב", "• חלב", "1. חלב"
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  let quantity: number | undefined;

  // "2 לחם", "x2 לחם", "2x לחם"
  const leading = text.match(/^(?:[x×*]\s*)?(\d{1,2})\s*(?:[x×*])?\s+(.+)$/i);
  const leadingWord = text.match(LEADING_WORD_COUNT);
  const trailingWord = text.match(TRAILING_WORD_COUNT);
  if (leading && !UNIT_WORDS.test(leading[2])) {
    quantity = Number(leading[1]);
    text = leading[2];
  } else if (leadingWord && !UNIT_WORDS.test(leadingWord[2])) {
    // "שתי קולה"
    quantity = NUMBER_WORDS[leadingWord[1]];
    text = leadingWord[2];
  } else if (trailingWord) {
    // "קולה שתיים"
    quantity = NUMBER_WORDS[trailingWord[2]];
    text = trailingWord[1];
  } else {
    // "לחם x2", "לחם 2", "לחם ×2"
    const trailing = text.match(/^(.+?)\s*(?:[x×*]\s*(\d{1,2})|\s(\d{1,2}))$/i);
    if (trailing) {
      quantity = Number(trailing[2] ?? trailing[3]);
      text = trailing[1].trim();
    }
  }

  text = text.slice(0, MAX_LINE_LENGTH).trim();
  if (!text || !/[\p{L}]/u.test(text)) return null;
  if (quantity !== undefined && (quantity < 1 || quantity > MAX_QUANTITY)) quantity = undefined;
  return quantity && quantity > 1 ? { rawText: text, quantity } : { rawText: text };
}

const COMMANDS: Array<[RegExp, BotCommand["type"]]> = [
  [/^(רשימה|הרשימה|מה ברשימה|הצג רשימה|list|\?)$/i, "list"],
  [/^(צא לקניות|יוצא לקניות|יוצאת לקניות|לקניות|קניות|shop)$/i, "shop"],
  [/^(עזרה|help|תפריט|היי|הי|שלום|hi|hello|start)$/i, "help"],
  [/^(נתק|התנתק|התנתקי|ניתוק|stop|unlink)$/i, "unlink"],
  [/^(בטל|ביטול|תבטל|אופס|undo)$/i, "undo"],
  [/^(סיימתי|סיימנו|סיימתי קניות|סיימתי לקנות|קנייה הושלמה|קניה הושלמה|גמרתי|done)$/i, "done"],
];

const REMOVE_COMMAND =
  /^(?:מחק|תמחק|תמחקי|למחוק|הסר|תסיר|תסירי|להסיר|הורד|תוריד|תורידי|להוריד|remove|delete)\s+([\s\S]+)$/i;

/** Recognizes the bot's commands; anything else (null) is treated as items to add. */
export function parseCommand(text: string): BotCommand | null {
  const trimmed = text.trim();
  const clean = trimmed === "?" ? trimmed : trimmed.replace(/[!.?]+$/, "").trim();

  const link = clean.match(/^(?:חיבור|התחבר|connect|link)\s*[:\-]?\s*([A-Za-z0-9]{4,10})$/i);
  if (link) return { type: "link", code: link[1].toUpperCase() };

  // "מחק גזר", "הסר גזר, חלב", "מחק 3" (a number from the bot's numbered list)
  const remove = clean.match(REMOVE_COMMAND);
  if (remove) {
    const targets = remove[1]
      .split(PIECE_SEPARATORS)
      .map((t) => t.replace(/[*_~`]/g, "").trim())
      .filter(Boolean);
    if (targets.length > 0) return { type: "remove", targets };
  }

  for (const [pattern, type] of COMMANDS) {
    if (pattern.test(clean)) return { type } as BotCommand;
  }
  return null;
}

/** "כן" / "לא" to the bot's yes/no questions (carry over leftovers, add to quantity); null for anything else. */
export function parseCarryAnswer(text: string): "yes" | "no" | null {
  const clean = text.trim().replace(/[!.\s]+$/, "");
  if (/^(כן|כן,? לצרף|לצרף|כן,? להוסיף|להוסיף|בטח|יאללה|אוקי|yes|y|ok)$/i.test(clean)) return "yes";
  if (/^(לא|לא,? רשימה חדשה|רשימה חדשה|לא צריך|no|n)$/i.test(clean)) return "no";
  return null;
}
