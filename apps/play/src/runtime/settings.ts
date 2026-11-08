/**
 * Settings store — SFX volume (0–200, steps of 5, default 100) + play mode / player name.
 *
 * Verbatim port of `.recon/pretty/playapp/2goht72gp0rq8.js` module 608607 (volume):
 *   key `riftbound_simulator_sfx_volume:v2`; legacy v1 was stored as a squared 0–100 value and is
 *   migrated with `(min(100, max(0, v)) / 100) ** 2 * 100`; `c()` snaps to 0–200 in steps of 5;
 *   `useSyncExternalStore`-friendly subscribe/getSnapshot + `volumeScale()` = snap(volume)/100.
 *
 * Play mode + player name use the original localStorage keys from the browser walkthrough
 * (`riftbound_simulator_play_mode`, `riftbound_simulator_player_name`).
 */

import type { PlayMode } from "@rift/protocol";
import { STORAGE_KEYS } from "./config";
import { createStore, type ExternalStore } from "./store";

export const SFX_VOLUME_MIN = 0;
export const SFX_VOLUME_MAX = 200;
export const SFX_VOLUME_STEP = 5;
export const SFX_VOLUME_DEFAULT = 100;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** `608607.c` — snap to [0,200] in steps of 5; non-finite → 100. */
export function snapSfxVolume(value: number): number {
  if (!Number.isFinite(value)) return SFX_VOLUME_DEFAULT;
  return Math.min(
    SFX_VOLUME_MAX,
    Math.max(
      SFX_VOLUME_MIN,
      SFX_VOLUME_STEP *
        Math.round(Math.min(SFX_VOLUME_MAX, Math.max(SFX_VOLUME_MIN, value)) / SFX_VOLUME_STEP),
    ),
  );
}

/** `608607` load — v2 first, v1 migration fallback. */
export function loadSfxVolume(store: Storage | null = storage()): number {
  if (!store) return SFX_VOLUME_DEFAULT;
  try {
    const v2 = store.getItem(STORAGE_KEYS.sfxVolume);
    if (v2 !== null) return v2.trim() === "" ? SFX_VOLUME_DEFAULT : snapSfxVolume(Number(v2));
    const v1 = store.getItem(STORAGE_KEYS.sfxVolumeV1);
    if (v1 === null || v1.trim() === "") return SFX_VOLUME_DEFAULT;
    const value = Number(v1);
    return Number.isFinite(value)
      ? snapSfxVolume((Math.min(100, Math.max(0, value)) / 100) ** 2 * 100)
      : SFX_VOLUME_DEFAULT;
  } catch {
    return SFX_VOLUME_DEFAULT;
  }
}

export interface SettingsState {
  sfxVolume: number;
  playMode: PlayMode;
  playerName: string;
}

export interface SettingsStore extends ExternalStore<SettingsState> {
  setSfxVolume: (value: number) => void;
  setPlayMode: (mode: PlayMode) => void;
  setPlayerName: (name: string) => void;
  /** `608607.p` — effective volume scale 0..2. */
  volumeScale: () => number;
}

export function loadPlayMode(store: Storage | null = storage()): PlayMode {
  try {
    return store?.getItem(STORAGE_KEYS.playMode) === "sealed" ? "sealed" : "constructed";
  } catch {
    return "constructed";
  }
}

export function loadPlayerName(store: Storage | null = storage()): string {
  try {
    return store?.getItem(STORAGE_KEYS.playerName)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function createSettingsStore(initial?: Partial<SettingsState>): SettingsStore {
  const persisted = storage();
  const store = createStore<SettingsState>({
    sfxVolume: initial?.sfxVolume ?? loadSfxVolume(persisted),
    playMode: initial?.playMode ?? loadPlayMode(persisted),
    playerName: initial?.playerName ?? loadPlayerName(persisted),
  });
  return {
    ...store,
    setSfxVolume: (value: number) => {
      const next = snapSfxVolume(value);
      const current = store.getSnapshot();
      if (current.sfxVolume === next) return;
      store.setSnapshot({ ...current, sfxVolume: next });
      try {
        persisted?.setItem(STORAGE_KEYS.sfxVolume, String(next));
      } catch {
        /* ignore */
      }
    },
    setPlayMode: (mode: PlayMode) => {
      const current = store.getSnapshot();
      if (current.playMode === mode) return;
      store.setSnapshot({ ...current, playMode: mode });
      try {
        persisted?.setItem(STORAGE_KEYS.playMode, mode);
      } catch {
        /* ignore */
      }
    },
    setPlayerName: (name: string) => {
      const next = name.trim();
      const current = store.getSnapshot();
      if (current.playerName === next) return;
      store.setSnapshot({ ...current, playerName: next });
      try {
        persisted?.setItem(STORAGE_KEYS.playerName, next);
      } catch {
        /* ignore */
      }
    },
    volumeScale: () => snapSfxVolume(store.getSnapshot().sfxVolume) / 100,
  };
}

/** Process-wide settings store (the UI reads it through `useSettings`). */
export const settingsStore: SettingsStore = createSettingsStore();
