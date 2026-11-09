/**
 * Card-name resolution for scenarios: exact catalog lookup with a did-you-mean error.
 */
import { bestPrintCards, getCardByName, normalizeCardName, type Card } from "@rift/cards";

/** Plain Levenshtein distance (names are short; O(n·m) is fine). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * Up to `limit` candidates closest to `query` (normalized edit distance, plus a bonus for
 * substring / same-first-word matches). Only reasonably close names are returned.
 */
export function suggestNames(query: string, candidates: Iterable<string>, limit = 3): string[] {
  const q = normalizeCardName(query);
  if (!q) return [];
  const firstWord = q.split(" ")[0] ?? "";
  const scored: Array<{ name: string; score: number }> = [];
  const seen = new Set<string>();
  for (const name of candidates) {
    if (seen.has(name)) continue;
    seen.add(name);
    const n = normalizeCardName(name);
    if (!n) continue;
    let score = editDistance(q, n) / Math.max(q.length, n.length);
    if (n.includes(q) || q.includes(n)) score -= 0.35;
    if (firstWord.length >= 3 && n.split(" ")[0] === firstWord) score -= 0.15;
    if (score <= 0.45) scored.push({ name, score });
  }
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map((entry) => entry.name);
}

export function didYouMean(query: string, candidates: Iterable<string>): string {
  const suggestions = suggestNames(query, candidates);
  return suggestions.length > 0
    ? ` Did you mean ${suggestions.map((name) => JSON.stringify(name)).join(" or ")}?`
    : "";
}

let allNames: string[] | null = null;
function catalogNames(): string[] {
  allNames ??= [...new Set(bestPrintCards().map((card) => card.name))];
  return allNames;
}

export class ScenarioCardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioCardError";
  }
}

/**
 * Resolve a printed card name (case/punctuation-insensitive) to its catalog card. Throws a
 * `ScenarioCardError` with a did-you-mean hint, naming where the name was used.
 */
export function resolveCatalogCard(name: string, where: string): Card {
  const card = getCardByName(name);
  if (card) return card;
  throw new ScenarioCardError(
    `Unknown card ${JSON.stringify(name)} (${where}).${didYouMean(name, catalogNames())}`,
  );
}

/** Domain of a rune card name ("Fury Rune" → "Fury"). */
export function runeName(domain: string): string {
  return `${domain} Rune`;
}
