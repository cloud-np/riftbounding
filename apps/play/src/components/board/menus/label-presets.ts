/**
 * Card-label presets — verbatim table from module 784635
 * (`25vik2nxxo51i.js:646-745`, spec `02-hotkeys-and-menus.md` §1.1).
 */

export interface LabelPreset {
  hotkey: string;
  id: string;
  label: string;
  accentColor: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

export const LABEL_PRESETS: readonly LabelPreset[] = [
  { hotkey: "1", id: "buff", label: "Buff", accentColor: "#ffdf91", backgroundColor: "#a26320", borderColor: "#ffe2a0", textColor: "#fff8e8" },
  { hotkey: "2", id: "disarm", label: "Disarm", accentColor: "#f7ba91", backgroundColor: "rgba(83,47,31,0.96)", borderColor: "rgba(239,167,114,0.7)", textColor: "#fff0de" },
  { hotkey: "3", id: "deflect", label: "Deflect", accentColor: "#9fd4ff", backgroundColor: "rgba(38,59,82,0.94)", borderColor: "rgba(128,170,208,0.54)", textColor: "#e7f3ff" },
  { hotkey: "4", id: "deathknell", label: "Deathknell", accentColor: "#9fd7d3", backgroundColor: "rgba(39,62,62,0.94)", borderColor: "rgba(132,183,178,0.5)", textColor: "#e8f7f5" },
  { hotkey: "5", id: "shield", label: "Shield", accentColor: "#d4c1ff", backgroundColor: "rgba(58,53,82,0.94)", borderColor: "rgba(168,152,214,0.5)", textColor: "#f0ebff" },
  { hotkey: "6", id: "stunned", label: "Stunned", accentColor: "#ffe56f", backgroundColor: "rgba(98,86,18,0.95)", borderColor: "rgba(239,218,92,0.58)", textColor: "#fff9d4" },
  { hotkey: "7", id: "tank", label: "Tank", accentColor: "#b4c7df", backgroundColor: "rgba(48,58,74,0.95)", borderColor: "rgba(164,182,207,0.54)", textColor: "#edf5ff" },
  { hotkey: "8", id: "empowered", label: "Empowered", accentColor: "#f6c96f", backgroundColor: "rgba(82,62,34,0.95)", borderColor: "rgba(218,171,96,0.54)", textColor: "#fff2d8" },
  { hotkey: "9", id: "ganking", label: "Ganking", accentColor: "#9fe0a6", backgroundColor: "rgba(42,67,48,0.94)", borderColor: "rgba(128,181,134,0.5)", textColor: "#e7f8e9" },
  { hotkey: "0", id: "assault", label: "Assault", accentColor: "#ff8fa3", backgroundColor: "rgba(86,38,49,0.94)", borderColor: "rgba(213,120,138,0.52)", textColor: "#ffe8ee" },
  { hotkey: "-", id: "temporary", label: "Temporary", accentColor: "#ff9b7a", backgroundColor: "rgba(95,46,39,0.95)", borderColor: "rgba(229,129,108,0.54)", textColor: "#ffe9e1" },
] as const;

/** `ts.s` — the custom-tag hotkey. */
export const CUSTOM_LABEL_HOTKEY = "=";

/** `d(e)` — hotkey → KeyboardEvent.code. */
export function labelHotkeyCode(hotkey: string): string {
  if (hotkey === "-") return "Minus";
  if (hotkey === "=") return "Equal";
  return `Digit${hotkey}`;
}

/** `f(label)` — preset colours, with the original fallback palette. */
export function labelColors(label: string): Pick<LabelPreset, "accentColor" | "backgroundColor" | "borderColor" | "textColor"> {
  const normalized = label.trim().toLowerCase();
  const preset = LABEL_PRESETS.find(
    (candidate) => candidate.label.toLowerCase() === normalized || candidate.id === normalized,
  );
  if (preset) {
    return {
      accentColor: preset.accentColor,
      backgroundColor: preset.backgroundColor,
      borderColor: preset.borderColor,
      textColor: preset.textColor,
    };
  }
  return {
    accentColor: "#7fd8ff",
    backgroundColor: "rgba(28,58,78,0.95)",
    borderColor: "rgba(116,197,227,0.56)",
    textColor: "#e5f8ff",
  };
}

/** `e2.I` — adjust a trailing count on a counted label (`Shield 2` → `Shield 3`). */
export function adjustLabelCount(label: string, delta: number): string {
  const trimmed = label.trim();
  if (!trimmed || !Number.isFinite(delta) || delta === 0) return trimmed;
  const match = /^(.*?)(?:\s+(\d+))?$/.exec(trimmed);
  if (!match) return trimmed;
  const stem = (match[1] ?? "").trim();
  const current = match[2] ? Number.parseInt(match[2], 10) : 0;
  const next = Math.max(0, current + Math.trunc(delta));
  return next > 0 ? `${stem} ${next}` : stem;
}

/** Trim + collapse whitespace; labels are capped at 24 chars (module 437381). */
export function normalizeCardLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 24);
}

/** Build a preset-shaped descriptor for a custom tag. */
export function customLabelPreset(label: string, hotkey = CUSTOM_LABEL_HOTKEY): LabelPreset {
  const colors = labelColors(label);
  return {
    hotkey,
    id: normalizeCardLabel(label).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "custom",
    label: normalizeCardLabel(label),
    ...colors,
  };
}
