/**
 * Keyword triggered abilities in the effects lane — Vision 817, Temporary 816, Hunt 823,
 * Disarm 831. (Deathknell 808 is written in scripts as a `kill` trigger on the source itself.)
 *
 * Each keyword is "functionally short for" a triggered ability; the synthesized abilities use
 * the ref `keyword:<Name>` and carry their effect inline on the chain item.
 */
import type { Effect, Trigger } from "@rift/protocol";

export interface KeywordTrigger {
  keyword: string;
  trigger: Trigger;
  effect(value: number): Effect;
  /** 816.2.a / 831.1.d.1: several instances trigger once (with the summed value). */
  once: boolean;
}

export const KEYWORD_TRIGGERS: readonly KeywordTrigger[] = [
  {
    // 817.1.b: "When this is played, [Predict]." (817.1.c: the permanent entering the Board.)
    keyword: "vision",
    trigger: { kind: "event", event: { type: ["unit_played", "gear_played"], subject: { targetRef: "self" } } },
    effect: () => ({ op: "predict", amount: 1 }),
    once: false,
  },
  {
    // 816.1.b: "At the start of this permanent's controller's Beginning Phase, before scoring,
    // kill this."
    keyword: "temporary",
    trigger: { kind: "phase", phase: "beginning" },
    effect: () => ({ op: "kill", target: { targetRef: "self" } }),
    once: true,
  },
  {
    // 823.1.c.1: "When I Conquer or Hold, my controller gains X XP."
    keyword: "hunt",
    trigger: { kind: "event", event: { type: ["conquer", "hold"], subject: { targetRef: "self" } } },
    effect: (value) => ({ op: "gain_xp", amount: value }),
    once: true,
  },
  {
    // 831.1.d: "When I attack, give an enemy unit here -X [M] this turn."
    keyword: "disarm",
    trigger: { kind: "event", event: { type: "attack", subject: { targetRef: "self" } } },
    effect: (value) => ({
      op: "temporary_might",
      amount: -value,
      target: {
        chosen: true,
        targetRef: "target:0",
        cardType: "unit",
        controller: "opponent",
        zone: { kind: "chosen", ref: "here" },
      },
    }),
    once: true,
  },
];

export function keywordTrigger(keyword: string): KeywordTrigger | undefined {
  return KEYWORD_TRIGGERS.find((entry) => entry.keyword === keyword.toLowerCase());
}
