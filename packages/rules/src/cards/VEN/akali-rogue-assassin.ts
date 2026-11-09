/** Akali, Rogue Assassin. */
import { custom, empower, registerCardScript, SELF, SELF_EMPOWERED } from "../sdk";

registerCardScript({
  name: "Akali, Rogue Assassin",
  text: "[Empower][3][Rune] ([3][Rune]: Empower me. Use only if not Empowered.)\n[Action] [Tap]: If it's your turn, move a friendly unit in a showdown to base and if I'm [Empowered] ready it.",
  status: "implemented",
  abilities: [
    empower({ energy: 3, power: { any: 1 } }),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["action"],
      effect: {
        op: "requires",
        condition: { kind: "is-turn-player" },
        rule: "806",
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "unit",
              selector: { cardType: "unit", controller: "self", where: custom("ven:at-showdown") },
              min: 1,
              max: 1,
              label: "Choose a friendly unit in a showdown",
            },
            { op: "move", target: { targetRef: "unit" }, to: "base" },
            {
              op: "if",
              condition: SELF_EMPOWERED,
              then: { op: "ready", target: { targetRef: "unit" } },
            },
          ],
        },
      },
    },
  ],
});
