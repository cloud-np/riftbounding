"use client";

/**
 * Board customization runtime — the small client-side subset of original module
 * 533812 (`2-nry424r0961.js`) that our protocol models (`identity.boardCustomization`).
 *
 * The document may already be the resolved runtime object (playmat/deckSleeve/…)
 * or the raw slot document. `dimBoardCustomization` is a verbatim port of the
 * opponent-cosmetics resolver: playmat intensity/saturation + `sleeveFilter`.
 */

export interface RuntimeSleeve {
  src: string;
}

export interface RuntimePlaymat {
  src: string;
  intensity: number;
  contrast: number;
  saturation?: number;
  animatedAccent?: { primary?: string; secondary?: string };
  animationsEnabled?: boolean;
}

export interface RuntimeCustomization {
  playmat?: RuntimePlaymat;
  deckSleeve?: RuntimeSleeve;
  runeDeckSleeve?: RuntimeSleeve;
  battlefieldSleeve?: RuntimeSleeve;
  boardLines?: string;
  pointsRail?: string;
  tokenArt?: Record<string, string>;
  hideBoardChrome?: boolean;
  playZoneFrost?: number;
  sleeveFilter?: string;
  emoteWheel?: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

function sleeveFrom(value: unknown): RuntimeSleeve | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const variant = asRecord(record.variant);
  const src =
    (typeof record.src === "string" && record.src) ||
    (typeof record.boardImageSrc === "string" && record.boardImageSrc) ||
    (typeof record.imageSrc === "string" && record.imageSrc) ||
    (typeof variant?.boardImageSrc === "string" && variant.boardImageSrc);
  return typeof src === "string" && src ? { src } : undefined;
}

function playmatFrom(value: unknown): RuntimePlaymat | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const variant = asRecord(record.variant);
  const src =
    (typeof record.src === "string" && record.src) ||
    (typeof record.boardImageSrc === "string" && record.boardImageSrc) ||
    (typeof variant?.boardImageSrc === "string" && (variant.boardImageSrc as string)) ||
    (typeof record.imageSrc === "string" && record.imageSrc);
  if (!src) return undefined;
  const accent = asRecord(record.animatedAccent) ?? asRecord(variant?.animatedAccent);
  return {
    src,
    intensity: clamp(record.intensity ?? record.playmatIntensity, 0.1, 1, 0.8),
    contrast: clamp(record.contrast ?? record.playmatContrast, 0, 1, 0.7),
    ...(typeof record.saturation === "number" ? { saturation: record.saturation } : {}),
    ...(accent
      ? {
          animatedAccent: {
            ...(typeof accent.primary === "string" ? { primary: accent.primary } : {}),
            ...(typeof accent.secondary === "string" ? { secondary: accent.secondary } : {}),
          },
        }
      : {}),
    animationsEnabled: record.animationsEnabled !== false,
  };
}

function tokenArtFrom(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "string") {
      result[key.trim().toLowerCase()] = entry;
      continue;
    }
    const nested = asRecord(entry);
    const src =
      (typeof nested?.src === "string" && nested.src) ||
      (typeof nested?.imageSrc === "string" && nested.imageSrc) ||
      (typeof nested?.thumbImageSrc === "string" && nested.thumbImageSrc) ||
      (typeof nested?.boardImageSrc === "string" && nested.boardImageSrc);
    if (src) result[key.trim().toLowerCase()] = src;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Original `rH.T` — resolve the customization document into board runtime values. */
export function resolveBoardCustomization(value: unknown): RuntimeCustomization {
  const record = asRecord(value);
  if (!record) return {};
  const playmat = playmatFrom(record.playmat);
  const tokenArt = tokenArtFrom(record.tokenArt);
  const boardLines =
    typeof record.boardLines === "string" && record.boardLines !== "default"
      ? record.boardLines
      : undefined;
  const pointsRail =
    typeof record.pointsRail === "string" && record.pointsRail !== "default"
      ? record.pointsRail
      : undefined;
  return {
    ...(playmat ? { playmat } : {}),
    ...(sleeveFrom(record.deckSleeve) ? { deckSleeve: sleeveFrom(record.deckSleeve) } : {}),
    ...(sleeveFrom(record.runeDeckSleeve)
      ? { runeDeckSleeve: sleeveFrom(record.runeDeckSleeve) }
      : {}),
    ...(sleeveFrom(record.battlefieldSleeve)
      ? { battlefieldSleeve: sleeveFrom(record.battlefieldSleeve) }
      : {}),
    ...(boardLines ? { boardLines } : {}),
    ...(pointsRail ? { pointsRail } : {}),
    ...(tokenArt ? { tokenArt } : {}),
    ...(record.hideBoardChrome === true && playmat ? { hideBoardChrome: true } : {}),
    ...(typeof record.playZoneFrost === "number"
      ? { playZoneFrost: clamp(record.playZoneFrost, 0, 1, 0) }
      : {}),
    ...(Array.isArray(record.emoteWheel) && record.emoteWheel.length === 6
      ? { emoteWheel: record.emoteWheel.filter((id): id is string => typeof id === "string") }
      : {}),
  };
}

/** Original `rH.d` — opponent cosmetics dim (25..100%). */
export function dimBoardCustomization(
  customization: RuntimeCustomization,
  percent: number,
): RuntimeCustomization {
  const t = Math.min(1, Math.max(0, percent / 100));
  if (t === 1) return customization;
  const playmat = customization.playmat;
  return {
    ...customization,
    ...(playmat
      ? {
          playmat: {
            ...playmat,
            intensity: Math.min(playmat.intensity, t),
            saturation: Math.round(100 * (0.5 + 0.5 * t)) / 100,
          },
        }
      : {}),
    sleeveFilter: `saturate(${(0.5 + 0.5 * t).toFixed(3)})`,
  };
}

export function sleeveForSlot(
  customization: RuntimeCustomization | undefined,
  slot: "deck" | "runeDeck" | "battlefield" | "landscape",
): RuntimeSleeve | undefined {
  if (!customization) return undefined;
  if (slot === "runeDeck") return customization.runeDeckSleeve;
  if (slot === "battlefield" || slot === "landscape") return customization.battlefieldSleeve;
  return customization.deckSleeve;
}

export function tokenArtForName(
  customization: RuntimeCustomization | undefined,
  name: string,
): string | undefined {
  if (!customization?.tokenArt) return undefined;
  const key = name.trim().toLowerCase();
  return customization.tokenArt[key];
}

