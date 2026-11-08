/**
 * Token quick-panel presets — exact list from the board chunk
 * (`0xawjzm3yjpr1.js:21898-21930`). Base puts Gold first; battlefields append
 * Bomb and drop Gold; every other zone keeps the default order.
 */
import { staticAsset } from "@/lib/assets";

export interface TokenPreset {
  name: string;
  imageUrl: string;
  panelImageUrl: string;
}

function preset(name: string, file: string): TokenPreset {
  return {
    name,
    imageUrl: staticAsset(`tokens/${file}.webp`),
    panelImageUrl: staticAsset(`tokens/thumbs/${file}.webp`),
  };
}

export const DEFAULT_TOKEN_PRESETS: readonly TokenPreset[] = [
  preset("Recruit", "Recruit"),
  preset("Gold", "Gold"),
  preset("Mech", "Mech"),
  preset("Sand Soldier", "SandSoldier"),
  preset("Sprite", "Sprite"),
  preset("Bird", "Bird"),
  preset("Reflection", "Reflection"),
  preset("Shadow Clone", "ShadowClone"),
  preset("Tentacle", "Tentacle"),
];

function bomb(): TokenPreset {
  const url = staticAsset("cards/RAD-T02.webp");
  return { name: "Bomb", imageUrl: url, panelImageUrl: url };
}

/** `d3` — base: Gold first. */
export const BASE_TOKEN_PRESETS: readonly TokenPreset[] = [
  ...DEFAULT_TOKEN_PRESETS.filter((item) => item.name === "Gold"),
  ...DEFAULT_TOKEN_PRESETS.filter((item) => item.name !== "Gold"),
];

/** `d8` — battlefield: no Gold, plus Bomb. */
export const BATTLEFIELD_TOKEN_PRESETS: readonly TokenPreset[] = [
  ...DEFAULT_TOKEN_PRESETS.filter((item) => item.name !== "Gold"),
  bomb(),
];

export type TokenZone = "base" | "battlefieldA" | "battlefieldB" | "battlefieldC" | "battlefieldToken" | "hand" | "trash" | string;

export function tokenPresetsForZone(zone: TokenZone): readonly TokenPreset[] {
  if (zone === "base") return BASE_TOKEN_PRESETS;
  if (
    zone === "battlefieldA" ||
    zone === "battlefieldB" ||
    zone === "battlefieldC" ||
    zone === "battlefieldToken"
  ) {
    return BATTLEFIELD_TOKEN_PRESETS;
  }
  return DEFAULT_TOKEN_PRESETS;
}

export function filterTokenPresets(presets: readonly TokenPreset[], query: string): readonly TokenPreset[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return presets;
  return presets.filter((preset) => preset.name.toLowerCase().includes(normalized));
}
