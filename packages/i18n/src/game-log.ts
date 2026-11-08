/**
 * @rift/i18n — game-log sentence parser + localized sentence builder.
 *
 * Exact port of the original game-log module 846015 (`0aed5y6vhcy22.js`):
 * the 188 sentence descriptors (67 literals + 118 regex patterns + 3
 * parameterized composite sentences), their group specs, the phrase builders
 * for runes/resources/payment details/rune batches/rolls, and the rune markup
 * (module 427973) that lets the UI render rune phrases as segments.
 *
 * Unlike the original (which returns one marked-up string), this module exposes
 * renderer-agnostic segments: `{type:"text"|"card"|"rune"|"resource", ...}`.
 */

import { getCardByName } from "@rift/cards";

import {
  EN_SENTENCES,
  createMessageTranslator,
  createSentenceTranslator,
  renderCompiled,
  sentenceCatalog,
} from "./translator";
import type { CompiledNode, MessageParams, Translator } from "./translator";
import type { LocaleCode } from "./locales";

/* --------------------------------------------------------------- types */

export interface RuneSummary {
  count: number;
  domain: string | null;
}

export type RuneSource = RuneSummary | readonly RuneSummary[] | string;

export interface ResourceSummary {
  energy: number | null;
  power: number | null;
  form: string;
}

export type PaymentDetail =
  | { kind: "text"; text: string }
  | { kind: "float"; resources: ResourceSummary }
  | { kind: "exhaust"; count: number }
  | { kind: "recycle"; source: RuneSource; energy: number | null }
  | { kind: "countedCard"; count: number; card: string }
  | { kind: "gold"; count: number }
  | { kind: "card"; card: string };

export interface RuneBatchClause {
  action: "channel" | "exhaust" | "ready" | "recycle" | "recycleFloat";
  runes: RuneSummary | RuneSummary[];
  energy?: number;
}

export interface Roll {
  competitor: string;
  roll: number;
}

/** Parsed sentence params are structured (rune/resource summaries, clauses…). */
export type SentenceParams = Record<string, unknown>;

export interface ParsedSentence {
  key: string;
  params: SentenceParams;
  selects?: Record<string, string[]>;
}

export type GameLogSegment =
  | { type: "text"; value: string }
  | { type: "card"; value: string; cardCode?: string }
  | { type: "rune"; count: number; domain: string | null; before: string; after: string }
  | {
      type: "resource";
      value: string;
      kind: "both" | "energy" | "power";
      energy: number;
      power: number;
      form: string;
      floating: boolean;
    };

export interface GameLogOptions {
  /** Localized card name lookup (defaults to the EN catalog name). */
  cardName?: (cardId: string, locale: LocaleCode) => string | null;
  /** Game-term translation (runtime localization `translateTerm`). */
  translateTerm?: (term: string, locale: LocaleCode) => string | null;
}

/* ------------------------------------------------------- rune markup */

const INVISIBLE_SEPARATOR = "\u2063";
const INVISIBLE_PLUS = "\u2064";
const INVISIBLE_TIMES = "\u2062";
const INVISIBLE_APPLICATION = "\u2061";

const RUNE_DOMAINS: readonly (string | null)[] = [
  null,
  "body",
  "calm",
  "chaos",
  "fury",
  "mind",
  "order",
];

const RUNE_MARKUP_RE = new RegExp(
  `${INVISIBLE_SEPARATOR}(\\d+)${INVISIBLE_PLUS}([0-6])${INVISIBLE_PLUS}([^${INVISIBLE_SEPARATOR}${INVISIBLE_APPLICATION}]*)${INVISIBLE_APPLICATION}`,
  "gu",
);
const RUNE_MARKUP_PREFIX_RE = new RegExp(
  `${INVISIBLE_SEPARATOR}\\d*${INVISIBLE_PLUS}\\d*${INVISIBLE_PLUS}`,
  "gu",
);
const INVISIBLE_RE = new RegExp(
  `[${INVISIBLE_SEPARATOR}${INVISIBLE_PLUS}${INVISIBLE_TIMES}${INVISIBLE_APPLICATION}]`,
  "gu",
);
const INVISIBLE_TEST_RE = new RegExp(
  `[${INVISIBLE_SEPARATOR}${INVISIBLE_PLUS}${INVISIBLE_TIMES}${INVISIBLE_APPLICATION}]`,
  "u",
);

const ZH_TOKEN_NAMES: ReadonlySet<string> = new Set([
  "草丛",
  "金币",
  "精灵",
  "狩猎",
  "随从",
  "已强化",
  "增益",
  "男爵巢穴",
  "纳什男爵",
]);

/** `o` — strip invisible rune-markup characters. */
export function stripRuneMarkup(text: string): string {
  return INVISIBLE_TEST_RE.test(text)
    ? text.replace(RUNE_MARKUP_PREFIX_RE, "").replace(INVISIBLE_RE, "")
    : text;
}

/** `V` — wrap a rendered rune phrase in the invisible markup. */
export function markRunePhrase(text: string, count: number, domain: string | null): string {
  const index = Math.max(0, RUNE_DOMAINS.indexOf(domain));
  return `${INVISIBLE_SEPARATOR}${count}${INVISIBLE_PLUS}${index}${INVISIBLE_PLUS}${text}`;
}

/** `f` — re-insert localized rune names after each markup group. */
export function insertRuneNames(text: string, runePhrases: readonly string[]): string {
  if (!text.includes(INVISIBLE_SEPARATOR)) return text;
  const phrases = [...new Set(runePhrases)].sort((a, b) => b.length - a.length);
  const matcher = new RegExp(
    `${INVISIBLE_SEPARATOR}\\d+${INVISIBLE_PLUS}[0-6]${INVISIBLE_PLUS}`,
    "gu",
  );
  let out = "";
  let cursor = 0;
  for (const match of text.matchAll(matcher)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const phrase = phrases.find((candidate) => text.startsWith(candidate, end));
    out += text.slice(cursor, start);
    out += phrase ? `${match[0]}${phrase}${INVISIBLE_APPLICATION}` : "";
    cursor = phrase ? end + phrase.length : end;
  }
  return out + text.slice(cursor);
}

/** `l` — parse rune markup into text/rune segments (module 427973). */
export function parseRuneSegments(text: string): GameLogSegment[] {
  if (!text.includes(INVISIBLE_SEPARATOR))
    return text ? [{ type: "text", value: stripRuneMarkup(text) }] : [];
  const segments: GameLogSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(RUNE_MARKUP_RE)) {
    const start = match.index ?? 0;
    if (start > cursor)
      segments.push({ type: "text", value: stripRuneMarkup(text.slice(cursor, start)) });
    const body = match[3] ?? "";
    const divider = body.indexOf(INVISIBLE_TIMES);
    const before = divider < 0 ? "" : body.slice(0, divider);
    segments.push({
      type: "rune",
      count: Number(match[1]),
      domain: RUNE_DOMAINS[Number(match[2])] ?? null,
      before: stripRuneMarkup(before),
      after: stripRuneMarkup(divider < 0 ? body : body.slice(divider + 1)),
    });
    cursor = start + match[0].length;
  }
  if (cursor < text.length)
    segments.push({ type: "text", value: stripRuneMarkup(text.slice(cursor)) });
  return segments.filter((segment) => segment.type !== "text" || segment.value.length > 0);
}

/* ------------------------------------------------------ resource markup */

const RESOURCE_MARKUP_RE = /\u0004([^\u0006]*)\u0006([^\u0005]*)\u0005/gu;

function markResource(value: string, summary: ResourceSummary, floating: boolean): string {
  const kind =
    summary.energy !== null && summary.power !== null
      ? "both"
      : summary.energy !== null
        ? "energy"
        : "power";
  const payload = JSON.stringify({
    kind,
    energy: summary.energy ?? 0,
    power: summary.power ?? 0,
    form: summary.form,
    floating,
  });
  return `\u0004${payload}\u0006${value}\u0005`;
}

/** Parse resource markers, then rune markup inside each text fragment. */
function parseInlineSegments(text: string): GameLogSegment[] {
  const segments: GameLogSegment[] = [];
  let cursor = 0;
  const matcher = new RegExp(RESOURCE_MARKUP_RE.source, "gu");
  for (const match of text.matchAll(matcher)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push(...parseRuneSegments(text.slice(cursor, start)));
    const data = JSON.parse(match[1] ?? "{}") as {
      kind: "both" | "energy" | "power";
      energy: number;
      power: number;
      form: string;
      floating: boolean;
    };
    segments.push({ type: "resource", value: stripRuneMarkup(match[2] ?? ""), ...data });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) segments.push(...parseRuneSegments(text.slice(cursor)));
  return segments;
}

/* ------------------------------------------------------- card markup */

const CARD_START = "\u0001";
const CARD_SEPARATOR = "\u0002";
const CARD_END = "\u0003";
const CARD_MARKUP_RE = /\u0001([^\u0002]*)\u0002([^\u0003]*)\u0003/gu;

function markCard(cardCode: string, name: string): string {
  return `${CARD_START}${cardCode}${CARD_SEPARATOR}${name}${CARD_END}`;
}

function parseCardSegments(text: string): GameLogSegment[] {
  const segments: GameLogSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(CARD_MARKUP_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push(...parseInlineSegments(text.slice(cursor, start)));
    segments.push({ type: "card", cardCode: match[1] || undefined, value: match[2] ?? "" });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) segments.push(...parseInlineSegments(text.slice(cursor)));
  return segments;
}

/** Coalesce adjacent text segments and drop empties. */
function normalizeSegments(segments: GameLogSegment[]): GameLogSegment[] {
  const out: GameLogSegment[] = [];
  for (const segment of segments) {
    if (segment.type === "text") {
      if (!segment.value) continue;
      const previous = out.at(-1);
      if (previous?.type === "text") {
        previous.value += segment.value;
        continue;
      }
    }
    out.push(segment);
  }
  return out;
}

/* --------------------------------------------------- rune/resource parse */

const RUNE_COUNT_RE = /^(\d+)\s+(?:(body|calm|chaos|fury|mind|order)\s+)?runes?$/iu;

function parseRunes(value: string): RuneSummary | null {
  const match = RUNE_COUNT_RE.exec(value.trim());
  return match ? { count: Number(match[1]), domain: match[2]?.toLowerCase() ?? null } : null;
}

function asArray(value: RuneSummary | RuneSummary[]): RuneSummary[] {
  return "count" in value ? [value] : value;
}

const COMPACT_RESOURCE_RE = /^(\d+)E(?:\s*\/\s*(\d+)P)?$/iu;
const POWER_RESOURCE_RE = /^(\d+)P$/iu;
const SPELLED_RESOURCE_RE = /^(\d+)\s+energy(?:\s+and\s+(\d+)\s+power)?$/iu;
const SPELLED_POWER_RE = /^(\d+)\s+power$/iu;

function parseResources(value: string): ResourceSummary | null {
  const text = value.trim();
  const toNumber = (input: string | undefined): number | null =>
    input === undefined ? null : Number(input);
  let match = COMPACT_RESOURCE_RE.exec(text);
  if (match) return { energy: toNumber(match[1]), power: toNumber(match[2]), form: "compact" };
  match = POWER_RESOURCE_RE.exec(text);
  if (match) return { energy: null, power: toNumber(match[1]), form: "compact" };
  match = SPELLED_RESOURCE_RE.exec(text);
  if (match) return { energy: toNumber(match[1]), power: toNumber(match[2]), form: "spelled" };
  match = SPELLED_POWER_RE.exec(text);
  if (match) return { energy: null, power: toNumber(match[1]), form: "spelled" };
  return null;
}

const FLOAT_DETAIL_RE = /^Float (.+)$/iu;
const EXHAUST_DETAIL_RE = /^Exhaust (\d+)$/iu;
const RECYCLE_DETAIL_RE = /^Recycle (.+?)(?: \(\+(\d+)E\))?$/iu;
const COUNTED_DETAIL_RE = /^(\d+)×\s*(.+)$/u;
const GOLD_DETAIL_RE = /^(?:(\d+)\s+)?Gold$/iu;

function parsePaymentDetail(value: string): PaymentDetail {
  const text = value.trim();
  let match = FLOAT_DETAIL_RE.exec(text);
  if (match) {
    const resources = parseResources(match[1] ?? "");
    return resources ? { kind: "float", resources } : { kind: "text", text };
  }
  match = EXHAUST_DETAIL_RE.exec(text);
  if (match) return { kind: "exhaust", count: Number(match[1]) };
  match = RECYCLE_DETAIL_RE.exec(text);
  if (match) {
    const sourceText = match[1] ?? "";
    const multi = (() => {
      const parts = sourceText.split(/,\s+and\s+|\s+and\s+|,\s+/iu);
      if (parts.length < 2) return null;
      const runes = parts.map(parseRunes);
      return runes.every((rune) => rune !== null) ? (runes as RuneSummary[]) : null;
    })();
    return {
      kind: "recycle",
      source: parseRunes(sourceText) ?? multi ?? sourceText,
      energy: match[2] === undefined ? null : Number(match[2]),
    };
  }
  match = COUNTED_DETAIL_RE.exec(text);
  if (match) return { kind: "countedCard", count: Number(match[1]), card: match[2] ?? "" };
  match = GOLD_DETAIL_RE.exec(text);
  if (match) return { kind: "gold", count: match[1] === undefined ? 1 : Number(match[1]) };
  return { kind: "card", card: text };
}

/* ---------------------------------------------------- descriptor table */

type SelectMap = Readonly<Record<string, string>>;

interface ParamSpec {
  group: number;
  type:
    | "count"
    | "select"
    | "text"
    | "object"
    | "zone"
    | "format"
    | "winner"
    | "token"
    | "competitor"
    | "runes"
    | "runesOrObject"
    | "resources"
    | "floatingResources"
    | "paymentDetails"
    | "runeBatchClauses"
    | "rolls";
  options?: SelectMap;
  fallback?: string | number;
}

interface SentenceDescriptor {
  id: string;
  kind: "literal" | "pattern" | "params";
  literal?: string;
  regex?: RegExp;
  specs?: Record<string, ParamSpec>;
  parse?: (text: string) => SentenceParams | null;
  selects?: Record<string, string[]>;
}

const LITERAL_DESCRIPTORS: readonly string[] = [
  "closedDeckPeek",
  "shuffledDeck",
  "revealedHand",
  "hidHand",
  "revealedHiddenBoardCard",
  "hidHiddenBoardCard",
  "revealedHandCard",
  "hidHandCard",
  "endedTurn",
  "queuedTimeWarpTurn",
  "canceledTimeWarpTurn",
  "channeledRune",
  "readiedAllRunes",
  "autoPaidCardCosts",
  "autoPaid",
  "madePayment",
  "endedBeginningPhase",
  "clearedFloatingResources",
  "passedFocus",
  "autoSelectedLastBattlefield",
  "chooseTurnOrderThenMulligan",
  "chooseTurnOrderThenSideboard",
  "chooseSoloFirstSeat",
  "chooseSoloFirstSeatThenSideboard",
  "battlefieldsLockedRollD20",
  "choosesStarter",
  "lockedRandomBattlefield",
  "lockedBattlefield",
  "rolledD20",
  "goldfishSecondMulligan",
  "goldfishFirstMulligan",
  "goldfishSecondSideboard",
  "goldfishFirstSideboard",
  "autoStartedTestSetup",
  "updatedSideboarding",
  "lockedSideboarding",
  "confirmedChampion",
  "skippedCardSwapsConfirmChampions",
  "bothChampionsLockedMulligan",
  "allChampionsLockedMulligan",
  "skippedSideboarding",
  "requestedSkipSideboarding",
  "acceptedSkipSideboarding",
  "declinedSkipSideboarding",
  "canceledSkipSideboarding",
  "bothSkippedSideboardingMulligan",
  "allSkippedSideboardingMulligan",
  "allSkippedSideboardingChooseBattlefields",
  "bothSideboardsAutoLockedMulligan",
  "bothSideboardsAutoLockedChooseBattlefields",
  "allSideboardsAutoLockedMulligan",
  "allSideboardsAutoLockedChooseBattlefields",
  "bothSideboardsLockedMulligan",
  "allSideboardsLockedMulligan",
  "bothSideboardsLockedChooseUnusedBattlefield",
  "bothSideboardsLockedChooseBattlefield",
  "continuedWithoutOpponent",
  "bothMulligansComplete",
  "allMulligansComplete",
  "isReady",
  "isNoLongerReady",
  "startedSinglePlayer",
  "startedMatch",
  "filledOpponentSeat",
  "randomizedTeams",
  "rewound",
  "restoredTimeline",
];

const DEPARTURE_MAP: SelectMap = {
  conceded: "conceded",
  "conceded the match": "concededMatch",
  "returned to the lobby": "lobby",
  "left the game": "left",
  "forfeited after disconnecting": "disconnected",
};

const DEPARTURE_TEXT =
  "conceded the match|conceded|returned to the lobby|left the game|forfeited after disconnecting";

const VISIBILITY_MAP: SelectMap = { revealed: "revealed", hid: "hid" };
const POSITION_MAP: SelectMap = { top: "top", bottom: "bottom" };
const ACTOR_SPEC: ParamSpec = {
  group: 1,
  type: "select",
  options: { "a player ": "anonymous" },
  fallback: "author",
};

const FORMAT_MAP: SelectMap = {
  "Best of 1": "bestOf1",
  "Best of 3": "bestOf3",
  Standard: "standard",
  Unrestricted: "unrestricted",
  sealed: "sealed",
  "Unleashed Pre-Rift": "unleashedPreRift",
  "Vendetta Pre-Rift": "vendettaPreRift",
  "Radiance Pre-Rift": "radiancePreRift",
};

const ZONE_ALIASES: SelectMap = {
  hand: "hand",
  base: "base",
  trash: "trash",
  banished: "banished",
  "battlefield a": "battlefieldA",
  "battlefield b": "battlefieldB",
  "battlefield c": "battlefieldC",
  "rune area": "runeArea",
  "champion area": "championArea",
  deck: "deck",
  "deck peek": "deckPeek",
  "top of deck": "topOfDeck",
  "bottom of deck": "bottomOfDeck",
  "legend area": "legendArea",
  chain: "chain",
  "baron pit": "baronPit",
  brush: "brush",
  "blank battlefield": "blankBattlefield",
};

const OBJECT_ALIASES: SelectMap = { "a card": "aCard", card: "card" };

function pattern(
  id: string,
  regex: RegExp,
  specs: Record<string, ParamSpec> = {},
): SentenceDescriptor {
  return { id, kind: "pattern", regex, specs };
}

function parsePatternMatch(descriptor: SentenceDescriptor, text: string): SentenceParams | null {
  const match = descriptor.regex?.exec(text);
  if (!match) return null;
  const params: SentenceParams = {};
  for (const [name, spec] of Object.entries(descriptor.specs ?? {})) {
    const group = match[spec.group];
    switch (spec.type) {
      case "count":
        params[name] = group === undefined ? (spec.fallback ?? 0) : Number(group);
        break;
      case "select":
        params[name] =
          group === undefined
            ? (spec.fallback ?? "other")
            : (spec.options?.[group.toLowerCase()] ?? group.toLowerCase());
        break;
      case "runesOrObject":
        params[name] = parseRunes(group ?? "") ?? group ?? "";
        break;
      case "resources":
      case "floatingResources":
        params[name] = parseResources(group ?? "") ?? {
          energy: null,
          power: null,
          form: "spelled",
        };
        break;
      default:
        params[name] = group ?? "";
    }
  }
  return params;
}

/* ------------------------------------------------- parameterized parsers */

const RUNE_BATCH_TEXT = String.raw`\d+\s+(?:(?:body|calm|chaos|fury|mind|order)\s+)?runes?`;
const RUNE_BATCH_LINE_RE = new RegExp(`^(${RUNE_BATCH_TEXT})$`, "i");
const RUNE_BATCH_OP_RE: ReadonlyArray<readonly [string, RegExp]> = [
  ["channel", new RegExp(`^channeled (${RUNE_BATCH_TEXT})$`, "i")],
  ["exhaust", new RegExp(`^exhausted (${RUNE_BATCH_TEXT})$`, "i")],
  ["ready", new RegExp(`^readied (${RUNE_BATCH_TEXT})$`, "i")],
  ["recycleFloat", new RegExp(`^recycled (${RUNE_BATCH_TEXT}) to float (\\d+) energy$`, "i")],
  ["recycle", new RegExp(`^recycled (${RUNE_BATCH_TEXT})$`, "i")],
];
const RUNE_BATCH_FLOAT_RE = new RegExp(`^(${RUNE_BATCH_TEXT})(?: to float (\\d+) energy)?$`, "i");

function parseRuneBatch(text: string): SentenceParams | null {
  const stripped = text.replace(/\.$/u, "");
  if (!/^(?:channeled|exhausted|readied|recycled)\b/i.test(stripped)) return null;
  const fragments = stripped
    .replace(/,\s+and\s+/giu, "\n")
    .replace(/\s+and\s+/giu, "\n")
    .replace(/,\s+/gu, "\n")
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
  const clauses: RuneBatchClause[] = [];
  for (const fragment of fragments) {
    const floatMatch = RUNE_BATCH_FLOAT_RE.exec(fragment);
    const previous = clauses.at(-1);
    const runes = floatMatch ? parseRunes(floatMatch[1] ?? "") : null;
    if (floatMatch && runes && previous && previous.action !== "recycleFloat") {
      const combined = [...asArray(previous.runes), runes];
      if (floatMatch[2] === undefined)
        clauses[clauses.length - 1] = { ...previous, runes: combined };
      else {
        if (previous.action !== "recycle") return null;
        clauses[clauses.length - 1] = {
          action: "recycleFloat",
          runes: combined,
          energy: Number(floatMatch[2]),
        };
      }
      continue;
    }
    let clause: RuneBatchClause | null = null;
    for (const [action, regex] of RUNE_BATCH_OP_RE) {
      const match = regex.exec(fragment);
      const matched = match ? parseRunes(match[1] ?? "") : null;
      if (match && matched) {
        clause =
          action === "recycleFloat"
            ? {
                action: action as RuneBatchClause["action"],
                runes: matched,
                energy: Number(match[2]),
              }
            : { action: action as RuneBatchClause["action"], runes: matched };
        break;
      }
    }
    if (!clause) return null;
    clauses.push(clause);
  }
  return { clauses };
}

const PAYMENT_AUTO_RE = /^(auto-)?paid (\d+E(?:\s*\/\s*\d+P)?|\d+P)(?:\s+—\s+(.+))?\.$/iu;
const PAYMENT_SPELLED_RE = /^(auto-)?paid (\d+ energy(?: and \d+ power)?|\d+ power)\.$/iu;

function parsePayment(text: string): SentenceParams | null {
  for (const regex of [PAYMENT_AUTO_RE, PAYMENT_SPELLED_RE]) {
    const match = regex.exec(text);
    const resources = match ? parseResources(match[2] ?? "") : null;
    if (match && resources) {
      return {
        auto: match[1] ? "yes" : "no",
        resources,
        details: match[3] ? match[3].split(/\s+·\s+/u).map(parsePaymentDetail) : [],
      };
    }
  }
  return null;
}

function parseRolls(text: string): SentenceParams | null {
  if (!/^(?:.+ rolled \d+\.\s*)+$/i.test(text)) return null;
  const rolls: Roll[] = [];
  for (const match of text.matchAll(/(.+?) rolled (\d+)\./gi)) {
    rolls.push({ competitor: match[1] ?? "", roll: Number(match[2]) });
  }
  return { rolls };
}

function patternDescriptors(): SentenceDescriptor[] {
  return [
    pattern("rolledDie", /^rolled a d(4|6|8|10|12|20): (\d+)\.$/i, {
      sides: { group: 1, type: "count" },
      result: { group: 2, type: "count" },
    }),
    {
      id: "runeBatch",
      kind: "params",
      parse: parseRuneBatch,
      specs: { clauses: { group: 0, type: "runeBatchClauses" } },
    },
    {
      id: "payment",
      kind: "params",
      parse: parsePayment,
      selects: { auto: ["yes", "no"] },
      specs: {
        auto: { group: 0, type: "select", options: { yes: "yes", no: "no" } },
        resources: { group: 0, type: "resources" },
        details: { group: 0, type: "paymentDetails" },
      },
    },
    pattern(
      "forfeitedMatch",
      /^(A player )?forfeited after disconnecting\. (.+) wins the match\.$/i,
      {
        actor: ACTOR_SPEC,
        winner: { group: 2, type: "winner" },
      },
    ),
    pattern(
      "departedMatchWinner",
      new RegExp(`^(A player )?(${DEPARTURE_TEXT})\\. (.+) wins the match\\.$`, "i"),
      {
        actor: ACTOR_SPEC,
        departure: { group: 2, type: "select", options: DEPARTURE_MAP },
        winner: { group: 3, type: "winner" },
      },
    ),
    pattern(
      "departedEliminated",
      new RegExp(`^(A player )?(${DEPARTURE_TEXT}) and was eliminated\\.$`, "i"),
      {
        actor: ACTOR_SPEC,
        departure: { group: 2, type: "select", options: DEPARTURE_MAP },
      },
    ),
    pattern(
      "departedWinner",
      new RegExp(`^(A player )?(${DEPARTURE_TEXT})\\. (.+) (wins?)\\.$`, "i"),
      {
        actor: ACTOR_SPEC,
        departure: { group: 2, type: "select", options: DEPARTURE_MAP },
        winner: { group: 3, type: "winner" },
        winners: { group: 4, type: "select", options: { wins: "one", win: "many" } },
      },
    ),
    pattern("lookedAtTopCards", /^looked at top (\d+) card\(s\) of their deck\.$/i, {
      count: { group: 1, type: "count" },
    }),
    pattern("lookedAtTopRune", /^looked at the top rune of their rune deck\.$/i),
    pattern("lookedAtTopRunes", /^looked at the top (\d+) runes of their rune deck\.$/i, {
      count: { group: 1, type: "count" },
    }),
    pattern("lookedAtBottomCard", /^looked at a card from the bottom of their deck\.$/i),
    pattern(
      "recycledLookedAtCards",
      /^recycled (\d+) looked-at cards? to bottom of deck in random order\.$/i,
      {
        count: { group: 1, type: "count" },
      },
    ),
    pattern("recycledAllLookedAtCards", /^recycled looked-at deck cards to bottom of deck\.$/i),
    pattern("recycledLookedAtCard", /^recycled a looked-at card to bottom of deck\.$/i),
    pattern(
      "recycledLookedAtRunes",
      /^recycled (\d+) looked-at runes? to bottom of rune deck\.$/i,
      {
        count: { group: 1, type: "count" },
      },
    ),
    pattern("recycledAllLookedAtRunes", /^recycled looked-at runes to bottom of rune deck\.$/i),
    pattern("recycledLookedAtRune", /^recycled a looked-at rune to bottom of rune deck\.$/i),
    pattern("putLookedAtCardOnTop", /^put a looked-at card on top of their deck\.$/i),
    pattern("changedLookedAtCardVisibility", /^(revealed|hid) a looked-at deck card\.$/i, {
      visibility: { group: 1, type: "select", options: VISIBILITY_MAP },
    }),
    pattern("changedLookedAtCardsVisibility", /^(revealed|hid) looked-at deck cards\.$/i, {
      visibility: { group: 1, type: "select", options: VISIBILITY_MAP },
    }),
    pattern("changedLookedAtRuneVisibility", /^(revealed|hid) a looked-at rune\.$/i, {
      visibility: { group: 1, type: "select", options: VISIBILITY_MAP },
    }),
    pattern("changedLookedAtRunesVisibility", /^(revealed|hid) looked-at runes\.$/i, {
      visibility: { group: 1, type: "select", options: VISIBILITY_MAP },
    }),
    pattern("closedRuneDeckPeek", /^closed rune deck peek\.$/i),
    pattern(
      "shuffledKeepingRecycled",
      /^shuffled their unrecycled deck cards, keeping (\d+) recycled cards? on the bottom\.$/i,
      { count: { group: 1, type: "count" } },
    ),
    pattern("drewCards", /^drew (\d+) cards?\.$/i, { count: { group: 1, type: "count" } }),
    pattern("burnedCards", /^burned (\d+) cards? from the top of their deck\.$/i, {
      count: { group: 1, type: "count" },
    }),
    pattern("movedCardsFromDeck", /^moved (\d+) card\(s\) from deck to (.+)\.$/i, {
      count: { group: 1, type: "count" },
      zone: { group: 2, type: "zone" },
    }),
    pattern("unlinkedFrom", /^unlinked (.+) from (.+)\.$/i, {
      card: { group: 1, type: "object" },
      source: { group: 2, type: "object" },
    }),
    pattern("unlinked", /^unlinked (.+)\.$/i, { card: { group: 1, type: "object" } }),
    pattern("banishedTopCardWith", /^banished (.+) from the top of their deck with (.+)\.$/i, {
      card: { group: 1, type: "object" },
      source: { group: 2, type: "object" },
    }),
    pattern("banishedTopCard", /^banished (.+) from the top of their deck\.$/i, {
      card: { group: 1, type: "object" },
    }),
    pattern("banishedWithSource", /^banished (.+) with (.+)\.$/i, {
      card: { group: 1, type: "object" },
      source: { group: 2, type: "object" },
    }),
    pattern("killedToPlayFromBanished", /^killed (.+?) to play (.+) from banished to (.+)\.$/i, {
      source: { group: 1, type: "object" },
      card: { group: 2, type: "object" },
      zone: { group: 3, type: "zone" },
    }),
    pattern(
      "playedFromOpponentTrashWith",
      /^played (.+) from an opponent's trash to (.+) with (.+)\.$/i,
      {
        card: { group: 1, type: "object" },
        zone: { group: 2, type: "zone" },
        source: { group: 3, type: "object" },
      },
    ),
    pattern("movedTopCard", /^moved top card to (.+)\.$/i, { zone: { group: 1, type: "zone" } }),
    pattern("movedACardFromDeck", /^moved a card from deck to (.+)\.$/i, {
      zone: { group: 1, type: "zone" },
    }),
    pattern("playedFromTopOfDeck", /^played (.+) from top of deck to (.+)\.$/i, {
      card: { group: 1, type: "object" },
      zone: { group: 2, type: "zone" },
    }),
    pattern("movedCardFromDeck", /^moved (.+) from deck to (.+)\.$/i, {
      card: { group: 1, type: "object" },
      zone: { group: 2, type: "zone" },
    }),
    pattern("playedTokens", /^played (?:(\d+) )?(.+ tokens?) to (.+)\.$/i, {
      count: { group: 1, type: "count", fallback: 1 },
      token: { group: 2, type: "token" },
      zone: { group: 3, type: "zone" },
    }),
    pattern("movedToRuneDeck", /^moved (.+) to (top|bottom) of rune deck\.$/i, {
      card: { group: 1, type: "object" },
      position: { group: 2, type: "select", options: POSITION_MAP },
    }),
    pattern("putHiddenCard", /^put a hidden card to (.+)\.$/i, {
      zone: { group: 1, type: "zone" },
    }),
    pattern("movedHiddenCard", /^moved a hidden card to (.+)\.$/i, {
      zone: { group: 1, type: "zone" },
    }),
    pattern("playedFromZoneTo", /^played (.+) from (.+?) to (.+)\.$/i, {
      card: { group: 1, type: "object" },
      source: { group: 2, type: "zone" },
      zone: { group: 3, type: "zone" },
    }),
    pattern("removedToken", /^removed (.+ token) from play\.$/i, {
      token: { group: 1, type: "token" },
    }),
    pattern("movedCardsToTrash", /^moved (\d+) cards? from (.+) to trash\.$/i, {
      count: { group: 1, type: "count" },
      source: { group: 2, type: "zone" },
    }),
    pattern("movedSelectedCards", /^moved (\d+) selected cards? from (.+) to (.+)\.$/i, {
      count: { group: 1, type: "count" },
      source: { group: 2, type: "zone" },
      zone: { group: 3, type: "zone" },
    }),
    pattern("movedCardToTrash", /^moved (.+) from (.+) to trash\.$/i, {
      card: { group: 1, type: "object" },
      source: { group: 2, type: "zone" },
    }),
    pattern(
      "recycledSelectedCards",
      /^recycled (\d+) selected cards? from (.+) into deck in random order\.$/i,
      {
        count: { group: 1, type: "count" },
        source: { group: 2, type: "zone" },
      },
    ),
    pattern("gaveControl", /^gave control of (.+)\.$/i, { card: { group: 1, type: "object" } }),
    pattern("equippedACard", /^equipped a card\.$/i),
    pattern("equipped", /^equipped (.+) to (.+)\.$/i, {
      card: { group: 1, type: "object" },
      target: { group: 2, type: "object" },
    }),
    pattern("movedIntoDeck", /^moved (.+) into deck \((top|bottom)\)\.$/i, {
      card: { group: 1, type: "object" },
      position: { group: 2, type: "select", options: POSITION_MAP },
    }),
    pattern("recycledTrashCards", /^recycled (\d+) trash cards? into deck in random order\.$/i, {
      count: { group: 1, type: "count" },
    }),
    pattern("usedGoldTokenGainedPower", /^used a Gold token and gained 1 floating power\.$/i),
    pattern("usedGoldToken", /^used a Gold token\.$/i),
    pattern(
      "exhaustedRemovedGainedPower",
      /^exhausted (.+), removed it from play, and gained 1 floating power\.$/i,
      {
        card: { group: 1, type: "object" },
      },
    ),
    pattern("exhaustedRemoved", /^exhausted (.+) and removed it from play\.$/i, {
      card: { group: 1, type: "object" },
    }),
    pattern(
      "exhaustedTrashedGainedPower",
      /^exhausted (.+), trashed it, and gained 1 floating power\.$/i,
      {
        card: { group: 1, type: "object" },
      },
    ),
    pattern("exhausted", /^exhausted (.+)\.$/i, { card: { group: 1, type: "object" } }),
    pattern("readied", /^readied (.+)\.$/i, { card: { group: 1, type: "object" } }),
    pattern("setScore", /^set score to (-?\d+)\. \(([+-]?\d+)\)$/i, {
      score: { group: 1, type: "text" },
      delta: { group: 2, type: "text" },
    }),
    pattern("adjustedScore", /^adjusted score to (-?\d+)\.$/i, {
      score: { group: 1, type: "text" },
    }),
    pattern("scoredAtTurnStart", /^scored (\d+) at turn start\. Score: (-?\d+) → (-?\d+)\.$/i, {
      points: { group: 1, type: "count" },
      from: { group: 2, type: "text" },
      to: { group: 3, type: "text" },
    }),
    pattern(
      "adjustedFloatingResources",
      /^adjusted floating resources to (-?\d+) energy and (-?\d+) power\.$/i,
      {
        energy: { group: 1, type: "text" },
        power: { group: 2, type: "text" },
      },
    ),
    pattern("adjustedFloatingResource", /^adjusted floating (energy|power) to (-?\d+)\.$/i, {
      resource: { group: 1, type: "select", options: { energy: "energy", power: "power" } },
      value: { group: 2, type: "text" },
    }),
    pattern("appliedBuff", /^applied buff to (.+)\.$/i, { card: { group: 1, type: "object" } }),
    pattern("consumedBuff", /^consumed buff from (.+)\.$/i, { card: { group: 1, type: "object" } }),
    pattern("madeUnitWithOrianna", /^made (.+) a unit with Orianna\.$/i, {
      card: { group: 1, type: "object" },
    }),
    pattern("addedLegendWithNeeko", /^added (.+) to their legend area with Neeko\.$/i, {
      card: { group: 1, type: "object" },
    }),
    pattern("returnedAdditionalLegend", /^returned (.+) to their Additional Legends\.$/i, {
      card: { group: 1, type: "object" },
    }),
    pattern("changedXp", /^(Increased|Decreased) XP to (-?\d+)\. \(([+-]?\d+)\)$/i, {
      direction: {
        group: 1,
        type: "select",
        options: { increased: "increased", decreased: "decreased" },
      },
      xp: { group: 2, type: "text" },
      delta: { group: 3, type: "text" },
    }),
    pattern("duplicatedOpponentCard", /^duplicated opponent (.+) to base\.$/i, {
      card: { group: 1, type: "object" },
    }),
    pattern("duplicatedInZone", /^duplicated (.+) in (.+)\.$/i, {
      card: { group: 1, type: "object" },
      zone: { group: 2, type: "zone" },
    }),
    pattern("removedFromPlay", /^removed (.+) from play\.$/i, {
      card: { group: 1, type: "object" },
    }),
    pattern("playedFromZone", /^played (.+) from (.+)\.$/i, {
      card: { group: 1, type: "object" },
      source: { group: 2, type: "zone" },
    }),
    pattern("recycledFromChainToTop", /^recycled (.+) from chain to top of deck\.$/i, {
      card: { group: 1, type: "object" },
    }),
    pattern("recycledFromChainToBottom", /^recycled (.+) from chain to bottom of deck\.$/i, {
      card: { group: 1, type: "object" },
    }),
    pattern("banishedFromChain", /^banished (.+) from chain\.$/i, {
      card: { group: 1, type: "object" },
    }),
    pattern("markedRepeat", /^marked Repeat for (.+)\.$/i, { card: { group: 1, type: "object" } }),
    pattern("clearedRepeat", /^cleared Repeat for (.+)\.$/i, {
      card: { group: 1, type: "object" },
    }),
    pattern("chainResolved", /^chain resolved: (.+)\.$/i, { card: { group: 1, type: "object" } }),
    pattern("replacedWithBrush", /^replaced (.+) with Brush\.$/i, {
      zone: { group: 1, type: "zone" },
    }),
    pattern("restored", /^restored (.+)\.$/i, { zone: { group: 1, type: "zone" } }),
    pattern("passedFocusAt", /^passed focus at (.+)\.$/i, { zone: { group: 1, type: "zone" } }),
    pattern("endedShowdownResponses", /^ended showdown responses at (.+)\.$/i, {
      zone: { group: 1, type: "zone" },
    }),
    pattern("dismissedShowdown", /^dismissed showdown at (.+)\.$/i, {
      zone: { group: 1, type: "zone" },
    }),
    pattern("conqueredAndScored", /^conquered (.+) and scored (\d+)\.$/i, {
      zone: { group: 1, type: "zone" },
      count: { group: 2, type: "count" },
    }),
    pattern("conqueredAndDrew", /^conquered (.+) and drew (\d+)\.$/i, {
      zone: { group: 1, type: "zone" },
      count: { group: 2, type: "count" },
    }),
    pattern("conquered", /^conquered (.+)\.$/i, { zone: { group: 1, type: "zone" } }),
    pattern("movedToZone", /^moved (.+) to (.+)\.$/i, {
      card: { group: 1, type: "object" },
      zone: { group: 2, type: "zone" },
    }),
    {
      id: "rolls",
      kind: "params",
      parse: parseRolls,
      specs: { rolls: { group: 0, type: "rolls" } },
    },
    pattern("rolledD20By", /^(.+) rolled a d20\.$/i, {
      competitor: { group: 1, type: "competitor" },
    }),
    pattern(
      "teamInitiativeSetup",
      /^(.+) setup begins with initiative\. Both teams roll a d20\.$/i,
      {
        format: { group: 1, type: "format" },
      },
    ),
    pattern(
      "playerInitiativeSetup",
      /^(.+) setup begins with initiative\. All (\d+) players roll a d20\.$/i,
      {
        format: { group: 1, type: "format" },
        count: { group: 2, type: "count" },
      },
    ),
    pattern(
      "allBattlefieldsLockedSideboard",
      /^all (\d+) battlefields are locked\. All players now sideboard\.$/i,
      {
        count: { group: 1, type: "count" },
      },
    ),
    pattern(
      "allBattlefieldsLockedMulligan",
      /^all (\d+) battlefields are locked\. All players may mulligan up to 2 cards\.$/i,
      {
        count: { group: 1, type: "count" },
      },
    ),
    pattern(
      "competitorWonInitiative",
      /^(.+) wins initiative \((\d+) vs (\d+)\) and decides who plays first\.$/i,
      {
        competitor: { group: 1, type: "competitor" },
        high: { group: 2, type: "count" },
        low: { group: 3, type: "count" },
      },
    ),
    pattern(
      "wonInitiative",
      /^wins initiative \((\d+) vs (\d+)\) and decides who plays first\.$/i,
      {
        high: { group: 1, type: "count" },
        low: { group: 2, type: "count" },
      },
    ),
    pattern(
      "mustChooseStarterBoth",
      /^(.+) must choose who starts\. Both players draw 4 cards once mulligan begins\.$/i,
      {
        competitor: { group: 1, type: "competitor" },
      },
    ),
    pattern(
      "mustChooseStarterAll",
      /^(.+) must choose who starts\. All players draw 4 cards once mulligan begins\.$/i,
      {
        competitor: { group: 1, type: "competitor" },
      },
    ),
    pattern("previousLoserChooses", /^the previous game loser chooses who starts this game\.$/i),
    pattern(
      "competitorChoseStarterBattlefields",
      /^(.+) chose (.+) to take the first turn\. The battlefield contributors now choose their battlefields\.$/i,
      { competitor: { group: 1, type: "competitor" }, player: { group: 2, type: "text" } },
    ),
    pattern(
      "choseStarterMulligan",
      /^chose (.+) to take the first turn\. Both players now mulligan up to 2 cards\.$/i,
      {
        player: { group: 1, type: "text" },
      },
    ),
    pattern(
      "choseStarterSideboard",
      /^chose (.+) to take the first turn\. Both players now sideboard\.$/i,
      {
        player: { group: 1, type: "text" },
      },
    ),
    pattern(
      "choseStarterBattlefields",
      /^chose (.+) to take the first turn\. The battlefield contributors now choose their battlefields\.$/i,
      { player: { group: 1, type: "text" } },
    ),
    pattern("updatedRegistration", /^updated their (.+) registration\.$/i, {
      format: { group: 1, type: "format" },
    }),
    pattern("lockedRegistration", /^locked in their (.+) registration\.$/i, {
      format: { group: 1, type: "format" },
    }),
    pattern(
      "bothRegistrationsLockedChooseUnused",
      /^both (.+) registrations are locked\. Each player should now choose one unused battlefield\.$/i,
      { format: { group: 1, type: "format" } },
    ),
    pattern(
      "bothRegistrationsLockedChoose",
      /^both (.+) registrations are locked\. Each player should now choose one battlefield\.$/i,
      { format: { group: 1, type: "format" } },
    ),
    pattern(
      "bothRegistrationsLockedMulligan",
      /^both (.+) registrations are locked\. Mulligan up to 2 cards\.$/i,
      { format: { group: 1, type: "format" } },
    ),
    pattern(
      "allRegistrationsLockedMulligan",
      /^all (.+) registrations are locked\. All players may mulligan up to 2 cards\.$/i,
      { format: { group: 1, type: "format" } },
    ),
    pattern("finalizedMulligan", /^finalized mulligan \((\d+) recycled, (\d+) redrawn\)\.$/i, {
      recycled: { group: 1, type: "count" },
      redrawn: { group: 2, type: "count" },
    }),
    pattern(
      "submittedDeck",
      /^submitted a deck \((\d+) main-deck cards, (\d+) battlefields\)\.$/i,
      {
        cards: { group: 1, type: "count" },
        battlefields: { group: 2, type: "count" },
      },
    ),
    pattern("selectedRegistration", /^selected a (.+) registration\.$/i, {
      format: { group: 1, type: "format" },
    }),
    pattern("changedRoomFormat", /^changed the room to (Best of 1|Best of 3)\.$/i, {
      format: { group: 1, type: "format" },
    }),
    pattern("changedDeckRules", /^changed deck rules to (Standard|Unrestricted)\.$/i, {
      format: { group: 1, type: "format" },
    }),
    pattern("movedToSeat", /^moved to player seat (\d+)\.$/i, {
      seat: { group: 1, type: "count" },
    }),
    pattern("changedGameType", /^changed the game type to (.+)\.$/i, {
      format: { group: 1, type: "format" },
    }),
    pattern(
      "recycledToFloat",
      /^recycled (.+) to float (\d+ energy(?: and \d+ power)?|\d+ power)\.$/i,
      {
        source: { group: 1, type: "runesOrObject" },
        resources: { group: 2, type: "floatingResources" },
      },
    ),
    pattern("recycled", /^recycled (.+)\.$/i, { card: { group: 1, type: "object" } }),
    pattern("performedCardActivity", /^performed card activity\.$/i),
  ];
}

/** The full descriptor table in the original evaluation order. */
export const SENTENCE_DESCRIPTORS: readonly SentenceDescriptor[] = (() => {
  const literals = new Map(LITERAL_DESCRIPTORS.map((id) => [id, { id, kind: "literal" as const }]));
  const patterns = new Map(patternDescriptors().map((descriptor) => [descriptor.id, descriptor]));
  const rolledIndex = LITERAL_DESCRIPTORS.indexOf("rolledD20");
  const order = [
    ...LITERAL_DESCRIPTORS.slice(0, rolledIndex + 1),
    "rolledDie",
    ...LITERAL_DESCRIPTORS.slice(rolledIndex + 1),
    "runeBatch",
    "payment",
    ...[...patterns.keys()].filter(
      (id) => id !== "rolledDie" && id !== "runeBatch" && id !== "payment",
    ),
  ];
  const seen = new Set<string>();
  const result: SentenceDescriptor[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    const descriptor = literals.get(id) ?? patterns.get(id);
    if (descriptor) result.push(descriptor);
  }
  return result;
})();

/* --------------------------------------------------------------- parser */

const SENTENCE_BY_KEY = new Map(
  SENTENCE_DESCRIPTORS.map((descriptor) => [`sentence.${descriptor.id}`, descriptor]),
);

/** Parse canonical English log text into a sentence key + params (or null). */
export function parseGameLogText(text: string): ParsedSentence | null {
  const value = text.trim();
  if (!value) return null;
  for (const descriptor of SENTENCE_DESCRIPTORS) {
    if (descriptor.kind === "literal") {
      if (value === EN_LITERAL_TEXT[descriptor.id])
        return { key: `sentence.${descriptor.id}`, params: {} };
      continue;
    }
    if (descriptor.kind === "params") {
      const params = descriptor.parse?.(value);
      if (params) return { key: `sentence.${descriptor.id}`, params, selects: descriptor.selects };
      continue;
    }
    const params = parsePatternMatch(descriptor, value);
    if (params) return { key: `sentence.${descriptor.id}`, params, selects: descriptor.selects };
  }
  return null;
}

/* The EN literal text (used only to recognize literals in canonical logs). */
const EN_LITERAL_TEXT: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(EN_SENTENCES).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ),
);

/* ------------------------------------------------------------- renderer */

const FR_LOWER_TOKEN_RE = /^Créations?(?=\s|$)/u;

function localizeTerm(locale: LocaleCode, term: string, options: GameLogOptions): string | null {
  const translated = options.translateTerm?.(term, locale);
  return translated && translated !== term ? translated : null;
}

function localizedCardName(
  locale: LocaleCode,
  cardId: string,
  fallback: string,
  options: GameLogOptions,
): string {
  return options.cardName?.(cardId, locale)?.trim() || fallback;
}

function cardForName(name: string) {
  return getCardByName(name.trim());
}

interface RenderState {
  locale: LocaleCode;
  translator: Translator;
  options: GameLogOptions;
  runePhrases: string[];
}

function label(state: RenderState, namespace: string, key: string | undefined): string | null {
  if (key === undefined || key === null) return null;
  return state.translator(`label.${namespace}.${key}`);
}

function tokenLabel(state: RenderState, raw: string): string | null {
  const trimmed = raw.trim();
  const translated = localizeTerm(state.locale, trimmed, state.options);
  if (translated !== null) return translated;
  const plural = /\s+tokens$/iu.test(trimmed) ? "yes" : "no";
  const stem = trimmed.replace(/\s+tokens?$/iu, "").trim();
  return !stem || /^tokens?$/iu.test(stem)
    ? state.translator("phrase.token.generic", { plural })
    : state.translator("phrase.token.named", { stem, plural });
}

function teamLabel(state: RenderState, raw: string): string {
  const trimmed = raw.trim();
  const match = /^Team (\d+)$/iu.exec(trimmed);
  return match
    ? (state.translator("phrase.team", { number: Number(match[1]) }) ?? trimmed)
    : trimmed;
}

function resourcePhrase(
  state: RenderState,
  summary: ResourceSummary,
  key: "phrase.resources" | "phrase.floatingResources",
): string | null {
  const kind =
    summary.energy !== null && summary.power !== null
      ? "both"
      : summary.energy !== null
        ? "energy"
        : "power";
  const rendered = state.translator(key, {
    kind,
    energy: summary.energy ?? 0,
    power: summary.power ?? 0,
    form: summary.form,
  });
  return rendered === null
    ? null
    : markResource(rendered, summary, key === "phrase.floatingResources");
}

function runePhrase(state: RenderState, rune: RuneSummary, key: string): string | null {
  const domainLabel = rune.domain ? (label(state, "domain", rune.domain) ?? rune.domain) : "";
  const rendered = state.translator(key, {
    count: rune.count,
    domain: rune.domain ?? "none",
    domainLabel,
    icon: INVISIBLE_TIMES,
  });
  if (rendered === null) return null;
  state.runePhrases.push(rendered);
  return markRunePhrase(rendered, rune.count, rune.domain);
}

function runeListPhrase(state: RenderState, runes: RuneSource, key: string): string | null {
  const entries = Array.isArray(runes) ? runes : [runes as RuneSummary];
  return joinList(
    state,
    "runes",
    entries.map((rune) => runePhrase(state, rune, key)),
  );
}

function joinList(
  state: RenderState,
  namespace: string,
  values: Array<string | null>,
): string | null {
  if (values.some((value) => value === null)) return null;
  const length = values.length;
  if (length <= 1) return values[0] ?? "";
  if (length === 2) {
    return state.translator(`list.${namespace}.pair`, {
      first: values[0] ?? "",
      rest: values[1] ?? "",
    });
  }
  let tail = state.translator(`list.${namespace}.end`, {
    first: values[length - 2] ?? "",
    rest: values[length - 1] ?? "",
  });
  for (let index = length - 3; index >= 1 && tail !== null; index -= 1) {
    tail = state.translator(`list.${namespace}.middle`, { first: values[index] ?? "", rest: tail });
  }
  return tail === null
    ? null
    : state.translator(`list.${namespace}.start`, { first: values[0] ?? "", rest: tail });
}

interface ResolvedObject {
  text: string;
  cardCode?: string;
  cardId?: string;
  padded: boolean;
}

function resolveObject(state: RenderState, raw: string): ResolvedObject | null {
  const trimmed = raw.trim();
  const alias = label(state, "object", OBJECT_ALIASES[trimmed.toLowerCase()]);
  if (alias !== null) return { text: alias, padded: false };
  const card = cardForName(trimmed);
  if (card) {
    const name = localizedCardName(state.locale, card.id, card.name, state.options);
    const localizedChanged = name !== card.name;
    const padded = !(localizedChanged && !ZH_TOKEN_NAMES.has(name)) || !localizedChanged;
    return { text: name, cardCode: card.id, cardId: card.id, padded };
  }
  const translated = localizeTerm(state.locale, trimmed, state.options);
  if (translated !== null) return { text: translated, padded: false };
  if (/\s+tokens?$/iu.test(trimmed)) {
    const token = tokenLabel(state, trimmed);
    return token === null ? null : { text: token, padded: true };
  }
  return { text: trimmed, padded: true };
}

function renderPaymentDetail(state: RenderState, detail: PaymentDetail): string | null {
  switch (detail.kind) {
    case "text":
      return detail.text;
    case "float": {
      const resources = resourcePhrase(state, detail.resources, "phrase.resources");
      const floating = resourcePhrase(state, detail.resources, "phrase.floatingResources");
      if (resources === null || floating === null) return null;
      return state.translator("phrase.paymentDetail.float", {
        resources,
        floatingResources: floating,
      });
    }
    case "exhaust":
    case "gold":
      return state.translator(`phrase.paymentDetail.${detail.kind}`, { count: detail.count });
    case "recycle": {
      const params: MessageParams = {
        gain: detail.energy === null ? "no" : "yes",
        energy: detail.energy ?? 0,
      };
      if (typeof detail.source === "string") {
        const resolved = resolveObject(state, detail.source);
        if (!resolved) return null;
        params.source = resolved.text;
        params.sourceKind = "object";
      } else {
        const runes = runeListPhrase(state, detail.source, "phrase.runes");
        if (runes === null) return null;
        params.source = runes;
        params.sourcePad = runes;
        params.sourcePadStart = runes;
        params.sourceKind = "runes";
      }
      return state.translator("phrase.paymentDetail.recycle", params);
    }
    case "countedCard": {
      const resolved = resolveObject(state, detail.card);
      if (!resolved) return null;
      return state.translator("phrase.paymentDetail.countedCard", {
        count: detail.count,
        card: resolved.text,
      });
    }
    case "card": {
      const resolved = resolveObject(state, detail.card);
      if (!resolved) return null;
      return state.translator("phrase.paymentDetail.card", { card: resolved.text });
    }
  }
}

function renderParams(
  state: RenderState,
  descriptor: SentenceDescriptor,
  sentence: ParsedSentence,
): MessageParams | null {
  const params: MessageParams = {};
  const setObjectParam = (name: string, resolved: ResolvedObject): string => {
    const marked = resolved.cardId ? markCard(resolved.cardId, resolved.text) : resolved.text;
    params[name] = marked;
    params[`${name}Pad`] = resolved.padded ? ` ${marked} ` : marked;
    params[`${name}PadStart`] = resolved.padded ? ` ${marked}` : marked;
    return marked;
  };

  for (const [name, spec] of Object.entries(descriptor.specs ?? {})) {
    const raw = sentence.params[name];
    const value = (() => {
      switch (spec.type) {
        case "count":
          return Number(raw ?? spec.fallback ?? 0);
        case "select":
          return String(raw ?? spec.fallback ?? "other");
        case "zone": {
          const trimmed = String(raw ?? "").trim();
          const direct = label(state, "zone", ZONE_ALIASES[trimmed.toLowerCase()]);
          if (direct !== null) return direct;
          const card = cardForName(trimmed);
          if (card) return localizedCardName(state.locale, card.id, card.name, state.options);
          return localizeTerm(state.locale, trimmed, state.options) ?? trimmed;
        }
        case "format":
          return (
            label(state, "format", FORMAT_MAP[String(raw ?? "").trim()]) ??
            localizeTerm(state.locale, String(raw ?? ""), state.options) ??
            String(raw ?? "")
          );
        case "winner": {
          const winner = String(raw ?? "");
          params.winnerKind =
            winner.trim().toLowerCase() === "the opposition" ? "opposition" : "player";
          return winner;
        }
        case "token":
          return tokenLabel(state, String(raw ?? ""));
        case "competitor":
          return teamLabel(state, String(raw ?? ""));
        case "object": {
          const resolved = resolveObject(state, String(raw ?? ""));
          if (!resolved) return null;
          return setObjectParam(name, resolved);
        }
        case "runes": {
          const rune =
            typeof raw === "object" && raw !== null
              ? (raw as RuneSummary)
              : parseRunes(String(raw ?? ""));
          return rune ? runePhrase(state, rune, "phrase.runes") : null;
        }
        case "runesOrObject": {
          if (typeof raw === "string") {
            params[`${name}Kind`] = "object";
            const resolved = resolveObject(state, raw);
            return resolved ? resolved.text : null;
          }
          const rune = raw as RuneSummary;
          const phrase = runePhrase(state, rune, "phrase.runes");
          if (phrase === null) return null;
          params[`${name}Pad`] = phrase;
          params[`${name}PadStart`] = phrase;
          params[`${name}Kind`] = "runes";
          return phrase;
        }
        case "resources":
        case "floatingResources": {
          const summary = (raw ?? {
            energy: null,
            power: null,
            form: "spelled",
          }) as ResourceSummary;
          return resourcePhrase(
            state,
            summary,
            spec.type === "resources" ? "phrase.resources" : "phrase.floatingResources",
          );
        }
        case "paymentDetails": {
          const details = (raw ?? []) as PaymentDetail[];
          if (details.length === 0) return "";
          const rendered = details.map((detail) => renderPaymentDetail(state, detail));
          const joined = joinList(state, "paymentDetails", rendered);
          return joined === null
            ? null
            : state.translator("phrase.paymentDetails", { details: joined });
        }
        case "runeBatchClauses": {
          const clauses = (raw ?? []) as RuneBatchClause[];
          const rendered = clauses.map((clause, index) => {
            const runes = runeListPhrase(
              state,
              Array.isArray(clause.runes) ? clause.runes : [clause.runes],
              clause.action === "channel" ? "phrase.runesChanneled" : "phrase.runes",
            );
            if (runes === null) return null;
            return state.translator(`phrase.runeBatch.${clause.action}`, {
              runes,
              energy: clause.energy ?? 0,
              position: index === 0 ? "first" : "other",
            });
          });
          return joinList(state, "runeBatch", rendered);
        }
        case "rolls": {
          const rolls = (raw ?? []) as Roll[];
          const rendered = rolls.map((roll) => {
            const competitor = teamLabel(state, roll.competitor);
            return state.translator("phrase.roll", { competitor, roll: roll.roll });
          });
          return joinList(state, "rolls", rendered);
        }
        default:
          return raw === undefined || raw === null ? "" : String(raw);
      }
    })();
    if (value === null) return null;
    if (!(name in params)) params[name] = value as MessageParams[string];
  }
  // `PadEnd` variants: add a trailing space when the value ends in a word char.
  for (const [name, value] of Object.entries(params)) {
    if (typeof value !== "string" || `${name}PadEnd` in params) continue;
    params[`${name}PadEnd`] = /[A-Za-z0-9]$/u.test(value) ? `${value} ` : value;
  }
  return params;
}

/** Build a marked-up localized string for a parsed sentence (or null). */
export function formatParsedSentence(
  sentence: ParsedSentence,
  locale: string,
  translator: Translator,
  options: GameLogOptions = {},
): string | null {
  const descriptor = SENTENCE_BY_KEY.get(sentence.key);
  if (!descriptor) return null;
  if (!translator.has(sentence.key)) return null;
  const state: RenderState = {
    locale: translator.locale,
    translator,
    options: { ...options, translateTerm: options.translateTerm ?? (() => null) },
    runePhrases: [],
  };
  const params = renderParams(state, descriptor, sentence);
  if (params === null) return null;
  const rendered = translator(sentence.key, params);
  if (rendered === null) return null;
  return insertRuneNames(rendered, state.runePhrases);
}

/** Parse + format canonical English log text. */
export function formatGameLogText(
  text: string,
  locale: string | null | undefined,
  options: GameLogOptions & { translator?: Translator } = {},
): string | null {
  const sentence = parseGameLogText(text);
  if (!sentence) return null;
  const translator = options.translator ?? createSentenceTranslator(locale);
  return formatParsedSentence(sentence, translator.locale, translator, options);
}

/* --------------------------------------------------------------- public */

/**
 * `createGameLogFormatter` — returns `(sentence) => marked string | null`.
 * This is the original formatter API; pass the locale's sentence translator.
 */
export function createGameLogFormatter(
  locale: string,
  translator: Translator,
  options: GameLogOptions = {},
): (sentence: ParsedSentence) => string | null {
  return (sentence) => formatParsedSentence(sentence, locale, translator, options);
}

/**
 * `createGameLogLocalizer` — the original `(englishText) => localized string`.
 * For EN the canonical text is returned unchanged (the bootstrap never loads an
 * EN sentence catalog); other locales parse + rebuild the sentence.
 */
export function createGameLogLocalizer(
  locale: string | null | undefined,
  catalog?: unknown,
  options: GameLogOptions = {},
): (text: string) => string {
  if (String(locale ?? "").toLowerCase() === "en" || locale == null) {
    return (text: string) => text.trim();
  }
  const translator = catalog
    ? createMessageTranslator(locale, catalog as Record<string, unknown>)
    : createSentenceTranslator(locale);
  const formatter = createGameLogFormatter(translator.locale, translator, options);
  return (text: string) => {
    const trimmed = text.trim();
    const sentence = parseGameLogText(trimmed);
    if (!sentence) return trimmed;
    return formatter(sentence) ?? trimmed;
  };
}

/**
 * Render one game-log line as UI segments. EN lines are returned as a single
 * text segment (canonical English is displayed verbatim by the original app).
 */
export function renderGameLogText(
  text: string,
  locale: string | null | undefined,
  options: GameLogOptions = {},
): GameLogSegment[] {
  const normalized = String(locale ?? "en").toLowerCase();
  if (normalized === "en") return [{ type: "text", value: text }];
  const marked = formatGameLogText(text, locale, options);
  if (marked === null) return [{ type: "text", value: text.trim() }];
  // Resource markers contain JSON with no card/rune markers; parse cards first,
  // then rune/resource markup inside each text fragment.
  return normalizeSegments(
    parseCardSegments(marked).filter(
      (segment) => segment.type !== "text" || segment.value.length > 0,
    ),
  );
}

/** Convenience: render a `GameplayLogEntry`-shaped object. */
export function renderGameLogEntry(
  entry: { text: string },
  locale: string | null | undefined,
  options: GameLogOptions = {},
): GameLogSegment[] {
  return renderGameLogText(entry.text, locale, options);
}

/** Plain string form of `renderGameLogText` (for tests/CLI). */
export function gameLogSegmentsToString(segments: readonly GameLogSegment[]): string {
  return segments
    .map((segment) => {
      switch (segment.type) {
        case "text":
        case "card":
          return segment.value;
        case "rune":
          return `${segment.before}${segment.after}`;
        case "resource":
          return segment.value;
      }
    })
    .join("");
}

export { renderCompiled, sentenceCatalog };
