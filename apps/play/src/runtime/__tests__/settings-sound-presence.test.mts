import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_PRESENCE,
  cardPingEqual,
  createPresenceStore,
  reducePresence,
  setCardPing,
} from "../presence";
import { STORAGE_KEYS } from "../config";
import { SFX_VOLUME_DEFAULT, createSettingsStore, loadSfxVolume, snapSfxVolume } from "../settings";
import { SOUND_CATALOG, SoundEngine } from "../sound";

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

describe("presence store (371465)", () => {
  it("reduces hover/ping/emote/typing and clears on player_offline", () => {
    let state = reducePresence(EMPTY_PRESENCE, {
      type: "hover_state",
      playerId: "p2",
      hoveredCardId: "c1",
    });
    expect(state.hoveredCardIdByPlayerId.p2).toBe("c1");
    state = reducePresence(state, { type: "hover_state", playerId: "p2", hoveredCardId: "c1" });
    expect(state.hoveredCardIdByPlayerId.p2).toBe("c1");

    const ping = { cardId: "c1", pingedAt: 5, receivedAt: 6, intent: "general" as const };
    state = reducePresence(state, { type: "card_ping", playerId: "p2", cardPing: ping });
    expect(state.cardPingByPlayerId.p2).toEqual(ping);
    expect(cardPingEqual(ping, { ...ping, receivedAt: 99 })).toBe(true);
    expect(cardPingEqual(ping, null)).toBe(false);

    state = reducePresence(state, {
      type: "board_emote",
      playerId: "p2",
      boardEmote: { emoteId: "heart", emoteAt: 1 },
    });
    expect(state.boardEmoteByPlayerId.p2).toEqual({ emoteId: "heart", emoteAt: 1 });

    state = reducePresence(state, { type: "chat_typing", playerId: "p2", isTyping: true });
    expect(state.chatTypingByPlayerId.p2).toBe(true);

    state = reducePresence(state, { type: "player_offline", playerId: "p2" });
    expect(state.hoveredCardIdByPlayerId.p2).toBeNull();
    expect(state.cardPingByPlayerId.p2).toBeNull();
    expect(state.boardEmoteByPlayerId.p2).toBeNull();
    expect(state.chatTypingByPlayerId.p2).toBe(false);

    expect(reducePresence(state, { type: "clear" })).toBe(EMPTY_PRESENCE);
  });

  it("notifies subscribers only when the snapshot changes", () => {
    const store = createPresenceStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: "chat_typing", playerId: "p1", isTyping: true });
    store.dispatch({ type: "chat_typing", playerId: "p1", isTyping: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("setCardPing reports change", () => {
    const map = new Map();
    expect(
      setCardPing(map, "p1", { cardId: "c", pingedAt: 1, receivedAt: 2, intent: "general" }),
    ).toBe(true);
    expect(
      setCardPing(map, "p1", { cardId: "c", pingedAt: 1, receivedAt: 3, intent: "general" }),
    ).toBe(false);
  });
});

describe("settings (608607 + walkthrough storage keys)", () => {
  it("snaps volume to 0..200 in steps of 5", () => {
    expect(snapSfxVolume(103)).toBe(105);
    expect(snapSfxVolume(-10)).toBe(0);
    expect(snapSfxVolume(500)).toBe(200);
    expect(snapSfxVolume(Number.NaN)).toBe(100);
  });

  it("reads v2 then migrates v1 (squared 0..100)", () => {
    const storage = new MemoryStorage();
    expect(loadSfxVolume(storage)).toBe(SFX_VOLUME_DEFAULT);
    storage.setItem(STORAGE_KEYS.sfxVolumeV1, "50");
    expect(loadSfxVolume(storage)).toBe(25);
    storage.setItem(STORAGE_KEYS.sfxVolume, "140");
    expect(loadSfxVolume(storage)).toBe(140);
  });

  it("persists volume/play mode/player name and exposes volumeScale", () => {
    const storage = new MemoryStorage();
    const store = createSettingsStore({ sfxVolume: 100, playMode: "constructed", playerName: "" });
    // the store writes to the global localStorage; emulate it for this test
    const globalWithStorage = globalThis as { localStorage?: Storage };
    const previous = globalWithStorage.localStorage;
    globalWithStorage.localStorage = storage;
    try {
      const scoped = createSettingsStore({
        sfxVolume: 100,
        playMode: "constructed",
        playerName: "",
      });
      scoped.setSfxVolume(150);
      scoped.setPlayMode("sealed");
      scoped.setPlayerName("  Kai  ");
      expect(storage.getItem(STORAGE_KEYS.sfxVolume)).toBe("150");
      expect(storage.getItem(STORAGE_KEYS.playMode)).toBe("sealed");
      expect(storage.getItem(STORAGE_KEYS.playerName)).toBe("Kai");
      expect(scoped.volumeScale()).toBeCloseTo(1.5);
    } finally {
      if (previous === undefined) delete globalWithStorage.localStorage;
      else globalWithStorage.localStorage = previous;
    }
    expect(store.getSnapshot().sfxVolume).toBe(100);
  });
});

describe("sound engine (608607)", () => {
  it("ships the exact catalog gains/cooldowns", () => {
    expect(SOUND_CATALOG.card_hover!.volume).toBeCloseTo(0.42);
    expect(SOUND_CATALOG.card_hover!.cooldownMs).toBe(35);
    expect(SOUND_CATALOG.ui_click!.cooldownMs).toBe(20);
    expect(SOUND_CATALOG.score_hold!.volume).toBeCloseTo(0.055);
    expect(SOUND_CATALOG.chat_message!.variants[0]!.playbackRate).toBe(0.6);
    expect(SOUND_CATALOG.turn_start!.variants[0]!.playbackRate).toBe(0.9);
    expect(SOUND_CATALOG.game_rewind!.pitchVariation).toBe(false);
    expect(SOUND_CATALOG.ping!.variants[0]!.src).toBe("ping-v2.webm");
  });

  it("does not play when the volume scale is zero", () => {
    const engine = new SoundEngine({ volumeScale: () => 0, fetchImpl: null });
    expect(engine.play("ui_click")).toBe(false);
    expect(engine.diagnostics().deliveryLog.at(-1)?.outcome).toBe("muted");
  });

  it("returns false for unknown keys and unloaded buffers", () => {
    const engine = new SoundEngine({ volumeScale: () => 1, fetchImpl: null });
    expect(engine.play("not_a_sound")).toBe(false);
    expect(engine.play("ui_click")).toBe(false);
    expect(engine.diagnostics().deliveryLog.at(-1)?.outcome).toBe("not_ready");
  });

  it("plays a decoded buffer with the catalog gain and respects cooldowns", async () => {
    const started: number[] = [];
    const gains: number[] = [];
    class FakeBufferSource {
      buffer: unknown;
      playbackRate = { value: 1 };
      connect() {}
      start() {
        started.push(1);
      }
    }
    class FakeGain {
      gain: { value: number };
      constructor() {
        let value = 0;
        this.gain = {
          get value() {
            return value;
          },
          set value(next: number) {
            gains.push(next);
            value = next;
          },
        };
      }
      connect() {}
    }
    class FakeAudioContext {
      state = "running";
      destination = {};
      createBufferSource() {
        return new FakeBufferSource();
      }
      createGain() {
        return new FakeGain();
      }
      decodeAudioData() {
        return Promise.resolve({});
      }
      resume() {
        return Promise.resolve();
      }
    }
    const globalWithAudio = globalThis as { AudioContext?: unknown };
    const previousAudio = globalWithAudio.AudioContext;
    globalWithAudio.AudioContext = FakeAudioContext;
    try {
      let now = 1000;
      const engine = new SoundEngine({
        volumeScale: () => 1,
        now: () => now,
        fetchImpl: (async () =>
          ({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8),
          }) as unknown as Response) as unknown as typeof fetch,
      });
      await engine.preload("ui_click");
      expect(engine.play("ui_click")).toBe(true);
      expect(started).toHaveLength(1);
      expect(gains[0]).toBeCloseTo(0.24);
      // cooldown 20ms blocks an immediate replay
      expect(engine.play("ui_click")).toBe(false);
      now += 25;
      expect(engine.play("ui_click")).toBe(true);
    } finally {
      if (previousAudio === undefined) delete globalWithAudio.AudioContext;
      else globalWithAudio.AudioContext = previousAudio;
    }
  });
});
