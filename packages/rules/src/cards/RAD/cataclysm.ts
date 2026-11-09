/**
 * Cataclysm (RAD-084) — "Opponents can't play spells this turn. Move a friendly unit to an
 * occupied enemy battlefield." The destination (355.4) must be an occupied enemy battlefield when
 * chosen (377.2.b-style `requires`) and still be one on resolution (359.3.e.2).
 */
import type { CardTypeName, Effect, PlayerSelector, ZoneSelector } from "@rift/protocol";
import { aUnit, custom, registerCardScript } from "../sdk";
import { zoneRef } from "./custom";

/**
 * "Opponents can't play <type> this turn" — a play restriction (054.1) on every card of that type
 * the opponents could play, in each zone a card can be played from (420.1.a, 811.1.b, 354).
 */
function opponentsCantPlay(cardType: CardTypeName): Effect {
  const zones: ZoneSelector[] = ["hand", "champion", "trash", "banished", "deck", "battlefield"];
  return {
    op: "seq",
    effects: zones.map((zone) => ({
      op: "continuous" as const,
      duration: "this-turn" as const,
      modifier: {
        kind: "restriction" as const,
        restriction: "play",
        target: { cardType, owner: "opponent" as PlayerSelector, zone },
      },
    })),
  };
}

const ENEMY_OCCUPIED_DESTINATION = custom("rad:zone-enemy-occupied", { ref: "destination" });

registerCardScript({
  name: "Cataclysm",
  text: "Opponents can't play spells this turn.\nMove a friendly unit to an occupied enemy battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          opponentsCantPlay("spell"),
          {
            op: "requires",
            condition: ENEMY_OCCUPIED_DESTINATION,
            rule: "355.4",
            effect: {
              op: "if",
              condition: ENEMY_OCCUPIED_DESTINATION,
              then: {
                op: "move",
                target: aUnit({ controller: "self" }),
                to: zoneRef("destination"),
              },
            },
          },
        ],
      },
    },
  ],
});
