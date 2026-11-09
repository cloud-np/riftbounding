/**
 * Rhasa the Sunderer (OGN-195) — "I cost [1] less for each card in your trash."
 *
 * A cost passive that applies from the hand (366.2.a). `costAdjustments` only reads fixed amounts,
 * so "[1] less for each card" is written as one conditional "[1] less" per card up to the printed
 * Energy cost of 10 (trash ≥ 1, ≥ 2, … ≥ 10): the discount is exactly min(cards in trash, 10), and
 * the cost cannot go below 0 anyway (356.4). The Power cost is unchanged.
 */
import type { Ability } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

const PRINTED_ENERGY = 10;

const perCard: Ability[] = Array.from({ length: PRINTED_ENERGY }, (_, index) => ({
  kind: "passive",
  modifier: { kind: "while", condition: {
        kind: "compare",
        left: { kind: "cards-in-zone", zone: "trash" },
        op: "gte",
        right: index + 1,
      }, modifier: { kind: "cost", amount: -1, target: SELF } },
}));

registerCardScript({
  name: "Rhasa the Sunderer",
  text: "I cost [1] less for each card in your trash.",
  status: "implemented",
  abilities: perCard,
});
