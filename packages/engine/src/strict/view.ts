/**
 * Read-side strict view for clients (R2-int).
 *
 * `@rift/rules`' read API needs a `RulesHost` (board facts live in `Room`). Clients get the
 * engine host bound here so the strict board UI can enumerate `legalIntents`, show `whoMayAct`
 * and explain a rejection (`explainIllegal`) without depending on `@rift/rules` directly.
 *
 * Read only: the rules read side never mutates the room (N2) and needs no randomness, so the
 * context is fixed. Any throw (for example a redacted placeholder the layer does not expect)
 * degrades to `null` / a generic Verdict instead of breaking the board.
 */
import type { LegalIntents, Room, Verdict, WhoMayAct } from "@rift/protocol";
import { explainIllegal, legalIntents, turnState, whoMayAct, type RulesContext } from "@rift/rules";
import { createEngineRulesHost } from "./host";

function readContext(room: Room): RulesContext {
  return {
    now: room.updatedAt ?? 0,
    rng: () => 0,
    mode: room.roomMode ?? "multiplayer",
  };
}

function isStrictInGame(room: Room | null | undefined): room is Room {
  return !!room && room.rulesMode === "strict" && room.phase === "in_game" && !!room.rules;
}

/** `legalIntents` for one seat, or null outside a strict in-game room. */
export function strictLegalIntents(
  room: Room | null | undefined,
  playerId: string,
): LegalIntents | null {
  if (!isStrictInGame(room)) return null;
  try {
    return legalIntents(room, playerId, createEngineRulesHost(readContext(room)));
  } catch {
    return null;
  }
}

/** One facedown card of the viewer at a battlefield (811.1.b) with its next-turn availability. */
export interface StrictHiddenCard {
  cardId: string;
  zone: string;
  /** Turn number it was hidden on (811.1.b); null for a facedown card hidden by another effect. */
  hiddenTurn: number | null;
  /** First turn it may be played from facedown (the turn after it was hidden), or null. */
  availableOnTurn: number | null;
  /** True when `legalIntents.playable` already lists it with `fromFacedown`. */
  playableNow: boolean;
}

/**
 * 811.1.b/811.6: the viewer's own facedown cards, for highlighting play-from-Hidden even before
 * they are playable. Read-only; pass only the viewer's (redacted for others) room.
 */
export function strictHiddenCards(
  room: Room | null | undefined,
  playerId: string,
): StrictHiddenCard[] {
  if (!isStrictInGame(room)) return [];
  try {
    const host = createEngineRulesHost(readContext(room));
    const playable = strictLegalIntents(room, playerId)?.playable ?? [];
    const playableIds = new Set(
      playable.filter((detail) => detail.fromFacedown).map((detail) => detail.cardId),
    );
    const out: StrictHiddenCard[] = [];
    for (const zone of host.battlefieldZones(room) as string[]) {
      for (const card of host.zoneCards(room, playerId, zone)) {
        if (!card.hidden) continue;
        const hiddenTurn = room.rules?.objects[card.id]?.hiddenTurn;
        const turn = typeof hiddenTurn === "number" ? hiddenTurn : null;
        out.push({
          cardId: card.id,
          zone,
          hiddenTurn: turn,
          availableOnTurn: turn === null ? null : turn + 1,
          playableNow: playableIds.has(card.id),
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** `whoMayAct`, or null outside a strict in-game room. */
export function strictWhoMayAct(room: Room | null | undefined): WhoMayAct | null {
  if (!isStrictInGame(room)) return null;
  try {
    return whoMayAct(room);
  } catch {
    return null;
  }
}

/** `turnState` (307–310), or null outside a strict in-game room. */
export function strictTurnState(
  room: Room | null | undefined,
): ReturnType<typeof turnState> | null {
  if (!isStrictInGame(room)) return null;
  try {
    return turnState(room);
  } catch {
    return null;
  }
}

/** §5: why `intent` would be rejected for `playerId` (`{ ok: true }` when it is legal). */
export function strictExplainIllegal(room: Room, playerId: string, intent: unknown): Verdict {
  try {
    return explainIllegal(room, playerId, intent, createEngineRulesHost(readContext(room)));
  } catch {
    return { ok: false, code: "illegal_action", rule: "contract:§5" };
  }
}
