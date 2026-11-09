/**
 * Vex, Apathetic (UNL-150) — [Deflect] (809, engine keyword). "When an opponent plays a unit while
 * I'm at a battlefield, [Stun] it. They can't move it this turn." (424 stun; the move restriction
 * is a continuous effect bound to that unit, 391.4 / 054.1.)
 */
import { registerCardScript } from "../registry";
import { EVENT_SUBJECT, SELF_AT_BATTLEFIELD } from "../dsl";

registerCardScript({
  name: "Vex, Apathetic",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhen an opponent plays a unit while I'm at a battlefield, [Stun] it. They can't move it this turn.\n(It doesn't deal combat damage this turn.)",
  status: "partial",
  notes:
    "'They can't move it' is a restriction on the unit, so it also stops moves of it by other players' effects; the engine's move restriction does not know who moves (054.1, 421).",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "unit_played", player: "opponent" } },
      condition: SELF_AT_BATTLEFIELD,
      effect: {
        op: "seq",
        effects: [
          { op: "stun", target: EVENT_SUBJECT },
          {
            op: "continuous",
            modifier: { kind: "restriction", restriction: "move", target: EVENT_SUBJECT },
            duration: "this-turn",
          },
        ],
      },
    },
  ],
});
