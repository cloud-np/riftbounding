/**
 * Convergent Mutation (OGN-108, Origins errata) — "Choose a friendly unit. This turn, increase its
 * Might to the Might of another friendly unit."
 *
 * Both units are chosen on play (355.7). On resolution the first gets +X this turn, X = the other's
 * Might minus its own (an increase: never negative, 479.4.c), computed once (479.4.b).
 */
import { aUnit, evalContextOf, mightOf, refIds, registerCardScript, registerCustomEffect, RESOLVED } from "../sdk";

/** Give the object bound to `target` +X Might this turn, X = Might(`from`) - Might(`target`), at least 0. */
registerCustomEffect("ogn-an:raise-might-to", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = evalContextOf(context);
  const [target] = refIds(ctx, String(params.target));
  const [from] = refIds(ctx, String(params.from));
  if (!target || !from) return RESOLVED;
  const mine = mightOf(ctx, target);
  const theirs = mightOf(ctx, from);
  if (mine === null || theirs === null || theirs <= mine) return RESOLVED;
  machine.push({
    effect: {
      op: "temporary_might",
      amount: theirs - mine,
      target: { targetRef: `obj:${target}` },
    },
  });
  return RESOLVED;
});

registerCardScript({
  name: "Convergent Mutation",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a friendly unit. This turn, increase its Might to the\nMight of another friendly unit.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "self", targetRef: "target:0" }),
        effect: {
          op: "for_each",
          selector: aUnit({ controller: "self", excludeRefs: ["target:0"], targetRef: "target:1" }),
          effect: {
            op: "custom",
            id: "ogn-an:raise-might-to",
            params: { target: "target:0", from: "target:1" },
          },
        },
      },
    },
  ],
});
