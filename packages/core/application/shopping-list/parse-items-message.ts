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
  | { type: "undo" };

/** New lines, commas and semicolons (incl. the Arabic comma) separate items. */
const PIECE_SEPARATORS = /[\n\r,;،]+/;
const MAX_LINES = 50;
const MAX_LINE_LENGTH = 80;
const MAX_QUANTITY = 99;

// A leading number followed by one of these is a size ("2 ק"ג עגבניות"), not a count.
const UNIT_WORDS = /^(ק"ג|קג|קילו|ק״ג|גרם|גר'|גר|ג'|ליטר|ל'|מ"ל|מ״ל|מל|יח'|יחידות|kg|g|l|ml)(\s|$)/i;

/** Splits on new lines, commas and semicolons; strips list bullets; pulls out a count. */
export function parseItemsMessage(text: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  for (const piece of text.split(PIECE_SEPARATORS)) {
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
  if (leading && !UNIT_WORDS.test(leading[2])) {
    quantity = Number(leading[1]);
    text = leading[2];
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

/** "כן" / "לא" to the bot's "carry over the leftovers?" question; null for anything else. */
export function parseCarryAnswer(text: string): "yes" | "no" | null {
  const clean = text.trim().replace(/[!.\s]+$/, "");
  if (/^(כן|כן,? לצרף|לצרף|בטח|יאללה|אוקי|yes|y|ok)$/i.test(clean)) return "yes";
  if (/^(לא|לא,? רשימה חדשה|רשימה חדשה|לא צריך|no|n)$/i.test(clean)) return "no";
  return null;
}
