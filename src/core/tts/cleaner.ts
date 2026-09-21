/**
 * Speech preparation layer for Hermoz's TTS.
 * Cleans AI-generated text for natural spoken delivery without altering the visible chat message.
 */

export function cleanTextForSpeech(rawText: string): string {
  if (!rawText || typeof rawText !== "string") {
    return "";
  }

  let text = rawText.trim();

  // 1. If text is accidentally raw JSON, attempt to extract the message field
  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.message === "string") {
        text = parsed.message;
      }
    } catch {
      // Not valid JSON, continue with standard cleaning
    }
  }

  // 2. Remove fenced code blocks (e.g. ```typescript ... ```)
  text = text.replace(/```[\s\S]*?```/g, " [code snippet] ");

  // 3. Remove inline code backticks (keep inside text)
  text = text.replace(/`([^`]+)`/g, "$1");

  // 4. Clean Markdown links: [Link text](https://...) -> Link text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 5. Remove standalone URLs (e.g. https://google.com -> "the link")
  text = text.replace(/https?:\/\/\S+/gi, "the link");

  // 6. Clean markdown headings, blockquotes, bullets
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^>\s+/gm, "");
  text = text.replace(/^[\*\-+]\s+/gm, "");

  // 7. Remove bold / italics / strikethrough markdown markers (*text*, **text**, ~~text~~)
  text = text.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1");

  // 8. Normalize repetitive punctuation while preserving natural pauses
  text = text.replace(/([!?]){2,}/g, "$1"); // '???' -> '?'
  text = text.replace(/\.{4,}/g, "..."); // '.....' -> '...'
  text = text.replace(/--{1,}/g, " — ");

  // 9. Clean up emojis or non-pronounceable noise symbols if needed, but preserve standard conversational chars
  // Replace symbols like & with "and"
  text = text.replace(/\s&\s/g, " and ");

  // 10. Collapse multiple spaces/newlines into clean conversational pauses
  text = text.replace(/\n+/g, " ");
  text = text.replace(/\s{2,}/g, " ").trim();

  return text;
}
