"use client";

/**
 * Minimal board SFX player.
 *
 * The full SFX engine lives in `@/runtime/sound`; the interaction layer only
 * needs the board call-site subset. Files are resolved through
 * `@/lib/assets` (`sounds/20260716/<file>.webm`) exactly like the original.
 */
import { soundAsset } from "@/lib/assets";

const SOUND_FILES: Record<string, string[]> = {
  ui_click: ["ui_click1.webm", "ui_click2.webm"],
  card_click: ["card_click1.webm"],
  card_play: ["card_play1.webm"],
  card_draw: ["card_draw1.webm"],
  card_discard: ["card_discard1.webm"],
  card_exhaust: ["card_exhaust1.webm", "card_exhaust2.webm"],
  card_hover: ["card_hover1.webm", "card_hover2.webm", "card_hover3.webm"],
  card_recycle: ["card_recycle1.webm"],
  card_autopay: ["card_autopay1.webm", "card_autopay2.webm", "card_autopay3.webm"],
  ping: ["ping-v2.webm"],
  ui_confirm: ["ui_confirm.webm"],
};

const COOLDOWN_MS: Record<string, number> = { card_hover: 35, ui_click: 20 };
const VOLUME: Record<string, number> = {
  card_hover: 0.42,
  ui_click: 0.24,
  card_click: 0.26,
  card_play: 0.34,
  card_discard: 0.32,
  card_exhaust: 0.32,
  card_recycle: 0.32,
  card_autopay: 0.34,
  ping: 0.08,
  ui_confirm: 0.3,
};

const lastPlayed = new Map<string, number>();
const elements = new Map<string, HTMLAudioElement>();
let enabled = true;

export function setBoardSfxEnabled(value: boolean): void {
  enabled = value;
}

export function playBoardSound(key: string): void {
  if (!enabled || typeof window === "undefined") return;
  const files = SOUND_FILES[key];
  if (!files || files.length === 0) return;
  const now = Date.now();
  const cooldown = COOLDOWN_MS[key] ?? 0;
  if (cooldown > 0 && now - (lastPlayed.get(key) ?? 0) < cooldown) return;
  lastPlayed.set(key, now);
  const file = files[Math.floor(Math.random() * files.length)] ?? files[0]!;
  const src = soundAsset(file);
  try {
    let audio = elements.get(src);
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = VOLUME[key] ?? 0.3;
      elements.set(src, audio);
    }
    audio.currentTime = 0;
    const promise = audio.play();
    if (promise && typeof promise.catch === "function") promise.catch(() => {});
  } catch {
    // Audio is best-effort (autoplay policies, missing files in tests).
  }
}
