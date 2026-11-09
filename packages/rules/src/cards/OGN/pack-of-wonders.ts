/**
 * Pack of Wonders (OGN-181, Origins errata) — "[Tap]: Return another friendly gear, unit, or
 * facedown card to its owner's hand."
 *
 * Registers `ogn-oz:permanent-or-facedown`: the candidate (`it`) is a unit or gear, or a facedown
 * card (107.3 / 811). Return to hand goes to the owner's hand (056).
 */
import { custom, locate, registerCardScript, registerCustomCondition, SELF, typeOf } from "../sdk";

registerCustomCondition("ogn-oz:permanent-or-facedown", (ctx) => {
  const id = ctx.env.it;
  if (!id) return false;
  const located = locate(ctx.room, ctx.host, id);
  if (!located) return false;
  if (located.card.hidden) return true;
  const type = typeOf(ctx.room, ctx.host, id);
  return type.includes("unit") || type.includes("gear");
});

registerCardScript({
  name: "Pack of Wonders",
  text: "[Tap]: Return another friendly gear, unit, or facedown card to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "return_to_hand",
        target: {
          chosen: true,
          cardType: "card",
          controller: "self",
          excludeSource: true,
          where: custom("ogn-oz:permanent-or-facedown"),
        },
      },
    },
  ],
});
