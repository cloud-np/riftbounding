/** Affectionate Poro. */
import { custom, HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Affectionate Poro",
  text: "When a combat that I was in ends, if I haven't been dealt damage this turn, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 468.7.b `combat_end` at my battlefield; `damagedThisTurn` is the engine's 'dealt damage' flag.
      trigger: { kind: "event", event: { type: "combat_end", zone: HERE } },
      condition: custom("ven:self-not-damaged-this-turn"),
      effect: { op: "draw", amount: 1 },
    },
  ],
});
