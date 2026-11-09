/**
 * Keyword triggered abilities in the effects lane — Vision 817, Temporary 816, Hunt 823,
 * Disarm 831, Quick-Draw 819, Weaponmaster 821 and Deploy 830. (Deathknell 808 is written in
 * scripts as a `kill` trigger on the source itself.)
 *
 * Each keyword is "functionally short for" a triggered ability; the synthesized abilities use
 * the ref `keyword:<Name>` and carry their effect inline on the chain item.
 */
import type { Effect, Trigger } from "@rift/protocol";
// Side effect: registers the `keyword:weaponmaster` custom effect (821.1.c).
import "../play/weaponmaster";

export interface KeywordTrigger {
  keyword: string;
  trigger: Trigger;
  effect(value: number): Effect;
  /** 816.2.a / 819.2 / 830.2 / 831.1.d.1: several instances trigger once (with the summed value); false = 817.2 / 821.1.c.7. */
  once: boolean;
  /** 821.1.b: "you may choose …" — the trigger asks 403.1 yes/no. */
  optional?: boolean;
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
  {
    // 819.1.d: "Quick-Draw is functionally short for '[Reaction]' and 'When you play this,
    // attach it to a Unit you control.'" 819.2: several instances do not trigger separately.
    keyword: "quick-draw",
    trigger: { kind: "event", event: { type: "gear_played", subject: { targetRef: "self" } } },
    effect: () => ({
      op: "attach",
      gear: { targetRef: "self" },
      to: { chosen: true, targetRef: "target:0", cardType: "unit", controller: "self" },
    }),
    once: true,
  },
  {
    // 830.1.b: "When an opponent holds here, kill this." The hold event carries the holder
    // (`player: "opponent"` relative to the gear's controller) and the battlefield (`here`).
    keyword: "deploy",
    trigger: {
      kind: "event",
      event: { type: "hold", player: "opponent", zone: { kind: "chosen", ref: "here" } },
    },
    effect: () => ({ op: "kill", target: { targetRef: "self" } }),
    once: true,
  },
  {
    // 821.1.b / 821.1.c: "When you play me, you may choose a Card you control with the
    // Equipment tag. … Pay the cost of its Equip ability, reduced by [A], to attach it to this
    // unit." 821.1.c.7: several instances trigger separately.
    keyword: "weaponmaster",
    trigger: { kind: "event", event: { type: "unit_played", subject: { targetRef: "self" } } },
    effect: () => ({
      op: "for_each",
      max: 1,
      selector: {
        chosen: true,
        targetRef: "target:0",
        cardType: "gear",
        controller: "self",
        tag: "Equipment",
      },
      effect: { op: "custom", id: "keyword:weaponmaster" },
    }),
    once: false,
    optional: true,
  },
];

export function keywordTrigger(keyword: string): KeywordTrigger | undefined {
  return KEYWORD_TRIGGERS.find((entry) => entry.keyword === keyword.toLowerCase());
}
