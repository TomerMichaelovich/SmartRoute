import { createHmac, timingSafeEqual } from "crypto";

/**
 * Minimal WhatsApp Cloud API (Meta) client. The bot only ever *replies*
 * (inside the 24h customer-service window), which Meta doesn't charge for.
 */
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v25.0";

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_APP_SECRET &&
      process.env.WHATSAPP_VERIFY_TOKEN &&
      process.env.NAVIO_WHATSAPP_NUMBER,
  );
}

/** Checks Meta's X-Hub-Signature-256 header ("sha256=<hex HMAC of the raw body>"). */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function send(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
    },
  );
  if (!res.ok) {
    throw new Error(`WhatsApp send failed: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  }
}

export function sendText(to: string, body: string): Promise<void> {
  return send({ to, type: "text", text: { body, preview_url: false } });
}

/** A message with one link button (e.g. "צא לקניות" -> the list in the app). */
export function sendCtaUrl(to: string, body: string, buttonText: string, url: string): Promise<void> {
  return send({
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: body },
      action: { name: "cta_url", parameters: { display_text: buttonText.slice(0, 20), url } },
    },
  });
}

/** A question with up to 3 quick-reply buttons; the tap comes back as a message with the button's id. */
export function sendButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<void> {
  return send({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })),
      },
    },
  });
}

/** wa.me link that opens a chat with the bot, the message pre-typed. */
export function chatLink(prefilledText: string): string {
  const number = (process.env.NAVIO_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  return prefilledText
    ? `https://wa.me/${number}?text=${encodeURIComponent(prefilledText)}`
    : `https://wa.me/${number}`;
}
