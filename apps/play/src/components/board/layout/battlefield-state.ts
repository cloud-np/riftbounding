import type { CardInstance, Room, RoomPlayer } from "@rift/protocol";

export type BattlefieldControlState = "self" | "opponent" | "contested" | "neutral";

/** A card that actually holds the battlefield (not a hidden-less placeholder or marker). */
function holds(cards: readonly CardInstance[]): boolean {
  return cards.some((card) => !card.isPlaceholder && card.type !== "Battlefield");
}

/**
 * Visual control state of a battlefield, derived from the room:
 *  - strict rooms: an active showdown / combat / staged showdown / contested flag on the zone
 *  - sandbox (and as a fallback): units from both sides present = contested; one side = its control.
 */
export function battlefieldState(options: {
  room: Room;
  viewer: RoomPlayer;
  zone: string;
  ownCards: readonly CardInstance[];
  opponentCards: readonly CardInstance[];
}): BattlefieldControlState {
  const { room, zone, ownCards, opponentCards } = options;
  const rules = room.rules;
  if (rules) {
    if (rules.showdown?.battlefield === zone || rules.combat?.battlefield === zone) return "contested";
    const staged = rules.staged;
    if (staged?.showdowns?.includes(zone as never) || staged?.combats?.includes(zone as never)) {
      return "contested";
    }
    if (rules.contested?.[zone as keyof typeof rules.contested]) return "contested";
  }
  const own = holds(ownCards);
  const opp = holds(opponentCards);
  if (own && opp) return "contested";
  if (own) return "self";
  if (opp) return "opponent";
  return "neutral";
}
