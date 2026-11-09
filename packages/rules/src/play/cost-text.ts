/**
 * Cost text — rules 135.2.e (symbols), 204.1.b (base cost before “:”, alternatives), 204.2
 * (“as an additional cost”), 377.1, 805.1.b (Accelerate), 818.1.c (Equip), 820.1.c (Repeat).
 *
 * Turns printed cost text into a protocol `Cost` so unscripted cards (manual activated
 * abilities, Equip, Repeat, optional additional costs) still pay real costs. Card data writes
 * [A] as `[Rune]`/`[power]` and [E] as `[Tap]`. Phrases the engine cannot pay are kept as
 * `additional["unsupported:<phrase>"]`, which makes the cost unpayable (203.3), never free.
 */
import type { Cost } from "@rift/protocol";
import { normalizeDomain } from "./cost-model";
import { rulesTextLines, stripReminderText } from "./keywords";

const SELF = { targetRef: "self" } as const;

function addPower(cost: Cost, key: string, count = 1): void {
  const power = (cost.power ??= {});
  power[key as keyof typeof power] = (power[key as keyof typeof power] ?? 0) + count;
}

function addAdditional(cost: Cost, key: string, value: number | boolean): void {
  const additional = (cost.additional ??= {});
  const previous = additional[key];
  additional[key] = typeof value === "number" && typeof previous === "number" ? previous + value : value;
}

/** One bracketed symbol. Returns false when the token is not a cost symbol. */
function applyToken(cost: Cost, token: string): boolean {
  const raw = token.trim();
  if (/^\d+$/.test(raw)) {
    cost.energy = (typeof cost.energy === "number" ? cost.energy : 0) + Number(raw);
    return true;
  }
  const lower = raw.toLowerCase();
  if (lower === "rune" || lower === "a" || lower === "power") {
    addPower(cost, "any");
    return true;
  }
  if (lower === "c") {
    addAdditional(cost, "power:self", 1);
    return true;
  }
  if (lower === "tap" || lower === "e" || lower === "t" || lower === "exhaust") {
    cost.exhaust = { ...SELF };
    return true;
  }
  const domain = normalizeDomain(raw);
  if (domain) {
    addPower(cost, domain);
    return true;
  }
  return false;
}

const FRIENDLY = "(?:a friendly|a|one of your|an?)";

/** A single cost phrase (between commas): symbols or a game-action instruction. */
function applyPhrase(cost: Cost, phrase: string): void {
  let text = phrase.trim().replace(/\s+/g, " ").replace(/^pay\s+/i, "");
  if (text.length === 0) return;
  // Pure symbol runs: "[1][Calm]", "[Rune] [Rune]".
  const symbols = text.match(/\[[^\]]+\]/g);
  if (symbols && text.replace(/\[[^\]]+\]/g, "").trim().length === 0) {
    for (const symbol of symbols) {
      if (!applyToken(cost, symbol.slice(1, -1))) addAdditional(cost, `unsupported:${text}`, true);
    }
    return;
  }
  text = text.replace(/\.$/, "");
  let match: RegExpExecArray | null;
  if (/^(kill|destroy) (this|me|it)$/i.test(text)) {
    cost.kill = { ...SELF };
    return;
  }
  if (/^recycle (this|me)$/i.test(text)) {
    addAdditional(cost, "recycle:self", true);
    return;
  }
  if (/^exhaust (this|me)$/i.test(text)) {
    cost.exhaust = { ...SELF };
    return;
  }
  if ((match = new RegExp(`^(exhaust|kill) ${FRIENDLY} (unit|gear)( you control)?$`, "i").exec(text))) {
    const selector = { cardType: match[2]!.toLowerCase(), controller: "self" as const };
    if (match[1]!.toLowerCase() === "exhaust") cost.exhaust = selector;
    else cost.kill = selector;
    return;
  }
  if ((match = /^exhaust your legend$/i.exec(text))) {
    cost.exhaust = { zone: "legend", controller: "self" };
    return;
  }
  if ((match = /^discard (\d+|a card|one card|a|one)( cards?)?$/i.exec(text))) {
    const n = /^\d+$/.test(match[1]!) ? Number(match[1]) : 1;
    cost.discard = (typeof cost.discard === "number" ? cost.discard : 0) + n;
    return;
  }
  if ((match = /^(?:spend|pay) (\d+) xp$/i.exec(text))) {
    cost.spendXp = (typeof cost.spendXp === "number" ? cost.spendXp : 0) + Number(match[1]);
    return;
  }
  if ((match = /^(?:pay )?(\d+) points?$/i.exec(text))) {
    cost.payPoints = (typeof cost.payPoints === "number" ? cost.payPoints : 0) + Number(match[1]);
    return;
  }
  addAdditional(cost, `unsupported:${text}`, true);
}

/** Parse a cost expression such as "[1][Rune], [Tap]" or "Kill this, [Tap]". */
export function parseCostText(text: string): Cost {
  const cost: Cost = {};
  const cleaned = stripReminderText(text).trim();
  if (cleaned.length === 0) return cost;
  for (const part of cleaned.split(/\s*,\s*|\s+and\s+/i)) applyPhrase(cost, part);
  return cost;
}

/** 204.1.b: "[1] or [C]" → each alternative Base Cost. */
export function parseCostAlternatives(text: string): Cost[] {
  return stripReminderText(text)
    .split(/\s+or\s+/i)
    .map((part) => parseCostText(part.replace(/^[\s—–-]+/, "")));
}

export interface ParsedActivatedLine {
  /** The text before “:” with permission keywords removed. */
  costText: string;
  effectText: string;
  /** Permissive keywords attached to the ability (135.2.e.7: `[Reaction][>]`). */
  keywords: string[];
  /** 168/430: the effect Adds resources. */
  addsResources: boolean;
}

const PERMISSION = /^\[(action|reaction)\]\s*[-—–]?\s*/i;

/** 377.1: an activated ability is "cost: effect" (reminder text ignored). */
export function parseActivatedLine(line: string): ParsedActivatedLine | null {
  const text = stripReminderText(line).trim();
  const colon = text.indexOf(":");
  if (colon <= 0) return null;
  let costText = text.slice(0, colon).trim();
  let effectText = text.slice(colon + 1).trim();
  const keywords: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = PERMISSION.exec(costText))) {
    keywords.push(match[1]!.toLowerCase() === "action" ? "Action" : "Reaction");
    costText = costText.slice(match[0].length);
  }
  while ((match = PERMISSION.exec(effectText))) {
    keywords.push(match[1]!.toLowerCase() === "action" ? "Action" : "Reaction");
    effectText = effectText.slice(match[0].length);
  }
  if (costText.length === 0) return null;
  // Dependent keywords before the cost ("[Legion] [Tap]: …") are not cost symbols.
  costText = costText.replace(/^\[(legion|level \d+)\]\s*[-—–]?\s*/i, "");
  return {
    costText,
    effectText,
    keywords,
    addsResources: /^\[add\]|\badd \[/i.test(effectText),
  };
}

/** Activated-ability lines of a card (in printed order, 377.1). */
export function activatedLines(text: string | undefined): ParsedActivatedLine[] {
  const out: ParsedActivatedLine[] = [];
  for (const line of rulesTextLines(text)) {
    if (/^\[equip\]/i.test(stripReminderText(line).trim())) continue; // Equip is its own keyword.
    const parsed = parseActivatedLine(line);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** 818.1.c: the Equip cost alternatives of a card (empty when it has no Equip). */
export function parseEquipCosts(text: string | undefined): Cost[][] {
  const out: Cost[][] = [];
  for (const line of rulesTextLines(text)) {
    const stripped = stripReminderText(line).trim();
    const match = /^\[equip\]\s*[-—–]?\s*(.*)$/i.exec(stripped);
    if (!match) continue;
    out.push(parseCostAlternatives(match[1]!));
  }
  return out;
}

/** 820.1.c: each Repeat instance's cost ("[Repeat] [2]", "[Repeat][4][Mind]", "[Repeat 2]"). */
export function parseRepeatCosts(text: string | undefined): Cost[] {
  const out: Cost[] = [];
  for (const line of rulesTextLines(text)) {
    const stripped = stripReminderText(line).trim();
    const match = /^\[repeat(?:\s+(\d+))?\]\s*(.*)$/i.exec(stripped);
    if (!match) continue;
    // 820.1.c: "[Repeat] - Discard 1" writes the cost after a dash (catalog text of Square Up).
    const costText = (match[2] ?? "").replace(/^[\s\-–—]+/, "");
    const cost = parseCostText(costText);
    if (match[1]) cost.energy = (typeof cost.energy === "number" ? cost.energy : 0) + Number(match[1]);
    out.push(cost);
  }
  return out;
}

/** 829.1.c: each Flow instance's cost ("[Flow][4][Fury]", "[Flow][2]"), anywhere on a line. */
export function parseFlowCosts(text: string | undefined): Cost[] {
  const out: Cost[] = [];
  for (const line of rulesTextLines(text)) {
    const stripped = stripReminderText(line).trim();
    const match = /\[flow\]((?:\s*\[[^\]]+\])+)/i.exec(stripped);
    if (!match) continue;
    out.push(parseCostText(match[1]!));
  }
  return out;
}

export interface TextAdditionalCost {
  optional: boolean;
  cost: Cost;
  text: string;
}

const ADDITIONAL_PATTERNS: Array<{ re: RegExp; optional: boolean }> = [
  { re: /you may pay (.+?) as an additional cost to play (?:me|this)/i, optional: true },
  { re: /as an additional cost to play (?:this|me), you may (.+?)\.(?:\s|$)/i, optional: true },
  { re: /as you play (?:me|this), you may (.+?) as an additional cost/i, optional: true },
  { re: /you may (.+?) as an additional cost to play (?:me|this)/i, optional: true },
  { re: /as an additional cost to play (?:this|me), (?!you may)(.+?)\.(?:\s|$)/i, optional: false },
];

/**
 * 204.2 / 356.2: "as an additional cost" phrases in the rules text (reminder text ignored, so
 * Accelerate's reminder is not double counted). Order is the printed order.
 */
export function parseAdditionalCosts(text: string | undefined): TextAdditionalCost[] {
  const out: TextAdditionalCost[] = [];
  for (const line of rulesTextLines(text)) {
    const stripped = stripReminderText(line);
    for (const { re, optional } of ADDITIONAL_PATTERNS) {
      const match = re.exec(stripped);
      if (!match) continue;
      out.push({ optional, cost: parseCostText(match[1]!), text: match[1]!.trim() });
      break;
    }
  }
  return out;
}
