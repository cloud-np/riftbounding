/**
 * Sound engine — verbatim port of `.recon/pretty/playapp/2goht72gp0rq8.js` module 608607 (SFX
 * registry + player) and `.recon/specs/03-cards-assets.md` §4.
 *
 * Behaviour kept exactly:
 *  - files `sounds/20260716/<name>.webm` resolved through the static asset base
 *  - per-key `volume`, `cooldownMs`, `pitchVariation` (default true → ±3.5% random pitch),
 *    per-variant `playbackRate`
 *  - random variant selection that avoids repeating the previous variant
 *  - AudioContext created lazily, unlocked on the first `pointerup|touchend|keydown`
 *  - fetch/decode with 3 attempts, degradation back-off `[1000, 3000] ms`, 30s failure retry
 *  - 20-entry delivery log with outcomes (`started|muted|not_ready|suspended|unavailable|error|…`)
 *  - `preloadAll()`/`preload(key)`, `volumeScale()` from the settings store
 */

import { staticAssetUrl } from "./config";
import { settingsStore } from "./settings";

export interface SoundVariant {
  src: string;
  playbackRate?: number;
  /** per-variant volume multiplier */
  volume?: number;
}

export interface SoundDefinition {
  variants: SoundVariant[];
  volume: number;
  cooldownMs?: number;
  pitchVariation?: boolean;
}

/** SFX registry (module 608607) — keys, files, gains and extras verbatim. */
export const SOUND_CATALOG: Record<string, SoundDefinition> = {
  baron_nashor: { variants: [{ src: "baron_nashor.webm" }], volume: 0.12 },
  card_autopay: {
    variants: [
      { src: "card_autopay1.webm" },
      { src: "card_autopay2.webm" },
      { src: "card_autopay3.webm" },
    ],
    volume: 0.34,
  },
  card_click: { variants: [{ src: "card_click1.webm" }], volume: 0.26 },
  card_discard: { variants: [{ src: "card_discard1.webm" }], volume: 0.32 },
  card_draw: { variants: [{ src: "card_draw1.webm" }], volume: 0.3 },
  card_exhaust: {
    variants: [{ src: "card_exhaust1.webm" }, { src: "card_exhaust2.webm" }],
    volume: 0.32,
  },
  card_hover: {
    variants: [
      { src: "card_hover1.webm" },
      { src: "card_hover2.webm" },
      { src: "card_hover3.webm" },
    ],
    volume: 0.42,
    cooldownMs: 35,
  },
  card_play: { variants: [{ src: "card_play1.webm" }], volume: 0.34 },
  card_play_from_hand: { variants: [{ src: "card_play_from_hand.webm" }], volume: 0.34 },
  card_recycle: { variants: [{ src: "card_recycle1.webm" }], volume: 0.32 },
  chat_message: { variants: [{ src: "chat_message.webm", playbackRate: 0.6 }], volume: 0.1 },
  game_rewind: { variants: [{ src: "game_rewind5.webm" }], volume: 0.1, pitchVariation: false },
  game_forward: {
    variants: [{ src: "game_rewind1.webm" }, { src: "game_rewind2.webm" }],
    volume: 0.34,
  },
  game_start: { variants: [{ src: "game_start.webm" }], volume: 0.1, pitchVariation: false },
  ping: { variants: [{ src: "ping-v2.webm" }], volume: 0.08, pitchVariation: false },
  score_conquer: {
    variants: [{ src: "score_conquer1.webm" }],
    volume: 0.12,
    pitchVariation: false,
  },
  score_end: { variants: [{ src: "score_end.webm" }], volume: 0.36, pitchVariation: false },
  score_generic: { variants: [{ src: "score_generic.webm" }], volume: 0.11, pitchVariation: false },
  score_hold: { variants: [{ src: "score_hold.webm" }], volume: 0.055, pitchVariation: false },
  time_warp: { variants: [{ src: "time_warp.webm" }], volume: 0.08, pitchVariation: false },
  turn_start: {
    variants: [{ src: "turn_start.webm", playbackRate: 0.9 }],
    volume: 0.05,
    pitchVariation: false,
  },
  ui_click: {
    variants: [{ src: "ui_click1.webm" }, { src: "ui_click2.webm" }],
    volume: 0.24,
    cooldownMs: 20,
  },
  ui_confirm: { variants: [{ src: "ui_confirm.webm" }], volume: 0.3 },
};

export type SfxKey = keyof typeof SOUND_CATALOG;

export interface SoundPlayOptions {
  cooldownMs?: number;
  cooldownKey?: string;
  volumeScale?: number;
}

export interface SoundDeliveryLogEntry {
  at: number;
  asset: string;
  outcome:
    "started" | "muted" | "not_ready" | "unavailable" | "suspended" | "resume_failed" | "error";
}

interface SoundBufferEntry {
  status: "loading" | "ready" | "failed";
  attempts: number;
  buffer?: AudioBuffer;
  promise?: Promise<boolean>;
  retryAfter?: number;
  lastFailure?: { at: number; reason: string; httpStatus?: number };
}

const UNLOCK_EVENTS = ["pointerup", "touchend", "keydown"] as const;
const LOAD_BACKOFF_MS = [1000, 3000] as const;
const LOAD_TIMEOUT_MS = 8000;
const FAILURE_RETRY_MS = 30_000;

/** sound file path (relative to the sounds directory) for a variant src */
function soundPath(file: string): string {
  return staticAssetUrl(`sounds/20260716/${file}`);
}

export class SoundEngine {
  private readonly catalog: Record<string, SoundDefinition>;
  private readonly buffers = new Map<string, SoundBufferEntry>();
  private readonly lastVariantIndex = new Map<string, number>();
  private readonly cooldowns = new Map<string, number>();
  private context: AudioContext | null = null;
  private unlockBound = false;
  private preloadPromise: Promise<boolean> | null = null;
  private readonly log: SoundDeliveryLogEntry[] = [];
  private readonly now: () => number;
  private readonly fetchImpl: typeof fetch | null;
  private readonly volumeScaleProvider: () => number;

  constructor(
    options: {
      now?: () => number;
      catalog?: Record<string, SoundDefinition>;
      volumeScale?: () => number;
      fetchImpl?: typeof fetch | null;
    } = {},
  ) {
    this.now = options.now ?? (() => Date.now());
    this.catalog = options.catalog ?? SOUND_CATALOG;
    this.volumeScaleProvider = options.volumeScale ?? (() => settingsStore.volumeScale());
    this.fetchImpl =
      options.fetchImpl === undefined
        ? typeof fetch === "function"
          ? fetch
          : null
        : options.fetchImpl;
  }

  /** `608607.f` — diagnostics snapshot. */
  diagnostics(): {
    contextState: string;
    volumePercent: number;
    buffers: Array<{ asset: string; status: string; attempts: number; lastFailure?: unknown }>;
    deliveryLog: SoundDeliveryLogEntry[];
  } {
    return {
      contextState:
        this.context?.state ??
        (typeof AudioContext === "undefined" ? "unsupported" : "uninitialized"),
      volumePercent: Math.round(100 * this.volumeScaleProvider()),
      buffers: Array.from(this.buffers, ([asset, entry]) => ({
        asset,
        status: entry.status,
        attempts: entry.attempts,
        ...(entry.lastFailure ? { lastFailure: entry.lastFailure } : {}),
      })),
      deliveryLog: [...this.log],
    };
  }

  private record(asset: string, outcome: SoundDeliveryLogEntry["outcome"]): void {
    this.log.push({ at: this.now(), asset, outcome });
    if (this.log.length > 20) this.log.shift();
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const globalWindow = globalThis as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = globalWindow.AudioContext ?? globalWindow.webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.context = new Ctor();
    } catch {
      return null;
    }
    this.bindUnlock();
    return this.context;
  }

  private bindUnlock(): void {
    if (this.unlockBound || typeof document === "undefined") return;
    this.unlockBound = true;
    for (const event of UNLOCK_EVENTS) {
      document.addEventListener(event, this.unlock, { capture: true, passive: true });
    }
  }

  private unlock = (): void => {
    const context = this.context;
    if (!context || this.volumeScaleProvider() <= 0) return;
    const state = context.state as string;
    if (state === "suspended" || state === "interrupted") {
      void context.resume().catch(() => undefined);
    }
  };

  private bufferFor(asset: string): AudioBuffer | null {
    const entry = this.buffers.get(asset);
    return entry?.status === "ready" && entry.buffer ? entry.buffer : null;
  }

  /** `608607.P` — load (or return the cached) decoded buffer. */
  load(asset: string): Promise<boolean> {
    const existing = this.buffers.get(asset);
    if (existing?.status === "ready") return Promise.resolve(true);
    if (existing?.status === "failed" && this.now() < (existing.retryAfter ?? 0)) {
      return Promise.resolve(false);
    }
    if (existing?.status === "loading" && existing.promise) return existing.promise;
    const context = this.ensureContext();
    if (!context || !this.fetchImpl) {
      this.buffers.set(asset, {
        status: "failed",
        attempts: existing?.attempts ?? 0,
        retryAfter: this.now() + FAILURE_RETRY_MS,
        lastFailure: { at: this.now(), reason: "unavailable" },
      });
      return Promise.resolve(false);
    }
    const entry: SoundBufferEntry = {
      status: "loading",
      attempts: existing?.attempts ?? 0,
      ...(existing?.lastFailure ? { lastFailure: existing.lastFailure } : {}),
    };
    const promise = (async () => {
      for (let attempt = 0; attempt <= LOAD_BACKOFF_MS.length; attempt += 1) {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        if (attempt > 0)
          await new Promise((resolve) => setTimeout(resolve, LOAD_BACKOFF_MS[attempt - 1]));
        entry.attempts += 1;
        const controller = new AbortController();
        const failure: { reason: string; httpStatus?: number } = { reason: "network" };
        try {
          const decoded = await Promise.race([
            (async () => {
              const response = await this.fetchImpl!(asset, {
                cache: entry.attempts === 1 ? "force-cache" : "reload",
                signal: controller.signal,
              });
              if (!response.ok) {
                failure.reason = "http";
                failure.httpStatus = response.status;
                throw new Error("SFX HTTP failure");
              }
              const data = await response.arrayBuffer();
              failure.reason = "decode";
              return context.decodeAudioData(data.slice(0));
            })(),
            new Promise<never>((_, reject) => {
              timeout = setTimeout(() => {
                failure.reason = "timeout";
                reject(new Error("SFX load timeout"));
                controller.abort();
              }, LOAD_TIMEOUT_MS);
            }),
          ]);
          entry.status = "ready";
          entry.buffer = decoded;
          return true;
        } catch {
          entry.lastFailure = {
            at: this.now(),
            reason: failure.reason,
            ...(failure.reason === "http" && failure.httpStatus !== undefined
              ? { httpStatus: failure.httpStatus }
              : {}),
          };
        } finally {
          if (timeout !== undefined) clearTimeout(timeout);
        }
      }
      entry.status = "failed";
      entry.retryAfter = this.now() + FAILURE_RETRY_MS;
      return false;
    })();
    entry.promise = promise;
    this.buffers.set(asset, entry);
    return promise;
  }

  /** `608607.D` — preload every variant of a key. */
  async preload(key: string): Promise<boolean> {
    const definition = this.catalog[key];
    if (!definition) return false;
    const results = await Promise.all(
      definition.variants.map((variant) => this.load(soundPath(variant.src))),
    );
    return results.every(Boolean);
  }

  /** `608607.c` — preload everything. */
  preloadAll(): Promise<boolean> {
    if (this.preloadPromise) return this.preloadPromise;
    const assets = Array.from(
      new Set(
        Object.values(this.catalog).flatMap((definition) =>
          definition.variants.map((variant) => soundPath(variant.src)),
        ),
      ),
    );
    this.preloadPromise = Promise.all(assets.map((asset) => this.load(asset))).then((results) => {
      const allReady = results.every(Boolean);
      if (!allReady) this.preloadPromise = null;
      return allReady;
    });
    return this.preloadPromise;
  }

  /** `608607.y` — play a key. Returns whether a buffer started. */
  play(key: string, options: SoundPlayOptions = {}): boolean {
    const definition = this.catalog[key];
    if (!definition) return false;
    const fallbackAsset = definition.variants[0] ? soundPath(definition.variants[0].src) : "";
    const cooldownMs = options.cooldownMs ?? definition.cooldownMs ?? 0;
    const cooldownKey = options.cooldownKey ?? key;
    if (cooldownMs > 0 && this.now() - (this.cooldowns.get(cooldownKey) ?? 0) < cooldownMs) {
      return false;
    }
    const scale = Math.max(0, options.volumeScale ?? 1) * this.volumeScaleProvider();
    if (scale <= 0) {
      this.record(fallbackAsset, "muted");
      return false;
    }
    const variant = this.pickVariant(key);
    if (!variant) {
      this.record(fallbackAsset, "not_ready");
      const needsRetry = definition.variants.some(({ src }) => {
        const entry = this.buffers.get(soundPath(src));
        return entry?.status === "failed" && this.now() >= (entry.retryAfter ?? 0);
      });
      if (needsRetry) void this.preload(key);
      return false;
    }
    const buffer = this.bufferFor(soundPath(variant.src));
    if (!buffer) return false;
    const context = this.ensureContext();
    if (!context) {
      this.record(soundPath(variant.src), "unavailable");
      return false;
    }
    const gain = Math.max(0, definition.volume * (variant.volume ?? 1) * scale);
    if (gain <= 0) return false;
    try {
      const state = context.state as string;
      if (state === "closed") {
        this.record(soundPath(variant.src), "unavailable");
        return false;
      }
      if (state === "suspended" || state === "interrupted") {
        const activation = typeof navigator === "undefined" ? undefined : navigator.userActivation;
        if (activation && !activation.isActive) {
          this.record(soundPath(variant.src), "suspended");
          return false;
        }
        void context.resume().catch(() => this.record(soundPath(variant.src), "resume_failed"));
      }
      const source = context.createBufferSource();
      const gainNode = context.createGain();
      source.buffer = buffer;
      const rate = variant.playbackRate ?? 1;
      source.playbackRate.value =
        definition.pitchVariation === false
          ? Math.max(0.01, rate)
          : Math.max(0.01, rate * (1 + (2 * Math.random() - 1) * 0.035));
      gainNode.gain.value = gain;
      source.connect(gainNode);
      gainNode.connect(context.destination);
      source.start(0);
      this.record(soundPath(variant.src), "started");
      if (cooldownMs > 0) this.cooldowns.set(cooldownKey, this.now());
      return true;
    } catch {
      this.record(soundPath(variant.src), "error");
      return false;
    }
  }

  /** Variant selection that never repeats the previous variant for a key. */
  private pickVariant(key: string): SoundVariant | null {
    const definition = this.catalog[key];
    if (!definition) return null;
    const ready = definition.variants.filter((variant) => this.bufferFor(soundPath(variant.src)));
    if (ready.length === 0) return null;
    if (ready.length === 1) {
      const variant = ready[0]!;
      const index = definition.variants.findIndex((candidate) => candidate.src === variant.src);
      this.lastVariantIndex.set(key, Math.max(0, index));
      return variant;
    }
    let pick = Math.floor(Math.random() * ready.length);
    let variant = ready[pick]!;
    const last = this.lastVariantIndex.get(key);
    if (
      definition.variants.findIndex((candidate) => candidate.src === variant.src) === last &&
      ready.length > 1
    ) {
      pick = (pick + 1) % ready.length;
      variant = ready[pick]!;
    }
    this.lastVariantIndex.set(
      key,
      definition.variants.findIndex((candidate) => candidate.src === variant.src),
    );
    return variant;
  }
}

/** Process-wide engine used by the UI. */
export const soundEngine = new SoundEngine();

/** Convenience: play a catalog key on the shared engine. */
export function playSound(key: string, options?: SoundPlayOptions): boolean {
  return soundEngine.play(key, options);
}
