/** Kennen, Heart of the Tempest. */
import { aUnit, custom, registerCardScript, SELF, SELF_EMPOWERED } from "../sdk";

registerCardScript({
  name: "Kennen, Heart of the Tempest",
  text: "When you play a card from anywhere other than your hand, empower me.\n[Action] Disempower me, [Tap]: Give a unit [Assault 2] this turn. (+2 [Might] while it's an attacker.)",
  status: "partial",
  notes:
    "'Disempower me' is part of the activation cost (357.2) but the Cost shape has no disempower part, so it is paid first on resolution; the ability is rejected unless I am Empowered.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "card_played", player: "self" } },
      condition: custom("ven:played-from-not-hand"),
      effect: { op: "empower", target: SELF },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["action"],
      effect: {
        op: "requires",
        condition: SELF_EMPOWERED,
        rule: "357.2",
        effect: {
          op: "seq",
          effects: [
            { op: "disempower", target: SELF },
            {
              op: "grant_keyword",
              keyword: "Assault",
              value: 2,
              target: aUnit({ targetRef: "target:0" }),
              duration: "this-turn",
            },
          ],
        },
      },
    },
  ],
});
