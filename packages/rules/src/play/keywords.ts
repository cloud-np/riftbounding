/**
 * Card-level keywords — rules 135.2.c, 135.2.d.3, 135.2.e.7, 801–803, 806, 813, 819.1.b.
 *
 * The catalog's `keywords` list is extracted from every bracketed token in the text, including
 * reminder text (135.2.d.3: reminder text has no game function) and keywords attached to an
 * ability (135.2.e.7: `[Reaction][>]` on an activated ability is a property of that ability, not
 * of the card). For example Reckless Innovator's Gold-token reminder `"[Reaction] Kill this,
 * [Tap]: [Add] [Rune]"` would otherwise give the unit Reaction. The play layer therefore reads
 * card-level keywords from the card text:
 *
 * - reminder text in parentheses is ignored (135.2.d.3);
 * - a line's leading `[Keyword]` tokens are card keywords, except Action/Reaction tokens on a
 *   line that is an activated ability (contains `:`), which belong to that ability;
 * - Quick-Draw cards have Reaction inherently (819.1.b).
 *
 * When a card has no text the catalog list is used as is. Granted keywords are layered on top
 * by `effectiveKeywords` (475–479, R2-effects).
 */
import type { Room } from "@rift/protocol";
import type { CardInfo, RulesHost } from "../host";
import { effectiveKeywords } from "../layers";

export function stripReminderText(line: string): string {
  let out = "";
  let depth = 0;
  for (const ch of line) {
    if (ch === "(") {
      depth += 1;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) out += ch;
  }
  return out;
}

/** The rules text of a card: errata banners and flavor text removed, one entry per line. */
export function rulesTextLines(text: string | undefined): string[] {
  const body = (text ?? "").split(/\n\s*Flavor Text/i)[0] ?? "";
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/errata text/i.test(line.normalize("NFKD")) && !/^𝗖𝗮𝗿𝗱/.test(line));
}

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/([\s-])/)
    .map((part) => (part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join("");
}

/** Card-level keywords from text (keeps values such as "Deflect 2"). */
export function parseCardKeywords(text: string | undefined): string[] {
  const out: string[] = [];
  for (const raw of rulesTextLines(text)) {
    let rest = stripReminderText(raw).trim();
    const lead: string[] = [];
    for (;;) {
      const match = /^\[([^\]]+)\]\s*[-—–]?\s*/.exec(rest);
      if (!match) break;
      lead.push(match[1]!.trim());
      rest = rest.slice(match[0].length);
    }
    if (lead.length === 0) continue;
    const abilityLine = rest.includes(":");
    for (const token of lead) {
      const name = token.replace(/\s+\d+$/, "").trim();
      if (!/^[a-z][a-z' -]*$/i.test(name)) continue; // cost symbols like [2], [Calm] handled by callers
      if (abilityLine && /^(action|reaction)$/i.test(name)) continue;
      const value = /\s+(\d+)$/.exec(token)?.[1];
      out.push(value ? `${titleCase(name)} ${value}` : titleCase(name));
    }
  }
  return out;
}

const DOMAIN_WORDS = new Set(["fury", "calm", "mind", "body", "chaos", "order", "rune", "power", "tap", "e", "a", "c", "might", "m"]);

/** 801–803 / 819.1.b: printed card-level keywords (text first, catalog as fallback). */
export function printedCardKeywords(info: Pick<CardInfo, "keywords" | "text"> | null | undefined): string[] {
  if (!info) return [];
  const parsed = info.text
    ? parseCardKeywords(info.text).filter((keyword) => !DOMAIN_WORDS.has(keywordName(keyword).toLowerCase()))
    : [...info.keywords];
  if (parsed.some((keyword) => keywordName(keyword).toLowerCase() === "quick-draw")) {
    if (!parsed.some((keyword) => keywordName(keyword).toLowerCase() === "reaction")) parsed.push("Reaction");
  }
  return parsed;
}

/** "Deflect 2" → "Deflect". */
export function keywordName(keyword: string): string {
  return keyword.replace(/\s+\d+$/, "").trim();
}

export function hasKeyword(keywords: readonly string[], name: string): boolean {
  const wanted = name.toLowerCase();
  return keywords.some((keyword) => keywordName(keyword).toLowerCase() === wanted);
}

/**
 * Summed keyword value (807.2/809.2: Assault/Deflect values add up; a bare keyword is 1).
 */
export function keywordValue(keywords: readonly string[], name: string): number {
  const wanted = name.toLowerCase();
  let total = 0;
  for (const keyword of keywords) {
    if (keywordName(keyword).toLowerCase() !== wanted) continue;
    const value = /\s+(\d+)$/.exec(keyword)?.[1];
    total += value ? Number(value) : 1;
  }
  return total;
}

/** Printed card keywords plus granted ones (475–479) for a card in any zone. */
export function cardKeywords(room: Room, host: RulesHost, cardId: string, info?: CardInfo | null): string[] {
  const resolved = info === undefined ? host.cardInfo(room, cardId) : info;
  return effectiveKeywords(room, cardId, printedCardKeywords(resolved));
}
