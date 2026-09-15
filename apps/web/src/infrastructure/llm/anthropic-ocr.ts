import Anthropic from "@anthropic-ai/sdk";

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

const SYSTEM_PROMPT = `אתה מזהה טקסט מתוך תמונה של רשימת קניות, כתובה ביד או מודפסת, בעברית ו/או אנגלית.
החזר אך ורק את פריטי הרשימה שזיהית, פריט אחד בכל שורה, ללא מספור, ללא כוכביות, ללא כל טקסט נוסף.
אם לא ניתן לזהות אף פריט, החזר מחרוזת ריקה.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

function toSupportedMediaType(mediaType: string): SupportedMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(mediaType)
    ? (mediaType as SupportedMediaType)
    : "image/jpeg";
}

export async function recognizeShoppingListText(
  imageBase64: string,
  mediaType: string,
): Promise<string> {
  const message = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: toSupportedMediaType(mediaType),
              data: imageBase64,
            },
          },
          { type: "text", text: "זהה את פריטי רשימת הקניות בתמונה." },
        ],
      },
    ],
  });

  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}
