/**
 * Emote catalogue — verbatim from the original module 593673
 * (`3-2i4k6s343ud.js:3215-3300`) plus the Poro pack (`e6.P`).
 */
export interface Emote {
  id: string;
  label: string;
  glyph: string;
  accentColor: string;
  labelKey: string;
  releasedAt?: string;
  pack?: "poro";
}

export const EMOTES: readonly Emote[] = [
  {
    id: "thumbs_up",
    label: "Thumbs Up",
    glyph: "👍",
    accentColor: "#f3cf7a",
    labelKey: "emoteThumbsUp",
  },
  { id: "heart", label: "Heart", glyph: "❤️", accentColor: "#ff8aa0", labelKey: "emoteHeart" },
  { id: "laugh", label: "Laugh", glyph: "😂", accentColor: "#ffd36d", labelKey: "emoteLaugh" },
  { id: "wow", label: "No", glyph: "❌", accentColor: "#ff9a9a", labelKey: "emoteNo" },
  { id: "cry", label: "Wait", glyph: "⏳", accentColor: "#d6c08c", labelKey: "emoteWait" },
  { id: "angry", label: "Angry", glyph: "😠", accentColor: "#ff9a7a", labelKey: "emoteAngry" },
  { id: "wave", label: "Hello", glyph: "👋", accentColor: "#f3cf7a", labelKey: "emoteWave" },
  { id: "clap", label: "Well played", glyph: "👏", accentColor: "#ffd36d", labelKey: "emoteClap" },
  {
    id: "thinking",
    label: "Thinking",
    glyph: "🤔",
    accentColor: "#d6c08c",
    labelKey: "emoteThinking",
  },
  {
    id: "surprised",
    label: "Surprised",
    glyph: "😮",
    accentColor: "#ffe09a",
    labelKey: "emoteSurprised",
  },
  { id: "sad", label: "Sad", glyph: "😢", accentColor: "#8acbff", labelKey: "emoteSad" },
  { id: "party", label: "Celebrate", glyph: "🎉", accentColor: "#c5a3ff", labelKey: "emoteParty" },
  { id: "sob", label: "Sobbing", glyph: "😭", accentColor: "#8acbff", labelKey: "emoteSob" },
  { id: "skull", label: "Skull", glyph: "💀", accentColor: "#d7e6ed", labelKey: "emoteSkull" },
  { id: "scream", label: "Scream", glyph: "😱", accentColor: "#a8d7ff", labelKey: "emoteScream" },
  {
    id: "good_luck",
    label: "Good luck",
    glyph: "🍀",
    accentColor: "#9de3a6",
    labelKey: "emoteGoodLuck",
    releasedAt: "2026-09-18T00:00:00+02:00",
  },
  {
    id: "thanks",
    label: "Thanks",
    glyph: "🙏",
    accentColor: "#f3cf7a",
    labelKey: "emoteThanks",
    releasedAt: "2026-09-18T00:00:00+02:00",
  },
  {
    id: "good_game",
    label: "Good game",
    glyph: "🤝",
    accentColor: "#9ed8ee",
    labelKey: "emoteGoodGame",
    releasedAt: "2026-09-18T00:00:00+02:00",
  },
  {
    id: "poro_wave",
    label: "Poro Hello",
    glyph: "👋",
    accentColor: "#8de0dc",
    labelKey: "emotePoroWave",
    pack: "poro",
  },
  {
    id: "poro_heart",
    label: "Poro Love",
    glyph: "❤️",
    accentColor: "#ff91b4",
    labelKey: "emotePoroHeart",
    pack: "poro",
  },
  {
    id: "poro_laugh",
    label: "Poro Laugh",
    glyph: "😂",
    accentColor: "#ffd580",
    labelKey: "emotePoroLaugh",
    pack: "poro",
  },
  {
    id: "poro_thinking",
    label: "Poro Thinking",
    glyph: "🤔",
    accentColor: "#c7b0ff",
    labelKey: "emotePoroThinking",
    pack: "poro",
  },
  {
    id: "poro_sad",
    label: "Poro Sad",
    glyph: "😢",
    accentColor: "#8ecfff",
    labelKey: "emotePoroSad",
    pack: "poro",
  },
  {
    id: "poro_party",
    label: "Poro Celebrate",
    glyph: "🎉",
    accentColor: "#ffe299",
    labelKey: "emotePoroParty",
    pack: "poro",
  },
];

export const EMOTE_BY_ID: ReadonlyMap<string, Emote> = new Map(
  EMOTES.map((emote) => [emote.id, emote]),
);

/** `e6.z` fallback wheel — exactly six unique valid ids. */
export const DEFAULT_EMOTE_WHEEL: readonly string[] = Object.freeze([
  "thumbs_up",
  "heart",
  "laugh",
  "wow",
  "cry",
  "angry",
]);

export function isValidEmoteWheel(wheel: unknown): wheel is string[] {
  return (
    Array.isArray(wheel) &&
    wheel.length === 6 &&
    new Set(wheel).size === 6 &&
    wheel.every((id) => typeof id === "string" && EMOTE_BY_ID.has(id))
  );
}

/** `e6.z` — use the saved wheel when valid, otherwise the default wheel. */
export function resolveEmoteWheel(wheel: readonly string[] | null | undefined): string[] {
  return isValidEmoteWheel(wheel) ? [...wheel] : [...DEFAULT_EMOTE_WHEEL];
}

/** `e6.q` — swap one wheel slot. */
export function swapEmoteWheelSlot(wheel: readonly string[], index: number, id: string): string[] {
  const next = resolveEmoteWheel(wheel);
  if (index < 0 || index >= 6 || !EMOTE_BY_ID.has(id)) return next;
  const existing = next.indexOf(id);
  if (existing === index) return next;
  if (existing >= 0) {
    [next[index], next[existing]] = [next[existing]!, next[index]!];
    return next;
  }
  next[index] = id;
  return next;
}

/** Wheel button offset: `((60*t-90) * PI)/180`, centre 82, radius 52. */
export function emoteWheelPosition(index: number): { left: number; top: number } {
  const angle = ((60 * index - 90) * Math.PI) / 180;
  return { left: 82 + 52 * Math.cos(angle), top: 82 + 52 * Math.sin(angle) };
}
