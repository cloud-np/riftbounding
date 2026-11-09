/**
 * Catalog keyword audit (maintainability review F3 / G6).
 *
 * The catalog's `keywords` list is scraped from every bracketed token of a card's text, so it
 * also contains keywords that only appear in reminder text ("[Ambush] (You may play me as a
 * [Reaction] …)"), in quoted text granted to another object ("(It has "[Reaction] Kill this …")"),
 * or inside an ability ("Your Equipment have [Quick-Draw]. (Each gains [Reaction] …)"). The strict
 * rules engine reads a permanent's printed keywords from this list, so every such entry is either
 * a real printed keyword or must be suppressed by the card's script
 * (`{ kind: "suppress-printed-keyword" }`).
 *
 * `keywordsInText` derives the keywords a card's own text names outside reminder and quoted text;
 * `CATALOG_KEYWORD_OVERRIDES` lists, for every catalog keyword that is not in that set, whether it
 * is still the card's own keyword (`intrinsic`) or noise (`not-intrinsic`, which the rules
 * integrity test requires the card script to suppress). `catalog-keywords.test.ts` fails on any
 * new mismatch, so a new set's import cannot add keywords silently.
 */

/** Text without errata banners, flavor text, reminder text (parentheses) and quoted grants. */
export function rulesTextOutsideReminders(text: string | undefined): string {
  return (text ?? "")
    .split("\n")
    .filter((line) => !/errata text/i.test(line.normalize("NFKD")) && !/^𝗖𝗮𝗿𝗱/u.test(line))
    .join("\n")
    .replace(/\n\s*Flavor Text[\s\S]*$/i, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/["“][^"”]*["”]/g, "");
}

/**
 * Lower-cased keyword names the card's own text names: bracketed tokens (`[Assault 2]` →
 * `assault`) outside reminder/quoted text, plus a keyword printed unbracketed at the start of a
 * line (`Hidden (…)`, `Equip [Body]` — catalog formatting).
 */
export function keywordsInText(text: string | undefined): Set<string> {
  const body = rulesTextOutsideReminders(text);
  const out = new Set<string>();
  for (const match of body.matchAll(/\[([A-Za-z][A-Za-z' -]*?)(?:\s*\d+)?\]/g)) out.add(match[1]!.trim().toLowerCase());
  for (const line of body.split("\n")) {
    const lead = /^\s*(Hidden|Equip|Tank|Shield|Deflect|Accelerate)\b/i.exec(line);
    if (lead) out.add(lead[1]!.toLowerCase());
  }
  return out;
}

export type CatalogKeywordVerdict = "intrinsic" | "not-intrinsic";

export interface CatalogKeywordOverride {
  verdict: CatalogKeywordVerdict;
  reason: string;
}

const QUICK_DRAW: CatalogKeywordOverride = {
  verdict: "intrinsic",
  reason: "819.1.b: [Quick-Draw] means the card has [Reaction] (stated in its reminder text).",
};
const AMBUSH: CatalogKeywordOverride = {
  verdict: "not-intrinsic",
  reason: "822.1.b: only in [Ambush]'s reminder text; the unit has [Reaction] only for an Ambush play.",
};
const GOLD: CatalogKeywordOverride = {
  verdict: "not-intrinsic",
  reason: "Only in the quoted/reminder text of the Gold gear token the card creates.",
};
const SHADOW_CLONE: CatalogKeywordOverride = {
  verdict: "not-intrinsic",
  reason: "Only in the quoted text of the Shadow Clone token the card creates.",
};

/**
 * Every catalog keyword that `keywordsInText` does not find, by card name then keyword. The
 * catalog test fails on a mismatch missing here and on a stale entry.
 */
export const CATALOG_KEYWORD_OVERRIDES: Readonly<Record<string, Readonly<Record<string, CatalogKeywordOverride>>>> = {
  "Long Sword": { Reaction: QUICK_DRAW },
  "Sterak's Gage": { Reaction: QUICK_DRAW },
  "Cloth Armor": { Reaction: QUICK_DRAW },
  "Spinning Axe": { Reaction: QUICK_DRAW },
  "Protector's Shield": { Reaction: QUICK_DRAW },
  "Jax, Unmatched": {
    Reaction: {
      verdict: "not-intrinsic",
      reason: "Granted to your Equipment through [Quick-Draw] (reminder text); Jax has neither keyword himself.",
    },
  },
  Inferna: { Reaction: AMBUSH },
  "Lord Broadmane": { Reaction: AMBUSH },
  "Grim Apothecary": { Reaction: AMBUSH },
  Vilemaw: { Reaction: AMBUSH },
  "Chakram Dancer": { Reaction: AMBUSH },
  "Nidalee, Cat Form": { Reaction: AMBUSH },
  "Rengar, Trophy Hunter": { Reaction: AMBUSH },
  "Kha'Zix, Mutating Horror": { Reaction: AMBUSH },
  "Stalking Wolf": { Reaction: AMBUSH },
  "Vi, Peacekeeper": { Reaction: AMBUSH },
  "Poppy, Defender of the Meek": { Reaction: AMBUSH },
  "Evelynn, Consuming": { Reaction: AMBUSH },
  "Morgana, Vindictive": { Reaction: AMBUSH },
  Soulspinner: { Reaction: AMBUSH },
  "Yeti Brawler": { Reaction: GOLD, Add: GOLD },
  "Deadly Flourish": { Reaction: GOLD, Add: GOLD },
  "Pyke, Returned": { Reaction: GOLD, Add: GOLD },
  "Pyke, Bloodharbor Ripper": { Reaction: GOLD, Add: GOLD },
  "Whirling Twirligig": { Reaction: GOLD, Add: GOLD },
  "Resource Extractor": { Reaction: GOLD, Add: GOLD },
  "The Waters' Wage": { Reaction: GOLD, Add: GOLD },
  "An Offer You Can't Refuse": { Reaction: GOLD, Add: GOLD },
  "Reckless Innovator": { Reaction: GOLD, Add: GOLD },
  "Bandle Scouts' Academy": { Reaction: GOLD, Add: GOLD },
  "K'Sante, Pride of Nazumah": {
    Assault: { verdict: "not-intrinsic", reason: "Only in reminder text of the granted keywords." },
    Shield: { verdict: "not-intrinsic", reason: "Only in reminder text of the granted keywords." },
  },
  "Zed, From the Shadows": { Assault: SHADOW_CLONE },
  "Zed, Without a Sound": { Assault: SHADOW_CLONE },
  "Death Mark": { Assault: SHADOW_CLONE },
};

/** Catalog keywords of a card that its text does not name (see `CATALOG_KEYWORD_OVERRIDES`). */
export function unexplainedCatalogKeywords(card: { keywords?: readonly string[]; text?: string }): string[] {
  const named = keywordsInText(card.text);
  return (card.keywords ?? []).filter((keyword) => !named.has(keyword.toLowerCase()));
}
