/**
 * Local game-settings values (verbatim keys + snapping rules from the original board chunk).
 *
 * The original keeps five localStorage stores: card size (719377), preview size (720153),
 * opponent cosmetics (675519), board toggles (529236) and SFX volume (608607, owned by the
 * runtime settings store). Values are all percentages snapped to steps of 5.
 */
import { useSyncExternalStore } from "react";

export const CARD_SIZE_STORAGE_KEY = "riftbound_simulator_card_size:v1";
export const PREVIEW_SIZE_STORAGE_KEY = "riftbound_simulator_preview_size:v1";
export const OPPONENT_COSMETICS_STORAGE_KEY = "riftbound_simulator_opponent_cosmetics";
export const BOARD_TOGGLES_STORAGE_KEY = "riftbound_simulator_board_toggles:v1";

export const CARD_SIZE_MIN = 50;
export const CARD_SIZE_MAX = 150;
export const CARD_SIZE_STEP = 5;
export const CARD_SIZE_DEFAULT = 100;

export const PREVIEW_SIZE_MIN = 50;
export const PREVIEW_SIZE_MAX = 150;
export const PREVIEW_SIZE_STEP = 5;
export const PREVIEW_SIZE_DEFAULT = 100;

export const OPPONENT_COSMETICS_MIN = 25;
export const OPPONENT_COSMETICS_MAX = 100;
export const OPPONENT_COSMETICS_STEP = 5;
export const OPPONENT_COSMETICS_DEFAULT = 100;

/** `719377.d` / `720153.w` — snap 50..150 in steps of 5; non-finite → 100. */
export function snapCardSize(value: number): number {
  if (!Number.isFinite(value)) return CARD_SIZE_DEFAULT;
  return Math.min(
    CARD_SIZE_MAX,
    Math.max(
      CARD_SIZE_MIN,
      CARD_SIZE_MIN +
        CARD_SIZE_STEP *
          Math.round(
            (Math.min(CARD_SIZE_MAX, Math.max(CARD_SIZE_MIN, value)) - CARD_SIZE_MIN) /
              CARD_SIZE_STEP,
          ),
    ),
  );
}

/** `720153.w` — preview size follows the same 50..150 / step-5 rule. */
export function snapPreviewSize(value: number): number {
  if (!Number.isFinite(value)) return PREVIEW_SIZE_DEFAULT;
  return Math.min(
    PREVIEW_SIZE_MAX,
    Math.max(
      PREVIEW_SIZE_MIN,
      PREVIEW_SIZE_MIN +
        PREVIEW_SIZE_STEP *
          Math.round(
            (Math.min(PREVIEW_SIZE_MAX, Math.max(PREVIEW_SIZE_MIN, value)) - PREVIEW_SIZE_MIN) /
              PREVIEW_SIZE_STEP,
          ),
    ),
  );
}

/** `675519.d` — 25..100 in steps of 5; non-finite → 100. */
export function snapOpponentCosmetics(value: number): number {
  if (!Number.isFinite(value)) return OPPONENT_COSMETICS_DEFAULT;
  return (
    5 *
    Math.round(
      Math.min(OPPONENT_COSMETICS_MAX, Math.max(OPPONENT_COSMETICS_MIN, value)) /
        OPPONENT_COSMETICS_STEP,
    )
  );
}

export interface LocalGameSettings {
  cardSizePercent: number;
  previewSizePercent: number;
  opponentCosmeticsPercent: number;
  /** `529236` — local-only toggle (`showBattlefieldMight: true` default). */
  showBattlefieldMight: boolean;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readNumber(store: Storage | null, key: string, fallback: number): number {
  try {
    const raw = store?.getItem(key);
    return raw === null || raw === undefined || raw.trim() === "" ? fallback : Number(raw);
  } catch {
    return fallback;
  }
}

function readBoardToggles(store: Storage | null): boolean {
  try {
    const raw = store?.getItem(BOARD_TOGGLES_STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { showBattlefieldMight?: unknown } | null;
    return typeof parsed?.showBattlefieldMight === "boolean" ? parsed.showBattlefieldMight : true;
  } catch {
    return true;
  }
}

export const DEFAULT_LOCAL_GAME_SETTINGS: LocalGameSettings = Object.freeze({
  cardSizePercent: CARD_SIZE_DEFAULT,
  previewSizePercent: PREVIEW_SIZE_DEFAULT,
  opponentCosmeticsPercent: OPPONENT_COSMETICS_DEFAULT,
  showBattlefieldMight: true,
});

export function loadLocalGameSettings(store: Storage | null = storage()): LocalGameSettings {
  const previewRaw = readNumber(store, PREVIEW_SIZE_STORAGE_KEY, PREVIEW_SIZE_DEFAULT);
  const cardRaw = readNumber(store, CARD_SIZE_STORAGE_KEY, CARD_SIZE_DEFAULT);
  return {
    cardSizePercent: snapCardSize(cardRaw),
    previewSizePercent: snapPreviewSize(
      // The original preview store mirrors the card size value when its key is absent.
      store?.getItem(PREVIEW_SIZE_STORAGE_KEY) === null ? cardRaw : previewRaw,
    ),
    opponentCosmeticsPercent: snapOpponentCosmetics(
      readNumber(store, OPPONENT_COSMETICS_STORAGE_KEY, OPPONENT_COSMETICS_DEFAULT),
    ),
    showBattlefieldMight: readBoardToggles(store),
  };
}

type Listener = () => void;

let current = typeof window === "undefined" ? DEFAULT_LOCAL_GAME_SETTINGS : loadLocalGameSettings();
const listeners = new Set<Listener>();

function persist(next: LocalGameSettings, patch: Partial<LocalGameSettings>): void {
  const store = storage();
  if (!store) return;
  try {
    if (patch.cardSizePercent !== undefined) {
      store.setItem(CARD_SIZE_STORAGE_KEY, String(next.cardSizePercent));
    }
    if (patch.previewSizePercent !== undefined) {
      store.setItem(PREVIEW_SIZE_STORAGE_KEY, String(next.previewSizePercent));
    }
    if (patch.opponentCosmeticsPercent !== undefined) {
      store.setItem(OPPONENT_COSMETICS_STORAGE_KEY, String(next.opponentCosmeticsPercent));
    }
    if (patch.showBattlefieldMight !== undefined) {
      const toggles = JSON.parse(store.getItem(BOARD_TOGGLES_STORAGE_KEY) ?? "{}") as Record<
        string,
        unknown
      >;
      store.setItem(
        BOARD_TOGGLES_STORAGE_KEY,
        JSON.stringify({ ...toggles, showBattlefieldMight: next.showBattlefieldMight }),
      );
    }
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function getLocalGameSettings(): LocalGameSettings {
  return current;
}

export function subscribeLocalGameSettings(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === CARD_SIZE_STORAGE_KEY ||
      event.key === PREVIEW_SIZE_STORAGE_KEY ||
      event.key === OPPONENT_COSMETICS_STORAGE_KEY ||
      event.key === BOARD_TOGGLES_STORAGE_KEY
    ) {
      current = loadLocalGameSettings();
      for (const entry of listeners) entry();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function setLocalGameSettings(patch: Partial<LocalGameSettings>): void {
  const next: LocalGameSettings = {
    cardSizePercent:
      patch.cardSizePercent === undefined
        ? current.cardSizePercent
        : snapCardSize(patch.cardSizePercent),
    previewSizePercent:
      patch.previewSizePercent === undefined
        ? current.previewSizePercent
        : snapPreviewSize(patch.previewSizePercent),
    opponentCosmeticsPercent:
      patch.opponentCosmeticsPercent === undefined
        ? current.opponentCosmeticsPercent
        : snapOpponentCosmetics(patch.opponentCosmeticsPercent),
    showBattlefieldMight:
      patch.showBattlefieldMight === undefined
        ? current.showBattlefieldMight
        : Boolean(patch.showBattlefieldMight),
  };
  if (
    next.cardSizePercent === current.cardSizePercent &&
    next.previewSizePercent === current.previewSizePercent &&
    next.opponentCosmeticsPercent === current.opponentCosmeticsPercent &&
    next.showBattlefieldMight === current.showBattlefieldMight
  ) {
    return;
  }
  current = next;
  persist(next, patch);
  for (const entry of listeners) entry();
}

const SERVER_SETTINGS = DEFAULT_LOCAL_GAME_SETTINGS;

/** React binding for the local settings stores. */
export function useLocalGameSettings(): LocalGameSettings {
  return useSyncExternalStore(
    subscribeLocalGameSettings,
    getLocalGameSettings,
    () => SERVER_SETTINGS,
  );
}
