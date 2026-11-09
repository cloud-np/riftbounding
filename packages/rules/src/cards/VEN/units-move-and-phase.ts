/**
 * Vendetta units with move triggers (421), "becomes ready" triggers (416) and Beginning Phase
 * triggers (315.2).
 */
import type { Trigger } from "@rift/protocol";
import { conditional, notIntrinsic, runesControlled } from "./shared";
import { custom, not, registerCardScript, SELF, WHEN_I_MOVE } from "../sdk";

/** "When I move to a battlefield" (the move event's destination is a battlefield zone). */
const WHEN_I_MOVE_TO_A_BATTLEFIELD: Trigger = {
  kind: "event",
  event: { type: "move", subject: SELF, zone: "battlefield" },
};

const FEWER_RUNES = custom("ven:fewer-runes-than-an-opponent");

registerCardScript({
  name: "Eclipse Dragon",
  text: "[Accelerate] (You may pay [1][Fury] as an additional cost to have me enter ready.)\nWhen I move, if you control 4 or fewer runes, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      condition: runesControlled("lte", 4),
      effect: { op: "draw", amount: 1 },
    },
  ],
});

registerCardScript({
  name: "Minah Swiftfoot",
  text: "When I move to a battlefield, choose one —\n- Each player discards 1. \n- Each player draws 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_A_BATTLEFIELD,
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "discard",
            label: "Each player discards 1.",
            effect: { op: "discard", amount: 1, player: "each" },
          },
          {
            id: "draw",
            label: "Each player draws 1.",
            effect: { op: "draw", amount: 1, player: "each" },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Akali, Silent",
  text: "I can't be chosen by enemy spells and abilities unless I'm in combat.\nWhen I move to a battlefield, give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    // 757.1 / 740.2.c: the restriction applies while I'm not in combat.
    conditional(not(custom("core:in-combat")), {
      kind: "restriction",
      restriction: "be-targeted:enemy",
      target: SELF,
    }),
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_A_BATTLEFIELD,
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});

registerCardScript({
  name: "Fretful Feline",
  text: "When I become ready, give me +2[Might] this turn.",
  status: "partial",
  notes:
    "Triggers when an effect readies me (416); the Beginning Phase 'ready all' (315.1) emits one `ready_all` event and no per-object `ready` events, so it does not trigger there.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "ready", subject: SELF } },
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});

registerCardScript({
  name: "Forsaken Baccai",
  text: "If you control fewer runes than an opponent at the start of your Beginning phase, give me +1[might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      condition: FEWER_RUNES,
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
  ],
});

registerCardScript({
  name: "Oasis Raider",
  text: "If you control fewer runes than an opponent at the start of your Beginning Phase, give me +2 [Might] and [Ganking] this turn. (I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Ganking"),
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      condition: FEWER_RUNES,
      effect: {
        op: "seq",
        effects: [
          { op: "temporary_might", amount: 2, target: SELF },
          { op: "grant_keyword", keyword: "Ganking", target: SELF, duration: "this-turn" },
        ],
      },
    },
  ],
});
