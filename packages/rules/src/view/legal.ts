/** Read-side legal-intent enumeration (§3). */
import type { LegalIntents, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { endTurnVerdict } from "../legality/end-turn";
import { passVerdict } from "../legality/pass";
import { legalActivatableAbilities } from "./legal-activate";
import { legalMoves } from "./legal-move";
import { legalHides, legalPlayDetails } from "./legal-play";
import { readableRulesRoom } from "./restore";

function emptyLegalIntents(playerId: string): LegalIntents {
  return {
    playerId,
    playableCardIds: [],
    activatable: [],
    moves: [],
    canPass: false,
    canEndTurn: false,
    canChoose: false,
    canManualDone: false,
    prompt: null,
  };
}

/**
 * §3: playable card ids, activatable abilities, movable units/destinations, pass/end-turn.
 *
 * NEW-7: a strict in-game room without `RulesState` is restored on a clone, exactly like
 * `applyRulesIntent`, so all three read/write entry points agree.
 */
export function legalIntents(room: Room, playerId: string, host: RulesHost): LegalIntents {
  const readable = readableRulesRoom(room, host);
  if (!readable.ok) return emptyLegalIntents(playerId);
  const view = readable.room;
  const rules = view.rules;
  if (!rules) return emptyLegalIntents(playerId);
  const prompt = rules.prompt && rules.prompt.playerId === playerId ? rules.prompt : null;
  const result: LegalIntents = {
    playerId,
    playableCardIds: [],
    activatable: [],
    moves: [],
    canPass: false,
    canEndTurn: false,
    canChoose: !!prompt,
    canManualDone: !!rules.manual && rules.manual.player === playerId,
    prompt,
  };
  if (view.gameOutcome) return result;

  const playable = legalPlayDetails(view, playerId, host);
  result.playableCardIds = playable.map((detail) => detail.cardId);
  // R2-play details (same order as playableCardIds) + 811.1.b Hide options.
  result.playable = playable;
  const hideable = legalHides(view, playerId, host);
  if (hideable.length > 0) result.hideable = hideable;
  result.activatable = legalActivatableAbilities(view, playerId, host);
  result.moves = legalMoves(view, playerId, host);
  result.canPass = passVerdict(view, playerId).ok;
  result.canEndTurn = endTurnVerdict(view, playerId).ok;
  return result;
}
