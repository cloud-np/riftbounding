"use client";

/**
 * Effective animation level: the board setting, capped by the OS `prefers-reduced-motion`.
 * Every animated layer (cards, VFX, board theme) should gate on this rather than reading the
 * media query or the setting separately.
 */
import { useSyncExternalStore } from "react";

import {
  getLocalGameSettings,
  subscribeLocalGameSettings,
  type AnimationLevel,
} from "../settings/settings-values";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia(REDUCED_QUERY).matches;
  } catch {
    return false;
  }
}

/** Non-React read (for effect schedulers running outside render). */
export function getEffectiveAnimationLevel(): AnimationLevel {
  const level = getLocalGameSettings().animationLevel;
  if (level === "full" && prefersReducedMotion()) return "reduced";
  return level;
}

function subscribe(listener: () => void): () => void {
  const unsubscribeSettings = subscribeLocalGameSettings(listener);
  let media: MediaQueryList | null = null;
  try {
    media = window.matchMedia(REDUCED_QUERY);
    media.addEventListener("change", listener);
  } catch {
    media = null;
  }
  return () => {
    unsubscribeSettings();
    media?.removeEventListener("change", listener);
  };
}

export function useAnimationLevel(): AnimationLevel {
  return useSyncExternalStore(subscribe, getEffectiveAnimationLevel, () => "full" as const);
}

/** Duration multiplier for a level (reduced keeps motion short; off skips it). */
export function motionScale(level: AnimationLevel): number {
  return level === "full" ? 1 : level === "reduced" ? 0.45 : 0;
}
