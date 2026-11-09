/**
 * Astral Heron (VEN-044, Vendetta errata) — "When you play your first card each turn, if I'm at a
 * battlefield, the next card you play this turn costs [2][Rune][Rune] less." (EX[203])
 *
 * 420.4.a: the trigger fires when the first card's play completes (it resolves); 383.2.a.1: "if
 * I'm at a battlefield" is part of the trigger condition. 420.5: the discount applies to the next
 * Play game action and is then used up (`cost-adjust` with `once`, reported by
 * `costAdjustments`; R2-play applies it to the total cost, 356.4).
 */
import { registerCardScript } from "../registry";
import { SELF_AT_BATTLEFIELD, custom } from "../dsl";

registerCardScript({
  name: "Astral Heron",
  text:
    "When you play your first card each turn, if I'm at a battlefield, the next card you play this turn costs [2][Rune][Rune] less.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "played", player: "self" } },
      condition: { kind: "and", conditions: [custom("first-played-this-turn"), SELF_AT_BATTLEFIELD] },
      effect: {
        op: "continuous",
        duration: "this-turn",
        modifier: {
          kind: "custom",
          id: "cost-adjust",
          params: { energy: -2, power: { any: -2 }, once: true, target: { controller: "self" } },
        },
      },
    },
  ],
});
