/**
 * `RulesState` creation — rules 315 (Start of Turn) and the restore/hand-built path.
 */
import type { Room, RulesState } from "@rift/protocol";
import type { RulesHost } from "../host";

export function emptyRulesState(playerId: string, turnNumber = 1): RulesState {
  return {
    version: 1,
    turn: { player: playerId, number: turnNumber, phase: "awaken" },
    priority: null,
    focus: null,
    passes: [],
    chain: [],
    showdown: null,
    combat: null,
    contested: {},
    staged: { showdowns: [], combats: [] },
    tasks: [],
    prompt: null,
    triggers: [],
    effects: [],
    objects: {},
    pools: {},
    scoredThisTurn: {},
    history: { cardsPlayedThisTurn: {} },
    manual: null,
  };
}

/** Build the strict state for a room that just entered `in_game` (315 Start of Turn). */
export function createRulesState(room: Room, host: RulesHost): RulesState {
  const active = host.activePlayerIds(room);
  const first = room.firstPlayerId && active.includes(room.firstPlayerId)
    ? room.firstPlayerId
    : (active[0] ?? room.players[0]?.id ?? "");
  const state = emptyRulesState(first, Math.max(1, room.turnNumber ?? 1));
  initializePlayerState(state, room, host);
  return state;
}

/**
 * 304/312.2.a: the player whose turn it is, preferring the Room's own `activeTurnPlayerId`.
 * Used by the restore contract and by strict initialisation.
 */
export function turnPlayerForRoom(room: Room, host: RulesHost): string {
  const activeIds = host.activePlayerIds(room);
  if (room.activeTurnPlayerId && activeIds.includes(room.activeTurnPlayerId)) {
    return room.activeTurnPlayerId;
  }
  if (room.firstPlayerId && activeIds.includes(room.firstPlayerId)) return room.firstPlayerId;
  return activeIds[0] ?? room.players[0]?.id ?? "";
}

/**
 * Restore contract (NEW-6/NEW-7) — rebuild `RulesState` for a strict in-game room that lost it.
 *
 * The Board is authoritative, so this deliberately does NOT replay Start of Turn (315.1 ready,
 * 315.3.b.1 channel, 315.4.b draw): the units/rune area/hand already reflect the current turn,
 * and replaying them would ready Units, channel 2 extra Runes and draw an extra card.
 *
 * 312.2.a: the room resumes at Main with Priority held by the Turn Player. A room recorded at
 * the coarse `beginning` step resumes at the start of Main as well — the contract chooses to
 * skip the Awaken/Channel/Draw automation rather than duplicate it; the board already holds
 * whatever those steps produced. See docs/RULES-ENGINE.md (owned by the wave lead).
 */
export function restoreRulesState(room: Room, host: RulesHost): RulesState {
  const turnPlayer = turnPlayerForRoom(room, host);
  const state = emptyRulesState(turnPlayer, Math.max(1, room.turnNumber ?? 1));
  initializePlayerState(state, room, host);
  state.turn.phase = "main";
  state.priority = turnPlayer;
  return state;
}

/** Shared per-player state initialisation (pools, scored record, history counters, objects). */
function initializePlayerState(state: RulesState, room: Room, host: RulesHost): void {
  for (const playerId of host.playerIds(room)) {
    state.pools[playerId] = { energy: 0, power: {} };
    state.scoredThisTurn[playerId] = [];
    state.history.cardsPlayedThisTurn[playerId] = 0;
    scrubObjects(state, room, playerId, host);
  }
}

/** Rebuild the object table from the board (damage/buffs survive strict init only in tests). */
function scrubObjects(state: RulesState, room: Room, playerId: string, host: RulesHost): void {
  const zones = ["base", ...host.battlefieldZones(room)] as const;
  for (const zone of zones) {
    for (const card of host.zoneCards(room, playerId, zone)) {
      const info = host.cardInfo(room, card.id);
      if (!info || !info.type.toLowerCase().includes("unit")) continue;
      const existing = state.objects[card.id];
      state.objects[card.id] = {
        ...existing,
        ...(typeof info.might === "number" ? { baseMight: info.might } : {}),
      };
    }
  }
}
