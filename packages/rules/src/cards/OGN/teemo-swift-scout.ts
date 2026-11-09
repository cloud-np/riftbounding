/**
 * Teemo, Swift Scout (OGN-263, legend) — "You may pay [1] to hide a card with [HIDDEN] instead of
 * [Rune]. [1], [Tap]: Put a Teemo unit you own into your hand from your Champion Zone or the
 * board."
 *
 * Registers `ogn-oz:bind-zones`: binds a resolution variable to a list of zones ("board" = base +
 * battlefields, 107) so a `choose` can pick across several zones (the Champion Zone and the
 * board). The pick is not a target (355.18); putting a card you own into your hand from the board
 * is a return to its owner's hand (056).
 *
 * Partial: the alternative Hide cost (811.1.a: [1] instead of [A]) belongs to the play layer's
 * Hide action, which has no cost-replacement hook.
 */
import { locationZones, registerCardScript, registerCustomEffect, RESOLVED, SELF } from "../sdk";

registerCustomEffect("ogn-oz:bind-zones", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const key = typeof params.key === "string" ? params.key : "zones";
  const wanted = Array.isArray(params.zones)
    ? params.zones.filter((zone): zone is string => typeof zone === "string")
    : [];
  const zones = wanted.flatMap((zone) =>
    zone === "board" ? locationZones(context.room, context.step.host) : [zone],
  );
  machine.env.vars[key] = zones;
  return RESOLVED;
});

registerCardScript({
  name: "Teemo, Swift Scout",
  text: "You may pay [1] to hide a card with [HIDDEN] instead of [Rune].\n[1], [Tap]: Put a Teemo unit you own into your hand from your Champion Zone or the board.",
  status: "partial",
  notes:
    "The alternative Hide cost ([1] instead of [Rune], 811.1.a) is not supported by the play layer's Hide action.",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          {
            op: "custom",
            id: "ogn-oz:bind-zones",
            params: { key: "teemoZones", zones: ["champion", "board"] },
          },
          {
            op: "choose",
            key: "teemo",
            selector: {
              cardType: "unit",
              owner: "self",
              tag: "Teemo",
              zone: { kind: "chosen", ref: "teemoZones" },
            },
            min: 1,
            max: 1,
          },
          { op: "return_to_hand", target: { targetRef: "teemo" } },
        ],
      },
    },
  ],
});
