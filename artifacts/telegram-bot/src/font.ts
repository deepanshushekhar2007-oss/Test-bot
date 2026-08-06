// Small-caps Unicode converter
// Transforms regular latin letters into small capital Unicode characters.
// This is the font style the bot uses throughout all messages.

const SMALL_CAPS: Record<string, string> = {
  a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ",
  h: "ʜ", i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ",
  o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ", s: "ꜱ", t: "ᴛ", u: "ᴜ",
  v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ",
};

/** Convert a string to small-caps Unicode font. Non-alpha characters are kept as-is. */
export function sc(text: string): string {
  return text
    .split("")
    .map((ch) => SMALL_CAPS[ch.toLowerCase()] ?? ch)
    .join("");
}
