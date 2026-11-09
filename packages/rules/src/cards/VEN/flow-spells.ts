/**
 * Vendetta [Flow] spells whose effect is a single DSL instruction sequence. [Flow] itself (829:
 * "You may play this from your trash for its Flow cost. Then banish it.") is not implemented by
 * R2-play, so each card is `partial` with the effect automated.
 */
import { registerCardScript } from "../registry";
import { aUnit, token } from "../dsl";
import { FLOW_GAP } from "./shared";

registerCardScript({
  name: "Brittle Steel",
  text: "Kill a gear.\n[Flow][4][Fury] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [
    { kind: "spell", effect: { op: "kill", target: { chosen: true, cardType: "gear" } } },
  ],
});

registerCardScript({
  name: "Dredge Up",
  text: "Draw 1.\n[Flow][2] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [{ kind: "spell", effect: { op: "draw", amount: 1 } }],
});

registerCardScript({
  name: "Onslaught",
  text: "Give a unit +6 [Might] this turn.\n[Flow][4] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 6, target: aUnit() } }],
});

registerCardScript({
  name: "Iterative Design",
  text: "Play a 3 [Might] Mech unit token.\n[Flow][2][Mind] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [
    { kind: "spell", effect: { op: "create", token: token("Mech", { might: 3, play: true }) } },
  ],
});

registerCardScript({
  name: "Up from the Deep",
  text: "Play two 1 [Might] Tentacle unit tokens from Bilgewater.\n[Flow][3] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [
    {
      kind: "spell",
      effect: { op: "create", token: token("Tentacle", { count: 2, might: 1, play: true }) },
    },
  ],
});

registerCardScript({
  name: "Twilight Shroud",
  text: "Give a friendly unit +1 [Might] this turn. It can't be chosen by enemy spells and abilities this turn.\n[Flow][2] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "temporary_might",
            amount: 1,
            target: aUnit({ controller: "self", targetRef: "target:0" }),
          },
          {
            // 757.1: frozen to the chosen unit for this turn (391.4 delayed passive).
            op: "continuous",
            duration: "this-turn",
            modifier: {
              kind: "restriction",
              restriction: "be-targeted:enemy",
              target: { targetRef: "target:0" },
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Twilight Step",
  text: "Move a unit with 3 [Might] or less.\n[Flow][4][Chaos] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "move",
        target: aUnit({ might: { op: "lte", value: 3 } }),
        to: { kind: "chosen", ref: "destination" },
      },
    },
  ],
});

registerCardScript({
  name: "Perfect Execution",
  text: "Ready a unit and give it [Assault 3] this turn. (+3 [Might] while it's an attacker.)\n[Flow][3][Fury] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: aUnit({ targetRef: "target:0" }) },
          {
            op: "grant_keyword",
            keyword: "Assault 3",
            target: { targetRef: "target:0" },
            duration: "this-turn",
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Public Execution",
  text: "Choose a friendly unit. Kill an enemy unit with less Might than it.\n[Flow][5][Rune][Rune] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "self", targetRef: "target:0" }),
        effect: {
          op: "kill",
          target: aUnit({
            controller: "opponent",
            targetRef: "target:1",
            might: { op: "lt", value: { kind: "might", selector: { targetRef: "target:0" } } },
          }),
        },
      },
    },
  ],
});

registerCardScript({
  name: "Shuriken Flip",
  text: "Deal 2 to up to one enemy unit at a battlefield, then move a friendly unit.\n[Flow][3][Rune] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: 2,
            target: aUnit({ controller: "opponent", zone: "battlefield", maxCount: 1 }),
          },
          {
            op: "move",
            target: aUnit({ controller: "self" }),
            to: { kind: "chosen", ref: "destination" },
          },
        ],
      },
    },
  ],
});
