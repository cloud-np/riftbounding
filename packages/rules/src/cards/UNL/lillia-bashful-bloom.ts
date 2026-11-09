/** Lillia, Bashful Bloom. */
import { registerCardScript, SELF, token } from "../sdk";

registerCardScript({
  name: "Lillia, Bashful Bloom",
  text: "[4], [tap]: Play a ready 3[might] Sprite unit Token with [temporary] . This ability costs [1] less for each friendly unit with [temporary].",
  status: "partial",
  notes:
    "The '[1] less for each friendly unit with [Temporary]' reduction is not automated: cost modifiers apply to cards, not to activated abilities (366, 377); the ability is offered at its full [4]. The catalog's [Temporary] is the Sprite token's (suppressed).",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Temporary" },
    {
      kind: "activated",
      cost: { energy: 4, exhaust: SELF },
      effect: {
        op: "create",
        token: token("Sprite", { might: 3, exhausted: false, play: true }),
        zone: "base",
      },
    },
  ],
});
