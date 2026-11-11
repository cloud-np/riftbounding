/**
 * Shared visual tokens for the board revamp (cards, VFX, board theme).
 *
 * Every layer (procedural card faces, art-crop tokens, particles, battlefield auras) reads its
 * colours from here so a Fury card, a Fury spell projectile and a Fury rune glow agree.
 */

export type DomainName = "Fury" | "Calm" | "Mind" | "Body" | "Chaos" | "Order" | "Unknown";

export interface DomainPalette {
  /** Main saturated hue (frames, rims, projectiles). */
  base: string;
  /** Lighter highlight (glints, particle cores). */
  light: string;
  /** Deep shade (frame shadows, art-area gradient bottom). */
  dark: string;
  /** rgba glow used for box-shadows / additive particles. */
  glow: string;
  /** Raw RGB triple for canvas work (`rgba(${rgb}, a)`). */
  rgb: string;
}

export const DOMAIN_PALETTES: Readonly<Record<DomainName, DomainPalette>> = Object.freeze({
  Fury: { base: "#e2463c", light: "#ff9a7a", dark: "#4a0f12", glow: "rgba(255,84,60,0.65)", rgb: "255,84,60" },
  Calm: { base: "#3fae6a", light: "#9df0b8", dark: "#0d3a24", glow: "rgba(80,220,140,0.6)", rgb: "80,220,140" },
  Mind: { base: "#3b82e6", light: "#9cc8ff", dark: "#0c2147", glow: "rgba(90,160,255,0.65)", rgb: "90,160,255" },
  Body: { base: "#e98b2a", light: "#ffc77e", dark: "#4a2306", glow: "rgba(255,160,60,0.62)", rgb: "255,160,60" },
  Chaos: { base: "#9a4fe0", light: "#d4a6ff", dark: "#2a0f47", glow: "rgba(176,100,255,0.65)", rgb: "176,100,255" },
  Order: { base: "#e6c34a", light: "#fff0a8", dark: "#463607", glow: "rgba(255,214,90,0.62)", rgb: "255,214,90" },
  Unknown: { base: "#7d8aa6", light: "#cdd7ea", dark: "#1a2233", glow: "rgba(170,190,230,0.5)", rgb: "170,190,230" },
});

/** Seat/side accents: the viewer is cool blue, opponents warm crimson, contested is gold. */
export const SIDE_COLORS = Object.freeze({
  self: { base: "#4fb3ff", glow: "rgba(79,179,255,0.6)", rgb: "79,179,255" },
  opponent: { base: "#ff5a6a", glow: "rgba(255,90,106,0.6)", rgb: "255,90,106" },
  contested: { base: "#ffcf5a", glow: "rgba(255,207,90,0.65)", rgb: "255,207,90" },
  neutral: { base: "#9fb4d6", glow: "rgba(159,180,214,0.4)", rgb: "159,180,214" },
});

const KNOWN = new Set<string>(["Fury", "Calm", "Mind", "Body", "Chaos", "Order"]);

/** Normalise a raw domain string (any case) to a palette key. */
export function domainName(raw: string | null | undefined): DomainName {
  if (!raw) return "Unknown";
  const title = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return KNOWN.has(title) ? (title as DomainName) : "Unknown";
}

/** First known domain of a card (cards may have 0-2 domains). */
export function primaryDomain(domains: readonly string[] | null | undefined): DomainName {
  for (const domain of domains ?? []) {
    const name = domainName(domain);
    if (name !== "Unknown") return name;
  }
  return "Unknown";
}

export function domainPalette(domains: readonly string[] | null | undefined): DomainPalette {
  return DOMAIN_PALETTES[primaryDomain(domains)];
}

/** Two palettes for dual-domain cards (second falls back to the first). */
export function domainPalettes(
  domains: readonly string[] | null | undefined,
): [DomainPalette, DomainPalette] {
  const names = (domains ?? []).map(domainName).filter((name) => name !== "Unknown");
  const first = DOMAIN_PALETTES[names[0] ?? "Unknown"];
  const second = DOMAIN_PALETTES[names[1] ?? names[0] ?? "Unknown"];
  return [first, second];
}

/** Shared easing curves so motion feels consistent across layers. */
export const EASE = Object.freeze({
  /** Snappy overshoot for slams/landings. */
  slam: "cubic-bezier(0.2, 1.4, 0.35, 1)",
  /** Smooth out for flights. */
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Anticipation-in for wind-ups. */
  in: "cubic-bezier(0.55, 0, 0.75, 0.2)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
});
