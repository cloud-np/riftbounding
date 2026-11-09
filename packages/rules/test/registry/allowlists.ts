/**
 * Explicit exceptions for the registry integrity suite (`integrity.test.ts`). Every entry says
 * why it exists; a stale entry fails the suite, so the lists only shrink.
 */

/**
 * (c) Script `text` that matches no catalog printing after normalisation. The script text is the
 * errata'd / corrected printed text; the catalog row is scraped and can be wrong.
 */
export const TEXT_DRIFT: Readonly<Record<string, string>> = {
  "Angler Beast": "Catalog text lost the [Might] symbol (\"with 2  or less\").",
  "Crimson Pigeons": "Catalog text lost the [Might] symbol (\"+2  while\").",
  "Spectral Centaur": "Catalog text lost the [Might] symbol (\"+2  this turn\").",
  "Disposal Order": "Catalog typo \"up zo 3 cards\"; the script uses the printed \"up to\".",
  "Gangplank, Naval": "Vendetta errata writes the Empower cost as [Body][Body]; the script keeps the generic [C][C] glyphs of the printed card.",
  Gold: "Token rules text in the 135.2.e.7 activation form (\"[Reaction][>] Kill this, [Tap]: …\"); the catalog row puts [Reaction] after the cost.",
  "Udyr, Wildman": "The catalog row omits the printed [Ganking] line and \"this turn\".",
  "Volibear, Relentless Storm": "Catalog row is truncated mid-reminder; the script keeps the full printed reminder text.",
};

/**
 * (e) Registered custom ids that no script JSON references: they are pushed by other custom
 * code or by the engine (frames built at resolution time), so the reference is in source code.
 * The suite checks that each one is mentioned as a string literal outside its registration.
 */
export const CUSTOM_IDS_REFERENCED_FROM_CODE: ReadonlySet<string> = new Set([
  "keyword:weaponmaster", // triggers/keywords.ts (821.1.c Weaponmaster keyword trigger)
]);

/**
 * (g) Card names a selector may use that are not printed cards (token names the catalog lists
 * as tokens are accepted automatically).
 */
export const EXTRA_SELECTOR_NAMES: ReadonlySet<string> = new Set<string>();
