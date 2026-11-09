/** Glowstone. */
import { empower, registerCardScript, SELF, SELF_EMPOWERED } from "../sdk";

registerCardScript({
  name: "Glowstone",
  text: "[Empower][Rune][Rune] ([Rune][Rune]: Empower me. Use only if not Empowered.)\nDisempower this, [Tap]: Choose a player. They gain control of this and recall it. (Send it to their base.)\nAt the end of your turn, kill this and deal 5 to all units you control.",
  status: "partial",
  notes:
    "'Disempower this' is part of the activation cost (357.2) but the Cost shape has no disempower part, so it is the first instruction on resolution and the ability is rejected unless Glowstone is Empowered.",
  abilities: [
    empower({ power: { any: 2 } }),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_EMPOWERED,
        rule: "357.2",
        effect: {
          op: "seq",
          effects: [
            { op: "disempower", target: SELF },
            { op: "draw", amount: 0, player: { kind: "chosen", ref: "player" } },
            {
              op: "custom",
              id: "ven:control-and-recall",
              params: { source: "self", playerRef: "player" },
            },
          ],
        },
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "ending" },
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: SELF },
          { op: "deal", amount: 5, target: { cardType: "unit", controller: "self" } },
        ],
      },
    },
  ],
});
