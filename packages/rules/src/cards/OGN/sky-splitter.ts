/**
 * Sky Splitter (OGN-014) — "[ACTION] This spell's Energy cost is reduced by the highest Might among
 * units you control. Deal 5 to a unit at a battlefield."
 *
 * The reduction is a cost passive that applies from the hand (366.2.a). `costAdjustments` reads
 * fixed amounts only, so it is written as one conditional "[1] less" per Might point up to the
 * printed Energy cost of 8 ("you control a unit with N+ Might", N = 1 … 8): the discount is exactly
 * min(highest Might, 8), and the cost cannot go below 0 (356.4).
 *
 * Partial: cost-layer conditions are evaluated at layer depth 1 (478.1.c loop breaker), where a
 * unit's Might is base + buffs + object modifiers only: Might from passive abilities, continuous
 * effects or Assault/Shield is not counted for the reduction.
 */
import type { Ability } from "@rift/protocol";
import { aUnit, registerCardScript, SELF } from "../sdk";

const PRINTED_ENERGY = 8;

const perMight: Ability[] = Array.from({ length: PRINTED_ENERGY }, (_, index) => ({
  kind: "passive",
  modifier: { kind: "while", condition: {
        kind: "exists",
        selector: { cardType: "unit", controller: "self", might: { op: "gte", value: index + 1 } },
      }, modifier: { kind: "cost", amount: -1, target: SELF } },
}));

registerCardScript({
  name: "Sky Splitter",
  text: "[ACTION] (Play on your turn or in showdowns.)\nThis spell's Energy cost is reduced by the highest Might among units you control.\nDeal 5 to a unit at a battlefield.",
  status: "partial",
  notes:
    "Cost reduction reads Might at layer depth 1 (478.1.c): Might granted by passives, continuous effects or Assault/Shield is not counted.",
  abilities: [
    { kind: "spell", effect: { op: "deal", amount: 5, target: aUnit({ zone: "battlefield" }) } },
    ...perMight,
  ],
});
