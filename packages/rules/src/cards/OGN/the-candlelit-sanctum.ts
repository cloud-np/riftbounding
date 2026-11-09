/**
 * The Candlelit Sanctum (OGN-291, battlefield) — "When you conquer here, look at the top two cards
 * of your Main Deck. You may recycle one or both of them. Put those you don't back in any order."
 *
 * Look (425) binds the two cards; the player picks zero, one or both of them to recycle (417; a
 * pick, not a target, 355.18). Partial: the remaining cards stay on top in their current order —
 * there is no prompt to reorder looked-at cards on top of the deck (cf. 437.1.a).
 */
import { custom, registerCardScript, WHEN_YOU_CONQUER_HERE } from "../sdk";

registerCardScript({
  name: "The Candlelit Sanctum",
  text: "When you conquer here, look at the top two cards of your Main Deck. You may recycle one or both of them. Put those you don't back in any order.",
  status: "partial",
  notes:
    "Putting the kept cards back 'in any order' is not offered: no reorder prompt for looked-at cards on top of the deck (cf. 437.1.a).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "look",
        amount: 2,
        then: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "recycled",
              selector: { zone: "deck", owner: "self", where: { kind: "in-ref", ref: "looked" } },
              min: 0,
              max: 2,
            },
            { op: "recycle", target: { targetRef: "recycled" } },
          ],
        },
      },
    },
  ],
});
