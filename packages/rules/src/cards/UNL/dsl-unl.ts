/**
 * Small Unleashed-lane builders (pure data, no registration).
 */
import type { Effect, Selector } from "@rift/protocol";
import { custom } from "../dsl";

/** "If you paid the Repeat cost" (820.1.d; R2-play's optional cost id, default "repeat"). */
export function ifRepeat(effect: Effect, id = "repeat"): Effect {
  return { op: "if", condition: custom("unl:paid-cost", { id }), then: effect };
}

/** `where` filter: one of the cards bound to `ref` (e.g. the looked-at cards). */
export function inRef(ref: string): Selector["where"] {
  return { kind: "custom", id: "in-ref", params: { ref } };
}

/**
 * "Look at the top N cards of your Main Deck. You may reveal a <filter> from among them and draw
 * it. Recycle the rest." (425 look, 425 reveal, 414 draw, 417 recycle; 417.5 random order.)
 * `key` must be unique per execution (Repeat runs it twice).
 */
export function lookRevealDraw(amount: number, filter: Selector, key = "kept"): Effect {
  return {
    op: "look",
    amount,
    then: {
      op: "seq",
      effects: [
        {
          op: "choose",
          key,
          min: 0,
          max: 1,
          selector: { ...filter, zone: "deck", controller: "self", where: inRef("looked") },
          label: "rules.prompt.revealAndDraw",
        },
        { op: "reveal", target: { targetRef: key } },
        { op: "custom", id: "unl:draw-ref", params: { ref: key } },
        { op: "recycle", target: { zone: "deck", controller: "self", where: inRef("looked") } },
      ],
    },
  };
}
