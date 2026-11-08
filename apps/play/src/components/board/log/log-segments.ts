/**
 * Match-log line rendering.
 *
 * Non-English locales use the @rift/i18n renderer, which returns structured
 * text/card/rune/resource segments. Canonical English is displayed verbatim by the
 * original app, so the EN path re-discovers the same segments locally (catalog card
 * names, rune phrases, resource amounts) to keep card names hoverable and rune /
 * resource glyphs visible.
 */
import { cards, getCardByName, type Card } from "@rift/cards";
import { renderGameLogEntry, resolveLocale, type GameLogSegment } from "@rift/i18n";
import type { CardInstance, GameplayLogEntry } from "@rift/protocol";

const WORD_CHAR = /[\p{L}\p{N}]/u;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

const CARD_NAME_PATTERN: RegExp | null = (() => {
  const names = [
    ...new Set(
      cards()
        .map((card) => card.name.trim())
        .filter((name) => name.length >= 3),
    ),
  ].sort((a, b) => b.length - a.length);
  if (names.length === 0) return null;
  return new RegExp(`(${names.map(escapeRegExp).join("|")})`, "gu");
})();

const COMPACT_RESOURCE = /(?<![\p{L}\p{N}])(\d+)E(?:\s*\/\s*(\d+)P)?(?![\p{L}\p{N}])/gu;
const POWER_RESOURCE = /(?<![\p{L}\p{N}])(\d+)P(?![\p{L}\p{N}])/gu;
const SPELLED_RESOURCE =
  /(?<![\p{L}\p{N}])(\d+)\s+energy(?:\s+and\s+(\d+)\s+power)?(?![\p{L}\p{N}])/giu;
const RUNE_PHRASE = /(?<![\p{L}\p{N}])(\d+)\s+(?:(body|calm|chaos|fury|mind|order)\s+)?runes?\b/giu;

interface Token {
  start: number;
  end: number;
  segment: GameLogSegment;
}

function overlaps(tokens: readonly Token[], start: number, end: number): boolean {
  return tokens.some((token) => start < token.end && end > token.start);
}

function resourceSegment(
  text: string,
  start: number,
  end: number,
  energy: number | null,
  power: number | null,
  form: "compact" | "spelled",
): Token {
  const floating = /float(?:ing)?\s*$/iu.test(text.slice(Math.max(0, start - 12), start));
  return {
    start,
    end,
    segment: {
      type: "resource",
      value: text.slice(start, end),
      kind: energy !== null && power !== null ? "both" : energy !== null ? "energy" : "power",
      energy: energy ?? 0,
      power: power ?? 0,
      form,
      floating,
    },
  };
}

function runeSegment(text: string, match: RegExpExecArray): Token {
  const start = match.index;
  const end = start + match[0].length;
  const count = Number(match[1]);
  const domainRaw = match[2] ?? null;
  const domain = domainRaw?.toLowerCase() ?? null;
  const plural = /s$/iu.test(match[0]) ? "runes" : "rune";
  return {
    start,
    end,
    segment: {
      type: "rune",
      count,
      domain,
      before: `${count} `,
      after: `${domainRaw ? `${domainRaw} ` : ""}${plural}`,
    },
  };
}

/** Build card/rune/resource segments for canonical English log text. */
export function segmentEnglishLogText(text: string): GameLogSegment[] {
  if (!text) return [];
  const tokens: Token[] = [];

  for (const match of text.matchAll(COMPACT_RESOURCE)) {
    const start = match.index ?? 0;
    tokens.push(
      resourceSegment(
        text,
        start,
        start + match[0].length,
        Number(match[1]),
        match[2] === undefined ? null : Number(match[2]),
        "compact",
      ),
    );
  }
  for (const match of text.matchAll(POWER_RESOURCE)) {
    const start = match.index ?? 0;
    if (overlaps(tokens, start, start + match[0].length)) continue;
    tokens.push(
      resourceSegment(text, start, start + match[0].length, null, Number(match[1]), "compact"),
    );
  }
  for (const match of text.matchAll(SPELLED_RESOURCE)) {
    const start = match.index ?? 0;
    if (overlaps(tokens, start, start + match[0].length)) continue;
    tokens.push(
      resourceSegment(
        text,
        start,
        start + match[0].length,
        Number(match[1]),
        match[2] === undefined ? null : Number(match[2]),
        "spelled",
      ),
    );
  }
  for (const match of text.matchAll(RUNE_PHRASE)) {
    const start = match.index ?? 0;
    if (overlaps(tokens, start, start + match[0].length)) continue;
    tokens.push(runeSegment(text, match));
  }

  if (CARD_NAME_PATTERN) {
    for (const match of text.matchAll(CARD_NAME_PATTERN)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (overlaps(tokens, start, end)) continue;
      const before = start > 0 ? text[start - 1] : "";
      const after = end < text.length ? text[end] : "";
      if (before && WORD_CHAR.test(before)) continue;
      if (after && WORD_CHAR.test(after)) continue;
      // "Gold token" / "Bird token" are token names, not catalog cards.
      if (/^\s+tokens?\b/iu.test(text.slice(end, end + 12))) continue;
      const card = getCardByName(match[0]);
      if (!card) continue;
      tokens.push({
        start,
        end,
        segment: { type: "card", value: match[0], cardCode: card.id },
      });
    }
  }

  tokens.sort((a, b) => a.start - b.start || b.end - a.end);
  const segments: GameLogSegment[] = [];
  let cursor = 0;
  for (const token of tokens) {
    if (token.start < cursor) continue;
    if (token.start > cursor) {
      const value = text.slice(cursor, token.start);
      if (value) segments.push({ type: "text", value });
    }
    segments.push(token.segment);
    cursor = token.end;
  }
  if (cursor < text.length) segments.push({ type: "text", value: text.slice(cursor) });
  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

/** Render a log entry in the requested locale. */
export function segmentLogEntry(
  entry: Pick<GameplayLogEntry, "text">,
  locale?: string | null,
): GameLogSegment[] {
  if (resolveLocale(locale) === "en") return segmentEnglishLogText(entry.text);
  return renderGameLogEntry(entry, resolveLocale(locale));
}

/** `HH:mm` log timestamps (24-hour, locale aware). */
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatLogTime(at: number, locale?: string | null): string {
  const resolved = resolveLocale(locale);
  let formatter = timeFormatters.get(resolved);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(resolved === "en" ? "en-GB" : resolved, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    timeFormatters.set(resolved, formatter);
  }
  return formatter.format(new Date(at));
}

/** Best-effort action-kind classifier for entries without a wire `actionKind`. */
export function deriveActionKind(
  entry: Pick<GameplayLogEntry, "text" | "actionKind">,
): NonNullable<GameplayLogEntry["actionKind"]> | null {
  if (entry.actionKind) return entry.actionKind;
  const text = entry.text.toLowerCase();
  if (text.includes("ended their turn") || text.includes("ended beginning phase")) return "turn";
  if (
    text.includes("looked at") ||
    text.startsWith("revealed") ||
    text.startsWith("hid ") ||
    text.includes("closed deck peek") ||
    text.includes("closed rune deck peek")
  ) {
    return "inspect";
  }
  if (text.startsWith("drew ")) return "draw";
  if (
    text.includes("shuffled") ||
    text.includes("recycled") ||
    text.includes("from deck") ||
    text.includes("to top of deck") ||
    text.includes("to bottom of deck")
  ) {
    return "deck";
  }
  if (text.includes("trash")) return "trash";
  if (
    text.includes("paid") ||
    text.includes("float") ||
    text.includes("channeled") ||
    text.includes("rune")
  ) {
    return "resource";
  }
  if (
    text.includes("showdown") ||
    text.includes("conquered") ||
    text.includes("passed focus") ||
    text.includes("battlefield")
  ) {
    return "battle";
  }
  if (text.includes("played") || text.includes("chain resolved") || text.includes("chain")) {
    return "spell";
  }
  if (text.includes("score")) return "score";
  if (text.includes(" xp")) return "legend-xp";
  if (text.includes("rewound") || text.includes("rewind")) return "rewind";
  if (text.includes("forward")) return "forward";
  return "board";
}

/** Convert a catalog card to a `CardInstance` for hover previews. */
export function cardInstanceFromCard(card: Card, id = card.id): CardInstance {
  return {
    id,
    name: card.name,
    source: "mainDeck",
    exhausted: false,
    createdAt: 0,
    cardCode: card.id,
    imageUrl: card.imageUrl,
    type: card.type,
    domains: [...card.domains],
    text: card.text,
    energyCost: card.energyCost,
    powerCost: card.powerCost,
    might: card.might,
    rarity: card.rarity,
    set: card.set,
    keywords: card.keywords ? [...card.keywords] : undefined,
    subtypes: card.subtypes ? [...card.subtypes] : undefined,
  };
}
