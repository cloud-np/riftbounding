/**
 * Garbage Grabber (OGN) — "Recycle 3 from your trash, [1], [Tap]: Draw 1."
 * 417.1: recycled cards go to the bottom of their owners' Main Decks.
 */
import { registerCardScript } from "../registry";
import { SELF, custom } from "../dsl";

registerCardScript({
  name: "Garbage Grabber",
  text: "Recycle 3 from your trash, [1], [Tap]: Draw 1.",
  status: "partial",
  notes:
    'The leading cost "recycle 3 from your trash" is paid on resolution instead of at activation (Cost has no recycle-from-trash component, 740.4.a.2).',
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "recycled",
            selector: { zone: "trash", owner: "self" },
            min: 3,
            max: 3,
          },
          { op: "recycle", target: { targetRef: "recycled" } },
          { op: "if", condition: { kind: "did" }, then: { op: "draw", amount: 1 } },
        ],
      },
    },
  ],
});
