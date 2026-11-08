/**
 * @rift/cards — token catalog (port of module 143307).
 *
 * Maps token names (as printed in rules text / log entries) to token art,
 * inferred card type and inferred might. `s()` below is the original's name
 * normalizer: trim, lowercase, drop every non-alphanumeric character.
 */

const TOKEN_ART_BY_NAME: Readonly<Record<string, string>> = {
  bomb: "/cards/RAD-T02.webp",
  bombtoken: "/cards/RAD-T02.webp",
  birb: "/tokens/Bird.webp",
  birbtoken: "/tokens/Bird.webp",
  bird: "/tokens/Bird.webp",
  birdtoken: "/tokens/Bird.webp",
  brush: "/tokens/Brush.webp",
  brushtoken: "/tokens/Brush.webp",
  recruit: "/tokens/Recruit.webp",
  recruitv2: "/tokens/Recruit.webp",
  recruitv3: "/tokens/Recruit.webp",
  gold: "/tokens/Gold.webp",
  goldgear: "/tokens/Gold.webp",
  goldgeartoken: "/tokens/Gold.webp",
  mech: "/tokens/Mech.webp",
  mechtoken: "/tokens/Mech.webp",
  reflection: "/tokens/Reflection.webp",
  reflectiontoken: "/tokens/Reflection.webp",
  sandsoldier: "/tokens/SandSoldier.webp",
  sandsoldiertoken: "/tokens/SandSoldier.webp",
  shadowclone: "/tokens/ShadowClone.webp",
  shadowclonetoken: "/tokens/ShadowClone.webp",
  sprite: "/tokens/Sprite.webp",
  spritetoken: "/tokens/Sprite.webp",
  tentacle: "/tokens/Tentacle.webp",
  tentacletoken: "/tokens/Tentacle.webp",
};

const TOKEN_MIGHT: ReadonlyArray<readonly [string, number]> = [
  ["sandsoldier", 2],
  ["shadowclone", 0],
  ["reflection", 0],
  ["recruit", 1],
  ["sprite", 3],
  ["tentacle", 1],
  ["bird", 1],
  ["birb", 1],
  ["mech", 3],
];

function normalizeTokenName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** `m` — the name denotes a Gold token (any spelling containing "gold"). */
export function isGoldToken(name: string): boolean {
  return normalizeTokenName(name).includes("gold");
}

/** `Z` — every token art path in the map (deduplicated). */
export function allTokenArtPaths(): string[] {
  return Array.from(new Set(Object.values(TOKEN_ART_BY_NAME)));
}

/**
 * `h` — false for bomb/sprite/reflection tokens (not spawnable via the token
 * picker). Everything else (including empty) is `true`.
 */
export function isSpawnableToken(name: string): boolean {
  const t = normalizeTokenName(name);
  if (!t) return true;
  return !(t === "bomb" || t === "bombtoken" || t.includes("sprite") || t.includes("reflection"));
}

/** `r` — inferred type for a token name: Gear for bomb/gold, else Unit. */
export function tokenTypeOf(name: string): "Gear" | "Unit" | undefined {
  const t = normalizeTokenName(name);
  if (!t) return undefined;
  return t === "bomb" || t === "bombtoken" || t.includes("gold") ? "Gear" : "Unit";
}

/** `W` — token art path for a token name, or undefined when unknown. */
export function tokenArtOf(name: string): string | undefined {
  const t = normalizeTokenName(name);
  if (!t) return undefined;
  const direct = TOKEN_ART_BY_NAME[t];
  if (direct) return direct;
  if (t.includes("sandsoldier")) return "/tokens/SandSoldier.webp";
  if (t.includes("recruit")) return "/tokens/Recruit.webp";
  if (t.includes("sprite")) return "/tokens/Sprite.webp";
  if (t.includes("reflection")) return "/tokens/Reflection.webp";
  if (t.includes("shadowclone")) return "/tokens/ShadowClone.webp";
  if (t.includes("tentacle")) return "/tokens/Tentacle.webp";
  if (t.includes("brush")) return "/tokens/Brush.webp";
  if (t.includes("bird") || t.includes("birb")) return "/tokens/Bird.webp";
  if (t.includes("gold")) return "/tokens/Gold.webp";
  if (t.includes("mech")) return "/tokens/Mech.webp";
  return undefined;
}

/** `E` — inferred might for a token name (gold excluded), or undefined. */
export function tokenMightOf(name: string): number | undefined {
  const t = normalizeTokenName(name);
  if (!t || t.includes("gold")) return undefined;
  return TOKEN_MIGHT.find(([stem]) => t.includes(stem))?.[1];
}

/** `/tokens/<Name>.webp` (full board art). */
export const tokenImage = (name: string): string => `/tokens/${name}.webp`;

/** `/tokens/thumbs/<Name>.webp` (panel/rail thumbnail). */
export const tokenThumb = (name: string): string => `/tokens/thumbs/${name}.webp`;

/**
 * Module 582436 `o` — catalog id for each physical token art name. Used to swap
 * a token image back to the card art when a token is displayed as a card.
 */
export const TOKEN_ART: Readonly<Record<string, string>> = {
  Bird: "UNL-T02",
  Brush: "UNL-T03",
  Gold: "SFD-T03",
  Mech: "SFD-T01",
  Recruit: "OGN-273",
  Reflection: "UNL-T06",
  SandSoldier: "SFD-T02",
  ShadowClone: "VEN-T05",
  Sprite: "OGN-274",
  Tentacle: "VEN-T06",
};

/** Module 582436 `c` — catalog ids the token-art resolver treats as token deck cards. */
export const TOKEN_CARD_IDS: ReadonlySet<string> = new Set([
  ...Object.values(TOKEN_ART),
  "OGN-271",
  "OGN-272",
  "UNL-T01",
]);
