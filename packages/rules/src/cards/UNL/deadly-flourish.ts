/** Deadly Flourish. */
import { aUnit, registerCardScript, token } from "../sdk";

registerCardScript({
  name: "Deadly Flourish",
  text: 'Deal 3 to an enemy unit. When it dies this turn, play a Gold gear token exhausted.\n(It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    // The catalog's [Reaction]/[Add] are the Gold token's reminder text (135.2.d.3), not the spell's.
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Add" },
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: 3,
            target: aUnit({ controller: "opponent", targetRef: "target:0" }),
          },
          {
            op: "delayed",
            trigger: {
              kind: "event",
              event: { type: "die", subject: { targetRef: "target:0" } },
            },
            effect: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
            duration: "this-turn",
          },
        ],
      },
    },
  ],
});
