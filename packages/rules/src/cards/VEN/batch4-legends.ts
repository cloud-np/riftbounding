/**
 * Vendetta legends (batch 4) whose abilities empower and disempower themselves.
 *
 * "Disempower me, …: …" is an activated ability whose cost includes disempowering the legend
 * (357.2). The Cost shape has no disempower part, so it is modeled as a precondition (the ability
 * is rejected unless the legend is Empowered, 377.2.b) and the disempower is the first
 * instruction on resolution.
 */
import type { Ability, Effect } from "@rift/protocol";
import { SELF_EMPOWERED } from "./shared";
import { aUnit, registerCardScript, SELF } from "../sdk";

const COST_GAP =
  "'Disempower me' is part of the activation cost (357.2) but the Cost shape has no disempower part, so it is paid first on resolution; the ability is rejected unless I am Empowered.";

/** "When you empower something else, empower me." (442.2.a; the event's player is the empowerer). */
const EMPOWER_ELSE: Ability = {
  kind: "triggered",
  trigger: {
    kind: "event",
    event: { type: "empower", player: "self", subject: { excludeSource: true } },
  },
  effect: { op: "empower", target: SELF },
};

function disempowerAnd(effect: Effect): Effect {
  return {
    op: "requires",
    condition: SELF_EMPOWERED,
    rule: "357.2",
    effect: { op: "seq", effects: [{ op: "disempower", target: SELF }, effect] },
  };
}

registerCardScript({
  name: "Mel, Soul's Reflection",
  text: "When you empower something else, empower me. (I become Empowered if I'm not already.)\nDisempower me, [Tap]: Give a unit at a battlefield -2 [Might] this turn.",
  status: "partial",
  notes: COST_GAP,
  abilities: [
    EMPOWER_ELSE,
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: disempowerAnd({
        op: "temporary_might",
        amount: -2,
        target: aUnit({ zone: "battlefield", targetRef: "target:0" }),
      }),
    },
  ],
});

registerCardScript({
  name: "Ambessa, Matriarch of War",
  text: "When you empower something else, empower me. (I become Empowered if I'm not already.)\nDisempower me, [Rune], [Tap]: Ready a unit.",
  status: "partial",
  notes: COST_GAP,
  abilities: [
    EMPOWER_ELSE,
    {
      kind: "activated",
      cost: { power: { any: 1 }, exhaust: SELF },
      effect: disempowerAnd({ op: "ready", target: aUnit({ targetRef: "target:0" }) }),
    },
  ],
});

registerCardScript({
  name: "Zed, Master of Shadows",
  text: "When you banish a card you own, empower me. (I become Empowered if I'm not already.)\n[Action] Disempower me, [Tap]: Discard 1, then draw 1.",
  status: "partial",
  notes: COST_GAP,
  abilities: [
    {
      kind: "triggered",
      // 428: the `banish` event's player is the card's owner (the player whose zone it left).
      trigger: { kind: "event", event: { type: "banish", player: "self" } },
      effect: { op: "empower", target: SELF },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["action"],
      effect: disempowerAnd({
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "draw", amount: 1 },
        ],
      }),
    },
  ],
});
